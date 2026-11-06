import { z } from "zod";
import { locales } from "./i18n.ts";
export const imageSchema = z
  .string()
  .max(5_600_000)
  .refine(
    (s) =>
      /^\/artworks\/[\w-]+\.(jpg|jpeg|png|webp)$/.test(s) ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(s),
    "Use a local artwork image or an uploaded JPEG, PNG or WebP.",
  );
export const artworkSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  title: z.string().trim().min(1).max(150),
  category: z.enum(["paintings", "drawings", "sculptures"]),
  image: imageSchema,
  medium: z.enum(["oil", "acrylic", "mixed", "charcoal", "bronze", "other"]),
  width: z.number().positive().max(80),
  height: z.number().positive().max(80),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  price: z.number().int().min(7500).max(100000),
  status: z.enum(["available", "sold"]),
  published: z.boolean(),
  descriptions: z.record(z.enum(locales), z.string().trim().min(1).max(2000)),
});
