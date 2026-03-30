import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// GET /dashboard
dashboardRouter.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});
