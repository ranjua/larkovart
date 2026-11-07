import { readFileSync, writeFileSync, renameSync, chmodSync } from "node:fs";
const key = process.env.RECURRENTE_SECRET_KEY || "";
const sandbox = process.env.RECURRENTE_SANDBOX_ID || "";
async function main() {
  if (!key.startsWith("sk_test_") || !sandbox.startsWith("sbx_"))
    throw new Error(
      "Configure an isolated Recurrente Sandbox TEST key and sandbox ID first.",
    );
  if (process.env.RECURRENTE_WEBHOOK_SECRET)
    throw new Error(
      "A webhook secret is already configured. No endpoint was created.",
    );
  const app = new URL(process.env.APP_URL || "");
  if (
    app.protocol !== "https:" ||
    !app.hostname.endsWith(".vercel.app") ||
    process.env.VERCEL_ENV === "production"
  )
    throw new Error(
      "APP_URL must be the HTTPS Vercel development preview, never a production deployment.",
    );
  const headers = { "X-SECRET-KEY": key, "Content-Type": "application/json" };
  const check = await fetch("https://app.recurrente.com/api/test", {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!check.ok) throw new Error("Sandbox authentication failed.");
  const env = await check.json();
  if (env.environment !== "sandbox" || env.sandbox_id !== sandbox)
    throw new Error("Sandbox environment mismatch. No webhook was created.");
  // Confirm the local private configuration is writable before remote creation.
  const current = readFileSync(".env.local", "utf8");
  const response = await fetch(
    "https://app.recurrente.com/api/webhook_endpoints",
    {
      method: "POST",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        url: new URL("/api/webhooks/recurrente", app).href,
        description: "Larkova Art development sandbox",
      }),
    },
  );
  if (!response.ok) throw new Error("Sandbox webhook registration failed.");
  const endpoint = await response.json();
  if (
    typeof endpoint.signingSecret !== "string" ||
    !endpoint.signingSecret.startsWith("whsec_")
  )
    throw new Error(
      "No signing secret returned. Inspect the endpoint in the Sandbox dashboard before retrying.",
    );
  const without = current.replace(/^RECURRENTE_WEBHOOK_SECRET=.*\n?/m, "");
  writeFileSync(
    ".env.local.webhook-tmp",
    without.trimEnd() +
      "\nRECURRENTE_WEBHOOK_SECRET=" +
      JSON.stringify(endpoint.signingSecret) +
      "\n",
    { mode: 0o600 },
  );
  renameSync(".env.local.webhook-tmp", ".env.local");
  chmodSync(".env.local", 0o600);
  console.log(
    "Registered the SANDBOX webhook. Its secret was saved privately in .env.local and was not printed. Configure the same secret in the Vercel Preview environment.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Sandbox webhook registration failed.",
  );
  process.exitCode = 1;
});
