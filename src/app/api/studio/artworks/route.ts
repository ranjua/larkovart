import { session, sameOrigin } from "@/lib/auth";
import { saveArtwork } from "@/lib/store";
import { artworkSchema } from "@/lib/validation";
import { photoUrls } from "@/lib/photo";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 6_000_000)
      return Response.json({ error: "Image too large." }, { status: 413 });
    const input = JSON.parse(body);
    if (input.photoReceipt) {
      try {
        const urls = photoUrls(input.photoReceipt);
        // The synchronous eager upload must finish successfully before publication.
        const ready = await fetch(urls.image, {
          method: "HEAD",
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (
          !ready.ok ||
          !ready.headers.get("content-type")?.startsWith("image/")
        )
          throw new Error("Not ready");
        Object.assign(input, urls);
      } catch {
        return Response.json(
          {
            error:
              "Photo enhancement has not completed. Nothing was published; try again.",
          },
          { status: 422 },
        );
      }
    }
    const parsed = artworkSchema.safeParse(input);
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
