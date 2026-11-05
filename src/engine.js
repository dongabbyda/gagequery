/* GageQuery SQL engine: sql.js (SQLite) + a MySQL compatibility layer.
   Runs inside a Web Worker (preferred) or on the main thread as a fallback. */
(function (G) {
  'use strict';
  var SQL = null, ready = null;
  var pristine = {};   // dataset id -> Uint8Array of the untouched database
  var working = {};    // dataset id -> Database the learner is changing

  /* ------------------------------------------------------------ MySQL functions */
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function pd(s) {
    if (s == null) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
  }
  function dateFormat(s, f) {
    var d = pd(s); if (!d || f == null) return null;
    var Y = d.getUTCFullYear(), M = d.getUTCMonth(), D = d.getUTCDate(), W = d.getUTCDay(), H = d.getUTCHours();
    var doy = Math.floor((d - Date.UTC(Y, 0, 1)) / 864e5) + 1;
    return String(f).replace(/%([a-zA-Z%])/g, function (a, c) {
      switch (c) {
        case 'Y': return Y; case 'y': return pad(Y % 100); case 'm': return pad(M + 1); case 'c': return M + 1;
        case 'd': return pad(D); case 'e': return D; case 'b': return MONTHS[M].slice(0, 3); case 'M': return MONTHS[M];
        case 'a': return DAYS[W].slice(0, 3); case 'W': return DAYS[W]; case 'w': return W; case 'j': return pad(doy, 3);
        case 'H': return pad(H); case 'h': case 'I': return pad(H % 12 || 12); case 'i': return pad(d.getUTCMinutes());
        case 's': case 'S': return pad(d.getUTCSeconds()); case 'p': return H < 12 ? 'AM' : 'PM'; case '%': return '%';
        default: return a;
      }
    });
  }
  function dayNum(d) { return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 864e5; }
  function register(db) {
    function variadic(name, fn) { Object.defineProperty(fn, 'length', { value: -1 }); db.create_function(name, fn); }
    variadic('CONCAT', function () {
      var a = Array.prototype.slice.call(arguments);
      for (var i = 0; i < a.length; i++) if (a[i] == null) return null;
      return a.join('');
    });
    variadic('CONCAT_WS', function () {
      var a = Array.prototype.slice.call(arguments), sep = a.shift();
      if (sep == null) return null;
      return a.filter(function (x) { return x != null; }).join(sep);
    });
    variadic('ROUND', function (x, n) {          // MySQL DECIMAL-style half-up rounding
      if (x == null) return null;
      n = n == null ? 0 : Math.trunc(n);
      var v = Number(x); if (!isFinite(v)) return null;
      v = Number(v.toPrecision(12));
      var r = Number(Math.round(Number(Math.abs(v) + 'e' + n)) + 'e-' + n);
      return v < 0 ? -r : r;
    });
    db.create_function('DATE_FORMAT', function (s, f) { return dateFormat(s, f); });
    db.create_function('YEAR', function (s) { var d = pd(s); return d ? d.getUTCFullYear() : null; });
    db.create_function('MONTH', function (s) { var d = pd(s); return d ? d.getUTCMonth() + 1 : null; });
    db.create_function('DAY', function (s) { var d = pd(s); return d ? d.getUTCDate() : null; });
    db.create_function('DAYOFMONTH', function (s) { var d = pd(s); return d ? d.getUTCDate() : null; });
    db.create_function('QUARTER', function (s) { var d = pd(s); return d ? Math.floor(d.getUTCMonth() / 3) + 1 : null; });
    db.create_function('DAYNAME', function (s) { var d = pd(s); return d ? DAYS[d.getUTCDay()] : null; });
    db.create_function('MONTHNAME', function (s) { var d = pd(s); return d ? MONTHS[d.getUTCMonth()] : null; });
    db.create_function('DATEDIFF', function (a, b) { var x = pd(a), y = pd(b); return x && y ? Math.round(dayNum(x) - dayNum(y)) : null; });
    db.create_function('CURDATE', function () { return '2025-12-31'; });
    db.create_function('LEFT', function (s, n) { return s == null || n == null ? null : String(s).slice(0, Math.max(0, n)); });
    db.create_function('RIGHT', function (s, n) { return s == null || n == null ? null : (n <= 0 ? '' : String(s).slice(-n)); });
    db.create_function('LOCATE', function (sub, s) { return s == null || sub == null ? null : String(s).toLowerCase().indexOf(String(sub).toLowerCase()) + 1; });
    db.create_function('LPAD', function (s, n, p) { if (s == null) return null; s = String(s); p = p == null ? ' ' : String(p); while (s.length < n) s = p + s; return s.slice(0, n); });
    db.create_function('REVERSE', function (s) { return s == null ? null : String(s).split('').reverse().join(''); });
  }

  /* ------------------------------------------------------------ statements */
  function splitSql(sql) {
    var out = [], cur = '', i = 0, q = null, n = sql.length;
    while (i < n) {
      var ch = sql[i], two = sql.substr(i, 2);
      if (q) { cur += ch; if (ch === q) { if (sql[i + 1] === q) { cur += sql[++i]; } else q = null; } i++; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { q = ch; cur += ch; i++; continue; }
      if (two === '--' || ch === '#') { var e = sql.indexOf('\n', i); if (e < 0) e = n; i = e; continue; }
      if (two === '/*') { var e2 = sql.indexOf('*/', i + 2); i = e2 < 0 ? n : e2 + 2; continue; }
      if (ch === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue; }
      cur += ch; i++;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function rewrite(st) {
    var notes = [], t = st;
    if (/^\s*(ATTACH|DETACH)\b/i.test(t) || /writable_schema/i.test(t)) return { error: 'That command is switched off in GageQuery.' };
    if (/^\s*USE\s+/i.test(t)) return { sql: null, notes: ['USE is ignored: each dataset is a single database.'] };
    if (/^\s*SHOW\s+TABLES\s*$/i.test(t)) return { sql: "SELECT name AS table_name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name", notes: notes };
    var d = /^\s*(?:DESCRIBE|DESC|SHOW\s+COLUMNS\s+FROM)\s+`?([A-Za-z_]\w*)`?\s*$/i.exec(t);
    if (d) return { sql: "SELECT name AS Field, type AS Type, CASE WHEN \"notnull\"=1 THEN 'NO' ELSE 'YES' END AS \"Null\", CASE WHEN pk>0 THEN 'PRI' ELSE '' END AS \"Key\" FROM pragma_table_info('" + d[1] + "')", notes: notes };
    if (/^\s*START\s+TRANSACTION\b/i.test(t)) t = t.replace(/^\s*START\s+TRANSACTION/i, 'BEGIN');
    if (/^\s*EXPLAIN\s+(SELECT|WITH)/i.test(t)) { t = t.replace(/^\s*EXPLAIN\s+/i, 'EXPLAIN QUERY PLAN '); notes.push('EXPLAIN shows the browser engine’s plan. SCAN means a full table read (type ALL in MySQL); SEARCH means an index is used.'); }
    var cr = /^\s*CREATE\s+OR\s+REPLACE\s+VIEW\s+(\w+)/i.exec(t);
    if (cr) t = 'DROP VIEW IF EXISTS ' + cr[1] + ';\n' + t.replace(/^\s*CREATE\s+OR\s+REPLACE\s+VIEW/i, 'CREATE VIEW');
    t = t.replace(/\bAS\s+(?:SIGNED|UNSIGNED)(?:\s+INTEGER)?\b/gi, 'AS INTEGER');
    t = t.replace(/^\s*DROP\s+INDEX\s+(IF\s+EXISTS\s+)?(\w+)\s+ON\s+\w+/i, function (a, ie, name) { return 'DROP INDEX ' + (ie || '') + name; });
    t = t.replace(/\bENGINE\s*=\s*\w+/gi, '').replace(/\bAUTO_INCREMENT\b/gi, '');
    return { sql: t, notes: notes };
  }
  function exec(db, sql, rowCap) {
    var t0 = Date.now(), res = { cols: null, rows: null, total: 0, error: null, notes: [], changed: 0, ran: 0, count: 0, stmt: 0 };
    var stmts = splitSql(sql); res.count = stmts.length;
    if (stmts.length && /^(START\s+TRANSACTION|BEGIN)\b/i.test(stmts[0])) { try { db.exec('ROLLBACK'); } catch (e) {} }
    for (var i = 0; i < stmts.length; i++) {
      var rw = rewrite(stmts[i]);
      if (rw.error) { res.error = rw.error; res.stmt = i + 1; break; }
      rw.notes.forEach(function (n) { if (res.notes.indexOf(n) < 0) res.notes.push(n); });
      if (!rw.sql) { res.ran++; continue; }
      try {
        if (/^\s*(SELECT|WITH|EXPLAIN|PRAGMA|VALUES)\b/i.test(rw.sql)) {
          var stm = db.prepare(rw.sql), rows = [];
          try { var cols = stm.getColumnNames(); while (stm.step()) { rows.push(stm.get()); } } finally { stm.free(); }
          res.ran++; res.cols = cols; res.total = rows.length; res.rows = rowCap ? rows.slice(0, rowCap) : rows;
        } else {
          db.exec(rw.sql); res.ran++; res.cols = null; res.rows = null; res.changed += db.getRowsModified();
        }
      } catch (e) { res.error = e.message; res.stmt = i + 1; res.failed = stmts[i]; break; }
    }
    res.ms = Date.now() - t0;
    return res;
  }
  function fresh(ds) { var d = new SQL.Database(pristine[ds]); register(d); return d; }
  function quiet(db, sql) { if (!sql) return; splitSql(sql).forEach(function (s) { var r = rewrite(s); if (r.sql) try { db.exec(r.sql); } catch (e) {} }); }

  function schema(db) {
    var t = db.exec("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, rowid");
    if (!t.length) return [];
    return t[0].values.map(function (r) {
      var name = r[0];
      var cols = db.exec("SELECT name, type, pk FROM pragma_table_info('" + name + "')")[0].values;
      var fks = {};
      try { (db.exec("SELECT \"from\", \"table\" FROM pragma_foreign_key_list('" + name + "')")[0] || { values: [] }).values.forEach(function (f) { fks[f[0]] = f[1]; }); } catch (e) {}
      var n = db.exec('SELECT COUNT(*) FROM "' + name + '"')[0].values[0][0];
      return { name: name, rows: n, cols: cols.map(function (c) { return { name: c[0], type: String(c[1]).replace(/ COLLATE NOCASE/i, '').toLowerCase(), pk: !!c[2], fk: fks[c[0]] || null }; }) };
    });
  }
  function q1(db, sql) { var r = db.exec(sql); return r.length ? r[0].values : []; }
  function viz(db, s) {
    var matched = q1(db, 'SELECT p.' + s.pk + ', p.' + s.label + ' FROM ' + s.parent + ' p WHERE EXISTS (SELECT 1 FROM ' + s.child + ' c WHERE c.' + s.fk + ' = p.' + s.pk + ') ORDER BY p.' + s.pk + ' LIMIT 4');
    var unmatched = q1(db, 'SELECT p.' + s.pk + ', p.' + s.label + ' FROM ' + s.parent + ' p WHERE NOT EXISTS (SELECT 1 FROM ' + s.child + ' c WHERE c.' + s.fk + ' = p.' + s.pk + ') ORDER BY p.' + s.pk + ' LIMIT 2');
    var children = [];
    matched.forEach(function (m, i) {
      var lim = i === 0 ? 2 : 1;
      q1(db, 'SELECT ' + s.ck + ', ' + s.fk + ' FROM ' + s.child + ' WHERE ' + s.fk + ' = ' + JSON.stringify(m[0]) + ' ORDER BY ' + s.ck + ' LIMIT ' + lim).forEach(function (c) { children.push(c); });
    });
    var inner = q1(db, 'SELECT COUNT(*) FROM ' + s.parent + ' p JOIN ' + s.child + ' c ON c.' + s.fk + ' = p.' + s.pk)[0][0];
    var left = q1(db, 'SELECT COUNT(*) FROM ' + s.parent + ' p LEFT JOIN ' + s.child + ' c ON c.' + s.fk + ' = p.' + s.pk)[0][0];
    var right = q1(db, 'SELECT COUNT(*) FROM ' + s.child + ' c LEFT JOIN ' + s.parent + ' p ON c.' + s.fk + ' = p.' + s.pk)[0][0];
    return { matched: matched, unmatched: unmatched, children: children, inner: inner, left: left, right: right, full: left + right - inner };
  }

  function handle(m) {
    try {
      switch (m.cmd) {
        case 'open': {
          if (!pristine[m.ds]) {
            var d0 = new SQL.Database(); register(d0); d0.exec(m.sql);
            pristine[m.ds] = d0.export(); d0.close();
          }
          if (!working[m.ds]) working[m.ds] = fresh(m.ds);
          return { ok: true };
        }
        case 'run': {
          var db = working[m.ds];
          quiet(db, m.pre);
          return exec(db, m.sql, 500);
        }
        case 'check': {
          var a = fresh(m.ds), b = fresh(m.ds);
          quiet(a, m.pre); quiet(b, m.pre);
          var mine = exec(a, m.learner, 0);
          if (!mine.error && m.verify) mine = exec(a, m.verify, 0);
          var exp = exec(b, m.solution, 0);
          if (!exp.error && m.verify) exp = exec(b, m.verify, 0);
          a.close(); b.close();
          return { mine: mine, expected: exp };
        }
        case 'snapshot': return { bytes: working[m.ds].export() };
        case 'restore': { try { working[m.ds].close(); } catch (e) {} working[m.ds] = new SQL.Database(m.bytes); register(working[m.ds]); return { ok: true }; }
        case 'resetData': { try { working[m.ds].close(); } catch (e) {} working[m.ds] = fresh(m.ds); return { ok: true }; }
        case 'schema': return { tables: schema(working[m.ds]) };
        case 'viz': { var p = new SQL.Database(pristine[m.ds]); var out = viz(p, m.spec); p.close(); return out; }
        case 'selftest': {
          var bad = [], n = 0;
          m.items.forEach(function (it) {
            var d = fresh(it.ds); quiet(d, it.pre); var r = exec(d, it.sql, 0); if (!r.error && it.verify) r = exec(d, it.verify, 0); d.close(); n++;
            if (r.error) bad.push(it.label + ': ' + r.error);
            else if (it.expectRows != null && r.total !== it.expectRows) bad.push(it.label + ': ' + r.total + ' rows, expected ' + it.expectRows);
            else if (it.expectRows == null && !it.ddl && (!r.rows || !r.total) && !/NOT IN/i.test(it.sql)) bad.push(it.label + ': no rows');
          });
          return { checked: n, problems: bad };
        }
      }
      return { error: 'Unknown command' };
    } catch (e) { return { error: e.message }; }
  }

  function boot() {
    if (!ready) ready = G.initSqlJs().then(function (S) { SQL = S; });
    return ready;
  }
  var inWorker = typeof G.WorkerGlobalScope !== 'undefined' && G instanceof G.WorkerGlobalScope;
  if (inWorker) {
    G.onmessage = function (e) {
      var m = e.data;
      boot().then(function () { var r = handle(m); r.id = m.id; G.postMessage(r); })
        .catch(function (err) { G.postMessage({ id: m.id, error: 'Engine failed to start: ' + (err && err.message || err) }); });
    };
  } else {
    G.__qcEngine = { call: function (m) { return boot().then(function () { var r = handle(m); r.id = m.id; return r; }); } };
  }
})(self);
