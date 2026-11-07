import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocale } from "@/lib/i18n";
export default async function Page() {
  const locale = (await cookies()).get("larkovart_locale")?.value || "es";
  redirect(`/${isLocale(locale) ? locale : "es"}`);
}
