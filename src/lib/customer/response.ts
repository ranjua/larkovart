// Strip bearer/provider material from JSON; sessions remain in HttpOnly cookies.
function publicJson(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(publicJson);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(
          ([k]) =>
            ![
              "token",
              "accessToken",
              "refreshToken",
              "idToken",
              "password",
              "secret",
              "totpURI",
              "backupCodes",
              "access_token",
              "refresh_token",
              "id_token",
            ].includes(k),
        )
        .map(([k, x]) => [k, publicJson(x)]),
    );
  return v;
}

// OAuth callbacks return redirects with an empty body, sometimes labeled JSON.
// Preserve their Location and session cookies without attempting JSON parsing.
export async function customerResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  if (
    (response.status >= 300 && response.status < 400) ||
    response.status === 204 ||
    response.status === 205
  )
    return new Response(response.body, { status: response.status, headers });
  if (headers.get("Content-Type")?.includes("application/json")) {
    const body = await response.text();
    headers.delete("content-length");
    return new Response(
      body.trim() ? JSON.stringify(publicJson(JSON.parse(body))) : null,
      { status: response.status, headers },
    );
  }
  return new Response(response.body, { status: response.status, headers });
}
