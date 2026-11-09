import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { db as guardedDb } from "../store.ts";
import { customerConfig } from "./config.ts";
import { createCustomerAuth } from "./auth-core.ts";
import { customerMailer } from "./mail.ts";
let instance:
  (ReturnType<typeof createCustomerAuth> & { client: Client }) | undefined;
export function customerServer() {
  if (instance) return instance;
  const c = customerConfig();
  if (!c.ready) throw new Error("Customer authentication is not configured");
  const explicit = process.env.CUSTOMER_DATABASE_URL;
  let url = explicit,
    token = process.env.CUSTOMER_DATABASE_AUTH_TOKEN;
  if (
    c.environment === "production" &&
    (!url || process.env.CUSTOMER_DATABASE_ENVIRONMENT !== "production")
  )
    throw new Error("Isolated production customer storage required");
  if (
    explicit &&
    process.env.CUSTOMER_DATABASE_ENVIRONMENT !== c.environment &&
    !(
      c.environment === "preview" &&
      process.env.CUSTOMER_DATABASE_ENVIRONMENT === "development"
    )
  )
    throw new Error("Customer database environment mismatch");
  if (!url) {
    guardedDb();
    const source = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
    if (source && !source.startsWith("file:")) {
      url = source;
      token = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
    } else {
      mkdirSync(".data", { recursive: true });
      url = source ? source + ".customers" : "file:.data/customers.db";
    }
  }
  const client = createClient({ url, authToken: token, concurrency: 1 });
  const trustedOrigins = process.env.VERCEL_URL
    ? [`https://${process.env.VERCEL_URL}`]
    : [];
  instance = {
    ...createCustomerAuth(
      client,
      {
        ...c,
        trustedOrigins,
        google: c.googleReady
          ? {
              clientId: process.env.CUSTOMER_GOOGLE_CLIENT_ID!,
              clientSecret: process.env.CUSTOMER_GOOGLE_CLIENT_SECRET!,
            }
          : undefined,
      },
      customerMailer(c.emailFrom),
    ),
    client,
  };
  return instance;
}
export async function customerSession(headers: Headers) {
  if (!customerConfig().ready) return null;
  const s = customerServer();
  await s.ready();
  return s.auth.api.getSession({ headers });
}
