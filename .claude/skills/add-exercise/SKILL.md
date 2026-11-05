---
name: add-exercise
description: Add, change or fix a GageQuery example or exercise (all six dataset variants), then verify and test it. Use for any edit under content/.
---

# Add or change a GageQuery exercise

Read `docs/CONTENT_GUIDE.md` first for the field reference and the planted teaching cases.

1. **Decide the question.** One business question with a clear answer. Pick the module whose concepts it
   practises and its level (Easy / Medium / Hard). Check the module's existing exercises so you don't duplicate one.
2. **Explore each dataset** before writing SQL. For each of sales, sport, fashion, politics, finance, healthcare,
   look at the relevant tables in `datasets/<id>.sql` (or load it with Python sqlite3) and find the parallel
   question — same skill, natural for that sector. Lean on planted cases (unmatched rows, NULLs, ties, hierarchies)
   when the skill is about them.
3. **Write the variants** in `content/mNN_mNN.py`: story (one sentence), task (exact columns with aliases, sort
   order, rounding), model SQL in MySQL syntax, `hint2`, `explain`. For DDL/DML use `verify` (+ `pre` to make it
   repeatable) and add `forbid` / `require` rules only when the task is about *how* it is written.
4. **Build:** `npm run build`. Fix every reported problem by changing the content — row count outside 1–50,
   column mismatch, non-deterministic ORDER BY (add a tiebreaker), rule conflict, verify unchanged before solution.
   Never loosen the verifier.
5. **Test:** `npm test` (or `npm run test:fast` while iterating, then the full suite once).
6. **Read it as a learner:** `npm run serve`, open the exercise (`#mNN-eNN`) on at least two datasets, submit one
   typical wrong answer and confirm the feedback helps, then the model answer.
7. Report what you added per dataset and the row count each answer returns.
