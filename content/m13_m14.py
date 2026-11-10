# Modules 13 (Data Cleaning) and 14 (Capstone).
# Module 13 runs on the raw sign-up table each dataset carries (see messy() in datasets/generate.py).
# The checker ignores case and outer spaces, so exercises about TRIM/UPPER/LOWER use `require` rules.

CL = {  # table, lookup column, clean lookup table and its name column, amount column, currency symbol, who asks, what a row is
 'sales': dict(t='web_signups', look='interest', dim='categories', key='category_name', amt='first_order_value', cur='$',
               team='ShopCorp marketing', form="the website sign-up form", row='sign-ups'),
 'sport': dict(t='fan_signups', look='favourite_team', dim='teams', key='team_name', amt='membership_fee', cur='$',
               team='The league fan club', form='the fan club sign-up form', row='fan sign-ups'),
 'fashion': dict(t='newsletter_signups', look='preferred_store', dim='stores', key='store_name', amt='first_order_value', cur='$',
                 team='The CRM team', form='the newsletter sign-up form', row='subscribers'),
 'politics': dict(t='volunteer_signups', look='region', dim='regions', key='region_name', amt='pledge_amount', cur='$',
                  team='The volunteer office', form='the volunteer sign-up form', row='volunteer sign-ups'),
 'finance': dict(t='loan_applications', look='branch', dim='branches', key='branch_name', amt='amount_requested', cur='₦',
                 team='Credit operations', form='the online loan application form', row='applications'),
 'healthcare': dict(t='patient_intake', look='department', dim='departments', key='department_name', amt='deposit_paid', cur='$',
                    team='Patient services', form='the online intake form', row='intake forms'),
}

NAME = "REPLACE(UPPER(TRIM(full_name)), '  ', ' ')"
EMAIL = 'LOWER(TRIM(email))'
PHONE = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')"
DAY = "REPLACE(REPLACE(signup_date, '/', '-'), '.', '-')"
SOURCE = ("CASE WHEN LOWER(TRIM(source)) IN ('web', 'website') THEN 'Web'\n"
          "            WHEN LOWER(TRIM(source)) IN ('mobile app', 'app') THEN 'Mobile App'\n"
          "            WHEN LOWER(TRIM(source)) IN ('referral', 'friend referral') THEN 'Referral'\n"
          "            WHEN LOWER(TRIM(source)) IN ('walk-in', 'walk in', 'walkin') THEN 'Walk-in'\n"
          "            ELSE 'Other' END")


def money(c):
    return "CAST(REPLACE(REPLACE(NULLIF(TRIM(%s), ''), '%s', ''), ',', '') AS DECIMAL(12,2))" % (c['amt'], c['cur'])


def each(fn):
    return {ds: fn(c) for ds, c in CL.items()}


M13_EXAMPLES = [
 dict(title='Look at the raw data before you clean it', level='Easy',
      explanation='Data from forms and spreadsheets is rarely tidy. Start by reading some raw rows. Wrapping a value in brackets with CONCAT shows spaces you would otherwise miss.',
      tryIt='Find three different ways the same source is written.',
      v=each(lambda c: "SELECT signup_id,\n       CONCAT('[', full_name, ']') AS name_as_stored,\n       email, signup_date, source, %s\nFROM %s\nORDER BY signup_id\nLIMIT 12;" % (c['amt'], c['t']))),
 dict(title='TRIM, UPPER and LOWER tidy text', level='Easy',
      explanation='TRIM removes spaces at the start and end. UPPER and LOWER make the case consistent, so the same value is always written the same way. REPLACE(text, two spaces, one space) fixes a doubled space inside a name.',
      tryIt='Remove the TRIM and look at the brackets again.',
      v=each(lambda c: "SELECT signup_id,\n       CONCAT('[', full_name, ']') AS before_clean,\n       CONCAT('[', %s, ']') AS after_clean,\n       %s AS email_clean\nFROM %s\nORDER BY signup_id\nLIMIT 10;" % (NAME, EMAIL, c['t']))),
 dict(title='A blank is not a NULL: NULLIF and COALESCE', level='Easy',
      explanation="COUNT(email) skips NULLs but still counts empty text (''). NULLIF(TRIM(email), '') turns a blank into a real NULL, and COALESCE(value, 'fallback') puts a label where the value is missing.",
      tryIt="Change 'no email given' to another label.",
      v=each(lambda c: "SELECT COUNT(*) AS all_rows,\n       COUNT(email) AS email_not_null,\n       COUNT(NULLIF(TRIM(email), '')) AS email_present,\n       SUM(CASE WHEN COALESCE(NULLIF(TRIM(email), ''), 'no email given') = 'no email given' THEN 1 ELSE 0 END) AS email_missing\nFROM %s;" % c['t'])),
 dict(title='REPLACE and CAST turn text into numbers', level='Medium',
      explanation="Money copied from a spreadsheet often arrives as text such as '%s1,250.00'. CAST cannot read the symbol or the comma, so remove them with REPLACE first. Strip spaces, dashes, dots and brackets from phone numbers the same way." % '$',
      tryIt='Remove the two REPLACE calls around the amount and see what CAST gives for a value with a symbol.',
      v=each(lambda c: "SELECT signup_id,\n       phone,\n       %s AS phone_digits,\n       %s AS amount_as_text,\n       %s AS amount_value\nFROM %s\nORDER BY signup_id\nLIMIT 10;" % (PHONE, c['amt'], money(c), c['t']))),
 dict(title='Standardise labels with CASE', level='Medium',
      explanation="People type the same answer many ways: 'Web', ' web', 'website'. Compare a trimmed, lower-case version against every spelling you have seen, and map each group to one clean label. Keep an ELSE so new spellings show up instead of disappearing.",
      tryIt="Remove 'website' from the first list and see where those rows go.",
      v=each(lambda c: "WITH s AS (\n    SELECT %s AS source_clean\n    FROM %s\n)\nSELECT source_clean, COUNT(*) AS signups\nFROM s\nGROUP BY source_clean\nORDER BY signups DESC, source_clean;" % (SOURCE, c['t']))),
 dict(title='Fix dates stored as text so they sort', level='Medium',
      explanation="Text sorts character by character, and '-' comes before '.' and '/'. So '2025/01/02' sorts after '2025-12-01'. REPLACE every separator with '-' and the dates sort, compare and group correctly.",
      tryIt='Sort by signup_day instead of signup_date.',
      v=each(lambda c: "SELECT signup_id,\n       signup_date AS as_stored,\n       %s AS signup_day\nFROM %s\nORDER BY signup_date, signup_id\nLIMIT 12;" % (DAY, c['t']))),
 dict(title='Find duplicates with GROUP BY and HAVING', level='Medium',
      explanation='The same person can sign up twice with their email typed differently. Clean the email, group on the clean value, and keep the groups with more than one row.',
      tryIt='Group on email without LOWER and TRIM and compare the result.',
      v=each(lambda c: "SELECT %s AS email_clean, COUNT(*) AS copies\nFROM %s\nWHERE NULLIF(TRIM(email), '') IS NOT NULL\nGROUP BY %s\nHAVING COUNT(*) > 1\nORDER BY copies DESC, email_clean;" % (EMAIL, c['t'], EMAIL))),
 dict(title='Keep one row per person with ROW_NUMBER', level='Hard',
      explanation='ROW_NUMBER() OVER (PARTITION BY clean_email ORDER BY date) numbers each person\'s rows, earliest first. Row 1 is the one to keep; every row numbered 2 or more is a duplicate.',
      tryIt='Change copy_no > 1 to copy_no = 1 to list the rows you keep.',
      v=each(lambda c: "WITH ranked AS (\n    SELECT signup_id,\n           %s AS email_clean,\n           %s AS signup_day,\n           ROW_NUMBER() OVER (PARTITION BY %s ORDER BY %s, signup_id) AS copy_no\n    FROM %s\n    WHERE NULLIF(TRIM(email), '') IS NOT NULL\n)\nSELECT signup_id, email_clean, signup_day, copy_no\nFROM ranked\nWHERE copy_no > 1\nORDER BY email_clean, copy_no;" % (EMAIL, DAY, EMAIL, DAY, c['t']))),
 dict(title='Join on a cleaned key', level='Medium',
      explanation='A label typed by a person rarely matches a clean lookup table exactly. Clean both sides of the ON condition, and use a LEFT JOIN so the rows that still do not match stay visible for someone to fix.',
      tryIt='Remove LOWER and TRIM from the ON condition and count how many rows stop matching.',
      v=each(lambda c: "SELECT s.signup_id,\n       s.%s AS as_typed,\n       d.%s AS matched_to\nFROM %s s\nLEFT JOIN %s d ON LOWER(d.%s) = LOWER(TRIM(s.%s))\nORDER BY CASE WHEN d.%s IS NULL THEN 0 ELSE 1 END, s.signup_id\nLIMIT 12;" % (c['look'], c['key'], c['t'], c['dim'], c['key'], c['look'], c['key']))),
]


