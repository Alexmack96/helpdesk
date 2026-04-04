import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { db } from "../db/client.js";

export const adminRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

// ─── Their system categories (not Monzo's) ──────────────────────────────────
// These are the categories that appear in the dashboard.
// Monzo's raw categories are mapped onto these during processing.

const SYSTEM_CATEGORIES: Record<string, string> = {
  "Groceries":      "#22c55e",
  "Night Out":      "#f97316",
  "Takeout":        "#fb923c",
  "Transport":      "#3b82f6",
  "Entertainment":  "#ec4899",
  "Vacation":       "#eab308",
  "Personal Care":  "#f43f5e",
  "Bank Sauce":     "#0ea5e9",  // income + transfers combined
  "Savings":        "#a855f7",
  "General":        "#64748b",
  "Uncategorised":  "#d1d5db",  // fallback when no mapping is confident
};

// ─── Monzo category → system category ───────────────────────────────────────
// Only map when we're confident. Omitting a Monzo category → "Uncategorised".

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
  // "Shopping" intentionally unmapped → Uncategorised
};

// ─── Merchant name overrides ─────────────────────────────────────────────────
// Checked before the category map. Useful for merchants Monzo miscategorises
// or where the system category is more specific than Monzo's guess.

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
// Adjust these patterns to match the exact names on your Monzo transfers.

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

export async function initSystemCategories() {
  for (const [name, color] of Object.entries(SYSTEM_CATEGORIES)) {
    await db.category.upsert({
      where: { name },
      create: { name, color },
      update: {},
    });
  }
}

// Merges legacy/raw Monzo category names into canonical system categories.
// Safe to run repeatedly — no-ops if legacy categories don't exist.
export async function migrateLegacyCategories() {
  const legacyMap: Record<string, string> = {
    "Eating out":    "Eating Out",
    "Personal care": "Personal Care",
    "Holidays":      "Vacation",
    "Golf":          "General",
    "Alex Ignore":   "General",
    "Shopping":      "Uncategorised",
    "Income":        "Bank Sauce",
    "Transfers":     "Bank Sauce",
    "Eating Out":    "Night Out",
  };

  for (const [legacy, canonical] of Object.entries(legacyMap)) {
    const legacyCat = await db.category.findUnique({ where: { name: legacy } });
    if (!legacyCat) continue;
    const canonicalCat = await db.category.findUnique({ where: { name: canonical } });
    if (!canonicalCat) continue;

    await db.transaction.updateMany({
      where: { categoryId: legacyCat.id },
      data: { categoryId: canonicalCat.id },
    });
    await db.category.delete({ where: { id: legacyCat.id } });
    console.log(`Migrated category: "${legacy}" → "${canonical}"`);
  }
}

// ─── GET /api/admin/users ────────────────────────────────────────────────────

adminRouter.get("/users", async (_req, res) => {
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      emailVerified: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// ─── POST /api/admin/import/monzo ────────────────────────────────────────────
// Upload a Monzo CSV export. Skips rows whose transactionId already exists.
// Returns { imported, duplicates } — duplicates is the list of skipped IDs.

adminRouter.post("/import/monzo", upload.single("file"), async (req, res) => {
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

adminRouter.get("/staged", async (_req, res) => {
  const [monzoCount, processedCount] = await Promise.all([
    db.monzoTransaction.count(),
    db.transaction.count({ where: { externalId: { not: null } } }),
  ]);
  res.json({ monzo: monzoCount, processedCount });
});

// ─── POST /api/admin/process ─────────────────────────────────────────────────
// Normalises unprocessed staged rows into the Transaction table using
// the system category mapping (not Monzo's raw categories).

adminRouter.post("/process", async (_req, res) => {
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

// Retroactively sets owner on existing transactions based on category + description.
// Safe to run repeatedly — only updates transactions still on the default Joint owner
// where the detection logic would assign something different.
export async function migrateOwners() {
  // Alex Ignore is gone — any remaining transactions (not yet moved by migrateLegacyCategories)
  // should have owner=Alex set before they get reassigned to General.
  const alexIgnoreCat = await db.category.findUnique({ where: { name: "Alex Ignore" } });
  if (alexIgnoreCat) {
    await db.transaction.updateMany({
      where: { categoryId: alexIgnoreCat.id },
      data: { owner: "Alex" },
    });
  }

  const bankSauceCat  = await db.category.findUnique({ where: { name: "Bank Sauce" } });

  if (bankSauceCat) {
    const unowned = await db.transaction.findMany({
      where: { categoryId: bankSauceCat.id, owner: "Joint" },
      select: { id: true, description: true },
    });
    for (const tx of unowned) {
      const owner = resolveOwner("Bank Sauce", tx.description);
      if (owner !== "Joint") {
        await db.transaction.update({ where: { id: tx.id }, data: { owner } });
      }
    }
    if (unowned.length > 0) console.log(`Processed owner detection for ${unowned.length} Bank Sauce transactions`);
  }
}
