# Extra practice for the window-function modules, the "In other databases" cards for joins and windows,
# and the Interview Practice module (classic questions, each on all six datasets).
from content.m07_m08 import SER, rnd
from content.more_a import E

NM = "CONCAT(%s.first_name, ' ', %s.last_name)"


def nm(a):
    return NM % (a, a)


# ------------------------------------------------------------------ Window functions I: ranking
EXTRA_M07 = [
 E('Easy', ['RANK', 'OVER'],
   'RANK() OVER (ORDER BY column DESC) numbers the rows from the highest value. Rows with the same value share a rank.',
   'RANK gives equal values the same number and then skips ahead (1, 2, 2, 4). That is how a league table treats teams on the same points.',
   sales=('HR is preparing a pay review.', 'Rank all employees by salary, highest = 1, using RANK. Return employee_name (first and last name), salary and salary_rank, sorted by rank, then name.', ['employee_name', 'salary', 'salary_rank'],
          "SELECT CONCAT(first_name, ' ', last_name) AS employee_name,\n       salary,\n       RANK() OVER (ORDER BY salary DESC) AS salary_rank\nFROM employees\nORDER BY salary_rank, employee_name;"),
   sport=('The club wants a value table for team 1.', 'Rank the players of team 1 by market value, highest = 1, using RANK. Return player_name (first and last name), market value and value_rank, sorted by rank, then name.', ['player_name', 'market_value_usd', 'value_rank'],
          "SELECT CONCAT(first_name, ' ', last_name) AS player_name,\n       market_value_usd,\n       RANK() OVER (ORDER BY market_value_usd DESC) AS value_rank\nFROM players\nWHERE team_id = 1\nORDER BY value_rank, player_name, player_id;"),
   fashion=('Buyers want a price ladder for shoes.', "Rank the products in the 'Shoes' category by retail price, highest = 1, using RANK. Return product name, retail price and price_rank, sorted by rank, then product name.", ['product_name', 'retail_price', 'price_rank'],
          "SELECT product_name, retail_price,\n       RANK() OVER (ORDER BY retail_price DESC) AS price_rank\nFROM products\nWHERE category = 'Shoes'\nORDER BY price_rank, product_name;"),
   politics=('The commission wants a size table for region 1.', 'Rank the constituencies of region 1 by registered voters, largest = 1, using RANK. Return constituency name, registered voters and size_rank, sorted by rank, then name.', ['constituency_name', 'registered_voters', 'size_rank'],
          "SELECT constituency_name, registered_voters,\n       RANK() OVER (ORDER BY registered_voters DESC) AS size_rank\nFROM constituencies\nWHERE region_id = 1\nORDER BY size_rank, constituency_name;"),
   finance=('Credit wants a league table for one product.', "Rank the 'SME Working Capital' loans by principal, largest = 1, using RANK. Return loan id, principal and principal_rank, sorted by rank, then loan id.", ['loan_id', 'principal', 'principal_rank'],
          "SELECT loan_id, principal,\n       RANK() OVER (ORDER BY principal DESC) AS principal_rank\nFROM loans\nWHERE product = 'SME Working Capital'\nORDER BY principal_rank, loan_id;"),
   healthcare=('Finance wants a fee league table.', 'Rank all doctors by consultation fee, highest = 1, using RANK. Return doctor_name (first and last name), consultation fee and fee_rank, sorted by rank, then name.', ['doctor_name', 'consultation_fee', 'fee_rank'],
          "SELECT CONCAT(first_name, ' ', last_name) AS doctor_name,\n       consultation_fee,\n       RANK() OVER (ORDER BY consultation_fee DESC) AS fee_rank\nFROM doctors\nORDER BY fee_rank, doctor_name, doctor_id;")),

 E('Medium', ['ROW_NUMBER', 'CTE', 'Top N per group'],
   'Number the rows inside each group with ROW_NUMBER() OVER (PARTITION BY group ORDER BY value DESC, id) in a CTE, then keep rows where the number is 2 or less.',
   'A window function cannot be used in WHERE, so the CTE numbers the rows first and the outer query filters on that number. The id in the window ORDER BY settles ties.',
   sales=('Merchandising wants the two premium products in each category.', 'For each category, find the 2 highest-priced products. Return category id, product name and unit price, sorted by category id, then price (highest first), then product name.', ['category_id', 'product_name', 'unit_price'],
          "WITH ranked AS (\n    SELECT category_id, product_name, unit_price,\n           ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY unit_price DESC, product_id) AS rn\n    FROM products\n)\nSELECT category_id, product_name, unit_price\nFROM ranked\nWHERE rn <= 2\nORDER BY category_id, unit_price DESC, product_name;"),
   sport=('Scouts want the two most valuable players in every position.', 'For each position, find the 2 players with the highest market value. Return position, player_name (first and last name) and market value, sorted by position, then value (highest first), then name.', ['position', 'player_name', 'market_value_usd'],
          "WITH ranked AS (\n    SELECT position,\n           CONCAT(first_name, ' ', last_name) AS player_name,\n           market_value_usd,\n           ROW_NUMBER() OVER (PARTITION BY position ORDER BY market_value_usd DESC, player_id) AS rn\n    FROM players\n)\nSELECT position, player_name, market_value_usd\nFROM ranked\nWHERE rn <= 2\nORDER BY position, market_value_usd DESC, player_name;"),
   fashion=('The buyers want the two priciest products in every category.', 'For each category, find the 2 products with the highest retail price. Return category, product name and retail price, sorted by category, then price (highest first), then product name.', ['category', 'product_name', 'retail_price'],
          "WITH ranked AS (\n    SELECT category, product_name, retail_price,\n           ROW_NUMBER() OVER (PARTITION BY category ORDER BY retail_price DESC, product_id) AS rn\n    FROM products\n)\nSELECT category, product_name, retail_price\nFROM ranked\nWHERE rn <= 2\nORDER BY category, retail_price DESC, product_name;"),
   politics=('The commission wants the two largest constituencies in each region.', 'For each region, find the 2 constituencies with the most registered voters. Return region id, constituency name and registered voters, sorted by region id, then voters (highest first), then name.', ['region_id', 'constituency_name', 'registered_voters'],
          "WITH ranked AS (\n    SELECT region_id, constituency_name, registered_voters,\n           ROW_NUMBER() OVER (PARTITION BY region_id ORDER BY registered_voters DESC, constituency_id) AS rn\n    FROM constituencies\n)\nSELECT region_id, constituency_name, registered_voters\nFROM ranked\nWHERE rn <= 2\nORDER BY region_id, registered_voters DESC, constituency_name;"),
   finance=('The credit committee wants the two largest loans of each product.', 'For each loan product, find the 2 loans with the largest principal. Return product, loan id and principal, sorted by product, then principal (largest first), then loan id.', ['product', 'loan_id', 'principal'],
          "WITH ranked AS (\n    SELECT product, loan_id, principal,\n           ROW_NUMBER() OVER (PARTITION BY product ORDER BY principal DESC, loan_id) AS rn\n    FROM loans\n)\nSELECT product, loan_id, principal\nFROM ranked\nWHERE rn <= 2\nORDER BY product, principal DESC, loan_id;"),
   healthcare=('The medical director wants the two highest-fee doctors in each department.', 'For each department, find the 2 doctors with the highest consultation fee. Return department id, doctor_name (first and last name) and fee, sorted by department id, then fee (highest first), then name.', ['department_id', 'doctor_name', 'consultation_fee'],
          "WITH ranked AS (\n    SELECT department_id,\n           CONCAT(first_name, ' ', last_name) AS doctor_name,\n           consultation_fee,\n           ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY consultation_fee DESC, doctor_id) AS rn\n    FROM doctors\n)\nSELECT department_id, doctor_name, consultation_fee\nFROM ranked\nWHERE rn <= 2\nORDER BY department_id, consultation_fee DESC, doctor_name;")),

 E('Hard', ['SUM OVER', 'PARTITION BY', 'Percent of total'],
   'SUM(column) OVER (PARTITION BY group) gives each row its group total. Divide the row value by it, multiply by 100.0, and ROUND to 1 decimal.',
   'The window SUM keeps every row and attaches the group total to each one, so a single query gives both the row and its share of the group. Using 100.0 avoids whole-number division.',
   sales=('HR wants to see each salary as a share of its department payroll.', 'For every employee, return department, employee_name (first and last name), salary and pct_of_department (salary as a percentage of the department\'s total salaries, 1 decimal). Sort by department, then pct (highest first), then name.', ['department', 'employee_name', 'salary', 'pct_of_department'],
          "SELECT department,\n       CONCAT(first_name, ' ', last_name) AS employee_name,\n       salary,\n       ROUND(salary * 100.0 / SUM(salary) OVER (PARTITION BY department), 1) AS pct_of_department\nFROM employees\nORDER BY department, pct_of_department DESC, employee_name;"),
   sport=('The board wants to know how concentrated value is in teams 1 and 2.', 'For players of teams 1 and 2, return team id, player_name (first and last name), market value and pct_of_team (value as a percentage of the team total, 1 decimal). Sort by team id, then value (highest first), then name.', ['team_id', 'player_name', 'market_value_usd', 'pct_of_team'],
          "SELECT team_id,\n       CONCAT(first_name, ' ', last_name) AS player_name,\n       market_value_usd,\n       ROUND(market_value_usd * 100.0 / SUM(market_value_usd) OVER (PARTITION BY team_id), 1) AS pct_of_team\nFROM players\nWHERE team_id IN (1, 2)\nORDER BY team_id, market_value_usd DESC, player_name, player_id;"),
   fashion=('The retail director wants each salary as a share of store payroll.', 'For staff who work in a store, return store id, staff_name (first and last name), salary and pct_of_store (salary as a percentage of that store\'s payroll, 1 decimal). Sort by store id, then salary (highest first), then name.', ['store_id', 'staff_name', 'salary', 'pct_of_store'],
          "SELECT store_id,\n       CONCAT(first_name, ' ', last_name) AS staff_name,\n       salary,\n       ROUND(salary * 100.0 / SUM(salary) OVER (PARTITION BY store_id), 1) AS pct_of_store\nFROM staff\nWHERE store_id IS NOT NULL\nORDER BY store_id, salary DESC, staff_name, staff_id;"),
   politics=('The commission wants each constituency as a share of its region.', 'For every constituency, return constituency name, region id, registered voters and pct_of_region (voters as a percentage of the region total, 1 decimal). Sort by region id, then voters (highest first), then name.', ['constituency_name', 'region_id', 'registered_voters', 'pct_of_region'],
          "SELECT constituency_name, region_id, registered_voters,\n       ROUND(registered_voters * 100.0 / SUM(registered_voters) OVER (PARTITION BY region_id), 1) AS pct_of_region\nFROM constituencies\nORDER BY region_id, registered_voters DESC, constituency_name;"),
   finance=('HR wants salaries as a share of branch payroll for the first three branches.', 'For employees of branches 1, 2 and 3, return branch id, employee_name (first and last name), salary and pct_of_branch (salary as a percentage of the branch payroll, 1 decimal). Sort by branch id, then salary (highest first), then name.', ['branch_id', 'employee_name', 'salary', 'pct_of_branch'],
          "SELECT branch_id,\n       CONCAT(first_name, ' ', last_name) AS employee_name,\n       salary,\n       ROUND(salary * 100.0 / SUM(salary) OVER (PARTITION BY branch_id), 1) AS pct_of_branch\nFROM employees\nWHERE branch_id IN (1, 2, 3)\nORDER BY branch_id, salary DESC, employee_name, employee_id;"),
   healthcare=('Finance wants each doctor\'s fee as a share of the department total.', 'For every doctor, return department id, doctor_name (first and last name), consultation fee and pct_of_department (fee as a percentage of the department\'s fees, 1 decimal). Sort by department id, then fee (highest first), then name.', ['department_id', 'doctor_name', 'consultation_fee', 'pct_of_department'],
          "SELECT department_id,\n       CONCAT(first_name, ' ', last_name) AS doctor_name,\n       consultation_fee,\n       ROUND(consultation_fee * 100.0 / SUM(consultation_fee) OVER (PARTITION BY department_id), 1) AS pct_of_department\nFROM doctors\nORDER BY department_id, consultation_fee DESC, doctor_name, doctor_id;")),
]


