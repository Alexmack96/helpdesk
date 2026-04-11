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
  "Entertainment":  "Entertainment",
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

const AMEX_PAGE_HEADER_RE = /^(?:(?:MR|MRS|MS|MISS|DR)\s+)?[A-Z].*\d{2}\/\d{2}\/\d{2}$/;
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
//
// The PDF concatenates mandate numbers directly into amounts (e.g. "MANDATE NO
// 0023257.003,898.99" where the true amount is 257.00). We sidestep this by
// extracting only the balance (last [\d,]+\.\d{2}) and deriving the transaction
// amount from the running balance difference instead of parsing it from text.

const SANTANDER_TX_RE = /^(\d{1,2})(?:st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(.*)/;
const SANTANDER_PERIOD_RE = /Your transactions.*?(\d{1,2})\w{2}\s+(\w+)\s+(\d{4})\s+to\s+(\d{1,2})\w{2}\s+(\w+)\s+(\d{4})/i;
const SANTANDER_ONE_AMOUNT_RE = /([\d,]+\.\d{2})$/;
const SANTANDER_SKIP_RE = /^(Balance brought forward|Balance carried forward|Average credit balance)/i;

// Match a single properly-formatted currency amount: 1–3 digits, optional comma-thousands groups, decimal.
// Used to find the LAST (rightmost) amount in a concatenated string so we can extract the balance
// without being confused by mandate numbers (e.g. "0023257.003,898.99" → balance is "3,898.99").
const SANTANDER_CCY_RE = /\d{1,3}(?:,\d{3})*\.\d{2}/g;

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

// Find the last properly-formatted currency amount in s and treat it as the balance.
// Uses SANTANDER_CCY_RE to avoid matching mandate numbers (e.g. "0023") as part of
// the amount — "0023257.003,898.99" correctly yields balance "3,898.99".
// Strips any trailing digits/commas/dots from the pre-balance text to remove the
// parsed transaction amount, leaving a clean description.
function splitDescBalance(s: string): { desc: string; balance: string } | null {
  const matches = [...s.matchAll(new RegExp(SANTANDER_CCY_RE.source, "g"))];
  const last    = matches.at(-1);
  if (!last || last.index! + last[0].length !== s.length) return null;
  const pre  = s.slice(0, last.index!);
  const desc = pre.replace(/[\d,.]+$/, "").trim();
  return { desc, balance: last[0] };
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
      stmtMonth = FULL_MONTH[m[5]] ?? 0;
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

  // Derive amount from balance difference — avoids parsing mandate-prefixed amounts.
  function flush(balanceStr: string) {
    if (!current) return;
    const balance = parseAmount(balanceStr);
    const diff    = balance - prevBalance;
    const moneyIn  = diff > 0 ? (diff  / 100).toFixed(2) : null;
    const moneyOut = diff < 0 ? (-diff / 100).toFixed(2) : null;
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
    if (/Balance carried forward/.test(line)) { current = null; break; }

    // Skip average balance line
    if (SANTANDER_SKIP_RE.test(line)) continue;

    // New transaction line?
    const txMatch = line.match(SANTANDER_TX_RE);
    if (txMatch) {
      const [, day, month, rest] = txMatch;
      const date   = toIsoDateShort(month, day, stmtMonth, stmtYear);
      const parsed = splitDescBalance(rest);
      if (parsed && !SANTANDER_SKIP_RE.test(parsed.desc)) {
        current = { date, description: parsed.desc };
        flush(parsed.balance);
      } else {
        // No amounts yet — multi-line entry (description continues on next lines)
        current = { date, description: rest.trim() };
      }
      continue;
    }

    // Not a date line — description continuation or standalone amounts line
    if (current) {
      if (!/[a-zA-Z]/.test(line)) {
        // No letters — could be a pure-amounts line (e.g. "2,400.003,475.57") or a
        // mandate/reference number on its own line (e.g. "0101"). Try to extract balance.
        const parsed = splitDescBalance(line);
        if (parsed) {
          flush(parsed.balance);
        } else {
          current.description += " " + line;
        }
      } else {
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

// ─── HSBC PDF parser ──────────────────────────────────────────────────────────
//
// pdf-parse reads HSBC statements column by column, so transactions appear
// BEFORE "BALANCE BROUGHT FORWARD" in the extracted text.
// Transaction lines: "DD Mon YY TYPE Description" — date optional (inherited when absent).
// Multi-line entries: name on one line, reference+amount on the next.
// CR type = money in; all other types = money out.
// Balance (when present) = last number on the final line of a transaction group.

const HSBC_DATE_RE   = /^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2})\s*(.*)/;
const HSBC_TYPE_RE   = /^(BP|OBP|CR|DD|SO|TFR|VIS|ATM|CHQ|FP|DEB|BGC|STO|DR)\s*(.*)/;
// Properly-formatted currency: 1-3 digits, optional comma-thousand groups, 2 decimal places.
// This avoids matching reference numbers (e.g. "00021370249583") that don't follow the 1-3 digit prefix rule.
const HSBC_CCY_RE    = /\d{1,3}(?:,\d{3})*\.\d{2}/g;
const HSBC_PERIOD_RE = /(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?\s+to\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i;
const HSBC_SENTINEL  = "BALANCE BROUGHT FORWARD";

// Extract the last two properly-formatted currency amounts from a line.
// Primary: split on whitespace and find tokens that are exactly a currency value.
// This prevents reference numbers whose trailing digits fuse with an amount
// (e.g. "vrp0002137024958 3,000.00 5,144.88" → tokens → "3,000.00", "5,144.88").
// Fallback: scan for the pattern anywhere in the string, requiring the last match to
// reach end-of-string. Handles amounts fused directly to descriptions with no space
// (e.g. "SKY TV51.0011,867.05").
const HSBC_CCY_EXACT = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;

function extractHsbcAmounts(s: string): { desc: string; amount: string | null; balance: string | null } {
  // Primary: token-based (requires spaces between columns)
  const tokens = s.split(/\s+/);
  const amtIdxs = tokens.reduce<number[]>((acc, t, i) => (HSBC_CCY_EXACT.test(t) ? [...acc, i] : acc), []);

  if (amtIdxs.length >= 2) {
    const desc = tokens.slice(0, amtIdxs.at(-2)!).join(" ").trim();
    return { desc: desc || s.trim(), amount: tokens[amtIdxs.at(-2)!], balance: tokens[amtIdxs.at(-1)!] };
  }
  if (amtIdxs.length === 1) {
    const desc = tokens.slice(0, amtIdxs[0]).join(" ").trim();
    return { desc: desc || s.trim(), amount: tokens[amtIdxs[0]], balance: null };
  }

  // Fallback: scan (handles fused descriptions like "SKY TV51.0011,867.05")
  const matches = [...s.matchAll(new RegExp(HSBC_CCY_RE.source, "g"))];
  if (matches.length === 0) return { desc: s.trim(), amount: null, balance: null };

  const last = matches.at(-1)!;
  if (last.index! + last[0].length !== s.length) return { desc: s.trim(), amount: null, balance: null };

  if (matches.length >= 2) {
    const second = matches.at(-2)!;
    const desc = s.slice(0, second.index!).trim();
    return { desc: desc || s.trim(), amount: second[0], balance: last[0] };
  }

  const desc = s.slice(0, last.index!).trim();
  return { desc: desc || s.trim(), amount: last[0], balance: null };
}

interface HsbcRow {
  date:          string;
  paymentType:   string;
  description:   string;
  moneyOut:      string | null;
  moneyIn:       string | null;
  balance:       string | null;
  statementDate: string;
}

interface HsbcPending {
  date:        string;
  paymentType: string;
  lines:       string[];  // raw text lines accumulated (date+type prefix already stripped)
}

function parseHsbcPdf(text: string): HsbcRow[] {
  const allLines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Statement date appears after the transactions in pdf-parse output
  let statementDate = "";
  let stmtMonth = 0;
  let stmtYear  = 0;
  for (const line of allLines) {
    const m = line.match(HSBC_PERIOD_RE);
    if (m) {
      stmtMonth    = FULL_MONTH[m[5]] ?? 0;
      stmtYear     = parseInt(m[6], 10);
      statementDate = m[3]
        ? `${m[1]} ${m[2]} ${m[3]} to ${m[4]} ${m[5]} ${m[6]}`
        : `${m[1]} ${m[2]} to ${m[4]} ${m[5]} ${m[6]}`;
      break;
    }
  }
  if (!stmtMonth) throw new Error("Could not find statement period in HSBC PDF");

  const rows: HsbcRow[] = [];
  let current: HsbcPending | null = null;
  let currentDate = "";

  function flush() {
    if (!current || current.lines.length === 0) { current = null; return; }

    // Combine all lines; extract trailing currency amounts
    const full = current.lines.join(" ");
    const { desc: rawDesc, amount, balance } = extractHsbcAmounts(full);
    const desc = rawDesc.replace(/\s+/g, " ").trim();

    const isCredit = current.paymentType === "CR";
    rows.push({
      date:          current.date,
      paymentType:   current.paymentType,
      description:   desc || current.paymentType,
      moneyOut:      !isCredit && amount ? amount : null,
      moneyIn:       isCredit && amount  ? amount : null,
      balance,
      statementDate,
    });
    current = null;
  }

  for (const line of allLines) {
    if (line.includes(HSBC_SENTINEL)) { flush(); break; }

    // Skip noise lines (table header, address, etc.) before transactions start
    if (/^(Date\s+Paym|Opening Balance|Payments In|Payments Out|Closing Balance|Your HSBC|Contact tel|Text phone|www\.|Account Summary|International Bank|Bank Identifier|Account Name)/i.test(line)) continue;

    // Check for date prefix
    const dateMatch = line.match(HSBC_DATE_RE);
    if (dateMatch) {
      const [, day, month, yr, rest] = dateMatch;
      currentDate = toIsoDateShort(month, day, stmtMonth, stmtYear);
      // Ignore override: 2-digit year → 2000+yr
      const fullYear = 2000 + parseInt(yr, 10);
      const monthIdx = MONTH_IDX[month];
      currentDate = `${fullYear}-${String(monthIdx + 1).padStart(2, "0")}-${String(+day).padStart(2, "0")}`;

      const typeMatch = rest.match(HSBC_TYPE_RE);
      if (typeMatch) {
        flush();
        const [, type, remainder] = typeMatch;
        current = { date: currentDate, paymentType: type, lines: remainder ? [remainder] : [] };
      } else if (/^BALANCE/.test(rest)) {
        // BALANCE BROUGHT/CARRIED FORWARD lines — skip
        continue;
      } else if (rest.length > 0) {
        // Date line with no type code — unlikely but append to current
        if (current) current.lines.push(rest);
      }
      continue;
    }

    // Check for type-only line (no date)
    const typeMatch = line.match(HSBC_TYPE_RE);
    if (typeMatch) {
      flush();
      const [, type, remainder] = typeMatch;
      current = { date: currentDate, paymentType: type, lines: remainder ? [remainder] : [] };
      continue;
    }

    // Continuation line
    if (current) current.lines.push(line);
  }

  flush();
  return rows;
}

// ─── POST /api/admin/import/hsbc ─────────────────────────────────────────────

// Custom pdf-parse renderer for HSBC statements.
// The default renderer concatenates same-line items with no separator, causing
// reference numbers (e.g. vrp0002137024958) to fuse with the amount column.
// This renderer inserts a space whenever the X gap between adjacent items on
// the same line exceeds the width of the previous item (i.e. there's a column gap).
async function hsbcPageRender(pageData: { getTextContent: (opts?: object) => Promise<{ items: Array<{ str: string; transform: number[]; width?: number }> }> }) {
  const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
  let lastY: number | null = null;
  let lastX: number | null = null;
  let lastWidth = 0;
  let text = "";
  for (const item of textContent.items) {
    const x = item.transform[4];
    const y = item.transform[5];
    if (lastY === null) {
      text += item.str;
    } else if (Math.abs(y - lastY) > 1) {
      text += "\n" + item.str;
    } else {
      const gap = x - (lastX! + lastWidth);
      text += (gap > 1 ? " " : "") + item.str;
    }
    lastY = y;
    lastX = x;
    lastWidth = item.width ?? 0;
  }
  return text;
}

importRouter.post("/import/hsbc", upload.single("file"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const owner = VALID_OWNERS.has(req.body.owner) ? req.body.owner : "Joint";

  let text: string;
  try { text = (await pdfParse(req.file.buffer, { pagerender: hsbcPageRender })).text; }
  catch { res.status(400).json({ error: "Failed to extract text from PDF" }); return; }

  let rows: HsbcRow[];
  try { rows = parseHsbcPdf(text); }
  catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to parse HSBC statement" });
    return;
  }

  const existing = await db.hsbcTransaction.findMany({ select: { transactionId: true } });
  const existingIds = new Set(existing.map((r) => r.transactionId));
  const batchCounts = new Map<string, number>();
  const toInsert: (HsbcRow & { transactionId: string; owner: string })[] = [];
  const duplicates: string[] = [];

  for (const row of rows) {
    const amount = row.moneyIn ?? row.moneyOut ?? "";
    const baseId = createHash("sha256")
      .update(`${row.date}|${row.paymentType}|${row.description}|${amount}`)
      .digest("hex")
      .slice(0, 16);
    const count = batchCounts.get(baseId) ?? 0;
    batchCounts.set(baseId, count + 1);
    const transactionId = count === 0 ? baseId : `${baseId}-${count}`;
    if (existingIds.has(transactionId)) duplicates.push(transactionId);
    else toInsert.push({ ...row, transactionId, owner });
  }

  if (toInsert.length > 0) await db.hsbcTransaction.createMany({ data: toInsert });
  res.json({ imported: toInsert.length, duplicates });
});

// ─── GET /api/admin/staged ───────────────────────────────────────────────────

importRouter.get("/staged", async (_req, res) => {
  const [monzo, amex, barclays, santander, hsbc] = await Promise.all([
    db.monzoTransaction.groupBy({ by: ["status"], _count: true }),
    db.amexTransaction.groupBy({ by: ["status", "owner"], _count: true }),
    db.barclaysTransaction.groupBy({ by: ["status", "owner"], _count: true }),
    db.santanderTransaction.groupBy({ by: ["status", "owner"], _count: true }),
    db.hsbcTransaction.groupBy({ by: ["status", "owner"], _count: true }),
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
    amex:      { ...toCounts(amex.map((r) => ({ status: r.status, _count: r._count }))),      byOwner: toOwnerCounts(amex.map((r) => ({ status: r.status, owner: r.owner, _count: r._count }))) },
    barclays:  { ...toCounts(barclays.map((r) => ({ status: r.status, _count: r._count }))),  byOwner: toOwnerCounts(barclays.map((r) => ({ status: r.status, owner: r.owner, _count: r._count }))) },
    santander: { ...toCounts(santander.map((r) => ({ status: r.status, _count: r._count }))), byOwner: toOwnerCounts(santander.map((r) => ({ status: r.status, owner: r.owner, _count: r._count }))) },
    hsbc:      { ...toCounts(hsbc.map((r) => ({ status: r.status, _count: r._count }))),      byOwner: toOwnerCounts(hsbc.map((r) => ({ status: r.status, owner: r.owner, _count: r._count }))) },
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
      const monzoExtId = `monzo:${row.transactionId}`;
      const monzoExists = await db.transaction.findUnique({ where: { externalId: monzoExtId }, select: { id: true } });
      if (!monzoExists) await db.transaction.create({
        data: { description: row.name, amount, type, date, categoryId: category.id, externalId: monzoExtId, owner },
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
      const amexExtId = `amex:${row.transactionId}`;
      const amexExists = await db.transaction.findUnique({ where: { externalId: amexExtId }, select: { id: true } });
      if (!amexExists) await db.transaction.create({
        data: {
          description: row.description,
          amount:      amountNum,
          type:        row.isCredit ? "Income" : "Expense",
          date:        new Date(row.transactionDate),
          categoryId:  category.id,
          externalId:  amexExtId,
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
        const barclaysExtId = `barclays:${row.id}`;
        const barclaysExists = await db.transaction.findUnique({ where: { externalId: barclaysExtId }, select: { id: true } });
        if (!barclaysExists) await db.transaction.create({
          data: {
            description: row.description,
            amount:      amountNum,
            type:        "Expense",
            date:        new Date(row.date),
            categoryId:  category.id,
            externalId:  barclaysExtId,
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
      const santanderExtId = `santander:${row.id}`;
      const santanderExists = await db.transaction.findUnique({ where: { externalId: santanderExtId }, select: { id: true } });
      if (!santanderExists) await db.transaction.create({
        data: {
          description: row.description,
          amount:      amountNum,
          type:        isIncome ? "Income" : "Expense",
          date:        new Date(row.date),
          categoryId:  category.id,
          externalId:  santanderExtId,
          owner:       row.owner as "Alex" | "Casey" | "Joint",
        },
      });
      next = "processed";
      processed++;
    }
    await db.santanderTransaction.update({ where: { id: row.id }, data: { status: next } });
  }

  // ── HSBC ───────────────────────────────────────────────────────────────────
  const pendingHsbc = await db.hsbcTransaction.findMany({ where: { status: "pending" } });

  for (const row of pendingHsbc) {
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
      const hsbcExtId = `hsbc:${row.transactionId}`;
      const hsbcExists = await db.transaction.findUnique({ where: { externalId: hsbcExtId }, select: { id: true } });
      if (!hsbcExists) await db.transaction.create({
        data: {
          description: row.description,
          amount:      amountNum,
          type:        isIncome ? "Income" : "Expense",
          date:        new Date(row.date),
          categoryId:  category.id,
          externalId:  hsbcExtId,
          owner:       row.owner as "Alex" | "Casey" | "Joint",
        },
      });
      next = "processed";
      processed++;
    }
    await db.hsbcTransaction.update({ where: { id: row.id }, data: { status: next } });
  }

  res.json({ processed, skipped });
});
