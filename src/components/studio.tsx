"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { mediumName, type Artwork } from "@/lib/catalog";
import { locales, languageNames, type Locale } from "@/lib/i18n";
import { ShippingActions } from "./integration-panel";
type StudioOrder = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  name: string;
  country: string;
  price: number;
  fulfillmentState?: string;
  tracking?: string;
};
export function Studio({
  works,
  orders,
  aiConnected,
  photoConnected = false,
}: {
  works: Artwork[] | null;
  orders: StudioOrder[];
  aiConnected: boolean;
  photoConnected?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState("");
  const [newId, setNewId] = useState(() => `work-${crypto.randomUUID()}`);
  const [photoReceipt, setPhotoReceipt] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [uploading, setUploading] = useState(false);
  const [descriptions, setDescriptions] = useState<Record<Locale, string>>({
    es: "",
    en: "",
    ru: "",
    zh: "",
    ja: "",
    pt: "",
  });
  const [facts, setFacts] = useState("");
  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/studio/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (r.ok) router.refresh();
      else setMessage((await r.json()).error);
    } catch {
      setMessage("Unable to sign in.");
    } finally {
      form.reset();
      setBusy(false);
    }
  }
  async function save(a: Artwork, receipt?: Record<string, unknown> | null) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/studio/artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, photoReceipt: receipt || undefined }),
      });
      if (!r.ok) {
        setMessage((await r.json()).error);
        return false;
      }
      setMessage(
        "Artwork saved. Published works are now visible in the gallery.",
      );
      router.refresh();
      return true;
    } catch {
      setMessage("Unable to save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function draft() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/studio/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts, image: image || undefined }),
      });
      const data = await r.json();
      if (r.ok) {
        setDescriptions(data.descriptions);
        setMessage(
          "AI draft ready. Review all six translations before publishing.",
        );
      } else setMessage(data.error);
    } catch {
      setMessage("Unable to generate a draft.");
    } finally {
      setBusy(false);
    }
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const a: Artwork = {
      id: newId,
      title: String(data.title),
      category: data.category as Artwork["category"],
      image,
      medium: data.medium as Artwork["medium"],
      width: Number(data.width),
      height: Number(data.height),
      year: Number(data.year),
      price: Math.round(Number(data.price) * 100),
      status: "available",
      published: data.publish === "on",
      descriptions: Object.fromEntries(
        locales.map((l) => [
          l,
          descriptions[l].trim() ||
            `${String(data.title)} · ${mediumName({ medium: data.medium as Artwork["medium"] } as Artwork, l)} · ${Number(data.width)} × ${Number(data.height)} cm · ${Number(data.year)}.`,
        ]),
      ) as Record<Locale, string>,
    };
    if (await save(a, photoReceipt)) {
      setPhotoReceipt(null);
      setNewId(`work-${crypto.randomUUID()}`);
      form.reset();
      setImage("");
      setFacts("");
      setDescriptions({ es: "", en: "", ru: "", zh: "", ja: "", pt: "" });
    }
  }
  if (!works)
    return (
      <div className="studio-login">
        <p className="eyebrow">PRIVATE WORKSPACE</p>
        <h1>
          A little less admin.
          <br />
          More time to paint.
        </h1>
        <p className="studio-note">
          Sign in to manage your development catalog and test orders. Set
          STUDIO_PASSWORD (at least 24 characters) in your local environment to
          enable access.
        </p>
        <form onSubmit={signIn}>
          <label>
            Studio password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              maxLength={512}
            />
          </label>
          {message && (
            <p role="alert" className="form-error">
              {message}
            </p>
          )}
          <button className="button button-dark full-width" disabled={busy}>
            Enter studio →
          </button>
        </form>
      </div>
    );
  return (
    <>
      <div className="studio-top">
        <div>
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h1>Good things are taking shape.</h1>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/studio/session", { method: "DELETE" });
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
      <p className="studio-note">
        Development data only. Sample prices. No real payments, labels,
        notifications or collections are sent.
      </p>
      <div className="studio-status">
        <div>
          <strong>{works.length} artworks</strong>
          <span>
            {
              works.filter((a) => a.status === "available" && a.published)
                .length
            }{" "}
            available in the preview
          </span>
        </div>
        <div>
          <strong>Payments & delivery</strong>
          <span>See sandbox connection status above</span>
        </div>
        <div>
          <strong>AI listing drafts</strong>
          <span>
            {aiConnected
              ? "Connected · artist review required"
              : "Not connected · manual descriptions available"}
          </span>
        </div>
      </div>
      {message && (
        <p className="studio-message" role="status">
          {message}
        </p>
      )}
      <h2>Your artworks</h2>
      <div className="studio-artworks">
        {works.map((a) => (
          <form
            className="studio-work"
            key={a.id}
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              save({
                ...a,
                price: Math.round(Number(d.get("price")) * 100),
                published: d.get("published") === "on",
                parcel:
                  Number(d.get("parcelLength")) > 0
                    ? {
                        length: Number(d.get("parcelLength")),
                        width: Number(d.get("parcelWidth")),
                        height: Number(d.get("parcelHeight")),
                        weight: Number(d.get("parcelWeight")),
                        netWeight: Number(d.get("netWeight")),
                        originCountry: String(
                          d.get("originCountry"),
                        ).toUpperCase(),
                        hsCode: String(d.get("hsCode")),
                        shippingBudget: Math.round(
                          Number(d.get("shippingBudget")) * 100,
                        ),
                      }
                    : undefined,
              });
            }}
          >
            <img src={a.image} alt={a.title} />
            <h3>{a.title}</h3>
            <p>
              {a.status} · {a.published ? "Published in development" : "Draft"}
            </p>
            <label>
              Price · USD
              <input
                name="price"
                type="number"
                min="75"
                max="1000"
                step="1"
                defaultValue={a.price / 100}
                required
              />
            </label>
            <details className="packing-details">
              <summary>Packed dimensions & shipping allowance</summary>
              {a.packingEstimate && (
                <p className="fine-print">
                  Planning estimate: {a.packingEstimate.length} ×{" "}
                  {a.packingEstimate.width} × {a.packingEstimate.height} cm,{" "}
                  {a.packingEstimate.weight} kg. Assumes unframed canvas without
                  glass. For preliminary quotes only; confirm measurements
                  before booking.
                </p>
              )}
              <p className="fine-print">
                Use measured package sizes, not canvas sizes. Leave length blank
                to require a manual quote.
              </p>
              <div className="form-row">
                <label>
                  Length · cm
                  <input
                    name="parcelLength"
                    type="number"
                    min="0.1"
                    max="150"
                    step="0.1"
                    defaultValue={a.parcel?.length}
                  />
                </label>
                <label>
                  Width · cm
                  <input
                    name="parcelWidth"
                    type="number"
                    min="0.1"
                    max="150"
                    step="0.1"
                    defaultValue={a.parcel?.width}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Depth · cm
                  <input
                    name="parcelHeight"
                    type="number"
                    min="0.1"
                    max="150"
                    step="0.1"
                    defaultValue={a.parcel?.height}
                  />
                </label>
                <label>
                  Packed weight · kg
                  <input
                    name="parcelWeight"
                    type="number"
                    min="0.01"
                    max="70"
                    step="0.01"
                    defaultValue={a.parcel?.weight}
                  />
                </label>
              </div>
              <label>
                Artwork net weight · kg
                <input
                  name="netWeight"
                  type="number"
                  min="0.01"
                  max="70"
                  step="0.01"
                  defaultValue={a.parcel?.netWeight}
                />
              </label>
              <label>
                Origin country · two-letter code
                <input
                  name="originCountry"
                  minLength={2}
                  maxLength={2}
                  defaultValue={a.parcel?.originCountry}
                />
              </label>
              <label>
                Approved customs HS code
                <input
                  name="hsCode"
                  pattern="[0-9]{6,10}"
                  defaultValue={a.parcel?.hsCode}
                />
              </label>
              <label>
                Included shipping allowance · USD
                <input
                  name="shippingBudget"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  defaultValue={
                    a.parcel ? a.parcel.shippingBudget / 100 : undefined
                  }
                />
              </label>
            </details>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                name="published"
                defaultChecked={a.published}
                style={{ width: "auto" }}
              />
              Visible in gallery
            </label>
            <button className="button button-dark" disabled={busy}>
              Save changes
            </button>
          </form>
        ))}
      </div>
      <h2>Test orders & quote requests</h2>
      {orders.length === 0 ? (
        <p className="studio-note">
          No test orders yet. Try the checkout using fictional details.
        </p>
      ) : (
        orders.map((o) => (
          <div className="studio-order" key={o.id}>
            <div>
              <strong>{o.title}</strong>
              <p>
                {o.name} · {o.country} · {o.id.slice(0, 8)}
              </p>
            </div>
            <span>
              {o.status === "demo_paid"
                ? "Test payment · not shipped"
                : o.status === "quote_requested"
                  ? "Quote requested · not paid"
                  : o.status.replaceAll("_", " ")}
            </span>
            <p>${o.price / 100} USD</p>
            {o.status === "sandbox_paid" && (
              <ShippingActions
                id={o.id}
                state={o.fulfillmentState}
                tracking={o.tracking}
              />
            )}
          </div>
        ))
      )}
      <form className="studio-draft" onSubmit={add}>
        <p className="eyebrow">A NEW ORIGINAL</p>
        <h2>From your easel to the gallery.</h2>
        <p className="studio-note">
          Upload a photo, enter the dimensions and price, and publish. We keep
          the original photo. Automatic enhancement can adjust colors and
          lighting.
        </p>
        <p role="status" className="studio-note">
          {photoConnected
            ? "Cloudinary configured · photos are enhanced before publication."
            : "Photo enhancement needs a Cloudinary connection. You can still save an original photo without enhancement."}
        </p>
        <label>
          Artwork photo · JPEG / PNG / WebP · max {photoConnected ? "10" : "3"}{" "}
          MB
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={busy || uploading}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setImage("");
              setPhotoReceipt(null);
              setMessage("");
              if (!f) return;
              if (
                f.size > (photoConnected ? 10 : 3) * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(f.type)
              ) {
                setMessage("Choose a JPEG, PNG or WebP within the size limit.");
                e.target.value = "";
                return;
              }
              if (!photoConnected) {
                const reader = new FileReader();
                reader.onload = () => setImage(String(reader.result));
                reader.readAsDataURL(f);
                return;
              }
              setUploading(true);
              try {
                const r = await fetch("/api/studio/photo", { method: "POST" });
                const signed = await r.json();
                if (!r.ok) throw new Error(signed.error);
                const upload = new FormData();
                for (const [key, value] of Object.entries(signed.params))
                  upload.set(key, String(value));
                upload.set("api_key", signed.apiKey);
                upload.set("signature", signed.signature);
                upload.set("file", f);
                const result = await fetch(
                  `https://api.cloudinary.com/v1_1/${signed.cloud}/image/upload`,
                  {
                    method: "POST",
                    body: upload,
                    signal: AbortSignal.timeout(120000),
                  },
                );
                const photo = await result.json();
                if (!result.ok || !photo.eager?.[0]?.secure_url)
                  throw new Error(
                    "Photo enhancement failed. Nothing was published. Please select the photo again.",
                  );
                setPhotoReceipt({
                  public_id: photo.public_id,
                  version: photo.version,
                  signature: photo.signature,
                });
                setImage(photo.eager[0].secure_url);
                setMessage(
                  "Enhanced photo ready. Enter the artwork details to publish.",
                );
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to enhance photo.",
                );
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        {uploading && <p role="status">Uploading and enhancing your photo…</p>}
        {image && (
          <img
            className="upload-preview"
            src={image}
            alt="Artwork photo preview"
          />
        )}
        <label>
          Title
          <input name="title" required maxLength={150} />
        </label>
        <div className="form-row">
          <label>
            Category
            <select name="category">
              <option value="paintings">Painting</option>
              <option value="drawings">Drawing</option>
              <option value="sculptures">Sculpture</option>
            </select>
          </label>
          <label>
            Medium
            <select name="medium">
              <option value="oil">Oil on canvas</option>
              <option value="acrylic">Acrylic on canvas</option>
              <option value="mixed">Mixed media on canvas</option>
              <option value="charcoal">Charcoal on paper</option>
              <option value="bronze">Bronze</option>
              <option value="other">Other materials</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Width · cm
            <input
              name="width"
              type="number"
              min="1"
              max="80"
              step="0.1"
              required
            />
          </label>
          <label>
            Height · cm
            <input
              name="height"
              type="number"
              min="1"
              max="80"
              step="0.1"
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Year
            <input
              name="year"
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              defaultValue={new Date().getFullYear()}
              required
            />
          </label>
          <label>
            Price · USD
            <input
              name="price"
              defaultValue="100"
              type="number"
              min="75"
              max="1000"
              step="1"
              required
            />
          </label>
        </div>
        <details>
          <summary>Optional descriptions and AI writing</summary>
          <label>
            Known facts for the AI draft
            <textarea
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              maxLength={6000}
              placeholder="Subject, materials, inspiration — only facts you want included."
            />
          </label>
          <button
            className="button button-dark"
            type="button"
            disabled={busy || !aiConnected || facts.trim().length < 10}
            onClick={draft}
          >
            Draft descriptions in six languages ✳
          </button>
          {!aiConnected && (
            <p className="fine-print">
              Connect an AI provider to enable drafting. You can enter all
              descriptions manually below. Blank descriptions use the title,
              dimensions and year automatically.
            </p>
          )}
          {locales.map((l) => (
            <label key={l}>
              {languageNames[l]}
              <textarea
                value={descriptions[l]}
                maxLength={2000}
                onChange={(e) =>
                  setDescriptions({ ...descriptions, [l]: e.target.value })
                }
              />
            </label>
          ))}
        </details>
        <label style={{ display: "flex", gap: 8 }}>
          <input
            type="checkbox"
            name="publish"
            defaultChecked
            style={{ width: "auto" }}
          />
          Publish automatically when saved
        </label>
        <button
          className="button button-dark full-width"
          disabled={busy || uploading || !image}
        >
          {busy ? "Saving…" : "Save artwork →"}
        </button>
      </form>
    </>
  );
}
