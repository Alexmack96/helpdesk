import { chromium, request } from "@playwright/test";
import { execSync } from "child_process";
import { mkdirSync, readFileSync } from "fs";
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

  console.log("Saving auth state...");
  const browser = await chromium.launch();
  const context = await browser.newContext();

  const response = await context.request.post(
    `${testEnv.BETTER_AUTH_URL}/api/auth/sign-in/email`,
    {
      data: { email: testEnv.ADMIN_EMAIL, password: testEnv.ADMIN_PASSWORD },
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok()) {
    throw new Error(`Login failed during global setup: ${response.status()} ${await response.text()}`);
  }

  mkdirSync(resolve(process.cwd(), "e2e/.auth"), { recursive: true });
  await context.storageState({ path: resolve(process.cwd(), "e2e/.auth/user.json") });
  await browser.close();
}
