import { RecurrenteTest } from "@/components/recurrente-test";
import Link from "next/link";
import { session } from "@/lib/auth";
import { artworks, studioOrders } from "@/lib/store";
import { Studio } from "@/components/studio";
import { IntegrationPanel } from "@/components/integration-panel";
import { recurrenteConfigured } from "@/lib/integrations/recurrente";
import { shippingStatus } from "@/lib/shipping";
import { photoConfigured } from "@/lib/photo";
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
          paymentName={
            process.env.PAYMENT_PROVIDER === "stripe"
              ? "Stripe"
              : process.env.PAYMENT_PROVIDER === "paypal"
                ? "PayPal"
                : "Recurrente"
          }
          payment={
            process.env.PAYMENT_PROVIDER === "stripe"
              ? !!process.env.STRIPE_SECRET_KEY
              : process.env.PAYMENT_PROVIDER === "paypal"
                ? !!process.env.PAYPAL_SANDBOX_CLIENT_ID &&
                  !!process.env.PAYPAL_SANDBOX_SECRET
                : recurrenteConfigured()
          }
          couriers={shippingStatus()}
          autoBook={process.env.SHIPPING_AUTO_BOOK_TEST !== "false"}
        />
      )}
      {authorized && <RecurrenteTest configured={recurrenteConfigured()} />}
      {authorized ? (
        <Studio
          works={await artworks(true)}
          orders={await studioOrders()}
          photoConnected={photoConfigured()}
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
