import { hash } from "./crypto.ts";
export function campaignUrl(
  url: string,
  provider: string,
  targetId: string,
  campaign: string,
) {
  const u = new URL(url);
  for (const [k, v] of Object.entries({
    utm_source: provider,
    utm_medium: "organic_social",
    utm_campaign: hash(campaign || "originals").slice(0, 12),
    utm_content: targetId,
  })) {
    if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  }
  return u.href;
}
