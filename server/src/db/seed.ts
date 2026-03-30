import { db } from "./client.js";
import bcrypt from "bcryptjs";

async function main() {
  const existing = await db.user.findUnique({ where: { email: "admin@example.com" } });
  if (existing) {
    console.log("Seed already applied.");
    return;
  }

  await db.user.create({
    data: {
      email: "admin@example.com",
      name: "Admin",
      passwordHash: await bcrypt.hash("changeme", 12),
      role: "Admin",
    },
  });

  console.log("Seeded admin user: admin@example.com / changeme");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
