import { createHash } from "crypto";
import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import pdfParse from "pdf-parse";
import { db } from "../db/client.js";

export const importRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

// ─── Monzo category → system category ───────────────────────────────────────

const MONZO_CATEGORY_MAP: Record<string, string> = {
  "Eating out":     "Food & Social",
  "Entertainment":  "Activities",
  "Groceries":      "Groceries",
  "Holidays":       "Vacation",
  "Income":         "Bank Sauce",
  "Personal care":  "Personal Care",
  "Savings":        "Investments",
  "Shopping":       "Uncategorised",
  "Transfers":      "Bank Sauce",
  "Transport":      "Transport",
};

// ─── Merchant name overrides ─────────────────────────────────────────────────

const MERCHANT_OVERRIDES: { pattern: RegExp; category: string }[] = [
  {
    pattern: /sainsbury|tesco|waitrose|lidl|aldi|asda|morrisons|whole\s*foods|co-op|budgens|marks.*partner|m&s\s*food|zabka|udderlicious|dusty\s*knuckle|avoman|venchi|cocoamore/i,
    category: "Groceries",
  },
  {
    pattern: /trainline|easyjet|ryanair|british\s*airways|tfl\s*travel|lul\s*ticket|transport\s*for\s*london|lime\*ride|lime\*\d|uber/i,
    category: "Transport",
  },
  {
    pattern: /vanguard|coinbase/i,
    category: "Investments",
  },
  {
    pattern: /deliveroo|uber.?eats|wingstop/i,
    category: "Takeout",
  },
];

function resolveCategory(monzoCategory: string, merchantName: string): string {
  for (const { pattern, category } of MERCHANT_OVERRIDES) {
    if (pattern.test(merchantName)) return category;
  }
  return MONZO_CATEGORY_MAP[monzoCategory] ?? "Uncategorised";
}

function resolveCategoryByMerchant(merchantName: string): string {
  for (const { pattern, category } of MERCHANT_OVERRIDES) {
    if (pattern.test(merchantName)) return category;
  }
  return "Uncategorised";
}

// ─── Owner detection ─────────────────────────────────────────────────────────

const ALEX_PATTERNS = [/mackintosh/i, /\balex\b/i];
const CASEY_PATTERNS = [/liddy/i, /\bcasey\b/i];

function resolveOwner(categoryName: string, merchantName: string): "Alex" | "Casey" | "Joint" {
  if (categoryName === "Bank Sauce") {
    for (const p of ALEX_PATTERNS) if (p.test(merchantName)) return "Alex";
    for (const p of CASEY_PATTERNS) if (p.test(merchantName)) return "Casey";
  }
  return "Joint";
}

async function findCategory(name: string) {
  return (
    (await db.category.findUnique({ where: { name } })) ??
    (await db.category.findUniqueOrThrow({ where: { name: "Uncategorised" } }))
  );
}

// ─── Shared date helpers ─────────────────────────────────────────────────────

const MONTH_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2,  Apr: 3,  May: 4,  Jun: 5,
  Jul: 6, Aug: 7, Sep: 8,  Oct: 9,  Nov: 10, Dec: 11,
};

function inferYear(txMonthIdx: number, stmtMonth: number, stmtYear: number): number {
  // If tx month (1-based) > statement month (1-based), transaction is from prior year
  return txMonthIdx + 1 > stmtMonth ? stmtYear - 1 : stmtYear;
}

function toIsoDateShort(month: string, day: string | number, stmtMonth: number, stmtYear: number): string {
  const idx = MONTH_IDX[month];
  const year = inferYear(idx, stmtMonth, stmtYear);
  return `${year}-${String(idx + 1).padStart(2, "0")}-${String(+day).padStart(2, "0")}`;
}

// ─── POST /api/admin/import/monzo ────────────────────────────────────────────

