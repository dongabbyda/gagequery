#!/usr/bin/env python3
"""Build GageQuery course content and verify every query on every dataset.

Reads   content/*.py, content/concepts.json, datasets/*.sql
Writes  build/content.json        (bundled into the app by scripts/assemble.py)
        build/verify_report.json  (read by tests/test_content.py)
Exits with status 1 if any example or exercise fails verification.
"""
import json, os, re, sqlite3, sys, datetime as dt
from decimal import Decimal, ROUND_HALF_UP

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'datasets')
OUT = os.path.join(ROOT, 'build')
sys.path.insert(0, ROOT)

# Window functions, RIGHT/FULL JOIN and the shims below need a recent SQLite (sql.js 1.10.3 ships 3.45).
if sqlite3.sqlite_version_info < (3, 39, 0):
    sys.exit('GageQuery needs Python linked to SQLite 3.39 or newer; found %s.' % sqlite3.sqlite_version)

from content.m01_m02 import M1, M2
from content.m03_m04 import M3, M4
from content.m05_m06 import M5, M6
from content.m07_m08 import M7, M8
from content.m09_m10 import M9, M10
from content.m11_m12 import M11, M12

DS = ['sales', 'sport', 'fashion', 'politics', 'finance', 'healthcare']
META = {
 'sales': dict(name='ShopCorp', sector='Sales', icon='Cart', today='2025-12-31',
               story='ShopCorp is a mid-size online retailer selling electronics, apparel, home goods, books, sports gear and beauty products. You are its new analyst.',
               viz=dict(parent='customers', pk='customer_id', label='first_name', child='orders', ck='order_id', fk='customer_id', parentNoun='customers', childNoun='orders')),
 'sport': dict(name='Premier Five League', sector='Sport', icon='Ball', today='2025-12-31',
               story='A 12-club football league with two seasons of fixtures, goals and transfers. Riverside Rovers joined for 2026 and has no squad yet. You are the league\'s data analyst.',
               viz=dict(parent='players', pk='player_id', label='last_name', child='goals', ck='goal_id', fk='player_id', parentNoun='players', childNoun='goals')),
 'fashion': dict(name='Atelier Lagos', sector='Fashion', icon='Hanger', today='2025-12-31',
                 story='A multi-brand fashion retailer with stores in Lagos, Abuja, Accra and Nairobi plus an online shop. Discounts are stored as fractions (0.20 = 20% off). You analyse sales for the buying team.',
                 viz=dict(parent='customers', pk='customer_id', label='first_name', child='sales', ck='sale_id', fk='customer_id', parentNoun='customers', childNoun='sales')),
 'politics': dict(name='Republic of Aldoria', sector='Politics', icon='Ballot', today='2025-12-31',
                  story='An invented country with invented parties named by colour, three elections and two years of polls. You work for the independent electoral commission. All people and parties are fictional.',
                  viz=dict(parent='parties', pk='party_id', label='party_name', child='candidates', ck='candidate_id', fk='party_id', parentNoun='parties', childNoun='candidates')),
 'finance': dict(name='Harbor Microfinance Bank', sector='Finance', icon='Bank', today='2025-12-31',
                 story='A lender with eight branches, savings accounts, transactions, loans and monthly repayments. Amounts are in naira. You are a credit risk analyst.',
                 viz=dict(parent='customers', pk='customer_id', label='first_name', child='loans', ck='loan_id', fk='customer_id', parentNoun='customers', childNoun='loans')),
 'healthcare': dict(name='Riverside Clinics', sector='Healthcare', icon='Clinic', today='2025-12-31',
                    story='Six outpatient departments with doctors, patients, appointments, diagnoses and prescriptions. All data is synthetic. You analyse access and waiting times.',
                    viz=dict(parent='patients', pk='patient_id', label='first_name', child='appointments', ck='appointment_id', fk='patient_id', parentNoun='patients', childNoun='appointments')),
}

