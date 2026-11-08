import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { SocialError } from "./types.ts";
export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export function stable(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
    .join(",")}}`;
}
function key(version: string) {
  const raw = process.env[`SOCIAL_TOKEN_KEY_V${version}`];
  if (!raw || !/^\d+$/.test(version))
    throw new SocialError(
      "not_configured",
      "Social token encryption key is missing.",
      503,
    );
  const b = Buffer.from(raw, "base64");
  if (b.length !== 32 || b.toString("base64") !== raw)
    throw new SocialError(
      "not_configured",
      "Social token encryption requires a base64 32-byte key.",
      503,
    );
  return b;
}
export function seal(
  value: unknown,
  context: string,
  version = process.env.SOCIAL_TOKEN_ACTIVE_KEY || "1",
) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(version), iv);
  c.setAAD(Buffer.from(`${version}:${context}`));
  const data = Buffer.concat([
    c.update(JSON.stringify(value), "utf8"),
    c.final(),
  ]);
  return JSON.stringify({
    v: version,
    iv: iv.toString("base64"),
    data: data.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
  });
}
export function open<T>(envelope: string, context: string): T {
  try {
    const e = JSON.parse(envelope);
    const d = createDecipheriv(
      "aes-256-gcm",
      key(e.v),
      Buffer.from(e.iv, "base64"),
    );
    d.setAAD(Buffer.from(`${e.v}:${context}`));
    d.setAuthTag(Buffer.from(e.tag, "base64"));
    return JSON.parse(
      Buffer.concat([
        d.update(Buffer.from(e.data, "base64")),
        d.final(),
      ]).toString(),
    );
  } catch {
    throw new SocialError(
      "account_unavailable",
      "Stored credentials could not be opened. Reconnect the account.",
      503,
    );
  }
}
export function rotate(envelope: string, context: string) {
  return seal(open(envelope, context), context);
}
