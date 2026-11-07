import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { ownsOrder } from "@/lib/commerce";
import { PaymentResult } from "@/components/payment-result";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();
  const token = (await cookies()).get(`larkovart_order_${id}`)?.value || "";
  if (!(await ownsOrder(id, token))) notFound();
  return <PaymentResult id={id} locale={locale} />;
}
