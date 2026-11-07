import { session, sameOrigin } from "@/lib/auth";
import { dhl } from "@/lib/integrations/dhl";
import { db, init } from "@/lib/store";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  await init();
  const { id } = await params;
  const result = await db().execute({
    sql: "SELECT state, data FROM fulfillment WHERE order_id=?",
    args: [id],
  });
  if (result.rows[0]?.state !== "test_booked")
    return Response.json({ error: "shipment_not_ready" }, { status: 404 });
  try {
    const shipment = JSON.parse(String(result.rows[0].data));
    return Response.json(
      await dhl().tracking(shipment.shipmentTrackingNumber),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "test_tracking_unavailable" },
      { status: 503 },
    );
  }
}
