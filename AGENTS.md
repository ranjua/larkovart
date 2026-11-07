# Larkova Art development instructions

- Only development data is permitted. Never connect to production databases, live payment accounts, live courier accounts, or production hosting.
- The application is a fresh Next.js implementation. `_old/` is the unmodified archived website; do not import its code.
- Use Node.js 24. Read applicable version-matched Next.js guides in `node_modules/next/dist/docs/` before changing framework behavior.
- Keep secrets in ignored local environment files. Never put them in client code, commits, logs, or command arguments.
- The checkout is a simulation. Do not describe simulated payments, shipping, room previews, or sample prices as verified live services.
- Keep AGENTS.md and CLAUDE.md byte-for-byte identical. Update both together and verify with `cmp AGENTS.md CLAUDE.md`.
- Run `npm test`, `npm run typecheck`, and `npm run build` for relevant application changes.
