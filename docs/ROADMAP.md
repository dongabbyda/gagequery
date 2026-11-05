# Roadmap

Ordered by value to learners per unit of effort. Items 1–5 need no backend.

## Now

1. **Capstone projects** — one scenario per dataset, ~6 graded tasks each, combining joins, CTEs, window
   functions, CASE and aggregation. The sidebar and course map already show "Capstone · Next".
2. **Module 13: Data Cleaning** — TRIM, REPLACE, COALESCE/NULLIF, CAST, de-duplication with ROW_NUMBER,
   fixing inconsistent text and dates. Needs a deliberately messy table per dataset (add in `generate.py`).
3. **Gaps in existing modules** — LEAD (alongside LAG in M8), UNPIVOT via UNION ALL (M9).
4. **Show expected output** button in the exercise workspace (the model result is already computed on check).
5. **Motivation layer, stored locally** — XP by level (Easy 50 / Medium 100 / Hard 200), daily streak, badges
   (first query, module complete, all windows done), a skills radar on the Progress page.
6. **Practice Arena** — mixed-topic review drawn from completed modules, weighted toward exercises that needed
   hints or failed first.

## Hosting polish

7. **Faster first load** — serve sql.js as WebAssembly (`sql-wasm.js` + `.wasm`) instead of the asm build, and
   load each dataset/module JSON on demand instead of inlining all of it. Target: < 400 KB before first paint.
8. Privacy-friendly analytics and client error reporting; a privacy notice (Nigeria NDPA) once any personal
   data is collected.

## Later (needs a backend)

9. Accounts and cloud progress (e.g. Supabase auth + Postgres), certificates, a leaderboard.
10. AI coach — explain an error, review a query — behind a server-side API key with per-user limits.
    The rule-based feedback already covers most beginner mistakes, so this is an add-on, not a dependency.
11. Payments (Paystack) if the course is sold.

## Deliberately not planned

- A server-side SQL sandbox (cost and security for no learner benefit).
- An admin CMS — content in git with the verifier is safer.
- A framework rewrite — the current single-file app is fast and fully tested.
