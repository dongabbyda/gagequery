# Creating and Changing Tables (id m15, shown as Module 2): CREATE, INSERT, UPDATE, DELETE, ALTER, TRUNCATE, DROP.
# Every dataset gets one new table with the same shape: id, a link to an existing table, a unique code, a checked
# number and a date. Examples set the table up in `pre`, so each Run starts fresh. Foreign keys are switched on with
# PRAGMA in `pre` (MySQL always enforces them; SQLite only when asked).

FK_ON = 'PRAGMA foreign_keys = ON'

T = {  # new table, id, parent table, parent key, unique code column, number column + type + check, date column,
       # two test rows, three real rows (parent id, code, number, date), a date column to rename to
 'sales': dict(t='promotions', id='promo_id', parent='products', pk='product_id', code='promo_code', num='discount_pct',
               num_type='DECIMAL(5,2)', check='discount_pct > 0 AND discount_pct <= 90', check_words='more than 0 and at most 90',
               date='start_date', rename='begins_on', noun='promotion',
               real=[(2, 'NEWYEAR10', 10, '2026-01-01'), (11, 'BOOKS15', 15, '2026-01-05'), (21, 'FITJAN20', 20, '2026-01-10')],
               team='Marketing', why='to run January promotions'),
 'sport': dict(t='injuries', id='injury_id', parent='players', pk='player_id', code='report_ref', num='games_missed',
               num_type='INT', check='games_missed >= 0', check_words='0 or more',
               date='start_date', rename='injured_on', noun='injury',
               real=[(5, 'INJ-2601', 3, '2026-01-10'), (40, 'INJ-2602', 1, '2026-01-12'), (97, 'INJ-2603', 6, '2026-01-15')],
               team='The medical team', why='to track injuries'),
 'fashion': dict(t='stock_counts', id='count_id', parent='products', pk='product_id', code='count_ref', num='units',
                 num_type='INT', check='units >= 0', check_words='0 or more',
                 date='count_date', rename='counted_on', noun='stock count',
                 real=[(4, 'SC-2601', 12, '2026-01-03'), (18, 'SC-2602', 0, '2026-01-03'), (33, 'SC-2603', 7, '2026-01-04')],
                 team='The stock team', why='to record stock counts'),
 'politics': dict(t='polling_stations', id='station_id', parent='constituencies', pk='constituency_id', code='station_code', num='booths',
                  num_type='INT', check='booths > 0', check_words='more than 0',
                  date='opened_date', rename='opens_on', noun='polling station',
                  real=[(1, 'ASH-PS1', 8, '2026-03-01'), (7, 'GLE-PS1', 5, '2026-03-01'), (30, 'EAS-PS1', 6, '2026-03-02')],
                  team='The commission', why='to plan polling stations'),
 'finance': dict(t='account_alerts', id='alert_id', parent='accounts', pk='account_id', code='alert_ref', num='threshold_amount',
                 num_type='DECIMAL(12,2)', check='threshold_amount > 0', check_words='more than 0',
                 date='created_date', rename='raised_on', noun='alert',
                 real=[(3, 'AL-2601', 500000, '2026-01-02'), (12, 'AL-2602', 250000, '2026-01-02'), (40, 'AL-2603', 1000000, '2026-01-03')],
                 team='Fraud operations', why='to flag large transactions'),
 'healthcare': dict(t='referrals', id='referral_id', parent='patients', pk='patient_id', code='referral_ref', num='priority',
                    num_type='INT', check='priority BETWEEN 1 AND 3', check_words='between 1 and 3',
                    date='referral_date', rename='referred_on', noun='referral',
                    real=[(6, 'REF-2601', 1, '2026-01-05'), (22, 'REF-2602', 2, '2026-01-06'), (58, 'REF-2603', 3, '2026-01-07')],
                    team='Patient services', why='to manage referrals'),
}
for _d in T.values():
    _d['test'] = [(_d['real'][0][0], 'TEST-1', 1, '2025-12-01'), (_d['real'][1][0], 'TEST-2', 1, '2025-12-02')]


