# Modules 11 and 12.

IDX = {  # (table, fk column, composite (col1, col2), filter query for EXPLAIN)
 'sales': ('orders', 'customer_id', ('order_items', 'order_id', 'product_id')),
 'sport': ('goals', 'player_id', ('matches', 'season', 'home_team_id')),
 'fashion': ('sale_lines', 'product_id', ('sales', 'store_id', 'sale_date')),
 'politics': ('results', 'candidate_id', ('results', 'election_id', 'constituency_id')),
 'finance': ('repayments', 'loan_id', ('loans', 'customer_id', 'disbursed_date')),
 'healthcare': ('appointments', 'patient_id', ('appointments', 'doctor_id', 'scheduled_at')),
}


def idx_verify(table, *cols):
    parts = ["(SELECT COUNT(*) FROM sqlite_master m, pragma_index_info(m.name) i WHERE m.type = 'index' AND m.tbl_name = '%s' AND i.name = '%s' AND i.seqno = %d) AS col%d_indexed" % (table, c, n, n + 1) for n, c in enumerate(cols)]
    if len(cols) == 2:
        parts = ["(SELECT COUNT(*) FROM sqlite_master m WHERE m.type = 'index' AND m.tbl_name = '%s' AND EXISTS (SELECT 1 FROM pragma_index_info(m.name) a WHERE a.name = '%s' AND a.seqno = 0) AND EXISTS (SELECT 1 FROM pragma_index_info(m.name) b WHERE b.name = '%s' AND b.seqno = 1)) AS composite_indexes" % (table, cols[0], cols[1])]
    return 'SELECT ' + ', '.join(parts)


def _e1():
    out = {}
    for ds, (t, c, comp) in IDX.items():
        out[ds] = dict(story='Queries that join on %s.%s are getting slow as the table grows.' % (t, c),
                       task='Create an index on %s(%s). Name it idx_%s_%s.' % (t, c, t, c), cols=None,
                       sql='CREATE INDEX idx_%s_%s ON %s (%s);' % (t, c, t, c),
                       pre='DROP INDEX IF EXISTS idx_%s_%s' % (t, c), verify=idx_verify(t, c),
                       verifyMsg='No index starting with %s was found on %s. Use CREATE INDEX name ON %s (%s).' % (c, t, t, c))
    return out


def _e2():
    out = {}
    for ds, (t, c, comp) in IDX.items():
        tt, a, b = comp
        out[ds] = dict(story='The most common filter uses %s and %s together.' % (a, b),
                       task='Create one composite index on %s with %s first and %s second. Name it idx_%s_%s_%s.' % (tt, a, b, tt, a, b), cols=None,
                       sql='CREATE INDEX idx_%s_%s_%s ON %s (%s, %s);' % (tt, a, b, tt, a, b),
                       pre='DROP INDEX IF EXISTS idx_%s_%s_%s' % (tt, a, b), verify=idx_verify(tt, a, b),
                       verifyMsg='No index on %s has %s as its first column and %s as its second. Column order matters in a composite index.' % (tt, a, b))
    return out