def _m13_e1(c):
    return dict(story='%s wants a clean contact list from %s.' % (c['team'], c['form']),
                task='For every row, return signup_id, name_clean (trimmed, in capitals, with single spaces between words) and email_clean (trimmed and in lower case). Sort by signup_id.',
                cols=['signup_id', 'name_clean', 'email_clean'],
                sql='SELECT signup_id,\n       %s AS name_clean,\n       %s AS email_clean\nFROM %s\nORDER BY signup_id;' % (NAME, EMAIL, c['t']),
                require=[[r'\bTRIM\s*\(', 'Use TRIM to remove the spaces at the start and end of the values.'],
                         [r'\bUPPER\s*\(', 'Use UPPER to put the names in capitals.'],
                         [r'\bLOWER\s*\(', 'Use LOWER to put the emails in lower case.']])


def _m13_e2(c):
    return dict(story='%s needs to know how much contact data is missing before a mail-out.' % c['team'],
                task="Return total_rows, missing_email (rows where email is NULL or blank) and missing_%s (rows where %s is NULL or blank). A value that is only spaces counts as blank." % (c['look'], c['look']),
                cols=['total_rows', 'missing_email', 'missing_' + c['look']],
                sql="SELECT COUNT(*) AS total_rows,\n       COUNT(*) - COUNT(NULLIF(TRIM(email), '')) AS missing_email,\n       COUNT(*) - COUNT(NULLIF(TRIM(%s), '')) AS missing_%s\nFROM %s;" % (c['look'], c['look'], c['t']))


def _m13_e3(c):
    return dict(story='%s wants to know which channels bring in %s, but the source column is typed by hand.' % (c['team'], c['row']),
                task="Standardise source into Web ('web', 'website'), Mobile App ('mobile app', 'app'), Referral ('referral', 'friend referral') and Walk-in ('walk-in', 'walk in', 'walkin'), ignoring case and outer spaces. Return source_clean and signups, most first, then source_clean.",
                cols=['source_clean', 'signups'],
                sql='WITH s AS (\n    SELECT %s AS source_clean\n    FROM %s\n)\nSELECT source_clean, COUNT(*) AS signups\nFROM s\nGROUP BY source_clean\nORDER BY signups DESC, source_clean;' % (SOURCE, c['t']))


def _m13_e4(c):
    return dict(story='%s wants the monthly value of %s, but the dates and the %s column are stored as text.' % (c['team'], c['row'], c['amt']),
                task="Clean signup_date (replace '/' and '.' with '-') and turn %s into a number (remove '%s' and commas; a blank is NULL). For each month (YYYY-MM), return signups, with_amount (rows that have an amount) and total_amount (2 decimals). In month order." % (c['amt'], c['cur']),
                cols=['month', 'signups', 'with_amount', 'total_amount'],
                sql='WITH clean AS (\n    SELECT LEFT(%s, 7) AS month,\n           %s AS amount\n    FROM %s\n)\nSELECT month,\n       COUNT(*) AS signups,\n       COUNT(amount) AS with_amount,\n       ROUND(SUM(amount), 2) AS total_amount\nFROM clean\nGROUP BY month\nORDER BY month;' % (DAY, money(c), c['t']))


def _m13_e5(c):
    return dict(story='%s wants to know how many real people chose each %s, after duplicates and typos are dealt with.' % (c['team'], c['look'].replace('_', ' ')),
                task=("Keep one row per person: rows with an email only, matched on the trimmed lower-case email, keeping the earliest cleaned signup date (ties: lowest signup_id). "
                      "Match %s to %s.%s ignoring case and outer spaces; rows that match nothing count as 'Unmatched'. Return %s and people, most first, then %s." % (c['look'], c['dim'], c['key'], c['key'], c['key'])),
                cols=[c['key'], 'people'],
                sql=("WITH ranked AS (\n    SELECT %s AS look_clean,\n           ROW_NUMBER() OVER (PARTITION BY %s ORDER BY %s, signup_id) AS copy_no\n    FROM %s\n    WHERE NULLIF(TRIM(email), '') IS NOT NULL\n)\n"
                     "SELECT COALESCE(d.%s, 'Unmatched') AS %s,\n       COUNT(*) AS people\nFROM ranked r\nLEFT JOIN %s d ON LOWER(d.%s) = r.look_clean\nWHERE r.copy_no = 1\nGROUP BY COALESCE(d.%s, 'Unmatched')\nORDER BY people DESC, %s;")
                    % ('LOWER(TRIM(%s))' % c['look'], EMAIL, DAY, c['t'], c['key'], c['key'], c['dim'], c['key'], c['key'], c['key']))