def create_sql(d):
    return ('CREATE TABLE %(t)s (\n'
            '    %(id)s INT PRIMARY KEY,\n'
            '    %(pk)s INT NOT NULL REFERENCES %(parent)s (%(pk)s),\n'
            '    %(code)s VARCHAR(20) NOT NULL UNIQUE,\n'
            '    %(num)s %(num_type)s NOT NULL CHECK (%(check)s),\n'
            '    %(date)s DATE NOT NULL\n'
            ');' % d)


def cols(d):
    return '%(id)s, %(pk)s, %(code)s, %(num)s, %(date)s' % d


def values(rows, start=1):
    return ',\n       '.join("(%d, %d, '%s', %s, '%s')" % ((start + i,) + r) for i, r in enumerate(rows))


def setup(d, rows=None):
    """Hidden setup for examples and exercises: a fresh copy of the new table, optionally with rows."""
    s = FK_ON + ';\nDROP TABLE IF EXISTS %s;\n' % d['t'] + create_sql(d)
    if rows:
        s += '\nINSERT INTO %s (%s)\nVALUES %s;' % (d['t'], cols(d), values(rows))
    return s


def each(fn):
    return {ds: fn(d) for ds, d in T.items()}


def structure_check(d):
    """What a correct CREATE TABLE leaves behind: columns, types, required flags, the key, the link, the unique code, a CHECK."""
    t = d['t']
    return ("SELECT 'column' AS kind, name AS item, REPLACE(REPLACE(LOWER(type), ' ', ''), 'integer', 'int') AS detail,\n"
            "       CASE WHEN pk > 0 THEN 1 ELSE \"notnull\" END AS required, pk AS is_key\n"
            "FROM pragma_table_info('%s')\n"
            "UNION ALL\n"
            "SELECT 'link', \"from\", \"table\" || '.' || \"to\", NULL, NULL FROM pragma_foreign_key_list('%s')\n"
            "UNION ALL\n"
            "SELECT 'unique', ii.name, NULL, NULL, NULL\n"
            "FROM pragma_index_list('%s') il JOIN pragma_index_info(il.name) ii\n"
            "WHERE il.\"unique\" = 1 AND il.origin = 'u'\n"
            "UNION ALL\n"
            "SELECT 'check', CASE WHEN UPPER(sql) LIKE '%%CHECK%%' THEN 'present' ELSE 'missing' END, NULL, NULL, NULL\n"
            "FROM sqlite_master WHERE type = 'table' AND name = '%s'\n"
            "ORDER BY kind, item;" % (t, t, t, t))


def describe_cols(d):
    return ('%(id)s INT, primary key; %(pk)s INT, required, linked to %(parent)s(%(pk)s); %(code)s VARCHAR(20), required and unique; '
            '%(num)s %(num_type)s, required, ' % d) + d['check_words'] + ('; %(date)s DATE, required' % d)