SARG = {  # non-sargable query shown in the task, sargable solution
 'sales': ("SELECT order_id, order_date FROM orders WHERE MONTH(order_date) = 3 AND YEAR(order_date) = 2025;",
           "SELECT order_id, order_date\nFROM orders\nWHERE order_date >= '2025-03-01' AND order_date < '2025-04-01'\nORDER BY order_id;", 'March 2025 orders', ['order_id', 'order_date']),
 'sport': ("SELECT match_id, match_date FROM matches WHERE YEAR(match_date) = 2025 AND MONTH(match_date) = 4;",
           "SELECT match_id, match_date\nFROM matches\nWHERE match_date >= '2025-04-01' AND match_date < '2025-05-01'\nORDER BY match_id;", 'April 2025 matches', ['match_id', 'match_date']),
 'fashion': ("SELECT sale_id, sale_date FROM sales WHERE DATE_FORMAT(sale_date, '%Y-%m') = '2025-12';",
             "SELECT sale_id, sale_date\nFROM sales\nWHERE sale_date >= '2025-12-01' AND sale_date < '2026-01-01'\nORDER BY sale_id;", 'December 2025 sales', ['sale_id', 'sale_date']),
 'politics': ("SELECT poll_id, fieldwork_end FROM polls WHERE YEAR(fieldwork_end) = 2025 AND MONTH(fieldwork_end) = 11 AND party_id = 1;",
              "SELECT poll_id, fieldwork_end\nFROM polls\nWHERE fieldwork_end >= '2025-11-01' AND fieldwork_end < '2025-12-01'\n  AND party_id = 1\nORDER BY poll_id;", 'November 2025 polls for party 1', ['poll_id', 'fieldwork_end']),
 'finance': ("SELECT loan_id, disbursed_date FROM loans WHERE YEAR(disbursed_date) = 2025 AND MONTH(disbursed_date) = 6;",
             "SELECT loan_id, disbursed_date\nFROM loans\nWHERE disbursed_date >= '2025-06-01' AND disbursed_date < '2025-07-01'\nORDER BY loan_id;", 'loans disbursed in June 2025', ['loan_id', 'disbursed_date']),
 'healthcare': ("SELECT appointment_id, scheduled_at FROM appointments WHERE DATE_FORMAT(scheduled_at, '%Y-%m-%d') = '2025-03-10';",
                "SELECT appointment_id, scheduled_at\nFROM appointments\nWHERE scheduled_at >= '2025-03-10' AND scheduled_at < '2025-03-11'\nORDER BY appointment_id;", 'appointments on 10 March 2025', ['appointment_id', 'scheduled_at']),
}
CORR = {  # correlated subquery to rewrite as a join
 'sales': ("SELECT e.first_name, e.salary FROM employees e WHERE e.salary > (SELECT m.salary FROM employees m WHERE m.employee_id = e.manager_id);",
           "SELECT e.first_name, e.salary, m.salary AS manager_salary\nFROM employees e\nJOIN employees m ON m.employee_id = e.manager_id\nWHERE e.salary > m.salary;", 'employees who earn more than their manager', ['first_name', 'salary', 'manager_salary']),
 'sport': ("SELECT p.last_name, (SELECT t.team_name FROM teams t WHERE t.team_id = p.team_id) AS team_name FROM players p WHERE p.market_value_usd > 10000000;",
           "SELECT p.last_name, t.team_name\nFROM players p\nJOIN teams t ON t.team_id = p.team_id\nWHERE p.market_value_usd > 10000000;", 'players valued over 10,000,000 with their team name', ['last_name', 'team_name']),
 'fashion': ("SELECT s.sale_id, (SELECT st.store_name FROM stores st WHERE st.store_id = s.store_id) AS store_name FROM sales s WHERE s.sale_date >= '2025-12-20';",
             "SELECT s.sale_id, st.store_name\nFROM sales s\nJOIN stores st ON st.store_id = s.store_id\nWHERE s.sale_date >= '2025-12-20';", 'sales from 20 December 2025 with their store name', ['sale_id', 'store_name']),
 'politics': ("SELECT r.result_id, r.votes, (SELECT c.last_name FROM candidates c WHERE c.candidate_id = r.candidate_id) AS last_name FROM results r WHERE r.election_id = 3 AND r.constituency_id = 7;",
              "SELECT r.result_id, r.votes, c.last_name\nFROM results r\nJOIN candidates c ON c.candidate_id = r.candidate_id\nWHERE r.election_id = 3 AND r.constituency_id = 7;", 'the 2025 results in constituency 7 with candidate surnames', ['result_id', 'votes', 'last_name']),
 'finance': ("SELECT l.loan_id, (SELECT c.last_name FROM customers c WHERE c.customer_id = l.customer_id) AS last_name FROM loans l WHERE l.status = 'Defaulted';",
             "SELECT l.loan_id, c.last_name\nFROM loans l\nJOIN customers c ON c.customer_id = l.customer_id\nWHERE l.status = 'Defaulted';", 'defaulted loans with the borrower\'s surname', ['loan_id', 'last_name']),
 'healthcare': ("SELECT a.appointment_id, (SELECT d.last_name FROM doctors d WHERE d.doctor_id = a.doctor_id) AS doctor FROM appointments a WHERE a.status = 'Scheduled';",
                "SELECT a.appointment_id, d.last_name AS doctor\nFROM appointments a\nJOIN doctors d ON d.doctor_id = a.doctor_id\nWHERE a.status = 'Scheduled';", 'upcoming scheduled appointments with the doctor\'s surname', ['appointment_id', 'doctor']),
}
NOTIN = {  # NULL trap: parent table, id col, self-ref col, label cols
 'sales': ('employees', 'employee_id', 'manager_id', 'employees who manage nobody', "SELECT first_name, last_name\nFROM employees e\nWHERE NOT EXISTS (\n    SELECT 1 FROM employees x WHERE x.manager_id = e.employee_id\n)\nORDER BY last_name, first_name;", ['first_name', 'last_name'], 'last name, then first name'),
 'sport': ('staff', 'staff_id', 'reports_to', 'staff in teams 1 and 2 that nobody reports to', "SELECT first_name, last_name, team_id\nFROM staff s\nWHERE s.team_id IN (1, 2)\n  AND NOT EXISTS (\n    SELECT 1 FROM staff x WHERE x.reports_to = s.staff_id\n)\nORDER BY team_id, last_name, first_name;", ['first_name', 'last_name', 'team_id'], 'team id, then last name, then first name'),
 'fashion': ('staff', 'staff_id', 'manager_id', 'staff who manage nobody', "SELECT first_name, last_name, role\nFROM staff s\nWHERE NOT EXISTS (\n    SELECT 1 FROM staff x WHERE x.manager_id = s.staff_id\n)\nORDER BY last_name, first_name;", ['first_name', 'last_name', 'role'], 'last name, then first name'),
 'politics': ('parties', 'party_id', None, 'parties that have no candidates', "SELECT party_name\nFROM parties p\nWHERE NOT EXISTS (\n    SELECT 1 FROM candidates c WHERE c.party_id = p.party_id\n)\nORDER BY party_name;", ['party_name'], 'party name'),
 'finance': ('employees', 'employee_id', 'manager_id', 'employees in branches 1 to 3 who manage nobody', "SELECT first_name, last_name, branch_id\nFROM employees e\nWHERE e.branch_id BETWEEN 1 AND 3\n  AND NOT EXISTS (\n    SELECT 1 FROM employees x WHERE x.manager_id = e.employee_id\n)\nORDER BY branch_id, last_name, first_name;", ['first_name', 'last_name', 'branch_id'], 'branch id, then last name, then first name'),
 'healthcare': ('doctors', 'doctor_id', 'supervisor_id', 'doctors who supervise nobody', "SELECT first_name, last_name, department_id\nFROM doctors d\nWHERE NOT EXISTS (\n    SELECT 1 FROM doctors x WHERE x.supervisor_id = d.doctor_id\n)\nORDER BY department_id, last_name, first_name;", ['first_name', 'last_name', 'department_id'], 'department id, then last name, then first name'),
}
NOTIN_BAD = {
 'sales': 'SELECT first_name, last_name FROM employees WHERE employee_id NOT IN (SELECT manager_id FROM employees);',
 'sport': 'SELECT first_name, last_name, team_id FROM staff WHERE team_id IN (1, 2) AND staff_id NOT IN (SELECT reports_to FROM staff);',
 'fashion': 'SELECT first_name, last_name, role FROM staff WHERE staff_id NOT IN (SELECT manager_id FROM staff);',
 'politics': 'SELECT party_name FROM parties WHERE party_id NOT IN (SELECT party_id FROM candidates);',
 'finance': 'SELECT first_name, last_name, branch_id FROM employees WHERE branch_id BETWEEN 1 AND 3 AND employee_id NOT IN (SELECT manager_id FROM employees);',
 'healthcare': 'SELECT first_name, last_name, department_id FROM doctors WHERE doctor_id NOT IN (SELECT supervisor_id FROM doctors);',
}
NULLCOL = {'sales': 'manager_id', 'sport': 'reports_to', 'fashion': 'manager_id', 'politics': 'party_id (independents have NULL)', 'finance': 'manager_id', 'healthcare': 'supervisor_id'}

