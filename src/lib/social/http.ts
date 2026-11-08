import { SocialError } from "./types.ts";
export class ProviderError extends SocialError {
  uncertain: boolean;
  constructor(
    code: string,
    message: string,
    status: number,
    retryable = false,
    uncertain = false,
  ) {
    super(code, message, status, retryable);
    this.uncertain = uncertain;
  }
}
const hosts = new Set([
  "graph.instagram.com",
  "api.instagram.com",
  "graph.facebook.com",
  "api.pinterest.com",
  "open.tiktokapis.com",
  "rupload.facebook.com",
]);
export async function providerRequest(
  url: URL | string,
  token: string | null,
  options: {
    method?: string;
    body?: Record<string, unknown> | URLSearchParams;
    fetcher?: typeof fetch;
    basic?: boolean;
    oauth?: boolean;
    headers?: Record<string, string>;
  } = {},
) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    !hosts.has(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  )
    throw new SocialError(
      "provider_rejected",
      "Provider destination is not allowed.",
      422,
    );
  const method = options.method || "GET",
    write = method !== "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token)
    headers.Authorization = `${options.basic ? "Basic" : options.oauth ? "OAuth" : "Bearer"} ${token}`;
  Object.assign(headers, options.headers || {});
  let body: string | undefined;
  if (options.body instanceof URLSearchParams) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = options.body.toString();
  } else if (options.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  try {
    const r = await (options.fetcher || fetch)(u, {
      method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!r.ok) {
      if (r.status === 401 || r.status === 403)
        throw new ProviderError(
          r.status === 401 ? "account_unavailable" : "permission_missing",
          "The platform declined access. Reconnect and verify permissions.",
          403,
        );
      if (r.status === 429)
        throw new ProviderError(
          "rate_limited",
          "The platform rate limit was reached. Try later.",
          429,
          true,
        );
      if (r.status >= 500 && write)
        throw new ProviderError(
          "provider_uncertain",
          "The platform may have accepted this write. Reconcile before retrying.",
          502,
          false,
          true,
        );
      throw new ProviderError(
        "provider_rejected",
        "The platform rejected the request. Review the account and media requirements.",
        502,
        !write && r.status >= 500,
      );
    }
    if (Number(r.headers.get("content-length")) > 2_000_000)
      throw new Error("oversized response");
    const reader = r.body?.getReader();
    if (!reader) throw new Error("missing response");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 2_000_000) throw new Error("oversized response");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    if (e instanceof SocialError) throw e;
    throw new ProviderError(
      write ? "provider_uncertain" : "provider_unavailable",
      write
        ? "The platform may have accepted this write. Do not repost blindly."
        : "The platform could not be reached.",
      502,
      !write,
      write,
    );
  }
}
