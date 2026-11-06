# Module 0: a short tour of what a database is, before any query-writing skills.

TOUR = {  # main table, its primary key, a row id to look up, a small table, a big table
 'sales': ('customers', 'customer_id', 7, 'categories', 'orders'),
 'sport': ('players', 'player_id', 12, 'teams', 'players'),
 'fashion': ('customers', 'customer_id', 5, 'stores', 'customers'),
 'politics': ('constituencies', 'constituency_id', 4, 'regions', 'constituencies'),
 'finance': ('customers', 'customer_id', 9, 'branches', 'loans'),
 'healthcare': ('patients', 'patient_id', 6, 'departments', 'doctors'),
}
WHO = {'sales': 'ShopCorp', 'sport': 'the league', 'fashion': 'Atelier Lagos', 'politics': 'the commission',
       'finance': 'Harbor Microfinance Bank', 'healthcare': 'Riverside Clinics'}
FK = {  # child table, foreign key column, parent table
 'sales': ('orders', 'customer_id', 'customers'), 'sport': ('players', 'team_id', 'teams'), 'fashion': ('sales', 'store_id', 'stores'),
 'politics': ('constituencies', 'region_id', 'regions'), 'finance': ('loans', 'customer_id', 'customers'),
 'healthcare': ('appointments', 'patient_id', 'patients'),
}

M0 = dict(
 id='m00', number=0, phase=1, title='Start Here: Databases, Tables and Keys', minutes=30,
 objectives=['Say what a database, a table, a row and a column are', 'Read a table\'s columns and data types',
             'Explain how a primary key and a foreign key connect two tables', 'Run your first three queries'],
 concept_weeks=[],
 extra_concepts=[
  dict(term='Database', what='A database is an organised collection of tables that a program can search and update quickly and safely.',
       whenWhy='Companies keep customers, sales, payments and patients in databases. SQL is the language you use to ask them questions.'),
  dict(term='Table, row and column', what='A table is like one sheet of a spreadsheet. Each row is one thing (a customer, an order). Each column is one fact about it (a name, a date).',
       whenWhy='Every query names the table it reads from and the columns it needs, so knowing the layout is the first step.'),
  dict(term='Data types', what='Every column has a type: whole numbers (INT), decimals (DECIMAL), text (VARCHAR) or dates (DATE).',
       whenWhy='The type decides what you can do: add numbers, compare dates, search text. DESCRIBE table_name shows the types.'),
  dict(term='Primary key', what='A primary key is a column whose value is different on every row, such as customer_id.',
       whenWhy='It is how you point at exactly one row, and how other tables refer to it.'),
  dict(term='Foreign key', what='A foreign key is a column that holds another table\'s primary key, such as orders.customer_id.',
       whenWhy='Foreign keys are the links between tables. Module 4 uses them to join tables together.'),
  dict(term='NULL', what='NULL means "no value": unknown or not recorded. It is not zero and not an empty text.',
       whenWhy='Real data has gaps. Module 2 shows how to find and handle them.'),
 ],
 examples=[
  dict(title='SHOW TABLES lists what is in the database', level='Easy',
       explanation='Start every new database by seeing which tables it has. Each name is one kind of thing the business records.',
       tryIt='Pick a table name from the list for the next example.',
       v={ds: 'SHOW TABLES;' for ds in TOUR}),
  dict(title='DESCRIBE shows the columns and their types', level='Easy',
       explanation='DESCRIBE lists every column with its data type. Key PRI marks the primary key. Null YES means the column may be empty.',
       tryIt='Describe a different table.',
       v={ds: 'DESCRIBE %s;' % t[0] for ds, t in TOUR.items()}),
  dict(title='Look at a few rows', level='Easy',
       explanation='SELECT * means every column, FROM names the table, and LIMIT 5 keeps the output short. Each line of the result is one row.',
       tryIt='Change 5 to 10.',
       v={ds: 'SELECT *\nFROM %s\nLIMIT 5;' % t[0] for ds, t in TOUR.items()}),
  dict(title='Count the rows', level='Easy',
       explanation='COUNT(*) returns one number: how many rows the table has. AS row_count gives the result column a readable name.',
       tryIt='Count the rows of another table.',
       v={ds: 'SELECT COUNT(*) AS row_count\nFROM %s;' % t[4] for ds, t in TOUR.items()}),
  dict(title='Keys connect tables', level='Easy',
       explanation='Here the foreign key column holds a value from another table\'s primary key. Every row with the same value points at the same parent row.',
       tryIt='Look up one of these parent rows in its own table.',
       v={ds: 'SELECT *\nFROM %s\nLIMIT 5;' % f[0] for ds, f in FK.items()}),
 ],
 exercises=[
  dict(level='Easy', concepts=['COUNT', 'Tables'], order=False,
       hint2='SELECT COUNT(*) AS row_count FROM table_name; returns one number.',
       explain='COUNT(*) counts every row in the table. It is the quickest way to learn how big a table is before you work with it.',
       v={ds: ('A manager at %s asks how many records the %s table holds.' % (WHO[ds], t[4]),
               'Return the number of rows in %s as row_count.' % t[4], ['row_count'], 'SELECT COUNT(*) AS row_count\nFROM %s;' % t[4])
          for ds, t in TOUR.items()}),
  dict(level='Easy', concepts=['SELECT *', 'Tables'], order=False,
       hint2='SELECT * FROM table_name; returns every column and every row.',
       explain='SELECT * is how you get to know a small table. On big tables, add LIMIT so you only see a few rows.',
       v={ds: ('You are new at %s and want to see the whole %s table.' % (WHO[ds], t[3]),
               'Return every column and every row of %s.' % t[3], None, 'SELECT *\nFROM %s;' % t[3])
          for ds, t in TOUR.items()}),
  dict(level='Easy', concepts=['Primary key', 'WHERE'], order=False,
       hint2='Add WHERE primary_key_column = number after FROM. A primary key value matches exactly one row.',
       explain='Because a primary key is different on every row, filtering on it always returns exactly one row. That is how applications fetch one record.',
       v={ds: ('A colleague asks you to pull up record %d from %s.' % (t[2], t[0]),
               'Return every column of the %s row whose %s is %d.' % (t[1][:-3], t[1], t[2]), None,
               'SELECT *\nFROM %s\nWHERE %s = %d;' % (t[0], t[1], t[2]))
          for ds, t in TOUR.items()}),
 ])
