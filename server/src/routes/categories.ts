import { Router } from "express";
import { db } from "../db/client.js";
import { requireAdmin } from "../middleware/auth.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res) => {
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  res.json(categories);
});

categoriesRouter.post("/:fromId/merge/:toId", requireAdmin, async (req, res) => {
  const fromId = req.params.fromId as string;
  const toId   = req.params.toId   as string;

  if (fromId === toId) {
    res.status(400).json({ error: "Source and target categories must differ" });
    return;
  }

  const [from, to] = await Promise.all([
    db.category.findUnique({ where: { id: fromId } }),
    db.category.findUnique({ where: { id: toId } }),
  ]);

  if (!from) { res.status(404).json({ error: "Source category not found" }); return; }
  if (!to)   { res.status(404).json({ error: "Target category not found" }); return; }

  const { count } = await db.transaction.updateMany({
    where: { categoryId: fromId },
    data: { categoryId: toId },
  });

  await db.category.delete({ where: { id: fromId } });

  res.json({ merged: count, from: from.name, to: to.name });
});
