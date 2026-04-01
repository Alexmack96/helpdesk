import "dotenv/config";
import { db } from "./client.js";
import { UserRole, TransactionType } from "../generated/prisma/index.js";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";

const CATEGORIES = [
  { name: "Salary", color: "#22c55e" },
  { name: "Housing", color: "#a855f7" },
  { name: "Food", color: "#eab308" },
  { name: "Utilities", color: "#ef4444" },
  { name: "Transport", color: "#f97316" },
  { name: "Entertainment", color: "#3b82f6" },
];

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
      emailVerified: true,
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

  const categories = await Promise.all(
    CATEGORIES.map((c) => db.category.create({ data: c })),
  );

  const byName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  await db.transaction.createMany({
    data: [
      {
        description: "Salary",
        amount: 5000,
        type: TransactionType.Income,
        date: new Date("2025-01-01"),
        categoryId: byName["Salary"],
      },
      {
        description: "Freelance Work",
        amount: 800,
        type: TransactionType.Income,
        date: new Date("2025-01-05"),
        categoryId: byName["Salary"],
      },
      {
        description: "Rent",
        amount: 1200,
        type: TransactionType.Expense,
        date: new Date("2025-01-02"),
        categoryId: byName["Housing"],
      },
      {
        description: "Groceries",
        amount: 150,
        type: TransactionType.Expense,
        date: new Date("2025-01-03"),
        categoryId: byName["Food"],
      },
      {
        description: "Dinner Out",
        amount: 65,
        type: TransactionType.Expense,
        date: new Date("2025-01-07"),
        categoryId: byName["Food"],
      },
      {
        description: "Electric Bill",
        amount: 95,
        type: TransactionType.Expense,
        date: new Date("2025-01-06"),
        categoryId: byName["Utilities"],
      },
      {
        description: "Gas",
        amount: 45,
        type: TransactionType.Expense,
        date: new Date("2025-01-08"),
        categoryId: byName["Transport"],
      },
      {
        description: "Netflix",
        amount: 15,
        type: TransactionType.Expense,
        date: new Date("2025-01-10"),
        categoryId: byName["Entertainment"],
      },
    ],
  });

  console.log("Seeded categories and transactions.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