importRouter.post("/import/monzo", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  let rows: Record<string, string>[];
  try {
    rows = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch {
    res.status(400).json({ error: "Failed to parse CSV — check the file format" });
    return;
  }

  const existing = await db.monzoTransaction.findMany({ select: { transactionId: true } });
  const existingIds = new Set(existing.map((r) => r.transactionId));

  const duplicates: string[] = [];
  const toInsert: typeof rows = [];

  for (const row of rows) {
    const id = row["Transaction ID"];
    if (!id) continue;
    if (existingIds.has(id)) duplicates.push(id);
    else toInsert.push(row);
  }

  if (toInsert.length > 0) {
    await db.monzoTransaction.createMany({
      data: toInsert.map((row) => ({
        transactionId: row["Transaction ID"],
        date:          row["Date"] ?? "",
        time:          row["Time"] ?? "",
        type:          row["Type"] ?? "",
        name:          row["Name"] ?? "",
        emoji:         row["Emoji"] || null,
        category:      row["Category"] ?? "",
        amount:        row["Amount"] ?? "",
        currency:      row["Currency"] ?? "",
        localAmount:   row["Local amount"] ?? "",
        localCurrency: row["Local currency"] ?? "",
        notesAndTags:  row["Notes and #tags"] || null,
        address:       row["Address"] || null,
        receipt:       row["Receipt"] || null,
        description:   row["Description"] ?? "",
        categorySplit: row["Category split"] || null,
        moneyOut:      row["Money Out"] || null,
        moneyIn:       row["Money In"] || null,
      })),
    });
  }

  res.json({ imported: toInsert.length, duplicates });
});

// ─── Amex PDF parser ─────────────────────────────────────────────────────────
//
// pdf-parse extracts text column by column (descriptions first, amounts second).
// Transaction lines: "Jan5Jan5MERCHANT NAME" — no spaces between month/day.
// A standalone "CR" line marks the next transaction as a credit.
// Amount block (after "Amount  £") contains foreign amounts first, then N GBP amounts.
// We take the last N numbers as GBP amounts for N descriptions on that page.

const AMEX_PAGE_HEADER_RE = /^(MR|MRS|MS|MISS)\s+[A-Z].*\d{2}\/\d{2}\/\d{2}$/;
const AMEX_TX_LINE_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2})(.+)/;
const AMEX_PURE_AMOUNT_RE = /^[\d,]+\.\d{2}$/;
const AMEX_AMOUNT_HEADER = "Amount  £";
const AMEX_SENTINEL = "Total new spend transactions";

interface AmexRow {
  transactionDate: string;
  processDate:     string;
  description:     string;
  amount:          string;
  isCredit:        boolean;
  foreignCurrency: string | null;
  foreignAmount:   string | null;
  statementDate:   string;
}

interface AmexPage {
  descriptions: { txDate: string; procDate: string; desc: string; isCredit: boolean }[];
  amounts: string[];
}

function parseAmexPdf(text: string): AmexRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let statementDate = "";
  for (const line of lines) {
    if (AMEX_PAGE_HEADER_RE.test(line)) {
      const m = line.match(/(\d{2}\/\d{2}\/\d{2})$/);
      if (m) { statementDate = m[1]; break; }
    }
  }
  if (!statementDate) throw new Error("Could not find statement date in PDF");

  const parts = statementDate.split("/");
  const stmtMonth = parseInt(parts[1], 10);
  const stmtYear  = 2000 + parseInt(parts[2], 10);

  const pages: AmexPage[] = [];
  let currentPage: AmexPage | null = null;
  let inAmountBlock = false;
  let prevWasCR = false;

  for (const line of lines) {
    if (line.startsWith(AMEX_SENTINEL)) break;

    if (AMEX_PAGE_HEADER_RE.test(line)) {
      currentPage = { descriptions: [], amounts: [] };
      pages.push(currentPage);
      inAmountBlock = false;
      prevWasCR = false;
      continue;
    }

    if (!currentPage) continue;

    if (line === AMEX_AMOUNT_HEADER) { inAmountBlock = true; continue; }

    if (inAmountBlock) {
      if (AMEX_PURE_AMOUNT_RE.test(line)) currentPage.amounts.push(line);
      continue;
    }

    if (line === "CR") { prevWasCR = true; continue; }

    const m = line.match(AMEX_TX_LINE_RE);
    if (m) {
      const [, txMonth, txDay, procMonth, procDay, desc] = m;
      const isCredit = prevWasCR || /PAYMENT RECEIVED/i.test(desc);
      currentPage.descriptions.push({
        txDate:   toIsoDateShort(txMonth, txDay, stmtMonth, stmtYear),
        procDate: toIsoDateShort(procMonth, procDay, stmtMonth, stmtYear),
        desc:     desc.trim(),
        isCredit,
      });
      prevWasCR = false;
    }
  }

  const rows: AmexRow[] = [];
  for (const page of pages) {
    const N = page.descriptions.length;
    if (N === 0) continue;
    const gbpAmounts = page.amounts.slice(-N);
    for (let i = 0; i < N; i++) {
      const d = page.descriptions[i];
      const amount = gbpAmounts[i];
      if (!amount) continue;
      rows.push({
        transactionDate: d.txDate,
        processDate:     d.procDate,
        description:     d.desc,
        amount,
        isCredit:        d.isCredit,
        foreignCurrency: null,
        foreignAmount:   null,
        statementDate,
      });
    }
  }

  return rows;
}

