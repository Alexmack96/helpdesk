import "dotenv/config";
import { db } from "./client.js";
import { auth } from "../lib/auth.js";

async function main() {
  const existing = await db.user.findUnique({ where: { email: "admin@example.com" } });
  if (existing) {
    console.log("Seed already applied.");
    return;
  }

  const { user } = await auth.api.signUpEmail({
    body: { email: "admin@example.com", name: "Admin", password: "changeme" },
  });

  await db.user.update({ where: { id: user.id }, data: { role: "Admin" } });

  console.log("Seeded admin user: admin@example.com / changeme");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