M11 = dict(
 id='m11', number=11, phase=3, title='Indexing and Query Optimisation', minutes=240,
 objectives=['Explain what an index is and when it helps', 'Read a query plan with EXPLAIN',
             'Write sargable filters that can use an index', 'Rewrite slow or fragile queries as joins and NOT EXISTS'],
 concept_weeks=[11],
 examples=[
  dict(title='EXPLAIN shows how a query will run', level='Easy',
       explanation='EXPLAIN describes the plan instead of running the query. SCAN means every row is read; SEARCH means an index takes the engine straight to the matching rows.',
       tryIt='Run it, create the index in the next example, then run this again.',
       v={ds: 'EXPLAIN\nSELECT *\nFROM %s\nWHERE %s = 5;' % (IDX[ds][0], IDX[ds][1]) for ds in IDX}, pre={ds: 'DROP INDEX IF EXISTS idx_%s_%s' % (IDX[ds][0], IDX[ds][1]) for ds in IDX}),
  dict(title='Create an index', level='Easy',
       explanation='An index is a sorted lookup structure on one or more columns, like the index at the back of a book. Reads that filter or join on those columns get faster; every insert pays a small cost to keep it up to date.',
       tryIt='Now go back to the previous example and run the EXPLAIN again.',
       v={ds: 'CREATE INDEX idx_%s_%s ON %s (%s);' % (IDX[ds][0], IDX[ds][1], IDX[ds][0], IDX[ds][1]) for ds in IDX}, pre={ds: 'DROP INDEX IF EXISTS idx_%s_%s' % (IDX[ds][0], IDX[ds][1]) for ds in IDX}),
  dict(title='Sargable vs non-sargable filters', level='Medium',
       explanation='Wrapping a column in a function, such as YEAR(order_date) = 2025, hides it from any index, so every row must be checked. Comparing the raw column with a range gives the same answer and can use an index.',
       tryIt='Run both statements and compare: same rows, different cost on a big table.',
       v={ds: '-- Non-sargable: a function wraps the column\n%s\n\n-- Sargable: the raw column against a range\n%s' % (SARG[ds][0], SARG[ds][1]) for ds in SARG}),
  dict(title='Rewrite a correlated subquery as a join', level='Medium',
       explanation='A subquery in SELECT runs once per row. The same lookup written as a JOIN lets the optimiser plan one set-based operation, and it is usually easier to read.',
       tryIt='Run the subquery version too and confirm the rows are the same.',
       v={ds: CORR[ds][1] for ds in CORR}),
  dict(title='The NOT IN trap with NULLs', level='Hard',
       explanation='If the list inside NOT IN contains a NULL, the whole test becomes unknown and no rows come back. NOT EXISTS does not have this problem, which makes it the safer habit.',
       tryIt='Run the NOT IN version and see that it returns nothing.',
       v={ds: '-- Returns no rows, because the subquery contains a NULL:\n%s\n\n-- Correct:\n%s' % (NOTIN_BAD[ds], NOTIN[ds][4]) for ds in NOTIN}),
 ],
 exercises=[
  dict(level='Easy', concepts=['CREATE INDEX'], order=False, hint2='CREATE INDEX index_name ON table_name (column_name);',
       explain='The index stores the column\'s values in sorted order with a pointer to each row, so lookups and joins on that column no longer read the whole table. In MySQL InnoDB, foreign keys get an index automatically; here you create it yourself.', v=_e1()),
  dict(level='Easy', concepts=['Composite index'], order=False, hint2='List both columns in the brackets, in the order the task gives: CREATE INDEX name ON table (first_col, second_col);',
       explain='A composite index is sorted by the first column, then by the second inside it. It helps queries that filter on the first column, or on both, but not on the second column alone.', v=_e2()),
  dict(level='Medium', concepts=['Sargable filters'], order=True, hint2="Replace the function on the column with a range: column >= 'start' AND column < 'day after the end'.",
       explain='Both versions return the same rows, but yours compares the raw column, so an index on it can be used. Using < the next day instead of <= the last day also covers any time of day.',
       v={ds: dict(story='This query is slow on the production database.', task='Rewrite this query so it returns the same %s without wrapping the date column in a function: `%s` Return %s, sorted by %s.' % (SARG[ds][2], SARG[ds][0], ' and '.join(SARG[ds][3]), SARG[ds][3][0]),
                   cols=SARG[ds][3], sql=SARG[ds][1], forbid=[r'(YEAR|MONTH|DAY|DATE_FORMAT|QUARTER|DATE)\s*\(', 'The date column is still wrapped in a function. Compare the raw column with a range instead.']) for ds in SARG}),
  dict(level='Medium', concepts=['Joins vs subqueries'], order=False, hint2='Move the subquery\'s table into the FROM clause with a JOIN ... ON the same condition, and select its column directly.',
       explain='The join produces the same rows as the subquery but lets the database match the two tables in one pass instead of running a lookup per row.',
       v={ds: dict(story='A slow report runs a subquery for every row.', task='Rewrite this query as a JOIN with no subquery, returning the same %s: `%s` Return %s, in any order.' % (CORR[ds][2], CORR[ds][0], ', '.join(CORR[ds][3])),
                   cols=CORR[ds][3], sql=CORR[ds][1], forbid=[r'\(\s*SELECT\b', 'Your query still contains a subquery. Use a JOIN instead.']) for ds in CORR}),
  dict(level='Hard', concepts=['NOT EXISTS', 'NULL logic'], order=True, hint2='NOT IN returns nothing when the list contains a NULL. Use WHERE NOT EXISTS (SELECT 1 FROM ... WHERE inner.column = outer.id).',
       explain='NOT EXISTS checks for matching rows instead of comparing against a list, so a NULL in the other table cannot wipe out the result. This is both safer and usually just as fast.',
       v={ds: dict(story='A colleague\'s query should list %s, but it returns nothing.' % NOTIN[ds][3], task='This query returns no rows because %s contains NULLs: `%s` Write a version that returns the right rows without using NOT IN. Return %s, sorted by %s.' % (NULLCOL[ds], NOTIN_BAD[ds], ', '.join(NOTIN[ds][5]), NOTIN[ds][6]),
                   cols=NOTIN[ds][5], sql=NOTIN[ds][4], forbid=[r'NOT\s+IN\b', 'NOT IN is the cause of the empty result. Try NOT EXISTS or a LEFT JOIN with IS NULL.']) for ds in NOTIN}),
 ])