// ─── POST /api/admin/import/amex ─────────────────────────────────────────────

const VALID_OWNERS = new Set(["Alex", "Casey", "Joint"]);

function amexTransactionId(row: AmexRow): string {
  const sign = row.isCredit ? "CR" : "DR";
  return createHash("sha256")
    .update(`${row.transactionDate}|${row.processDate}|${row.description}|${row.amount}|${sign}`)
    .digest("hex")
    .slice(0, 16);
}

importRouter.post("/import/amex", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const owner = VALID_OWNERS.has(req.body.owner) ? req.body.owner : "Alex";

  let text: string;
  try { text = (await pdfParse(req.file.buffer)).text; }
  catch { res.status(400).json({ error: "Failed to extract text from PDF" }); return; }

  let rows: AmexRow[];
  try { rows = parseAmexPdf(text); }
  catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse Amex statement" });
    return;
  }

  const existing = await db.amexTransaction.findMany({ select: { transactionId: true } });
  const existingIds = new Set(existing.map((r) => r.transactionId));

  const duplicates: string[] = [];
  const toInsert: (AmexRow & { transactionId: string })[] = [];
  const batchCounts = new Map<string, number>();

  for (const row of rows) {
    const baseId = amexTransactionId(row);
    const count = batchCounts.get(baseId) ?? 0;
    batchCounts.set(baseId, count + 1);
    const transactionId = count === 0 ? baseId : `${baseId}-${count}`;

    if (count > 0) {
      console.log(`[amex] within-statement duplicate #${count}: ${row.transactionDate} "${row.description}" £${row.amount} → ${transactionId}`);
    }

    if (existingIds.has(transactionId)) {
      duplicates.push(transactionId);
    } else {
      toInsert.push({ ...row, transactionId });
    }
  }

  if (toInsert.length > 0) await db.amexTransaction.createMany({ data: toInsert.map((r) => ({ ...r, owner })) });
  res.json({ imported: toInsert.length, duplicates });
});

// ─── Barclays PDF parser ──────────────────────────────────────────────────────
//
// Each transaction is one logical entry: "DD MonMERCHANT NAME£AMOUNT"
// Sometimes the amount wraps to the next line (starts with £).
// Standalone "e" lines are contactless markers — skip them.
// Description continuation lines are appended to the current transaction.
// Statement date from footer: "Page 1 of 4 // issued on DD Month YYYY"

const BARCLAYS_TX_RE = /^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(.+)/;
const BARCLAYS_AMOUNT_RE = /£([\d,]+\.\d{2})$/;
const BARCLAYS_AMOUNT_LINE_RE = /^£([\d,]+\.\d{2})$/;
const BARCLAYS_ISSUED_RE = /issued on (\d+)\s+(\w+)\s+(\d{4})/;
const BARCLAYS_SENTINEL_RE = /^(Promotional transactions|Your new balance|Interest and charges)/;

