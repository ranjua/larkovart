import { randomUUID } from "node:crypto";
import { session, sameOrigin } from "@/lib/auth";
import { photoConfigured, photoSignature } from "@/lib/photo";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  if (!photoConfigured())
    return Response.json(
      { error: "Connect Cloudinary in Vercel to store original photos." },
      { status: 503 },
    );
  const params = {
    timestamp: String(Math.floor(Date.now() / 1000)),
    public_id: `larkovart/${randomUUID()}`,
    overwrite: "false",
    allowed_formats: "jpg,jpeg,png,webp",
  };
  return Response.json(
    {
      cloud: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      params,
      signature: photoSignature(params),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
