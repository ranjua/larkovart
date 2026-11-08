import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { artworks } from "@/lib/store";
import { SocialWorkspace } from "@/components/social/social-workspace";
export const dynamic = "force-dynamic";
export default async function SocialPage() {
  if (!(await session())) redirect("/studio");
  return <SocialWorkspace artworks={await artworks(true)} />;
}
