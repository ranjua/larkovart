import type { Platform, Connection, Feature } from "./types.ts";
import { redactedConfig, socialConfig } from "./config.ts";
export function capabilities(provider: Platform, connection?: Connection) {
  const c = socialConfig();
  const configured = redactedConfig().providers[provider].configured;
  const connect: Feature =
    provider === "tiktok"
      ? {
          state: "policy_restricted",
          reasonCode: "private_tool_direct_post_restricted",
          ownerAction: "Use the manual posting package in TikTok.",
        }
      : !configured
        ? {
            state: "not_configured",
            reasonCode: "developer_app_missing",
            ownerAction: `Add the ${provider} developer app, callback origin and social encryption key.`,
          }
        : !connection
          ? {
              state: "needs_connection",
              reasonCode: "oauth_required",
              ownerAction: "Connect and confirm the exact account.",
            }
          : connection.status !== "connected"
            ? {
                state: "needs_connection",
                reasonCode: "reconnect_required",
                ownerAction: "Reconnect this account.",
              }
            : !connection.metadata.selected
              ? {
                  state: "needs_review",
                  reasonCode: "identity_confirmation_required",
                  ownerAction: "Confirm the account ID shown below.",
                }
              : { state: "available", reasonCode: "identity_read_verified" };
  const publish: Feature =
    provider === "tiktok"
      ? {
          state: "policy_restricted",
          reasonCode: "native_posting_required",
          ownerAction: "Export and finish posting in TikTok.",
        }
      : connect.state !== "available"
        ? connect
        : connection &&
            !connection.scopes.includes(
              provider === "instagram"
                ? "instagram_business_content_publish"
                : provider === "facebook"
                  ? "pages_manage_posts"
                  : "pins:write",
            )
          ? {
              state: "needs_permission",
              reasonCode: "publishing_scope_missing",
              ownerAction:
                "Reconnect and grant the required publishing permission.",
            }
          : provider === "pinterest" &&
              connection?.metadata.accessTier !== "standard"
            ? {
                state: "needs_review",
                reasonCode: "pinterest_standard_access_required",
                ownerAction:
                  "Confirm the app’s actual access tier; Trial is creator-only.",
              }
            : !c.publishEnabled
              ? {
                  state: "not_configured",
                  reasonCode: "public_writes_disabled",
                  ownerAction:
                    "Public writes stay off until production and exact-post approval are ready.",
                }
              : {
                  state: "available",
                  reasonCode: "exact_revision_approval_required",
                };
  return {
    connection: connect,
    manualExport: {
      state: "available",
      reasonCode: "no_credentials_required",
    } as Feature,
    readProfile: connect,
    readMetrics: {
      state: "needs_review",
      reasonCode: "metric_read_not_verified",
      ownerAction:
        "Sync metrics; only provider-returned evidence will be shown.",
    },
    publishImage: publish,
    publishCarousel:
      provider === "pinterest"
        ? { state: "unsupported", reasonCode: "image_pins_first" }
        : publish,
    publishVideo:
      provider !== "tiktok"
        ? publish
        : { state: "unsupported", reasonCode: "manual_video_export" },
    comments: {
      state: "unsupported",
      reasonCode: "separate_future_permission_and_workflow",
    },
    messages: {
      state: "unsupported",
      reasonCode: "not_authorized_by_publishing_approval",
    },
  };
}