# ------------------------------------------------------------------ Window functions II: time series
def _ser(ds):
    cte, val, d, who, noun = SER[ds]
    return cte, val, d, who, noun


def since_start(ds):
    cte, val, d, who, noun = _ser(ds)
    task = ('Using a CTE of %s, show how far each month is from the first month. Return month (YYYY-MM), %s and change_since_start (this month minus the first month)%s, in month order.'
            % (noun, val, ', both rounded to %d decimals' % d if d else ''))
    sql = ('WITH monthly AS (\n    %s\n)\nSELECT month,\n       %s AS %s,\n       %s AS change_since_start\nFROM monthly\nORDER BY month;'
           % (cte, rnd(val, d), val, rnd('%s - FIRST_VALUE(%s) OVER (ORDER BY month)' % (val, val), d)))
    return ('%s wants to see progress against the starting point.' % who, task, ['month', val, 'change_since_start'], sql)


def cumulative_pct(ds):
    cte, val, d, who, noun = _ser(ds)
    task = ('Using a CTE of %s, show how much of the total has built up by each month. Return month (YYYY-MM), %s%s and cumulative_pct (running total as a percentage of the grand total, 1 decimal), in month order.'
            % (noun, val, ' (rounded to %d decimals)' % d if d else ''))
    sql = ('WITH monthly AS (\n    %s\n)\nSELECT month,\n       %s AS %s,\n       ROUND(SUM(%s) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) * 100.0 / SUM(%s) OVER (), 1) AS cumulative_pct\nFROM monthly\nORDER BY month;'
           % (cte, rnd(val, d), val, val, val))
    return ('%s wants to see how the total builds up.' % who, task, ['month', val, 'cumulative_pct'], sql)


