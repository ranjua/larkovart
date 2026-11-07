import type { Parcel, ShippingContact } from "./integrations/dhl.ts";
export type CourierId = "forza" | "guatex" | "dhl" | "fedex" | "envia";
export type ShippingQuote = {
  carrier: CourierId;
  service: string;
  amountCents: number;
  currency: "USD" | "GTQ";
};
export type ShipmentDocument = {
  typeCode?: string;
  imageFormat: string;
  content: string;
};
export type Shipment = {
  carrier?: CourierId;
  shipmentTrackingNumber: string;
  dispatchConfirmationNumber?: string;
  documents?: ShipmentDocument[];
  pickupState?: "confirmed" | "review_required";
};
export type ShipmentInput = {
  orderId: string;
  title: string;
  amount: number;
  receiver: ShippingContact;
  parcel: Parcel;
  service: string;
  checkpoint?: (shipment: Shipment) => Promise<void>;
};
export interface CourierConnection {
  includedService(
    receiver: ShippingContact,
    parcel: Parcel,
    amount: number,
  ): Promise<string | null>;
  shipment(input: ShipmentInput): Promise<Shipment>;
  tracking(number: string): Promise<unknown>;
}
export interface CourierAdapter {
  id: CourierId;
  supports(country: string): boolean;
  quotes(
    receiver: ShippingContact,
    parcel: Parcel,
    amount: number,
  ): Promise<ShippingQuote[]>;
  shipment(input: ShipmentInput): Promise<Shipment>;
  tracking(number: string): Promise<unknown>;
}
