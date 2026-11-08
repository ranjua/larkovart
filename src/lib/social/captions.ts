import { mediumName, type Artwork } from "../catalog.ts";
import type { Intent } from "./types.ts";
export function captionFor(a: Artwork, intent: Intent) {
  const facts = `${a.title} — ${mediumName(a, "es")}, ${a.width} × ${a.height} cm.`;
  const unavailable =
    a.status === "sold"
      ? "Obra vendida · en una colección privada."
      : a.status === "reserved"
        ? "Obra reservada · no disponible."
        : !a.published
          ? "Obra del portafolio · no disponible para compra."
          : "Pintura original de Yulia Larkova.";
  return `${facts}\n\n${intent === "availability" ? `Obra original · US$${(a.price / 100).toFixed(2)}. Escribe para confirmar disponibilidad y condiciones de envío para tu destino.` : unavailable}\n\nOriginal artwork by Yulia Larkova, created in Guatemala. ${intent === "availability" ? "Inquire for availability and delivery details." : a.status === "sold" ? "Sold · private collection." : "Artist portfolio."}`;
}
