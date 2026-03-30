import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

// Users
adminRouter.get("/users", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.post("/users", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.patch("/users/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// Canned responses
adminRouter.get("/canned-responses", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.post("/canned-responses", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.patch("/canned-responses/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.delete("/canned-responses/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

// Knowledge base
adminRouter.get("/knowledge-base", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.post("/knowledge-base", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.patch("/knowledge-base/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

adminRouter.delete("/knowledge-base/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
