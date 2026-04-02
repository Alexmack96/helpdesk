import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";

const serverDir = resolve(process.cwd(), "server");

function loadEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return result;
}

const testEnv = loadEnvFile(resolve(serverDir, ".env.test"));
const env = { ...process.env, ...testEnv };

export default async function globalSetup() {
  console.log("Running migrations on test DB...");
  execSync("bunx prisma migrate deploy", { cwd: serverDir, env, stdio: "inherit" });

  console.log("Seeding test DB...");
  execSync("bun src/db/seed.ts", { cwd: serverDir, env, stdio: "inherit" });
}
