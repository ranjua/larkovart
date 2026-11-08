import { boundedBody } from "./body.ts";
import { randomUUID } from "node:crypto";
import { session, sameOrigin } from "../auth.ts";
import { SocialError } from "./types.ts";
export const privateHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};
export async function socialGuard(request: Request) {
  if (!(await session()))
    throw new SocialError("unauthorized", "Sign in to the artist studio.", 403);
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    throw new SocialError(
      "unauthorized",
      "This action must start in your studio.",
      403,
    );
}
export async function boundedJson(request: Request) {
  const text = (await boundedBody(request, 65536)).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new SocialError(
      "validation_failed",
      "Send a valid JSON request.",
      400,
    );
  }
}
export function socialJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
export function socialFailure(error: unknown) {
  const id = randomUUID();
  if (error instanceof SocialError)
    return socialJson(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          requestId: id,
        },
      },
      error.status,
    );
  if (error && typeof error === "object" && "issues" in error)
    return socialJson(
      {
        error: {
          code: "validation_failed",
          message: "Check the highlighted social fields.",
          fieldErrors: (error as { issues: unknown }).issues,
          retryable: false,
          requestId: id,
        },
      },
      422,
    );
  return socialJson(
    {
      error: {
        code: "internal_error",
        message:
          "This social action could not be completed. Reload and try again.",
        retryable: false,
        requestId: id,
      },
    },
    500,
  );
}