M13 = dict(
 id='m13', phase=4, title='Data Cleaning: Fixing Messy Real-World Data', minutes=240,
 objectives=['Spot stray spaces, mixed case, blanks and duplicates before you analyse', 'Tidy text with TRIM, UPPER, LOWER and REPLACE',
             'Turn text into numbers and dates you can calculate with', 'Standardise labels with CASE and remove duplicates with ROW_NUMBER',
             'Join messy labels to a clean lookup table'],
 concept_weeks=[],
 extra_concepts=[
  dict(term='Why cleaning comes first', what='Raw data from forms, spreadsheets and other systems contains stray spaces, mixed case, blanks, typos and duplicates.',
       whenWhy='If you count or join before cleaning, the same thing is counted twice or not at all. Analysts often spend more time cleaning data than analysing it.'),
  dict(term='`TRIM`, `UPPER` and `LOWER`', what='TRIM removes spaces at the start and end of text. UPPER and LOWER change the case of every letter.',
       whenWhy="Use them before grouping, comparing or joining text, so ' Lagos', 'LAGOS' and 'Lagos ' become one value.", syntax="LOWER(TRIM(email))"),
  dict(term='`REPLACE`', what='REPLACE(text, find, with) swaps every copy of one piece of text for another.',
       whenWhy='Use it to remove currency symbols, commas, dashes and brackets, or to make date separators consistent.', syntax="REPLACE(REPLACE(amount, '$', ''), ',', '')"),
  dict(term='`NULLIF` and `COALESCE`', what="NULLIF(a, b) gives NULL when a equals b. COALESCE(a, b, ...) gives the first value that is not NULL.",
       whenWhy="NULLIF(TRIM(x), '') turns blanks into real NULLs so COUNT and AVG treat them as missing. COALESCE puts a readable label in their place.", syntax="COALESCE(NULLIF(TRIM(email), ''), 'no email')"),
  dict(term='`CAST`', what='CAST(value AS type) converts a value to another type, for example text to a number.',
       whenWhy='Numbers stored as text sort and add up wrongly. Remove symbols and commas first, then CAST to DECIMAL.', syntax="CAST('1250.50' AS DECIMAL(12,2))"),
  dict(term='Standardising with `CASE`', what='A CASE expression maps every known spelling of a label to one clean value.',
       whenWhy='Hand-typed categories drift. Compare a trimmed, lower-case value and keep an ELSE so new spellings are visible.'),
  dict(term='De-duplicating with `ROW_NUMBER`', what='ROW_NUMBER() OVER (PARTITION BY key ORDER BY date) numbers each copy of a record. Keep row 1.',
       whenWhy='Use it when the same customer, order or form appears more than once and you must count each one only once.'),
 ],
 examples=M13_EXAMPLES,
 exercises=[
  dict(level='Easy', concepts=['TRIM', 'UPPER', 'LOWER', 'REPLACE'], order=True,
       hint2="TRIM first, then UPPER (or LOWER). REPLACE(text, '  ', ' ') turns a double space into a single one.",
       explain='Cleaning works inside out: TRIM removes the outer spaces, UPPER or LOWER fixes the case, and REPLACE fixes what is left inside. The stored data is unchanged; only the output is clean.',
       v=each(_m13_e1)),
  dict(level='Easy', concepts=['NULLIF', 'COUNT', 'Blank vs NULL'], order=False,
       hint2="COUNT(column) skips NULLs. COUNT(NULLIF(TRIM(column), '')) also skips blanks. Subtract that from COUNT(*) to get the missing rows.",
       explain="A blank ('') is a value, so COUNT counts it. NULLIF(TRIM(x), '') turns blanks and space-only values into NULL, and then COUNT skips them like any other missing value.",
       v=each(_m13_e2)),
  dict(level='Medium', concepts=['CASE', 'LOWER', 'TRIM', 'GROUP BY'], order=True,
       hint2="Inside a CTE, build source_clean with CASE WHEN LOWER(TRIM(source)) IN ('web', 'website') THEN 'Web' ... END. Then GROUP BY source_clean outside.",
       explain='Without cleaning, every spelling becomes its own group and the channel totals look smaller than they are. Mapping each spelling to one label first gives one honest total per channel.',
       v=each(_m13_e3)),
  dict(level='Medium', concepts=['REPLACE', 'CAST', 'NULLIF', 'CTE'], order=True,
       hint2="In a CTE: LEFT(REPLACE(REPLACE(signup_date, '/', '-'), '.', '-'), 7) for the month, and CAST(REPLACE(REPLACE(NULLIF(TRIM(amount), ''), symbol, ''), ',', '') AS DECIMAL(12,2)) for the amount.",
       explain='The CTE does the cleaning once, so the outer query reads like a normal summary. COUNT(amount) counts only rows where the amount survived as a number, which is how you report data quality next to the total.',
       v=each(_m13_e4)),
  dict(level='Hard', concepts=['ROW_NUMBER', 'CTE', 'LEFT JOIN', 'COALESCE', 'De-duplication'], order=True,
       hint2="CTE: ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY cleaned date, signup_id) AS copy_no, for rows with an email. Outside: LEFT JOIN the lookup table ON LOWER(name) = LOWER(TRIM(label)), keep copy_no = 1, and GROUP BY COALESCE(name, 'Unmatched').",
       explain='Removing duplicates first means each person is counted once. The LEFT JOIN on cleaned values matches most labels, and COALESCE keeps the typos in an Unmatched row, so the report shows how much still needs a human to fix.',
       v=each(_m13_e5)),
 ])


# ------------------------------------------------------------------ Module 14: Capstone
# Six graded tasks per dataset that combine earlier modules. Each task practises the same skills on every dataset.
SALES_REV = 'oi.quantity * oi.unit_price * (1 - oi.discount)'
FASH_REV = 'l.qty * l.unit_price * (1 - l.discount)'
QTR = "CONCAT(YEAR({0}), '-Q', QUARTER({0}))"

CAP1 = dict(
 sales=('The CEO opens the business review with one line of headline numbers.',
        'Leaving out cancelled orders, return orders (distinct orders), customers (distinct buyers), revenue (quantity x unit price x (1 - discount), 2 decimals) and avg_order_value (revenue / orders, 2 decimals).',
        ['orders', 'customers', 'revenue', 'avg_order_value'],
        "SELECT COUNT(DISTINCT o.order_id) AS orders,\n       COUNT(DISTINCT o.customer_id) AS customers,\n       ROUND(SUM({r}), 2) AS revenue,\n       ROUND(SUM({r}) / COUNT(DISTINCT o.order_id), 2) AS avg_order_value\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.order_id\nWHERE o.status <> 'Cancelled';".format(r=SALES_REV)),
 sport=('The league board opens its season review with one line of headline numbers.',
        'For the 2025 season, return matches, goals (home + away), goals_per_match (2 decimals), avg_attendance (whole number) and home_win_pct (share of matches the home team won, 1 decimal).',
        ['matches', 'goals', 'goals_per_match', 'avg_attendance', 'home_win_pct'],
        'SELECT COUNT(*) AS matches,\n       SUM(home_goals + away_goals) AS goals,\n       ROUND(SUM(home_goals + away_goals) * 1.0 / COUNT(*), 2) AS goals_per_match,\n       ROUND(AVG(attendance)) AS avg_attendance,\n       ROUND(100.0 * SUM(CASE WHEN home_goals > away_goals THEN 1 ELSE 0 END) / COUNT(*), 1) AS home_win_pct\nFROM matches\nWHERE season = 2025;'),
 fashion=('The managing director opens the 2025 review with one line of headline numbers.',
          'For sales in 2025, return sales (distinct sales), known_customers (distinct customer ids; walk-ins have none), revenue (qty x unit price x (1 - discount), 2 decimals) and avg_basket (revenue / sales, 2 decimals).',
          ['sales', 'known_customers', 'revenue', 'avg_basket'],
          "SELECT COUNT(DISTINCT s.sale_id) AS sales,\n       COUNT(DISTINCT s.customer_id) AS known_customers,\n       ROUND(SUM({r}), 2) AS revenue,\n       ROUND(SUM({r}) / COUNT(DISTINCT s.sale_id), 2) AS avg_basket\nFROM sales s\nJOIN sale_lines l ON l.sale_id = s.sale_id\nWHERE s.sale_date >= '2025-01-01' AND s.sale_date < '2026-01-01';".format(r=FASH_REV)),
 politics=('The commission opens its report on the 2025 general election with one line of headline numbers.',
           'For election 3, return constituencies, registered_voters (in those constituencies), votes_cast, turnout_pct (votes cast x 100 / registered voters, 1 decimal) and candidates (candidates who stood).',
           ['constituencies', 'registered_voters', 'votes_cast', 'turnout_pct', 'candidates'],
           'WITH seat AS (\n    SELECT constituency_id, SUM(votes) AS votes, COUNT(*) AS candidates\n    FROM results\n    WHERE election_id = 3\n    GROUP BY constituency_id\n)\nSELECT COUNT(*) AS constituencies,\n       SUM(k.registered_voters) AS registered_voters,\n       SUM(s.votes) AS votes_cast,\n       ROUND(100.0 * SUM(s.votes) / SUM(k.registered_voters), 1) AS turnout_pct,\n       SUM(s.candidates) AS candidates\nFROM seat s\nJOIN constituencies k ON k.constituency_id = s.constituency_id;'),
 finance=('The board opens the 2025 lending review with one line of headline numbers.',
          'For loans disbursed in 2025, return loans, borrowers (distinct customers), total_principal, avg_loan (2 decimals) and avg_rate_pct (average interest rate, 1 decimal).',
          ['loans', 'borrowers', 'total_principal', 'avg_loan', 'avg_rate_pct'],
          "SELECT COUNT(*) AS loans,\n       COUNT(DISTINCT customer_id) AS borrowers,\n       SUM(principal) AS total_principal,\n       ROUND(AVG(principal), 2) AS avg_loan,\n       ROUND(AVG(interest_rate_pct), 1) AS avg_rate_pct\nFROM loans\nWHERE disbursed_date >= '2025-01-01' AND disbursed_date < '2026-01-01';"),
 healthcare=('The clinic board opens its 2025 review with one line of headline numbers.',
             "For appointments in 2025, return appointments, completed, no_show_pct (share with status 'No-show', 1 decimal), avg_wait (average wait of completed visits, 1 decimal) and patients_seen (distinct patients with a completed visit).",
             ['appointments', 'completed', 'no_show_pct', 'avg_wait', 'patients_seen'],
             "SELECT COUNT(*) AS appointments,\n       SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,\n       ROUND(100.0 * SUM(CASE WHEN status = 'No-show' THEN 1 ELSE 0 END) / COUNT(*), 1) AS no_show_pct,\n       ROUND(AVG(CASE WHEN status = 'Completed' THEN wait_minutes END), 1) AS avg_wait,\n       COUNT(DISTINCT CASE WHEN status = 'Completed' THEN patient_id END) AS patients_seen\nFROM appointments\nWHERE scheduled_at >= '2025-01-01' AND scheduled_at < '2026-01-01';"),
)


