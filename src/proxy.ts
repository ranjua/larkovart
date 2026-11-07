import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  const locale = request.nextUrl.pathname.split("/")[1];
  const headers = new Headers(request.headers);
  headers.set(
    "x-larkovart-locale",
    ["es", "en", "ru", "zh", "ja", "pt"].includes(locale) ? locale : "en",
  );
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: ["/((?!api|_next|artworks|artist.jpg|favicon.ico).*)"],
};
