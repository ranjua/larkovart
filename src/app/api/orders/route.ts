import { z } from "zod";
import { order, StoreError } from "@/lib/store";
import { sameOrigin } from "@/lib/auth";
const input = z.object({
  artworkId: z.string().min(1).max(80),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(180),
  country: z.enum(["GT", "US", "OTHER"]),
  address: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(100),
  postal: z.string().trim().min(1).max(20),
});
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const parsed = input.safeParse(await request.json());
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
