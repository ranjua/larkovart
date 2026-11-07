import { z } from "zod";
import {
  contactSchema,
  parcelSchema,
  plannedPickup,
  type Parcel,
  type ShippingContact,
} from "./dhl.ts";
import { IntegrationError } from "./recurrente.ts";
import type {
  CourierAdapter,
  ShipmentInput,
  Shipment,
  ShippingQuote,
} from "../shipping-types.ts";
const base = "https://apis-sandbox.fedex.com";
const address = (c: ShippingContact) => ({
  streetLines: [c.address],
  city: c.city,
  postalCode: c.postal,
  countryCode: c.country,
  ...(c.region ? { stateOrProvinceCode: c.region } : {}),
});
const party = (c: ShippingContact) => ({
  address: address(c),
  contact: {
    personName: c.name,
    companyName: c.name,
    phoneNumber: c.phone,
    emailAddress: c.email,
  },
});
const pack = (p: Parcel) => [
  {
    groupPackageCount: 1,
    weight: { units: "KG", value: p.weight },
    dimensions: {
      units: "CM",
      length: Math.ceil(p.length),
      width: Math.ceil(p.width),
      height: Math.ceil(p.height),
    },
  },
];
export class FedexSandbox implements CourierAdapter {
  readonly id = "fedex" as const;
  private config: {
    clientId: string;
    clientSecret: string;
    account: string;
    shipper: ShippingContact;
  };
  private transport: typeof fetch;
  private token?: { value: string; expires: number };
  private tokenRequest?: Promise<string>;
  constructor(config: FedexSandbox["config"], transport: typeof fetch = fetch) {
    if (
      !config.clientId ||
      !config.clientSecret ||
      !/^\d{9}$/.test(config.account)
    )
      throw new IntegrationError("fedex_test_credentials_required");
    this.config = { ...config, shipper: contactSchema.parse(config.shipper) };
    this.transport = transport;
    if (this.config.shipper.country !== "GT")
      throw new IntegrationError("guatemala_origin_required");
  }
  supports(country: string) {
    return country !== "GT";
  }
  private async accessToken() {
    if (this.token && this.token.expires > Date.now() + 60_000)
      return this.token.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      const response = await this.transport(`${base}/oauth/token`, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });
      if (!response.ok) throw new IntegrationError("fedex_sandbox_auth_failed");
      const result = z
        .object({
          access_token: z.string().min(1),
          expires_in: z.number().positive(),
        })
        .parse(await response.json());
      this.token = {
        value: result.access_token,
        expires: Date.now() + result.expires_in * 1000,
      };
      return result.access_token;
    })();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }
  private async request(path: string, body: unknown) {
    const token = await this.accessToken();
    const response = await this.transport(`${base}${path}`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-locale": "en_US",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new IntegrationError(`fedex_http_${response.status}`);
    return response.json();
  }
  private shipRequest(input: ShipmentInput) {
    const p = parcelSchema.parse(input.parcel);
    contactSchema.parse(input.receiver);
    if (!this.supports(input.receiver.country))
      throw new IntegrationError("fedex_destination_unavailable");
    return {
      accountNumber: { value: this.config.account },
      labelResponseOptions: "LABEL",
      requestedShipment: {
        shipper: party(this.config.shipper),
        recipients: [party(input.receiver)],
        shipDatestamp: plannedPickup().slice(0, 10),
        pickupType: "CONTACT_FEDEX_TO_SCHEDULE",
        serviceType: input.service,
        packagingType: "YOUR_PACKAGING",
        shippingChargesPayment: { paymentType: "SENDER" },
        totalPackageCount: 1,
        labelSpecification: {
          imageType: "PDF",
          labelStockType: "PAPER_85X11_TOP_HALF_LABEL",
        },
        requestedPackageLineItems: pack(p),
        customsClearanceDetail: {
          dutiesPayment: { paymentType: "RECIPIENT" },
          isDocumentOnly: false,
          commodities: [
            {
              description: input.title.slice(0, 70),
              countryOfManufacture: p.originCountry,
              quantity: 1,
              quantityUnits: "PCS",
              harmonizedCode: p.hsCode,
              weight: { units: "KG", value: p.netWeight },
              unitPrice: { amount: input.amount / 100, currency: "USD" },
              customsValue: { amount: input.amount / 100, currency: "USD" },
            },
          ],
          commercialInvoice: { shipmentPurpose: "SOLD" },
        },
        shippingDocumentSpecification: {
          shippingDocumentTypes: ["COMMERCIAL_INVOICE"],
          commercialInvoiceDetail: {
            documentFormat: { docType: "PDF", stockType: "PAPER_LETTER" },
          },
        },
      },
    };
  }
  async quotes(
    receiver: ShippingContact,
    parcel: Parcel,
    amount: number,
  ): Promise<ShippingQuote[]> {
    if (!this.supports(receiver.country)) return [];
    contactSchema.parse(receiver);
    parcelSchema.parse(parcel);
    const result = await this.request("/rate/v1/rates/quotes", {
      accountNumber: { value: this.config.account },
      requestedShipment: {
        shipper: { address: address(this.config.shipper) },
        recipient: { address: address(receiver) },
        shipDateStamp: plannedPickup().slice(0, 10),
        pickupType: "CONTACT_FEDEX_TO_SCHEDULE",
        packagingType: "YOUR_PACKAGING",
        preferredCurrency: "USD",
        rateRequestType: ["ACCOUNT", "PREFERRED"],
        requestedPackageLineItems: pack(parcel),
      },
    });
    const data = z
      .object({
        output: z.object({
          rateReplyDetails: z.array(
            z.object({
              serviceType: z.string(),
              ratedShipmentDetails: z.array(
                z.object({
                  totalNetCharge: z.number().nonnegative(),
                  currency: z.string(),
                }),
              ),
            }),
          ),
        }),
      })
      .parse(result);
    const candidates = data.output.rateReplyDetails
      .flatMap((r) =>
        r.ratedShipmentDetails
          .filter((d) => d.currency === "USD")
          .map((d) => ({
            carrier: this.id,
            service: r.serviceType,
            amountCents: Math.ceil(d.totalNetCharge * 100),
            currency: "USD" as const,
          })),
      )
      .sort((a, b) => a.amountCents - b.amountCents);
    // FedEx states that a rate quote alone does not validate service availability.
    // Validate the cheapest eligible shipment before enabling its checkout option.
    for (const quote of candidates.filter(
      (q) => q.amountCents <= parcel.shippingBudget && q.amountCents < amount,
    )) {
      const body = this.shipRequest({
        orderId: "preflight",
        title: "Original artwork",
        receiver,
        parcel,
        amount,
        service: quote.service,
      });
      const { labelResponseOptions: _, ...validation } = body;
      try {
        const validated = await this.request(
          "/ship/v1/shipments/packages/validate",
          validation,
        );
        const result = z
          .object({
            output: z
              .object({
                alerts: z
                  .array(
                    z
                      .object({ alertType: z.string().optional() })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough(),
          })
          .parse(validated);
        if (!result.output.alerts?.some((a) => a.alertType === "ERROR"))
          return [quote];
      } catch {
        /* Try another read-only validation, never another shipment write. */
      }
    }
    return [];
  }
  async shipment(input: ShipmentInput): Promise<Shipment> {
    const result = await this.request(
      "/ship/v1/shipments",
      this.shipRequest(input),
    );
    const data = z
      .object({
        output: z.object({
          transactionShipments: z
            .array(
              z.object({
                pieceResponses: z
                  .array(
                    z.object({
                      trackingNumber: z.string().min(1),
                      packageDocuments: z
                        .array(
                          z.object({
                            contentType: z.string().optional(),
                            docType: z.string().optional(),
                            encodedLabel: z.string().optional(),
                          }),
                        )
                        .optional(),
                    }),
                  )
                  .min(1),
              }),
            )
            .min(1),
        }),
      })
      .parse(result);
    const piece = data.output.transactionShipments[0].pieceResponses[0];
    let shipment: Shipment = {
      carrier: this.id,
      shipmentTrackingNumber: piece.trackingNumber,
      documents: piece.packageDocuments
        ?.filter(
          (d) =>
            d.encodedLabel &&
            (d.docType === "PDF" || d.contentType === "LABEL"),
        )
        .map((d) => ({
          typeCode: "label",
          imageFormat: "PDF",
          content: d.encodedLabel!,
        })),
      pickupState: "review_required",
    };
    await input.checkpoint?.(shipment);
    try {
      const date = `${plannedPickup().slice(0, 10)}T10:00:00-06:00`;
      const result = await this.request("/pickup/v1/pickups", {
        associatedAccountNumber: { value: this.config.account },
        originDetail: {
          pickupLocation: party(this.config.shipper),
          readyDateTimestamp: date,
          customerCloseTime: "17:00:00",
        },
        carrierCode: "FDXE",
        packageCount: 1,
        totalWeight: { units: "KG", value: input.parcel.weight },
      });
      const p = z
        .object({
          output: z.object({ pickupConfirmationCode: z.string().min(1) }),
        })
        .parse(result);
      shipment = {
        ...shipment,
        dispatchConfirmationNumber: p.output.pickupConfirmationCode,
        pickupState: "confirmed",
      };
    } catch {
      /* Preserve the label if pickup needs review; never recreate it. */
    }
    return shipment;
  }
  async tracking(number: string) {
    if (!/^\d{10,40}$/.test(number))
      throw new IntegrationError("invalid_tracking_number");
    return this.request("/track/v1/trackingnumbers", {
      includeDetailedScans: true,
      trackingInfo: [{ trackingNumberInfo: { trackingNumber: number } }],
    });
  }
}
export function fedexConfigured() {
  return (
    [
      "FEDEX_TEST_CLIENT_ID",
      "FEDEX_TEST_CLIENT_SECRET",
      "FEDEX_TEST_ACCOUNT",
    ].every((k) => !!process.env[k]) &&
    !!(
      process.env.SHIPPING_TEST_SHIPPER_JSON ||
      process.env.DHL_TEST_SHIPPER_JSON
    )
  );
}
export function fedex() {
  if (process.env.FEDEX_ENVIRONMENT !== "sandbox")
    throw new IntegrationError("sandbox_only");
  return new FedexSandbox({
    clientId: process.env.FEDEX_TEST_CLIENT_ID || "",
    clientSecret: process.env.FEDEX_TEST_CLIENT_SECRET || "",
    account: process.env.FEDEX_TEST_ACCOUNT || "",
    shipper: contactSchema.parse(
      JSON.parse(
        process.env.SHIPPING_TEST_SHIPPER_JSON ||
          process.env.DHL_TEST_SHIPPER_JSON ||
          "{}",
      ),
    ),
  });
}
