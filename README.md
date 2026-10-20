# SparxDeck

Software for fire-safety service companies: equipment register, QR labels, inspections on the phone, PDF reports and inspection deadlines.

| App | Path | URL | Stack |
|---|---|---|---|
| Landing page | [apps/landingpage](apps/landingpage) | sparxdeck.com | Next.js 16, Tailwind 4, 16 languages |
| Platform | [apps/platform](apps/platform) | portal.sparxdeck.com | Next.js 16, Supabase, next-intl |

Each app installs its own dependencies (`npm install` inside the app folder). See [apps/platform/README.md](apps/platform/README.md) for setting up the platform.

Planning: [docs/ROADMAP.md](docs/ROADMAP.md) (parts and status), [docs/CHECKLIST.md](docs/CHECKLIST.md) (features by priority), [docs/SPEC.md](docs/SPEC.md) (data model). Working notes for Claude: [CLAUDE.md](CLAUDE.md).