def record_months(ds):
    cte, val, d, who, noun = _ser(ds)
    task = ('Using a CTE of %s, find the record months. Return month (YYYY-MM), %s, best_so_far (the highest %s up to and including that month) and is_record: \'Yes\' when the month matches best_so_far, otherwise \'No\'%s. In month order.'
            % (noun, val, val, '. Round the numbers to %d decimals' % d if d else ''))
    sql = ('WITH monthly AS (\n    %s\n),\nbest AS (\n    SELECT month, %s,\n           MAX(%s) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS best_so_far\n    FROM monthly\n)\nSELECT month,\n       %s AS %s,\n       %s AS best_so_far,\n       CASE WHEN %s = best_so_far THEN \'Yes\' ELSE \'No\' END AS is_record\nFROM best\nORDER BY month;'
           % (cte, val, val, rnd(val, d), val, rnd('best_so_far', d), val))
    return ('%s wants to know when the series hit new highs.' % who, task, ['month', val, 'best_so_far', 'is_record'], sql)


EXTRA_M08 = [
 E('Easy', ['FIRST_VALUE', 'CTE', 'OVER'],
   'In the second query use FIRST_VALUE(value) OVER (ORDER BY month) to bring the first month\'s value onto every row, then subtract it.',
   'FIRST_VALUE looks at the first row of the window, so each month can be compared with the starting point without a self-join.',
   **{ds: since_start(ds) for ds in SER}),
 E('Medium', ['SUM OVER', 'Running total', 'Percent of total'],
   'Use the running total from the earlier exercise, and divide it by SUM(value) OVER () (an empty OVER is the total of all rows). Multiply by 100.0 before dividing.',
   'An empty OVER () window covers every row, so the grand total sits next to each running total. Dividing the two shows how much of the year has been reached.',
   **{ds: cumulative_pct(ds) for ds in SER}),
 E('Hard', ['MAX OVER', 'CTE', 'CASE'],
   'Build monthly, then a second CTE with MAX(value) OVER (ORDER BY month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW). In the final query compare value with that column in a CASE.',
   'A window cannot be tested in the same SELECT that creates it, so the running maximum is made in one CTE and compared with the month\'s value in the next step.',
   **{ds: record_months(ds) for ds in SER}),
]


# ------------------------------------------------------------------ "In other databases" cards
DIALECTS_JOINS = [
 dict(topic='Keep unmatched rows from both tables',
      mysql='SELECT c.customer_id, o.order_id\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.customer_id\nUNION\nSELECT c.customer_id, o.order_id\nFROM customers c\nRIGHT JOIN orders o ON o.customer_id = c.customer_id;',
      postgres='SELECT c.customer_id, o.order_id\nFROM customers c\nFULL JOIN orders o ON o.customer_id = c.customer_id;',
      sqlserver='SELECT c.customer_id, o.order_id\nFROM customers c\nFULL OUTER JOIN orders o ON o.customer_id = c.customer_id;',
      note='MySQL has no FULL JOIN, so a LEFT JOIN and a RIGHT JOIN are combined with UNION. PostgreSQL and SQL Server have FULL JOIN built in.',
      pg_setup='CREATE TABLE customers (customer_id INT PRIMARY KEY);\nCREATE TABLE orders (order_id INT PRIMARY KEY, customer_id INT);\nINSERT INTO customers VALUES (1), (2);\nINSERT INTO orders VALUES (10, 1), (11, 3);'),
 dict(topic='Join first and last name into one column',
      mysql="SELECT CONCAT(first_name, ' ', last_name) AS customer_name\nFROM customers;",
      postgres="SELECT first_name || ' ' || last_name AS customer_name\nFROM customers;",
      sqlserver="SELECT first_name + ' ' + last_name AS customer_name\nFROM customers;",
      note='CONCAT also works in PostgreSQL and SQL Server 2012 and later. It treats NULL as an empty string, while || and + give NULL if either part is NULL.',
      pg_setup="CREATE TABLE customers (customer_id INT PRIMARY KEY, first_name VARCHAR(40), last_name VARCHAR(40));\nINSERT INTO customers VALUES (1, 'Ada', 'Obi');"),
 dict(topic='Keep only the first rows',
      mysql='SELECT order_id, order_date\nFROM orders\nORDER BY order_date, order_id\nLIMIT 10;',
      postgres='SELECT order_id, order_date\nFROM orders\nORDER BY order_date, order_id\nLIMIT 10;',
      sqlserver='SELECT TOP 10 order_id, order_date\nFROM orders\nORDER BY order_date, order_id;',
      note='PostgreSQL also accepts the standard FETCH FIRST 10 ROWS ONLY, which SQL Server writes as OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY.',
      pg_setup='CREATE TABLE orders (order_id INT PRIMARY KEY, order_date DATE);\nINSERT INTO orders VALUES (1, \'2025-01-05\'), (2, \'2025-01-06\');'),
]

