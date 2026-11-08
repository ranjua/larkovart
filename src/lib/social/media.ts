import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { artworkPhoto } from "../catalog.ts";
import { photoSignature, photoConfigured, isPhotoUrl } from "../photo.ts";
import { hash } from "./crypto.ts";
import { SocialError, type Asset } from "./types.ts";
import type { SocialRepository } from "./repository.ts";
import type { InventoryReader } from "./inventory.ts";
export function imageMetadata(b: Buffer): {
  mime: string;
  width: number;
  height: number;
} {
  if (
    b.length > 24 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return {
      mime: "image/png",
      width: b.readUInt32BE(16),
      height: b.readUInt32BE(20),
    };
  if (b.length > 4 && b[0] === 255 && b[1] === 216) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 255) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m === 0xd9 || m === 0xda) break;
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      const length = b.readUInt16BE(i + 2);
      if (length < 2) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(m)
      )
        return {
          mime: "image/jpeg",
          height: b.readUInt16BE(i + 5),
          width: b.readUInt16BE(i + 7),
        };
      i += length + 2;
    }
  }
  if (
    b.length >= 30 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  ) {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X")
      return {
        mime: "image/webp",
        width: 1 + b.readUIntLE(24, 3),
        height: 1 + b.readUIntLE(27, 3),
      };
    if (kind === "VP8 ")
      return {
        mime: "image/webp",
        width: b.readUInt16LE(26) & 0x3fff,
        height: b.readUInt16LE(28) & 0x3fff,
      };
    if (kind === "VP8L" && b[20] === 0x2f)
      return {
        mime: "image/webp",
        width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
        height: 1 + (((b[24] & 15) << 10) | (b[23] << 2) | (b[22] >> 6)),
      };
  }
  throw new SocialError(
    "media_invalid",
    "Use a valid JPEG, PNG or WebP image.",
    422,
  );
}
export function trustedMediaUrl(value: string) {
  if (!isPhotoUrl(value) && !isSocialCloudUrl(value))
    throw new SocialError(
      "media_invalid",
      "Only this studio’s verified original media may be fetched.",
      422,
    );
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw new SocialError("media_invalid", "Unsafe media URL.", 422);
  return u;
}
function isSocialCloudUrl(value: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !/^[a-z0-9_-]+$/.test(cloud)) return false;
  const prefix = `https://res.cloudinary.com/${cloud}/`;
  return (
    value.startsWith(prefix) &&
    /^(image|video)\/upload\/v\d+\/social-assets\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|mp4|mov)$/.test(
      value.slice(prefix.length),
    )
  );
}
export async function boundedMedia(
  value: string,
  fetcher: typeof fetch = fetch,
  max = 25 * 1024 * 1024,
) {
  trustedMediaUrl(value);
  const r = await fetcher(value, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
    cache: "no-store",
  });
  if (!r.ok || !r.body)
    throw new SocialError(
      "media_invalid",
      "The original media cannot be downloaded.",
      422,
    );
  const length = Number(r.headers.get("content-length") || 0);
  if (length > max)
    throw new SocialError(
      "media_invalid",
      "Media exceeds the 25 MB limit.",
      422,
    );
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const reader = r.body.getReader();
  try {
    for (;;) {
      const p = await reader.read();
      if (p.done) break;
      bytes += p.value.length;
      if (bytes > max)
        throw new SocialError(
          "media_invalid",
          "Media exceeds the size limit.",
          422,
        );
      chunks.push(p.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
export async function assetBytes(asset: Asset, fetcher: typeof fetch = fetch) {
  let b: Buffer;
  if (/^\/artworks\/[\w-]+\.(jpg|jpeg|png|webp)$/.test(asset.url))
    b = await readFile(join(process.cwd(), "public", asset.url));
  else if (
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(asset.url)
  )
    b = Buffer.from(asset.url.split(",")[1], "base64");
  else b = await boundedMedia(asset.url, fetcher);
  if (hash(b) !== asset.sha256)
    throw new SocialError(
      "media_invalid",
      "Media changed since verification. Select it again.",
      409,
    );
  return b;
}
export async function importArtwork(
  repo: SocialRepository,
  artworkId: string,
  inventory: InventoryReader,
  fetcher: typeof fetch = fetch,
) {
  const a = await inventory(artworkId);
  if (!a)
    throw new SocialError(
      "artwork_unavailable",
      "Artwork not found in authoritative inventory.",
      422,
    );
  const source = artworkPhoto(a);
  let b: Buffer,
    apiReady = false;
  if (/^\/artworks\/[\w-]+\.(jpg|jpeg|png|webp)$/.test(source))
    b = await readFile(join(process.cwd(), "public", source));
  else if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(source))
    b = Buffer.from(source.split(",")[1], "base64");
  else {
    b = await boundedMedia(source, fetcher, 10 * 1024 * 1024);
    apiReady = true;
  }
  if (b.length > 10 * 1024 * 1024)
    throw new SocialError("media_invalid", "Artwork photo exceeds 10 MB.", 422);
  const metadata = imageMetadata(b);
  if (!metadata.width || !metadata.height)
    throw new SocialError("media_invalid", "Invalid image dimensions.", 422);
  return repo.addAsset({
    id: randomUUID(),
    kind: "image",
    url: source,
    storageKey: `artwork:${a.id}:${hash(source)}`,
    sha256: hash(b),
    bytes: b.length,
    ...metadata,
    durationMs: null,
    apiReady,
    verifiedAt: new Date().toISOString(),
    artworkId: a.id,
  });
}
export async function signSocialUpload(
  repo: SocialRepository,
  kind: "image" | "video",
) {
  if (!photoConfigured())
    throw new SocialError(
      "not_configured",
      "Connect Cloudinary to upload source media.",
      503,
    );
  await repo.init();
  const recent = await repo.client.execute({
    sql: "SELECT COUNT(*) AS n FROM social_assets WHERE created_at>?",
    args: [new Date(Date.now() - 60000).toISOString()],
  });
  if (Number(recent.rows[0].n) > 10)
    throw new SocialError(
      "rate_limited",
      "Please wait before uploading more media.",
      429,
    );
  const id = randomUUID(),
    publicId = `social-assets/${id}`;
  await repo.client.execute({
    sql: "INSERT INTO social_assets VALUES (?,?,'pending','pending',?,?)",
    args: [id, publicId, JSON.stringify({ kind }), new Date().toISOString()],
  });
  const params = {
    timestamp: String(Math.floor(Date.now() / 1000)),
    public_id: publicId,
    overwrite: "false",
    allowed_formats: kind === "image" ? "jpg,jpeg,png,webp" : "mp4,mov",
  };
  return {
    assetId: id,
    cloud: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    resourceType: kind,
    params,
    signature: photoSignature(params),
    maxBytes: kind === "image" ? 10 * 1024 * 1024 : 25 * 1024 * 1024,
  };
}
export async function completeSocialUpload(
  repo: SocialRepository,
  receipt: {
    assetId: string;
    public_id: string;
    version: number;
    signature: string;
  },
  fetcher: typeof fetch = fetch,
) {
  await repo.init();
  const row = await repo.client.execute({
    sql: "SELECT * FROM social_assets WHERE id=?",
    args: [receipt.assetId],
  });
  const pending = row.rows[0];
  if (
    !pending ||
    pending.storage_key !== receipt.public_id ||
    receipt.public_id !== `social-assets/${receipt.assetId}`
  )
    throw new SocialError(
      "media_invalid",
      "Upload does not belong to this studio request.",
      422,
    );
  if (Date.parse(String(pending.created_at)) < Date.now() - 3600000)
    throw new SocialError(
      "media_invalid",
      "Upload request expired. Start a new upload.",
      422,
    );
  const expected = photoSignature({
    public_id: receipt.public_id,
    version: String(receipt.version),
  });
  if (
    !/^[a-f0-9]{40}$/.test(receipt.signature) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(receipt.signature))
  )
    throw new SocialError("media_invalid", "Upload signature is invalid.", 422);
  if (pending.verification_state === "verified")
    return repo.getAsset(receipt.assetId);
  const kind = JSON.parse(String(pending.data)).kind;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!photoConfigured() || !["image", "video"].includes(kind))
    throw new SocialError(
      "not_configured",
      "Media storage is unavailable.",
      503,
    );
  const response = await fetcher(
    `https://api.cloudinary.com/v1_1/${cloud}/resources/${kind}/upload/${encodeURIComponent(receipt.public_id)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64")}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new SocialError(
      "media_invalid",
      "Storage metadata could not be verified.",
      422,
    );
  const meta = await response.json();
  if (
    meta.public_id !== receipt.public_id ||
    meta.version !== receipt.version ||
    !Number.isInteger(meta.width) ||
    !Number.isInteger(meta.height) ||
    meta.width < 1 ||
    meta.height < 1 ||
    !Number.isInteger(meta.bytes) ||
    meta.bytes > 25 * 1024 * 1024 ||
    !["jpg", "jpeg", "png", "webp", "mp4", "mov"].includes(meta.format)
  )
    throw new SocialError("media_invalid", "Invalid storage metadata.", 422);
  const url = `https://res.cloudinary.com/${cloud}/${kind}/upload/v${receipt.version}/${receipt.public_id}.${meta.format}`;
  const b = await boundedMedia(
    url,
    fetcher,
    kind === "image" ? 10 * 1024 * 1024 : 25 * 1024 * 1024,
  );
  let dimensions =
    kind === "image"
      ? imageMetadata(b)
      : {
          mime: meta.format === "mp4" ? "video/mp4" : "video/quicktime",
          width: meta.width,
          height: meta.height,
        };
  if (
    kind === "video" &&
    (b.length < 12 ||
      b.toString("ascii", 4, 8) !== "ftyp" ||
      typeof meta.duration !== "number" ||
      meta.duration <= 0)
  )
    throw new SocialError(
      "media_invalid",
      "Video metadata could not be verified.",
      422,
    );
  if (
    dimensions.width !== meta.width ||
    dimensions.height !== meta.height ||
    b.length !== meta.bytes
  )
    throw new SocialError(
      "media_invalid",
      "Upload bytes do not match storage metadata.",
      422,
    );
  const a: Asset = {
    id: receipt.assetId,
    kind,
    url,
    storageKey: receipt.public_id,
    sha256: hash(b),
    bytes: b.length,
    ...dimensions,
    durationMs: kind === "video" ? Math.round(meta.duration * 1000) : null,
    framesPerSecond:
      kind === "video" && typeof meta.frame_rate === "number"
        ? meta.frame_rate
        : null,
    apiReady:
      kind === "image" ||
      (meta.video?.codec === "h264" &&
        (!meta.audio || meta.audio.codec === "aac")),
    verifiedAt: new Date().toISOString(),
    artworkId: null,
  };
  await repo.client.execute({
    sql: "UPDATE social_assets SET sha256=?,verification_state='verified',data=? WHERE id=? AND verification_state='pending'",
    args: [a.sha256, JSON.stringify(a), a.id],
  });
  return repo.getAsset(a.id);
}
