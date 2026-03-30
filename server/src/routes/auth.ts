import { Router } from "express";

export const authRouter = Router();

// POST /auth/login
authRouter.post("/login", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// POST /auth/logout
authRouter.post("/logout", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// GET /auth/me
authRouter.get("/me", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
