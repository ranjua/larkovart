import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { CustomerAccount } from "@/components/customer/account";
import { headers } from "next/headers";
import { customerConfig } from "@/lib/customer/config";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // OAuth state cookies must start and finish on the configured account host.
  const config = customerConfig();
  if (process.env.VERCEL_ENV && config.ready) {
    const host = (await headers()).get("host");
    if (host && host !== new URL(config.baseURL).host)
      redirect(`${config.baseURL}/${locale}/account`);
  }
  return <CustomerAccount locale={locale} />;
}
