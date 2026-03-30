import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "../db/client.js";
import { UserRole } from "../generated/prisma/index.js";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: ["http://localhost:5173"],
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: UserRole.Agent, input: false },
    },
  },
});
