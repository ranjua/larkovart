import { customerEmailDeliveryConfig } from "./email-delivery.ts";
export function customerConfig() {
  const environment =
    process.env.VERCEL_ENV || process.env.CUSTOMER_ENVIRONMENT || "development";
  if (
    process.env.CUSTOMER_ENVIRONMENT &&
    process.env.CUSTOMER_ENVIRONMENT !== environment
  )
    throw new Error("Customer environment mismatch");
  const secret = process.env.CUSTOMER_AUTH_SECRET || "";
  const origin = process.env.CUSTOMER_AUTH_ORIGIN || "";
  let baseURL = "";
  if (origin) {
    const u = new URL(origin);
    if (
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      (u.protocol !== "https:" &&
        !(
          environment === "development" &&
          ["localhost", "127.0.0.1"].includes(u.hostname) &&
          u.protocol === "http:"
        ))
    )
      throw new Error("Invalid customer origin");
    baseURL = u.origin;
  }
  const delivery = customerEmailDeliveryConfig();
  const emailFrom = delivery.from;
  const ready = secret.length >= 32 && !!baseURL;
  return {
    environment,
    secret,
    baseURL,
    ready,
    emailFrom,
    emailReady: ready && delivery.ready,
    googleReady:
      ready &&
      !!process.env.CUSTOMER_GOOGLE_CLIENT_ID &&
      !!process.env.CUSTOMER_GOOGLE_CLIENT_SECRET,
  };
}
