"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Expand, ImageIcon, Layers3, X } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { galleryCopy } from "@/lib/gallery-copy";
import { artworkPhoto, type Artwork } from "@/lib/catalog";
import { RoomScene, roomNames, roomScenes } from "./room-scene";
export function ArtViewer({ art, locale }: { art: Artwork; locale: Locale }) {
  const [room, setRoom] = useState(false),
    [scene, setScene] = useState(0),
    [activeScene, setActiveScene] = useState<number | null>(null),
    [visited, setVisited] = useState<number[]>([]),
    [failed, setFailed] = useState<number | null>(null);
  const loaded = useRef(new Set<number>()),
    requested = useRef(0),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLAnchorElement>(null),
    closeButton = useRef<HTMLButtonElement>(null),
    previousOverflow = useRef<string | null>(null);
  const t = dictionaries[locale],
    g = galleryCopy[locale];
  function choose(i: number) {
    setFailed(null);
    requested.current = i;
    setScene(i);
    setRoom(true);
    setVisited((v) => (v.includes(i) ? v : [...v, i]));
    if (loaded.current.has(i)) setActiveScene(i);
  }
  function ready(i: number) {
    loaded.current.add(i);
    if (requested.current === i) setActiveScene(i);
  }
  function restore() {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  }
  useEffect(() => () => restore(), []);
  return (
    <div className="art-viewer">
      <div className="viewer-toolbar">
        <div className="viewer-controls">
          <button
            aria-pressed={!room}
            className={!room ? "active" : ""}
            onClick={() => setRoom(false)}
          >
            <ImageIcon size={16} />
            {t.photo}
          </button>
          {art.category !== "sculptures" && (
            <button
              aria-pressed={room}
              className={room ? "active" : ""}
              onClick={() => choose(scene)}
            >
              <Layers3 size={16} />
              {t.room}
            </button>
          )}
        </div>
        <span className="viewer-index">
          {room ? `0${scene + 2}` : "01"} /{" "}
          {art.category === "sculptures" ? "01" : "04"}
        </span>
      </div>
      <div className="viewer-stage">
        <div
          className={`detail-image original-photo viewer-layer ${!room || activeScene === null ? "is-visible" : ""}`}
          aria-hidden={room && activeScene !== null}
        >
          <Image
            src={artworkPhoto(art)}
            alt={art.title}
            width={1100}
            height={1100}
            priority
            sizes="(max-width: 800px) 90vw, 60vw"
          />
          <a
            ref={trigger}
            className="photo-expand"
            href={artworkPhoto(art)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={g.expand}
            tabIndex={room && activeScene !== null ? -1 : 0}
            onClick={(e) => {
              if (!dialog.current?.showModal) return;
              e.preventDefault();
              previousOverflow.current = document.body.style.overflow;
              document.body.style.overflow = "hidden";
              dialog.current.showModal();
              closeButton.current?.focus();
            }}
          >
            <Expand size={21} />
          </a>
        </div>
        {visited.map((i) => (
          <div
            key={i}
            className={`viewer-layer room-layer ${room && activeScene === i ? "is-visible" : ""}`}
            aria-hidden={!room || activeScene !== i}
          >
            <RoomScene
              art={art}
              scene={i}
              locale={locale}
              onReady={() => ready(i)}
              onError={() => {
                if (requested.current === i) setFailed(i);
              }}
            />
          </div>
        ))}
      </div>
      {room && art.category !== "sculptures" && (
        <>
          <div className="scene-options" aria-label={t.room}>
            {roomScenes.map((r, i) => (
              <button
                key={r.id}
                onClick={() => choose(i)}
                aria-pressed={scene === i}
                className={scene === i ? "selected" : ""}
              >
                <Image
                  src={r.file}
                  alt=""
                  width={240}
                  height={160}
                  sizes="(max-width: 800px) 27vw, 16vw"
                />
                <span>{roomNames[locale][i]}</span>
              </button>
            ))}
          </div>
          <p className="fine-print scene-disclosure">{t.roomNote}</p>
          {failed === scene && (
            <p className="fine-print" role="status">
              {g.roomError}
            </p>
          )}
          <p className="sr-only" role="status" aria-live="polite">
            {failed === scene
              ? g.roomError
              : activeScene === scene
                ? roomNames[locale][scene]
                : g.loadingRoom}
          </p>
        </>
      )}
      <dialog
        ref={dialog}
        className="art-dialog"
        aria-label={`${art.title} · ${t.photo}`}
        onClose={() => {
          restore();
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="art-dialog-content">
          <header>
            <div>
              <strong>{art.title}</strong>
              <span>{t.photo}</span>
            </div>
            <button
              ref={closeButton}
              onClick={() => dialog.current?.close()}
              aria-label={g.close}
            >
              <X size={24} />
            </button>
          </header>
          <img src={artworkPhoto(art)} alt={art.title} loading="lazy" />
          <p>
            {t.edition} · {art.width} × {art.height} cm
          </p>
        </div>
      </dialog>
    </div>
  );
}