# ------------------------------------------------------------------ Module 12
TX = {  # transaction exercise data per dataset
 'sales': dict(
   ins=("START TRANSACTION;\nINSERT INTO orders (order_id, customer_id, employee_id, order_date, ship_date, status, shipping_cost)\nVALUES (9001, 1, 4, '2025-12-30', NULL, 'Processing', 5.99);\nINSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price, discount)\nVALUES (9001, 9001, 3, 2, 74.50, 0);\nCOMMIT;",
        "Record a new order as one transaction: insert order 9001 for customer 1, handled by employee 4, dated 2025-12-30, no ship date, status 'Processing', shipping cost 5.99; and one order item 9001 for that order: product 3, quantity 2, unit price 74.50, discount 0. Commit at the end.",
        "SELECT (SELECT COUNT(*) FROM orders WHERE order_id = 9001) AS order_rows, (SELECT COUNT(*) FROM order_items WHERE order_id = 9001) AS item_rows"),
   rb=('order_items', 'all order items'),
   upd=("START TRANSACTION;\nUPDATE products\nSET unit_price = ROUND(unit_price * 1.10, 2)\nWHERE category_id = 2;\nCOMMIT;", "Raise the unit price of every product in category 2 by 10%, rounded to 2 decimals, inside a transaction, and commit.", "SELECT product_id, unit_price FROM products WHERE category_id = 2 ORDER BY product_id"),
   chk=('order_audit', "CREATE TABLE order_audit (\n    audit_id INT PRIMARY KEY,\n    order_id INT NOT NULL,\n    quantity INT NOT NULL CHECK (quantity > 0),\n    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0)\n);", "Create a table called order_audit with columns audit_id (INT, primary key), order_id (INT, not null), quantity (INT, not null) and unit_price (DECIMAL(10,2), not null), with CHECK constraints so quantity must be greater than 0 and unit_price cannot be negative."),
   hard=("START TRANSACTION;\nUPDATE orders SET status = 'Cancelled' WHERE order_id = 5;\nUPDATE products\nSET stock_quantity = stock_quantity + (SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = 5 AND oi.product_id = products.product_id)\nWHERE product_id IN (SELECT product_id FROM order_items WHERE order_id = 5);\nCOMMIT;",
         "A customer cancelled order 5. In one transaction, set its status to 'Cancelled' and put the units back into stock: add each item's quantity on order 5 to that product's stock_quantity. Commit at the end.",
         "SELECT (SELECT status FROM orders WHERE order_id = 5) AS order_status, (SELECT SUM(p.stock_quantity) FROM products p WHERE p.product_id IN (SELECT product_id FROM order_items WHERE order_id = 5)) AS stock_of_items")),
 'sport': dict(
   ins=("START TRANSACTION;\nINSERT INTO players (player_id, team_id, first_name, last_name, position, nationality, birth_date, market_value_usd, shirt_number)\nVALUES (900, 12, 'Tobi', 'Adeleke', 'FW', 'Nigeria', '2004-05-14', 2500000, 9);\nINSERT INTO transfers (transfer_id, player_id, from_team_id, to_team_id, fee_usd, transfer_date)\nVALUES (900, 900, NULL, 12, NULL, '2025-12-30');\nCOMMIT;",
        "Riverside Rovers (team 12) sign their first player. In one transaction, insert player 900: Tobi Adeleke, forward ('FW'), Nigeria, born 2004-05-14, valued 2,500,000, shirt 9, team 12; and transfer 900 recording him joining team 12 from no club (from_team_id NULL, fee NULL) on 2025-12-30. Commit at the end.",
        "SELECT (SELECT COUNT(*) FROM players WHERE team_id = 12) AS rovers_players, (SELECT COUNT(*) FROM transfers WHERE transfer_id = 900) AS transfer_rows"),
   rb=('goals', 'all goals'),
   upd=("START TRANSACTION;\nUPDATE players\nSET market_value_usd = market_value_usd * 1.20\nWHERE team_id = 1 AND position = 'FW';\nCOMMIT;", "After a great season, raise the market value of team 1's forwards ('FW') by 20% inside a transaction, and commit.", "SELECT player_id, ROUND(market_value_usd, 2) AS market_value_usd FROM players WHERE team_id = 1 ORDER BY player_id"),
   chk=('match_reports', "CREATE TABLE match_reports (\n    report_id INT PRIMARY KEY,\n    match_id INT NOT NULL,\n    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 10),\n    minutes_played INT NOT NULL CHECK (minutes_played >= 0)\n);", "Create a table called match_reports with columns report_id (INT, primary key), match_id (INT, not null), rating (INT, not null) and minutes_played (INT, not null), with CHECK constraints so rating must be between 1 and 10 and minutes_played cannot be negative."),
   hard=("START TRANSACTION;\nUPDATE players SET team_id = 3 WHERE player_id = 5;\nINSERT INTO transfers (transfer_id, player_id, from_team_id, to_team_id, fee_usd, transfer_date)\nVALUES (901, 5, 1, 3, 4000000, '2025-12-31');\nCOMMIT;",
         "Player 5 moves from team 1 to team 3 for 4,000,000. In one transaction, update the player's team and insert transfer 901 (from team 1 to team 3, fee 4000000, dated 2025-12-31). Commit at the end.",
         "SELECT (SELECT team_id FROM players WHERE player_id = 5) AS new_team, (SELECT COUNT(*) FROM transfers WHERE transfer_id = 901 AND from_team_id = 1 AND to_team_id = 3) AS transfer_rows")),
 'fashion': dict(
   ins=("START TRANSACTION;\nINSERT INTO sales (sale_id, store_id, staff_id, customer_id, sale_date, channel)\nVALUES (9001, 1, 7, 3, '2025-12-30', 'In-store');\nINSERT INTO sale_lines (line_id, sale_id, product_id, qty, unit_price, discount)\nVALUES (9001, 9001, 5, 1, 59.99, 0);\nCOMMIT;",
        "Record a new sale as one transaction: insert sale 9001 at store 1 by staff member 7 for customer 3, dated 2025-12-30, channel 'In-store'; and sale line 9001 for that sale: product 5, qty 1, unit price 59.99, discount 0. Commit at the end.",
        "SELECT (SELECT COUNT(*) FROM sales WHERE sale_id = 9001) AS sale_rows, (SELECT COUNT(*) FROM sale_lines WHERE sale_id = 9001) AS line_rows"),
   rb=('sale_lines', 'all sale lines'),
   upd=("START TRANSACTION;\nUPDATE products\nSET retail_price = ROUND(retail_price * 0.85, 2)\nWHERE category = 'Accessories';\nCOMMIT;", "For the January sale, cut the retail price of every 'Accessories' product by 15%, rounded to 2 decimals, inside a transaction, and commit.", "SELECT product_id, retail_price FROM products WHERE category = 'Accessories' ORDER BY product_id"),
   chk=('price_changes', "CREATE TABLE price_changes (\n    change_id INT PRIMARY KEY,\n    product_id INT NOT NULL,\n    new_price DECIMAL(10,2) NOT NULL CHECK (new_price > 0),\n    discount DECIMAL(4,2) NOT NULL CHECK (discount BETWEEN 0 AND 0.9)\n);", "Create a table called price_changes with columns change_id (INT, primary key), product_id (INT, not null), new_price (DECIMAL(10,2), not null) and discount (DECIMAL(4,2), not null), with CHECK constraints so new_price must be greater than 0 and discount must be between 0 and 0.9."),
   hard=("START TRANSACTION;\nINSERT INTO returns (return_id, line_id, return_date, reason)\nVALUES (901, 10, '2025-12-31', 'Wrong size');\nUPDATE sale_lines SET discount = 1 WHERE line_id = 10;\nCOMMIT;",
         "Process a full refund for sale line 10. In one transaction, insert return 901 for line 10 dated 2025-12-31 with reason 'Wrong size', and set that line's discount to 1 so it no longer counts as revenue. Commit at the end.",
         "SELECT (SELECT COUNT(*) FROM returns WHERE return_id = 901 AND line_id = 10) AS return_rows, (SELECT discount FROM sale_lines WHERE line_id = 10) AS line_discount")),
 'politics': dict(
   ins=("START TRANSACTION;\nINSERT INTO candidates (candidate_id, party_id, first_name, last_name, gender, birth_year)\nVALUES (900, 8, 'Ada', 'Okonjo', 'Female', 1988);\nINSERT INTO results (result_id, election_id, constituency_id, candidate_id, votes)\nVALUES (900, 3, 30, 900, 0);\nCOMMIT;",
        "The Silver Party (party 8) registers its first candidate. In one transaction, insert candidate 900: Ada Okonjo, party 8, 'Female', born 1988; and result 900 placing her in election 3, constituency 30, with 0 votes. Commit at the end.",
        "SELECT (SELECT COUNT(*) FROM candidates WHERE party_id = 8) AS silver_candidates, (SELECT COUNT(*) FROM results WHERE result_id = 900) AS result_rows"),
   rb=('results', 'all results'),
   upd=("START TRANSACTION;\nUPDATE constituencies\nSET registered_voters = registered_voters + 1500\nWHERE region_id = 6;\nCOMMIT;", "After a registration drive, add 1,500 registered voters to every constituency in region 6 inside a transaction, and commit.", "SELECT constituency_id, registered_voters FROM constituencies WHERE region_id = 6 ORDER BY constituency_id"),
   chk=('recount_requests', "CREATE TABLE recount_requests (\n    request_id INT PRIMARY KEY,\n    constituency_id INT NOT NULL,\n    margin_votes INT NOT NULL CHECK (margin_votes >= 0),\n    status VARCHAR(20) NOT NULL CHECK (status IN ('Open', 'Granted', 'Refused'))\n);", "Create a table called recount_requests with columns request_id (INT, primary key), constituency_id (INT, not null), margin_votes (INT, not null) and status (VARCHAR(20), not null), with CHECK constraints so margin_votes cannot be negative and status must be one of 'Open', 'Granted' or 'Refused'."),
   hard=("START TRANSACTION;\nUPDATE results SET votes = votes - 120 WHERE result_id = 160;\nUPDATE results SET votes = votes + 120 WHERE result_id = 159;\nCOMMIT;",
         "A recount moved 120 ballots in constituency 1: they were counted for result 160 but belong to result 159. In one transaction, take 120 votes off result 160 and add 120 to result 159, so the total is unchanged. Commit at the end.",
         "SELECT (SELECT votes FROM results WHERE result_id = 160) AS result_160, (SELECT votes FROM results WHERE result_id = 159) AS result_159, (SELECT SUM(votes) FROM results WHERE election_id = 3 AND constituency_id = 1) AS seat_total")),
 'finance': dict(
   ins=("START TRANSACTION;\nINSERT INTO loans (loan_id, customer_id, officer_id, product, principal, interest_rate_pct, disbursed_date, tenor_months, status)\nVALUES (9001, 1, 10, 'Personal Loan', 250000, 26, '2025-12-30', 6, 'Active');\nINSERT INTO transactions (txn_id, account_id, txn_date, amount, direction, channel)\nVALUES (9001, 1, '2025-12-30', 250000, 'Credit', 'Branch');\nCOMMIT;",
        "Disburse a new loan as one transaction: insert loan 9001 for customer 1, officer 10, 'Personal Loan', principal 250000, rate 26, disbursed 2025-12-30, tenor 6 months, status 'Active'; and transaction 9001 crediting 250000 to account 1 on 2025-12-30 through 'Branch'. Commit at the end.",
        "SELECT (SELECT COUNT(*) FROM loans WHERE loan_id = 9001) AS loan_rows, (SELECT COUNT(*) FROM transactions WHERE txn_id = 9001) AS txn_rows"),
   rb=('repayments', 'all repayments'),
   upd=("START TRANSACTION;\nUPDATE loans\nSET interest_rate_pct = interest_rate_pct - 2\nWHERE product = 'Salary Advance' AND status = 'Active';\nCOMMIT;", "The bank cuts rates: lower interest_rate_pct by 2 points on every 'Salary Advance' loan whose status is 'Active', inside a transaction, and commit.", "SELECT loan_id, interest_rate_pct FROM loans WHERE product = 'Salary Advance' ORDER BY loan_id"),
   chk=('loan_applications', "CREATE TABLE loan_applications (\n    application_id INT PRIMARY KEY,\n    customer_id INT NOT NULL,\n    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),\n    tenor_months INT NOT NULL CHECK (tenor_months BETWEEN 1 AND 36)\n);", "Create a table called loan_applications with columns application_id (INT, primary key), customer_id (INT, not null), amount (DECIMAL(12,2), not null) and tenor_months (INT, not null), with CHECK constraints so amount must be greater than 0 and tenor_months must be between 1 and 36."),
   hard=("START TRANSACTION;\nINSERT INTO transactions (txn_id, account_id, txn_date, amount, direction, channel)\nVALUES (9101, 1, '2025-12-31', 50000, 'Debit', 'Mobile');\nINSERT INTO transactions (txn_id, account_id, txn_date, amount, direction, channel)\nVALUES (9102, 2, '2025-12-31', 50000, 'Credit', 'Mobile');\nCOMMIT;",
         "Transfer 50,000 from account 1 to account 2 as one transaction: insert transaction 9101 debiting account 1 and transaction 9102 crediting account 2, both 50000, dated 2025-12-31, channel 'Mobile'. Commit at the end.",
         "SELECT txn_id, account_id, direction, amount FROM transactions WHERE txn_id IN (9101, 9102) ORDER BY txn_id")),
 'healthcare': dict(
   ins=("START TRANSACTION;\nINSERT INTO appointments (appointment_id, patient_id, doctor_id, scheduled_at, status, wait_minutes)\nVALUES (9001, 149, 2, '2025-12-31 09:00', 'Completed', 15);\nINSERT INTO appointment_diagnoses (appointment_id, diagnosis_code)\nVALUES (9001, 'Z00');\nCOMMIT;",
        "Patient 149 finally has a first visit. In one transaction, insert appointment 9001 for patient 149 with doctor 2 at '2025-12-31 09:00', status 'Completed', wait 15 minutes; and record diagnosis 'Z00' for that appointment in appointment_diagnoses. Commit at the end.",
        "SELECT (SELECT COUNT(*) FROM appointments WHERE patient_id = 149) AS visits_149, (SELECT COUNT(*) FROM appointment_diagnoses WHERE appointment_id = 9001) AS diagnosis_rows"),
   rb=('prescriptions', 'all prescriptions'),
   upd=("START TRANSACTION;\nUPDATE doctors\nSET consultation_fee = consultation_fee + 5\nWHERE department_id = 4;\nCOMMIT;", "Dermatology (department 4) raises its fees: add 5 to the consultation fee of every doctor in department 4 inside a transaction, and commit.", "SELECT doctor_id, consultation_fee FROM doctors WHERE department_id = 4 ORDER BY doctor_id"),
   chk=('triage_scores', "CREATE TABLE triage_scores (\n    triage_id INT PRIMARY KEY,\n    appointment_id INT NOT NULL,\n    pain_score INT NOT NULL CHECK (pain_score BETWEEN 0 AND 10),\n    wait_minutes INT NOT NULL CHECK (wait_minutes >= 0)\n);", "Create a table called triage_scores with columns triage_id (INT, primary key), appointment_id (INT, not null), pain_score (INT, not null) and wait_minutes (INT, not null), with CHECK constraints so pain_score must be between 0 and 10 and wait_minutes cannot be negative."),
   hard=("START TRANSACTION;\nUPDATE appointments SET status = 'Cancelled' WHERE appointment_id = 920;\nINSERT INTO appointments (appointment_id, patient_id, doctor_id, scheduled_at, status, wait_minutes)\nVALUES (9002, 31, 2, '2026-01-05 10:00', 'Scheduled', NULL);\nCOMMIT;",
         "Patient 31 wants to move appointment 920. In one transaction, set appointment 920's status to 'Cancelled' and insert appointment 9002 for patient 31 with doctor 2 at '2026-01-05 10:00', status 'Scheduled', wait NULL. Commit at the end.",
         "SELECT (SELECT status FROM appointments WHERE appointment_id = 920) AS old_status, (SELECT COUNT(*) FROM appointments WHERE appointment_id = 9002 AND status = 'Scheduled') AS new_rows")),
}

