// Verify hosted credentials without charging, creating orders, or logging secrets.
if (process.env.PAYMENT_PROVIDER === "paypal") {
  if (process.env.PAYMENT_ENVIRONMENT !== "sandbox")
    throw Error("PayPal live activation requires a separate verified launch.");
  const id = process.env.PAYPAL_SANDBOX_CLIENT_ID,
    secret = process.env.PAYPAL_SANDBOX_SECRET;
  if (!id || !secret || id === "[SENSITIVE]" || secret === "[SENSITIVE]")
    throw Error("PayPal sandbox credentials unavailable.");
  const r = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization:
        "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok)
    throw Error(
      "PayPal sandbox authentication failed (HTTP " + r.status + ").",
    );
  const token = await r.json();
  if (typeof token.access_token !== "string")
    throw Error("PayPal sandbox authentication response invalid.");
  console.log(
    "PayPal sandbox authentication verified. No payment or order created.",
  );
}

if (process.env.ENVIA_SANDBOX_TOKEN) {
  const r = await fetch(
    "https://queries.test.envia.com/available-carrier/GT/0/1",
    {
      headers: { Authorization: "Bearer " + process.env.ENVIA_SANDBOX_TOKEN },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok)
    throw Error("Envia sandbox authentication failed (HTTP " + r.status + ").");
  const j = await r.json();
  if (j.success === false || !Array.isArray(j.data))
    throw Error("Envia sandbox catalog invalid.");
  console.log(
    "Envia sandbox authentication verified; Guatemala carrier catalog accessible. No labels or pickups created.",
  );
  const a = await fetch("https://queries.test.envia.com/all-addresses", {
    headers: { Authorization: "Bearer " + process.env.ENVIA_SANDBOX_TOKEN },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!a.ok)
    throw Error(
      "Envia authenticated address lookup failed (HTTP " + a.status + ").",
    );
  const addresses = await a.json();
  if (addresses.success === false || !Array.isArray(addresses.data))
    throw Error("Envia address lookup response invalid.");
  console.log(
    "Envia saved addresses: " +
      addresses.data.length +
      ". Address details not logged.",
  );
}
