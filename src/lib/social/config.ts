import { SocialError, platforms, type Platform } from "./types.ts";
const flag = (name: string, fallback = false) => {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  if (v !== "true" && v !== "false")
    throw new SocialError(
      "not_configured",
      `${name} must be true or false.`,
      503,
    );
  return v === "true";
};
function origin(name: string) {
  const v = process.env[name];
  if (!v) return null;
  try {
    const u = new URL(v);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)
    )
      throw 0;
    return u.origin;
  } catch {
    throw new SocialError(
      "not_configured",
      `${name} must be an HTTPS origin.`,
      503,
    );
  }
}
export function socialConfig() {
  const environment =
    process.env.SOCIAL_ENVIRONMENT || process.env.VERCEL_ENV || "development";
  if (!["development", "preview", "production"].includes(environment))
    throw new SocialError("not_configured", "Invalid social environment.", 503);
  if (process.env.VERCEL_ENV && environment !== process.env.VERCEL_ENV)
    throw new SocialError(
      "not_configured",
      "Social environment does not match this deployment.",
      503,
    );
  const mode = process.env.SOCIAL_WORKER_MODE || "manual";
  if (!["manual", "local", "hosted"].includes(mode))
    throw new SocialError("not_configured", "Unknown social worker mode.", 503);
  const version = process.env.SOCIAL_META_GRAPH_VERSION || "v25.0";
  if (version && !/^v\d+\.0$/.test(version))
    throw new SocialError(
      "not_configured",
      "Meta API version must be pinned as vNN.0.",
      503,
    );
  return {
    enabled: flag("SOCIAL_ENABLED", true),
    environment,
    mode: mode as "manual" | "local" | "hosted",
    publishEnabled:
      flag("SOCIAL_PUBLISH_ENABLED") && environment === "production",
    testWrites:
      flag("SOCIAL_TEST_WRITES_ENABLED") && environment !== "production",
    hostedVerified: flag("SOCIAL_HOSTED_SCHEDULER_VERIFIED"),
    origin: origin("SOCIAL_ORIGIN"),
    publicStore: flag("SOCIAL_PUBLIC_STORE_VERIFIED")
      ? origin("SOCIAL_STORE_ORIGIN")
      : null,
    version,
    timezone: "America/Guatemala",
    activeKey: process.env.SOCIAL_TOKEN_ACTIVE_KEY || "1",
  };
}
export function providerConfig(provider: Platform) {
  const prefix = `SOCIAL_${provider.toUpperCase()}`;
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`] || null,
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] || null,
  };
}
export function redactedConfig() {
  const c = socialConfig();
  return {
    ...c,
    origin: c.origin,
    providers: Object.fromEntries(
      platforms.map((p) => [
        p,
        {
          configured:
            !!providerConfig(p).clientId &&
            !!providerConfig(p).clientSecret &&
            !!c.origin &&
            !!process.env[`SOCIAL_TOKEN_KEY_V${c.activeKey}`],
          manual: true,
        },
      ]),
    ),
  };
}
