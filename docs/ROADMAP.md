# Roadmap

Ordered by value to learners per unit of effort. Items 1–2 need no backend.

## Done in 0.13

- Module 0 (start here), Module 13 (Data Cleaning, on a messy sign-up table per dataset) and the capstone (Module 14).
- LEAD in Module 8; Show expected output; a checklist of what already matches plus structural mistake tips.
- XP and levels, daily and weekly streaks, badges, a skills radar, and the Practice Arena (all in localStorage).

## Now

1. **Gaps in existing modules** — UNPIVOT via UNION ALL (M9).
2. **More capstone scenarios** — a second business review per dataset, so the capstone can be repeated.

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
