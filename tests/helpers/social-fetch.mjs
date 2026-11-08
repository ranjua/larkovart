// Test-only provider fixture. Imported by the isolated browser test, never by app code.
import "./resend-fetch.mjs";
if (
  process.env.LARKOVART_SOCIAL_PROVIDER_FIXTURE === "true" &&
  process.env.RESEND_API_KEY === "re_test_local_only"
) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (
      url.hostname === "api.instagram.com" &&
      url.pathname === "/oauth/access_token"
    )
      return Response.json({
        data: [
          {
            access_token: "fixture-short-token",
            user_id: "1001",
            permissions:
              "instagram_business_basic,instagram_business_content_publish",
          },
        ],
      });
    if (
      url.hostname === "graph.instagram.com" &&
      url.pathname === "/access_token"
    )
      return Response.json({
        access_token: "fixture-long-token",
        expires_in: 5184000,
      });
    if (url.hostname === "graph.instagram.com" && url.pathname === "/v25.0/me")
      return Response.json({
        data: [{ user_id: "1001", username: "larkova.art" }],
      });
    if (
      [
        "graph.instagram.com",
        "api.instagram.com",
        "graph.facebook.com",
        "api.pinterest.com",
        "open.tiktokapis.com",
      ].includes(url.hostname)
    )
      throw new Error("Unexpected social fixture request blocked");
    return original(input, init);
  };
}
