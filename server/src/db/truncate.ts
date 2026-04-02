import { db } from "./client.js";
import { env } from "../config/env.js";

if (env.NODE_ENV !== "test") {
  throw new Error("truncate only allowed in test environment");
}

await db.$executeRawUnsafe(
  `TRUNCATE "Transaction", "Category", account, session, verification, "user" CASCADE`,
);
console.log("Test DB truncated.");
await db.$disconnect();
