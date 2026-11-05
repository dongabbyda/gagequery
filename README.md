# GageQuery

**Learn SQL by doing.** GageQuery is an interactive SQL course for beginners heading into analyst roles.
Every lesson has runnable examples and exercises, and every answer is checked instantly — in the learner's
own browser, with no server and no sign-up.

- **12 modules** in three phases: Fundamentals → Intermediate SQL & Analytics → Advanced SQL & Optimisation
- **6 real-world datasets**, switchable at any time: Sales (ShopCorp), Sport, Fashion, Politics, Finance, Healthcare
- **68 examples and 60 exercises**, each written for all six datasets (360 checked exercise variants)
- **Smart checking:** compares results, not text; catches common mistakes (`= NULL`, fan-out joins, integer
  division, the `NOT IN` + `NULL` trap); checks views, indexes and transactions by inspecting the database afterwards
- **Three-level hints**, model answers with explanations, undoable reset, progress export/import, light and dark themes, phone-friendly

## Quick start

Requirements: Node 18+, Python 3.10+ (linked to SQLite 3.39+).

```bash
npm ci
pip install -r requirements-dev.txt
python3 -m playwright install chromium   # only needed for browser tests

npm run build    # verify all content and build dist/
npm run serve    # open http://127.0.0.1:8000
npm test         # content checks + end-to-end browser tests
```

## How it works

The build runs every example and model answer against every dataset (768 queries) using Python's SQLite with
the same MySQL compatibility functions the app uses, and refuses to build if anything is off. It then inlines the
SQL engine ([sql.js](https://github.com/sql-js/sql.js)), the editor ([CodeMirror 5](https://codemirror.net/5/)),
the course content and all six databases into one page. In the browser the engine runs in a Web Worker with a
time limit, so a runaway query can't freeze the page.

More: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) ·
[`docs/ROADMAP.md`](docs/ROADMAP.md)

## Deploying

`dist/` is a static site. Any static host works; hosts that read `_headers` (Cloudflare Pages, Netlify) also
apply the security headers in `public/_headers`.

| Host | Build command | Output folder |
|---|---|---|
| Cloudflare Pages | `npm run build` | `dist` |
| Netlify | `npm run build` (already in `netlify.toml`) | `dist` |
| Anything else | build locally or in CI, upload `dist/` | — |

The build needs Python 3 on the build machine. The page is ~3.5 MB uncompressed and ~740 KB gzipped; hosts
compress it automatically.

The same build also writes `build/gagequery.artifact.html`, a fragment that can be published as a claude.ai Artifact.

## Working on it with Claude Code

`CLAUDE.md` holds the project rules (verification, determinism, the fixed "today", the twin shim layers).
`.claude/skills/add-exercise` walks through adding or changing exercises safely. Start a session in the repo
root and ask for the change you want; ask it to finish with `npm run build` and `npm test`.

## Licence

Not yet chosen. Until a licence is added, all rights are reserved by the author.
