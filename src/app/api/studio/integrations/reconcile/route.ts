import { sameOrigin, session } from "@/lib/auth";
import { reconcilePending } from "@/lib/commerce";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "unauthorized" }, { status: 403 });
  return Response.json({ results: await reconcilePending() });
}

export const maxDuration = 300;
