import { db } from "./client.js";
import { env } from "../config/env.js";

if (env.NODE_ENV !== "test") {
  throw new Error("truncate only allowed in test environment");
}

await db.$executeRawUnsafe(`DELETE FROM "Transaction"`);
await db.$executeRawUnsafe(`DELETE FROM "Category"`);
await db.$executeRawUnsafe(`DELETE FROM session`);
await db.$executeRawUnsafe(`DELETE FROM account`);
await db.$executeRawUnsafe(`DELETE FROM verification`);
await db.$executeRawUnsafe(`DELETE FROM "user"`);
console.log("Test DB truncated.");
await db.$disconnect();
