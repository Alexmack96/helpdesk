import { db } from "../db/client.js";

// ─── System categories ───────────────────────────────────────────────────────

const SYSTEM_CATEGORIES: Record<string, { color: string; isFixed: boolean }> = {
  "Activities":     { color: "#8b5cf6", isFixed: false },
  "Bank Sauce":     { color: "#0ea5e9", isFixed: false },
  "Eating Out":     { color: "#fb923c", isFixed: false },
  "Groceries":      { color: "#22c55e", isFixed: false },
  "Night Out":      { color: "#f97316", isFixed: false },
  "Personal Care":  { color: "#f43f5e", isFixed: false },
  "Rent & Bills":   { color: "#64748b", isFixed: true  },
  "Savings":        { color: "#a855f7", isFixed: true  },
  "Transport":      { color: "#3b82f6", isFixed: true  },
  "Uncategorised":  { color: "#d1d5db", isFixed: false },
  "Vacation":       { color: "#eab308", isFixed: false },
};

export async function initSystemCategories() {
  for (const [name, { color, isFixed }] of Object.entries(SYSTEM_CATEGORIES)) {
    await db.category.upsert({
      where: { name },
      create: { name, color, isFixed },
      update: { isFixed },
    });
  }
}

export async function mapMonzoCategories() {
  const monzoMap: Record<string, string> = {
    "Eating out":    "Eating Out",
    "Entertainment": "Activities",
    "Golf":          "Activities",
    "Holidays":      "Vacation",
    "Income":        "Bank Sauce",
    "Personal care": "Personal Care",
    "Shopping":      "Uncategorised",
    "Transfers":     "Bank Sauce",
  };

  for (const [monzo, canonical] of Object.entries(monzoMap)) {
    const monzoCat = await db.category.findUnique({ where: { name: monzo } });
    if (!monzoCat) continue;
    const canonicalCat = await db.category.findUnique({ where: { name: canonical } });
    if (!canonicalCat) continue;

    await db.transaction.updateMany({
      where: { categoryId: monzoCat.id },
      data: { categoryId: canonicalCat.id },
    });
    await db.category.delete({ where: { id: monzoCat.id } });
    console.log(`Mapped Monzo category: "${monzo}" → "${canonical}"`);
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
