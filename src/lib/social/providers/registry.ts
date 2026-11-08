import type { Platform } from "../types.ts";
import { instagramAdapter } from "./instagram.ts";
import { facebookAdapter } from "./facebook.ts";
import { pinterestAdapter } from "./pinterest.ts";
import { tiktokAdapter } from "./tiktok.ts";
export const adapterFor = (platform: Platform) =>
  ({
    instagram: instagramAdapter,
    facebook: facebookAdapter,
    pinterest: pinterestAdapter,
    tiktok: tiktokAdapter,
  })[platform];