TXN_REQ = [r'(START\s+TRANSACTION|BEGIN)', 'Wrap the changes in a transaction: start with START TRANSACTION.']
COMMIT_REQ = [r'\bCOMMIT\b', 'Finish the transaction with COMMIT so the changes are saved.']


def _m12():
    e1, e2, e3, e4, e5 = {}, {}, {}, {}, {}
    for ds, t in TX.items():
        sql, task, ver = t['ins']
        e1[ds] = dict(story='Two inserts must succeed or fail together.', task=task, cols=None, sql=sql, verify=ver, require=[TXN_REQ, COMMIT_REQ],
                      verifyMsg='The new rows are not both there. Check the ids and values in your INSERT statements.')
        tab, noun = t['rb']
        e2[ds] = dict(story='You want to prove that ROLLBACK really undoes work.',
                      task='Start a transaction, delete %s, check inside the transaction that the table is now empty with SELECT COUNT(*), then ROLLBACK. The data must be untouched afterwards.' % noun,
                      cols=None, sql='START TRANSACTION;\nDELETE FROM %s;\nSELECT COUNT(*) AS rows_inside FROM %s;\nROLLBACK;' % (tab, tab), verify='SELECT COUNT(*) AS rows_after FROM %s' % tab,
                      require=[TXN_REQ, [r'\bROLLBACK\b', 'Finish with ROLLBACK, not COMMIT, so the delete is undone.'], [r'\bDELETE\b', 'The task asks you to delete the rows first.']],
                      verifyMsg='Rows are missing after your script. Use ROLLBACK, not COMMIT, so the delete is undone.')
        sql, task, ver = t['upd']
        e3[ds] = dict(story='A price or value change must be applied in one go.', task=task, cols=None, sql=sql, verify=ver, require=[TXN_REQ, COMMIT_REQ],
                      verifyMsg='The updated values do not match. Check the WHERE filter and the calculation.')
        name, sql, task = t['chk']
        e4[ds] = dict(story='Bad data must be stopped by the database itself.', task=task, cols=None, sql=sql, pre='DROP TABLE IF EXISTS %s' % name,
                      verify="SELECT name, (sql LIKE '%%CHECK%%') AS has_check, (LENGTH(sql) - LENGTH(REPLACE(UPPER(sql), 'CHECK', ''))) / 5 AS check_count, (SELECT COUNT(*) FROM pragma_table_info('%s')) AS columns FROM sqlite_master WHERE type = 'table' AND name = '%s'" % (name, name),
                      verifyMsg='The table is missing, or it does not have two CHECK constraints and four columns.')
        sql, task, ver = t['hard']
        e5[ds] = dict(story='Two related changes must never be half done.', task=task, cols=None, sql=sql, verify=ver, require=[TXN_REQ, COMMIT_REQ],
                      verifyMsg='The data after your script does not match. Both changes must be applied, with the exact ids and values in the task.')
    return e1, e2, e3, e4, e5


