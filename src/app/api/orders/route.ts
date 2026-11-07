import { buyerSchema } from "@/lib/buyer";
import { order, StoreError } from "@/lib/store";
import { sameOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  if (process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "demo")
    return Response.json({ error: "demo_checkout_disabled" }, { status: 403 });
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const parsed = buyerSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "invalid_input" }, { status: 400 });
    return Response.json(await order(parsed.data), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof StoreError)
      return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "order_failed" }, { status: 500 });
  }
}
