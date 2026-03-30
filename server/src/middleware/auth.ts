import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { AppError } from "./errorHandler.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return next(new AppError(401, "Unauthorized"));
  (req as any).betterAuthSession = session;
  next();
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return next(new AppError(401, "Unauthorized"));
  if (session.user.role !== "Admin") return next(new AppError(403, "Forbidden"));
  (req as any).betterAuthSession = session;
  next();
}
