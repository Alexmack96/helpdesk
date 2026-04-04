import { Router } from "express";
import { db } from "../db/client.js";

export const adminRouter = Router();

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
