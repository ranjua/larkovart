"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Expand, X } from "lucide-react";
import { artworkPhoto, mediumName, type Artwork } from "@/lib/catalog";
import { dictionaries, money, type Locale } from "@/lib/i18n";
import { experienceCopy } from "@/lib/experience-copy";
import { ItemActions } from "./customer/actions";
const Context = createContext<null | {
  selected: Artwork | undefined;
  isViewing: boolean;
  select: (id: string) => void;
  open: (id?: string) => void;
}>(null);
export function useExhibition() {
  return useContext(Context);
}
export function Exhibition({
  works,
  initialId,
  locale,
  children,
}: {
  works: Artwork[];
  initialId?: string;
  locale: Locale;
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(initialId),
    [viewing, setViewing] = useState<string | null>(null);
  const selected = works.find((a) => a.id === selectedId) || works[0];
  const art = works.find((a) => a.id === viewing),
    index = works.findIndex((a) => a.id === viewing);
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(null),
    swipe = useRef<{ x: number; y: number } | null>(null);
  const visualTransition = useRef<ViewTransition | null>(null);
  useEffect(() => () => visualTransition.current?.skipTransition(), []);
  const t = dictionaries[locale],
    e = experienceCopy[locale];
  function setView(next: string | null, animate: boolean) {
    visualTransition.current?.skipTransition();
    if (
      animate &&
      document.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      try {
        const transition = document.startViewTransition(() => {
          flushSync(() => setViewing(next));
        });
        visualTransition.current = transition;
        transition.ready.catch(() => {});
        transition.finished.catch(() => {});
        return;
      } catch {
        /* Older browsers keep the immediate dialog interaction. */
      }
    }
    setViewing(next);
  }
  function open(id?: string) {
    if (!works.length) return;
    opener.current = document.activeElement as HTMLElement;
    const target = id || selected?.id || works[0].id;
    setView(target, target === selected?.id);
  }
  function close() {
    setView(null, viewing === selected?.id);
  }
  const isOpen = viewing !== null;
  useEffect(() => {
    if (!isOpen) return;
    const node = dialog.current;
    if (!node) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      opener.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);
  function change(step: number) {
    visualTransition.current?.skipTransition();
    setViewing(works[(index + step + works.length) % works.length].id);
  }
  return (
    <Context.Provider
      value={{ selected, isViewing: isOpen, select: setSelectedId, open }}
    >
      {children}
      {art && (
        <dialog
          ref={dialog}
          className="exhibition-dialog"
          aria-label={e.gallery}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={() => setViewing(null)}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === "Tab") {
              const controls = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not([disabled]),a[href]",
                ),
              ].filter((el) => el.getClientRects().length > 0);
              const first = controls[0],
                last = controls[controls.length - 1];
              if (
                event.shiftKey &&
                (document.activeElement === first ||
                  document.activeElement === event.currentTarget)
              ) {
                event.preventDefault();
                last?.focus();
              } else if (
                !event.shiftKey &&
                (document.activeElement === last ||
                  document.activeElement === event.currentTarget)
              ) {
                event.preventDefault();
                first?.focus();
              }
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              change(1);
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              change(-1);
            }
          }}
        >
          <div className="exhibition-shell">
            <header className="exhibition-top">
              <span className="exhibition-brand">
                larkova<span> / {e.gallery}</span>
              </span>
              <button
                className="exhibition-close"
                autoFocus
                onClick={close}
                aria-label={e.close}
              >
                <X size={24} />
              </button>
            </header>
            <div
              className="exhibition-stage"
              onPointerDown={(event) => {
                swipe.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerUp={(event) => {
                if (swipe.current) {
                  const dx = event.clientX - swipe.current.x,
                    dy = event.clientY - swipe.current.y;
                  if (Math.abs(dx) > 65 && Math.abs(dy) < 45)
                    change(dx < 0 ? 1 : -1);
                  swipe.current = null;
                }
              }}
            >
              <span className="exhibition-ordinal" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Image
                key={art.id}
                className="exhibition-original"
                loading="eager"
                fetchPriority="high"
                style={{ viewTransitionName: "exhibition-original" }}
                src={artworkPhoto(art)}
                alt={art.title}
                width={1400}
                height={1400}
                sizes="(max-width:700px) 90vw, 75vw"
              />
              <div className="exhibition-arrows">
                <button
                  onClick={() => change(-1)}
                  aria-label={e.previous}
                  disabled={works.length < 2}
                >
                  <ArrowLeft />
                </button>
                <button
                  onClick={() => change(1)}
                  aria-label={e.next}
                  disabled={works.length < 2}
                >
                  <ArrowRight />
                </button>
              </div>
            </div>
            <footer className="exhibition-bottom">
              <div className="exhibition-caption" aria-live="polite">
                <span className="eyebrow">
                  {mediumName(art, locale)} · {art.width} × {art.height} cm
                </span>
                <h2>{art.title}</h2>
                <span>
                  {t[art.status]}
                  {art.status === "available"
                    ? ` · ${money(art.price, locale)}`
                    : ""}
                </span>
              </div>
              <div className="exhibition-action">
                <ItemActions
                  id={art.id}
                  locale={locale}
                  available={art.status === "available"}
                />
                <Link className="button" href={`/${locale}/art/${art.id}`}>
                  {e.view}
                  <ArrowUpRight size={19} />
                </Link>
              </div>
              <div className="exhibition-index">
                <span>
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(works.length).padStart(2, "0")}
                </span>
                <p>{e.hint}</p>
                <span className="exhibition-touch-hint">{e.swipe}</span>
              </div>
            </footer>
          </div>
        </dialog>
      )}
    </Context.Provider>
  );
}
export function ExhibitionLaunch({
  id,
  locale,
  className = "",
}: {
  id?: string;
  locale: Locale;
  className?: string;
}) {
  const gallery = useExhibition();
  if (!gallery?.selected) return null;
  return (
    <button
      className={`exhibition-launch ${className}`}
      onClick={() => gallery.open(id)}
    >
      <Expand size={17} />
      <span>
        {id ? experienceCopy[locale].galleryOpen : experienceCopy[locale].enter}
      </span>
    </button>
  );
}
