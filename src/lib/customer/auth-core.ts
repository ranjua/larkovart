import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";
import { getMigrations } from "better-auth/db/migration";
import { Kysely } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import type { Client } from "@libsql/client";
import type { CustomerMailer } from "./mail.ts";
export type AuthConfig = {
  secret: string;
  baseURL: string;
  environment: string;
  google?: { clientId: string; clientSecret: string };
  emailReady: boolean;
  trustedOrigins?: string[];
};
export function createCustomerAuth(
  client: Client,
  config: AuthConfig,
  send: CustomerMailer,
) {
  if (config.secret.length < 32)
    throw new Error("Dedicated customer auth secret required");
  const kysely = new Kysely({
    dialect: new LibsqlDialect({
      // The dialect uses execute/transaction; its older sync() type is unused.
      client:
        client as unknown as import("@libsql/kysely-libsql").libsql.Client,
    }),
  });
  const auth = betterAuth({
    appName: "Larkova Art",
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: "/api/auth",
    trustedOrigins: [config.baseURL, ...(config.trustedOrigins || [])],
    database: { db: kysely, type: "sqlite", transaction: true },
    user: { modelName: "customer_user", deleteUser: { enabled: true } },
    session: {
      modelName: "customer_session",
      expiresIn: 7 * 86400,
      updateAge: 86400,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "customer_account",
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
      accountLinking: { enabled: true, disableImplicitLinking: true },
    },
    verification: { modelName: "customer_verification" },
    emailAndPassword: {
      enabled: config.emailReady,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
    },
    socialProviders: config.google ? { google: config.google } : {},
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "customer_auth_rate",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 60, max: 5 },
        "/two-factor/send-otp": { window: 60, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "larkova_customer",
      useSecureCookies: config.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      database: { validateSchema: false },
    },
    logger: { disabled: true },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: "hashed",
        disableSignUp: true,
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: async ({ email, otp, type }) =>
          send({ email, code: otp, purpose: type }),
      }),
      twoFactor({
        twoFactorTable: "customer_two_factor",
        otpOptions: {
          digits: 6,
          period: 5,
          allowedAttempts: 5,
          storeOTP: "hashed",
          sendOTP: async ({ user, otp }) =>
            send({
              email: user.email,
              code: otp,
              purpose: "Extra login verification",
            }),
        },
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 5,
          durationSeconds: 900,
        },
      }),
    ],
  });
  let migration: Promise<void> | undefined;
  async function ready() {
    if (!migration)
      migration = (async () => {
        const plan = await getMigrations(auth.options);
        const text = await plan.compileMigrations();
        const statements = text
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            if (
              !/^(create (?:unique )?(?:table|index)|alter table)\s+"?customer_/i.test(
                s,
              )
            )
              throw new Error("Unexpected auth schema mutation");
            return s
              .replace(/^create table /i, "create table if not exists ")
              .replace(/^create index /i, "create index if not exists ")
              .replace(
                /^create unique index /i,
                "create unique index if not exists ",
              );
          });
        await client.batch(
          [
            ...statements,
            "CREATE TABLE IF NOT EXISTS customer_email_limits(id TEXT PRIMARY KEY,count INTEGER NOT NULL,started_at INTEGER NOT NULL)",
            "CREATE TABLE IF NOT EXISTS customer_saved(user_id TEXT NOT NULL,artwork_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('favorite','cart')),created_at TEXT NOT NULL,PRIMARY KEY(user_id,artwork_id,kind),FOREIGN KEY(user_id) REFERENCES customer_user(id) ON DELETE CASCADE)",
          ],
          "write",
        );
        const check = await getMigrations(auth.options);
        if (
          check.toBeCreated.length ||
          check.toBeAdded.length ||
          check.schemaProblems.length
        )
          throw new Error("Customer schema needs review");
      })().catch((e) => {
        migration = undefined;
        throw e;
      });
    await migration;
  }
  return { auth, ready, kysely };
}
