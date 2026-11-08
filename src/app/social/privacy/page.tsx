import Link from "next/link";
export const metadata = { title: "Social data & privacy · Larkova Art" };
export default function SocialPrivacy() {
  return (
    <main className="section-wrap checkout-section" style={{ maxWidth: 850 }}>
      <Link className="back-link" href="/es">
        ← Larkova Art
      </Link>
      <p className="eyebrow">SOCIAL STUDIO / LAST UPDATED NOVEMBER 8, 2026</p>
      <h1>Social data & privacy</h1>
      <section className="social-card">
        <h2>Who operates this workspace</h2>
        <p>
          The workspace is operated for Yulia Larkova’s original-art business,
          Larkova Art, in Guatemala City. Contact:{" "}
          <a href="mailto:larkova.art@gmail.com">larkova.art@gmail.com</a>.
        </p>
      </section>
      <section className="social-card">
        <h2>What connecting an account permits</h2>
        <p>
          Only accounts expressly authorized by their owner are connected. The
          workspace stores account IDs, profile names, granted permissions,
          encrypted access/refresh credentials, the artist’s drafts/media,
          publishing operation references and available organic metrics. Each
          platform grants specific capabilities; a connection does not provide
          unrestricted account access.
        </p>
        <p>
          Approved content and source media are sent to the selected platform
          only under its supported workflow and configured write gates. TikTok
          can be used through manual export. No paid ads, cold messages,
          scraping, follower purchasing or autonomous replies are part of this
          suite.
        </p>
      </section>
      <section className="social-card">
        <h2>Storage and service providers</h2>
        <p>
          Hosting and server functions use Vercel, social records use
          libSQL-compatible storage, and original uploads may use the configured
          Cloudinary account. OAuth and publication communicate with the
          selected social provider. Credentials remain encrypted on the server
          and are not included in manual packages or browser state. Provider
          platforms apply their own terms and privacy policies.
        </p>
      </section>
      <section className="social-card">
        <h2>Removal and retention</h2>
        <p>
          Disconnecting removes local active credentials and blocks pending
          writes. Remove the app in the provider’s own settings to revoke
          provider-side access as well. Signed Meta data-deletion callbacks
          remove local provider profile/credential/metric data; original artist
          uploads and unrelated storefront orders remain separate. Existing
          native posts are not automatically deleted.
        </p>
        <p>
          Temporary OAuth requests expire after ten minutes. Maintenance removes
          expired requests, completed operational logs older than 90 days and
          metric snapshots older than 12 months when the local or configured
          maintenance worker runs. Unresolved publication evidence is retained
          for safe reconciliation. For a removal request or questions about
          retained data, email the address above.
        </p>
      </section>
      <section className="social-card">
        <h2>Use and consent</h2>
        <p>
          This is a private owner-operated art workspace. The artist must own or
          have permission for uploaded media and review each exact content
          revision and destination before publishing. Platform restrictions
          still apply. A social draft, native manual report or message does not
          reserve inventory, confirm a payment or create a shipment. No social
          analytics are represented as sales revenue.
        </p>
      </section>
    </main>
  );
}