EXAMPLES = [
 dict(title='Create a table with constraints', level='Easy',
      explanation='CREATE TABLE names the table, then lists each column with its data type. Constraints are rules the database enforces for you: PRIMARY KEY (one unique id per row), NOT NULL (a value is required), UNIQUE (no duplicates), CHECK (the value must pass a test) and REFERENCES (the value must exist in another table). DESCRIBE shows the result.',
      tryIt='Add a column notes VARCHAR(100) at the end, then run it again.',
      v=each(lambda d: 'DROP TABLE IF EXISTS %s;\n%s\nDESCRIBE %s;' % (d['t'], create_sql(d), d['t']))),
 dict(title='Add rows with INSERT', level='Easy',
      explanation='INSERT INTO table (columns) VALUES (...) adds rows. List the columns, so the values line up even if the table changes later. One INSERT can add many rows, separated by commas. Text and dates go in single quotes.',
      tryIt='Add a fourth row with the next id.',
      pre=each(setup),
      v=each(lambda d: 'INSERT INTO %s (%s)\nVALUES %s;\n\nSELECT * FROM %s;' % (d['t'], cols(d), values(d['real']), d['t']))),
 dict(title='Copy rows from a query with INSERT ... SELECT', level='Medium',
      explanation='Instead of VALUES, an INSERT can take the rows a SELECT returns. It is how analysts fill a new table from existing data in one step. The SELECT must return the columns in the same order as the list.',
      tryIt='Change the WHERE so more rows are copied.',
      pre=each(setup),
      v=each(lambda d: "INSERT INTO %(t)s (%(cols)s)\nSELECT %(pk)s, %(pk)s, CONCAT('AUTO-', %(pk)s), 1, '2026-02-01'\nFROM %(parent)s\nWHERE %(pk)s <= 5;\n\nSELECT * FROM %(t)s;" % dict(d, cols=cols(d)))),
 dict(title='Change rows with UPDATE ... WHERE', level='Easy',
      explanation='UPDATE table SET column = new value WHERE condition changes existing rows. The WHERE decides which rows change. Without it, every row in the table changes, which is the most common costly mistake with UPDATE.',
      tryIt='Change the WHERE to pick a different row.',
      pre=each(lambda d: setup(d, d['real'])),
      v=each(lambda d: 'UPDATE %(t)s\nSET %(num)s = %(num)s + 1\nWHERE %(id)s = 2;\n\nSELECT * FROM %(t)s;' % d)),
 dict(title='Remove rows with DELETE ... WHERE', level='Easy',
      explanation='DELETE FROM table WHERE condition removes the rows that match. Like UPDATE, a DELETE without WHERE removes every row. Before deleting, run a SELECT with the same WHERE to see exactly what will go.',
      tryIt='Run SELECT * FROM the table WHERE the same condition, before the DELETE.',
      pre=each(lambda d: setup(d, d['real'])),
      v=each(lambda d: 'DELETE FROM %(t)s\nWHERE %(id)s = 3;\n\nSELECT * FROM %(t)s;' % d)),
 dict(title="Change a table's shape with ALTER TABLE", level='Medium',
      explanation='ALTER TABLE changes an existing table without losing its rows: ADD COLUMN adds one (existing rows get the DEFAULT), RENAME COLUMN renames one, and DROP COLUMN removes one and its data.',
      tryIt='Add a second column with a different default.',
      pre=each(lambda d: setup(d, d['real'])),
      v=each(lambda d: "ALTER TABLE %(t)s ADD COLUMN status VARCHAR(10) DEFAULT 'Open';\nALTER TABLE %(t)s RENAME COLUMN %(date)s TO %(rename)s;\nALTER TABLE %(t)s DROP COLUMN status;\n\nDESCRIBE %(t)s;" % d)),
 dict(title='TRUNCATE, DELETE and DROP', level='Medium',
      explanation='Three ways to get rid of data. DELETE removes the rows you choose and can be undone inside a transaction. TRUNCATE empties the whole table at once; on a MySQL server it is faster, resets AUTO_INCREMENT and cannot be rolled back. DROP removes the table itself, structure and all.',
      tryIt='Replace TRUNCATE with DROP TABLE, then run the SELECT: the table no longer exists.',
      pre=each(lambda d: setup(d, d['real'])),
      v=each(lambda d: 'TRUNCATE TABLE %(t)s;\n\nSELECT COUNT(*) AS rows_left FROM %(t)s;' % d)),
 dict(title='A foreign key blocks a row with no parent', level='Medium',
      explanation='REFERENCES makes the database check that every link points at a real row. The first INSERT works. The second points at an id that does not exist, so the database refuses it. This is the error you will see on a real MySQL server too.',
      tryIt='This example fails on purpose. Change 99999 to a real id and run it again.',
      pre=each(setup),
      v=each(lambda d: "INSERT INTO %(t)s (%(cols)s)\nVALUES (1, %(ok)d, 'OK-1', 1, '2026-01-01');\n\nINSERT INTO %(t)s (%(cols)s)\nVALUES (2, 99999, 'BAD-1', 1, '2026-01-01');" % dict(d, cols=cols(d), ok=d['real'][0][0]))),
 dict(title='Auto-numbered ids and changing a column type (MySQL server)', level='Medium', ref=True,
      explanation='Two common MySQL commands the browser engine cannot run. AUTO_INCREMENT numbers new rows for you, so you leave the id out of INSERT. MODIFY COLUMN changes a column\'s type or rules. In the exercises, ids are given so results match MySQL exactly.',
      v=each(lambda d: "-- MySQL: let the database number new rows\nCREATE TABLE %(t)s_log (\n    log_id INT AUTO_INCREMENT PRIMARY KEY,\n    note VARCHAR(200) NOT NULL\n);\nINSERT INTO %(t)s_log (note) VALUES ('first'), ('second');  -- log_id becomes 1, 2\n\n-- MySQL: change a column's type or rules\nALTER TABLE %(t)s MODIFY COLUMN %(code)s VARCHAR(40) NOT NULL;" % d)),
]


