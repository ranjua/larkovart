import Link from "next/link";
import { session } from "@/lib/auth";
import { artworks, studioOrders } from "@/lib/store";
import { Studio } from "@/components/studio";
import { IntegrationPanel } from "@/components/integration-panel";
import { recurrenteConfigured } from "@/lib/integrations/recurrente";
import { dhlConfigured } from "@/lib/integrations/dhl";
export const dynamic = "force-dynamic";
export default async function StudioPage() {
  const authorized = await session();
  return (
    <main className="studio-shell">
      <Link className="wordmark" href="/es">
        larkova<span>DEVELOPMENT STUDIO</span>
      </Link>
      {authorized && (
        <IntegrationPanel
          payment={recurrenteConfigured()}
          courier={dhlConfigured()}
          autoBook={process.env.DHL_AUTO_BOOK_TEST === "true"}
        />
      )}
      {authorized ? (
        <Studio
          works={await artworks(true)}
          orders={await studioOrders()}
          aiConnected={
            !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_TEXT_MODEL
          }
        />
      ) : (
        <Studio works={null} orders={[]} aiConnected={false} />
      )}
    </main>
  );
}
