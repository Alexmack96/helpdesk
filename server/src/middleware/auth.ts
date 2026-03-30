import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return next(new AppError(401, "Unauthorized"));
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return next(new AppError(401, "Unauthorized"));
  }
  if (req.session.userRole !== "Admin") {
    return next(new AppError(403, "Forbidden"));
  }
  next();
}