DIALECTS_RANKING = [
 dict(topic='Percent of total: whole-number division',
      mysql='SELECT line_id, qty * 100 / SUM(qty) OVER () AS pct\nFROM sale_lines;',
      postgres='SELECT line_id, qty * 100.0 / SUM(qty) OVER () AS pct\nFROM sale_lines;',
      sqlserver='SELECT line_id, qty * 100.0 / SUM(qty) OVER () AS pct\nFROM sale_lines;',
      note='In MySQL, 7 / 2 is 3.5. In PostgreSQL and SQL Server, dividing two whole numbers gives a whole number (3). Writing 100.0 forces a decimal answer everywhere, so use it in all three.',
      pg_setup='CREATE TABLE sale_lines (line_id INT PRIMARY KEY, qty INT);\nINSERT INTO sale_lines VALUES (1, 3), (2, 4);'),
 dict(topic='Latest row per group',
      mysql='WITH ranked AS (\n    SELECT customer_id, order_id, order_date,\n           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn\n    FROM orders\n)\nSELECT customer_id, order_id, order_date\nFROM ranked\nWHERE rn = 1;',
      postgres='SELECT DISTINCT ON (customer_id) customer_id, order_id, order_date\nFROM orders\nORDER BY customer_id, order_date DESC, order_id DESC;',
      sqlserver='WITH ranked AS (\n    SELECT customer_id, order_id, order_date,\n           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn\n    FROM orders\n)\nSELECT customer_id, order_id, order_date\nFROM ranked\nWHERE rn = 1;',
      note='PostgreSQL has a shortcut, DISTINCT ON, that keeps the first row of each group in the ORDER BY. The ROW_NUMBER version also works in PostgreSQL.',
      pg_setup="CREATE TABLE orders (order_id INT PRIMARY KEY, customer_id INT, order_date DATE);\nINSERT INTO orders VALUES (1, 1, '2025-01-05'), (2, 1, '2025-02-01'), (3, 2, '2025-01-09');"),
]

DIALECTS_TIME = [
 dict(topic='Days between two dates',
      mysql='SELECT order_id,\n       DATEDIFF(order_date, LAG(order_date) OVER (ORDER BY order_date, order_id)) AS days_since_previous\nFROM orders;',
      postgres='SELECT order_id,\n       order_date - LAG(order_date) OVER (ORDER BY order_date, order_id) AS days_since_previous\nFROM orders;',
      sqlserver='SELECT order_id,\n       DATEDIFF(day, LAG(order_date) OVER (ORDER BY order_date, order_id), order_date) AS days_since_previous\nFROM orders;',
      note='In PostgreSQL, subtracting two dates gives a whole number of days. SQL Server needs the unit (day) as the first argument and the earlier date first.',
      pg_setup="CREATE TABLE orders (order_id INT PRIMARY KEY, order_date DATE);\nINSERT INTO orders VALUES (1, '2025-01-05'), (2, '2025-01-20'), (3, '2025-02-01');"),
 dict(topic='Group by month',
      mysql="SELECT DATE_FORMAT(order_date, '%Y-%m') AS month, COUNT(*) AS orders\nFROM orders\nGROUP BY DATE_FORMAT(order_date, '%Y-%m')\nORDER BY month;",
      postgres="SELECT TO_CHAR(order_date, 'YYYY-MM') AS month, COUNT(*) AS orders\nFROM orders\nGROUP BY TO_CHAR(order_date, 'YYYY-MM')\nORDER BY month;",
      sqlserver="SELECT FORMAT(order_date, 'yyyy-MM') AS month, COUNT(*) AS orders\nFROM orders\nGROUP BY FORMAT(order_date, 'yyyy-MM')\nORDER BY month;",
      note='The three databases name the month format differently: DATE_FORMAT with %Y-%m, TO_CHAR with YYYY-MM, and FORMAT with yyyy-MM (lower-case yyyy, upper-case MM).',
      pg_setup="CREATE TABLE orders (order_id INT PRIMARY KEY, order_date DATE);\nINSERT INTO orders VALUES (1, '2025-01-05'), (2, '2025-01-20'), (3, '2025-02-01');"),
 dict(topic='Moving average of whole numbers',
      mysql='SELECT month,\n       ROUND(AVG(visits) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3m\nFROM monthly_visits;',
      postgres='SELECT month,\n       ROUND(AVG(visits) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3m\nFROM monthly_visits;',
      sqlserver='SELECT month,\n       ROUND(AVG(visits * 1.0) OVER (ORDER BY month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3m\nFROM monthly_visits;',
      note='In SQL Server, the average of a whole-number column is also a whole number, so multiply by 1.0 (or CAST to DECIMAL) first. MySQL and PostgreSQL keep the decimals.',
      pg_setup="CREATE TABLE monthly_visits (month VARCHAR(7) PRIMARY KEY, visits INT);\nINSERT INTO monthly_visits VALUES ('2025-01', 10), ('2025-02', 15), ('2025-03', 18);"),
]


# ------------------------------------------------------------------ Interview Practice
def _per(ds, sales, sport, fashion, politics, finance, healthcare):
    return dict(sales=sales, sport=sport, fashion=fashion, politics=politics, finance=finance, healthcare=healthcare)[ds]


_SECOND = dict(
    sales=('unit price', 'products', 'unit_price', 'ShopCorp is pricing a new product range.'),
    sport=('market value', 'players', 'market_value_usd', 'A scout wants to know the next price tier below the top.'),
    fashion=('retail price', 'products', 'retail_price', 'The buyers want the price just below the flagship.'),
    politics=('number of registered voters', 'constituencies', 'registered_voters', 'The commission wants the second-largest constituency size.'),
    finance=('principal', 'loans', 'principal', 'The credit committee wants the second-largest exposure size.'),
    healthcare=('consultation fee', 'doctors', 'consultation_fee', 'Finance wants the fee just below the highest.'))


def second_highest(ds):
    noun, t, col, story = _SECOND[ds]
    task = 'Find the second-highest %s in %s: the highest value that is below the top value. Return one column, second_highest.' % (noun, t)
    sql = 'SELECT MAX(%s) AS second_highest\nFROM %s\nWHERE %s < (SELECT MAX(%s) FROM %s);' % (col, t, col, col, t)
    return (story, task, ['second_highest'], sql)


