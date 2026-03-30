import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

// GET /tickets
ticketsRouter.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// GET /tickets/:id
ticketsRouter.get("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// PATCH /tickets/:id
ticketsRouter.patch("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// POST /tickets/:id/reply
ticketsRouter.post("/:id/reply", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// GET /tickets/:id/summary
ticketsRouter.get("/:id/summary", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// GET /tickets/:id/suggested-reply
ticketsRouter.get("/:id/suggested-reply", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