def growth(cte, label, value, rnd=2):
    prev = 'LAG(%s) OVER (ORDER BY %s)' % (value, label)
    return ('WITH q AS (\n%s\n)\nSELECT %s,\n       ROUND(%s, %d) AS %s,\n       ROUND((%s - %s) * 100.0 / %s, 1) AS growth_pct\nFROM q\nORDER BY %s;'
            % (cte, label, value, rnd, value, value, prev, prev, label))


CAP2 = dict(
 sales=('The review needs the revenue trend through the year.',
        "Leaving out cancelled orders, return quarter (a label like '2025-Q1'), revenue (2 decimals) and growth_pct (change from the previous quarter in percent, 1 decimal; the first quarter is NULL). In quarter order.",
        ['quarter', 'revenue', 'growth_pct'],
        growth("    SELECT %s AS quarter,\n           SUM(%s) AS revenue\n    FROM orders o\n    JOIN order_items oi ON oi.order_id = o.order_id\n    WHERE o.status <> 'Cancelled'\n    GROUP BY %s" % (QTR.format('o.order_date'), SALES_REV, QTR.format('o.order_date')), 'quarter', 'revenue')),
 sport=('The review needs the scoring trend through the 2025 season.',
        'For the 2025 season, return month (YYYY-MM), goals (home + away) and growth_pct (change from the previous month in percent, 1 decimal; the first month is NULL). In month order.',
        ['month', 'goals', 'growth_pct'],
        growth("    SELECT DATE_FORMAT(match_date, '%Y-%m') AS month,\n           SUM(home_goals + away_goals) AS goals\n    FROM matches\n    WHERE season = 2025\n    GROUP BY DATE_FORMAT(match_date, '%Y-%m')", 'month', 'goals', 0)),
 fashion=('The review needs the revenue trend over two years.',
          "Return quarter (a label like '2025-Q1'), revenue (qty x unit price x (1 - discount), 2 decimals) and growth_pct (change from the previous quarter in percent, 1 decimal; the first quarter is NULL). In quarter order.",
          ['quarter', 'revenue', 'growth_pct'],
          growth("    SELECT %s AS quarter,\n           SUM(%s) AS revenue\n    FROM sales s\n    JOIN sale_lines l ON l.sale_id = s.sale_id\n    GROUP BY %s" % (QTR.format('s.sale_date'), FASH_REV, QTR.format('s.sale_date')), 'quarter', 'revenue')),
 politics=("The report tracks the Blue Party's polling before and after the election.",
           "For party 1, return quarter (a label like '2025-Q1'), avg_share (average poll vote share, 1 decimal) and change_pts (avg_share minus the previous quarter's, 1 decimal; the first quarter is NULL). In quarter order.",
           ['quarter', 'avg_share', 'change_pts'],
           "WITH q AS (\n    SELECT %s AS quarter,\n           AVG(vote_share_pct) AS avg_share\n    FROM polls\n    WHERE party_id = 1\n    GROUP BY %s\n)\nSELECT quarter,\n       ROUND(avg_share, 1) AS avg_share,\n       ROUND(avg_share - LAG(avg_share) OVER (ORDER BY quarter), 1) AS change_pts\nFROM q\nORDER BY quarter;" % (QTR.format('fieldwork_end'), QTR.format('fieldwork_end'))),
 finance=('The review needs the lending trend over two years.',
          "For loans disbursed from 2024-01-01, return quarter (a label like '2025-Q1'), principal (total disbursed) and growth_pct (change from the previous quarter in percent, 1 decimal; the first quarter is NULL). In quarter order.",
          ['quarter', 'principal', 'growth_pct'],
          growth("    SELECT %s AS quarter,\n           SUM(principal) AS principal\n    FROM loans\n    WHERE disbursed_date >= '2024-01-01'\n    GROUP BY %s" % (QTR.format('disbursed_date'), QTR.format('disbursed_date')), 'quarter', 'principal')),
 healthcare=('The review needs the activity trend over two years.',
             "For completed appointments, return quarter (a label like '2025-Q1'), visits and growth_pct (change from the previous quarter in percent, 1 decimal; the first quarter is NULL). In quarter order.",
             ['quarter', 'visits', 'growth_pct'],
             growth("    SELECT %s AS quarter,\n           COUNT(*) AS visits\n    FROM appointments\n    WHERE status = 'Completed'\n    GROUP BY %s" % (QTR.format('scheduled_at'), QTR.format('scheduled_at')), 'quarter', 'visits', 0)),
)


def top2(cte, group, item, value, rank, rnd=2):
    val = 'ROUND(%s, %d)' % (value, rnd) if rnd else value
    return ('WITH t AS (\n%s\n), r AS (\n    SELECT %s, %s, %s,\n           DENSE_RANK() OVER (PARTITION BY %s ORDER BY %s DESC) AS %s\n    FROM t\n)\nSELECT %s, %s, %s AS %s, %s\nFROM r\nWHERE %s <= 2\nORDER BY %s, %s, %s;'
            % (cte, group, item, value, group, val, rank, group, item, val, value, rank, rank, group, rank, item))


