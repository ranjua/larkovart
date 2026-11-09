import { z } from "zod";
import { revalidatePath } from "next/cache";
import { session, sameOrigin } from "@/lib/auth";
import { deleteArtwork, StoreError } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 1024)
      return Response.json(
        { error: "Request too large." },
        { status: 413, headers },
      );
    const input = z
      .object({ confirmTitle: z.string().min(1).max(150) })
      .strict()
      .safeParse(JSON.parse(raw));
    const id = z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .safeParse((await params).id);
    if (!input.success || !id.success)
      return Response.json(
        { error: "Confirm the artwork to delete." },
        { status: 400, headers },
      );
    const result = await deleteArtwork(id.data, input.data.confirmTitle);
    revalidatePath("/studio");
    revalidatePath("/[locale]", "layout");
    return Response.json({ ok: true, ...result }, { headers });
  } catch (error) {
    if (error instanceof StoreError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers },
      );
    return Response.json(
      { error: "Unable to delete artwork. Reload the studio and try again." },
      { status: 500, headers },
    );
  }
}
