import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { db } from "../db/client.js";

export const importRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

// ─── System categories ───────────────────────────────────────────────────────

const SYSTEM_CATEGORIES: Record<string, string> = {
  "Groceries":      "#22c55e",
  "Night Out":      "#f97316",
  "Takeout":        "#fb923c",
  "Transport":      "#3b82f6",
  "Entertainment":  "#ec4899",
  "Vacation":       "#eab308",
  "Personal Care":  "#f43f5e",
  "Bank Sauce":     "#0ea5e9",
  "Savings":        "#a855f7",
  "General":        "#64748b",
  "Uncategorised":  "#d1d5db",
};

// ─── Monzo category → system category ───────────────────────────────────────

const MONZO_CATEGORY_MAP: Record<string, string> = {
  "Transport":      "Transport",
  "Eating out":     "Night Out",
  "Groceries":      "Groceries",
  "Savings":        "Savings",
  "Transfers":      "Bank Sauce",
  "Income":         "Bank Sauce",
  "Entertainment":  "Entertainment",
  "Personal care":  "Personal Care",
  "Holidays":       "Vacation",
  "General":        "General",
  "Golf":           "General",
};

// ─── Merchant name overrides ─────────────────────────────────────────────────

const MERCHANT_OVERRIDES: { pattern: RegExp; category: string }[] = [
  {
    pattern: /sainsbury|tesco|waitrose|lidl|aldi|asda|morrisons|whole\s*foods|co-op|budgens|marks.*partner|m&s\s*food|zabka|udderlicious|dusty\s*knuckle|avoman|venchi|cocoamore/i,
    category: "Groceries",
  },
  {
    pattern: /trainline|easyjet|ryanair|british\s*airways|tfl\s*travel|lul\s*ticket|transport\s*for\s*london/i,
    category: "Transport",
  },
  {
    pattern: /vanguard|coinbase/i,
    category: "Savings",
  },
  {
    pattern: /deliveroo/i,
    category: "Takeout",
  },
];

function resolveCategory(monzoCategory: string, merchantName: string): string {
  for (const { pattern, category } of MERCHANT_OVERRIDES) {
    if (pattern.test(merchantName)) return category;
  }
  return MONZO_CATEGORY_MAP[monzoCategory] ?? "Uncategorised";
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

async function upsertCategory(name: string) {
  const color = SYSTEM_CATEGORIES[name] ?? "#d1d5db";
  return db.category.upsert({
    where: { name },
    create: { name, color },
    update: {},
  });
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

  const existing = await db.monzoTransaction.findMany({
    select: { transactionId: true },
  });
  const existingIds = new Set(existing.map((r) => r.transactionId));

  const duplicates: string[] = [];
  const toInsert: typeof rows = [];

  for (const row of rows) {
    const id = row["Transaction ID"];
    if (!id) continue;
    if (existingIds.has(id)) {
      duplicates.push(id);
    } else {
      toInsert.push(row);
    }
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

// ─── GET /api/admin/staged ───────────────────────────────────────────────────

importRouter.get("/staged", async (_req, res) => {
  const [monzoCount, processedCount] = await Promise.all([
    db.monzoTransaction.count(),
    db.transaction.count({ where: { externalId: { not: null } } }),
  ]);
  res.json({ monzo: monzoCount, processedCount });
});

// ─── POST /api/admin/process ─────────────────────────────────────────────────

importRouter.post("/process", async (_req, res) => {
  const processedRows = await db.transaction.findMany({
    where: { externalId: { not: null } },
    select: { externalId: true },
  });
  const processedSet = new Set(processedRows.map((t) => t.externalId));

  const staged = await db.monzoTransaction.findMany();
  const unprocessed = staged.filter(
    (r) => !processedSet.has(`monzo:${r.transactionId}`)
  );

  let processed = 0;

  for (const row of unprocessed) {
    const amountNum = parseFloat(row.amount);
    if (isNaN(amountNum)) continue;

    const type = amountNum >= 0 ? "Income" : "Expense";
    const amount = Math.abs(amountNum);

    const [day, month, year] = row.date.split("/").map(Number);
    const [hh, mm, ss] = row.time.split(":").map(Number);
    const date = new Date(year, month - 1, day, hh, mm, ss);

    const categoryName = resolveCategory(row.category, row.name);
    const category = await upsertCategory(categoryName);
    const owner = resolveOwner(categoryName, row.name);

    await db.transaction.create({
      data: {
        description: row.name,
        amount,
        type,
        date,
        categoryId: category.id,
        externalId: `monzo:${row.transactionId}`,
        owner,
      },
    });

    processed++;
  }

  res.json({ processed });
});
