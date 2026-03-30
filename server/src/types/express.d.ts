import type { auth } from "../lib/auth.js";

type BetterAuthSession = typeof auth.$Infer.Session;

declare global {
  namespace Express {
    interface Request {
      user?: BetterAuthSession["user"];
      session?: BetterAuthSession["session"];
    }
  }
}