const FULL_MONTH: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

interface BarclaysRow {
  date:          string;
  description:   string;
  amount:        string;
  isCredit:      boolean;
  statementDate: string;
}

function parseBarclaysPdf(text: string): BarclaysRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Extract statement month+year from issued date in footer
  let stmtMonth = 0;
  let stmtYear  = 0;
  let statementDate = "";
  for (const line of lines) {
    const m = line.match(BARCLAYS_ISSUED_RE);
    if (m) {
      stmtMonth = FULL_MONTH[m[2]] ?? 0;
      stmtYear  = parseInt(m[3], 10);
      statementDate = `${m[2]} ${m[3]}`;
      break;
    }
  }
  if (!stmtMonth) throw new Error("Could not find statement date in Barclays PDF");

  const rows: BarclaysRow[] = [];
  let current: Partial<BarclaysRow> | null = null;
  let inTransactions = false;

  function flush() {
    if (current?.date && current.description && current.amount !== undefined) {
      rows.push(current as BarclaysRow);
    }
    current = null;
  }

  for (const line of lines) {
    // Start collecting after the "How you've used your card" header
    if (line === "How you've used your card") { inTransactions = true; continue; }
    if (!inTransactions) continue;

    // Stop at end of spend section
    if (BARCLAYS_SENTINEL_RE.test(line)) { flush(); break; }

    // Skip contactless marker and other noise lines
    if (line === "e" || line === "m" || line.startsWith("Page ")) continue;

    // New transaction line
    const txMatch = line.match(BARCLAYS_TX_RE);
    if (txMatch) {
      flush();
      const [, day, month, rest] = txMatch;
      const date = toIsoDateShort(month, day, stmtMonth, stmtYear);
      const amountMatch = rest.match(BARCLAYS_AMOUNT_RE);
      if (amountMatch) {
        const desc = rest.slice(0, rest.lastIndexOf("£")).trim();
        const isCredit = /Payment By Direct Debit/i.test(desc);
        current = { date, description: desc, amount: amountMatch[1], isCredit, statementDate };
      } else {
        current = { date, description: rest.trim(), isCredit: false, statementDate };
      }
      continue;
    }

    if (!current) continue;

    // Amount on its own line
    const amtMatch = line.match(BARCLAYS_AMOUNT_LINE_RE);
    if (amtMatch) {
      current.amount = amtMatch[1];
      current.isCredit = /Payment By Direct Debit/i.test(current.description ?? "");
      continue;
    }

    // Description continuation (e.g. Amazon.co.uk wrapping, or Sunbury-On-the "e" suffix)
    if (!current.amount) {
      current.description = (current.description ?? "") + " " + line;
    }
  }

  flush();
  return rows;
}

// ─── POST /api/admin/import/barclays ─────────────────────────────────────────

importRouter.post("/import/barclays", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const owner = VALID_OWNERS.has(req.body.owner) ? req.body.owner : "Alex";

  let text: string;
  try { text = (await pdfParse(req.file.buffer)).text; }
  catch { res.status(400).json({ error: "Failed to extract text from PDF" }); return; }

  let rows: BarclaysRow[];
  try { rows = parseBarclaysPdf(text); }
  catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse Barclays statement" });
    return;
  }

  if (rows.length > 0) await db.barclaysTransaction.createMany({ data: rows.map((r) => ({ ...r, owner })) });
  res.json({ imported: rows.length });
});

// ─── Santander PDF parser ─────────────────────────────────────────────────────
//
// Current account (not credit card) — has both money in and money out.
// Transaction lines: "DDth MonDESCRIPTION[amount][balance]" all concatenated.
// Some entries span multiple lines (long descriptions).
// Amounts are determined by tracking the running balance:
//   if prevBalance + amount ≈ newBalance → money in
//   if prevBalance - amount ≈ newBalance → money out
// Skip: opening/closing balance markers.