def _e1(d):
    return dict(story='%s needs a new table %s.' % (d['team'], d['why']),
                task='Create a table called %s with these columns: %s.' % (d['t'], describe_cols(d)), cols=None,
                sql=create_sql(d), pre=FK_ON + ';\nDROP TABLE IF EXISTS %s' % d['t'], verify=structure_check(d),
                verifyText="the new table's columns, types, required columns, primary key, link to %s and unique code" % d['parent'],
                verifyMsg='The table is not quite right. Compare the column names, types, required columns, the key, the link to %s and the unique code with the task.' % d['parent'])


def _e2(d):
    real = '; '.join("%s %d: %s %d, %s '%s', %s %s, %s %s" % (d['id'], i + 1, d['pk'], r[0], d['code'], r[1], d['num'], r[2], d['date'], r[3]) for i, r in enumerate(d['real']))
    return dict(story='The %s table still holds two test rows from setup.' % d['t'],
                task='Empty %s with TRUNCATE, then insert these rows: %s.' % (d['t'], real), cols=None,
                sql='TRUNCATE TABLE %s;\n\nINSERT INTO %s (%s)\nVALUES %s;' % (d['t'], d['t'], cols(d), values(d['real'])),
                pre=setup(d, d['test']), verify='SELECT * FROM %s ORDER BY %s;' % (d['t'], d['id']), verifyText='every row now in %s' % d['t'],
                verifyMsg='The rows in %s do not match the task. Check that the test rows are gone and every value is typed exactly.' % d['t'],
                require=[[r'\bTRUNCATE\b', 'This task is practice for TRUNCATE. Empty the table with TRUNCATE TABLE %s.' % d['t']]])


