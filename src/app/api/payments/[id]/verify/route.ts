import { cookies } from "next/headers";
import { sameOrigin } from "@/lib/auth";
import {
  ownsOrder,
  reconcilePayment,
  processFulfillment,
} from "@/lib/commerce";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  const { id } = await params;
  const token = (await cookies()).get(`larkovart_order_${id}`)?.value || "";
  if (!(await ownsOrder(id, token)))
    return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const status = await reconcilePayment(id);
    if (status === "sandbox_paid") await processFulfillment(id);
    return Response.json(
      { status, environment: "sandbox" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "verification_pending" }, { status: 503 });
  }
}

export const maxDuration = 120;
