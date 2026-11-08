import { createHash, timingSafeEqual } from "node:crypto";

export function photoConfigured() {
  return (
    /^[a-z0-9_-]+$/.test(process.env.CLOUDINARY_CLOUD_NAME || "") &&
    !!process.env.CLOUDINARY_API_KEY &&
    !!process.env.CLOUDINARY_API_SECRET
  );
}
export function photoSignature(params: Record<string, string>) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) throw new Error("Photo connection missing.");
  return createHash("sha1")
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&") + secret,
    )
    .digest("hex");
}
export function photoUrls(receipt: {
  public_id: string;
  version: number;
  signature: string;
}) {
  if (
    !photoConfigured() ||
    !/^larkovart\/[a-f0-9-]{36}$/.test(receipt.public_id) ||
    !Number.isSafeInteger(receipt.version) ||
    receipt.version < 1 ||
    !/^[a-f0-9]{40}$/.test(receipt.signature)
  )
    throw new Error("Invalid photo receipt.");
  const expected = photoSignature({
    public_id: receipt.public_id,
    version: String(receipt.version),
  });
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(receipt.signature)))
    throw new Error("Invalid photo signature.");
  const base = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
  const asset = `v${receipt.version}/${receipt.public_id}`;
  return {
    originalImage: base + asset,
    image: base + asset,
  };
}
export function isPhotoUrl(value: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !/^[a-z0-9_-]+$/.test(cloud)) return false;
  const base = `https://res.cloudinary.com/${cloud}/image/upload/`;
  if (!value.startsWith(base)) return false;
  return /^(?:e_enhance\/c_limit,w_2400\/f_jpg,q_90\/)?v\d+\/larkovart\/[a-f0-9-]{36}(?:\.jpg)?$/.test(
    value.slice(base.length),
  );
}