_DUP = dict(
    sales=('Data quality wants to know which states have more than one customer.', 'Find the states that have more than one customer. Return state and customers (how many), most customers first, then state.', ['state', 'customers'],
           'SELECT state, COUNT(*) AS customers\nFROM customers\nGROUP BY state\nHAVING COUNT(*) > 1\nORDER BY customers DESC, state;'),
    sport=('Data quality is checking for people who share a surname.', 'Find last names shared by at least 3 players. Return last_name and players (how many), most first, then last name.', ['last_name', 'players'],
           'SELECT last_name, COUNT(*) AS players\nFROM players\nGROUP BY last_name\nHAVING COUNT(*) >= 3\nORDER BY players DESC, last_name;'),
    fashion=('Data quality is checking for customers who share a surname.', 'Find last names shared by at least 3 customers. Return last_name and customers (how many), most first, then last name.', ['last_name', 'customers'],
           'SELECT last_name, COUNT(*) AS customers\nFROM customers\nGROUP BY last_name\nHAVING COUNT(*) >= 3\nORDER BY customers DESC, last_name;'),
    politics=('The commission is checking for candidates who share a surname.', 'Find last names shared by at least 3 candidates. Return last_name and candidates (how many), most first, then last name.', ['last_name', 'candidates'],
           'SELECT last_name, COUNT(*) AS candidates\nFROM candidates\nGROUP BY last_name\nHAVING COUNT(*) >= 3\nORDER BY candidates DESC, last_name;'),
    finance=('Compliance is checking for customers who share a surname.', 'Find last names shared by at least 3 customers. Return last_name and customers (how many), most first, then last name.', ['last_name', 'customers'],
           'SELECT last_name, COUNT(*) AS customers\nFROM customers\nGROUP BY last_name\nHAVING COUNT(*) >= 3\nORDER BY customers DESC, last_name;'),
    healthcare=('Records is checking for patients who share a surname.', 'Find last names shared by at least 3 patients. Return last_name and patients (how many), most first, then last name.', ['last_name', 'patients'],
           'SELECT last_name, COUNT(*) AS patients\nFROM patients\nGROUP BY last_name\nHAVING COUNT(*) >= 3\nORDER BY patients DESC, last_name;'))

_PCT = dict(
    sales=('The operations head asks: what share of orders get cancelled?', "What percentage of all orders have status 'Cancelled'? Return one column, cancelled_pct, rounded to 1 decimal.", ['cancelled_pct'],
           "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) / COUNT(*), 1) AS cancelled_pct\nFROM orders;"),
    sport=('The league asks: how big is home advantage?', 'What percentage of 2025 season matches were won by the home team (home goals greater than away goals)? Return one column, home_win_pct, rounded to 1 decimal.', ['home_win_pct'],
           'SELECT ROUND(100.0 * SUM(CASE WHEN home_goals > away_goals THEN 1 ELSE 0 END) / COUNT(*), 1) AS home_win_pct\nFROM matches\nWHERE season = 2025;'),
    fashion=('The board asks: how much of our business is online?', "What percentage of all sales have channel 'Online'? Return one column, online_pct, rounded to 1 decimal.", ['online_pct'],
           "SELECT ROUND(100.0 * SUM(CASE WHEN channel = 'Online' THEN 1 ELSE 0 END) / COUNT(*), 1) AS online_pct\nFROM sales;"),
    politics=('A journalist asks: how many candidates run without a party?', 'What percentage of candidates have no party (party id is empty)? Return one column, independent_pct, rounded to 1 decimal.', ['independent_pct'],
           'SELECT ROUND(100.0 * SUM(CASE WHEN party_id IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS independent_pct\nFROM candidates;'),
    finance=('The risk head asks: what share of loans went bad?', "What percentage of all loans have status 'Defaulted' or 'Written Off'? Return one column, bad_loan_pct, rounded to 1 decimal.", ['bad_loan_pct'],
           "SELECT ROUND(100.0 * SUM(CASE WHEN status IN ('Defaulted', 'Written Off') THEN 1 ELSE 0 END) / COUNT(*), 1) AS bad_loan_pct\nFROM loans;"),
    healthcare=('The medical director asks: how many appointments are missed?', "What percentage of all appointments have status 'No-show'? Return one column, no_show_pct, rounded to 1 decimal.", ['no_show_pct'],
           "SELECT ROUND(100.0 * SUM(CASE WHEN status = 'No-show' THEN 1 ELSE 0 END) / COUNT(*), 1) AS no_show_pct\nFROM appointments;"))

_PIVOT = dict(
    sales=('The sales manager wants one row per employee showing how their orders ended.', "For each employee who processed orders, return employee id and three counts: completed (status 'Completed'), cancelled (status 'Cancelled') and open_orders (status 'Processing' or 'Shipped'). Sort by employee id.", ['employee_id', 'completed', 'cancelled', 'open_orders'],
           "SELECT employee_id,\n       SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,\n       SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled,\n       SUM(CASE WHEN status IN ('Processing', 'Shipped') THEN 1 ELSE 0 END) AS open_orders\nFROM orders\nGROUP BY employee_id\nORDER BY employee_id;"),
    sport=('The league wants one row per season with the result mix.', 'For each season, return season and three counts: home_wins (home goals more than away), draws (equal goals) and away_wins (away goals more than home). Sort by season.', ['season', 'home_wins', 'draws', 'away_wins'],
           'SELECT season,\n       SUM(CASE WHEN home_goals > away_goals THEN 1 ELSE 0 END) AS home_wins,\n       SUM(CASE WHEN home_goals = away_goals THEN 1 ELSE 0 END) AS draws,\n       SUM(CASE WHEN home_goals < away_goals THEN 1 ELSE 0 END) AS away_wins\nFROM matches\nGROUP BY season\nORDER BY season;'),
    fashion=('The retail director wants one row per store comparing channels.', "For each store, return store id and two counts: online_sales (channel 'Online') and in_store_sales (channel 'In-store'). Sort by store id.", ['store_id', 'online_sales', 'in_store_sales'],
           "SELECT store_id,\n       SUM(CASE WHEN channel = 'Online' THEN 1 ELSE 0 END) AS online_sales,\n       SUM(CASE WHEN channel = 'In-store' THEN 1 ELSE 0 END) AS in_store_sales\nFROM sales\nGROUP BY store_id\nORDER BY store_id;"),
    politics=('The commission wants one row per party with its gender split.', "For candidates who belong to a party, return party id and two counts: female_candidates and male_candidates. Sort by party id.", ['party_id', 'female_candidates', 'male_candidates'],
           "SELECT party_id,\n       SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) AS female_candidates,\n       SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) AS male_candidates\nFROM candidates\nWHERE party_id IS NOT NULL\nGROUP BY party_id\nORDER BY party_id;"),
    finance=('The risk team wants one row per product with its loan outcomes.', "For each loan product, return product and three counts: active_loans (status 'Active'), closed_loans (status 'Closed') and problem_loans (status 'Defaulted' or 'Written Off'). Sort by product.", ['product', 'active_loans', 'closed_loans', 'problem_loans'],
           "SELECT product,\n       SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active_loans,\n       SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed_loans,\n       SUM(CASE WHEN status IN ('Defaulted', 'Written Off') THEN 1 ELSE 0 END) AS problem_loans\nFROM loans\nGROUP BY product\nORDER BY product;"),
    healthcare=('The medical director wants one row per doctor showing how appointments ended.', "For each doctor, return doctor id and three counts: completed (status 'Completed'), cancelled (status 'Cancelled') and no_shows (status 'No-show'). Sort by doctor id.", ['doctor_id', 'completed', 'cancelled', 'no_shows'],
           "SELECT doctor_id,\n       SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,\n       SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled,\n       SUM(CASE WHEN status = 'No-show' THEN 1 ELSE 0 END) AS no_shows\nFROM appointments\nGROUP BY doctor_id\nORDER BY doctor_id;"))

