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

if (process.env.ENVIA_TEST_ORIGIN_JSON) {
  const origin = JSON.parse(process.env.ENVIA_TEST_ORIGIN_JSON);
  if (
    origin.country !== "GT" ||
    !["name", "phone", "street", "city", "state", "postalCode"].every(
      (k) => typeof origin[k] === "string" && origin[k].length > 0,
    )
  )
    throw Error("Configured Envia test sender is incomplete.");
  console.log(
    "Private Guatemala test sender configuration validated. No address details logged.",
  );
}

// Read-only local estimate: same sender/destination address, not a delivery promise.
if (process.env.ENVIA_TEST_ORIGIN_JSON && process.env.ENVIA_SANDBOX_TOKEN) {
  const origin = JSON.parse(process.env.ENVIA_TEST_ORIGIN_JSON);
  const headers = {
    Authorization: "Bearer " + process.env.ENVIA_SANDBOX_TOKEN,
    "Content-Type": "application/json",
  };
  const catalog = await fetch(
    "https://queries.test.envia.com/available-carrier/GT/0/1",
    { headers, redirect: "error", signal: AbortSignal.timeout(20000) },
  );
  if (catalog.ok) {
    const list = await catalog.json();
    const carrier = list.data?.find((c) => typeof c.code === "string")?.code;
    if (carrier) {
      const r = await fetch("https://api-test.envia.com/ship/rate/", {
        method: "POST",
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          origin,
          destination: origin,
          packages: [
            {
              type: "box",
              content: "Original painting - preliminary local sandbox quote",
              amount: 1,
              declaredValue: 100,
              lengthUnit: "CM",
              weightUnit: "KG",
              weight: 4,
              dimensions: { length: 62, width: 62, height: 14 },
            },
          ],
          shipment: { type: 1, carrier },
          settings: { currency: "USD" },
        }),
      });
      if (r.ok) {
        const quote = await r.json();
        const rates = Array.isArray(quote.data)
          ? quote.data
              .filter(
                (q) =>
                  typeof q.totalPrice === "number" &&
                  typeof q.currency === "string",
              )
              .map((q) => ({
                carrier: q.carrier,
                service: q.service,
                totalPrice: q.totalPrice,
                currency: q.currency,
              }))
          : [];
        console.log(
          "Envia same-address local sandbox rate check: " +
            JSON.stringify(rates) +
            ". Preliminary only; no shipment created.",
        );
      } else
        console.log(
          "Envia local sandbox rate check unavailable (HTTP " +
            r.status +
            "); no shipment created.",
        );
    }
  }
}

if (process.env.RECURRENTE_SECRET_KEY || process.env.PAYMENT_PROVIDER === "recurrente") {
  const key = process.env.RECURRENTE_SECRET_KEY || "",
    sandbox = process.env.RECURRENTE_SANDBOX_ID || "";
  if (!key.startsWith("sk_test_") || (sandbox && !sandbox.startsWith("sbx_")))
    throw Error("Recurrente requires a Sandbox TEST key and Sandbox ID.");
  const r = await fetch("https://app.recurrente.com/api/test", {
    headers: { "X-SECRET-KEY": key },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw Error(
      "Recurrente sandbox authentication failed (HTTP " + r.status + ").",
    );
  const j = await r.json();
  if (j.environment !== "sandbox" || typeof j.sandbox_id !== "string" || !j.sandbox_id.startsWith("sbx_") || (sandbox && j.sandbox_id !== sandbox))
    throw Error("Recurrente sandbox environment mismatch.");
  if (!sandbox) console.log("Recurrente verified Sandbox ID: " + j.sandbox_id);
  console.log(
    "Recurrente Sandbox authentication verified. No checkout, refund or money movement created.",
  );
}
