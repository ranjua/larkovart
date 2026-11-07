import { z } from "zod";
import {
  parcelSchema,
  contactSchema,
  plannedPickup,
  type Parcel,
  type ShippingContact,
} from "./dhl.ts";
import { IntegrationError } from "./recurrente.ts";
import type {
  CourierAdapter,
  ShippingQuote,
  ShipmentInput,
  Shipment,
} from "../shipping-types.ts";
const base = "https://api-test.envia.com";
const query = "https://queries.test.envia.com";
const addressSchema = z
  .object({
    name: z.string().min(1),
    phone: z.string().min(7),
    street: z.string().min(3),
    city: z.string().min(1),
    state: z.string().min(2).max(3),
    country: z.literal("GT"),
    postalCode: z.string().min(3),
  })
  .passthrough();
export class EnviaSandbox implements CourierAdapter {
  readonly id = "envia" as const;
  private token: string;
  private transport: typeof fetch;
  private originId?: number;
  private configuredOrigin?: z.infer<typeof addressSchema>;
  constructor(
    token: string,
    transport: typeof fetch = fetch,
    originId?: number,
    originAddress?: unknown,
  ) {
    if (!token || token === "[SENSITIVE]")
      throw new IntegrationError("envia_test_token_required");
    this.token = token;
    this.transport = transport;
    this.originId = originId;
    if (originAddress) this.configuredOrigin = addressSchema.parse(originAddress);
  }
  supports(country: string) {
    return /^[A-Z]{2}$/.test(country);
  }
  private async request(path: string, body?: unknown, queries = false) {
    const r = await this.transport((queries ? query : base) + path, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: "Bearer " + this.token,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new IntegrationError("envia_http_" + r.status);
    const j = await r.json();
    if (j.success === false || j.error)
      throw new IntegrationError("envia_request_rejected");
    return j;
  }
  async verify() {
    return this.request("/available-carrier/GT/0/1", undefined, true);
  }
  private async origin() {
    if (this.configuredOrigin) return this.configuredOrigin;
    const j = await this.request("/all-addresses", undefined, true);
    const rows = z
      .object({
        data: z.array(
          z.object({ address_id: z.number(), address: z.unknown() }),
        ),
      })
      .parse(j).data;
    const candidates = rows
      .filter((r) => !this.originId || r.address_id === this.originId)
      .flatMap((r) => {
        const parsed = addressSchema.safeParse(r.address);
        return parsed.success ? [parsed.data] : [];
      });
    if (candidates.length !== 1)
      throw new IntegrationError("envia_unique_guatemala_origin_required");
    return candidates[0];
  }
  private destination(c: ShippingContact) {
    contactSchema.parse(c);
    if (!c.region || !/^.{2,3}$/.test(c.region))
      throw new IntegrationError("envia_state_code_required");
    return {
      name: c.name,
      email: c.email,
      phone: c.phone,
      street: c.address,
      city: c.city,
      state: c.region,
      country: c.country,
      postalCode: c.postal,
    };
  }
  private body(
    origin: unknown,
    c: ShippingContact,
    p: Parcel,
    amount: number,
    title: string,
    carrier: string,
    service?: string,
  ) {
    parcelSchema.parse(p);
    return {
      origin,
      destination: this.destination(c),
      packages: [
        {
          type: "box",
          content: title,
          amount: 1,
          declaredValue: amount / 100,
          lengthUnit: "CM",
          weightUnit: "KG",
          weight: p.weight,
          dimensions: { length: p.length, width: p.width, height: p.height },
          ...(c.country !== "GT"
            ? {
                items: [
                  {
                    description: title,
                    productCode: p.hsCode,
                    quantity: 1,
                    countryOfManufacture: p.originCountry,
                    price: amount / 100,
                    currency: "USD",
                  },
                ],
              }
            : {}),
        },
      ],
      settings: {
        currency: "USD",
        printFormat: "PDF",
        printSize: "PAPER_LETTER",
      },
      shipment: { type: 1, carrier, ...(service ? { service } : {}) },
      ...(c.country !== "GT"
        ? {
            customsSettings: {
              dutiesPaymentEntity: "recipient",
              exportReason: "sale",
            },
          }
        : {}),
    };
  }
  async quotes(
    receiver: ShippingContact,
    p: Parcel,
    amount: number,
  ): Promise<ShippingQuote[]> {
    const origin = await this.origin();
    const catalog = await this.request(
      "/available-carrier/GT/" + (receiver.country === "GT" ? "0" : "1") + "/1",
      undefined,
      true,
    );
    const carriers = z
      .object({ data: z.array(z.object({ code: z.string() })) })
      .parse(catalog).data;
    const results = await Promise.allSettled(
      carriers.map(async (c) => {
        const j = await this.request(
          "/ship/rate/",
          this.body(origin, receiver, p, amount, "Original artwork", c.code),
        );
        return z
          .object({
            data: z.array(
              z.object({
                carrier: z.string(),
                service: z.string(),
                totalPrice: z.number().nonnegative(),
                currency: z.string(),
                dropOff: z.number(),
              }),
            ),
          })
          .parse(j).data;
      }),
    );
    return results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter(
        (q) =>
          q.dropOff === 0 && (q.currency === "USD" || q.currency === "GTQ"),
      )
      .map((q) => ({
        carrier: this.id,
        service:
          encodeURIComponent(q.carrier) + "|" + encodeURIComponent(q.service),
        amountCents: Math.ceil(q.totalPrice * 100),
        currency: q.currency as "USD" | "GTQ",
      }));
  }
  async shipment(input: ShipmentInput): Promise<Shipment> {
    const parts = input.service.split("|");
    if (parts.length !== 2) throw new IntegrationError("envia_service_invalid");
    const [carrier, service] = parts.map(decodeURIComponent);
    const origin = await this.origin();
    const j = await this.request(
      "/ship/generate/",
      this.body(
        origin,
        input.receiver,
        input.parcel,
        input.amount,
        input.title,
        carrier,
        service,
      ),
    );
    const data = z
      .object({
        data: z
          .array(
            z.object({
              carrier: z.string(),
              service: z.string(),
              trackingNumber: z.string().min(1),
              label: z.url(),
            }),
          )
          .length(1),
      })
      .parse(j).data[0];
    if (data.carrier !== carrier || data.service !== service)
      throw new IntegrationError("envia_service_mismatch");
    let result: Shipment = {
      carrier: this.id,
      shipmentTrackingNumber: data.trackingNumber,
      pickupState: "review_required",
    };
    await input.checkpoint?.(result);
    try {
      const url = new URL(data.label);
      if (
        url.protocol !== "https:" ||
        !(
          url.hostname === "envia.com" ||
          url.hostname.endsWith(".envia.com") ||
          url.hostname.endsWith(".amazonaws.com")
        )
      )
        throw Error("label_host");
      const label = await this.transport(url, {
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (!label.ok || Number(label.headers.get("content-length")) > 5000000)
        throw Error("label_unavailable");
      const bytes = Buffer.from(await label.arrayBuffer());
      if (bytes.length > 5000000 || bytes.subarray(0, 5).toString() !== "%PDF-")
        throw Error("label_invalid");
      result = {
        ...result,
        documents: [
          {
            typeCode: "label",
            imageFormat: "PDF",
            content: bytes.toString("base64"),
          },
        ],
      };
      await input.checkpoint?.(result);
    } catch {
      return result;
    }
    try {
      const p = await this.request("/ship/pickup/", {
        origin,
        shipment: {
          type: 1,
          carrier,
          pickup: {
            weightUnit: "KG",
            totalWeight: input.parcel.weight,
            totalPackages: 1,
            date: plannedPickup().slice(0, 10),
            timeFrom: 10,
            timeTo: 17,
            carrier,
            trackingNumbers: [data.trackingNumber],
          },
        },
      });
      const pickup = z
        .object({
          data: z.array(z.object({ pickupNumber: z.string().min(1) })).min(1),
        })
        .parse(p);
      result = {
        ...result,
        dispatchConfirmationNumber: pickup.data[0].pickupNumber,
        pickupState: "confirmed",
      };
    } catch {
      /* Preserve the label; do not repeat ambiguous pickup writes. */
    }
    return result;
  }
  async tracking(number: string) {
    if (!/^[A-Za-z0-9-]{3,80}$/.test(number))
      throw new IntegrationError("tracking_invalid");
    return this.request("/ship/generaltrack/", { trackingNumbers: [number] });
  }
}
export const enviaConfigured = () => !!process.env.ENVIA_SANDBOX_TOKEN;
export const envia = () =>
  new EnviaSandbox(
    process.env.ENVIA_SANDBOX_TOKEN || "",
    fetch,
    process.env.ENVIA_TEST_ORIGIN_ID
      ? Number(process.env.ENVIA_TEST_ORIGIN_ID)
      : undefined,
    process.env.ENVIA_TEST_ORIGIN_JSON ? JSON.parse(process.env.ENVIA_TEST_ORIGIN_JSON) : undefined,
  );