_LATEST = dict(
    sales=('Customer success wants each customer\'s most recent order.', 'For every customer who has ordered, return customer id, order id and order date of their most recent order (latest date; if two orders share a date, the higher order id). Sort by customer id.', ['customer_id', 'order_id', 'order_date'],
           "WITH ranked AS (\n    SELECT customer_id, order_id, order_date,\n           ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn\n    FROM orders\n)\nSELECT customer_id, order_id, order_date\nFROM ranked\nWHERE rn = 1\nORDER BY customer_id;"),
    sport=('The league wants the latest incoming transfer for every club.', 'For every club that has bought a player, return to_team_id, transfer id and transfer date of its most recent signing (latest date; if tied, the higher transfer id). Sort by to_team_id.', ['to_team_id', 'transfer_id', 'transfer_date'],
           "WITH ranked AS (\n    SELECT to_team_id, transfer_id, transfer_date,\n           ROW_NUMBER() OVER (PARTITION BY to_team_id ORDER BY transfer_date DESC, transfer_id DESC) AS rn\n    FROM transfers\n)\nSELECT to_team_id, transfer_id, transfer_date\nFROM ranked\nWHERE rn = 1\nORDER BY to_team_id;"),
    fashion=('The Lagos store wants to re-engage local customers.', "For customers who live in 'Lagos' and have bought something, return customer id, sale id and sale date of their most recent sale (latest date; if tied, the higher sale id). Sort by customer id.", ['customer_id', 'sale_id', 'sale_date'],
           "WITH ranked AS (\n    SELECT s.customer_id, s.sale_id, s.sale_date,\n           ROW_NUMBER() OVER (PARTITION BY s.customer_id ORDER BY s.sale_date DESC, s.sale_id DESC) AS rn\n    FROM sales s\n    JOIN customers c ON c.customer_id = s.customer_id\n    WHERE c.city = 'Lagos'\n)\nSELECT customer_id, sale_id, sale_date\nFROM ranked\nWHERE rn = 1\nORDER BY customer_id;"),
    politics=('An analyst wants the latest published poll for each party.', 'For every party with polls, return party id, fieldwork end date and vote share of its most recent poll (latest end date; if tied, the higher poll id). Sort by party id.', ['party_id', 'fieldwork_end', 'vote_share_pct'],
           "WITH ranked AS (\n    SELECT party_id, fieldwork_end, vote_share_pct,\n           ROW_NUMBER() OVER (PARTITION BY party_id ORDER BY fieldwork_end DESC, poll_id DESC) AS rn\n    FROM polls\n)\nSELECT party_id, fieldwork_end, vote_share_pct\nFROM ranked\nWHERE rn = 1\nORDER BY party_id;"),
    finance=('The regional head wants the latest lending at every branch.', 'For every branch, return branch id, loan id and disbursed date of the most recent loan to one of its customers (latest date; if tied, the higher loan id). Sort by branch id.', ['branch_id', 'loan_id', 'disbursed_date'],
           "WITH ranked AS (\n    SELECT c.branch_id, l.loan_id, l.disbursed_date,\n           ROW_NUMBER() OVER (PARTITION BY c.branch_id ORDER BY l.disbursed_date DESC, l.loan_id DESC) AS rn\n    FROM loans l\n    JOIN customers c ON c.customer_id = l.customer_id\n)\nSELECT branch_id, loan_id, disbursed_date\nFROM ranked\nWHERE rn = 1\nORDER BY branch_id;"),
    healthcare=('The medical director wants each doctor\'s most recent finished consultation.', "For every doctor with completed appointments, return doctor id, appointment id and scheduled time of their latest 'Completed' appointment (latest time; if tied, the higher appointment id). Sort by doctor id.", ['doctor_id', 'appointment_id', 'scheduled_at'],
           "WITH ranked AS (\n    SELECT doctor_id, appointment_id, scheduled_at,\n           ROW_NUMBER() OVER (PARTITION BY doctor_id ORDER BY scheduled_at DESC, appointment_id DESC) AS rn\n    FROM appointments\n    WHERE status = 'Completed'\n)\nSELECT doctor_id, appointment_id, scheduled_at\nFROM ranked\nWHERE rn = 1\nORDER BY doctor_id;"))

