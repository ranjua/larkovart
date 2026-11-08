"use client";
import Image from "next/image";
import { useState } from "react";
import { Expand, ImageIcon, Layers3 } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { artworkPhoto, type Artwork } from "@/lib/catalog";
import { RoomScene, roomNames, roomScenes } from "./room-scene";
export function ArtViewer({ art, locale }: { art: Artwork; locale: Locale }) {
  const [room, setRoom] = useState(false);
  const [scene, setScene] = useState(0);
  const t = dictionaries[locale];
  return (
    <div className="art-viewer">
      <div className="viewer-toolbar">
        <div className="viewer-controls">
          <button
            aria-pressed={!room}
            className={!room ? "active" : ""}
            onClick={() => setRoom(false)}
          >
            <ImageIcon size={15} />
            {t.photo}
          </button>
          {art.category !== "sculptures" && (
            <button
              aria-pressed={room}
              className={room ? "active" : ""}
              onClick={() => setRoom(true)}
            >
              <Layers3 size={15} />
              {t.room}
            </button>
          )}
        </div>
        <span className="viewer-index">
          {room ? `0${scene + 2}` : "01"} /{" "}
          {art.category === "sculptures" ? "01" : "04"}
        </span>
      </div>
      {room ? (
        <RoomScene art={art} scene={scene} locale={locale} />
      ) : (
        <div className="detail-image original-photo">
          <Image
            src={artworkPhoto(art)}
            alt={art.title}
            width={1100}
            height={1100}
            priority
            sizes="(max-width: 800px) 95vw, 60vw"
          />
          <a
            className="photo-expand"
            href={artworkPhoto(art)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.photo}
          >
            <Expand size={19} />
          </a>
        </div>
      )}
      {art.category !== "sculptures" && (
        <div className="scene-options" aria-label={t.room}>
          {roomScenes.map((r, i) => (
            <button
              key={r.id}
              onClick={() => {
                setScene(i);
                setRoom(true);
              }}
              aria-pressed={room && scene === i}
              className={room && scene === i ? "selected" : ""}
            >
              <Image
                src={r.file}
                alt=""
                width={240}
                height={160}
                sizes="(max-width: 800px) 30vw, 18vw"
              />
              <span>{roomNames[locale][i]}</span>
            </button>
          ))}
        </div>
      )}
      {room && <p className="fine-print scene-disclosure">{t.roomNote}</p>}
    </div>
  );
}