UPD = {  # table, key, column, new-value expression, WHERE, business sentence
 'sales': ('products', 'product_id', 'unit_price', 'ROUND(unit_price * 1.10, 2)', 'category_id = 4', 'Raise unit_price by 10% (rounded to 2 decimals) for products in category 4 only.', 'Book suppliers have raised their prices.'),
 'sport': ('players', 'player_id', 'market_value_usd', 'ROUND(market_value_usd * 1.15, 2)', 'team_id = 3', 'Raise market_value_usd by 15% (rounded to 2 decimals) for players of team 3 only.', 'Team 3 won the cup, and valuations are going up.'),
 'fashion': ('products', 'product_id', 'retail_price', 'ROUND(retail_price * 0.80, 2)', "category = 'Bags'", "Cut retail_price by 20% (rounded to 2 decimals) for products in the category 'Bags' only.", 'The buying team is running a bag sale.'),
 'politics': ('constituencies', 'constituency_id', 'registered_voters', 'registered_voters + 1250', 'region_id = 6', 'Add 1,250 to registered_voters for constituencies in region 6 only.', 'A late registration drive added voters in the Capital District.'),
 'finance': ('loans', 'loan_id', 'interest_rate_pct', 'interest_rate_pct + 1.5', "status = 'Active' AND product = 'Personal Loan'", "Add 1.5 to interest_rate_pct for loans that are 'Active' and of product 'Personal Loan' only.", 'The bank is repricing its active personal loans.'),
 'healthcare': ('doctors', 'doctor_id', 'consultation_fee', 'ROUND(consultation_fee * 1.10, 2)', 'department_id = 3', 'Raise consultation_fee by 10% (rounded to 2 decimals) for doctors in department 3 only.', 'Cardiology fees are going up.'),
}


def _e3(ds):
    t, k, c, expr, where, task, story = UPD[ds]
    return dict(story=story, task=task, cols=None,
                sql='UPDATE %s\nSET %s = %s\nWHERE %s;' % (t, c, expr, where),
                verify='SELECT %s, %s FROM %s ORDER BY %s;' % (k, c, t, k), verifyText='the %s of every row in %s' % (c, t),
                verifyMsg='Some %s values are wrong. Check the calculation, and that the WHERE changes only the rows the task names.' % c,
                require=[[r'\bWHERE\b', 'An UPDATE without WHERE changes every row. Add a WHERE that picks only the rows in the task.']])


ALT = {  # table, key, new column, default, new value, WHERE, story
 'sales': ('customers', 'customer_id', 'customer_tier', 'Standard', 'Loyal', "customer_id IN (SELECT customer_id FROM orders WHERE status <> 'Cancelled' GROUP BY customer_id HAVING COUNT(*) >= 4)", "customers with 4 or more orders that are not 'Cancelled'", 'Marketing wants to tag its most loyal customers.'),
 'sport': ('teams', 'team_id', 'stadium_size', 'Small', 'Large', 'capacity >= 30000', 'teams whose capacity is 30,000 or more', 'The league is planning match-day staffing by stadium size.'),
 'fashion': ('products', 'product_id', 'price_band', 'Standard', 'Premium', 'retail_price >= 150', 'products with a retail_price of 150 or more', 'The buying team wants a price band on every product.'),
 'politics': ('constituencies', 'constituency_id', 'size_band', 'Medium', 'Large', 'registered_voters >= 80000', 'constituencies with 80,000 or more registered voters', 'The commission is planning resources by seat size.'),
 'finance': ('customers', 'customer_id', 'risk_flag', 'Normal', 'Review', 'credit_score < 560 OR credit_score IS NULL', 'customers with a credit_score under 560 or no score at all', 'Risk wants a flag on customers who need a manual review.'),
 'healthcare': ('patients', 'patient_id', 'age_group', 'Adult', 'Child', 'birth_year > 2009', 'patients born after 2009', 'Patient services wants an age group on every record.'),
}


def _e4(ds):
    t, k, c, default, value, where, who, story = ALT[ds]
    return dict(story=story,
                task="Add a column %s VARCHAR(10) to %s with the default '%s'. Then set it to '%s' for %s." % (c, t, default, value, who), cols=None,
                sql="ALTER TABLE %s ADD COLUMN %s VARCHAR(10) DEFAULT '%s';\n\nUPDATE %s\nSET %s = '%s'\nWHERE %s;" % (t, c, default, t, c, value, where),
                verify='SELECT %s, %s FROM %s ORDER BY %s;' % (k, c, t, k), verifyText='the new %s column for every row in %s' % (c, t),
                verifyMsg="The %s values are not right. Check the default, and that only %s get '%s'." % (c, who, value))


