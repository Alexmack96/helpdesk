import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { TransactionType } from "../generated/prisma/index.js";

export const transactionsRouter = Router();

const createSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.nativeEnum(TransactionType),
  categoryId: z.string().min(1),
  date: z.string().optional(),
});

transactionsRouter.get("/", async (req, res, next) => {
  try {
    const { type, categoryId } = req.query;
    const transactions = await db.transaction.findMany({
      where: {
        ...(type ? { type: type as TransactionType } : {}),
        ...(categoryId ? { categoryId: categoryId as string } : {}),
      },
      include: { category: true },
      orderBy: { date: "desc" },
    });
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const transaction = await db.transaction.create({
      data: {
        description: body.description,
        amount: body.amount,
        type: body.type,
        categoryId: body.categoryId,
        ...(body.date ? { date: new Date(body.date) } : {}),
      },
      include: { category: true },
    });
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.delete("/:id", async (req, res, next) => {
  try {
    await db.transaction.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
