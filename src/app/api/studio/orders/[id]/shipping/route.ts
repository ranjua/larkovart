import { session, sameOrigin } from "@/lib/auth";
import { processFulfillment } from "@/lib/commerce";
import { shipping } from "@/lib/shipping";
import { db, init } from "@/lib/store";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  const { id } = await params;
  try {
    return Response.json({ state: await processFulfillment(id, shipping()) });
  } catch {
    return Response.json(
      { error: "test_shipping_unavailable" },
      { status: 503 },
    );
  }
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  await init();
  const { id } = await params;
  const result = await db().execute({
    sql: "SELECT state, data FROM fulfillment WHERE order_id=?",
    args: [id],
  });
  if (
    !["test_booked", "test_label_created"].includes(
      String(result.rows[0]?.state),
    )
  )
    return Response.json({ error: "label_not_ready" }, { status: 404 });
  const shipment = JSON.parse(String(result.rows[0].data));
  const label = shipment.documents?.find(
    (d: { typeCode?: string; imageFormat?: string }) =>
      d.typeCode === "label" && d.imageFormat?.toUpperCase() === "PDF",
  );
  if (!label) return Response.json({ error: "label_missing" }, { status: 404 });
  return new Response(Buffer.from(label.content, "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="sandbox-shipping-label.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}

export const maxDuration = 120;
