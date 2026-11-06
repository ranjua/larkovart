"use client";
import Image from "next/image";
import { useState } from "react";
import { dictionaries, type Locale } from "@/lib/i18n";
import type { Artwork } from "@/lib/catalog";
export function ArtViewer({ art, locale }: { art: Artwork; locale: Locale }) {
  const [room, setRoom] = useState(false);
  const t = dictionaries[locale];
  return (
    <div>
      <div className={room ? "detail-image room-scene" : "detail-image"}>
        <Image
          src={art.image}
          alt={art.title}
          width={1100}
          height={1100}
          priority
          sizes="(max-width: 800px) 90vw, 55vw"
        />
        {room && <div className="room-bench" aria-hidden="true" />}
      </div>
      <div className="viewer-controls">
        <button
          aria-pressed={!room}
          className={!room ? "active" : ""}
          onClick={() => setRoom(false)}
        >
          {t.photo}
        </button>
        <button
          aria-pressed={room}
          className={room ? "active" : ""}
          onClick={() => setRoom(true)}
        >
          {t.room}
        </button>
      </div>
      {room && <p className="fine-print">{t.roomNote}</p>}
    </div>
  );
}
