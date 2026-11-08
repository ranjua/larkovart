import type {
  Asset,
  Connection,
  Credentials,
  Target,
  Progress,
  StepResult,
  Metric,
  Platform,
} from "../types.ts";
export type Identity = {
  externalId: string;
  displayName: string;
  username: string;
  scopes: string[];
  metadata: Connection["metadata"];
};
export type ProviderContext = {
  connection: Connection;
  credentials: Credentials;
  fetcher: typeof fetch;
  now: () => number;
  artifact?: () => Promise<unknown>;
  write: <T>(
    step: string,
    fingerprint: unknown,
    send: () => Promise<T>,
  ) => Promise<T>;
};
export interface SocialAdapter {
  platform: Platform;
  identity(ctx: ProviderContext): Promise<Identity>;
  step(
    target: Target,
    assets: Asset[],
    progress: Progress,
    ctx: ProviderContext,
  ): Promise<StepResult>;
  reconcile(
    target: Target,
    progress: Progress,
    ctx: ProviderContext,
  ): Promise<StepResult | null>;
  metrics(ctx: ProviderContext, postId?: string): Promise<Metric[]>;
}
