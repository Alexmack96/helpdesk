import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { UserRole } from "../generated/prisma/index.js";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = session.user;
  req.session = session.session;
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  if (!req.user || !req.session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== UserRole.Admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
};
