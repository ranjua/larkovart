import { z } from "zod";
import { customerConfig } from "@/lib/customer/config";
import { customerServer, customerSession } from "@/lib/customer/server";
import { savedIds, saveItem } from "@/lib/customer/saved";
import { artworks } from "@/lib/store";
import { sameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
async function handle(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/"),
      config = customerConfig();
    if (request.method !== "GET" && !sameOrigin(request))
      return Response.json({ error: "unauthorized" }, { status: 403, headers });
    const session = await customerSession(request.headers),
      user = session?.user;
    if (request.method === "GET" && path === "state") {
      const catalog = (await artworks()).map((a) => ({
        id: a.id,
        title: a.title,
        image: a.originalImage || a.image,
        medium: a.medium,
        width: a.width,
        height: a.height,
        price: a.price,
        status: a.status,
        category: a.category,
      }));
      const saved =
        user && user.emailVerified
          ? await savedIds(customerServer().client, user.id)
          : null;
      const providers = user
        ? (
            await customerServer().client.execute({
              sql: "SELECT providerId FROM customer_account WHERE userId=?",
              args: [user.id],
            })
          ).rows.map((r) => String(r.providerId))
        : [];
      return Response.json(
        {
          catalog,
          saved,
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                twoFactorEnabled: user.twoFactorEnabled || false,
                providers,
              }
            : null,
          config: {
            email: config.emailReady,
            google: config.googleReady,
            origin: config.baseURL || null,
          },
        },
        { headers },
      );
    }
    if (!user || !user.emailVerified)
      return Response.json(
        { error: "sign_in_required" },
        { status: 401, headers },
      );
    if (request.method === "POST" && path === "saved") {
      const body = await request.text();
      if (body.length > 8192)
        return Response.json({ error: "too_large" }, { status: 413, headers });
      const input = z
        .object({
          kind: z.enum(["favorite", "cart"]),
          artworkId: z.string().regex(/^[a-z0-9-]{1,80}$/),
          present: z.boolean(),
        })
        .strict()
        .parse(JSON.parse(body));
      if (input.present) {
        const a = (await artworks()).find((a) => a.id === input.artworkId);
        if (!a || (input.kind === "cart" && a.status !== "available"))
          return Response.json(
            { error: "unavailable" },
            { status: 409, headers },
          );
      }
      return Response.json(
        {
          saved: await saveItem(
            customerServer().client,
            user.id,
            input.kind,
            input.artworkId,
            input.present,
          ),
        },
        { headers },
      );
    }
    if (request.method === "POST" && path === "merge") {
      const raw = await request.text();
      if (raw.length > 8192)
        return Response.json({ error: "too_large" }, { status: 413, headers });
      const input = z
        .object({
          favorites: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(40),
          cart: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(40),
        })
        .strict()
        .parse(JSON.parse(raw));
      const catalog = await artworks();
      for (const id of new Set(input.favorites))
        if (catalog.some((a) => a.id === id))
          await saveItem(
            customerServer().client,
            user.id,
            "favorite",
            id,
            true,
          );
      for (const id of new Set(input.cart))
        if (catalog.some((a) => a.id === id && a.status === "available"))
          await saveItem(customerServer().client, user.id, "cart", id, true);
      return Response.json(
        { saved: await savedIds(customerServer().client, user.id) },
        { headers },
      );
    }
    return Response.json({ error: "not_found" }, { status: 404, headers });
  } catch (e) {
    return Response.json(
      {
        error:
          e && typeof e === "object" && "issues" in e
            ? "invalid_input"
            : "temporarily_unavailable",
      },
      {
        status: e && typeof e === "object" && "issues" in e ? 422 : 503,
        headers,
      },
    );
  }
}
export const GET = handle;
export const POST = handle;
