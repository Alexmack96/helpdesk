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

dashboardRouter.get("/analytics", async (_req, res) => {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonthIdx = now.getMonth();

  const transactions = await db.transaction.findMany({
    where: { date: { gte: yearStart } },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const expenses = transactions.filter((t) => t.type === TransactionType.Expense);

  const fixedVsVariable = MONTHS.slice(0, currentMonthIdx + 1).map((month, i) => {
    const monthExp = expenses.filter((t) => new Date(t.date).getMonth() === i);
    return {
      month,
      fixed:    monthExp.filter((t) => t.category.isFixed).reduce((s, t) => s + Number(t.amount), 0),
      variable: monthExp.filter((t) => !t.category.isFixed).reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  const monthlyFlow = MONTHS.slice(0, currentMonthIdx + 1).map((month, i) => ({
    month,
    income:  transactions.filter((t) => new Date(t.date).getMonth() === i && t.type === TransactionType.Income).reduce((s, t) => s + Number(t.amount), 0),
    expense: expenses.filter((t) => new Date(t.date).getMonth() === i).reduce((s, t) => s + Number(t.amount), 0),
  }));

  const catMap: Record<string, { name: string; color: string; value: number }> = {};
  for (const t of expenses) {
    if (!catMap[t.categoryId]) catMap[t.categoryId] = { name: t.category.name, color: t.category.color, value: 0 };
    catMap[t.categoryId].value += Number(t.amount);
  }
  const spendingByCategory = Object.values(catMap).sort((a, b) => b.value - a.value);

  const ownerMap: Record<string, number> = {};
  for (const t of expenses) ownerMap[t.owner] = (ownerMap[t.owner] ?? 0) + Number(t.amount);
  const ownerBreakdown = Object.entries(ownerMap)
    .map(([owner, amount]) => ({ owner, amount }))
    .filter((o) => o.amount > 0);

  const merchantMap: Record<string, number> = {};
  for (const t of expenses) merchantMap[t.description] = (merchantMap[t.description] ?? 0) + Number(t.amount);
  const topMerchants = Object.entries(merchantMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  res.json({ fixedVsVariable, monthlyFlow, spendingByCategory, ownerBreakdown, topMerchants });
});
