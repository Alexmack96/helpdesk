import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/client.js";
import { AppError } from "../middleware/errorHandler.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "Invalid credentials");
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

authRouter.get("/me", async (req, res, next) => {
  try {
    if (!req.session.userId) throw new AppError(401, "Unauthorized");
    const user = await db.user.findUnique({ where: { id: req.session.userId } });
    if (!user) throw new AppError(401, "Unauthorized");
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    next(err);
  }
});
