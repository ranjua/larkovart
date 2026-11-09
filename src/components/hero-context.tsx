"use client";
import { useState } from "react";
import { ArrowUpRight, Minus } from "lucide-react";
import type { Artwork } from "@/lib/catalog";
import { dictionaries, type Locale } from "@/lib/i18n";
import { RoomScene } from "./room-scene";
export function HeroContext({ art, locale }: { art: Artwork; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const t = dictionaries[locale];
  return (
    <div className="hero-context">
      <button
        aria-expanded={open}
        aria-controls="hero-room-context"
        onClick={() => setOpen(!open)}
      >
        {t.room}
        {open ? <Minus size={17} /> : <ArrowUpRight size={17} />}
      </button>
      {open && (
        <div id="hero-room-context" className="hero-context-panel">
          <RoomScene art={art} locale={locale} />
          <p className="fine-print">{t.roomNote}</p>
        </div>
      )}
    </div>
  );
}
