"use client";
import { useEffect } from "react";
let entryPlayed = false;
export function GalleryMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".storefront");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    const animations: Animation[] = [];
    if (!entryPlayed) {
      entryPlayed = true;
      root
        .querySelectorAll<HTMLElement>("[data-hero-enter]")
        .forEach((el, i) => {
          animations.push(
            el.animate(
              [
                { opacity: 0.35, transform: "translateY(16px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              {
                duration: 460,
                delay: Math.min(i * 55, 165),
                easing: "cubic-bezier(.2,.7,.2,1)",
              },
            ),
          );
        });
    }
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (e.isIntersecting) {
                  if (!reduced.matches)
                    animations.push(
                      (e.target as HTMLElement).animate(
                        [
                          { opacity: 0.7, transform: "translateY(12px)" },
                          { opacity: 1, transform: "translateY(0)" },
                        ],
                        { duration: 420, easing: "ease-out" },
                      ),
                    );
                  observer?.unobserve(e.target);
                }
              }
            },
            { threshold: 0.15 },
          )
        : null;
    root
      .querySelectorAll("[data-section-enter]")
      .forEach((el) => observer?.observe(el));
    const depth = root.querySelector<HTMLElement>("[data-depth]");
    let frame = 0,
      x = 0,
      y = 0;
    function move(e: PointerEvent) {
      if (
        reduced.matches ||
        !matchMedia("(hover: hover) and (pointer: fine)").matches ||
        !depth
      )
        return;
      const rect = depth.getBoundingClientRect();
      x = (e.clientX - rect.left) / rect.width - 0.5;
      y = (e.clientY - rect.top) / rect.height - 0.5;
      if (!frame)
        frame = requestAnimationFrame(() => {
          depth!.style.setProperty("--depth-x", `${x * 12}px`);
          depth!.style.setProperty("--depth-y", `${y * 12}px`);
          frame = 0;
        });
    }
    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      depth?.style.setProperty("--depth-x", "0px");
      depth?.style.setProperty("--depth-y", "0px");
    };
    const stop = () => {
      reset();
      if (reduced.matches || document.hidden)
        animations.forEach((a) => a.cancel());
    };
    depth?.addEventListener("pointermove", move);
    depth?.addEventListener("pointerleave", reset);
    reduced.addEventListener("change", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      observer?.disconnect();
      reset();
      animations.forEach((a) => a.cancel());
      depth?.removeEventListener("pointermove", move);
      depth?.removeEventListener("pointerleave", reset);
      reduced.removeEventListener("change", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);
  return null;
}
