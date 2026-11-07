import { z } from "zod";
import { countries } from "./countries.ts";
export const buyerSchema = z.object({
  artworkId: z.string().min(1).max(80),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(180),
  country: z.string().refine((c) => c === "OTHER" || countries.includes(c)),
  address: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(100),
  postal: z.string().trim().min(1).max(20),
  phone: z.string().max(25).optional(),
  region: z.string().max(35).optional(),
});
