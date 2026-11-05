# Content guide

Course content lives in `content/mNN_mNN.py`, two modules per file. Each module is a dict; the build validates it.

## Module

```python
M3 = dict(
    id='m03', number=3, phase=1, title='Summarising Data: Aggregates, GROUP BY and HAVING', minutes=240,
    objectives=['Summarise a whole table with COUNT, SUM, AVG, MIN and MAX', ...],
    concept_weeks=[3],            # pulls concept cards from content/concepts.json (week numbers)
    extra_concepts=[...],         # optional: dict(term=..., what=..., whenWhy=...)
    examples=[...],
    exercises=[...],
)
```

To add a module: create the dict, import it in `scripts/build_content.py`, add it to the module loop, and add its
short sidebar label/phase in `src/app.js` (`SHORT` / `PHASES`).

## Example

```python
dict(title='Aggregate functions turn many rows into one', level='Easy',   # Easy | Medium | Hard
     explanation='What it shows and why an analyst uses it (1–2 sentences).',
     tryIt='One small change the learner should try.',                 # 'fails on purpose' = last statement must error
     visual=None,                                                       # optional diagram id used by app.js
     pre=None,                                                          # optional setup SQL (str, or dict per dataset)
     ref=False,                                                         # True = MySQL-only, shown read-only, not run
     v=dict(sales='SELECT ...', sport='SELECT ...', fashion='...', politics='...', finance='...', healthcare='...'))
```

## Exercise

```python
dict(level='Medium', concepts=['SUM', 'WHERE', 'GROUP BY'],
     order=True,                       # True: row order is part of the answer (needs a fully deciding ORDER BY)
     hint2='The written hint (hint 1 is generated from tables/columns; hint 3 is a fill-in skeleton).',
     explain='Shown with the model answer: why this SQL is right.',
     v=dict(
         # simple form: (story, task, columns or None, model SQL)
         sales=('ShopCorp wants ...', 'Show ... Sort by ...', ['category', 'revenue'], 'SELECT ...'),
         # full form, for scripts and rules:
         finance=dict(story=..., task=..., cols=None, sql='START TRANSACTION; ...; ROLLBACK;',
                      pre='hidden setup run before both answers',
                      verify='SELECT ... -- inspects the database after the script; compared instead of the result',
                      verifyMsg='Shown when the verify result differs',
                      forbid=[r'NOT\s+IN\b', 'Message when the pattern appears'],        # one [pattern, message]
                      require=[[r'\bROLLBACK\b', 'Message when the pattern is missing']]),  # list of [pattern, message]
         ...))
```

Every exercise needs all six datasets. Generate repetitive variants with a helper (see `IDX`/`SARG` in
`m11_m12.py`) rather than copy-pasting.

## Writing rules

- **One business question per task**, in plain words. Name the exact output columns and the sort order.
  Good: "List each category with its total revenue as `revenue`, highest first."
- **Story** sets the scene in one sentence; **task** is the instruction. Don't hide requirements in the story.
- Use aliases learners can type: lowercase, underscores, no spaces.
- Round money to 2 decimals and say so in the task.
- Prefer questions whose answer reveals something (a gap, a top performer, a trap) over arbitrary filters.
- Easy → Medium → Hard within a module. Hard exercises combine at most one new idea with earlier ones.

## Planted teaching cases (do not remove)

The datasets contain rows that make classic mistakes visible. Exercises rely on them:

| Dataset | Planted cases |
|---|---|
| Sales (ShopCorp) | customers with no orders; NULLs in optional fields; employee→manager hierarchy |
| Sport | Riverside Rovers has no players; 6 free agents (`team_id` NULL); staff `reports_to` hierarchy |
| Fashion | Riviera SS26 collection (2026) → 2 never-sold products; 8 customers never bought; walk-in sales with NULL customer |
| Politics | Silver party has no candidates; independents with NULL `party_id`; split-party chains Blue→Teal→Cyan, Red→Orange |
| Finance | 28 customers with no loans; 11 NULL credit scores; unpaid repayments (`paid_date` NULL); manager hierarchy |
| Healthcare | patients 149–160 never seen; doctor `supervisor_id` hierarchy |

## Checklist

1. `npm run build` → `problems 0` (fix row counts, columns, ordering, rule conflicts it reports)
2. `npm test`
3. Open the exercise in `npm run serve` on two datasets: does the task read naturally? Does a typical wrong
   answer get a useful message?
