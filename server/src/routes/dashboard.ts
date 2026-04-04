import { Router } from "express";
import { db } from "../db/client.js";
import { TransactionType } from "../generated/prisma/index.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (_req, res) => {
  const all = await db.transaction.findMany({ include: { category: true } });

  let caseyIn = 0;
  let jointExpenses = 0;
  const categoryTotals: Record<string, { name: string; color: string; value: number }> = {};

  for (const t of all) {
    const amount = Number(t.amount);
    if (t.category.name === "Bank Sauce" && t.owner === "Casey") {
      caseyIn += amount;
    } else if (t.owner === "Joint") {
      const signed = t.type === TransactionType.Expense ? amount : -amount;
      jointExpenses += signed;
      if (t.type === TransactionType.Expense) {
        const key = t.categoryId;
        if (!categoryTotals[key]) {
          categoryTotals[key] = { name: t.category.name, color: t.category.color, value: 0 };
        }
        categoryTotals[key].value += amount;
      }
    }
  }

  const settlement = caseyIn - jointExpenses / 2;

  res.json({
    caseyIn,
    jointExpenses,
    settlement,
    spendingByCategory: Object.values(categoryTotals),
  });
});
