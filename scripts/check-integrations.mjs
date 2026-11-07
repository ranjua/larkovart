// Presence and safe-environment checks only. Never print secret values or make
// provider calls. Actual account tests require explicitly configured sandboxes.
const status = (key) => (process.env[key] ? "configured" : "MISSING");
for (const key of [
  "DATABASE_URL",
  "DATABASE_ENVIRONMENT",
  "STUDIO_PASSWORD",
  "APP_URL",
  "RECURRENTE_SECRET_KEY",
  "RECURRENTE_SANDBOX_ID",
  "RECURRENTE_WEBHOOK_SECRET",
  "DHL_TEST_USERNAME",
  "DHL_TEST_PASSWORD",
  "DHL_TEST_ACCOUNT",
  "DHL_TEST_SHIPPER_JSON",
  "CRON_SECRET",
])
  console.log(`${key}: ${status(key)}`);
let failed = false;
if (
  process.env.RECURRENTE_SECRET_KEY &&
  !process.env.RECURRENTE_SECRET_KEY.startsWith("sk_test_")
) {
  console.error("Rejected: Recurrente requires an isolated sandbox TEST key.");
  failed = true;
}
if (
  process.env.PAYMENT_PROVIDER === "recurrente" &&
  process.env.PAYMENT_ENVIRONMENT !== "sandbox"
) {
  console.error("Rejected: payment environment must be sandbox.");
  failed = true;
}
if (
  process.env.DHL_TEST_USERNAME &&
  process.env.DHL_ENVIRONMENT !== "sandbox"
) {
  console.error("Rejected: courier environment must be sandbox.");
  failed = true;
}
if (
  process.env.DATABASE_URL &&
  process.env.DATABASE_ENVIRONMENT !== "development"
) {
  console.error("Rejected: database environment must be development.");
  failed = true;
}
process.exitCode = failed ? 1 : 0;
