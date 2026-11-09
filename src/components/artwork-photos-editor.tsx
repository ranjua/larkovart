"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Artwork, ArtworkPhoto } from "@/lib/catalog";
export function ArtworkPhotosEditor({
  art,
  connected,
}: {
  art: Artwork;
  connected: boolean;
}) {
  const [photos, setPhotos] = useState<ArtworkPhoto[]>(art.photos || []),
    [receipts, setReceipts] = useState<Record<string, unknown>>({}),
    [revision, setRevision] = useState(art.photoRevision || 0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function upload(file: File) {
    setBusy(true);
    setMessage("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > (connected ? 10 * 1024 * 1024 : 300 * 1024)
      )
        throw new Error(
          connected
            ? "Use a JPEG, PNG or WebP under 10 MB."
            : "Local preview: use a JPEG, PNG or WebP under 300 KB.",
        );
      const id = crypto.randomUUID();
      let image: string;
      if (connected) {
        const r = await fetch("/api/studio/photo", { method: "POST" });
        if (!r.ok) throw new Error("Photo storage unavailable.");
        const signed = await r.json(),
          form = new FormData();
        Object.entries(signed.params).forEach(([k, v]) =>
          form.set(k, String(v)),
        );
        form.set("api_key", signed.apiKey);
        form.set("signature", signed.signature);
        form.set("file", file);
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${signed.cloud}/image/upload`,
          { method: "POST", body: form, signal: AbortSignal.timeout(120000) },
        );
        const data = await response.json();
        if (!response.ok) throw new Error("Upload failed.");
        const receipt = {
          public_id: data.public_id,
          version: data.version,
          signature: data.signature,
        };
        image = `https://res.cloudinary.com/${signed.cloud}/image/upload/v${data.version}/${data.public_id}`;
        setReceipts((v) => ({ ...v, [id]: receipt }));
      } else
        image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      setPhotos((v) => [...v, { id, image, kind: "detail" }]);
      setMessage("Original photo added. Choose its view and save the set.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="photo-set-editor">
      <summary>Artwork photo set · {photos.length}/6</summary>
      <p className="fine-print">
        Add authentic detail, back, edge and signature photographs. Originals
        stay unchanged. The primary artwork photo remains first.
      </p>
      <div className="photo-set-grid">
        {photos.map((p, i) => (
          <div key={p.id}>
            <img src={p.image} alt={p.kind} />
            <label>
              View
              <select
                value={p.kind}
                onChange={(e) =>
                  setPhotos((v) =>
                    v.map((x) =>
                      x.id === p.id
                        ? { ...x, kind: e.target.value as ArtworkPhoto["kind"] }
                        : x,
                    ),
                  )
                }
              >
                <option value="detail">Detail</option>
                <option value="backPhoto">Back</option>
                <option value="signature">Signature</option>
                <option value="edge">Edges</option>
                <option value="otherPhoto">Another view</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy || i === 0}
              onClick={() =>
                setPhotos((v) => {
                  const next = [...v];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  return next;
                })
              }
            >
              Move earlier
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPhotos((v) => v.filter((x) => x.id !== p.id))}
            >
              Remove from set
            </button>
          </div>
        ))}
      </div>
      <label>
        Add photograph
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || photos.length >= 6}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch(`/api/studio/artworks/${art.id}/photos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                photos,
                receipts,
                expectedRevision: revision,
              }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setRevision(data.revision);
            setReceipts({});
            setMessage(
              "Photo set saved. Published artwork pages now show these original photographs.",
            );
            router.refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Unable to save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save photo set
      </button>
      {message && (
        <p role="status" className="studio-note">
          {message}
        </p>
      )}
    </details>
  );
}