const SANTANDER_TX_RE = /^(\d{1,2})(?:st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(.*)/;
const SANTANDER_PERIOD_RE = /Your transactions.*?(\d{1,2})\w{2}\s+(\w+)\s+(\d{4})\s+to\s+(\d{1,2})\w{2}\s+(\w+)\s+(\d{4})/i;
const SANTANDER_TWO_AMOUNTS_RE = /([\d,]+\.\d{2})([\d,]+\.\d{2})$/;
const SANTANDER_ONE_AMOUNT_RE = /([\d,]+\.\d{2})$/;
const SANTANDER_SKIP_RE = /^(Balance brought forward|Balance carried forward|Average credit balance)/i;

interface SantanderRow {
  date:          string;
  description:   string;
  moneyIn:       string | null;
  moneyOut:      string | null;
  balance:       string;
  statementDate: string;
}

function parseAmount(s: string): number {
  return Math.round(parseFloat(s.replace(/,/g, "")) * 100);
}

function parseSantanderPdf(text: string): SantanderRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Extract statement period to determine year boundaries
  let stmtMonth = 0;
  let stmtYear  = 0;
  let statementDate = "";
  for (const line of lines) {
    const m = line.match(SANTANDER_PERIOD_RE);
    if (m) {
      // Use end date (m[4], m[5], m[6]) for year inference
      stmtMonth = FULL_MONTH[m[5]] ?? MONTH_IDX[m[5].slice(0,3)] + 1 ?? 0;
      stmtYear  = parseInt(m[6], 10);
      statementDate = `${m[1]} ${m[2]} ${m[3]} to ${m[4]} ${m[5]} ${m[6]}`;
      break;
    }
  }
  if (!stmtMonth) throw new Error("Could not find statement period in Santander PDF");

  const rows: SantanderRow[] = [];
  let current: { date: string; description: string } | null = null;
  let prevBalance = 0; // in pence
  let inTransactions = false;

  function flush(amountStr: string, balanceStr: string) {
    if (!current) return;
    const amount  = parseAmount(amountStr);
    const balance = parseAmount(balanceStr);

    // Determine direction by comparing with previous balance
    let moneyIn: string | null = null;
    let moneyOut: string | null = null;
    if (Math.abs(prevBalance + amount - balance) <= 1) {
      moneyIn = amountStr;
    } else if (Math.abs(prevBalance - amount - balance) <= 1) {
      moneyOut = amountStr;
    } else {
      // Ambiguous — treat as money out (conservative)
      moneyOut = amountStr;
    }

    prevBalance = balance;
    rows.push({
      date:          current.date,
      description:   current.description.trim(),
      moneyIn,
      moneyOut,
      balance:       balanceStr,
      statementDate,
    });
    current = null;
  }

  for (const line of lines) {
    if (line.startsWith("Your transactions")) { inTransactions = true; }
    if (!inTransactions) continue;

    // Skip table header
    if (/^DateDescriptionMoney inMoney out/.test(line)) continue;

    // Opening balance — extract and set prevBalance, skip as transaction
    if (/Balance brought forward from previous statement/.test(line)) {
      const m = line.match(SANTANDER_ONE_AMOUNT_RE);
      if (m) prevBalance = parseAmount(m[1]);
      continue;
    }

    // Closing balance — stop
    if (/Balance carried forward/.test(line)) {
      if (current) {
        // Shouldn't happen, but flush if pending
        current = null;
      }
      break;
    }

    // Skip average balance line
    if (SANTANDER_SKIP_RE.test(line)) continue;

    // New transaction line?
    const txMatch = line.match(SANTANDER_TX_RE);
    if (txMatch) {
      const [, day, month, rest] = txMatch;
      const date = toIsoDateShort(month, day, stmtMonth, stmtYear);

      // Try to extract trailing amounts from rest
      const twoAmts = rest.match(SANTANDER_TWO_AMOUNTS_RE);
      if (twoAmts) {
        // Flush any pending
        if (current) {
          // Shouldn't have a pending without amounts, but discard it
          current = null;
        }
        const amtStr  = twoAmts[1];
        const balStr  = twoAmts[2];
        const desc    = rest.slice(0, rest.length - twoAmts[0].length).trim();
        if (!SANTANDER_SKIP_RE.test(desc)) {
          current = { date, description: desc };
          flush(amtStr, balStr);
        }
      } else {
        // No amounts yet — could be multi-line entry (only date on this line)
        // Flush any previous current
        current = null;
        const desc = rest.trim();
        current = { date, description: desc };
      }
      continue;
    }

    // Not a date line — could be description continuation or amounts-only line
    if (current) {
      const twoAmts = line.match(SANTANDER_TWO_AMOUNTS_RE);
      if (twoAmts) {
        // This line is just amounts (e.g., "2,400.003,475.57")
        flush(twoAmts[1], twoAmts[2]);
      } else if (!/^[\d,]+\.\d{2}$/.test(line)) {
        // Description continuation
        current.description += " " + line;
      }
    }
  }

  return rows;
}