_T1, _T2, _T3, _T4, _T5 = _m12()

M12 = dict(
 id='m12', number=12, phase=3, title='Transactions and Data Integrity', minutes=240,
 objectives=['Group changes into a transaction with START TRANSACTION and COMMIT', 'Undo work safely with ROLLBACK',
             'Protect data with CHECK constraints', 'Explain ACID and isolation levels'],
 concept_weeks=[12],
 examples=[
  dict(title='COMMIT makes a group of changes permanent', level='Easy',
       explanation='A transaction groups statements so they succeed or fail as one unit. Nothing is final until COMMIT.',
       tryIt='Press Reset data afterwards to remove the new rows.',
       v={ds: TX[ds]['ins'][0] + '\n\n' + TX[ds]['ins'][2] + ';' for ds in TX}),
  dict(title='ROLLBACK undoes everything since START TRANSACTION', level='Easy',
       explanation='If something goes wrong half way, ROLLBACK throws away every uncommitted change, so no half-finished data is left behind.',
       tryIt='Replace ROLLBACK with COMMIT only if you want to see what an accident feels like, then press Reset data.',
       v={ds: 'START TRANSACTION;\nDELETE FROM %s;\nSELECT COUNT(*) AS rows_inside_transaction FROM %s;\nROLLBACK;\n\nSELECT COUNT(*) AS rows_after_rollback FROM %s;' % (TX[ds]['rb'][0], TX[ds]['rb'][0], TX[ds]['rb'][0]) for ds in TX}),
  dict(title='CHECK constraints stop bad data at the door', level='Medium',
       explanation='A CHECK rule is enforced by the database itself, so no application, import or manual edit can break it. MySQL enforces CHECK from version 8.0.16.',
       tryIt='The second insert fails on purpose. Change the bad value to a valid one and run again.',
       v={ds: 'DROP TABLE IF EXISTS %s;\n%s\n\nINSERT INTO %s VALUES %s;\nINSERT INTO %s VALUES %s;' % (TX[ds]['chk'][0], TX[ds]['chk'][1], TX[ds]['chk'][0], ('(1, 1, 59.99, 0.10)' if ds == 'fashion' else '(1, 1, 5, 5)'), TX[ds]['chk'][0], ('(2, 1, -5.00, 0.10)' if ds == 'fashion' else '(2, 1, -1, 5)')) if ds != 'politics' else
          "DROP TABLE IF EXISTS recount_requests;\n%s\n\nINSERT INTO recount_requests VALUES (1, 1, 250, 'Open');\nINSERT INTO recount_requests VALUES (2, 1, 90, 'Pending');" % TX['politics']['chk'][1] for ds in TX}),
  dict(title='Isolation levels (MySQL server)', level='Medium', ref=True,
       explanation='Isolation controls what one transaction can see of another\'s unfinished work. MySQL InnoDB defaults to REPEATABLE READ; READ COMMITTED prevents dirty reads; READ UNCOMMITTED allows them.',
       v={ds: "-- Check the current level\nSELECT @@transaction_isolation;\n\n-- Change it for this session\nSET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;\n\n-- Lock the rows you are about to change\nSTART TRANSACTION;\nSELECT * FROM %s WHERE %s = 1 FOR UPDATE;\n-- ... updates ...\nCOMMIT;" % (TX[ds]['rb'][0], {'sales': 'order_id', 'sport': 'goal_id', 'fashion': 'line_id', 'politics': 'result_id', 'finance': 'repayment_id', 'healthcare': 'prescription_id'}[ds]) for ds in TX}),
 ],
 exercises=[
  dict(level='Easy', concepts=['START TRANSACTION', 'COMMIT'], order=False, hint2='START TRANSACTION; then both INSERT statements; then COMMIT;',
       explain='Both rows are written as one unit. If the second insert had failed, you would ROLLBACK and neither row would exist, so you never get an order without its items.', v=_T1),
  dict(level='Easy', concepts=['ROLLBACK'], order=False, hint2='START TRANSACTION; DELETE FROM table; SELECT COUNT(*) FROM table; ROLLBACK;',
       explain='Inside the transaction the count is 0, but ROLLBACK discards the delete, so the table is exactly as it was. The check counts the rows after your script.', v=_T2),
  dict(level='Medium', concepts=['UPDATE', 'Transactions'], order=False, hint2='START TRANSACTION; UPDATE table SET column = new_value WHERE filter; COMMIT;',
       explain='The UPDATE changes every matching row in one statement, and the transaction makes sure the change is saved as a whole. Always test the WHERE filter with a SELECT first.', v=_T3),
  dict(level='Medium', concepts=['CHECK constraints'], order=False, hint2='Add CHECK (condition) after the column type, for example quantity INT NOT NULL CHECK (quantity > 0).',
       explain='Defining CHECK constraints when the table is created works on MySQL 8.0.16+ and most other databases. From then on, any row that breaks a rule is rejected.', v=_T4),
  dict(level='Hard', concepts=['Transactions', 'Atomicity'], order=False, hint2='Put both statements between START TRANSACTION and COMMIT. Use the exact ids and values from the task.',
       explain='Atomicity means all or nothing: either both changes are saved or neither is. That is what keeps a transfer, a recount or a cancellation consistent.', v=_T5),
 ])
