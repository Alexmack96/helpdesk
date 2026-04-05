import { db } from "../db/client.js";

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

export async function initSystemCategories() {
  for (const [name, color] of Object.entries(SYSTEM_CATEGORIES)) {
    await db.category.upsert({
      where: { name },
      create: { name, color },
      update: {},
    });
  }
}

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

export async function migrateOwners() {
  const alexIgnoreCat = await db.category.findUnique({ where: { name: "Alex Ignore" } });
  if (alexIgnoreCat) {
    await db.transaction.updateMany({
      where: { categoryId: alexIgnoreCat.id },
      data: { owner: "Alex" },
    });
  }

  const bankSauceCat = await db.category.findUnique({ where: { name: "Bank Sauce" } });

  if (bankSauceCat) {
    const unowned = await db.transaction.findMany({
      where: { categoryId: bankSauceCat.id, owner: "Joint" },
      select: { id: true, description: true },
    });
    for (const tx of unowned) {
      for (const p of [/mackintosh/i, /\balex\b/i]) {
        if (p.test(tx.description)) {
          await db.transaction.update({ where: { id: tx.id }, data: { owner: "Alex" } });
          break;
        }
      }
      for (const p of [/liddy/i, /\bcasey\b/i]) {
        if (p.test(tx.description)) {
          await db.transaction.update({ where: { id: tx.id }, data: { owner: "Casey" } });
          break;
        }
      }
    }
    if (unowned.length > 0) console.log(`Processed owner detection for ${unowned.length} Bank Sauce transactions`);
  }
}
