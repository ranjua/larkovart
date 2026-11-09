import type { Metadata } from "next";
import { headers } from "next/headers";
import "./fonts.css";
import "./globals.css";
import "./gallery.css";
export const metadata: Metadata = {
  title: {
    default: "Larkova Art — Original works by Yulia Larkova",
    template: "%s · Larkova Art",
  },
  description:
    "Original paintings, drawings and sculptures from the studio of Yulia Larkova in Guatemala.",
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-larkovart-locale") || "es";
  return (
    <html lang={locale === "zh" ? "zh-Hans" : locale}>
      <body>{children}</body>
    </html>
  );
}
