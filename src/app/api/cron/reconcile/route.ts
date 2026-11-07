import { reconcilePending } from "@/lib/commerce";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    secret.length < 24 ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  )
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.PAYMENT_ENVIRONMENT !== "sandbox")
    return Response.json({ error: "sandbox_only" }, { status: 503 });
  return Response.json(
    { results: await reconcilePending() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const maxDuration = 300;
