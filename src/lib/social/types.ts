export const platforms = [
  "instagram",
  "facebook",
  "tiktok",
  "pinterest",
] as const;
export type Platform = (typeof platforms)[number];
export type DeliveryMode = "manual" | "api_public" | "api_test" | "api_inbox";
export type TargetStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "queued"
  | "processing"
  | "published"
  | "test_completed"
  | "awaiting_creator"
  | "manual_ready"
  | "manually_reported"
  | "blocked"
  | "retry_wait"
  | "uncertain"
  | "failed"
  | "canceled";
export type Intent = "availability" | "portfolio" | "process" | "announcement";
export type FeatureState =
  | "available"
  | "not_configured"
  | "needs_connection"
  | "needs_permission"
  | "needs_review"
  | "policy_restricted"
  | "unsupported";
export type Feature = {
  state: FeatureState;
  reasonCode: string;
  ownerAction?: string;
  documentationUrl?: string;
};
export type Asset = {
  id: string;
  kind: "image" | "video";
  url: string;
  storageKey: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  durationMs: number | null;
  framesPerSecond?: number | null;
  sha256: string;
  apiReady: boolean;
  verifiedAt: string;
  artworkId: string | null;
};
export type ProviderOptions =
  | { provider: "instagram"; altText: string }
  | { provider: "facebook"; link: string | null }
  | {
      provider: "pinterest";
      title: string;
      altText: string;
      boardId: string;
      sectionId: string | null;
    }
  | { provider: "tiktok"; title: string; disclosure: boolean };
export type Post = {
  id: string;
  title: string;
  artworkId: string | null;
  campaign: string;
  intent: Intent;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Target = {
  id: string;
  postId: string;
  provider: Platform;
  connectionId: string | null;
  deliveryMode: DeliveryMode;
  revision: number;
  format: "image" | "carousel" | "video" | "text";
  caption: string;
  options: ProviderOptions;
  assetIds: string[];
  linkUrl: string | null;
  scheduledAt: string | null;
  timezone: string;
  status: TargetStatus;
  approvedHash: string | null;
  approvedRevision: number | null;
  approvedAt: string | null;
  inventoryFingerprint: string | null;
  connectionGeneration: number | null;
  externalOperationId: string | null;
  externalPostId: string | null;
  permalink: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Connection = {
  id: string;
  provider: Platform;
  externalId: string;
  displayName: string;
  username: string;
  status: "connected" | "reconnect_required" | "disconnected";
  credentialId: string;
  generation: number;
  scopes: string[];
  metadata: {
    accessTier?: "trial" | "standard" | "unknown";
    tasks?: string[];
    selected?: boolean;
    authSubjectId?: string;
  };
  environment: string;
  lastVerifiedAt: string | null;
  createdAt: string;
};
export type Credentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number | null;
  refreshExpiresAt?: number | null;
};
export type Job = {
  id: string;
  targetId: string | null;
  connectionId: string | null;
  kind: "publish" | "metrics";
  operationKey: string;
  state:
    | "ready"
    | "running"
    | "retry_wait"
    | "done"
    | "blocked"
    | "uncertain"
    | "failed"
    | "canceled";
  runAt: string;
  leaseOwner: string | null;
  leaseUntil: number | null;
  fence: number;
  attempts: number;
  progress: Progress;
  lastErrorCode: string | null;
  createdAt: string;
};
export type Progress = {
  schema: 1;
  metricsCursor?: string;
  videoId?: string;
  mediaId?: string;
  uploadPath?: string;
  containerId?: string;
  children?: string[];
  photoIds?: string[];
  postId?: string;
  stage?: string;
  pollCount?: number;
};
export type StepResult =
  | { kind: "next"; progress: Progress; delayMs: number }
  | { kind: "published"; postId: string; permalink?: string }
  | { kind: "test_completed"; operationId: string }
  | { kind: "awaiting_creator"; operationId: string };
export type Metric = {
  key: string;
  value: number | null;
  unit: "count";
  aggregation: "lifetime" | "snapshot";
  definition: string;
  source: string;
  externalPostId: string | null;
  collectedAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
};
export class SocialError extends Error {
  code: string;
  status: number;
  retryable: boolean;
  constructor(code: string, message: string, status = 400, retryable = false) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}