// ─── POST /api/admin/import/santander ────────────────────────────────────────

importRouter.post("/import/santander", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const owner = VALID_OWNERS.has(req.body.owner) ? req.body.owner : "Alex";

  let text: string;
  try { text = (await pdfParse(req.file.buffer)).text; }
  catch { res.status(400).json({ error: "Failed to extract text from PDF" }); return; }

  let rows: SantanderRow[];
  try { rows = parseSantanderPdf(text); }
  catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse Santander statement" });
    return;
  }

  if (rows.length > 0) await db.santanderTransaction.createMany({ data: rows.map((r) => ({ ...r, owner })) });
  res.json({ imported: rows.length });
});

// ─── GET /api/admin/staged ───────────────────────────────────────────────────

importRouter.get("/staged", async (_req, res) => {
  const [monzo, amex, barclays, santander] = await Promise.all([
    db.monzoTransaction.groupBy({ by: ["status"], _count: true }),
    db.amexTransaction.groupBy({ by: ["status", "owner"], _count: true }),
    db.barclaysTransaction.groupBy({ by: ["status", "owner"], _count: true }),
    db.santanderTransaction.groupBy({ by: ["status", "owner"], _count: true }),
  ]);

  function toCounts(rows: { status: string; _count: number }[]) {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.status] = (m[r.status] ?? 0) + r._count;
    return { pending: m.pending ?? 0, processed: m.processed ?? 0, skipped: m.skipped ?? 0 };
  }

  function toOwnerCounts(rows: { status: string; owner: string; _count: number }[]) {
    const byOwner: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      byOwner[r.owner] ??= {};
      byOwner[r.owner][r.status] = (byOwner[r.owner][r.status] ?? 0) + r._count;
    }
    return byOwner;
  }

  res.json({
    monzo:     toCounts(monzo.map((r) => ({ status: r.status, _count: r._count }))),
    amex:      { ...toCounts(amex.map((r) => ({ status: r.status, _count: r._count }))), byOwner: toOwnerCounts(amex.map((r) => ({ status: r.status, owner: r.owner, _count: r._count }))) },
    barclays:  { ...toCounts(barclays.map((r) => ({ status: r.status, _count: r._count }))), byOwner: toOwnerCounts(barclays.map((r) => ({ status: r.status, owner: r.owner, _count: r._count }))) },
    santander: { ...toCounts(santander.map((r) => ({ status: r.status, _count: r._count }))), byOwner: toOwnerCounts(santander.map((r) => ({ status: r.status, owner: r.owner, _count: r._count }))) },
  });
});

// ─── POST /api/admin/process ─────────────────────────────────────────────────

type StagedStatus = "pending" | "processed" | "skipped";

