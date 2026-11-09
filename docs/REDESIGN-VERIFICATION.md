# Storefront redesign — implementation and evidence

Started 2026-11-08 from ART-WEBSITE-RESEARCH-AND-REDESIGN-PLAN.md. The owner clarifications govern: existing copy, sections, all category controls, languages and transaction/contact workflows stay. No provider settings, credentials, commerce schema, inventory or `_old/` changes.

## Concrete visual direction

The actual five-work collection, existing studio photograph and existing homepage wording form one exhibition catalogue. Atitlan leads when actually available: a large complete original on a neutral mat occupies the right ~60% of the desktop opening; the existing heading uses a characterful serif with a lake-blue italic counterpoint on the left. A fine offset frame responds slightly to the pointer without moving the artwork. Mobile stacks the same material in its reading order.

The collection keeps every filter, but separates available originals from the actual archive and aligns title/material/size/status/price as editorial captions. Desktop card scale and spacing establish a deliberate rhythm; mobile uses large complete images. The existing artist story moves onto a forest pigment surface, alongside the complete real studio photograph and fine caption rules. Clay section numerals, warm ivory paper, serif/sans contrast and the oversized footer initial connect all three sections. No generated portrait, signature, testimonial, live activity or artwork change.

Motion is interaction-specific: a one-time short hero entrance, a decorative pointer response, framed card actions, native Web Animation filter rearrangement, a fluid native mobile menu, and original/room crossfades that retain the current image during loading. Selected studio imagery receives a single subtle entrance. Initial server-rendered content is visible, and reduced-motion visitors keep the same controls with movement disabled.

## Baseline

- Node 24.22.2; existing 71 tests and typecheck pass before edits.
- Isolated local development SQLite, actual five seed artworks (three available, two sold); no writes to a remote inventory or customer DB.
- Before screenshots: `/tmp/larkova-redesign/before-{home,detail}-{390,1440}.png`.
- Three cold mobile lab contexts, viewport390×844, Chromium CPU4×, 80ms latency/200KBps download, served locally. Baseline LCP944/1016/1144ms; CLS0.013 each; resource transfers~436–438KB. These are prelaunch local lab observations, not field INP or a production performance promise.
- Fresh browser reference captures for the five specified sites and access/consent notes: `/tmp/larkova-redesign/references.json` and `reference-*.png`. David Zwirner rendered successfully; Artsy, Saatchi Art and Artfinder returned 403/access checks, and Hauser & Wirth returned a 429 security checkpoint. Those limits are recorded rather than bypassed. No competitor assets copied.

## Fonts and assets

Self-hosted Cormorant Garamond display (Latin/Cyrillic normal/italic), existing DM Sans interface and Manrope for unchanged admin/social surfaces. Unicode subsets load only for characters in use; CJK headings use platform-appropriate serif fallbacks without a huge shared CJK download. All three families use SIL Open Font License 1.1; license files are under `public/fonts/`. Google Fonts CSS/font distribution and google/fonts official OFL sources retrieved 2026-11-08. No external font stylesheet is required at runtime. Originals use `artworkPhoto()`; room assets/scale logic and provenance are preserved.

## Acceptance evidence

- 71/71 Node tests pass, plus Node 24 typecheck and Webpack production build. No dependencies/framework upgrades.
- `tests/redesign_browser.py` passes: original-led hero, true price/status grouping, all retained filters and empty-state contact, rapid repeated filtering, image dialog focus/Escape/return, all three room scenes with unchanged proportions/disclosure, original/room changes, checkout/back and locale route preservation. Mobile touch/menu and Escape focus checks pass.
- All six languages at 360, 390, 768, 1024 and 1440px (30 combinations) have no page overflow. 200% zoom/reflow, skip link, reduced motion and disabled-JavaScript original/catalog/navigation/image-link fallback pass. Reserved/sold/no-available/sculpture/empty states use isolated authoritative fixtures and pass.
- Existing full-store browser regression passes: six locales, mobile navigation, OTP/CSRF, international quote request and one-of-a-kind simulated checkout. Existing photo publishing test passes: OTP, fixed email, throttling/replay/logout, original upload, price and automatic publication. Social Studio's complete existing browser journey passes. No real payment/courier/social/real-email requests.
- A browser accessibility check found the styled native menu summary missing from the accessible button list. Explicit button semantics restore its named, keyboard-focusable control while retaining no-script native details behavior.
- Self-hosted font swapping initially shifted the narrow hero by one line (CLS~0.196). Above-the-fold display faces are preloaded by script, and a responsive reserved heading line box keeps the artwork/next controls steady. Final three cold mobile runs: LCP1128/1040/1064ms (median1064ms versus baseline1016ms); CLS0.045 each (below0.1); transfers~349KB versus436KB (~20% lower). Same local CPU/network profile, not field INP or a production speed promise. Only three needed Latin faces load in the English case; no room scene loads on the initial homepage.
- `tests/redesign_performance.py` repeats the mobile lab profile and an intentional room-image failure. The latter displays an honest error with the original still visible. It asserts median LCP<=2.5s and CLS<=0.1 in this controlled profile.
- New gallery CSS is scoped to `.storefront`; React best-practices checklist applied to effects/cleanup, no per-pointer React updates, server-visible content, bounded interaction motion, native dialog/menu semantics and reduced-motion behavior.
- After screenshots: `/tmp/larkova-redesign/after-{home,detail}-{390,1440}.png`; six mobile locale images: `locale-{es,en,ru,zh,ja,pt}-390.png`. Desktop/mobile motion recordings: `/tmp/larkova-redesign/{desktop,mobile}-gallery.webm`.
- Git whitespace check and project instruction consistency pass. Existing unrelated business/social/marketing/planning work is preserved and excluded from the implementation commit.

No live payment, shipping, social post, real email or production commerce launch is part of this visual change. Delivery setup stays paused. All original copy remains, including the preview/no-real-payment disclosure; prices/statuses still come from current data.

## Release

Target verified: existing `larkovart-dev` project (`prj_ASePEocpNrBuQP3vPOhBg4lVC58K`) in team `team_Q9eV1iiGwCtird9GCFOlALeK`, Node24, protected Preview branch `dev/nextjs-art-store`. Deployment evidence is appended after the hosted build and read-only checks.
