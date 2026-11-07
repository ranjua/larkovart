import { artworks } from "@/lib/store";
export const dynamic = "force-dynamic";
const cell = (v: unknown) =>
  '"' +
  String(v)
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export async function GET() {
  const origin = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!origin || !/^https:\/\//.test(origin))
    return Response.json(
      { error: "canonical_https_url_required" },
      { status: 503 },
    );
  const base = new URL(origin).origin;
  const works = await artworks();
  const rows = [
    [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "brand",
      "inventory",
    ],
    ...works.map((a) => [
      a.id,
      a.title,
      "Original physical artwork. Shipping availability confirmed at checkout.",
      a.status === "available" ? "in stock" : "out of stock",
      "new",
      (a.price / 100).toFixed(2) + " USD",
      base + "/es/art/" + encodeURIComponent(a.id),
      base + a.image,
      "Larkova Art",
      a.status === "available" ? 1 : 0,
    ]),
  ];
  return new Response(rows.map((r) => r.map(cell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="larkovart-catalog.csv"',
    },
  });
}
