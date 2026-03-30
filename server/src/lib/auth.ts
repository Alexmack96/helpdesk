import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "../db/client.js";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "Agent" },
    },
  },
});
