import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Backend running on port ${env.PORT}`);
});
