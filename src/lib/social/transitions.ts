import { SocialError, type TargetStatus } from "./types.ts";
const edges: Record<TargetStatus, TargetStatus[]> = {
  draft: ["draft", "approved", "blocked", "canceled"],
  approved: ["approved", "draft", "scheduled", "queued", "blocked", "canceled"],
  scheduled: ["scheduled", "draft", "processing", "blocked", "canceled"],
  queued: ["queued", "draft", "processing", "blocked", "canceled"],
  processing: [
    "processing",
    "published",
    "test_completed",
    "awaiting_creator",
    "manual_ready",
    "retry_wait",
    "uncertain",
    "blocked",
  ],
  published: ["published"],
  test_completed: ["test_completed"],
  awaiting_creator: ["awaiting_creator", "manually_reported"],
  manual_ready: [
    "manual_ready",
    "draft",
    "manually_reported",
    "canceled",
    "blocked",
  ],
  manually_reported: ["manually_reported", "published"],
  blocked: ["blocked", "draft", "canceled"],
  retry_wait: ["retry_wait", "draft", "processing", "blocked", "canceled"],
  uncertain: [
    "uncertain",
    "published",
    "test_completed",
    "awaiting_creator",
    "failed",
  ],
  failed: ["failed", "draft", "canceled"],
  canceled: ["canceled"],
};
export function assertTransition(from: TargetStatus, to: TargetStatus) {
  if (!edges[from]?.includes(to))
    throw new SocialError(
      "invalid_transition",
      `Cannot change ${from} to ${to}. Review the existing operation.`,
      409,
    );
}
