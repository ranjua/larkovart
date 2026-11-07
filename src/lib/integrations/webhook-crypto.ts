import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
const key = (secret: string) =>
  createHash("sha256")
    .update("larkovart/recurrente/webhook/" + secret)
    .digest();
export function sealWebhookSecret(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}
export function openWebhookSecret(value: string, secret: string) {
  const j = JSON.parse(value);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    Buffer.from(j.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(j.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(j.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
