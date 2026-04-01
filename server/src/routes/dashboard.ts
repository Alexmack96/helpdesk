import { Router } from "express";
import { db } from "../db/client.js";
import { TransactionType } from "../generated/prisma/index.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (_req, res, next) => {
  try {
    const transactions = await db.transaction.findMany({
      include: { category: true },
    });

    let income = 0;
    let expenses = 0;
    const categoryTotals: Record<string, { name: string; color: string; value: number }> = {};

    for (const t of transactions) {
      const amount = Number(t.amount);
      if (t.type === TransactionType.Income) {
        income += amount;
      } else {
        expenses += amount;
        const key = t.categoryId;
        if (!categoryTotals[key]) {
          categoryTotals[key] = { name: t.category.name, color: t.category.color, value: 0 };
        }
        categoryTotals[key].value += amount;
      }
    }

    res.json({
      income,
      expenses,
      balance: income - expenses,
      spendingByCategory: Object.values(categoryTotals),
    });
  } catch (err) {
    next(err);
  }
});