CAP3 = dict(
 sales=('The review names the best sellers in every category.',
        'Leaving out cancelled orders, find the 2 products with the highest revenue in each category (use DENSE_RANK, so tied products share a rank). Return category_name, product_name, revenue (2 decimals) and rank_in_category. Sort by category name, rank, then product name.',
        ['category_name', 'product_name', 'revenue', 'rank_in_category'],
        top2("    SELECT c.category_name, p.product_name,\n           SUM(%s) AS revenue\n    FROM order_items oi\n    JOIN orders o ON o.order_id = oi.order_id\n    JOIN products p ON p.product_id = oi.product_id\n    JOIN categories c ON c.category_id = p.category_id\n    WHERE o.status <> 'Cancelled'\n    GROUP BY c.category_name, p.product_name" % SALES_REV,
             'category_name', 'product_name', 'revenue', 'rank_in_category')),
 sport=('The review names the leading scorers at every club.',
        "For the 2025 season, find each team's 2 highest scorers (use DENSE_RANK, so tied players share a rank). Return team_name, player_name (first and last), goals and rank_in_team. Sort by team name, rank, then player name.",
        ['team_name', 'player_name', 'goals', 'rank_in_team'],
        top2("    SELECT t.team_name, CONCAT(p.first_name, ' ', p.last_name) AS player_name,\n           COUNT(*) AS goals\n    FROM goals g\n    JOIN matches m ON m.match_id = g.match_id\n    JOIN players p ON p.player_id = g.player_id\n    JOIN teams t ON t.team_id = p.team_id\n    WHERE m.season = 2025\n    GROUP BY t.team_name, p.player_id, p.first_name, p.last_name",
             'team_name', 'player_name', 'goals', 'rank_in_team', 0)),
 fashion=('The review names the best sellers in every category.',
          'For sales in 2025, find the 2 products with the highest revenue in each category (use DENSE_RANK, so tied products share a rank). Return category, product_name, revenue (2 decimals) and rank_in_category. Sort by category, rank, then product name.',
          ['category', 'product_name', 'revenue', 'rank_in_category'],
          top2("    SELECT p.category, p.product_name,\n           SUM(%s) AS revenue\n    FROM sale_lines l\n    JOIN sales s ON s.sale_id = l.sale_id\n    JOIN products p ON p.product_id = l.product_id\n    WHERE s.sale_date >= '2025-01-01'\n    GROUP BY p.category, p.product_name" % FASH_REV,
               'category', 'product_name', 'revenue', 'rank_in_category')),
 politics=('The report names the two strongest parties in every region.',
           "For election 3, find the 2 parties with the most votes in each region (use DENSE_RANK; count independents together as 'Independent'). Return region_name, party_name, votes and rank_in_region. Sort by region name, rank, then party name.",
           ['region_name', 'party_name', 'votes', 'rank_in_region'],
           top2("    SELECT g.region_name, COALESCE(p.party_name, 'Independent') AS party_name,\n           SUM(r.votes) AS votes\n    FROM results r\n    JOIN constituencies k ON k.constituency_id = r.constituency_id\n    JOIN regions g ON g.region_id = k.region_id\n    JOIN candidates c ON c.candidate_id = r.candidate_id\n    LEFT JOIN parties p ON p.party_id = c.party_id\n    WHERE r.election_id = 3\n    GROUP BY g.region_name, COALESCE(p.party_name, 'Independent')",
                'region_name', 'party_name', 'votes', 'rank_in_region', 0)),
 finance=('The review names the busiest loan officers in every branch.',
          'For loans disbursed in 2025, find the 2 loan officers with the most principal disbursed in each branch (use DENSE_RANK, so ties share a rank). Return branch_name, officer_name (first and last), principal and rank_in_branch. Sort by branch name, rank, then officer name.',
          ['branch_name', 'officer_name', 'principal', 'rank_in_branch'],
          top2("    SELECT b.branch_name, CONCAT(e.first_name, ' ', e.last_name) AS officer_name,\n           SUM(l.principal) AS principal\n    FROM loans l\n    JOIN employees e ON e.employee_id = l.officer_id\n    JOIN branches b ON b.branch_id = e.branch_id\n    WHERE l.disbursed_date >= '2025-01-01'\n    GROUP BY b.branch_name, e.employee_id, e.first_name, e.last_name",
               'branch_name', 'officer_name', 'principal', 'rank_in_branch', 0)),
 healthcare=('The review names the busiest doctors in every department.',
             'For completed appointments in 2025, find the 2 doctors with the most visits in each department (use DENSE_RANK, so ties share a rank). Return department_name, doctor_name (first and last), visits and rank_in_department. Sort by department name, rank, then doctor name.',
             ['department_name', 'doctor_name', 'visits', 'rank_in_department'],
             top2("    SELECT dp.department_name, CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,\n           COUNT(*) AS visits\n    FROM appointments a\n    JOIN doctors d ON d.doctor_id = a.doctor_id\n    JOIN departments dp ON dp.department_id = d.department_id\n    WHERE a.status = 'Completed'\n      AND a.scheduled_at >= '2025-01-01' AND a.scheduled_at < '2026-01-01'\n    GROUP BY dp.department_name, d.doctor_id, d.first_name, d.last_name",
                  'department_name', 'doctor_name', 'visits', 'rank_in_department', 0)),
)


def segments(cte, case, label, agg, count_alias, value_alias, rnd=2):
    return ('WITH base AS (\n%s\n), tiered AS (\n    SELECT value,\n           %s AS %s\n    FROM base\n)\nSELECT %s,\n       COUNT(*) AS %s,\n       ROUND(%s, %d) AS %s,\n       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_%s\nFROM tiered\nGROUP BY %s\nORDER BY %s DESC, %s;'
            % (cte, case, label, label, count_alias, agg, rnd, value_alias, count_alias, label, value_alias, label))


CAP4 = dict(
 sales=('Marketing wants to size its loyalty tiers.',
        "Put every customer in a tier by total spend, leaving out cancelled orders: 'Platinum' 2,000 or more, 'Gold' 1,000 to under 2,000, 'Silver' under 1,000, and 'No orders' for customers with none. Return tier, customers, total_spend (2 decimals) and pct_of_customers (1 decimal). Highest total_spend first.",
        ['tier', 'customers', 'total_spend', 'pct_of_customers'],
        segments("    SELECT c.customer_id,\n           COALESCE(SUM(%s), 0) AS value\n    FROM customers c\n    LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status <> 'Cancelled'\n    LEFT JOIN order_items oi ON oi.order_id = o.order_id\n    GROUP BY c.customer_id" % SALES_REV,
                 "CASE WHEN value >= 2000 THEN 'Platinum'\n                WHEN value >= 1000 THEN 'Gold'\n                WHEN value > 0 THEN 'Silver'\n                ELSE 'No orders' END", 'tier', 'SUM(value)', 'customers', 'total_spend')),
 sport=('The board wants to see how squad value is spread.',
        "Put every player in a tier by market value: 'Star' 10,000,000 or more, 'Established' 4,000,000 to under 10,000,000, and 'Squad' under 4,000,000. Return tier, players, avg_value (whole number) and pct_of_players (1 decimal). Highest avg_value first.",
        ['tier', 'players', 'avg_value', 'pct_of_players'],
        segments('    SELECT player_id, market_value_usd AS value\n    FROM players',
                 "CASE WHEN value >= 10000000 THEN 'Star'\n                WHEN value >= 4000000 THEN 'Established'\n                ELSE 'Squad' END", 'tier', 'AVG(value)', 'players', 'avg_value', 0)),
 fashion=('The CRM team wants to size its loyalty tiers.',
          "Put every customer in a tier by lifetime spend (qty x unit price x (1 - discount)): 'Platinum' 1,500 or more, 'Gold' 750 to under 1,500, 'Silver' under 750, and 'No purchases' for customers with none. Return tier, customers, total_spend (2 decimals) and pct_of_customers (1 decimal). Highest total_spend first.",
          ['tier', 'customers', 'total_spend', 'pct_of_customers'],
          segments("    SELECT c.customer_id,\n           COALESCE(SUM(%s), 0) AS value\n    FROM customers c\n    LEFT JOIN sales s ON s.customer_id = c.customer_id\n    LEFT JOIN sale_lines l ON l.sale_id = s.sale_id\n    GROUP BY c.customer_id" % FASH_REV,
                   "CASE WHEN value >= 1500 THEN 'Platinum'\n                WHEN value >= 750 THEN 'Gold'\n                WHEN value > 0 THEN 'Silver'\n                ELSE 'No purchases' END", 'tier', 'SUM(value)', 'customers', 'total_spend')),
 politics=('The report classifies every seat by how safe it was in 2025.',
           "For election 3, find each constituency's winning margin: the winner's votes minus the runner-up's, as a percentage of all votes cast there. Classify seats as 'Safe' (15 points or more), 'Comfortable' (5 to under 15) or 'Marginal' (under 5). Return seat_type, seats, avg_margin_pts (1 decimal) and pct_of_seats (1 decimal). Highest avg_margin_pts first.",
           ['seat_type', 'seats', 'avg_margin_pts', 'pct_of_seats'],
           segments("    SELECT constituency_id,\n           100.0 * (MAX(CASE WHEN pos = 1 THEN votes END) - MAX(CASE WHEN pos = 2 THEN votes END)) / MAX(total) AS value\n    FROM (\n        SELECT constituency_id, votes,\n               ROW_NUMBER() OVER (PARTITION BY constituency_id ORDER BY votes DESC, candidate_id) AS pos,\n               SUM(votes) OVER (PARTITION BY constituency_id) AS total\n        FROM results\n        WHERE election_id = 3\n    ) ranked\n    GROUP BY constituency_id",
                    "CASE WHEN value >= 15 THEN 'Safe'\n                WHEN value >= 5 THEN 'Comfortable'\n                ELSE 'Marginal' END", 'seat_type', 'AVG(value)', 'seats', 'avg_margin_pts', 1)),
 finance=('Risk wants to see the customer base by credit band.',
          "Put every customer in a band by credit score: 'Prime' 700 or more, 'Near prime' 600 to 699, 'Subprime' under 600, and 'Unscored' when the score is NULL. Return band, customers, avg_score (whole number; NULL for Unscored) and pct_of_customers (1 decimal). Highest avg_score first.",
          ['band', 'customers', 'avg_score', 'pct_of_customers'],
          segments('    SELECT customer_id, credit_score AS value\n    FROM customers',
                   "CASE WHEN value >= 700 THEN 'Prime'\n                WHEN value >= 600 THEN 'Near prime'\n                WHEN value < 600 THEN 'Subprime'\n                ELSE 'Unscored' END", 'band', 'AVG(value)', 'customers', 'avg_score', 0)),
 healthcare=('Patient services wants to see how often patients come back.',
             "Put every registered patient in a segment by completed visits (all time): 'Frequent' 10 or more, 'Regular' 4 to 9, 'Occasional' 1 to 3, and 'Never seen' for none. Return segment, patients, avg_visits (1 decimal) and pct_of_patients (1 decimal). Highest avg_visits first.",
             ['segment', 'patients', 'avg_visits', 'pct_of_patients'],
             segments("    SELECT p.patient_id, COUNT(a.appointment_id) AS value\n    FROM patients p\n    LEFT JOIN appointments a ON a.patient_id = p.patient_id AND a.status = 'Completed'\n    GROUP BY p.patient_id",
                      "CASE WHEN value >= 10 THEN 'Frequent'\n                WHEN value >= 4 THEN 'Regular'\n                WHEN value >= 1 THEN 'Occasional'\n                ELSE 'Never seen' END", 'segment', 'AVG(value)', 'patients', 'avg_visits', 1)),
)

