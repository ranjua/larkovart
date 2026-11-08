import { notFound } from "next/navigation";
import { socialRepository } from "@/lib/social/repository";
import { hash } from "@/lib/social/crypto";
import Link from "next/link";
export default async function DeletionStatus({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(code)) notFound();
  const repo = socialRepository();
  await repo.init();
  const result = await repo.client.execute({
    sql: "SELECT status FROM social_deletion_requests WHERE id=?",
    args: [hash(code)],
  });
  if (!result.rows[0]) notFound();
  return (
    <main className="section-wrap checkout-section">
      <p className="eyebrow">LARKOVA / SOCIAL DATA</p>
      <h1>Data removal request</h1>
      <p className="studio-note">
        The verified platform callback completed removal of local provider
        credentials, account profile and metrics. It does not delete the
        artist’s original artwork, storefront orders or posts already on the
        native platform.
      </p>
      <p className="studio-note">
        Reference:{" "}
        {/^[A-Za-z0-9_-]{32}$/.test(code) ? code : "Invalid reference"}
      </p>
      <p className="studio-note">
        For confirmation or help, contact larkova.art@gmail.com with your
        reference. This public page reveals no account identity or private data.
      </p>
      <Link className="text-link" href="/social/privacy">
        Social privacy information
      </Link>
    </main>
  );
}
