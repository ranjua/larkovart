import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import { SocialRepository } from "../src/lib/social/repository.ts";
import { seedArtworks, type Artwork } from "../src/lib/catalog.ts";
import {
  createPostSchema,
  defaultOptions,
} from "../src/lib/social/validation.ts";
import { hash } from "../src/lib/social/crypto.ts";
import { imageMetadata } from "../src/lib/social/media.ts";
import { storeConnection, selectConnection } from "../src/lib/social/oauth.ts";
import { scopesFor } from "../src/lib/social/oauth.ts";
import type { Platform, Asset, Credentials } from "../src/lib/social/types.ts";
export async function fixture(production = false) {
  const keys = [
    "SOCIAL_ENVIRONMENT",
    "SOCIAL_PUBLISH_ENABLED",
    "SOCIAL_TEST_WRITES_ENABLED",
    "SOCIAL_ENABLED",
    "SOCIAL_TOKEN_KEY_V1",
    "SOCIAL_TOKEN_KEY_V2",
    "SOCIAL_TOKEN_ACTIVE_KEY",
    "CLOUDINARY_CLOUD_NAME",
    "SOCIAL_ORIGIN",
    "SOCIAL_META_GRAPH_VERSION",
    "SOCIAL_WORKER_MODE",
    "SOCIAL_PUBLIC_STORE_VERIFIED",
    "SOCIAL_STORE_ORIGIN",
  ];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.SOCIAL_ENVIRONMENT = production ? "production" : "development";
  process.env.SOCIAL_PUBLISH_ENABLED = production ? "true" : "false";
  process.env.SOCIAL_TEST_WRITES_ENABLED = "false";
  process.env.SOCIAL_ENABLED = "true";
  process.env.SOCIAL_WORKER_MODE = "manual";
  process.env.SOCIAL_TOKEN_KEY_V1 = randomBytes(32).toString("base64");
  process.env.SOCIAL_TOKEN_ACTIVE_KEY = "1";
  process.env.CLOUDINARY_CLOUD_NAME = "social-test";
  process.env.SOCIAL_ORIGIN = "https://studio.example.test";
  process.env.SOCIAL_META_GRAPH_VERSION = "v25.0";
  process.env.SOCIAL_PUBLIC_STORE_VERIFIED = "false";
  const dir = mkdtempSync(join(tmpdir(), "larkova-social-")),
    client = createClient({ url: `file:${join(dir, "social.db")}` }),
    repo = new SocialRepository(client);
  await repo.init();
  let art: Artwork = { ...seedArtworks[0] };
  const bytes = await readFile(
    new URL("../public/artworks/Atitlan.jpg", import.meta.url),
  );
  const inventory = async (id: string) => (id === art.id ? art : null);
  async function asset(apiReady = false) {
    const id = randomUUID();
    const a: Asset = {
      id,
      kind: "image",
      url: apiReady
        ? `https://res.cloudinary.com/social-test/image/upload/v1/larkovart/${id}`
        : "/artworks/Atitlan.jpg",
      storageKey: id,
      bytes: bytes.length,
      ...imageMetadata(bytes),
      durationMs: null,
      sha256: hash(bytes),
      apiReady,
      verifiedAt: new Date().toISOString(),
      artworkId: art.id,
    };
    return repo.addAsset(a);
  }
  async function target(
    provider: Platform = "instagram",
    apiReady = false,
    connectionId: string | null = null,
  ) {
    const a = await asset(apiReady);
    const input = createPostSchema.parse({
      requestId: randomUUID(),
      title: "Atitlan campaign",
      artworkId: art.id,
      intent: "availability",
      targets: [
        {
          provider,
          caption:
            "Atitlan · original oil painting. Inquire for delivery details.",
          assetIds: [a.id],
          options:
            provider === "pinterest"
              ? { ...defaultOptions(provider), title: "Atitlan" }
              : defaultOptions(provider),
          connectionId,
          deliveryMode: apiReady ? "api_public" : "manual",
        },
      ],
    });
    const postId = await repo.createPost(input);
    return (await repo.state()).targets.find((t) => t.postId === postId)!;
  }
  async function connect(
    provider: Platform = "instagram",
    credentials: Credentials = {
      accessToken: "fixture-token-never-real",
      expiresAt: null,
    },
  ) {
    const s = await storeConnection(
      repo,
      provider,
      {
        externalId: "1001",
        displayName: "Fixture artist",
        username: provider === "instagram" ? "larkova.art" : "fixtureartist",
        scopes: scopesFor(provider),
        metadata: {
          selected: false,
          tasks: ["CREATE_CONTENT", "MANAGE", "MODERATE"],
          accessTier: "unknown",
        },
      },
      credentials,
    );
    await selectConnection(repo, s.id, s.externalId);
    return repo.getConnection(s.id);
  }
  return {
    repo,
    client,
    dir,
    bytes,
    inventory,
    get art() {
      return art;
    },
    setArt: (change: Partial<Artwork>) => {
      art = { ...art, ...change };
    },
    asset,
    target,
    connect,
    close: () => {
      client.close();
      rmSync(dir, { recursive: true, force: true });
      for (const k of keys) {
        if (before[k] === undefined) delete process.env[k];
        else process.env[k] = before[k];
      }
    },
  };
}
