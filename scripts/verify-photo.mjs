// Safe deployment check: one reusable test asset, never added to the art catalog.
import { readFile } from "node:fs/promises";
import { photoConfigured, photoSignature } from "../src/lib/photo.ts";
const keys = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
if (!keys.some((key) => process.env[key])) {
  console.log("Photo storage: not configured.");
  process.exit(0);
}
if (!photoConfigured()) {
  console.error("Photo storage: incomplete credentials or invalid cloud name.");
  process.exit(1);
}
try {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const publicId = "larkovart-connection-check";
  const api = `https://api.cloudinary.com/v1_1/${cloud}`;
  const existing = await fetch(`${api}/resources/image/upload/${publicId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!existing.ok && existing.status !== 404)
    throw new Error(`account verification returned HTTP ${existing.status}`);
  if (existing.status === 404) {
    const params = {
      public_id: publicId,
      overwrite: "false",
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const form = new FormData();
    Object.entries(params).forEach(([key, value]) => form.set(key, value));
    form.set("signature", photoSignature(params));
    form.set("api_key", process.env.CLOUDINARY_API_KEY);
    const original = await readFile(
      new URL("../public/artworks/Atitlan.jpg", import.meta.url),
    );
    form.set(
      "file",
      new Blob([original], { type: "image/jpeg" }),
      "connection-check.jpg",
    );
    const result = await fetch(`${api}/image/upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(120000),
      redirect: "error",
    });
    if (!result.ok)
      throw new Error(`test upload returned HTTP ${result.status}`);
    const asset = await result.json();
    if (!asset.secure_url) throw new Error("original test photo not ready");
  }
  const processed = await fetch(
    `https://res.cloudinary.com/${cloud}/image/upload/${publicId}.jpg`,
    { method: "HEAD", signal: AbortSignal.timeout(30000), redirect: "error" },
  );
  if (
    !processed.ok ||
    !processed.headers.get("content-type")?.startsWith("image/")
  )
    throw new Error(`original photo returned HTTP ${processed.status}`);
  console.log(
    "Photo storage: account authenticated; original photo storage verified. Catalog unchanged.",
  );
} catch (error) {
  // Only our fixed messages/status codes are emitted; never provider bodies or credentials.
  console.error(
    `Photo storage: ${error instanceof Error && !error.message.includes("fetch") ? error.message : "connection failed"}.`,
  );
  process.exitCode = 1;
}
