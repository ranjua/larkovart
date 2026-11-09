import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { SavedPage } from "@/components/customer/saved-page";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SavedPage locale={locale} kind="favorite" />;
}
