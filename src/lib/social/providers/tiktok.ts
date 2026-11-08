import { SocialError } from "../types.ts";
import type { SocialAdapter } from "./contract.ts";
const restricted = () =>
  new SocialError(
    "policy_restricted",
    "TikTok Direct Post excludes private account-management utilities. Export original media and finish posting in TikTok. Upload-to-inbox needs separately approved product access.",
    403,
  );
export const tiktokAdapter: SocialAdapter = {
  platform: "tiktok",
  async identity() {
    throw restricted();
  },
  async step() {
    throw restricted();
  },
  async reconcile() {
    return null;
  },
  async metrics() {
    return [];
  },
};