CAP5 = dict(
 sales=('Marketing wants a win-back list as of 2025-12-31.',
        "List customers whose last order (leaving out cancelled ones) was more than 90 days before 2025-12-31, and customers who never ordered. Return customer_name (first and last), last_order_date, days_since (NULL if never) and status ('Lapsed' or 'Never ordered'). Sort by status, then days_since highest first, then customer name.",
        ['customer_name', 'last_order_date', 'days_since', 'status'],
        "WITH last_seen AS (\n    SELECT CONCAT(c.first_name, ' ', c.last_name) AS customer_name,\n           MAX(o.order_date) AS last_order_date\n    FROM customers c\n    LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status <> 'Cancelled'\n    GROUP BY c.customer_id, c.first_name, c.last_name\n)\nSELECT customer_name, last_order_date,\n       DATEDIFF('2025-12-31', last_order_date) AS days_since,\n       CASE WHEN last_order_date IS NULL THEN 'Never ordered' ELSE 'Lapsed' END AS status\nFROM last_seen\nWHERE last_order_date IS NULL\n   OR DATEDIFF('2025-12-31', last_order_date) > 90\nORDER BY status, days_since DESC, customer_name;"),
 sport=('The board wants to know which clubs are on a long run without a win.',
        "As of 2025-06-30, find each team's last win (home or away, any season). List teams whose last win was more than 14 days before that date, and teams that have never won. Return team_name, last_win_date, days_since_win (NULL if never) and status ('Winless run' or 'Never won'). Sort by status, then days_since_win highest first, then team name.",
        ['team_name', 'last_win_date', 'days_since_win', 'status'],
        "WITH wins AS (\n    SELECT home_team_id AS team_id, match_date FROM matches WHERE home_goals > away_goals\n    UNION ALL\n    SELECT away_team_id, match_date FROM matches WHERE away_goals > home_goals\n), last_win AS (\n    SELECT t.team_name, MAX(w.match_date) AS last_win_date\n    FROM teams t\n    LEFT JOIN wins w ON w.team_id = t.team_id\n    GROUP BY t.team_id, t.team_name\n)\nSELECT team_name, last_win_date,\n       DATEDIFF('2025-06-30', last_win_date) AS days_since_win,\n       CASE WHEN last_win_date IS NULL THEN 'Never won' ELSE 'Winless run' END AS status\nFROM last_win\nWHERE last_win_date IS NULL\n   OR DATEDIFF('2025-06-30', last_win_date) > 14\nORDER BY status, days_since_win DESC, team_name;"),
 fashion=('The CRM team wants a win-back list as of 2025-12-31.',
          "List customers whose last purchase was more than 180 days before 2025-12-31, and customers who never bought. Return customer_name (first and last), last_purchase_date, days_since (NULL if never) and status ('Lapsed' or 'Never bought'). Sort by status, then days_since highest first, then customer name.",
          ['customer_name', 'last_purchase_date', 'days_since', 'status'],
          "WITH last_seen AS (\n    SELECT CONCAT(c.first_name, ' ', c.last_name) AS customer_name,\n           MAX(s.sale_date) AS last_purchase_date\n    FROM customers c\n    LEFT JOIN sales s ON s.customer_id = c.customer_id\n    GROUP BY c.customer_id, c.first_name, c.last_name\n)\nSELECT customer_name, last_purchase_date,\n       DATEDIFF('2025-12-31', last_purchase_date) AS days_since,\n       CASE WHEN last_purchase_date IS NULL THEN 'Never bought' ELSE 'Lapsed' END AS status\nFROM last_seen\nWHERE last_purchase_date IS NULL\n   OR DATEDIFF('2025-12-31', last_purchase_date) > 180\nORDER BY status, days_since DESC, customer_name;"),
 politics=('The report lists every seat that changed hands between the two general elections.',
           "Find the winning party of each constituency in election 1 and in election 3 (the candidate with the most votes; count independents as 'Independent'). List the constituencies where the winning party changed. Return constituency_name, winner_2021 and winner_2025. Sort by constituency name.",
           ['constituency_name', 'winner_2021', 'winner_2025'],
           "WITH ranked AS (\n    SELECT r.election_id, r.constituency_id,\n           COALESCE(p.party_name, 'Independent') AS party_name,\n           ROW_NUMBER() OVER (PARTITION BY r.election_id, r.constituency_id ORDER BY r.votes DESC, r.candidate_id) AS pos\n    FROM results r\n    JOIN candidates c ON c.candidate_id = r.candidate_id\n    LEFT JOIN parties p ON p.party_id = c.party_id\n    WHERE r.election_id IN (1, 3)\n)\nSELECT k.constituency_name,\n       w1.party_name AS winner_2021,\n       w3.party_name AS winner_2025\nFROM ranked w1\nJOIN ranked w3 ON w3.constituency_id = w1.constituency_id AND w3.election_id = 3 AND w3.pos = 1\nJOIN constituencies k ON k.constituency_id = w1.constituency_id\nWHERE w1.election_id = 1 AND w1.pos = 1\n  AND w1.party_name <> w3.party_name\nORDER BY k.constituency_name;"),
 finance=('Collections wants a list of customers who are behind on their loans.',
          'An instalment is overdue when it has no paid date and its due date is before 2025-12-31. For each customer with an overdue instalment, return customer_name (first and last), overdue_instalments, oldest_due_date, days_overdue (from the oldest due date to 2025-12-31) and amount_overdue (sum of amount due, 2 decimals). Sort by days_overdue, highest first, then customer name.',
          ['customer_name', 'overdue_instalments', 'oldest_due_date', 'days_overdue', 'amount_overdue'],
          "SELECT CONCAT(c.first_name, ' ', c.last_name) AS customer_name,\n       COUNT(*) AS overdue_instalments,\n       MIN(r.due_date) AS oldest_due_date,\n       DATEDIFF('2025-12-31', MIN(r.due_date)) AS days_overdue,\n       ROUND(SUM(r.amount_due), 2) AS amount_overdue\nFROM repayments r\nJOIN loans l ON l.loan_id = r.loan_id\nJOIN customers c ON c.customer_id = l.customer_id\nWHERE r.paid_date IS NULL\n  AND r.due_date < '2025-12-31'\nGROUP BY c.customer_id, c.first_name, c.last_name\nORDER BY days_overdue DESC, customer_name;"),
 healthcare=('Care coordinators want patients with a long-term condition who are overdue a check-up.',
             "Long-term conditions are diagnoses in the categories 'Cardiovascular' and 'Endocrine'. List patients who have ever had one and whose last completed visit was more than 120 days before 2025-12-31. Return patient_name (first and last), last_visit (the date, YYYY-MM-DD) and days_since. Sort by days_since, highest first, then patient name.",
             ['patient_name', 'last_visit', 'days_since'],
             "WITH chronic AS (\n    SELECT DISTINCT a.patient_id\n    FROM appointments a\n    JOIN appointment_diagnoses ad ON ad.appointment_id = a.appointment_id\n    JOIN diagnoses d ON d.diagnosis_code = ad.diagnosis_code\n    WHERE d.category IN ('Cardiovascular', 'Endocrine')\n), last_seen AS (\n    SELECT p.patient_id, CONCAT(p.first_name, ' ', p.last_name) AS patient_name,\n           MAX(a.scheduled_at) AS last_at\n    FROM patients p\n    JOIN chronic ch ON ch.patient_id = p.patient_id\n    JOIN appointments a ON a.patient_id = p.patient_id AND a.status = 'Completed'\n    GROUP BY p.patient_id, p.first_name, p.last_name\n)\nSELECT patient_name,\n       DATE_FORMAT(last_at, '%Y-%m-%d') AS last_visit,\n       DATEDIFF('2025-12-31', last_at) AS days_since\nFROM last_seen\nWHERE DATEDIFF('2025-12-31', last_at) > 120\nORDER BY days_since DESC, patient_name;"),
)


