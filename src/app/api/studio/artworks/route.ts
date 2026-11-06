import { session, sameOrigin } from "@/lib/auth";
import { saveArtwork } from "@/lib/store";
import { artworkSchema } from "@/lib/validation";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 6_000_000)
      return Response.json({ error: "Image too large." }, { status: 413 });
    const parsed = artworkSchema.safeParse(JSON.parse(body));
    if (!parsed.success)
      return Response.json(
        {
          error:
            "Check artwork details, all six descriptions, price ($75–$1,000) and dimensions (up to 80 cm).",
        },
        { status: 400 },
      );
    await saveArtwork(parsed.data);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to save artwork." }, { status: 500 });
  }
}
