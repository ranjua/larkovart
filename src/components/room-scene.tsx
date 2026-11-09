import Image from "next/image";
import { artworkPhoto, type Artwork } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";

export const roomScenes = [
  { id: "living", file: "/rooms/sunlit-living.png", x: 51, y: 36 },
  { id: "gallery", file: "/rooms/quiet-gallery.png", x: 50, y: 43 },
  { id: "reading", file: "/rooms/warm-reading.png", x: 55, y: 40 },
] as const;
export const roomNames: Record<Locale, readonly string[]> = {
  en: ["Sunlit living", "Quiet gallery", "Warm reading room"],
  es: ["Sala luminosa", "Galería serena", "Rincón de lectura"],
  ru: ["Светлая гостиная", "Тихая галерея", "Уголок для чтения"],
  zh: ["日光客厅", "静谧画廊", "温暖书房"],
  ja: ["光のリビング", "静かなギャラリー", "温かな書斎"],
  pt: ["Sala iluminada", "Galeria serena", "Canto de leitura"],
};
export function RoomScene({
  art,
  scene = 0,
  locale,
  priority = false,
  onReady,
  onError,
}: {
  art: Artwork;
  scene?: number;
  locale: Locale;
  priority?: boolean;
  onReady?: () => void;
  onError?: () => void;
}) {
  const index = Math.min(2, Math.max(0, scene));
  const room = roomScenes[index];
  // One shared coordinate system: photographs are 3:2 and the wall is approximately 250cm wide.
  const width = Math.min(
    (art.width / 250) * 100,
    36,
    48 / ((art.height / art.width) * 1.5),
  );
  return (
    <div className="room-scene" data-scene={room.id}>
      <Image
        className="room-background"
        onLoad={onReady}
        onError={onError}
        src={room.file}
        alt={roomNames[locale][index]}
        width={1536}
        height={1024}
        sizes="(max-width: 800px) 100vw, 65vw"
        priority={priority}
      />
      <div
        className="room-art"
        style={{
          left: `${room.x}%`,
          top: `${room.y}%`,
          width: `${width}%`,
          aspectRatio: `${art.width} / ${art.height}`,
        }}
      >
        <Image
          src={artworkPhoto(art)}
          alt={art.title}
          fill
          sizes="(max-width: 800px) 30vw, 22vw"
          priority={priority}
        />
      </div>
    </div>
  );
}
