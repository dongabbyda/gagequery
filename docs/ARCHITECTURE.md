# Architecture

## Build pipeline

```
content/*.py + content/concepts.json ─┐
datasets/*.sql ───────────────────────┼─► scripts/build_content.py ─► build/content.json
                                      │        (verifies 1,032 queries)   build/verify_report.json
                                      │
src/{head,shell}.html, logo.svg ──────┤
src/app.js, src/engine.js ────────────┼─► scripts/assemble.py ─► dist/index.html (+ public/*)
node_modules: codemirror, sql.js ─────┘                          build/gagequery.artifact.html
```

`build_content.py` turns each module's Python definition into JSON, attaching per-dataset metadata
(story, row counts, the full SQL script). For every example and exercise variant it creates a fresh in-memory
SQLite database, applies the MySQL shims, runs the SQL and checks:

- examples return rows (or fail on purpose when the example says so); `ref=True` examples are skipped
- exercise results have 1–50 rows (verify queries up to 500), and the declared columns match
- ordered exercises are deterministic (re-run under `PRAGMA reverse_unordered_selects`)
- the model answer obeys its own `forbid` / `require` rules
- a `verify` query gives a different answer before the solution runs (so the check can actually fail)

`assemble.py` minifies CodeMirror with terser and inlines everything: CSS, the content JSON (`#qc-data`),
the sql.js asm build (`#sqljs-src`) and the engine source (`#engine-src`) as text, then the editor and the app.

## Runtime

```
app.js (main thread)                    engine.js (Web Worker, created from a Blob)
  router (#hash) ─ pages                  sql.js (SQLite 3.45) + MySQL shims
  exercise workspace ─────── postMessage ─► open / run / check / snapshot / restore / resetData / schema / selftest
  feedback + mistake detectors ◄──────────  results, errors
  progress (localStorage)
```

- **Worker + timeout.** Each request has a 3–4 s budget; on timeout the worker is terminated and rebuilt from the
  pristine snapshot. If a host's CSP blocks Blob workers the app falls back to the main thread (no timeout) —
  `tests/test_app.py` fails if that happens under the production CSP.
- **Checking.** `check` builds two fresh databases from a pristine `db.export()` snapshot, runs any hidden `pre`
  setup, runs the learner's SQL in one and the model answer in the other, and compares results as multisets
  (or in order when `orderMatters`): numbers within 0.005, text case-insensitive. Exercises with a `verify` query
  (views, indexes, transactions, CREATE TABLE) compare the output of that query after each script instead.
  `forbid` / `require` regex rules are applied to the learner's SQL with comments stripped.
- **Feedback.** On a mismatch `app.js` explains the most likely cause: wrong column count/names, `= NULL`, `||`,
  INNER vs LEFT join, `COUNT(*)` with LEFT JOIN, join fan-out, integer division, missing ROUND, NOT IN with NULLs.
- **Statement rewrites** let learners type MySQL: `START TRANSACTION`→`BEGIN`, `EXPLAIN`→`EXPLAIN QUERY PLAN`,
  `AS SIGNED`→`AS INTEGER`, `DROP INDEX x ON t`, `SHOW TABLES`, `DESCRIBE t`, `CREATE OR REPLACE VIEW`.
  `ATTACH` and `writable_schema` are blocked.
- **Self-test.** `window.__qcSelfTest()` runs every example and model answer through the real browser engine
  and returns `{checked, problems}`; the browser tests call it.

## Why no backend

Running untrusted SQL server-side needs sandboxing, quotas and money. Running it in the browser is free,
private (queries never leave the device), works offline, and scales to any number of learners on static hosting.
A backend is only needed later for accounts, cross-device progress and leaderboards (see `ROADMAP.md`).