ARC = {  # table, key, archive WHERE, words
 'sales': ('order_items', 'order_item_id', "order_id IN (SELECT order_id FROM orders WHERE status = 'Cancelled')", "order items that belong to orders with status 'Cancelled'", 'Finance wants cancelled order lines out of the live table, but kept for audit.'),
 'sport': ('transfers', 'transfer_id', "transfer_date < '2024-07-01'", 'transfers dated before 2024-07-01', 'The league is archiving transfers older than the 2024 summer window.'),
 'fashion': ('returns', 'return_id', "return_date < '2025-01-01'", 'returns dated before 2025-01-01', 'The stores are archiving last year\'s returns.'),
 'politics': ('polls', 'poll_id', "fieldwork_end < '2024-07-01'", 'polls whose fieldwork ended before 2024-07-01', 'The commission is archiving polls from the first half of 2024.'),
 'finance': ('transactions', 'txn_id', "txn_date < '2024-04-01'", 'transactions dated before 2024-04-01', 'Operations is archiving the oldest transactions.'),
 'healthcare': ('prescriptions', 'prescription_id', "appointment_id IN (SELECT appointment_id FROM appointments WHERE scheduled_at < '2024-04-01')", 'prescriptions from appointments scheduled before 2024-04-01', 'Records is archiving the oldest prescriptions.'),
}


def _e5(ds):
    t, k, where, words, story = ARC[ds]
    a = t + '_archive'
    return dict(story=story,
                task='Create a table %s holding all columns of the %s, then delete those rows from %s. Use CREATE TABLE ... AS SELECT.' % (a, words, t), cols=None,
                sql='CREATE TABLE %s AS\nSELECT *\nFROM %s\nWHERE %s;\n\nDELETE FROM %s\nWHERE %s;' % (a, t, where, t, where),
                pre='DROP TABLE IF EXISTS %s' % a,
                verify=("SELECT 'archive' AS place, COUNT(*) AS row_count, MIN(%s) AS first_id, MAX(%s) AS last_id FROM %s\n"
                        "UNION ALL\nSELECT 'live', COUNT(*), MIN(%s), MAX(%s) FROM %s\nORDER BY place;" % (k, k, a, k, k, t)),
                verifyText='how many rows are in %s and in %s, and their first and last ids' % (a, t),
                verifyMsg='The archive and the live table do not add up. Check that the archive holds exactly the old rows and that they were then deleted from %s.' % t,
                require=[[r'CREATE\s+TABLE\s+\w+\s+AS\b', 'Create the archive with CREATE TABLE %s AS SELECT ...' % a]])


