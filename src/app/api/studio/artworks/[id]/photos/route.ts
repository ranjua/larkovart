import { z } from "zod";
import { session, sameOrigin } from "@/lib/auth";
import { artworks, db } from "@/lib/store";
import { imageSchema } from "@/lib/validation";
import { photoUrls } from "@/lib/photo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const photo = z
  .object({
    id: z.string().uuid(),
    image: imageSchema,
    kind: z.enum(["detail", "backPhoto", "signature", "edge", "otherPhoto"]),
  })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4_000_000)
      return Response.json(
        { error: "Photo set is too large." },
        { status: 413 },
      );
    const input = z
      .object({
        expectedRevision: z.number().int().nonnegative(),
        photos: z.array(photo).max(6),
        receipts: z
          .record(
            z.string().uuid(),
            z.object({
              public_id: z.string(),
              version: z.number().int(),
              signature: z.string(),
            }),
          )
          .default({}),
      })
      .strict()
      .parse(JSON.parse(raw));
    if (new Set(input.photos.map((p) => p.id)).size !== input.photos.length)
      throw new Error("Duplicate photo IDs");
    const id = (await params).id,
      a = (await artworks(true)).find((a) => a.id === id);
    if (!a)
      return Response.json({ error: "Artwork not found." }, { status: 404 });
    await Promise.all(
      input.photos.map(async (p) => {
        if (a.photos?.some((old) => old.id === p.id && old.image === p.image))
          return;
        if (p.image.startsWith("data:")) {
          if (p.image.length > 450000)
            throw new Error("Use a smaller local image.");
          return;
        }
        const receipt = input.receipts[p.id];
        if (!receipt || photoUrls(receipt).originalImage !== p.image)
          throw new Error("A verified original upload is required.");
        const r = await fetch(p.image, {
          method: "HEAD",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok || !r.headers.get("content-type")?.startsWith("image/"))
          throw new Error("Photo is not ready.");
      }),
    );
    const r = await db().execute({
      sql: "UPDATE artworks SET data=json_set(data,'$.photos',json(?),'$.photoRevision',?) WHERE id=? AND COALESCE(json_extract(data,'$.photoRevision'),0)=?",
      args: [
        JSON.stringify(input.photos),
        input.expectedRevision + 1,
        id,
        input.expectedRevision,
      ],
    });
    if (r.rowsAffected !== 1)
      return Response.json(
        { error: "Photos changed in another tab. Reload before saving." },
        { status: 409 },
      );
    return Response.json(
      { ok: true, revision: input.expectedRevision + 1 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Photos were not saved. Check uploads and try again." },
      { status: 422 },
    );
  }
}
