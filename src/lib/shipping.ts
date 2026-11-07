import { envia, enviaConfigured } from "./integrations/envia.ts";
import { dhl, dhlConfigured } from "./integrations/dhl.ts";
import { forza, forzaConfigured } from "./integrations/forza.ts";
import { fedex, fedexConfigured } from "./integrations/fedex.ts";
import { IntegrationError } from "./integrations/recurrente.ts";
import type {
  CourierAdapter,
  CourierConnection,
  CourierId,
  ShipmentInput,
} from "./shipping-types.ts";

export function shippingStatus() {
  return [
    {
      id: "envia",
      name: "Envia · Guatemala & international",
      configured: enviaConfigured(),
    },
    { id: "forza", name: "Forza · Guatemala", configured: forzaConfigured() },
    {
      id: "dhl",
      name: "DHL Express · international",
      configured: dhlConfigured(),
    },
    {
      id: "fedex",
      name: "FedEx · international",
      configured: fedexConfigured(),
    },
    {
      id: "guatex",
      name: "Guatex · awaiting API documentation",
      configured: false,
    },
  ];
}
export const shippingConfigured = () =>
  shippingStatus().some((p) => p.configured);
export function courierAdapter(id: CourierId): CourierAdapter {
  if (id === "envia") return envia();
  if (id === "forza") return forza();
  if (id === "fedex") return fedex();
  if (id === "dhl") {
    const client = dhl();
    return {
      id,
      supports: (country) => country !== "GT",
      quotes: (...args) => client.quoteOptions(...args),
      shipment: async (input) => ({
        ...(await client.shipment(input)),
        carrier: "dhl",
      }),
      tracking: (number) => client.tracking(number),
    };
  }
  throw new IntegrationError("guatex_api_access_required");
}
export class ShippingBroker implements CourierConnection {
  private adapters: CourierAdapter[];
  private testFx?: number;
  constructor(adapters: CourierAdapter[], testFx?: number) {
    this.adapters = adapters;
    this.testFx = testFx;
  }
  async includedService(
    ...args: Parameters<CourierConnection["includedService"]>
  ) {
    const [receiver, parcel, amount] = args;
    const results = await Promise.allSettled(
      this.adapters
        .filter((a) => a.supports(receiver.country))
        .map((a) => a.quotes(...args)),
    );
    const quotes = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .flatMap((q) => {
        const cents =
          q.currency === "USD"
            ? q.amountCents
            : this.testFx && this.testFx > 0
              ? Math.ceil(q.amountCents / this.testFx)
              : Infinity;
        return Number.isFinite(cents) &&
          cents <= parcel.shippingBudget &&
          cents < amount
          ? [{ ...q, cents }]
          : [];
      })
      .sort((a, b) => a.cents - b.cents || a.carrier.localeCompare(b.carrier));
    return quotes[0] ? `${quotes[0].carrier}:${quotes[0].service}` : null;
  }
  async shipment(input: ShipmentInput) {
    const [id, ...service] = input.service.split(":");
    const adapter = this.adapters.find((a) => a.id === id);
    if (
      !adapter ||
      !service.length ||
      !adapter.supports(input.receiver.country)
    )
      throw new IntegrationError("courier_unavailable");
    // Never fail over once a write begins: a timeout may hide a successful label.
    return {
      ...(await adapter.shipment({ ...input, service: service.join(":") })),
      carrier: adapter.id,
    };
  }
  async tracking() {
    throw new IntegrationError("tracking_carrier_required");
  }
}
export function shipping() {
  const adapters: CourierAdapter[] = [];
  for (const p of shippingStatus().filter((p) => p.configured)) {
    try {
      adapters.push(courierAdapter(p.id as CourierId));
    } catch {
      /* Invalid configuration must not block other couriers. */
    }
  }
  const fx = Number(process.env.TEST_GTQ_PER_USD);
  return new ShippingBroker(
    adapters,
    Number.isFinite(fx) && fx > 0 ? fx : undefined,
  );
}
