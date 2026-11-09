# Immersive exhibition experience

The owner requested a stronger opening and an art experience beyond the previous
catalogue presentation. The homepage now uses a deep blue-green exhibition
surface, expressive cream/copper typography, oversized original photography,
ornamental contour drawing, pointer-responsive ambient light and depth, and a
real featured-work selector. Existing artist copy and all categories remain.

**Enter the gallery** opens a native full-screen dialog. The selected original
expands into that view on browsers supporting View Transitions; reduced motion
and older browsers use immediate opening. Every published work can be explored
with buttons, arrow keys and real touch swipes. Explicit keyboard focus wrapping,
Escape/close, opener focus restoration and page-scroll restoration are verified.
Only the current gallery photograph loads eagerly. Rapid navigation skips an
unfinished transition so an old snapshot cannot obscure the next artwork.

The collection is now an editorial spread with a larger lead original and
per-work gallery entry. A photographic inspection section offers 1×–2.5× zoom,
pointer exploration and reset. It uses the real original image, with a clear
magnification disclosure. No detail, signature, studio footage or artwork was
generated or recolored. Studio/artist and delivery chapters have distinct visual
surfaces. Public header/footer follow the new palette; private Studio/Social
styles and payment, inventory, shipping and account services are unchanged.

## Verification

- 78 Node tests passed, including the Google callback/session regression.
- TypeScript and the optimized Next.js webpack build passed using Node 24.
- `tests/experience_browser.py` passed: original-first hero, featured selection,
  live metadata/link changes, gallery keyboard/focus/Escape, actual CDP touch
  swipe, sold-state honesty, zoom/reset, category filters, 30 locale/width
  combinations, 200% reflow, reduced motion and JavaScript-disabled originals.
- `tests/customer_browser.py` passed: verified signup, optional OTP, private saved
  collections, guest merging, cart prices/availability, Studio isolation and
  authentic photo-set editing/revisions.
- Social Studio browser regression passed: OTP, private API/CSRF, drafting,
  media export, scheduling, seven mobile tabs and callback rejection; no provider
  traffic.
- Existing redesign checks cover original-image dialog, all three room scenes,
  checkout/back, mobile navigation, inventory variants and empty/sculpture states.
- No real accounts, emails, Google consent, payments, shipments or social posts
  were created during browser fixtures. All fixture data uses isolated SQLite.

Local mobile lab: Chromium at 390×844, CPU 4× slowdown, 80 ms latency and
200 KB/s download, three runs. LCP: 868 / 820 / 784 ms (median 820 ms).
CLS: 0.0687 / 0.0687 / 0.0747. Initial resource transfer approximately 355 KB.
These are local lab measurements, not hosted field metrics. The existing local
LCP ≤2.5 s and CLS ≤0.1 targets pass. Blocked room-image requests preserve the
original and display the existing error disclosure.

Visual evidence is generated in `/tmp/larkova-experience/`:
`desktop-opening.png`, `desktop-full.png`, `desktop-gallery.png`,
`mobile-opening.png`, `mobile-gallery.png`, `mobile-inspector.png`, and desktop/
mobile WebM recording folders. Performance evidence:
`/tmp/larkova-redesign/after-metrics.json`.