_PAIRS = dict(
    sales=('HR wants a list of colleagues who work in the same department.', 'List every pair of employees in the same department. Each pair should appear once (use the lower employee id as employee_1). Return department, employee_1 and employee_2 (first and last names), sorted by department, then employee_1, then employee_2.', ['department', 'employee_1', 'employee_2'],
           "SELECT a.department,\n       CONCAT(a.first_name, ' ', a.last_name) AS employee_1,\n       CONCAT(b.first_name, ' ', b.last_name) AS employee_2\nFROM employees a\nJOIN employees b ON a.department = b.department\n                AND a.employee_id < b.employee_id\nORDER BY a.department, employee_1, employee_2;"),
    sport=('The league wants to know which goalkeepers compete for a place.', "List every pair of goalkeepers ('GK') at the same team. Each pair should appear once (use the lower player id as goalkeeper_1). Return team id, goalkeeper_1 and goalkeeper_2 (first and last names), sorted by team id, then goalkeeper_1, then goalkeeper_2.", ['team_id', 'goalkeeper_1', 'goalkeeper_2'],
           "SELECT a.team_id,\n       CONCAT(a.first_name, ' ', a.last_name) AS goalkeeper_1,\n       CONCAT(b.first_name, ' ', b.last_name) AS goalkeeper_2\nFROM players a\nJOIN players b ON a.team_id = b.team_id\n              AND a.player_id < b.player_id\nWHERE a.position = 'GK' AND b.position = 'GK'\nORDER BY a.team_id, goalkeeper_1, goalkeeper_2;"),
    fashion=('The store managers want to plan stylist pairs for training.', "List every pair of stylists (role 'Stylist') who work in the same store. Each pair should appear once (use the lower staff id as stylist_1). Return store id, stylist_1 and stylist_2 (first and last names), sorted by store id, then stylist_1, then stylist_2.", ['store_id', 'stylist_1', 'stylist_2'],
           "SELECT a.store_id,\n       CONCAT(a.first_name, ' ', a.last_name) AS stylist_1,\n       CONCAT(b.first_name, ' ', b.last_name) AS stylist_2\nFROM staff a\nJOIN staff b ON a.store_id = b.store_id\n            AND a.staff_id < b.staff_id\nWHERE a.role = 'Stylist' AND b.role = 'Stylist'\nORDER BY a.store_id, stylist_1, stylist_2;"),
    politics=('The commission wants to compare neighbouring constituencies in region 1.', 'List every pair of constituencies in region 1. Each pair should appear once (use the lower constituency id as constituency_1). Return constituency_1 and constituency_2 (names), sorted by constituency_1, then constituency_2.', ['constituency_1', 'constituency_2'],
           "SELECT a.constituency_name AS constituency_1,\n       b.constituency_name AS constituency_2\nFROM constituencies a\nJOIN constituencies b ON a.region_id = b.region_id\n                     AND a.constituency_id < b.constituency_id\nWHERE a.region_id = 1\nORDER BY constituency_1, constituency_2;"),
    finance=('HR wants colleague pairs for a buddy scheme at the first two branches.', 'List every pair of employees who work at the same branch, for branches 1 and 2. Each pair should appear once (use the lower employee id as employee_1). Return branch id, employee_1 and employee_2 (first and last names), sorted by branch id, then employee_1, then employee_2.', ['branch_id', 'employee_1', 'employee_2'],
           "SELECT a.branch_id,\n       CONCAT(a.first_name, ' ', a.last_name) AS employee_1,\n       CONCAT(b.first_name, ' ', b.last_name) AS employee_2\nFROM employees a\nJOIN employees b ON a.branch_id = b.branch_id\n                AND a.employee_id < b.employee_id\nWHERE a.branch_id IN (1, 2)\nORDER BY a.branch_id, employee_1, employee_2;"),
    healthcare=('The medical director wants colleague pairs inside each department.', 'List every pair of doctors in the same department. Each pair should appear once (use the lower doctor id as doctor_1). Return department id, doctor_1 and doctor_2 (first and last names), sorted by department id, then doctor_1, then doctor_2.', ['department_id', 'doctor_1', 'doctor_2'],
           "SELECT a.department_id,\n       CONCAT(a.first_name, ' ', a.last_name) AS doctor_1,\n       CONCAT(b.first_name, ' ', b.last_name) AS doctor_2\nFROM doctors a\nJOIN doctors b ON a.department_id = b.department_id\n              AND a.doctor_id < b.doctor_id\nORDER BY a.department_id, doctor_1, doctor_2;"))

_MEDIAN_SRC = dict(
    sales=('unit price', 'products', 'unit_price', 'ShopCorp is setting a typical price point.'),
    sport=('market value', 'players', 'market_value_usd', 'A scout wants the typical player value, not skewed by stars.'),
    fashion=('retail price', 'products', 'retail_price', 'Buyers want the typical price, not skewed by luxury items.'),
    politics=('number of registered voters', 'constituencies', 'registered_voters', 'The commission wants the typical constituency size.'),
    finance=('principal', 'loans', 'principal', 'Credit wants the typical loan size, not skewed by very large loans.'),
    healthcare=('prescription cost', 'prescriptions', 'cost', 'The pharmacy wants the typical prescription cost.'))


def median(ds):
    noun, t, col, story = _MEDIAN_SRC[ds]
    alias = 'median_' + col
    task = 'Find the median %s across all rows of %s: the middle value when sorted, or the average of the two middle values when there is an even number of rows. Return one column, %s, rounded to 2 decimals.' % (noun, t, alias)
    sql = ('WITH ordered AS (\n    SELECT %s AS x,\n           ROW_NUMBER() OVER (ORDER BY %s) AS rn,\n           COUNT(*) OVER () AS n\n    FROM %s\n)\nSELECT ROUND(AVG(x), 2) AS %s\nFROM ordered\nWHERE rn BETWEEN n / 2.0 AND n / 2.0 + 1;'
           % (col, col, t, alias))
    return (story, task, [alias], sql)


_INTERVIEW_CONCEPTS = [
 dict(term='Say your plan before you type', what='In an interview, restate the question, say which tables and columns you need, and name the technique (for example "GROUP BY and HAVING") before writing any SQL.',
      whenWhy='Interviewers hire people who think clearly. A spoken plan shows that, and it catches a misunderstanding early.'),
 dict(term='Start with the simple version', what='Write the easy query first (one table, no filter), check the result, then add one change at a time.',
      whenWhy='A small query that works is a safe base. Adding joins and filters one by one makes it clear which step broke something.'),
 dict(term='Ask about ties, NULLs and duplicates', what='Before you answer, ask: what if two rows tie, a value is empty, or a row appears twice?',
      whenWhy='These three cases are where most wrong answers hide. Naming them shows care, and one extra line of SQL usually settles each one.'),
]

