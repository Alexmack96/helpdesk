import { Router } from "express";

export const webhooksRouter = Router();

// POST /webhooks/email/inbound
webhooksRouter.post("/email/inbound", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