def compare(cte, name, a, b, rnd, rank, labels):
    val = (lambda x: 'ROUND(%s, %d)' % (x, rnd)) if rnd else (lambda x: x)
    return ('WITH t AS (\n%s\n)\nSELECT %s,\n       %s AS %s,\n       %s AS %s,\n       ROUND((%s - %s) * 100.0 / NULLIF(%s, 0), 1) AS change_pct,\n       RANK() OVER (ORDER BY %s DESC) AS %s,\n       CASE WHEN %s > %s THEN \'%s\' ELSE \'%s\' END AS trend\nFROM t\nORDER BY %s, %s;'
            % (cte, name, val(a), a, val(b), b, b, a, a, val(b), rank, b, a, labels[0], labels[1], rank, name))


CAP6 = dict(
 sales=('The review ends with one table on the sales team.',
        "For each employee who took orders, compare revenue in the first half of 2025 (before 2025-07-01) with the second half, leaving out cancelled orders. Return employee_name (first and last), h1_revenue and h2_revenue (2 decimals), change_pct (1 decimal), h2_rank (RANK by h2_revenue, highest = 1) and trend ('Growing' if h2 is higher, otherwise 'Slowing'). Sort by h2_rank, then employee name.",
        ['employee_name', 'h1_revenue', 'h2_revenue', 'change_pct', 'h2_rank', 'trend'],
        compare("    SELECT CONCAT(e.first_name, ' ', e.last_name) AS employee_name,\n           SUM(CASE WHEN o.order_date < '2025-07-01' THEN {r} ELSE 0 END) AS h1_revenue,\n           SUM(CASE WHEN o.order_date >= '2025-07-01' THEN {r} ELSE 0 END) AS h2_revenue\n    FROM employees e\n    JOIN orders o ON o.employee_id = e.employee_id\n    JOIN order_items oi ON oi.order_id = o.order_id\n    WHERE o.status <> 'Cancelled'\n    GROUP BY e.employee_id, e.first_name, e.last_name".format(r=SALES_REV),
                'employee_name', 'h1_revenue', 'h2_revenue', 2, 'h2_rank', ('Growing', 'Slowing'))),
 sport=('The review ends with one table on every club.',
        "Score each team 3 points for a win and 1 for a draw, home and away. For each team that played, return team_name, points_2024, points_2025, change_pct (1 decimal), rank_2025 (RANK by points_2025, highest = 1) and trend ('Improving' if 2025 is higher, otherwise 'Declining'). Sort by rank_2025, then team name.",
        ['team_name', 'points_2024', 'points_2025', 'change_pct', 'rank_2025', 'trend'],
        compare("    SELECT tm.team_name,\n           SUM(CASE WHEN r.season = 2024 THEN r.points ELSE 0 END) AS points_2024,\n           SUM(CASE WHEN r.season = 2025 THEN r.points ELSE 0 END) AS points_2025\n    FROM (\n        SELECT season, home_team_id AS team_id,\n               CASE WHEN home_goals > away_goals THEN 3 WHEN home_goals = away_goals THEN 1 ELSE 0 END AS points\n        FROM matches\n        UNION ALL\n        SELECT season, away_team_id,\n               CASE WHEN away_goals > home_goals THEN 3 WHEN away_goals = home_goals THEN 1 ELSE 0 END\n        FROM matches\n    ) r\n    JOIN teams tm ON tm.team_id = r.team_id\n    GROUP BY tm.team_id, tm.team_name",
                'team_name', 'points_2024', 'points_2025', 0, 'rank_2025', ('Improving', 'Declining'))),
 fashion=('The review ends with one table on every store.',
          "For each store, compare revenue (qty x unit price x (1 - discount)) in 2024 and 2025. Return store_name, revenue_2024 and revenue_2025 (2 decimals), change_pct (1 decimal), rank_2025 (RANK by revenue_2025, highest = 1) and trend ('Growing' if 2025 is higher, otherwise 'Declining'). Sort by rank_2025, then store name.",
          ['store_name', 'revenue_2024', 'revenue_2025', 'change_pct', 'rank_2025', 'trend'],
          compare("    SELECT st.store_name,\n           SUM(CASE WHEN s.sale_date < '2025-01-01' THEN {r} ELSE 0 END) AS revenue_2024,\n           SUM(CASE WHEN s.sale_date >= '2025-01-01' THEN {r} ELSE 0 END) AS revenue_2025\n    FROM stores st\n    JOIN sales s ON s.store_id = st.store_id\n    JOIN sale_lines l ON l.sale_id = s.sale_id\n    GROUP BY st.store_id, st.store_name".format(r=FASH_REV),
                  'store_name', 'revenue_2024', 'revenue_2025', 2, 'rank_2025', ('Growing', 'Declining'))),
 politics=('The report ends with one table on every party.',
           "A party wins a seat when its candidate has the most votes in a constituency. For each party that won a seat in election 1 or 3, return party_name, seats_2021, seats_2025, change_pct (1 decimal; NULL if it had no seats in 2021), rank_2025 (RANK by seats_2025, highest = 1) and trend ('Gaining' if it won more seats in 2025, otherwise 'Losing'). Sort by rank_2025, then party name.",
           ['party_name', 'seats_2021', 'seats_2025', 'change_pct', 'rank_2025', 'trend'],
           compare("    SELECT p.party_name,\n           SUM(CASE WHEN w.election_id = 1 THEN 1 ELSE 0 END) AS seats_2021,\n           SUM(CASE WHEN w.election_id = 3 THEN 1 ELSE 0 END) AS seats_2025\n    FROM (\n        SELECT r.election_id, c.party_id,\n               ROW_NUMBER() OVER (PARTITION BY r.election_id, r.constituency_id ORDER BY r.votes DESC, r.candidate_id) AS pos\n        FROM results r\n        JOIN candidates c ON c.candidate_id = r.candidate_id\n        WHERE r.election_id IN (1, 3)\n    ) w\n    JOIN parties p ON p.party_id = w.party_id\n    WHERE w.pos = 1\n    GROUP BY p.party_id, p.party_name",
                   'party_name', 'seats_2021', 'seats_2025', 0, 'rank_2025', ('Gaining', 'Losing'))),
 finance=('The review ends with one table on every branch.',
          "For each branch, compare principal disbursed in 2024 and 2025 (through the loan officer's branch). Return branch_name, principal_2024, principal_2025, change_pct (1 decimal; NULL if nothing was lent in 2024), rank_2025 (RANK by principal_2025, highest = 1) and trend ('Growing' if 2025 is higher, otherwise 'Declining'). Sort by rank_2025, then branch name.",
          ['branch_name', 'principal_2024', 'principal_2025', 'change_pct', 'rank_2025', 'trend'],
          compare("    SELECT b.branch_name,\n           SUM(CASE WHEN l.disbursed_date >= '2024-01-01' AND l.disbursed_date < '2025-01-01' THEN l.principal ELSE 0 END) AS principal_2024,\n           SUM(CASE WHEN l.disbursed_date >= '2025-01-01' THEN l.principal ELSE 0 END) AS principal_2025\n    FROM branches b\n    JOIN employees e ON e.branch_id = b.branch_id\n    JOIN loans l ON l.officer_id = e.employee_id\n    GROUP BY b.branch_id, b.branch_name",
                  'branch_name', 'principal_2024', 'principal_2025', 0, 'rank_2025', ('Growing', 'Declining'))),
 healthcare=('The review ends with one table on every department.',
             "For each department, compare completed visits in 2024 and 2025. Return department_name, visits_2024, visits_2025, change_pct (1 decimal), rank_2025 (RANK by visits_2025, highest = 1) and trend ('Growing' if 2025 is higher, otherwise 'Declining'). Sort by rank_2025, then department name.",
             ['department_name', 'visits_2024', 'visits_2025', 'change_pct', 'rank_2025', 'trend'],
             compare("    SELECT dp.department_name,\n           SUM(CASE WHEN a.scheduled_at < '2025-01-01' THEN 1 ELSE 0 END) AS visits_2024,\n           SUM(CASE WHEN a.scheduled_at >= '2025-01-01' AND a.scheduled_at < '2026-01-01' THEN 1 ELSE 0 END) AS visits_2025\n    FROM departments dp\n    JOIN doctors d ON d.department_id = dp.department_id\n    JOIN appointments a ON a.doctor_id = d.doctor_id\n    WHERE a.status = 'Completed'\n    GROUP BY dp.department_id, dp.department_name",
                     'department_name', 'visits_2024', 'visits_2025', 0, 'rank_2025', ('Growing', 'Declining'))),
)

