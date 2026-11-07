# Larkovart project instructions

- This project's home is `/home/randy/larkovart`. Its repository is `https://github.com/ranjua/larkovart`.
- The previous workspace's development-only instructions do not apply here. The user authorizes production development, configuration, database work and deployment for Larkovart.
- Act as the lead developer: complete authorized work autonomously, verify results, and keep required manual setup instructions short and direct.
- Production access is permitted; verify the intended account, project, environment and data before changes. Protect existing customer orders, inventory and artwork. Do not delete data, charge customers or buy services without specific authorization.
- Never expose credentials in code, commits, client bundles, logs or command arguments. Keep local secrets in ignored files and hosted secrets in environment settings.
- Preserve `_old/` as the archived website. Develop the new Next.js storefront without importing archived code.
- Use Node.js 24. Run relevant tests, type checking and builds before deployment. Verify the deployed application and report actual payment/courier connection status accurately.
- Prefer automated payments, courier selection, labels, pickup and tracking. Keep uncertain provider writes from creating duplicate transactions or shipments.
- Keep `AGENTS.md` and `CLAUDE.md` identical when updating project instructions.
