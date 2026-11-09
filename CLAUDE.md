# GageQuery — notes for Claude Code

GageQuery is an interactive SQL course for beginners: 15 modules (0–13 plus a capstone, 14), six sector datasets (Sales, Sport, Fashion,
Politics, Finance, Healthcare), and exercises that are checked by running SQL **in the learner's browser**.
There is no backend. The build produces one self-contained HTML page plus a few static files in `dist/`.

Owner: Gabriel Agedah. Audience: complete beginners heading for analyst roles, many in Nigeria. Write for them:
plain English, short sentences, business framing, no jargon without a definition.

## Commands

```bash
npm ci                                   # JS build deps (CodeMirror, sql.js, terser) — pinned
pip install -r requirements-dev.txt      # pytest + Playwright
python -m playwright install chromium    # once, for browser tests (python3 on macOS/Linux)

npm run build        # content (verify every query) + assemble dist/ and the artifact fragment
npm test             # full suite: content checks + headless browser tests (about 1.5 min)
npm run test:fast    # content and build checks only, no browser (a few seconds)
npm run serve        # http://127.0.0.1:8000 with production headers
npm run data         # regenerate the five generated datasets (only after changing datasets/generate.py)
```

`npm run build` exits non-zero if any example or exercise fails verification; read the printed problem list.

## Layout

| Path | What it is |
|---|---|
| `src/app.js` | The whole UI: router, pages, exercise workspace, checker feedback, progress (localStorage) |
| `src/engine.js` | SQL engine in a Web Worker: sql.js (SQLite) + MySQL compatibility shims, check/verify logic |
| `src/head.html` | `<title>`, fonts, and all CSS (theme tokens, light + dark) |
| `src/shell.html`, `src/logo.svg` | Static page frame (top bar, rail, palette) |
| `content/m00.py`, `content/mNN_mNN.py` | Course content (Module 0 alone, then two modules per file): examples + exercises with a variant per dataset. `m13_m14.py` holds Data Cleaning and the capstone |
| `content/concepts.json` | Concept definitions (term, what, when/why) pulled in by `concept_weeks` |
| `datasets/*.sql` | The six databases. `sales.sql` (ShopCorp) is hand-written except its `web_signups` block; the other five come from `generate.py`. Each ends with a deliberately messy sign-up table for Module 13 |
| `scripts/build_content.py` | Builds `build/content.json`; runs every query on every dataset with Python sqlite3 + the same shims |
| `scripts/assemble.py` | Inlines everything into `dist/index.html` and `build/gagequery.artifact.html` |
| `scripts/py.js` | Runs Python for the npm scripts: picks a working interpreter (`py`/`python` on Windows) in UTF-8 mode |
| `scripts/serve.py` | Local static server that applies `public/_headers` |
| `public/` | Copied into `dist/` as-is (`_headers` CSP, favicon, robots.txt) |
| `tests/` | pytest: `test_content.py` (fast) and `test_app.py` (Playwright, marker `browser`) |
| `docs/` | `ARCHITECTURE.md`, `CONTENT_GUIDE.md`, `ROADMAP.md` |

`build/` and `dist/` are generated — never edit them by hand.

## Rules that keep the course correct

1. **Every query is verified on all six datasets.** A change is done only when `npm run build` prints `problems 0`
   and `npm test` passes. Never weaken a verifier rule to make content pass; fix the content.
2. **Answers must be deterministic.** Exercises where `order=True` need an `ORDER BY` that fully decides row
   order (the verifier re-runs with `PRAGMA reverse_unordered_selects` to catch ties). Result sizes: 1–50 rows
   (up to 500 for `verify` queries).
3. **"Today" is fixed at 2025-12-31** in every dataset and in `CURDATE()`. Never use the real date.
4. **Shims exist twice and must match:** the MySQL-style functions (`CONCAT`, `DATE_FORMAT`, `YEAR`, `DATEDIFF`,
   `LPAD`, half-up `ROUND`, …) are registered in `src/engine.js` (browser) **and** `scripts/build_content.py`
   (verifier). Add or change a function in both, or the checker and the build will disagree.
   sql.js keeps one function per name, so variadic functions are registered with length -1.
5. **Learners write MySQL.** The engine is SQLite, so keep exercises to syntax that means the same in MySQL 8.
   Anything SQLite cannot run (procedures, functions, triggers, isolation levels) is an example with `ref=True`
   (shown read-only, labelled "MySQL server only"), never an exercise.
6. **Datasets are reproducible.** `datasets/generate.py` is seeded; `tests/test_content.py` regenerates into a temp
   folder and compares byte-for-byte. If you change a generator, run `npm run data`, rebuild, and expect many
   answers to change — re-check row counts and planted teaching cases (see `docs/CONTENT_GUIDE.md`).
7. **No network at runtime.** Everything is inlined, fonts included (variable Latin subsets from `@fontsource-variable/*`, base64 in `assemble.py`); the page makes no external request, except one optional anonymous visit counter (an image request to GoatCounter, added only when the build gets `GOATCOUNTER_URL`; the Pages workflow sets it, local builds and tests do not). The CSP in
   `public/_headers` is what production serves and what the browser tests run under. Do not add `eval`,
   `new Function`, or remote scripts.
8. **Progress lives in localStorage** under `gagequery-v1` (falls back to the old `querycraft-v1` key). Changing
   the shape of the saved state needs a migration, not a new key: bump `S.v` and extend `migrate()` in `src/app.js`.
   XP, levels, streaks and badges are derived from the saved state, not stored.

## Writing content

Follow `docs/CONTENT_GUIDE.md` (field reference + style rules) or use the `add-exercise` skill in
`.claude/skills/`. Task text: one business question, the exact output columns, the sort order, nothing else.

## Before you finish a change

- `npm run build` → `problems 0`
- `npm test` → all green
- If you touched UI: `npm run serve` and look at a desktop width and 390px wide in both themes.
- Keep commits small and say which modules/datasets changed.
