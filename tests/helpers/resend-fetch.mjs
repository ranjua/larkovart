// Test-only transport injection; never imported by the application.
import { writeFileSync } from "node:fs";
if (
  process.env.LARKOVART_TEST_EMAIL_CAPTURE &&
  process.env.RESEND_API_KEY === "re_test_local_only"
) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "https://api.resend.com/emails") {
      const email = JSON.parse(String(options.body));
      writeFileSync(
        process.env.LARKOVART_TEST_EMAIL_CAPTURE,
        JSON.stringify({
          code: email.text.match(/code is (\d{6})/)[1],
          to: email.to,
        }),
        { mode: 0o600 },
      );
      return Response.json({ id: "local-test-email" });
    }
    return original(url, options);
  };
}