_EX_NTH = dict(
    sales="SELECT product_name, unit_price\nFROM (\n    SELECT product_name, unit_price,\n           DENSE_RANK() OVER (ORDER BY unit_price DESC) AS price_rank\n    FROM products\n) ranked\nWHERE price_rank = 3;",
    sport="SELECT first_name, last_name, market_value_usd\nFROM (\n    SELECT first_name, last_name, market_value_usd,\n           DENSE_RANK() OVER (ORDER BY market_value_usd DESC) AS value_rank\n    FROM players\n) ranked\nWHERE value_rank = 3;",
    fashion="SELECT product_name, retail_price\nFROM (\n    SELECT product_name, retail_price,\n           DENSE_RANK() OVER (ORDER BY retail_price DESC) AS price_rank\n    FROM products\n) ranked\nWHERE price_rank = 3;",
    politics="SELECT constituency_name, registered_voters\nFROM (\n    SELECT constituency_name, registered_voters,\n           DENSE_RANK() OVER (ORDER BY registered_voters DESC) AS size_rank\n    FROM constituencies\n) ranked\nWHERE size_rank = 3;",
    finance="SELECT loan_id, principal\nFROM (\n    SELECT loan_id, principal,\n           DENSE_RANK() OVER (ORDER BY principal DESC) AS principal_rank\n    FROM loans\n) ranked\nWHERE principal_rank = 3;",
    healthcare="SELECT first_name, last_name, consultation_fee\nFROM (\n    SELECT first_name, last_name, consultation_fee,\n           DENSE_RANK() OVER (ORDER BY consultation_fee DESC) AS fee_rank\n    FROM doctors\n) ranked\nWHERE fee_rank = 3;")

_EX_AVG = dict(
    sales="SELECT product_name, category_id, unit_price,\n       ROUND(AVG(unit_price) OVER (PARTITION BY category_id), 2) AS category_avg\nFROM products\nORDER BY category_id, product_name\nLIMIT 12;",
    sport="SELECT last_name, position, market_value_usd,\n       ROUND(AVG(market_value_usd) OVER (PARTITION BY position), 0) AS position_avg\nFROM players\nORDER BY position, last_name, player_id\nLIMIT 12;",
    fashion="SELECT product_name, category, retail_price,\n       ROUND(AVG(retail_price) OVER (PARTITION BY category), 2) AS category_avg\nFROM products\nORDER BY category, product_name\nLIMIT 12;",
    politics="SELECT constituency_name, region_id, registered_voters,\n       ROUND(AVG(registered_voters) OVER (PARTITION BY region_id), 0) AS region_avg\nFROM constituencies\nORDER BY region_id, constituency_name\nLIMIT 12;",
    finance="SELECT loan_id, product, principal,\n       ROUND(AVG(principal) OVER (PARTITION BY product), 0) AS product_avg\nFROM loans\nORDER BY product, loan_id\nLIMIT 12;",
    healthcare="SELECT last_name, department_id, consultation_fee,\n       ROUND(AVG(consultation_fee) OVER (PARTITION BY department_id), 2) AS department_avg\nFROM doctors\nORDER BY department_id, last_name, doctor_id\nLIMIT 12;")

M16 = dict(
    id='m16', phase=4, title='Interview Practice: Classic Questions', minutes=180,
    objectives=['Solve the SQL questions that come up again and again in analyst interviews',
                'Explain your approach in plain words before you write the query',
                'Handle ties, NULLs and duplicates, the three places where interview answers go wrong'],
    concept_weeks=[],
    extra_concepts=_INTERVIEW_CONCEPTS,
    examples=[
        dict(title='The Nth highest value with DENSE_RANK', level='Medium',
             explanation='"Find the third-highest" is a classic. DENSE_RANK numbers the distinct values without gaps, so rank 3 is the third-highest value, and ties all show.',
             tryIt='Change 3 to another rank.', v=_EX_NTH),
        dict(title='Compare each row with its group average', level='Medium',
             explanation='AVG with OVER (PARTITION BY ...) puts the group average on every row while keeping all the rows. This is the window version of a correlated subquery.',
             tryIt='Replace AVG with MAX to see the group maximum next to each row.', v=_EX_AVG),
    ],
    exercises=[
        E('Easy', ['MAX', 'Subquery'],
          'The highest value is MAX(column). The second-highest is the MAX of the values that are smaller than that. Use a subquery for the top value.',
          'Take the biggest value out of the running with a subquery, then MAX of what is left is the second-highest. An empty row set gives NULL, which is the right answer when there is no second value.',
          order=False, **{ds: second_highest(ds) for ds in SER}),
        E('Easy', ['GROUP BY', 'HAVING', 'COUNT'],
          'GROUP BY the column that might repeat, then keep the groups with HAVING COUNT(*) above the limit.',
          'Grouping by a column and counting each group is the standard way to find repeated values. HAVING filters on the count, which WHERE cannot do.',
          **_DUP),
        E('Medium', ['CASE', 'SUM', 'Percentage'],
          'SUM(CASE WHEN condition THEN 1 ELSE 0 END) counts the matching rows. Multiply by 100.0, divide by COUNT(*), and ROUND.',
          'The CASE turns each row into 1 or 0, so SUM counts the matches. Dividing by COUNT(*) and using 100.0 gives a percentage with decimals.',
          order=False, **_PCT),
        E('Medium', ['Conditional aggregation', 'GROUP BY'],
          'GROUP BY the row label, and add one SUM(CASE WHEN ... THEN 1 ELSE 0 END) column for each outcome.',
          'Each SUM(CASE ...) is one column of the table, so one query turns many rows into a small summary table. This is the SQL version of a pivot table.',
          **_PIVOT),
        E('Medium', ['ROW_NUMBER', 'CTE', 'Latest per group'],
          'In a CTE, number the rows in each group with ROW_NUMBER() OVER (PARTITION BY group ORDER BY date DESC, id DESC), then keep rn = 1.',
          'Sorting newest first and numbering from 1 puts the latest row of every group at number 1. The id in the window ORDER BY decides ties on the date.',
          **_LATEST),
        E('Medium', ['Self-join', 'Pairs'],
          'Join the table to itself on the shared column and add a.id < b.id, so each pair appears once and nobody is paired with themselves.',
          'The test a.id < b.id keeps only one of the two orderings of each pair and removes pairs of a row with itself.',
          **_PAIRS),
        E('Hard', ['Median', 'ROW_NUMBER', 'COUNT OVER'],
          'In a CTE, number the rows in order and count all rows with COUNT(*) OVER (). The middle rows are those where rn BETWEEN n / 2.0 AND n / 2.0 + 1. Average them.',
          'For an odd number of rows exactly one row is in that range, for an even number there are two. Averaging the rows in range gives the median in both cases.',
          order=False, **{ds: median(ds) for ds in SER}),
    ])
