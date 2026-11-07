import { createHmac, createHash, timingSafeEqual } from "node:crypto";
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

const base = "https://sandbox.apicore.forzadelivery.io:40467";
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bcity\b|\bciudad de\b/g, "")
    .replace(/[^a-z0-9]/g, "");
export class ForzaSandbox implements CourierAdapter {
  readonly id = "forza" as const;
  private config: {
    codApp: string;
    secret: string;
    merchantId: number;
    pickupPointId: number;
    shipper: ShippingContact;
  };
  private transport: typeof fetch;
  private towns?: Promise<{ code: string; city: string; region: string }[]>;
  constructor(config: ForzaSandbox["config"], transport: typeof fetch = fetch) {
    if (
      !config.codApp ||
      config.secret.length < 16 ||
      !Number.isSafeInteger(config.merchantId) ||
      config.merchantId <= 0 ||
      !Number.isSafeInteger(config.pickupPointId) ||
      config.pickupPointId <= 0
    )
      throw new IntegrationError("forza_test_credentials_required");
    this.config = { ...config, shipper: contactSchema.parse(config.shipper) };
    this.transport = transport;
    if (this.config.shipper.country !== "GT")
      throw new IntegrationError("guatemala_origin_required");
  }
  supports(country: string) {
    return country === "GT";
  }
  private async call(method: string, params: Record<string, unknown>) {
    const raw = JSON.stringify({ Method: method, Params: params });
    const signature = createHmac("sha256", this.config.secret)
      .update(raw)
      .digest("base64");
    const response = await this.transport(`${base}/Ecommerce/${method}`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", LauValue: signature },
      body: JSON.stringify({
        CodApp: this.config.codApp,
        PayLoad: Buffer.from(raw).toString("base64"),
      }),
    });
    if (!response.ok)
      throw new IntegrationError(`forza_http_${response.status}`);
    const envelope = z
      .object({ CodApp: z.string().optional(), PayLoad: z.string() })
      .parse(await response.json());
    if (envelope.CodApp && envelope.CodApp !== this.config.codApp)
      throw new IntegrationError("forza_account_mismatch");
    const decoded = Buffer.from(envelope.PayLoad, "base64").toString("utf8");
    const returnedSignature = response.headers.get("lauvalue");
    if (returnedSignature) {
      const expected = createHmac("sha256", this.config.secret)
        .update(decoded)
        .digest();
      const actual = Buffer.from(returnedSignature, "base64");
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        throw new IntegrationError("forza_signature_mismatch");
    }
    const result = z
      .object({ Method: z.string(), StatusCode: z.number() })
      .passthrough()
      .parse(JSON.parse(decoded));
    if (
      result.StatusCode !== 200 ||
      result.Method.toLowerCase() !== method.toLowerCase()
    )
      throw new IntegrationError("forza_request_rejected");
    return result;
  }
  private async township(contact: ShippingContact) {
    this.towns ||= this.call("GetListTownshipByHeaderCode", {
      HeaderCodeTownship: -1,
      HeaderCode: -1,
      IdCountry: "GT",
    })
      .then((result) => {
        const data = z
          .object({
            ObjectValue: z.object({
              TownshipByHeaderCodes: z.array(
                z.object({
                  HeaderCodeTownship: z.string(),
                  TownshipName: z.string(),
                  ProvinceName: z.string(),
                }),
              ),
            }),
          })
          .parse(result);
        return data.ObjectValue.TownshipByHeaderCodes.map((t) => ({
          code: t.HeaderCodeTownship,
          city: normalize(t.TownshipName),
          region: normalize(t.ProvinceName),
        }));
      })
      .catch((error) => {
        this.towns = undefined;
        throw error;
      });
    const matches = (await this.towns).filter(
      (t) =>
        t.city === normalize(contact.city) &&
        (!contact.region || t.region === normalize(contact.region)),
    );
    if (matches.length !== 1)
      throw new IntegrationError("forza_municipality_unresolved");
    return matches[0].code;
  }
  private packages(p: Parcel, amount: number, description: string) {
    return [
      {
        length: Math.ceil(p.length),
        width: Math.ceil(p.width),
        height: Math.ceil(p.height),
        weight: Math.ceil(p.weight * 2.2046226218),
        amount: (amount / 100).toFixed(2),
        currency: "USD",
        fragil: "true",
        description: description.slice(0, 50),
      },
    ];
  }
  async quotes(
    receiver: ShippingContact,
    parcel: Parcel,
    amount: number,
  ): Promise<ShippingQuote[]> {
    if (!this.supports(receiver.country)) return [];
    contactSchema.parse(receiver);
    parcelSchema.parse(parcel);
    const [source, destination] = await Promise.all([
      this.township(this.config.shipper),
      this.township(receiver),
    ]);
    const result = await this.call("GetShippingRatesByHeaderCode", {
      HeaderCodeSource: source,
      HeaderCodeDestiny: destination,
      DateOfSale: plannedPickup().slice(0, 19).replace("T", " "),
      IdCountry: "GT",
      parcels: this.packages(parcel, amount, "Original artwork"),
      TotalWeight: String(Math.ceil(parcel.weight * 2.2046226218)),
      TotalValue: (amount / 100).toFixed(2),
      Currency: "USD",
      CountPieces: 1,
      ObjectType: "Original artwork",
      CreditCode: "0",
      IdMerchant: this.config.merchantId,
      CodeOfReferenceSource: this.config.pickupPointId,
      IsInsuarence: false,
      InsuarenceAmount: "0",
    });
    const data = z
      .object({
        ShippingRates: z.array(
          z.object({
            ServiceShortName: z.string(),
            Price: z.union([z.string(), z.number()]),
            Currency: z.string(),
          }),
        ),
      })
      .parse(result);
    return data.ShippingRates.filter(
      (r) => r.ServiceShortName === "STD",
    ).flatMap((r) => {
      const price = Number(r.Price);
      const currency =
        r.Currency === "USD"
          ? "USD"
          : ["GTQ", "(Q.)", "Q"].includes(r.Currency)
            ? "GTQ"
            : null;
      return Number.isFinite(price) && price >= 0 && currency
        ? [
            {
              carrier: this.id,
              service: r.ServiceShortName,
              amountCents: Math.ceil(price * 100),
              currency,
            },
          ]
        : [];
    });
  }
  async shipment(input: ShipmentInput): Promise<Shipment> {
    if (!this.supports(input.receiver.country) || input.service !== "STD")
      throw new IntegrationError("forza_service_unavailable");
    const [source, destination] = await Promise.all([
      this.township(this.config.shipper),
      this.township(input.receiver),
    ]);
    const address = (c: ShippingContact, code: string) => ({
      HeaderCodeTownship: code,
      name: c.name,
      contact: c.name,
      phone: c.phone,
      email: c.email,
      address1: c.address,
      address2: "",
      city: c.city,
    });
    const result = await this.call("GetServiceByHeaderCodeRequest", {
      DateOfSale: new Date().toISOString().slice(0, 19).replace("T", " "),
      ContentDescription: input.title.slice(0, 50),
      from_address: address(this.config.shipper, source),
      to_address: address(input.receiver, destination),
      parcels: this.packages(input.parcel, input.amount, input.title),
      Ticket_Number: createHash("sha256")
        .update(input.orderId)
        .digest("hex")
        .slice(0, 7),
      IdInternalOrderRef: input.orderId,
      IdCountry: "GT",
      idDeliveryOption: "1",
      descriptionDelivery: "DOMICILIO",
      CodeOfReference: String(this.config.pickupPointId),
      CountPieces: 1,
      TotalWeight: String(Math.ceil(input.parcel.weight * 2.2046226218)),
      TotalValue: (input.amount / 100).toFixed(2),
      Currency: "USD",
      ProductInsuranceAmount: 0,
      InsuranceCurrency: "USD",
      Collected: false,
      COD: { CashOnDelivery: false },
      BillAccountNumber: "",
      PaymentMethod: "",
      Note: "Original artwork — handle with care",
    });
    const data = z
      .object({
        ObjectValue: z
          .array(
            z.object({
              TrackingNumber: z.string().regex(/^FD\d+$/),
              PDF: z.string().min(1),
            }),
          )
          .min(1),
      })
      .parse(result);
    let shipment: Shipment = {
      carrier: this.id,
      shipmentTrackingNumber: data.ObjectValue[0].TrackingNumber,
      documents: [
        {
          typeCode: "label",
          imageFormat: "PDF",
          content: data.ObjectValue[0].PDF,
        },
      ],
      pickupState: "review_required",
    };
    await input.checkpoint?.(shipment);
    const day = plannedPickup().slice(0, 10);
    try {
      const pickup = await this.call("SetPickupServiceByIntegration", {
        CodeOfReference: this.config.pickupPointId,
        StartDate: `${day} 10:00:00`,
        EndDate: `${day} 15:00:00`,
        QuantityOfPieces: 1,
        TypeVehicleId: 2,
      });
      const p = z
        .object({
          ObjectValue: z.object({
            IdResult: z.literal(200),
            ServiceId: z.number().int().positive(),
          }),
        })
        .parse(pickup);
      shipment = {
        ...shipment,
        dispatchConfirmationNumber: String(p.ObjectValue.ServiceId),
        pickupState: "confirmed",
      };
    } catch {
      /* Keep the label and require pickup review; never recreate it. */
    }
    return shipment;
  }
  async tracking(number: string) {
    if (!/^FD\d+$/.test(number))
      throw new IntegrationError("invalid_tracking_number");
    return this.call("GetTrackOrderDetail", {
      GuideSerie: "FD",
      GuideNumber: Number(number.slice(2)),
    });
  }
}
export function forzaConfigured() {
  return (
    [
      "FORZA_TEST_CODAPP",
      "FORZA_TEST_SECRET",
      "FORZA_TEST_MERCHANT_ID",
      "FORZA_TEST_PICKUP_POINT_ID",
    ].every((k) => !!process.env[k]) &&
    !!(
      process.env.SHIPPING_TEST_SHIPPER_JSON ||
      process.env.DHL_TEST_SHIPPER_JSON
    )
  );
}
export function forza() {
  if (process.env.FORZA_ENVIRONMENT !== "sandbox")
    throw new IntegrationError("sandbox_only");
  return new ForzaSandbox({
    codApp: process.env.FORZA_TEST_CODAPP || "",
    secret: process.env.FORZA_TEST_SECRET || "",
    merchantId: Number(process.env.FORZA_TEST_MERCHANT_ID),
    pickupPointId: Number(process.env.FORZA_TEST_PICKUP_POINT_ID),
    shipper: contactSchema.parse(
      JSON.parse(
        process.env.SHIPPING_TEST_SHIPPER_JSON ||
          process.env.DHL_TEST_SHIPPER_JSON ||
          "{}",
      ),
    ),
  });
}
