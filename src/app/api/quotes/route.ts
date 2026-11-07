import { buyerSchema } from "@/lib/buyer";
import { order, StoreError } from "@/lib/store";
import { sameOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const parsed = buyerSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "invalid_input" }, { status: 400 });
    return Response.json(await order(parsed.data, true), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: "quote_unavailable" },
      { status: error instanceof StoreError ? error.status : 500 },
    );
  }
}
