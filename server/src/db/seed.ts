import "dotenv/config";
import { db } from "./client.js";
import { UserRole } from "../generated/prisma/index.js";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";

async function main() {
  const existing = await db.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
  if (existing) {
    console.log("Seed already applied.");
    return;
  }

  const userId = randomUUID();
  const accountId = randomUUID();
  const hashedPassword = await hashPassword(env.ADMIN_PASSWORD);

  await db.user.create({
    data: {
      id: userId,
      email: env.ADMIN_EMAIL,
      name: "Admin",
      role: UserRole.Admin,
    },
  });

  await db.account.create({
    data: {
      id: accountId,
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashedPassword,
    },
  });

  console.log(`Seeded admin user: ${env.ADMIN_EMAIL}`);

  const categories = [
    { id: "cmnmwendl0000m0u8mrn5kvn7", name: "Activities",      color: "#ec4899", isFixed: false, isDirectDebit: false },
    { id: "cmnk28hlv0000wsu8eou7sies", name: "Bank Sauce",       color: "#0ea5e9", isFixed: false, isDirectDebit: false },
    { id: "6690838b-cb7a-4421-b71b-3df5a0bc41f1", name: "Charity & Gifts", color: "#ec4899", isFixed: false, isDirectDebit: false },
    { id: "600ac722-cafe-4c98-8191-afa5f7531a58", name: "Education",       color: "#3b82f6", isFixed: false, isDirectDebit: false },
    { id: "clam_entertainment",        name: "Entertainment",    color: "#7C3AED", isFixed: false, isDirectDebit: false },
    { id: "cmnmwendl0000m0u8mrn5kvn8", name: "Fashion",          color: "#ec4899", isFixed: false, isDirectDebit: false },
    { id: "cmnngbmae0002l4u8qf58ndvj", name: "Food & Social",    color: "#fb923c", isFixed: false, isDirectDebit: false },
    { id: "cmnk1a3gd000bq0u8vmavc6au", name: "Groceries",        color: "#22c55e", isFixed: false, isDirectDebit: false },
    { id: "cmnk1a3ea0002q0u8i2wkpook", name: "Investments",      color: "#a855f7", isFixed: true,  isDirectDebit: false },
    { id: "cmnk1z04p0002swu87ys1ctzw", name: "Personal Care",    color: "#f43f5e", isFixed: false, isDirectDebit: false },
    { id: "cmnmxaztl0006fsu8wevv9k1s", name: "Rent & Bills",     color: "#64748b", isFixed: true,  isDirectDebit: false },
    { id: "cmnptto2v00079ou8w4tuv0zw", name: "Savings",          color: "#a855f7", isFixed: true,  isDirectDebit: false },
    { id: "cmnngid9k0004fsu8l6ysy143", name: "Takeout",          color: "#ef4444", isFixed: false, isDirectDebit: false },
    { id: "cmnk1a3dp0000q0u8xo5fqcso", name: "Transport",        color: "#3b82f6", isFixed: true,  isDirectDebit: false },
    { id: "cmnk1z05a0004swu8j3pi8vb9", name: "Uncategorised",    color: "#d1d5db", isFixed: false, isDirectDebit: false },
    { id: "cmnk1z04h0001swu8nht0y8a3", name: "Vacation",         color: "#eab308", isFixed: false, isDirectDebit: false },
  ];

  for (const cat of categories) {
    await db.category.upsert({ where: { id: cat.id }, create: cat, update: cat });
  }

  console.log(`Seeded ${categories.length} categories.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
