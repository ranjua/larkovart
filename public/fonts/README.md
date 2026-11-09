# Font provenance

Downloaded from Google Fonts' official CSS/font distribution on 2026-11-08.
Cormorant Garamond (display), DM Sans (existing interface family), Manrope
(existing Studio/Social heading family). All are redistributed unmodified under
the SIL Open Font License 1.1; each family's license is included here.

`src/app/fonts.css` retains the official Unicode ranges. Only Latin/Latin Extended
and Russian Cyrillic subsets used by this project are included; the browser loads
faces only where needed. Chinese/Japanese use locale-appropriate installed serif
and sans-serif fallbacks rather than downloading a full CJK family to everyone.

Sources:
- https://fonts.google.com/specimen/Cormorant+Garamond
- https://fonts.google.com/specimen/DM+Sans
- https://fonts.google.com/specimen/Manrope
- https://github.com/google/fonts/tree/main/ofl/cormorantgaramond
- https://github.com/google/fonts/tree/main/ofl/dmsans
- https://github.com/google/fonts/tree/main/ofl/manrope
