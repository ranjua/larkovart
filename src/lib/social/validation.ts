import { z } from "zod";
import { platforms } from "./types.ts";
export const idSchema = z.string().uuid();
export const platformSchema = z.enum(platforms);
export const requestIdSchema = z.string().uuid();
export const optionsSchema = z.discriminatedUnion("provider", [
  z
    .object({
      provider: z.literal("instagram"),
      altText: z.string().max(1000).default(""),
    })
    .strict(),
  z
    .object({
      provider: z.literal("facebook"),
      link: z.string().url().max(2000).nullable().default(null),
    })
    .strict(),
  z
    .object({
      provider: z.literal("pinterest"),
      title: z.string().max(100).default(""),
      altText: z.string().max(500).default(""),
      boardId: z.string().regex(/^\d*$/).max(80).default(""),
      sectionId: z.string().regex(/^\d+$/).max(80).nullable().default(null),
    })
    .strict(),
  z
    .object({
      provider: z.literal("tiktok"),
      title: z.string().max(2200).default(""),
      disclosure: z.boolean().default(false),
    })
    .strict(),
]);
export const targetInput = z
  .object({
    provider: platformSchema,
    connectionId: idSchema.nullable().default(null),
    deliveryMode: z
      .enum(["manual", "api_public", "api_test", "api_inbox"])
      .default("manual"),
    format: z.enum(["image", "carousel", "video", "text"]).default("image"),
    caption: z.string().trim().max(63206),
    options: optionsSchema,
    assetIds: z.array(idSchema).max(10).default([]),
    linkUrl: z.string().url().max(2000).nullable().default(null),
    scheduledAt: z.string().datetime({ offset: true }).nullable().default(null),
    timezone: z.string().max(80).default("America/Guatemala"),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.provider !== v.options.provider)
      ctx.addIssue({
        code: "custom",
        message: "Options must match the platform.",
        path: ["options"],
      });
    try {
      new Intl.DateTimeFormat("en", { timeZone: v.timezone });
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Choose a valid IANA timezone.",
        path: ["timezone"],
      });
    }
  });
export const createPostSchema = z
  .object({
    requestId: requestIdSchema,
    title: z.string().trim().min(1).max(150),
    artworkId: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .nullable()
      .default(null),
    campaign: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9-]*$/)
      .max(80)
      .default(""),
    intent: z
      .enum(["availability", "portfolio", "process", "announcement"])
      .default("availability"),
    targets: z.array(targetInput).min(1).max(4),
  })
  .strict();
export const updateTargetSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    target: targetInput,
  })
  .strict();
export const revisionSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
export const manualResultSchema = revisionSchema
  .extend({ permalink: z.string().url().max(2000).nullable().default(null) })
  .strict();
export const uploadCompleteSchema = z
  .object({
    assetId: idSchema,
    public_id: z.string().max(100),
    version: z.number().int().positive(),
    signature: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict();
export function defaultOptions(provider: (typeof platforms)[number]) {
  return optionsSchema.parse({ provider });
}
