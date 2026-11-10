import { RecurrenteTest } from "@/components/recurrente-test";
import Link from "next/link";
import { session } from "@/lib/auth";
import { artworks, studioOrders, deletableArtworkIds } from "@/lib/store";
import { Studio } from "@/components/studio";
import { IntegrationPanel } from "@/components/integration-panel";
import { recurrenteConfigured } from "@/lib/integrations/recurrente";
import { shippingStatus } from "@/lib/shipping";
import { photoConfigured } from "@/lib/photo";
import { EmailSettings } from "@/components/email-settings";
import { customerEmailDeliveryConfig } from "@/lib/customer/email-delivery";
export const dynamic = "force-dynamic";
export default async function StudioPage() {
  const authorized = await session();
  return (
    <main
      className={`studio-shell ${authorized ? "studio-authorized" : "studio-auth"}`}
    >
      <Link className="wordmark" href="/es">
        larkova<span>ARTIST STUDIO</span>
      </Link>
      {authorized && (
        <Link className="studio-social-link button" href="/studio/social">
          Social studio ↗
        </Link>
      )}
      {authorized ? (
        <Studio
          works={await artworks(true)}
          orders={await studioOrders()}
          deletableIds={await deletableArtworkIds()}
          photoConnected={photoConfigured()}
          aiConnected={
            !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_TEXT_MODEL
          }
        />
      ) : (
        <Studio works={null} orders={[]} aiConnected={false} />
      )}
      {authorized && (
        <EmailSettings
          ready={
            customerEmailDeliveryConfig().provider === "gmail" &&
            customerEmailDeliveryConfig().ready
          }
        />
      )}
      {authorized && (
        <details className="studio-settings">
          <summary>
            Payment & delivery settings <span>Sandbox</span>
          </summary>{" "}
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
        </details>
      )}
    </main>
  );
}
