import { z } from "zod";
import { IntegrationError } from "./recurrente.ts";

const base = "https://express.api.dhl.com/mydhlapi/test";
export const parcelSchema = z
  .object({
    length: z.number().positive().max(150),
    width: z.number().positive().max(150),
    height: z.number().positive().max(150),
    weight: z.number().positive().max(70),
    netWeight: z.number().positive().max(70),
    originCountry: z.string().regex(/^[A-Z]{2}$/),
    hsCode: z.string().regex(/^\d{6,10}$/),
    shippingBudget: z.number().int().nonnegative().max(100000),
  })
  .refine(
    (p) => p.netWeight <= p.weight,
    "Net weight cannot exceed packed weight.",
  );
export type Parcel = z.infer<typeof parcelSchema>;
const contactSchema = z.object({
  name: z.string().min(2).max(45),
  email: z.email(),
  phone: z.string().min(7).max(25),
  address: z.string().min(3).max(45),
  city: z.string().min(2).max(45),
  postal: z.string().min(1).max(12),
  country: z.string().regex(/^[A-Z]{2}$/),
  region: z.string().max(35).optional(),
});
export type ShippingContact = z.infer<typeof contactSchema>;
export function plannedPickup() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  while ([0, 6].includes(date.getUTCDay()))
    date.setUTCDate(date.getUTCDate() + 1);
  return `${date.toISOString().slice(0, 10)}T10:00:00 GMT-06:00`;
}
function postal(c: ShippingContact) {
  return {
    addressLine1: c.address,
    cityName: c.city,
    postalCode: c.postal,
    countryCode: c.country,
    ...(c.region ? { provinceCode: c.region } : {}),
  };
}
function party(c: ShippingContact) {
  return {
    postalAddress: postal(c),
    contactInformation: {
      fullName: c.name,
      companyName: c.name,
      email: c.email,
      phone: c.phone,
    },
  };
}
function packages(p: Parcel) {
  return [
    {
      weight: p.weight,
      dimensions: { length: p.length, width: p.width, height: p.height },
    },
  ];
}
export class DhlSandbox {
  private config: {
    username: string;
    password: string;
    account: string;
    shipper: ShippingContact;
  };
  private transport: typeof fetch;
  constructor(config: DhlSandbox["config"], transport: typeof fetch = fetch) {
    if (!config.username || !config.password || !/^\d{9}$/.test(config.account))
      throw new IntegrationError("dhl_test_credentials_required");
    const shipper = contactSchema.parse(config.shipper);
    if (shipper.country !== "GT")
      throw new IntegrationError("guatemala_origin_required");
    this.config = { ...config, shipper };
    this.transport = transport;
  }
  private accounts() {
    return [{ typeCode: "shipper", number: this.config.account }];
  }
  private async request(path: string, body?: unknown) {
    const response = await this.transport(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")}`,
        "Content-Type": "application/json",
        "x-version": "3.4.1",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new IntegrationError(`dhl_http_${response.status}`);
    return response.json();
  }
  async includedService(
    receiver: ShippingContact,
    parcel: Parcel,
    amount: number,
  ) {
    contactSchema.parse(receiver);
    parcelSchema.parse(parcel);
    const result = await this.request("/rates", {
      customerDetails: {
        shipperDetails: postal(this.config.shipper),
        receiverDetails: postal(receiver),
      },
      accounts: this.accounts(),
      plannedShippingDateAndTime: plannedPickup(),
      unitOfMeasurement: "metric",
      isCustomsDeclarable: receiver.country !== "GT",
      packages: packages(parcel),
      monetaryAmount: [
        { typeCode: "declaredValue", value: amount / 100, currency: "USD" },
      ],
    });
    const parsed = z
      .object({
        products: z.array(
          z.object({
            productCode: z.string(),
            totalPrice: z.array(
              z.object({
                priceCurrency: z.string(),
                price: z.number().nonnegative(),
              }),
            ),
          }),
        ),
      })
      .parse(result);
    // Never invent FX or promise shipping beyond the artist's explicit budget.
    // Account rates stay transient; only the chosen product code is persisted.
    const choices = parsed.products.flatMap((p) =>
      p.totalPrice
        .filter((t) => t.priceCurrency === "USD")
        .map((t) => ({ code: p.productCode, cents: Math.ceil(t.price * 100) })),
    );
    choices.sort((a, b) => a.cents - b.cents);
    return (
      choices.find((c) => c.cents <= parcel.shippingBudget && c.cents < amount)
        ?.code || null
    );
  }
  async shipment(input: {
    orderId: string;
    title: string;
    amount: number;
    receiver: ShippingContact;
    parcel: Parcel;
    service: string;
  }) {
    const p = parcelSchema.parse(input.parcel);
    const receiver = contactSchema.parse(input.receiver);
    const international = receiver.country !== "GT";
    const result = await this.request("/shipments", {
      plannedShippingDateAndTime: plannedPickup(),
      pickup: {
        isRequested: true,
        closeTime: "17:00",
        location: "Studio",
      },
      productCode: input.service,
      accounts: this.accounts(),
      getRateEstimates: false,
      customerDetails: {
        shipperDetails: party(this.config.shipper),
        receiverDetails: party(receiver),
      },
      outputImageProperties: {
        encodingFormat: "pdf",
        imageOptions: [
          { typeCode: "label", templateName: "ECOM26_84_001" },
          ...(international
            ? [
                {
                  typeCode: "invoice",
                  templateName: "COMMERCIAL_INVOICE_P_10",
                  isRequested: true,
                  invoiceType: "commercial",
                },
              ]
            : []),
        ],
      },
      content: {
        packages: packages(p),
        isCustomsDeclarable: international,
        declaredValue: input.amount / 100,
        declaredValueCurrency: "USD",
        description: `Original artwork: ${input.title}`.slice(0, 70),
        incoterm: "DAP",
        unitOfMeasurement: "metric",
        ...(international
          ? {
              exportDeclarations: [
                {
                  lineItems: [
                    {
                      number: 1,
                      description: input.title.slice(0, 70),
                      price: input.amount / 100,
                      quantity: { value: 1, unitOfMeasurement: "PCS" },
                      manufacturerCountry: p.originCountry,
                      commodityCodes: [
                        { typeCode: "outbound", value: p.hsCode },
                      ],
                      weight: { netValue: p.netWeight, grossValue: p.weight },
                      exportReasonType: "permanent",
                    },
                  ],
                  invoice: {
                    number: input.orderId.slice(0, 20),
                    date: new Date().toISOString().slice(0, 10),
                  },
                  exportReasonType: "permanent",
                },
              ],
            }
          : {}),
      },
      customerReferences: [{ value: input.orderId, typeCode: "CU" }],
    });
    return z
      .object({
        shipmentTrackingNumber: z.string().min(1),
        dispatchConfirmationNumber: z.string().optional(),
        documents: z
          .array(
            z.object({
              typeCode: z.string().optional(),
              imageFormat: z.string(),
              content: z.string(),
            }),
          )
          .optional(),
      })
      .parse(result);
  }
  async tracking(number: string) {
    if (!/^\d{10,40}$/.test(number))
      throw new IntegrationError("invalid_tracking_number");
    return this.request(`/shipments/${number}/tracking?levelOfDetail=all`);
  }
}
export function dhlConfigured() {
  return (
    !!process.env.DHL_TEST_USERNAME &&
    !!process.env.DHL_TEST_PASSWORD &&
    !!process.env.DHL_TEST_ACCOUNT &&
    !!process.env.DHL_TEST_SHIPPER_JSON
  );
}
export function dhl() {
  if (process.env.DHL_ENVIRONMENT !== "sandbox")
    throw new IntegrationError("sandbox_only");
  return new DhlSandbox({
    username: process.env.DHL_TEST_USERNAME || "",
    password: process.env.DHL_TEST_PASSWORD || "",
    account: process.env.DHL_TEST_ACCOUNT || "",
    shipper: contactSchema.parse(
      JSON.parse(process.env.DHL_TEST_SHIPPER_JSON || "{}"),
    ),
  });
}
