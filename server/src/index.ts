import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import { adminRouter, initSystemCategories, migrateLegacyCategories, migrateOwners } from "./routes/admin.js";
import { categoriesRouter } from "./routes/categories.js";
import { transactionsRouter } from "./routes/transactions.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();

const trustedOrigins = env.TRUSTED_ORIGINS.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: trustedOrigins,
    credentials: true,
  })
);

app.use(helmet());

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

if (env.NODE_ENV === "production") {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post("/api/auth/sign-in/*path", authLimiter);
}
app.all("/api/auth/*path", toNodeHandler(auth));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/me", requireAuth, (req, res) => {
  const { id, email, name, role } = req.user!;
  res.json({ user: { id, email, name, role } });
});

app.use("/api/admin", requireAuth, requireAdmin, adminRouter);
app.use("/api/categories", requireAuth, categoriesRouter);
app.use("/api/transactions", requireAuth, transactionsRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);

app.use(errorHandler);

app.listen(env.PORT, async () => {
  console.log(`Backend running on port ${env.PORT}`);
  await initSystemCategories();
  await migrateLegacyCategories();
  await migrateOwners();
});