# ---------------------------------------------------------------- MySQL shims for verification
MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']


def pd(s):
    if s is None:
        return None
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?', str(s))
    if not m:
        return None
    return dt.datetime(int(m[1]), int(m[2]), int(m[3]), int(m[4] or 0), int(m[5] or 0))


def date_format(s, f):
    d = pd(s)
    if d is None or f is None:
        return None
    rep = {'Y': '%04d' % d.year, 'y': '%02d' % (d.year % 100), 'm': '%02d' % d.month, 'c': str(d.month), 'd': '%02d' % d.day, 'e': str(d.day),
           'b': MONTHS[d.month - 1][:3], 'M': MONTHS[d.month - 1], 'H': '%02d' % d.hour, 'i': '%02d' % d.minute, 'W': DAYS[d.weekday()], 'a': DAYS[d.weekday()][:3]}
    return re.sub(r'%(.)', lambda m: rep.get(m[1], m[0]), f)


def sql_round(x, n=0):
    if x is None:
        return None
    q = Decimal(1).scaleb(-int(n))
    v = Decimal(repr(float(x)))
    v = Decimal(format(float(v), '.12g'))
    r = float(v.quantize(q, rounding=ROUND_HALF_UP))
    return int(r) if int(n) <= 0 else r


def connect(name):
    c = sqlite3.connect(':memory:', isolation_level=None)
    c.create_function('CONCAT', -1, lambda *a: None if any(x is None for x in a) else ''.join(str(int(x)) if isinstance(x, float) and x.is_integer() and False else str(x) for x in a))
    c.create_function('DATE_FORMAT', 2, date_format)
    c.create_function('YEAR', 1, lambda s: pd(s).year if pd(s) else None)
    c.create_function('MONTH', 1, lambda s: pd(s).month if pd(s) else None)
    c.create_function('DATEDIFF', 2, lambda a, b: (pd(a).date() - pd(b).date()).days if pd(a) and pd(b) else None)
    c.create_function('LEFT', 2, lambda s, n: None if s is None else str(s)[:n])
    c.create_function('ROUND', -1, sql_round)
    c.create_function('QUARTER', 1, lambda s: (pd(s).month - 1) // 3 + 1 if pd(s) else None)
    c.create_function('DAY', 1, lambda s: pd(s).day if pd(s) else None)
    c.create_function('DAYNAME', 1, lambda s: DAYS[pd(s).weekday()] if pd(s) else None)
    c.create_function('MONTHNAME', 1, lambda s: MONTHS[pd(s).month - 1] if pd(s) else None)
    c.create_function('RIGHT', 2, lambda s, n: None if s is None else ('' if n <= 0 else str(s)[-n:]))
    c.create_function('LOCATE', 2, lambda sub, s: None if s is None or sub is None else str(s).lower().find(str(sub).lower()) + 1)
    c.create_function('LPAD', 3, lambda s, n, p: None if s is None else (str(p) * n + str(s))[-n:] if len(str(s)) < n else str(s)[:n])
    c.executescript(open(os.path.join(DATA, name + '.sql'), encoding='utf-8').read())
    return c


def rewrite(st):
    t = st.strip()
    t = re.sub(r'^START\s+TRANSACTION', 'BEGIN', t, flags=re.I)
    t = re.sub(r'^EXPLAIN\s+(SELECT|WITH)', r'EXPLAIN QUERY PLAN \1', t, flags=re.I)
    t = re.sub(r'\bAS\s+(?:SIGNED|UNSIGNED)\b', 'AS INTEGER', t, flags=re.I)
    m = re.match(r'CREATE\s+OR\s+REPLACE\s+VIEW\s+(\w+)', t, re.I)
    if m:
        t = 'DROP VIEW IF EXISTS %s; ' % m.group(1) + re.sub(r'CREATE\s+OR\s+REPLACE\s+VIEW', 'CREATE VIEW', t, count=1, flags=re.I)
    return t


def split_sql(sql):
    out, cur, q, i = [], '', None, 0
    while i < len(sql):
        ch = sql[i]
        if q:
            cur += ch
            if ch == q: q = None
        elif ch == "'":
            q = ch; cur += ch
        elif sql.startswith('--', i):
            j = sql.find('\n', i); i = len(sql) if j < 0 else j; continue
        elif ch == ';':
            if cur.strip(): out.append(cur.strip())
            cur = ''
        else:
            cur += ch
        i += 1
    if cur.strip(): out.append(cur.strip())
    return out


def run(c, sql, quiet=False):
    cur = c.cursor()
    res = None
    for s in split_sql(sql):
        t = rewrite(s)
        try:
            if t.upper().startswith('DROP VIEW IF EXISTS') and '; ' in t:
                a, b = t.split('; ', 1); cur.execute(a); cur.execute(b)
            else:
                cur.execute(t)
        except Exception:
            if quiet: continue
            raise
        if cur.description:
            res = ([d[0] for d in cur.description], cur.fetchall())
    return res


# ---------------------------------------------------------------- concepts from the curriculum
curr = json.load(open(os.path.join(ROOT, 'content', 'concepts.json'), encoding='utf-8'))


def split_def(text):
    text = ' '.join(text.split())
    m = re.match(r'(.+?\.)\s+(.*)', text)
    return (m[1], m[2]) if m else (text, '')


def concepts_for(mod):
    out = []
    for wk in mod['concept_weeks']:
        for c in curr[wk - 1]['concepts']:
            what, why = split_def(c['def'])
            out.append(dict(term=c['term'], what=what, whenWhy=why))
    for c in mod.get('extra_concepts', []):
        out.append(c)
    return out


# ---------------------------------------------------------------- assemble + verify
problems = []
modules = []
def check_text(rules, sql):
    bare = re.sub(r'--[^\n]*', '', sql)
    bad = []
    for pat, msg in rules.get('forbid', []) and [rules['forbid']] or []:
        if re.search(pat, bare, re.I): bad.append('forbid hit: ' + pat)
    for pat, msg in rules.get('require', []) or []:
        if not re.search(pat, bare, re.I): bad.append('require missing: ' + pat)
    return bad


for mod in (M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12):
    m = dict(id=mod['id'], number=mod['number'], phase=mod['phase'], title=mod['title'], minutes=mod['minutes'],
             objectives=mod['objectives'], concepts=concepts_for(mod), examples=[], exercises=[])
    for i, ex in enumerate(mod['examples'], 1):
        e = dict(id='%s-x%02d' % (mod['id'], i), title=ex['title'], level=ex['level'], explanation=ex['explanation'],
                 tryIt=ex.get('tryIt'), visual=ex.get('visual'), v=ex['v'], ref=bool(ex.get('ref')))
        pre = ex.get('pre')
        if pre: e['pre'] = pre
        for ds in DS:
            if ds not in ex['v']:
                problems.append('%s missing %s' % (e['id'], ds)); continue
            if e['ref']: continue
            try:
                c = connect(ds)
                if pre: run(c, pre[ds] if isinstance(pre, dict) else pre, quiet=True)
                sqlx = ex['v'][ds]
                if 'fails on purpose' in (ex.get('tryIt') or ''):
                    stmts = split_sql(sqlx); run(c, ';\n'.join(stmts[:-1]) + ';')
                    try:
                        run(c, stmts[-1]); problems.append('%s %s: expected the last statement to fail' % (e['id'], ds))
                    except Exception:
                        pass
                    continue
                r = run(c, sqlx)
                if r is not None and not r[1] and 'NOT IN' not in sqlx:
                    problems.append('%s %s: example returned no rows' % (e['id'], ds))
            except Exception as err:
                problems.append('%s %s: ERROR %s' % (e['id'], ds, err))
        m['examples'].append(e)
    for i, ex in enumerate(mod['exercises'], 1):
        e = dict(id='%s-e%02d' % (mod['id'], i), level=ex['level'], concepts=ex['concepts'], orderMatters=ex['order'],
                 hint2=ex['hint2'], explain=ex['explain'], v={})
        for ds in DS:
            if ds not in ex['v']:
                problems.append('%s missing %s' % (e['id'], ds)); continue
            raw = ex['v'][ds]
            if isinstance(raw, tuple):
                story, task, cols, sql = raw; raw = dict(story=story, task=task, cols=cols, sql=sql)
            v = {k: raw[k] for k in raw if raw[k] is not None}
            try:
                c = connect(ds)
                if v.get('pre'): run(c, v['pre'], quiet=True)
                r = run(c, v['sql'])
                if v.get('verify'): r = run(c, v['verify'])
                n = len(r[1]) if r else 0
                lim = 500 if v.get('verify') else 50
                if not (1 <= n <= lim):
                    problems.append('%s %s: %d rows' % (e['id'], ds, n))
                if r:
                    if not v.get('cols'): v['cols'] = r[0]
                    if [x.lower() for x in r[0]] != [x.lower() for x in v['cols']]:
                        problems.append('%s %s: columns %s != %s' % (e['id'], ds, r[0], v['cols']))
                v['rows'] = n
                if ex['order'] and not v.get('verify'):
                    c2 = connect(ds); c2.execute('PRAGMA reverse_unordered_selects = ON')
                    if v.get('pre'): run(c2, v['pre'], quiet=True)
                    r2 = run(c2, v['sql'])
                    if r2 and r2[1] != r[1]:
                        problems.append('%s %s: ORDER BY is not deterministic' % (e['id'], ds))
                bad = check_text(v, v['sql'])
                if bad: problems.append('%s %s: %s' % (e['id'], ds, bad))
                if v.get('verify'):
                    c3 = connect(ds)
                    if v.get('pre'): run(c3, v['pre'], quiet=True)
                    try:
                        r0 = run(c3, v['verify'])
                    except Exception:
                        r0 = None
                    if r0 and r0[1] == r[1] and 'ROLLBACK' not in v['sql']:
                        problems.append('%s %s: verify gives the same result before the solution runs' % (e['id'], ds))
            except Exception as err:
                problems.append('%s %s: ERROR %s' % (e['id'], ds, err))
            e['v'][ds] = v
        m['exercises'].append(e)
    modules.append(m)

datasets = {}
for ds in DS:
    c = connect(ds)
    tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY rowid")]
    meta = dict(META[ds])
    meta['id'] = ds
    meta['rowCounts'] = {t: c.execute('SELECT COUNT(*) FROM ' + t).fetchone()[0] for t in tables}
    meta['sql'] = open(os.path.join(DATA, ds + '.sql'), encoding='utf-8').read()
    datasets[ds] = meta

os.makedirs(OUT, exist_ok=True)
json.dump(dict(modules=modules, datasets=datasets, order=DS), open(os.path.join(OUT, 'content.json'), 'w', encoding='utf-8'), ensure_ascii=False)
n_ex = sum(len(m['examples']) for m in modules); n_ez = sum(len(m['exercises']) for m in modules)
report = dict(modules=len(modules), examples=n_ex, exercises=n_ez, datasets=len(DS),
              queries_checked=(n_ex + n_ez) * len(DS), sqlite=sqlite3.sqlite_version, problems=problems)
json.dump(report, open(os.path.join(OUT, 'verify_report.json'), 'w', encoding='utf-8'), indent=1)
print('modules', len(modules), 'examples', n_ex, 'exercises', n_ez, 'queries checked', report['queries_checked'])
print('problems', len(problems))
for p in problems:
    print('  ', p)
if problems:
    sys.exit(1)