importRouter.post("/process", async (_req, res) => {
  let processed = 0;
  let skipped = 0;

  // ── Monzo ──────────────────────────────────────────────────────────────────
  const pendingMonzo = await db.monzoTransaction.findMany({ where: { status: "pending" } });

  for (const row of pendingMonzo) {
    const amountNum = parseFloat(row.amount);
    let next: StagedStatus;
    if (isNaN(amountNum)) {
      next = "skipped";
      skipped++;
    } else {
      const type = amountNum >= 0 ? "Income" : "Expense";
      const amount = Math.abs(amountNum);
      const [day, month, year] = row.date.split("/").map(Number);
      const [hh, mm, ss] = row.time.split(":").map(Number);
      const date = new Date(year, month - 1, day, hh, mm, ss);
      const categoryName = resolveCategory(row.category, row.name);
      const category = await findCategory(categoryName);
      const owner = resolveOwner(categoryName, row.name);
      await db.transaction.create({
        data: { description: row.name, amount, type, date, categoryId: category.id, externalId: `monzo:${row.transactionId}`, owner },
      });
      next = "processed";
      processed++;
    }
    await db.monzoTransaction.update({ where: { transactionId: row.transactionId }, data: { status: next } });
  }

  // ── Amex ───────────────────────────────────────────────────────────────────
  const pendingAmex = await db.amexTransaction.findMany({ where: { status: "pending" } });

  for (const row of pendingAmex) {
    const amountNum = parseFloat(row.amount.replace(/,/g, ""));
    let next: StagedStatus;
    if (isNaN(amountNum)) {
      next = "skipped";
      skipped++;
    } else {
      const categoryName = resolveCategoryByMerchant(row.description);
      const category = await findCategory(categoryName);
      await db.transaction.create({
        data: {
          description: row.description,
          amount:      amountNum,
          type:        row.isCredit ? "Income" : "Expense",
          date:        new Date(row.transactionDate),
          categoryId:  category.id,
          externalId:  `amex:${row.transactionId}`,
          owner:       row.owner as "Alex" | "Casey" | "Joint",
        },
      });
      next = "processed";
      processed++;
    }
    await db.amexTransaction.update({ where: { transactionId: row.transactionId }, data: { status: next } });
  }

  // ── Barclays ───────────────────────────────────────────────────────────────
  const pendingBarclays = await db.barclaysTransaction.findMany({ where: { status: "pending" } });

  for (const row of pendingBarclays) {
    let next: StagedStatus;
    if (row.isCredit) {
      next = "skipped";
      skipped++;
    } else {
      const amountNum = parseFloat(row.amount.replace(/,/g, ""));
      if (isNaN(amountNum)) {
        next = "skipped";
        skipped++;
      } else {
        const categoryName = resolveCategoryByMerchant(row.description);
        const category = await findCategory(categoryName);
        await db.transaction.create({
          data: {
            description: row.description,
            amount:      amountNum,
            type:        "Expense",
            date:        new Date(row.date),
            categoryId:  category.id,
            externalId:  `barclays:${row.id}`,
            owner:       row.owner as "Alex" | "Casey" | "Joint",
          },
        });
        next = "processed";
        processed++;
      }
    }
    await db.barclaysTransaction.update({ where: { id: row.id }, data: { status: next } });
  }

  // ── Santander ──────────────────────────────────────────────────────────────
  const pendingSantander = await db.santanderTransaction.findMany({ where: { status: "pending" } });

  for (const row of pendingSantander) {
    const isIncome = row.moneyIn !== null;
    const amountStr = row.moneyIn ?? row.moneyOut ?? "";
    const amountNum = parseFloat(amountStr.replace(/,/g, ""));
    let next: StagedStatus;
    if (isNaN(amountNum) || amountNum === 0) {
      next = "skipped";
      skipped++;
    } else {
      const categoryName = resolveCategoryByMerchant(row.description);
      const category = await findCategory(categoryName);
      await db.transaction.create({
        data: {
          description: row.description,
          amount:      amountNum,
          type:        isIncome ? "Income" : "Expense",
          date:        new Date(row.date),
          categoryId:  category.id,
          externalId:  `santander:${row.id}`,
          owner:       row.owner as "Alex" | "Casey" | "Joint",
        },
      });
      next = "processed";
      processed++;
    }
    await db.santanderTransaction.update({ where: { id: row.id }, data: { status: next } });
  }

  res.json({ processed, skipped });
});
