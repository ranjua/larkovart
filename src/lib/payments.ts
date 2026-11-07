import {
  recurrente,
  IntegrationError,
  type ProviderCheckout,
} from "./integrations/recurrente.ts";
export type PaymentInput = {
  orderId: string;
  title: string;
  amount: number;
  returnUrl: string;
  cancelUrl: string;
};
export interface PaymentConnection {
  verifyEnvironment(): Promise<void>;
  create(input: PaymentInput): Promise<ProviderCheckout>;
  get(
    id: string,
    expected?: { orderId: string; amount: number },
  ): Promise<ProviderCheckout>;
}
export type PaymentProvider = "recurrente" | "stripe" | "paypal";
export class StripeSandbox implements PaymentConnection {
  private key: string;
  private transport: typeof fetch;
  constructor(key: string, transport: typeof fetch = fetch) {
    if (!key.startsWith("sk_test_"))
      throw new IntegrationError("stripe_test_key_required");
    this.key = key;
    this.transport = transport;
  }
  async verifyEnvironment() {
    if (!this.key.startsWith("sk_test_"))
      throw new IntegrationError("sandbox_only");
  }
  private async request(
    path: string,
    body?: URLSearchParams,
    idempotency?: string,
  ) {
    const r = await this.transport("https://api.stripe.com/v1" + path, {
      method: body ? "POST" : "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: "Bearer " + this.key,
        ...(body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
        ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
      },
      body,
    });
    if (!r.ok) throw new IntegrationError("stripe_request_failed");
    const j = await r.json();
    if (j.livemode !== false)
      throw new IntegrationError("stripe_environment_mismatch");
    return j;
  }
  private normalize(j: Record<string, any>): ProviderCheckout {
    if (typeof j.id !== "string" || !j.id.startsWith("cs_test_"))
      throw new IntegrationError("stripe_checkout_invalid");
    return {
      id: j.id,
      live_mode: false,
      status:
        j.payment_status === "paid"
          ? "paid"
          : j.status === "expired"
            ? "expired"
            : "unpaid",
      total_in_cents: j.amount_total,
      currency:
        typeof j.currency === "string" ? j.currency.toUpperCase() : undefined,
      metadata: { order_id: j.metadata?.order_id },
      checkout_url: j.url,
    };
  }
  async create(i: PaymentInput) {
    const b = new URLSearchParams({
      mode: "payment",
      success_url: i.returnUrl,
      cancel_url: i.cancelUrl,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(i.amount),
      "line_items[0][price_data][product_data][name]": i.title,
      "line_items[0][quantity]": "1",
      "metadata[order_id]": i.orderId,
      expires_at: String(Math.floor(Date.now() / 1000) + 1801),
    });
    const result = this.normalize(
      await this.request("/checkout/sessions", b, i.orderId),
    );
    if (
      !result.checkout_url ||
      new URL(result.checkout_url).origin !== "https://checkout.stripe.com"
    )
      throw new IntegrationError("stripe_checkout_url_invalid");
    return result;
  }
  async get(id: string) {
    if (!id.startsWith("cs_test_"))
      throw new IntegrationError("stripe_checkout_invalid");
    return this.normalize(
      await this.request("/checkout/sessions/" + encodeURIComponent(id)),
    );
  }
}
export class PaypalSandbox implements PaymentConnection {
  private clientId: string;
  private secret: string;
  private transport: typeof fetch;
  constructor(
    clientId: string,
    secret: string,
    transport: typeof fetch = fetch,
  ) {
    if (!clientId || !secret)
      throw new IntegrationError("paypal_sandbox_credentials_required");
    this.clientId = clientId;
    this.secret = secret;
    this.transport = transport;
  }
  async verifyEnvironment() {
    /* Sandbox host is fixed for every request. */
  }
  private async request(path: string, body?: unknown, idempotency?: string) {
    const auth = await this.transport(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(this.clientId + ":" + this.secret).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      },
    );
    if (!auth.ok) throw new IntegrationError("paypal_auth_failed");
    const token = await auth.json();
    if (typeof token.access_token !== "string")
      throw new IntegrationError("paypal_auth_invalid");
    const r = await this.transport("https://api-m.sandbox.paypal.com" + path, {
      method: body !== undefined ? "POST" : "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: "Bearer " + token.access_token,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(idempotency ? { "PayPal-Request-Id": idempotency } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new IntegrationError("paypal_request_failed");
    return r.json();
  }
  private normalize(j: Record<string, any>): ProviderCheckout {
    const units = j.purchase_units;
    if (!Array.isArray(units) || units.length !== 1 || typeof j.id !== "string")
      throw new IntegrationError("paypal_order_invalid");
    const u = units[0],
      captures = u.payments?.captures || [];
    const paid =
      j.status === "COMPLETED" &&
      captures.length === 1 &&
      captures[0].status === "COMPLETED";
    const amount = paid ? captures[0].amount : u.amount;
    const value = String(amount?.value || "");
    if (!/^\d+\.\d{2}$/.test(value))
      throw new IntegrationError("paypal_amount_invalid");
    const cents = Number(value.replace(".", ""));
    if (!Number.isSafeInteger(cents))
      throw new IntegrationError("paypal_amount_invalid");
    return {
      id: j.id,
      live_mode: false,
      status: paid ? "paid" : j.status === "VOIDED" ? "expired" : "unpaid",
      total_in_cents: cents,
      currency: amount.currency_code,
      metadata: { order_id: u.custom_id },
      checkout_url: j.links?.find(
        (l: Record<string, string>) =>
          l.rel === "payer-action" || l.rel === "approve",
      )?.href,
    };
  }
  async create(i: PaymentInput) {
    const j = await this.request(
      "/v2/checkout/orders",
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: i.orderId,
            custom_id: i.orderId,
            description: i.title,
            amount: {
              currency_code: "USD",
              value: (i.amount / 100).toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: i.returnUrl,
              cancel_url: i.cancelUrl,
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
            },
          },
        },
      },
      i.orderId,
    );
    const result = this.normalize(j);
    if (
      !result.checkout_url ||
      new URL(result.checkout_url).origin !== "https://www.sandbox.paypal.com"
    )
      throw new IntegrationError("paypal_checkout_url_invalid");
    return result;
  }
  async get(id: string, expected?: { orderId: string; amount: number }) {
    if (!/^[A-Z0-9]{8,40}$/.test(id))
      throw new IntegrationError("paypal_order_invalid");
    let j = await this.request("/v2/checkout/orders/" + id);
    if (j.status === "APPROVED") {
      const before = this.normalize(j);
      if (
        !expected ||
        before.metadata?.order_id !== expected.orderId ||
        before.total_in_cents !== expected.amount ||
        before.currency !== "USD"
      )
        throw new IntegrationError("paypal_capture_reference_mismatch");
      j = await this.request(
        "/v2/checkout/orders/" + id + "/capture",
        {},
        "capture-" + id,
      );
    }
    return this.normalize(j);
  }
}
export function payment(
  provider = process.env.PAYMENT_PROVIDER || "recurrente",
): PaymentConnection {
  if (process.env.PAYMENT_ENVIRONMENT !== "sandbox")
    throw new IntegrationError("sandbox_only");
  if (provider === "stripe")
    return new StripeSandbox(process.env.STRIPE_SECRET_KEY || "");
  if (provider === "paypal")
    return new PaypalSandbox(
      process.env.PAYPAL_SANDBOX_CLIENT_ID || "",
      process.env.PAYPAL_SANDBOX_SECRET || "",
    );
  if (provider === "recurrente") return recurrente();
  throw new IntegrationError("payment_provider_unavailable");
}