DIALECTS = [
 dict(topic='Auto-numbered ids',
      mysql='CREATE TABLE promotions (\n    promo_id INT AUTO_INCREMENT PRIMARY KEY,\n    promo_code VARCHAR(20) NOT NULL\n);',
      postgres='CREATE TABLE promotions (\n    promo_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n    promo_code VARCHAR(20) NOT NULL\n);',
      sqlserver='CREATE TABLE promotions (\n    promo_id INT IDENTITY(1,1) PRIMARY KEY,\n    promo_code VARCHAR(20) NOT NULL\n);',
      note='PostgreSQL also accepts SERIAL, an older shortcut.', pg_setup=''),
 dict(topic="Change a column's type",
      mysql='ALTER TABLE products\nMODIFY COLUMN unit_price DECIMAL(12,2) NOT NULL;',
      postgres='ALTER TABLE products\nALTER COLUMN unit_price TYPE NUMERIC(12,2);',
      sqlserver='ALTER TABLE products\nALTER COLUMN unit_price DECIMAL(12,2) NOT NULL;',
      note='In PostgreSQL, NOT NULL is a separate step: ALTER COLUMN unit_price SET NOT NULL.',
      pg_setup='CREATE TABLE products (product_id INT PRIMARY KEY, unit_price DECIMAL(10,2));'),
 dict(topic='Rename a column',
      mysql='ALTER TABLE products\nRENAME COLUMN unit_price TO price;',
      postgres='ALTER TABLE products\nRENAME COLUMN unit_price TO price;',
      sqlserver="EXEC sp_rename 'products.unit_price', 'price', 'COLUMN';",
      note='SQL Server renames with a system procedure rather than ALTER TABLE.',
      pg_setup='CREATE TABLE products (product_id INT PRIMARY KEY, unit_price DECIMAL(10,2));'),
 dict(topic='Empty a table',
      mysql='TRUNCATE TABLE promotions;',
      postgres='TRUNCATE TABLE promotions RESTART IDENTITY;',
      sqlserver='TRUNCATE TABLE promotions;',
      note='In PostgreSQL, TRUNCATE can be rolled back inside a transaction; RESTART IDENTITY restarts the numbering. In MySQL it cannot be rolled back.',
      pg_setup='CREATE TABLE promotions (promo_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, promo_code VARCHAR(20));'),
 dict(topic='Save a query result as a new table',
      mysql="CREATE TABLE books AS\nSELECT product_id, unit_price\nFROM products\nWHERE category_id = 4;",
      postgres="CREATE TABLE books AS\nSELECT product_id, unit_price\nFROM products\nWHERE category_id = 4;",
      sqlserver="SELECT product_id, unit_price\nINTO books\nFROM products\nWHERE category_id = 4;",
      note='SQL Server uses SELECT ... INTO instead of CREATE TABLE ... AS.',
      pg_setup='CREATE TABLE products (product_id INT PRIMARY KEY, category_id INT, unit_price DECIMAL(10,2));'),
 dict(topic='Text and date-time types',
      mysql='CREATE TABLE notes (\n    body VARCHAR(500),\n    created_at DATETIME\n);',
      postgres='CREATE TABLE notes (\n    body VARCHAR(500),\n    created_at TIMESTAMP\n);',
      sqlserver='CREATE TABLE notes (\n    body NVARCHAR(500),\n    created_at DATETIME2\n);',
      note='SQL Server uses NVARCHAR for text in any language; PostgreSQL also has TEXT with no length limit.', pg_setup=''),
]

