import { cookies } from "next/headers";
import { z } from "zod";
import { sameOrigin } from "@/lib/auth";
import { buyerSchema } from "@/lib/buyer";
import { startSandboxCheckout } from "@/lib/commerce";
import { locales } from "@/lib/i18n";
import { StoreError } from "@/lib/store";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  if (
    process.env.PAYMENT_PROVIDER !== "recurrente" ||
    process.env.PAYMENT_ENVIRONMENT !== "sandbox"
  )
    return Response.json({ error: "sandbox_not_configured" }, { status: 503 });
  try {
    const parsed = buyerSchema
      .extend({
        locale: z.enum(locales),
        phone: z.string().min(7).max(25),
        name: z.string().trim().min(2).max(45),
        address: z.string().trim().min(3).max(45),
        city: z.string().trim().min(2).max(45),
        postal: z.string().trim().min(1).max(12),
      })
      .safeParse(await request.json());
    if (!parsed.success || parsed.data.country === "OTHER")
      return Response.json(
        { error: "invalid_shipping_details" },
        { status: 400 },
      );
    const { locale, ...buyer } = parsed.data;
    const result = await startSandboxCheckout(buyer, locale);
    (await cookies()).set(`larkovart_order_${result.id}`, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 48 * 60 * 60,
    });
    return Response.json(
      { id: result.id, checkoutUrl: result.checkoutUrl },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof StoreError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "provider_unavailable" }, { status: 503 });
  }
}

export const maxDuration = 120;
