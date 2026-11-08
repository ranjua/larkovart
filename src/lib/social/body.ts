import { SocialError } from "./types.ts";
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new SocialError(
      "request_too_large",
      "Request exceeds the allowed size.",
      413,
    );
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  let count = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      count += r.value.byteLength;
      if (count > limit)
        throw new SocialError(
          "request_too_large",
          "Request exceeds the allowed size.",
          413,
        );
      chunks.push(r.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