M15 = dict(
 id='m15', phase=1, title='Creating and Changing Tables', minutes=180,
 objectives=['Create a table with the right data types and constraints', 'Add rows with INSERT, including INSERT ... SELECT',
             'Change and remove rows safely with UPDATE and DELETE ... WHERE', 'Change a table with ALTER TABLE',
             'Choose between DELETE, TRUNCATE and DROP'],
 concept_weeks=[],
 extra_concepts=[
  dict(term='Two kinds of SQL', what='Most SQL reads data (SELECT). The rest builds or changes it: CREATE, ALTER and DROP change tables (sometimes called DDL); INSERT, UPDATE and DELETE change rows (DML).',
       whenWhy='Analysts mostly read data, but you will create tables for results, load files, and fix data. Knowing these commands also helps you understand how the tables you query were built.'),
  dict(term='Data types', what='Every column has a type: INT (whole numbers), DECIMAL(p,s) (exact numbers like money), VARCHAR(n) (text up to n characters), DATE and DATETIME.',
       whenWhy='Pick the type that matches the values: DECIMAL for money (never FLOAT, which rounds), DATE for dates so they sort and compare correctly.', syntax='price DECIMAL(10,2), joined DATE'),
  dict(term='Constraints', what='Rules the database enforces on every row: PRIMARY KEY (unique id), NOT NULL (required), UNIQUE (no duplicates), DEFAULT (value used when none is given), CHECK (must pass a test) and FOREIGN KEY / REFERENCES (must match a row in another table).',
       whenWhy='Constraints stop bad data at the door, so every report built on the table can trust it.', syntax='qty INT NOT NULL CHECK (qty >= 0)'),
  dict(term='`INSERT`', what='INSERT INTO table (columns) VALUES (...) adds rows; INSERT INTO table (columns) SELECT ... copies the rows a query returns.',
       whenWhy='Always list the columns. The insert keeps working if someone adds a column later.', syntax="INSERT INTO t (id, name) VALUES (1, 'Ada'), (2, 'Ngozi');"),
  dict(term='`UPDATE` and `DELETE` need `WHERE`', what='UPDATE changes values and DELETE removes rows, in every row the WHERE matches. With no WHERE, they touch every row in the table.',
       whenWhy='Run a SELECT with the same WHERE first, and on a real server wrap risky changes in a transaction so you can ROLLBACK.', syntax='UPDATE t SET price = price * 1.1 WHERE category_id = 4;'),
  dict(term='`ALTER TABLE`', what='Changes a table that already holds data: ADD COLUMN, RENAME COLUMN, DROP COLUMN. On MySQL, MODIFY COLUMN changes a type.',
       whenWhy='Tables grow as the business changes. ALTER keeps the rows while you change the structure.'),
  dict(term='`DELETE` vs `TRUNCATE` vs `DROP`', what='DELETE removes chosen rows (or all) and can be rolled back. TRUNCATE removes all rows at once, fast, and on MySQL cannot be rolled back. DROP removes the whole table.',
       whenWhy='A classic interview question. Use DELETE ... WHERE for some rows, TRUNCATE to empty a staging table, DROP only when the table is no longer needed.'),
 ],
 examples=EXAMPLES,
 dialects=DIALECTS,
 exercises=[
  dict(level='Easy', concepts=['CREATE TABLE', 'Constraints', 'FOREIGN KEY'], order=False,
       hint2='CREATE TABLE name (column TYPE rules, ...). Rules: PRIMARY KEY, NOT NULL, UNIQUE, CHECK (condition), and REFERENCES parent_table (column) for the link.',
       explain='Each rule in the table definition is checked on every future INSERT and UPDATE, so mistakes are stopped before they reach a report. REFERENCES makes sure every row points at a real parent row.',
       v=each(_e1)),
  dict(level='Easy', concepts=['TRUNCATE', 'INSERT'], order=False,
       hint2="TRUNCATE TABLE name; empties the table. Then one INSERT INTO name (columns) VALUES (...), (...), (...); adds all three rows.",
       explain='TRUNCATE is the quick way to empty a whole table, typical for staging tables that are reloaded. Listing the columns in INSERT makes sure each value lands in the right place.',
       v=each(_e2)),
  dict(level='Medium', concepts=['UPDATE', 'WHERE'], order=False,
       hint2='UPDATE table SET column = new expression WHERE condition; the expression can use the old value, for example price * 1.10.',
       explain='The SET expression is worked out row by row from the old value, and the WHERE limits the change to the rows the business asked for. Every other row stays exactly as it was.',
       v={ds: _e3(ds) for ds in T}),
  dict(level='Medium', concepts=['ALTER TABLE', 'DEFAULT', 'UPDATE'], order=False,
       hint2="ALTER TABLE t ADD COLUMN c VARCHAR(10) DEFAULT 'value'; gives every existing row the default. Then UPDATE t SET c = 'other' WHERE condition;",
       explain='ADD COLUMN with a DEFAULT fills every existing row at once, so there are no NULLs to clean up. The UPDATE then changes only the rows that need a different value.',
       v={ds: _e4(ds) for ds in T}),
  dict(level='Hard', concepts=['CREATE TABLE AS', 'DELETE', 'Subqueries'], order=False,
       hint2='CREATE TABLE archive AS SELECT * FROM t WHERE condition; then DELETE FROM t WHERE the same condition; Use exactly the same WHERE both times.',
       explain='Copying first and deleting second, with the same condition, means no row is lost and none is left behind. On a real server you would wrap both statements in a transaction so they succeed or fail together.',
       v={ds: _e5(ds) for ds in T}),
 ])
