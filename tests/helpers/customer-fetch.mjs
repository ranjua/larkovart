// Isolated browser fixture transport. Never imported by production code.
import { writeFileSync } from "node:fs";
if (
  process.env.LARKOVART_TEST_EMAIL_CAPTURE &&
  process.env.RESEND_API_KEY === "re_test_local_only"
) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (
      (typeof url === "string"
        ? url
        : url instanceof URL
          ? url.href
          : url.url) === "https://api.resend.com/emails"
    ) {
      const email = JSON.parse(
        String(options?.body || (await url.clone().text())),
      );
      const match = email.text.match(/code is (\d{6})/);
      if (!match) throw new Error("Unexpected fixture email");
      writeFileSync(
        process.env.LARKOVART_TEST_EMAIL_CAPTURE,
        JSON.stringify({ code: match[1], to: email.to }),
        { mode: 0o600 },
      );
      return Response.json({ id: "fixture-email" });
    }
    return original(url, options);
  };
}