M14 = dict(
 id='m14', phase=4, title='Capstone: The Business Review', minutes=300, capstone=True,
 objectives=['Answer a real business question from start to finish, choosing the tables and joins yourself',
             'Combine aggregation, CASE, CTEs and window functions in one query',
             'Present results the way a manager reads them: headline numbers, trends, rankings, segments and action lists'],
 concept_weeks=[],
 extra_concepts=[
  dict(term='How to approach a business question', what='Restate the question in one sentence, list the output columns, then find the tables that hold each column and how they join.',
       whenWhy='Most wrong answers come from answering a slightly different question. Writing the columns first keeps you honest.'),
  dict(term='Build in steps with CTEs', what='Put each step (filter, summarise, rank) in its own named CTE and check its result before adding the next.',
       whenWhy='A long query that is wrong is hard to fix. Small checked steps make the final query easy to trust and to explain.'),
  dict(term='Check your numbers', what='Compare totals with a simpler query: does the sum of the parts equal the whole? Does a row count look right?',
       whenWhy='Joins can duplicate rows and filters can drop them. A quick sanity check catches both before a manager does.'),
 ],
 examples=[],
 exercises=[
  dict(level='Medium', concepts=['Aggregation', 'COUNT DISTINCT', 'KPIs'], order=False,
       hint2='One SELECT with several aggregates. Use COUNT(DISTINCT ...) where a join or a filter could repeat the same id, and divide the totals for the averages.',
       explain='Headline numbers are plain aggregates, but each must count the right thing: distinct ids for people and transactions, and the same filter for every number so they agree with each other.',
       v=CAP1),
  dict(level='Medium', concepts=['CTE', 'LAG', 'Growth rate'], order=True,
       hint2='Summarise per period in a CTE. Outside it, (value - LAG(value) OVER (ORDER BY period)) * 100.0 / LAG(value) OVER (ORDER BY period) gives the growth.',
       explain='The CTE gives one row per period, and LAG brings the previous period onto the same row, so the change is simple arithmetic. The first period has nothing before it, so it is NULL.',
       v=CAP2),
  dict(level='Medium', concepts=['DENSE_RANK', 'PARTITION BY', 'CTE', 'Top N per group'], order=True,
       hint2='CTE 1: total per group and item. CTE 2: DENSE_RANK() OVER (PARTITION BY group ORDER BY total DESC). Outside: keep rank <= 2.',
       explain='PARTITION BY restarts the ranking in each group, and DENSE_RANK gives tied items the same rank, so nobody who tied for second place is left out.',
       v=CAP3),
  dict(level='Hard', concepts=['CASE', 'LEFT JOIN', 'Window over aggregate', 'Segmentation'], order=True,
       hint2='CTE: one row per customer (or player, seat, patient) with the value. Then CASE to name the tier, GROUP BY the tier, and 100.0 * COUNT(*) / SUM(COUNT(*)) OVER () for the share.',
       explain='Segmenting is a CASE on a per-entity value, then a group. SUM(COUNT(*)) OVER () adds up all the group counts, so each group can show its share without a second query. A LEFT JOIN keeps the entities that have no activity.',
       v=CAP4),
  dict(level='Hard', concepts=['LEFT JOIN', 'MAX', 'DATEDIFF', 'CASE', 'Action list'], order=True,
       hint2="Find each entity's last activity with MAX(date) in a CTE (LEFT JOIN keeps the ones with none). Outside, DATEDIFF from the fixed date, filter on it, and label the rows with CASE.",
       explain='An action list is the most useful output of a review: who needs a call this week. MAX finds the last event, DATEDIFF turns it into days, and keeping the never-active rows matters because they are often the biggest opportunity.',
       v=CAP5),
  dict(level='Hard', concepts=['Conditional aggregation', 'RANK', 'CASE', 'CTE'], order=True,
       hint2="CTE: one row per group with SUM(CASE WHEN period A ...) and SUM(CASE WHEN period B ...). Outside: the change with NULLIF on the divisor, RANK() OVER (ORDER BY period B DESC), and CASE for the trend.",
       explain='Conditional aggregation puts both periods on one row, so the comparison, the rank and the label all come from the same numbers. NULLIF stops a zero in the earlier period from breaking the percentage.',
       v=CAP6),
 ])
