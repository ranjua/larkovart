import { z } from "zod";

const base = "https://app.recurrente.com/api";
const checkoutSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["unpaid", "paid", "payment_in_progress", "expired"]),
  live_mode: z.literal(false),
  total_in_cents: z.number().int().optional(),
  currency: z.string().optional(),
  metadata: z.object({ order_id: z.string() }).optional(),
  checkout_url: z.url().optional(),
  latest_intent: z.object({ id: z.string() }).nullish(),
});
export type ProviderCheckout = z.infer<typeof checkoutSchema>;
export class IntegrationError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export class RecurrenteSandbox {
  constructor(
    privateConfig: { key: string; sandboxId: string },
    transport: typeof fetch = fetch,
  ) {
    if (
      !privateConfig.key.startsWith("sk_test_") ||
      !privateConfig.sandboxId.startsWith("sbx_")
    )
      throw new IntegrationError("sandbox_credentials_required");
    this.config = privateConfig;
    this.transport = transport;
  }
  private config: { key: string; sandboxId: string };
  private transport: typeof fetch;
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ) {
    const response = await this.transport(`${base}${path}`, {
      method,
      redirect: "error",
      cache: "no-store",
      headers: {
        "X-SECRET-KEY": this.config.key,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    // Never return provider response bodies or credentials in errors/logs.
    if (!response.ok)
      throw new IntegrationError(`recurrente_http_${response.status}`);
    return response.json();
  }
  async verifyEnvironment() {
    const info = await this.request("/test");
    if (
      info.environment !== "sandbox" ||
      info.sandbox_id !== this.config.sandboxId
    )
      throw new IntegrationError("sandbox_environment_mismatch");
  }
  async create(input: {
    orderId: string;
    title: string;
    amount: number;
    returnUrl: string;
    cancelUrl: string;
  }) {
    await this.verifyEnvironment();
    const checkout = checkoutSchema.parse(
      await this.request("/checkouts", "POST", {
        items: [
          {
            name: input.title,
            amount_in_cents: input.amount,
            currency: "USD",
            quantity: 1,
            charge_type: "one_time",
            payment_method_types: ["card"],
            available_installments: [],
          },
        ],
        metadata: { order_id: input.orderId },
        clave_enabled: false,
        expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        success_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      }),
    );
    if (
      !checkout.checkout_url ||
      new URL(checkout.checkout_url).origin !== "https://app.recurrente.com"
    )
      throw new IntegrationError("invalid_checkout_url");
    return checkout;
  }
  async refundCheckout(input: {
    checkoutId: string;
    orderId: string;
    amount: number;
    idempotencyKey: string;
  }) {
    const checkout = await this.get(input.checkoutId);
    if (
      checkout.status !== "paid" ||
      checkout.metadata?.order_id !== input.orderId ||
      checkout.total_in_cents !== input.amount ||
      checkout.currency !== "USD" ||
      !checkout.latest_intent?.id.startsWith("in_")
    )
      throw new IntegrationError("refund_checkout_mismatch");
    const result = await this.request(
      "/refunds",
      "POST",
      { intent_id: checkout.latest_intent.id },
      { "Idempotency-Key": input.idempotencyKey },
    );
    return z
      .object({
        id: z.string().min(1),
        status: z.enum(["pending", "succeeded", "failed", "voided"]),
        failure_reason: z.string().nullish(),
      })
      .parse(result);
  }
  async getRefund(id: string) {
    await this.verifyEnvironment();
    return z
      .object({
        id: z.string().min(1),
        status: z.enum(["pending", "succeeded", "failed", "voided"]),
        failure_reason: z.string().nullish(),
      })
      .parse(await this.request(`/refunds/${encodeURIComponent(id)}`));
  }
  async get(id: string) {
    await this.verifyEnvironment();
    return checkoutSchema.parse(
      await this.request(`/checkouts/${encodeURIComponent(id)}`),
    );
  }
}
export function recurrenteConfigured() {
  return (
    !!process.env.RECURRENTE_SECRET_KEY && !!process.env.RECURRENTE_SANDBOX_ID
  );
}
export function recurrente() {
  if (process.env.PAYMENT_ENVIRONMENT !== "sandbox")
    throw new IntegrationError("sandbox_only");
  return new RecurrenteSandbox({
    key: process.env.RECURRENTE_SECRET_KEY || "",
    sandboxId: process.env.RECURRENTE_SANDBOX_ID || "",
  });
}
