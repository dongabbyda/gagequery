(function () {
'use strict';
var DATA = JSON.parse(document.getElementById('qc-data').textContent);
var MODS = DATA.modules, DSETS = DATA.datasets, ORDER = DATA.order;
var EX_BY_ID = {}, MOD_BY_ID = {};
MODS.forEach(function (m) { MOD_BY_ID[m.id] = m; m.exercises.forEach(function (e, i) { e.n = i + 1; e.mod = m; EX_BY_ID[e.id] = e; }); });
var ALL_EX = []; MODS.forEach(function (m) { m.exercises.forEach(function (e) { ALL_EX.push(e); }); });

/* ================================================================ helpers */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function md(s) { return esc(s || '').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); }
function h(tag, attrs) {
  var el = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    var v = attrs[k]; if (v === false || v == null) continue;
    if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
  }
  for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); }); else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  return el;
}
function $(sel, root) { return (root || document).querySelector(sel); }

/* ================================================================ storage */
var KEY = 'gagequery-v1';
var S = { ds: null, progress: {}, drafts: {}, hints: {}, helped: {} };
try { var raw = localStorage.getItem(KEY) || localStorage.getItem('querycraft-v1'); if (raw) { var p = JSON.parse(raw); for (var k in p) S[k] = p[k]; } } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function curDs() { return S.ds && DSETS[S.ds] ? S.ds : 'sales'; }
function exState(id) { return (S.progress[id] || {}).state || 'new'; }
function setState(id, st) {
  var cur = exState(id);
  var rank = { 'new': 0, attempted: 1, helped: 2, solved: 3 };
  if (rank[st] > rank[cur] || (st === 'solved' && cur === 'helped' && !S.helped[id])) S.progress[id] = { state: st, ds: curDs(), at: Date.now() };
  save(); paintRail(); paintMeter();
}
var POINTS = { Easy: 10, Medium: 20, Hard: 40 };
function points() { var t = 0; ALL_EX.forEach(function (e) { var s = exState(e.id); if (s === 'solved') t += POINTS[e.level]; else if (s === 'helped') t += POINTS[e.level] / 2; }); return t; }
function modDone(m) { var n = 0; m.exercises.forEach(function (e) { var s = exState(e.id); if (s === 'solved' || s === 'helped') n++; }); return n; }
function modComplete(m) { return m.exercises.every(function (e) { return e.level === 'Hard' || exState(e.id) === 'solved' || exState(e.id) === 'helped'; }); }

/* ================================================================ engine (worker with timeout, main-thread fallback) */
var Engine = (function () {
  var worker = null, seq = 0, waiting = {}, mode = 'worker', opened = {};
  function src(id) { return document.getElementById(id).textContent; }
  function start() {
    try {
      var blob = new Blob([src('sqljs-src') + '\n;\n' + src('engine-src')], { type: 'text/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
      worker.onmessage = function (e) { var w = waiting[e.data.id]; if (w) { clearTimeout(w.t); delete waiting[e.data.id]; w.resolve(e.data); } };
      worker.onerror = function (e) { e.preventDefault && e.preventDefault(); fallback(); };
    } catch (e) { fallback(); }
  }
  function fallback() {
    if (mode === 'main') return;
    mode = 'main';
    try { if (worker) worker.terminate(); } catch (e) {}
    worker = null;
    [src('sqljs-src'), src('engine-src')].forEach(function (code) { var s = document.createElement('script'); s.textContent = code; document.head.appendChild(s); });
    Object.keys(waiting).forEach(function (id) { var w = waiting[id]; clearTimeout(w.t); delete waiting[id]; call(w.msg, w.ms).then(w.resolve); });
  }
  function call(msg, ms) {
    msg.id = ++seq;
    if (mode === 'main') return window.__qcEngine.call(msg);
    return new Promise(function (resolve) {
      var w = { resolve: resolve, msg: msg, ms: ms };
      w.t = setTimeout(function () {
        delete waiting[msg.id];
        try { worker.terminate(); } catch (e) {}
        opened = {}; start();
        resolve({ error: 'TIMEOUT', timeout: true });
      }, ms || 4000);
      waiting[msg.id] = w;
      worker.postMessage(msg);
    });
  }
  function open(ds) {
    if (opened[ds]) return opened[ds];
    opened[ds] = call({ cmd: 'open', ds: ds, sql: DSETS[ds].sql }, 30000).then(function (r) { if (r.error) { delete opened[ds]; throw new Error(r.error); } return r; });
    return opened[ds];
  }
  function req(ds, msg, ms) { return open(ds).then(function () { msg.ds = ds; return call(msg, ms || 3000); }); }
  start();
  return { open: open, req: req, mode: function () { return mode; }, fallback: fallback };
})();

/* ================================================================ schema cache */
var schemaCache = {};
function getSchema(ds) {
  if (!schemaCache[ds]) schemaCache[ds] = Engine.req(ds, { cmd: 'schema' }).then(function (r) { if (r.error) { delete schemaCache[ds]; throw new Error(r.error); } return r.tables; });
  return schemaCache[ds];
}

/* ================================================================ SQL formatting, hints, starters */
var CLAUSES = ['SELECT', 'FROM', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'UNION ALL', 'UNION'];
var KW = 'select from where and or not in is null like between as on join inner left right full outer cross group by order having limit offset distinct union all case when then else end exists with recursive over partition rows asc desc insert into values update set delete create table view index drop alter add constraint check primary key foreign references default unique if count sum avg min max round concat coalesce'.split(' ');
function formatSql(sql) {
  var parts = [], re = /('(?:[^']|'')*'|--[^\n]*|\s+|[A-Za-z_][A-Za-z_0-9]*|[^\sA-Za-z_'])/g, m;
  while ((m = re.exec(sql))) parts.push(m[1]);
  var out = '', i, tok;
  for (i = 0; i < parts.length; i++) {
    tok = parts[i];
    if (/^\s+$/.test(tok)) { out += ' '; continue; }
    if (/^[A-Za-z_]/.test(tok) && KW.indexOf(tok.toLowerCase()) >= 0) tok = tok.toUpperCase();
    out += tok;
  }
  out = out.replace(/ +/g, ' ').replace(/ ?, ?/g, ', ').trim();
  out = out.replace(/\s+(FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|(?:LEFT |RIGHT |INNER |FULL )?(?:OUTER )?JOIN|UNION(?: ALL)?)\b/g, '\n$1');
  out = out.replace(/\s+(AND|OR)\s+/g, '\n  $1 ').replace(/;\s*/g, ';\n');
  return out.trim() + (/;$/.test(out.trim()) ? '' : ';');
}
function tablesIn(sql) { var t = [], re = /\b(?:FROM|JOIN)\s+([A-Za-z_]\w*)/gi, m; while ((m = re.exec(sql))) if (t.indexOf(m[1]) < 0) t.push(m[1]); return t; }
function skeleton(sql) {
  var cv = /^\s*CREATE\s+VIEW\s+(\w+)\s+AS\s+([\s\S]*)$/i.exec(sql.replace(/--[^\n]*/g, ''));
  if (cv) return 'CREATE VIEW ' + cv[1] + ' AS\n' + skeleton(cv[2]);
  if (!/^\s*(--[^\n]*\n\s*)*(SELECT|WITH)\b/i.test(sql)) return scriptSkeleton(sql);
  var s = sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/;\s*$/, '').trim();
  var re = /\b(SELECT|FROM|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT)\b/gi, idx = [], m;
  while ((m = re.exec(s))) idx.push({ kw: m[1].toUpperCase(), at: m.index, end: m.index + m[0].length });
  var lines = [];
  idx.forEach(function (c, i) {
    var body = s.slice(c.end, i + 1 < idx.length ? idx[i + 1].at : s.length).trim();
    if (c.kw === 'FROM') lines.push('FROM ' + body);
    else if (/JOIN$/.test(c.kw)) lines.push(c.kw + ' ' + body.replace(/\s+ON\s+.*$/i, '') + ' ON ___');
    else lines.push(c.kw + ' ___');
  });
  return lines.join('\n') + ';';
}
function isScript(v) { return !!v.verify; }
function scriptSkeleton(sql) {
  return sql.replace(/--[^\n]*/g, '').split(';').map(function (st) { return st.trim(); }).filter(Boolean).map(function (st) {
    var m;
    if ((m = /^INSERT\s+INTO\s+(\w+)\s*(\([^)]*\))?/i.exec(st))) return 'INSERT INTO ' + m[1] + ' ' + (m[2] || '') + ' VALUES (___);';
    if ((m = /^UPDATE\s+(\w+)/i.exec(st))) return 'UPDATE ' + m[1] + ' SET ___ WHERE ___;';
    if ((m = /^DELETE\s+FROM\s+(\w+)/i.exec(st))) return 'DELETE FROM ' + m[1] + ';';
    if ((m = /^CREATE\s+INDEX\s+\w+\s+ON\s+(\w+)/i.exec(st))) return 'CREATE INDEX ___ ON ' + m[1] + ' (___);';
    if ((m = /^CREATE\s+TABLE\s+(\w+)/i.exec(st))) return 'CREATE TABLE ' + m[1] + ' (\n    ___ INT PRIMARY KEY,\n    ___ ___ NOT NULL CHECK (___),\n    ...\n);';
    if (/^(START\s+TRANSACTION|BEGIN|COMMIT|ROLLBACK)/i.test(st)) return st.toUpperCase() + ';';
    if (/^SELECT/i.test(st)) return 'SELECT ___ FROM ___;';
    return st.split(/\s+/).slice(0, 3).join(' ') + ' ___;';
  }).join('\n');
}
function starter(ex, ds) {
  var v = ex.v[ds];
  if (isScript(v)) return '-- Write your SQL here. The checker runs it on a fresh copy of the data,\n-- then runs the query shown under "How it is checked".\n';
  var t = tablesIn(v.sql)[0] || ''; return '-- Return: ' + v.cols.join(', ') + '\nSELECT \nFROM ' + t + '\n';
}
function hint1(ex, ds) { var t = tablesIn(ex.v[ds].sql); return 'Look at ' + (t.length === 1 ? 'the ' + t[0] + ' table' : 'these tables: ' + t.join(', ')) + '. The output needs ' + ex.v[ds].cols.length + ' column' + (ex.v[ds].cols.length > 1 ? 's' : '') + ': ' + ex.v[ds].cols.join(', ') + '.'; }

/* ================================================================ friendly errors */
function lev(a, b) { a = a.toLowerCase(); b = b.toLowerCase(); var d = []; for (var i = 0; i <= a.length; i++) { d[i] = [i]; } for (var j = 1; j <= b.length; j++) d[0][j] = j; for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
function friendly(msg, tables) {
  var m, cols = [], names = (tables || []).map(function (t) { return t.name; });
  (tables || []).forEach(function (t) { t.cols.forEach(function (c) { cols.push({ col: c.name, table: t.name }); }); });
  if (msg === 'TIMEOUT') return 'This query was still running after 3 seconds, so it was stopped. Check that every JOIN has an ON clause and that a recursive query has a stopping condition.';
  if ((m = /no such column: ([\w.]+)/.exec(msg))) {
    var name = m[1].split('.').pop(), best = null, bd = 99;
    cols.forEach(function (c) { var d = lev(name, c.col); if (d < bd) { bd = d; best = c; } });
    var where = cols.filter(function (c) { return best && c.col === best.col; }).map(function (c) { return c.table; });
    return 'There is no column called <code>' + esc(m[1]) + '</code>.' + (best && bd <= 3 ? ' Did you mean <code>' + esc(best.col) + '</code>? It is in: ' + esc(where.join(', ')) + '.' : ' Open the Schema panel to see the column names.') + (m[1].indexOf('.') > 0 ? ' Also check that the alias before the dot is defined in FROM or JOIN.' : '');
  }
  if ((m = /no such table: (\w+)/.exec(msg))) {
    var bt = null, btd = 99; names.forEach(function (n) { var d = lev(m[1], n); if (d < btd) { btd = d; bt = n; } });
    return 'There is no table called <code>' + esc(m[1]) + '</code> in this dataset.' + (bt && btd <= 3 ? ' Did you mean <code>' + esc(bt) + '</code>?' : ' The tables are: ' + esc(names.join(', ')) + '.');
  }
  if ((m = /ambiguous column name: ([\w.]+)/.exec(msg))) return 'More than one table has a column called <code>' + esc(m[1]) + '</code>. Say which one you mean by putting the table alias in front, for example <code>t.' + esc(m[1]) + '</code>.';
  if (/misuse of aggregate/.test(msg)) return 'You used COUNT, SUM, AVG, MIN or MAX somewhere that needs plain row values, usually in WHERE. Move that condition to HAVING, after GROUP BY.';
  if (/HAVING clause on a non-aggregate|GROUP BY clause is required/i.test(msg)) return 'HAVING filters groups, so it needs a GROUP BY before it. Add GROUP BY, or use WHERE for a plain row filter.';
  if ((m = /near "([^"]*)": syntax error/.exec(msg))) {
    var t = m[1];
    if (/^(FROM|WHERE|GROUP|ORDER|LIMIT|HAVING)$/i.test(t)) return 'Something is wrong just before <code>' + esc(t) + '</code>. The usual cause is a comma after the last column in SELECT, or a missing value at the end of a condition.';
    if (t === ',') return 'There is an extra or misplaced comma. Commas go between columns, never before FROM or after the last item.';
    return 'SQL could not read the query near <code>' + esc(t) + '</code>. Check spelling, commas between columns, and that every quote and bracket is closed.';
  }
  if (/incomplete input|unrecognized token/.test(msg)) return 'The query stops too early or has an unclosed quote. Text values need a single quote at both ends, for example <code>\'Lagos\'</code>.';
  if ((m = /no such function: (\w+)/.exec(msg))) return 'GageQuery does not support the function <code>' + esc(m[1]) + '</code>. Check the spelling, or see the cheat sheet in How it works for the functions you can use.';
  if (/UNIQUE constraint failed|PRIMARY KEY/.test(msg)) return 'A row with that key already exists. Each primary key value can appear only once. Use Reset data to start again.';
  if (/CHECK constraint failed/.test(msg)) return 'The database rejected the row because it breaks a CHECK rule. That is the constraint doing its job.';
  return 'The database reported a problem with this query.';
}

/* ================================================================ result comparison */
function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  var s = String(v).trim();
  if (s !== '' && /^-?\d+(\.\d+)?$/.test(s) && s.length < 16) return parseFloat(s);
  return s.toLowerCase();
}
function cellEq(a, b) { a = norm(a); b = norm(b); if (a === null || b === null) return a === b; if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 0.005 + Math.abs(b) * 1e-9; return String(a) === String(b); }
function key(row) { return row.map(function (v) { v = norm(v); return v === null ? '\u0000' : typeof v === 'number' ? (Math.round(v * 100) / 100).toFixed(2) : v; }).join('\u0001'); }
function rowEq(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (!cellEq(a[i], b[i])) return false; return true; }
function show(row) { return row.map(function (v) { return v === null ? 'NULL' : String(v); }).join(' | '); }
function compare(mine, exp, orderMatters) {
  if (!mine.rows) return { ok: false, kind: 'no-rows', msg: 'Your code ran but did not return a table. Finish with a SELECT.' };
  if (mine.cols.length !== exp.cols.length) return { ok: false, kind: 'columns', msg: 'The answer has ' + exp.cols.length + ' column' + (exp.cols.length > 1 ? 's' : '') + ' (' + exp.cols.join(', ') + '); yours has ' + mine.cols.length + ' (' + mine.cols.join(', ') + ').' };
  var em = {}, mm = {}, missing = [], extra = [];
  exp.rows.forEach(function (r) { var k = key(r); em[k] = (em[k] || 0) + 1; });
  mine.rows.forEach(function (r) { var k = key(r); mm[k] = (mm[k] || 0) + 1; });
  exp.rows.forEach(function (r) { var k = key(r); if ((mm[k] || 0) < em[k]) { missing.push(r); mm[k] = (mm[k] || 0) + 1; } });
  mm = {}; mine.rows.forEach(function (r) { var k = key(r); mm[k] = (mm[k] || 0) + 1; });
  var em2 = {}; exp.rows.forEach(function (r) { var k = key(r); em2[k] = (em2[k] || 0) + 1; });
  mine.rows.forEach(function (r) { var k = key(r); if ((em2[k] || 0) < 1) extra.push(r); else em2[k]--; });
  if (!missing.length && !extra.length) {
    if (orderMatters) for (var i = 0; i < exp.rows.length; i++) if (!rowEq(mine.rows[i], exp.rows[i])) return { ok: false, kind: 'order', msg: 'You have exactly the right rows, but in a different order. Re-read the sort the task asks for.' };
    var names = mine.cols.join('|').toLowerCase() === exp.cols.join('|').toLowerCase();
    return { ok: true, namesDiffer: !names };
  }
  var dupes = extra.length && extra.every(function (r) { return em[key(r)]; });
  return { ok: false, kind: dupes ? 'duplicates' : missing.length && !extra.length ? 'missing' : extra.length && !missing.length ? 'extra' : 'values', missing: missing, extra: extra };
}
function mistakeTips(learner, solution, cmp) {
  var tips = [], L = learner.replace(/--[^\n]*/g, '');
  if (/NOT\s+IN\s*\(\s*SELECT/i.test(L) && cmp && (cmp.kind === 'missing' || cmp.kind === 'values')) tips.push('If the list inside <code>NOT IN (SELECT ...)</code> contains even one NULL, NOT IN returns no rows at all. Use <code>NOT EXISTS</code>, or a LEFT JOIN with <code>IS NULL</code>.');
  if (/(=|<>|!=)\s*NULL\b/i.test(L)) tips.push('<code>= NULL</code> never matches. Use <code>IS NULL</code> or <code>IS NOT NULL</code>.');
  if (/\|\|/.test(L)) tips.push('In MySQL <code>||</code> means OR. Join text with <code>CONCAT(a, \' \', b)</code>.');
  if (cmp && cmp.missing && cmp.missing.length && (!cmp.extra || cmp.extra.length < cmp.missing.length) && /LEFT\s+JOIN/i.test(solution) && !/LEFT\s+JOIN/i.test(L) && /JOIN/i.test(L)) tips.push('Rows are missing because an INNER JOIN drops rows that have no partner. Try a LEFT JOIN, starting from the table whose rows must all appear.');
  if (cmp && (cmp.kind === 'values' || cmp.kind === 'extra') && /LEFT\s+JOIN/i.test(L) && /COUNT\(\s*\*\s*\)/i.test(L)) tips.push('With a LEFT JOIN, <code>COUNT(*)</code> counts the empty joined row as 1. Count a column from the joined table instead.');
  if (cmp && cmp.kind === 'duplicates') tips.push('Some rows appear more than once. A join can repeat a row once per match (fan-out). Check your join, or use DISTINCT or GROUP BY.');
  if (cmp && cmp.kind === 'values' && /\b\d+\s*\/\s*\d+\b/.test(L.replace(/\d+\.\d+/g, ''))) tips.push('Dividing two whole numbers can drop the decimals in some databases. Multiply by <code>100.0</code> or <code>1.0</code> first.');
  if (cmp && (cmp.kind === 'values' || cmp.kind === 'extra' || cmp.kind === 'missing') && /ROUND\(/i.test(solution) && !/ROUND\(/i.test(L)) tips.push('The task asks for rounding. Wrap the value in <code>ROUND(value, decimals)</code>.');
  return tips;
}

/* ================================================================ editor */
var CM_HINT_TABLES = {};
function makeEditor(value, opts) {
  opts = opts || {};
  var host = h('div', { class: 'ed' });
  var cm = CodeMirror(host, {
    value: value, mode: 'text/x-mysql', theme: 'qc', lineNumbers: true, matchBrackets: true, indentUnit: 4, tabSize: 4,
    viewportMargin: Infinity, lineWrapping: false, readOnly: !!opts.readOnly, screenReaderLabel: opts.label || 'SQL editor',
    extraKeys: {
      'Ctrl-Enter': function () { opts.onRun && opts.onRun(); }, 'Cmd-Enter': function () { opts.onRun && opts.onRun(); },
      'Shift-Ctrl-Enter': function () { opts.onCheck && opts.onCheck(); }, 'Shift-Cmd-Enter': function () { opts.onCheck && opts.onCheck(); },
      'Shift-Alt-F': function () { cm.setValue(formatSql(cm.getValue())); }, 'Ctrl-Space': 'autocomplete',
      'Tab': function (c) { if (c.somethingSelected()) c.indentSelection('add'); else c.replaceSelection('    '); },
      'Esc': function () { cm.getInputField().blur(); }
    },
    hintOptions: { tables: CM_HINT_TABLES, completeSingle: false }
  });
  cm.on('inputRead', function (c, ch) { if (/[A-Za-z_.]/.test(ch.text[0]) && !c.state.completionActive) c.showHint({ completeSingle: false }); });
  if (opts.onChange) cm.on('change', function () { opts.onChange(cm.getValue()); });
  setTimeout(function () { cm.refresh(); }, 0);
  return { el: host, cm: cm, get: function () { var s = cm.getSelection(); return s && s.trim() ? s : cm.getValue(); }, all: function () { return cm.getValue(); }, set: function (v) { cm.setValue(v); }, focus: function () { cm.focus(); } };
}
function updateHintTables(ds) { getSchema(ds).then(function (t) { for (var k in CM_HINT_TABLES) delete CM_HINT_TABLES[k]; t.forEach(function (x) { CM_HINT_TABLES[x.name] = x.cols.map(function (c) { return c.name; }); }); }).catch(function () {}); }

/* ================================================================ results */
function renderResult(into, res, extra) {
  into.innerHTML = '';
  if (res.error) {
    return getSchema(curDs()).catch(function () { return []; }).then(function (tables) {
      var box = h('div', { class: 'err', role: 'alert' });
      box.appendChild(h('p', { class: 'err-main', html: friendly(res.error, tables) }));
      if (res.error !== 'TIMEOUT') box.appendChild(h('p', { class: 'err-raw', text: 'Engine message' + (res.count > 1 ? ' (statement ' + res.stmt + ' of ' + res.count + ')' : '') + ': ' + res.error }));
      into.appendChild(box);
    });
  }
  var meta = h('div', { class: 'meta' });
  if (res.rows) {
    meta.appendChild(h('span', { class: 'pill', text: res.total + ' row' + (res.total === 1 ? '' : 's') }));
    meta.appendChild(h('span', { text: res.ms + ' ms' }));
    if (res.total > res.rows.length) meta.appendChild(h('span', { text: 'Showing the first ' + res.rows.length }));
    res.notes.forEach(function (n) { meta.appendChild(h('span', { class: 'note-inline', text: n })); });
    var csv = h('button', { class: 'btn ghost sm', type: 'button', text: 'Copy as CSV', onclick: function () { copyText(toCsv(res), csv); } });
    meta.appendChild(csv);
    into.appendChild(meta);
    into.appendChild(table(res.cols, res.rows));
  } else {
    meta.appendChild(h('span', { class: 'pill', text: 'Done' }));
    meta.appendChild(h('span', { text: res.ran + ' statement' + (res.ran === 1 ? '' : 's') + ' ran' + (res.changed ? ', ' + res.changed + ' row' + (res.changed === 1 ? '' : 's') + ' changed' : '') + ' \u00b7 ' + res.ms + ' ms' }));
    res.notes.forEach(function (n) { meta.appendChild(h('span', { class: 'note-inline', text: n })); });
    into.appendChild(meta);
  }
  return Promise.resolve();
}
function table(cols, rows, mark) {
  var t = h('table', { class: 'grid' }), tr = h('tr');
  cols.forEach(function (c) { tr.appendChild(h('th', { scope: 'col', text: c })); });
  t.appendChild(h('thead', null, tr));
  var tb = h('tbody');
  rows.forEach(function (r, i) {
    var row = h('tr', mark && mark[i] ? { class: mark[i] } : null);
    r.forEach(function (v) { var td = h('td'); if (v === null) { td.className = 'nul'; td.textContent = 'NULL'; } else if (typeof v === 'number') { td.className = 'num'; td.textContent = String(v); } else td.textContent = String(v); row.appendChild(td); });
    tb.appendChild(row);
  });
  t.appendChild(tb);
  return h('div', { class: 'grid-wrap', tabindex: '0', role: 'region', 'aria-label': 'Query result' }, t);
}
function toCsv(res) { function q(v) { if (v === null) return ''; v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; } return [res.cols.map(q).join(',')].concat(res.rows.map(function (r) { return r.map(q).join(','); })).join('\n'); }
function copyText(text, btn) {
  var done = function () { var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = o; }, 1300); };
  try { navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); }); } catch (e) { fallbackCopy(text); done(); }
}
function fallbackCopy(text) { var ta = h('textarea', { class: 'sr-only' }); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }

/* ================================================================ toast */
function toast(msg, action) {
  var host = $('#toasts'); var t = h('div', { class: 'toast', role: 'status' }, h('span', { text: msg }));
  var timer;
  if (action) t.appendChild(h('button', { class: 'btn sm', type: 'button', text: action.label, onclick: function () { clearTimeout(timer); t.remove(); action.fn(); } }));
  host.appendChild(t);
  timer = setTimeout(function () { t.remove(); }, action ? 10000 : 3500);
}

/* ================================================================ join pictures */
function svgEl(w, hgt, inner, label) { return '<svg viewBox="0 0 ' + w + ' ' + hgt + '" role="img" aria-label="' + esc(label) + '" class="viz-svg">' + inner + '</svg>'; }
function tx(x, y, s, o) { o = o || {}; return '<text x="' + x + '" y="' + y + '" class="' + (o.cls || 'vt') + '" text-anchor="' + (o.anchor || 'start') + '">' + esc(s) + '</text>'; }
function miniTable(x, y, title, cols, rows, widths, opts) {
  opts = opts || {}; var rh = 26, w = widths.reduce(function (a, b) { return a + b; }, 0), out = tx(x, y - 8, title, { cls: 'vt-title' });
  out += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + rh + '" rx="4" class="v-head"/>';
  var cx = x; cols.forEach(function (c, i) { out += tx(cx + 8, y + 17, c, { cls: 'vt-head' }); cx += widths[i]; });
  var centers = [];
  rows.forEach(function (r, i) {
    var ry = y + rh * (i + 1), hl = opts.hl && opts.hl[i];
    out += '<rect x="' + x + '" y="' + ry + '" width="' + w + '" height="' + rh + '" class="' + (hl ? 'v-row-hl' : i % 2 ? 'v-row-alt' : 'v-row') + '"/>';
    cx = x; r.forEach(function (v, j) { var nul = v === null; out += tx(cx + 8, ry + 17, nul ? 'NULL' : String(v).slice(0, 18), { cls: nul ? 'vt-null' : 'vt-mono' }); cx += widths[j]; });
    centers.push(ry + rh / 2);
  });
  return { svg: out, centers: centers, w: w, h: rh * (rows.length + 1) };
}
function renderViz(kind, ds, host) {
  var meta = DSETS[ds], s = meta.viz;
  host.innerHTML = '<p class="muted">Drawing the picture from your dataset\u2026</p>';
  Engine.req(ds, { cmd: 'viz', spec: s }, 5000).then(function (d) {
    if (d.error) { host.innerHTML = ''; return; }
    var parents = d.matched.concat(d.unmatched), out = '', label;
    if (kind === 'join-matching') {
      var hlp = {}; parents.forEach(function (p, i) { if (i >= d.matched.length) hlp[i] = true; });
      var A = miniTable(20, 56, s.parent, [s.pk, s.label], parents, [120, 130], { hl: hlp });
      var B = miniTable(470, 56, s.child + ' (sample)', [s.ck, s.fk], d.children, [120, 130]);
      out += A.svg + B.svg + tx(380, 26, 'ON ' + s.child + '.' + s.fk + ' = ' + s.parent + '.' + s.pk, { cls: 'vt-accent', anchor: 'middle' });
      d.children.forEach(function (c, j) { var i = -1; parents.forEach(function (p, k) { if (p[0] === c[1] && i < 0) i = k; }); if (i >= 0) out += '<line x1="' + (20 + A.w + 4) + '" y1="' + A.centers[i] + '" x2="' + (466) + '" y2="' + B.centers[j] + '" class="v-link" marker-end="url(#qc-arrow)"/>'; });
      parents.forEach(function (p, i) { if (i >= d.matched.length) out += '<line x1="' + (20 + A.w + 4) + '" y1="' + A.centers[i] + '" x2="' + (20 + A.w + 60) + '" y2="' + A.centers[i] + '" class="v-nolink"/>' + tx(20 + A.w + 66, A.centers[i] + 4, 'no match', { cls: 'vt-warn' }); });
      var hgt = 56 + Math.max(A.h, B.h) + 24;
      label = 'Rows from ' + s.parent + ' matched to ' + s.child;
      host.innerHTML = '<figure class="viz"><figcaption><b>Picture it.</b> A join draws a line between rows whose key values are equal. The highlighted ' + esc(s.parentNoun) + ' have no ' + esc(s.childNoun) + ', so they get no line.</figcaption>' + svgEl(760, hgt, defs() + out, label) + '</figure>';
    } else if (kind === 'join-results') {
      var lab = {}; parents.forEach(function (p) { lab[p[0]] = p[1]; });
      var inner = d.children.map(function (c) { return [lab[c[1]], c[0]]; });
      var left = inner.concat(d.unmatched.map(function (u) { return [u[1], null]; }));
      var hl = {}; for (var i = inner.length; i < left.length; i++) hl[i] = true;
      var A2 = miniTable(20, 40, 'INNER JOIN: ' + inner.length + ' rows', [s.label, s.ck], inner, [150, 140]);
      var B2 = miniTable(420, 40, 'LEFT JOIN: ' + left.length + ' rows', [s.label, s.ck], left, [150, 140], { hl: hl });
      out = A2.svg + B2.svg;
      host.innerHTML = '<figure class="viz"><figcaption><b>Picture it.</b> Same sample rows, two joins. INNER JOIN drops the ' + esc(s.parentNoun) + ' with no ' + esc(s.childNoun) + '; LEFT JOIN keeps them and fills the missing columns with NULL.</figcaption>' + svgEl(760, 40 + Math.max(A2.h, B2.h) + 20, out, 'Inner join versus left join results') + '</figure>';
    } else if (kind === 'join-venn') {
      var panels = [['INNER JOIN', 'inner', 'matches only', d.inner], ['LEFT JOIN', 'left', 'all ' + s.parentNoun + ' + matches', d.left], ['RIGHT JOIN', 'right', 'all ' + s.childNoun + ' + matches', d.right], ['FULL OUTER', 'full', 'everything (UNION in MySQL)', d.full]];
      panels.forEach(function (p, i) {
        var x0 = 95 + 190 * i, ax = x0 - 28, bx = x0 + 28, cy = 92, r = 46, id = 'qcv' + i;
        out += '<defs><clipPath id="' + id + '"><circle cx="' + ax + '" cy="' + cy + '" r="' + r + '"/></clipPath></defs>';
        if (p[1] === 'left' || p[1] === 'full') out += '<circle cx="' + ax + '" cy="' + cy + '" r="' + r + '" class="v-fill"/>';
        if (p[1] === 'right' || p[1] === 'full') out += '<circle cx="' + bx + '" cy="' + cy + '" r="' + r + '" class="v-fill"/>';
        if (p[1] === 'inner') out += '<circle cx="' + bx + '" cy="' + cy + '" r="' + r + '" class="v-fill-strong" clip-path="url(#' + id + ')"/>';
        out += '<circle cx="' + ax + '" cy="' + cy + '" r="' + r + '" class="v-ring"/><circle cx="' + bx + '" cy="' + cy + '" r="' + r + '" class="v-ring"/>';
        out += tx(x0, 20, p[0], { cls: 'vt-title', anchor: 'middle' }) + tx(ax - 10, 40, s.parent, { cls: 'vt-small', anchor: 'middle' }) + tx(bx + 10, 40, s.child, { cls: 'vt-small', anchor: 'middle' });
        out += tx(x0, 162, p[2], { cls: 'vt', anchor: 'middle' }) + tx(x0, 182, p[3] + ' rows', { cls: 'vt-accent', anchor: 'middle' });
      });
      host.innerHTML = '<figure class="viz"><figcaption><b>Picture it.</b> Left circle: ' + esc(s.parent) + '. Right circle: ' + esc(s.child) + '. The overlap is rows that match on the key; the shading is what each join returns. Counts are real, from ' + esc(meta.name) + '.</figcaption>' + svgEl(760, 196, out, 'Venn diagrams of the four join types') + '</figure>';
    }
  });
}
function defs() { return '<defs><marker id="qc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="v-arrow"/></marker></defs>'; }

/* ================================================================ layout pieces */
var PHASES = {1: 'Phase 1 \u00b7 Fundamentals', 2: 'Phase 2 \u00b7 Intermediate SQL and analytics', 3: 'Phase 3 \u00b7 Advanced SQL and optimisation'};
var SHORT = {1: 'Getting started', 2: 'Cleaning up results', 3: 'Summarising data', 4: 'Joins', 5: 'Subqueries', 6: 'CTEs and set operations', 7: 'Ranking windows', 8: 'Time-series windows', 9: 'Pivots, dates, strings', 10: 'Views and procedures', 11: 'Indexes and tuning', 12: 'Transactions'};
var rail, main, routeId = null;
function badge(level) { return h('span', { class: 'badge ' + level.toLowerCase(), text: level }); }
function stateChip(id) {
  var s = exState(id), map = { 'new': ['Not started', 'st-new'], attempted: ['Attempted', 'st-try'], helped: ['Solved with help', 'st-help'], solved: ['Solved', 'st-ok'] };
  return h('span', { class: 'state ' + map[s][1] }, h('i', { 'aria-hidden': 'true' }), map[s][0]);
}
function paintMeter() {
  var done = ALL_EX.filter(function (e) { var s = exState(e.id); return s === 'solved' || s === 'helped'; }).length;
  var bar = $('#meter-bar'), txt = $('#meter-text');
  if (bar) bar.style.width = (100 * done / ALL_EX.length) + '%';
  if (txt) txt.textContent = done + '/' + ALL_EX.length + ' solved \u00b7 ' + points() + ' pts';
}
function paintRail() {
  if (!rail) return;
  rail.innerHTML = '';
  function link(id, label, right, cls) { var a = h('a', { href: '#' + id, 'data-route': id, class: cls || '' }, label); if (right) a.appendChild(right); return a; }
  rail.appendChild(h('div', { class: 'rail-sec', text: 'Start' }));
  rail.appendChild(link('home', 'Home'));
  rail.appendChild(link('learn', 'Course map'));
  rail.appendChild(link('datasets', 'Datasets'));
  var lastPhase = 0;
  MODS.forEach(function (m) {
    if (m.phase !== lastPhase) { rail.appendChild(h('div', { class: 'rail-sec', text: PHASES[m.phase] })); lastPhase = m.phase; }
    var n = modDone(m);
    rail.appendChild(link(m.id, h('span', { class: 'rl' }, h('b', { text: m.number }), h('span', { text: SHORT[m.number] || m.title.split(':')[0] })), h('span', { class: 'cnt' + (n === m.exercises.length ? ' full' : ''), text: n + '/' + m.exercises.length })));
  });
  rail.appendChild(h('span', { class: 'rail-soon' }, h('b', { text: '\u2605' }), h('span', { text: 'Capstone project' }), h('em', { text: 'Next' })));
  rail.appendChild(h('div', { class: 'rail-sec', text: 'Practice' }));
  rail.appendChild(link('playground', 'Playground'));
  rail.appendChild(link('progress', 'My progress'));
  rail.appendChild(link('about', 'How it works'));
  markRail();
}
function markRail() {
  if (!rail) return;
  var r = currentRoute(), base = r.split('-')[0];
  Array.prototype.forEach.call(rail.querySelectorAll('a'), function (a) { var id = a.getAttribute('data-route'); if (id === r || (id === base && /^m\d\d$/.test(base))) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}

/* ================================================================ dataset switcher */
function dsLabel(ds) { return DSETS[ds].sector + ' \u00b7 ' + DSETS[ds].name; }
function setDs(ds, silent) {
  if (!DSETS[ds]) return;
  S.ds = ds; save();
  var sel = $('#ds-select'); if (sel) sel.value = ds;
  updateHintTables(ds);
  Engine.open(ds);
  if (!silent) { toast('Dataset: ' + dsLabel(ds)); route(true); }
}

/* ================================================================ views */
function page(cls) { return h('div', { class: 'page ' + (cls || '') }); }

function viewHome() {
  var p = page('home');
  var ds = curDs();
  p.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'eyebrow', text: '12-module SQL course \u00b7 MySQL syntax' }),
    h('h1', { text: 'Learn SQL on data you actually care about.' }),
    h('p', { class: 'lede', text: 'Pick a sector, then read a short concept, run real examples and solve exercises against a real database in your browser. Every answer is checked by running it.' })));
  var next = ALL_EX.filter(function (e) { var s = exState(e.id); return s !== 'solved' && s !== 'helped'; })[0];
  var started = ALL_EX.some(function (e) { return exState(e.id) !== 'new'; });
  p.appendChild(h('div', { class: 'cta-row' },
    next ? h('a', { class: 'btn primary lg', href: '#' + (started ? next.id : 'm01'), text: started ? 'Continue: Module ' + next.mod.number + ', exercise ' + next.n : 'Start Module 1' }) : h('a', { class: 'btn primary lg', href: '#progress', text: 'See your progress' }),
    h('a', { class: 'btn lg', href: '#playground', text: 'Open the playground' })));
  p.appendChild(h('h2', { text: '1. Choose your dataset' }));
  p.appendChild(h('p', { class: 'muted', text: 'Every example and exercise exists on every dataset. You can switch at any time from the top bar.' }));
  var grid = h('div', { class: 'ds-grid' });
  ORDER.forEach(function (id) {
    var d = DSETS[id], on = id === ds;
    grid.appendChild(h('button', { class: 'ds-card' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { setDs(id); } },
      h('span', { class: 'ds-sector', text: d.sector }), h('b', { text: d.name }), h('span', { class: 'ds-story', text: d.story.split('. ')[0] + '.' }),
      h('span', { class: 'ds-meta', text: Object.keys(d.rowCounts).length + ' tables \u00b7 ' + Object.values(d.rowCounts).reduce(function (a, b) { return a + b; }, 0).toLocaleString() + ' rows' })));
  });
  p.appendChild(grid);
  p.appendChild(h('h2', { text: '2. Run your first query' }));
  var first = { sales: 'SELECT * FROM customers LIMIT 5;', sport: 'SELECT * FROM players LIMIT 5;', fashion: 'SELECT * FROM products LIMIT 5;', politics: 'SELECT * FROM parties;', finance: 'SELECT * FROM loans LIMIT 5;', healthcare: 'SELECT * FROM doctors LIMIT 5;' }[ds];
  p.appendChild(runCell({ sql: first, explanation: 'Press Run (or Ctrl/\u2318 + Enter). SELECT * means "every column", FROM names the table, and LIMIT 5 keeps the first five rows.' }, ds, { autorun: true }));
  return p;
}

function viewMap() {
  var p = page();
  p.appendChild(h('div', { class: 'eyebrow', text: 'Course map' }));
  p.appendChild(h('h1', { text: 'Twelve modules, three phases' }));
  p.appendChild(h('p', { class: 'lede', text: 'Each module has short concepts, runnable examples and five exercises: two Easy, two Medium, one Hard. A module is complete when its Easy and Medium exercises are solved.' }));
  var phases = [1, 2, 3].map(function (n) { return [PHASES[n], MODS.filter(function (m) { return m.phase === n; }).map(function (m) { return { m: m }; })]; });
  phases[2][1].push({ soon: ['\u2605', 'Capstone: Quarterly Business Review'] });
  phases.forEach(function (ph) {
    p.appendChild(h('h2', { text: ph[0] }));
    var g = h('div', { class: 'mod-grid' });
    ph[1].forEach(function (it) {
      if (it.m) {
        var m = it.m, n = modDone(m);
        g.appendChild(h('a', { class: 'mod-card' + (modComplete(m) ? ' done' : ''), href: '#' + m.id },
          h('span', { class: 'mod-num', text: 'Module ' + m.number }), h('b', { text: m.title }),
          h('span', { class: 'muted', text: m.examples.length + ' examples \u00b7 ' + m.exercises.length + ' exercises \u00b7 ' + m.concepts.length + ' concepts' }),
          h('span', { class: 'bar' }, h('i', { style: 'width:' + (100 * n / m.exercises.length) + '%' })),
          h('span', { class: 'muted sm', text: n + ' of ' + m.exercises.length + ' solved' })));
      } else {
        g.appendChild(h('div', { class: 'mod-card soon' }, h('span', { class: 'mod-num', text: 'Capstone' }), h('b', { text: it.soon[1] }), h('span', { class: 'muted', text: 'Six graded tasks on your dataset. Coming in the next release.' })));
      }
    });
    p.appendChild(g);
  });
  return p;
}

var tabMemory = {};
function viewModule(m, tab) {
  var p = page();
  var ds = curDs();
  p.appendChild(h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#learn', text: 'Course map' }), ' \u203a ', h('span', { text: 'Module ' + m.number })));
  p.appendChild(h('div', { class: 'eyebrow', text: 'Phase ' + m.phase + ' \u00b7 Module ' + m.number + ' \u00b7 about ' + Math.round(m.minutes / 60) + ' hours' }));
  p.appendChild(h('h1', { text: m.title }));
  var ul = h('ul', { class: 'objectives' }); m.objectives.forEach(function (o) { ul.appendChild(h('li', { text: o })); });
  p.appendChild(ul);
  tab = tab || tabMemory[m.id] || 'concepts';
  tabMemory[m.id] = tab;
  var tabs = h('div', { class: 'tabs', role: 'tablist' });
  [['concepts', 'Concepts', m.concepts.length], ['examples', 'Examples', m.examples.length], ['exercises', 'Exercises', m.exercises.length]].forEach(function (t) {
    tabs.appendChild(h('a', { class: 'tab', role: 'tab', href: '#' + m.id + '-' + t[0], 'aria-selected': t[0] === tab ? 'true' : 'false' }, t[1], h('span', { class: 'ct', text: t[2] })));
  });
  p.appendChild(tabs);
  var body = h('div', { class: 'stack' });
  if (tab === 'concepts') {
    m.concepts.forEach(function (c) { body.appendChild(h('article', { class: 'concept' }, h('h3', { html: md(c.term) }), h('p', { class: 'what', html: md(c.what) }), c.whenWhy ? h('p', { class: 'why', html: '<b>When and why:</b> ' + md(c.whenWhy) }) : null, c.syntax ? h('pre', { class: 'syntax', text: c.syntax }) : null)); });
    body.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#' + m.id + '-examples', text: 'Next: run the examples' })));
  } else if (tab === 'examples') {
    body.appendChild(h('p', { class: 'muted', html: 'Examples use the <b>' + esc(DSETS[ds].name) + '</b> dataset. Edit any query and run it; nothing you do here can break the data for the exercises.' }));
    m.examples.forEach(function (e, i) {
      var holder = h('div');
      if (e.visual) { var vz = h('div', { class: 'viz-host' }); holder.appendChild(vz); renderViz(e.visual, ds, vz); }
      holder.appendChild(runCell({ title: (i + 1) + '. ' + e.title, level: e.level, sql: e.v[ds], explanation: e.explanation, tryIt: e.tryIt, ref: e.ref, pre: e.pre ? (typeof e.pre === 'string' ? e.pre : e.pre[ds]) : null }, ds, { autorun: i === 0 && !e.ref && /^\s*(--[^\n]*\n\s*)*(SELECT|WITH|EXPLAIN)\b/i.test(e.v[ds]) }));
      body.appendChild(holder);
    });
    body.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#' + m.id + '-exercises', text: 'Next: try the exercises' })));
  } else {
    m.exercises.forEach(function (e) {
      var v = e.v[ds];
      body.appendChild(h('a', { class: 'ex-card', href: '#' + e.id },
        h('div', { class: 'ex-top' }, h('b', { text: 'Exercise ' + e.n }), badge(e.level), h('span', { class: 'sp' }), stateChip(e.id)),
        h('p', { class: 'muted', text: v.story }), h('p', { html: md(v.task) })));
    });
  }
  p.appendChild(body);
  return p;
}

function runCell(item, ds, opts) {
  opts = opts || {};
  var cell = h('section', { class: 'cell' });
  if (item.title) cell.appendChild(h('div', { class: 'cell-head' }, h('h3', { text: item.title }), item.level ? badge(item.level) : null));
  if (item.explanation) cell.appendChild(h('p', { class: 'expl', html: md(item.explanation) }));
  var out = h('div', { class: 'res', 'aria-live': 'polite' });
  if (item.ref) {
    var rv = makeEditor(item.sql, { readOnly: true, label: 'MySQL reference code' });
    cell.appendChild(h('p', { class: 'ref-note', html: '<b>MySQL server only.</b> Stored procedures, functions, triggers and isolation settings run on a real MySQL server, not in this browser engine, so this card is for reading. Copy it into MySQL Workbench or the mysql client to try it.' }));
    cell.appendChild(rv.el);
    var cp = h('button', { class: 'btn ghost', type: 'button', text: 'Copy code', onclick: function () { copyText(item.sql, cp); } });
    cell.appendChild(h('div', { class: 'actions' }, cp));
    return cell;
  }
  var ed = makeEditor(item.sql, { onRun: run, label: 'Example SQL editor' });
  function run() { out.innerHTML = '<p class="muted">Running\u2026</p>'; Engine.req(ds, { cmd: 'run', sql: ed.get(), pre: item.pre }).then(function (r) { if (r.timeout) r.error = 'TIMEOUT'; renderResult(out, r); }); }
  cell.appendChild(ed.el);
  cell.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: run, text: 'Run' }), h('button', { class: 'btn ghost', type: 'button', onclick: function () { ed.set(item.sql); out.innerHTML = ''; }, text: 'Reset code' }), h('span', { class: 'kbd', text: 'Ctrl/\u2318 + Enter runs' })));
  cell.appendChild(out);
  if (item.tryIt) cell.appendChild(h('p', { class: 'try', html: '<b>Try it:</b> ' + md(item.tryIt) }));
  if (opts.autorun) setTimeout(run, 30);
  return cell;
}

/* ---------------------------------------------------------------- exercise workspace */
function viewExercise(ex) {
  var m = ex.mod, ds = curDs(), v = ex.v[ds];
  var p = page('wide');
  p.appendChild(h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#learn', text: 'Course map' }), ' \u203a ', h('a', { href: '#' + m.id + '-exercises', text: 'Module ' + m.number }), ' \u203a ', h('span', { text: 'Exercise ' + ex.n })));
  var ws = h('div', { class: 'workspace' });
  /* task panel */
  var task = h('section', { class: 'task', 'aria-label': 'Task' });
  task.appendChild(h('div', { class: 'ex-top' }, h('b', { text: 'Module ' + m.number + ' \u00b7 Exercise ' + ex.n }), badge(ex.level), h('span', { class: 'sp' }), stateChip(ex.id)));
  task.appendChild(h('p', { class: 'story', text: v.story }));
  task.appendChild(h('p', { class: 'task-text', html: md(v.task) }));
  var ret = h('div', { class: 'returns' });
  if (isScript(v)) {
    ret.appendChild(h('span', { class: 'lbl', text: 'How it is checked' }));
    ret.appendChild(h('p', { class: 'sm', text: 'Your SQL runs on a fresh copy of the data. Then this query runs, and its result must match what the model answer leaves behind:' }));
    ret.appendChild(h('pre', { class: 'skeleton verify', text: v.verify }));
  } else {
    ret.appendChild(h('span', { class: 'lbl', text: 'Return these columns' }));
    var chips = h('div', { class: 'col-chips' }); v.cols.forEach(function (c) { chips.appendChild(h('code', { text: c })); });
    ret.appendChild(chips);
    ret.appendChild(h('span', { class: 'lbl', text: ex.orderMatters ? 'Order matters: sort as the task says' : 'Any order is fine' }));
  }
  task.appendChild(ret);
  task.appendChild(h('p', { class: 'muted sm', text: 'Dataset: ' + dsLabel(ds) + ' \u00b7 concepts: ' + ex.concepts.join(', ') }));
  var hintsBox = h('div', { class: 'hints' });
  task.appendChild(hintsBox);
  var solBox = h('div');
  task.appendChild(solBox);
  var nav = h('div', { class: 'ex-nav' });
  var prev = m.exercises[ex.n - 2], next = m.exercises[ex.n];
  var nextMod = MODS[m.number];
  if (prev) nav.appendChild(h('a', { class: 'btn ghost', href: '#' + prev.id, text: '\u2190 Exercise ' + prev.n }));
  nav.appendChild(h('span', { class: 'sp' }));
  if (next) nav.appendChild(h('a', { class: 'btn', href: '#' + next.id, text: 'Exercise ' + next.n + ' \u2192' }));
  else if (nextMod) nav.appendChild(h('a', { class: 'btn', href: '#' + nextMod.id, text: 'Module ' + nextMod.number + ' \u2192' }));
  task.appendChild(nav);
  /* workspace panel */
  var work = h('section', { class: 'work', 'aria-label': 'Workspace' });
  var draftKey = ex.id;
  var draft = S.drafts[draftKey];
  var dsNote = null;
  if (draft && S.drafts[draftKey + '@ds'] && S.drafts[draftKey + '@ds'] !== ds) {
    dsNote = h('div', { class: 'ds-note' }, h('span', { html: 'Your code was written for <b>' + esc(DSETS[S.drafts[draftKey + '@ds']].name) + '</b>. The tables here are different.' }), h('button', { class: 'btn sm', type: 'button', text: 'Load this dataset\u2019s starter code', onclick: function () { ed.set(starter(ex, ds)); dsNote.remove(); } }));
  }
  var ed = makeEditor(draft != null ? draft : starter(ex, ds), {
    onRun: run, onCheck: check, label: 'Your SQL for exercise ' + ex.n,
    onChange: function (val) { S.drafts[draftKey] = val; S.drafts[draftKey + '@ds'] = ds; save(); }
  });
  var out = h('div', { class: 'res', 'aria-live': 'polite' });
  var fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  var schemaBox = h('div', { class: 'schema-drawer', hidden: true });
  var hintLevel = (S.hints[ex.id + '@' + ds] || 0);
  var hintBtn = h('button', { class: 'btn', type: 'button', onclick: nextHint });
  function paintHintBtn() { hintBtn.textContent = hintLevel >= 3 ? 'All hints shown' : 'Hint ' + (hintLevel + 1) + '/3'; hintBtn.disabled = hintLevel >= 3; }
  function hintText(n) { return n === 1 ? hint1(ex, ds) : n === 2 ? ex.hint2 : null; }
  function paintHints() {
    hintsBox.innerHTML = '';
    for (var i = 1; i <= hintLevel; i++) {
      var b = h('div', { class: 'hint' }, h('span', { class: 'lbl', text: 'Hint ' + i }));
      if (i < 3) b.appendChild(h('p', { html: md(hintText(i)) }));
      else b.appendChild(h('pre', { class: 'skeleton', text: skeleton(v.sql) }));
      hintsBox.appendChild(b);
    }
    paintHintBtn();
  }
  function nextHint() { if (hintLevel < 3) { hintLevel++; S.hints[ex.id + '@' + ds] = hintLevel; save(); paintHints(); } }
  var armed = false, solBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Show solution', onclick: function () {
    if (!armed) { armed = true; solBtn.textContent = 'Click again to reveal'; setTimeout(function () { if (armed && !solShown) { armed = false; solBtn.textContent = 'Show solution'; } }, 4000); return; }
    revealSolution();
  } });
  var solShown = false;
  function revealSolution() {
    solShown = true; S.helped[ex.id] = true; save();
    if (exState(ex.id) !== 'solved') setState(ex.id, 'helped');
    solBox.innerHTML = '';
    var sv = makeEditor(v.sql, { readOnly: true, label: 'Model solution' });
    solBox.appendChild(h('div', { class: 'solution' }, h('span', { class: 'lbl', text: 'Model solution' }), sv.el,
      h('p', { html: md(ex.explain) }),
      h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'button', text: 'Copy into editor', onclick: function () { ed.set(v.sql); } }))));
    solBtn.textContent = 'Solution shown'; solBtn.disabled = true;
    paintState();
  }
  function paintState() { var c = task.querySelector('.state'); if (c) c.replaceWith(stateChip(ex.id)); }
  function run() {
    out.innerHTML = '<p class="muted">Running\u2026</p>';
    Engine.req(ds, { cmd: 'run', sql: ed.get(), pre: v.pre }).then(function (r) { if (r.timeout) r.error = 'TIMEOUT'; renderResult(out, r); });
  }
  function check() {
    fb.innerHTML = '<p class="muted">Checking on fresh copies of the data\u2026</p>';
    var learner = ed.all();
    var bare = learner.replace(/--[^\n]*/g, '');
    var rule = null;
    if (v.forbid && new RegExp(v.forbid[0], 'i').test(bare)) rule = v.forbid[1];
    (v.require || []).forEach(function (q) { if (!rule && !new RegExp(q[0], 'i').test(bare)) rule = q[1]; });
    Engine.req(ds, { cmd: 'check', learner: learner, solution: v.sql, pre: v.pre, verify: v.verify }, 6000).then(function (r) {
      if (r.timeout || r.error) { fb.innerHTML = ''; renderResult(out, { error: r.timeout ? 'TIMEOUT' : r.error }); return; }
      if (exState(ex.id) === 'new') setState(ex.id, 'attempted');
      if (r.mine.error) { fb.innerHTML = ''; renderResult(out, r.mine); paintState(); return; }
      renderResult(out, r.mine);
      var cmp = compare(r.mine, r.expected, ex.orderMatters);
      if (cmp.ok && rule) cmp = { ok: false, kind: 'rule', msg: rule };
      fb.innerHTML = '';
      if (cmp.ok) {
        var st = S.helped[ex.id] ? 'helped' : 'solved';
        setState(ex.id, st);
        var box = h('div', { class: 'fb ok', role: 'status' }, h('p', { class: 'fb-title', text: v.verify ? 'Correct. The data after your SQL matches the model answer.' : 'Correct. Your ' + r.mine.total + (r.mine.total === 1 ? ' row matches' : ' rows match') + ' the answer exactly.' }));
        if (cmp.namesDiffer && !v.verify) box.appendChild(h('p', { text: 'Your column names differ from the suggested ones (' + v.cols.join(', ') + '). The values are right; matching names makes reports easier to share.' }));
        box.appendChild(h('p', { html: md(ex.explain) }));
        if (st === 'helped') box.appendChild(h('p', { class: 'muted sm', text: 'Marked as solved with help because the solution was shown. Points are halved.' }));
        var nx = next || (nextMod && nextMod.exercises[0]);
        if (nx) box.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#' + nx.id, text: 'Next exercise \u2192' })));
        fb.appendChild(box);
      } else {
        var bx = h('div', { class: 'fb no', role: 'status' });
        var title = { 'no-rows': cmp.msg, columns: cmp.msg, order: cmp.msg, rule: 'The result is right, but the task has a rule: ' + cmp.msg,
          missing: 'Close. You have ' + r.mine.total + ' rows; the answer has ' + r.expected.total + '. Some rows are missing.',
          extra: 'You have ' + r.mine.total + ' rows; the answer has ' + r.expected.total + '. Some rows should not be there.',
          duplicates: 'You have ' + r.mine.total + ' rows; the answer has ' + r.expected.total + '. Some rows appear more than once.',
          values: r.mine.total !== r.expected.total ? 'You have ' + r.mine.total + ' rows; the answer has ' + r.expected.total + ', and some values differ.' : 'Same number of rows as the answer, but some values differ.' }[cmp.kind];
        if (v.verify && cmp.kind !== 'rule' && cmp.kind !== 'columns' && cmp.kind !== 'no-rows') title = v.verifyMsg || 'After your SQL ran, the check query did not give the expected result.';
        bx.appendChild(h('p', { class: 'fb-title', text: title }));
        if (cmp.kind === 'values' || cmp.kind === 'missing' || cmp.kind === 'extra' || cmp.kind === 'duplicates') {
          var diff = h('div', { class: 'diff' });
          if (cmp.missing && cmp.missing.length) diff.appendChild(h('div', null, h('span', { class: 'lbl', text: 'Expected but missing (' + cmp.missing.length + ')' }), table(r.expected.cols, cmp.missing.slice(0, 3), cmp.missing.slice(0, 3).map(function () { return 'miss'; }))));
          if (cmp.extra && cmp.extra.length) diff.appendChild(h('div', null, h('span', { class: 'lbl', text: 'In yours but not expected (' + cmp.extra.length + ')' }), table(r.mine.cols, cmp.extra.slice(0, 3), cmp.extra.slice(0, 3).map(function () { return 'extra'; }))));
          bx.appendChild(diff);
          if ((cmp.missing || []).length > 3 || (cmp.extra || []).length > 3) bx.appendChild(h('p', { class: 'muted sm', text: 'Showing up to 3 rows of each.' }));
        }
        mistakeTips(learner, v.sql, cmp).forEach(function (t) { bx.appendChild(h('p', { class: 'tip', html: t })); });
        if (cmp.kind !== 'order' && cmp.kind !== 'columns' && cmp.kind !== 'rule' && !v.verify && !mistakeTips(learner, v.sql, cmp).length) bx.appendChild(h('p', { class: 'tip', text: 'Compare your filter, joins and grouping with the task, or open a hint.' }));
        fb.appendChild(bx);
      }
      paintState();
    });
  }
  function resetCode() {
    var before = ed.all(); ed.set(starter(ex, ds)); fb.innerHTML = ''; out.innerHTML = '';
    toast('Code reset to the starter.', { label: 'Undo', fn: function () { ed.set(before); } });
  }
  function resetData() {
    Engine.req(ds, { cmd: 'snapshot' }).then(function (snap) {
      Engine.req(ds, { cmd: 'resetData' }).then(function () {
        schemaCache[ds] = null; out.innerHTML = '';
        toast('Data reset to the original ' + DSETS[ds].name + ' tables.', { label: 'Undo', fn: function () { Engine.req(ds, { cmd: 'restore', bytes: snap.bytes }, 8000).then(function () { schemaCache[ds] = null; toast('Data restored.'); }); } });
      });
    });
  }
  var resetMenu = h('div', { class: 'menu', hidden: true }, h('button', { class: 'btn sm', type: 'button', text: 'Reset code', onclick: function () { resetMenu.hidden = true; resetCode(); } }), h('button', { class: 'btn sm', type: 'button', text: 'Reset data', onclick: function () { resetMenu.hidden = true; resetData(); } }));
  var resetBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Reset', 'aria-haspopup': 'true', onclick: function () { resetMenu.hidden = !resetMenu.hidden; } });
  var schemaBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Schema', 'aria-expanded': 'false', onclick: function () { toggleSchema(schemaBox, schemaBtn, ds, function (txt) { ed.cm.replaceSelection(txt); ed.focus(); }); } });
  var bar = h('div', { class: 'actions action-bar' },
    h('button', { class: 'btn primary', type: 'button', onclick: run, text: 'Run' }),
    h('button', { class: 'btn accent', type: 'button', onclick: check, text: 'Check answer' }),
    hintBtn, solBtn,
    h('span', { class: 'reset-wrap' }, resetBtn, resetMenu),
    h('button', { class: 'btn ghost', type: 'button', text: 'Format', onclick: function () { ed.set(formatSql(ed.all())); } }),
    schemaBtn);
  work.appendChild(h('div', { class: 'work-head' }, h('span', { class: 'lbl', text: 'Your SQL' }), h('span', { class: 'kbd', text: 'Run Ctrl/\u2318+Enter \u00b7 Check +Shift \u00b7 Hint Alt+H' })));
  if (dsNote) work.appendChild(dsNote);
  work.appendChild(ed.el);
  work.appendChild(bar);
  work.appendChild(schemaBox);
  work.appendChild(fb);
  work.appendChild(out);
  ws.appendChild(task); ws.appendChild(work);
  p.appendChild(ws);
  paintHints();
  if (S.helped[ex.id] && exState(ex.id) === 'helped') { /* keep the solution hidden until asked again */ }
  p.__keys = function (e) { if (e.altKey && (e.key === 'h' || e.key === 'H' || e.code === 'KeyH')) { e.preventDefault(); nextHint(); } };
  return p;
}

function toggleSchema(box, btn, ds, insert) {
  if (!box.hidden) { box.hidden = true; btn.setAttribute('aria-expanded', 'false'); return; }
  box.hidden = false; btn.setAttribute('aria-expanded', 'true');
  box.innerHTML = '<p class="muted">Loading tables\u2026</p>';
  getSchema(ds).then(function (tables) {
    box.innerHTML = '';
    box.appendChild(h('p', { class: 'muted sm', text: 'Click a name to insert it at the cursor.' }));
    var g = h('div', { class: 'schema-grid' });
    tables.forEach(function (t) {
      var ul = h('ul');
      t.cols.forEach(function (c) { ul.appendChild(h('li', null, h('button', { class: 'linkish', type: 'button', text: c.name, onclick: function () { insert(c.name); } }), h('span', { class: 'ty', text: (c.pk ? 'PK ' : '') + (c.fk ? '\u2192 ' + c.fk + ' ' : '') + c.type }))); });
      g.appendChild(h('div', { class: 'tcard' }, h('div', { class: 'tcard-h' }, h('button', { class: 'linkish strong', type: 'button', text: t.name, onclick: function () { insert(t.name); } }), h('span', { class: 'ty', text: t.rows + ' rows' })), ul));
    });
    box.appendChild(g);
  });
}

function viewPlayground() {
  var p = page();
  var ds = curDs();
  p.appendChild(h('div', { class: 'eyebrow', text: 'Free practice' }));
  p.appendChild(h('h1', { text: 'Playground' }));
  p.appendChild(h('p', { class: 'lede', text: 'Write any query against ' + DSETS[ds].name + '. Changes you make here stay until you reset the data.' }));
  var out = h('div', { class: 'res', 'aria-live': 'polite' });
  var start = S.drafts['playground@' + ds] || ('-- ' + DSETS[ds].name + ': try anything\nSELECT *\nFROM ' + Object.keys(DSETS[ds].rowCounts)[0] + '\nLIMIT 10;');
  var ed = makeEditor(start, { onRun: run, label: 'Playground SQL editor', onChange: function (v) { S.drafts['playground@' + ds] = v; save(); } });
  function run() { out.innerHTML = '<p class="muted">Running\u2026</p>'; Engine.req(ds, { cmd: 'run', sql: ed.get() }).then(function (r) { if (r.timeout) r.error = 'TIMEOUT'; renderResult(out, r); }); }
  var chips = h('div', { class: 'chips' });
  Object.keys(DSETS[ds].rowCounts).forEach(function (t) { chips.appendChild(h('button', { class: 'chip', type: 'button', text: t, onclick: function () { ed.set('SELECT *\nFROM ' + t + '\nLIMIT 10;'); run(); } })); });
  var schemaBox = h('div', { class: 'schema-drawer', hidden: true });
  var schemaBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Schema', 'aria-expanded': 'false', onclick: function () { toggleSchema(schemaBox, schemaBtn, ds, function (txt) { ed.cm.replaceSelection(txt); ed.focus(); }); } });
  p.appendChild(chips);
  p.appendChild(ed.el);
  p.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', text: 'Run', onclick: run }), h('button', { class: 'btn ghost', type: 'button', text: 'Format', onclick: function () { ed.set(formatSql(ed.all())); } }), schemaBtn,
    h('button', { class: 'btn ghost', type: 'button', text: 'Reset data', onclick: function () { Engine.req(ds, { cmd: 'resetData' }).then(function () { schemaCache[ds] = null; toast('Data reset to the original tables.'); }); } })));
  p.appendChild(schemaBox);
  p.appendChild(out);
  setTimeout(run, 30);
  return p;
}

function viewDatasets() {
  var p = page();
  p.appendChild(h('div', { class: 'eyebrow', text: 'Datasets' }));
  p.appendChild(h('h1', { text: 'Six sectors, one course' }));
  p.appendChild(h('p', { class: 'lede', text: 'Every dataset is fictional, generated from a fixed seed, and built to the same shape: parents with many children, header and line tables, a reporting hierarchy, rows with no match, deliberate blanks and ties. That is why every exercise works on all of them. "Today" is 2025-12-31 in every dataset.' }));
  ORDER.forEach(function (id) {
    var d = DSETS[id], on = id === curDs();
    var card = h('section', { class: 'ds-detail' + (on ? ' on' : '') });
    card.appendChild(h('div', { class: 'ds-detail-h' }, h('div', null, h('span', { class: 'ds-sector', text: d.sector }), h('h2', { text: d.name })), h('span', { class: 'sp' }),
      on ? h('span', { class: 'pill', text: 'In use' }) : h('button', { class: 'btn', type: 'button', text: 'Use this dataset', onclick: function () { setDs(id); } })));
    card.appendChild(h('p', { text: d.story }));
    var tb = h('div', { class: 'chips' });
    Object.keys(d.rowCounts).forEach(function (t) { tb.appendChild(h('span', { class: 'chip static' }, h('b', { text: t }), ' ' + d.rowCounts[t].toLocaleString())); });
    card.appendChild(tb);
    var more = h('div', { class: 'schema-drawer', hidden: true });
    var btn = h('button', { class: 'btn ghost sm', type: 'button', text: 'Show columns', 'aria-expanded': 'false', onclick: function () { toggleSchema(more, btn, id, function () {}); btn.textContent = more.hidden ? 'Show columns' : 'Hide columns'; } });
    card.appendChild(btn); card.appendChild(more);
    p.appendChild(card);
  });
  return p;
}

function viewProgress() {
  var p = page();
  p.appendChild(h('div', { class: 'eyebrow', text: 'My progress' }));
  p.appendChild(h('h1', { text: 'What you have mastered' }));
  var solved = ALL_EX.filter(function (e) { return exState(e.id) === 'solved'; }).length, helped = ALL_EX.filter(function (e) { return exState(e.id) === 'helped'; }).length, tried = ALL_EX.filter(function (e) { return exState(e.id) === 'attempted'; }).length;
  p.appendChild(h('div', { class: 'stats' },
    h('div', null, h('b', { text: solved }), h('span', { text: 'solved' })), h('div', null, h('b', { text: helped }), h('span', { text: 'solved with help' })),
    h('div', null, h('b', { text: tried }), h('span', { text: 'attempted' })), h('div', null, h('b', { text: points() }), h('span', { text: 'points' }))));
  p.appendChild(h('h2', { text: 'Modules' }));
  var tbl = h('table', { class: 'grid plain' });
  tbl.appendChild(h('thead', null, h('tr', null, h('th', { text: 'Module' }), h('th', { text: 'Solved' }), h('th', { text: 'Status' }))));
  var tb = h('tbody');
  MODS.forEach(function (m) {
    var hardDone = m.exercises.some(function (e) { return e.level === 'Hard' && exState(e.id) === 'solved'; });
    tb.appendChild(h('tr', null, h('td', null, h('a', { href: '#' + m.id, text: m.number + '. ' + m.title })), h('td', { class: 'num', text: modDone(m) + ' / ' + m.exercises.length }),
      h('td', { text: modComplete(m) ? (hardDone ? 'Complete with distinction' : 'Complete') : 'In progress' })));
  });
  tbl.appendChild(tb);
  p.appendChild(h('div', { class: 'grid-wrap' }, tbl));
  p.appendChild(h('h2', { text: 'Concept mastery' }));
  var score = {};
  ALL_EX.forEach(function (e) { var s = exState(e.id), v = s === 'solved' ? 1 : s === 'helped' ? 0.5 : s === 'attempted' ? 0.15 : 0; e.concepts.forEach(function (c) { score[c] = score[c] || { t: 0, n: 0, ex: [] }; score[c].t += v; score[c].n++; score[c].ex.push(e); }); });
  var list = Object.keys(score).map(function (c) { return { c: c, pct: Math.round(100 * score[c].t / score[c].n), ex: score[c].ex }; }).sort(function (a, b) { return a.pct - b.pct; });
  var weak = list.filter(function (x) { return x.pct < 100; }).slice(0, 3);
  if (weak.length) {
    p.appendChild(h('p', { class: 'muted', text: 'Your three weakest concepts. Practise one to raise it.' }));
    var wk = h('div', { class: 'chips' });
    weak.forEach(function (w) { var target = w.ex.filter(function (e) { return exState(e.id) !== 'solved'; })[0] || w.ex[0]; wk.appendChild(h('a', { class: 'chip', href: '#' + target.id }, h('b', { text: w.c }), ' ' + w.pct + '% \u00b7 Practise this')); });
    p.appendChild(wk);
  }
  var mg = h('div', { class: 'mastery' });
  list.slice().sort(function (a, b) { return a.c.localeCompare(b.c); }).forEach(function (x) { mg.appendChild(h('div', { class: 'm-row' }, h('span', { text: x.c }), h('span', { class: 'bar' }, h('i', { style: 'width:' + x.pct + '%' })), h('span', { class: 'num', text: x.pct + '%' }))); });
  p.appendChild(mg);
  p.appendChild(h('h2', { text: 'Your data' }));
  p.appendChild(h('p', { class: 'muted', text: 'Progress is saved in this browser only. Copy it out to keep a backup or move it to another browser.' }));
  var area = h('textarea', { class: 'export', rows: '3', 'aria-label': 'Progress data', spellcheck: 'false' });
  var exportBtn = h('button', { class: 'btn', type: 'button', text: 'Copy progress', onclick: function () { copyText(JSON.stringify({ progress: S.progress, helped: S.helped }), exportBtn); } });
  var importBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Import pasted progress', onclick: function () { try { var d = JSON.parse(area.value); S.progress = d.progress || {}; S.helped = d.helped || {}; save(); toast('Progress imported.'); route(true); } catch (e) { toast('That text is not GageQuery progress. Paste what Copy progress gave you.'); } } });
  var armed = false, clearBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Reset all progress', onclick: function () { if (!armed) { armed = true; clearBtn.textContent = 'Click again to erase everything'; return; } S.progress = {}; S.helped = {}; S.hints = {}; S.drafts = {}; save(); toast('Progress erased.'); route(true); } });
  p.appendChild(area);
  p.appendChild(h('div', { class: 'actions' }, exportBtn, importBtn, clearBtn));
  return p;
}

function viewAbout() {
  var p = page('prose');
  p.appendChild(h('div', { class: 'eyebrow', text: 'How it works' }));
  p.appendChild(h('h1', { text: 'Real SQL, checked by result' }));
  [['Every query runs for real', 'GageQuery holds a private copy of each dataset and runs your SQL in your browser, inside a background worker. Nothing is sent anywhere and nothing needs installing.'],
   ['MySQL syntax on a browser engine', 'The course teaches MySQL syntax. The engine underneath is SQLite with a compatibility layer that adds CONCAT, CONCAT_WS, DATE_FORMAT, YEAR, MONTH, DAY, QUARTER, DAYNAME, MONTHNAME, DATEDIFF, LEFT, RIGHT, LOCATE, LPAD and MySQL-style ROUND, and accepts START TRANSACTION, CAST(... AS SIGNED), EXPLAIN, SHOW TABLES and DESCRIBE.'],
   ['How answers are checked', 'Check answer runs your query and the model answer on two fresh copies of the data, then compares the rows. Any correct query passes, however you write it. Column names do not have to match; values and, where the task asks, order do. Numbers match to within 0.005.'],
   ['Hints and solutions', 'Each exercise has three hints that go from where to look, to the concept, to a skeleton with blanks. Showing the solution marks the exercise as solved with help, which earns half the points.'],
   ['Reset', 'Reset code puts the starter back. Reset data restores the original tables if you changed them with INSERT, UPDATE or DELETE. Both can be undone for 10 seconds.'],
   ['Differences from a MySQL server', 'Integer division and some date functions behave differently between databases, so the model answers multiply by 100.0 when they need decimals. Error messages and EXPLAIN output are worded differently from MySQL\u2019s. Stored procedures and triggers will be shown as reference cards in later modules.']].forEach(function (s) { p.appendChild(h('h2', { text: s[0] })); p.appendChild(h('p', { text: s[1] })); });
  p.appendChild(h('h2', { text: 'Keyboard shortcuts' }));
  var t = h('table', { class: 'grid plain' }); var tb = h('tbody');
  [['Run', 'Ctrl/\u2318 + Enter'], ['Check answer', 'Ctrl/\u2318 + Shift + Enter'], ['Next hint', 'Alt + H'], ['Format SQL', 'Shift + Alt + F'], ['Autocomplete', 'Ctrl + Space'], ['Find anything', 'Ctrl/\u2318 + K'], ['Leave the editor', 'Esc, then Tab']].forEach(function (r) { tb.appendChild(h('tr', null, h('td', { text: r[0] }), h('td', null, h('code', { text: r[1] })))); });
  t.appendChild(tb); p.appendChild(h('div', { class: 'grid-wrap' }, t));
  return p;
}

/* ================================================================ palette */
function openPalette() {
  var dlg = $('#palette'); dlg.hidden = false;
  var input = $('#pal-input'), list = $('#pal-list'); input.value = ''; render(); input.focus();
  var items = [['Home', 'home'], ['Course map', 'learn'], ['Datasets', 'datasets'], ['Playground', 'playground'], ['My progress', 'progress'], ['How it works', 'about']];
  MODS.forEach(function (m) { items.push(['Module ' + m.number + ': ' + m.title, m.id]); m.exercises.forEach(function (e) { items.push(['M' + m.number + ' Exercise ' + e.n + ' (' + e.level + '): ' + e.v[curDs()].task.slice(0, 70), e.id]); }); });
  ORDER.forEach(function (d) { items.push(['Use dataset: ' + dsLabel(d), 'ds:' + d]); });
  var sel = 0, shown = [];
  function render() {
    var q = input.value.toLowerCase().trim();
    shown = (items || []).filter(function (it) { return !q || it[0].toLowerCase().indexOf(q) >= 0; }).slice(0, 12);
    list.innerHTML = ''; sel = Math.min(sel, Math.max(0, shown.length - 1));
    shown.forEach(function (it, i) { list.appendChild(h('li', { role: 'option', 'aria-selected': i === sel ? 'true' : 'false', onclick: function () { go(it); } }, it[0])); });
  }
  function go(it) { close(); if (it[1].indexOf('ds:') === 0) setDs(it[1].slice(3)); else navigate(it[1]); }
  function close() { dlg.hidden = true; input.oninput = null; input.onkeydown = null; }
  input.oninput = function () { sel = 0; render(); };
  input.onkeydown = function (e) {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && shown[sel]) { go(shown[sel]); }
    else if (e.key === 'Escape') close();
  };
  dlg.onclick = function (e) { if (e.target === dlg) close(); };
}

/* ================================================================ router */
var currentPage = null;
function currentRoute() { if (routeId) return routeId; var r = (location.hash || '').replace('#', ''); return r || 'home'; }
function navigate(id) { routeId = id; try { if (location.hash !== '#' + id) location.hash = id; } catch (e) {} route(); }
function route(keepScroll) {
  var r = currentRoute(), pg, m;
  var y = window.scrollY;
  if (r === 'home') pg = viewHome();
  else if (r === 'learn') pg = viewMap();
  else if (r === 'playground') pg = viewPlayground();
  else if (r === 'datasets') pg = viewDatasets();
  else if (r === 'progress') pg = viewProgress();
  else if (r === 'about') pg = viewAbout();
  else if ((m = /^(m\d\d)(?:-(concepts|examples|exercises))?$/.exec(r)) && MOD_BY_ID[m[1]]) pg = viewModule(MOD_BY_ID[m[1]], m[2]);
  else if (EX_BY_ID[r]) pg = viewExercise(EX_BY_ID[r]);
  else pg = viewHome();
  main.innerHTML = ''; main.appendChild(pg); currentPage = pg;
  markRail();
  closeRail();
  window.scrollTo(0, keepScroll === true ? y : 0);
  var h1 = pg.querySelector('h1'); document.title = (h1 ? h1.textContent + ' \u00b7 ' : '') + 'GageQuery';
}
function closeRail() { rail.classList.remove('open'); $('#scrim').classList.remove('open'); }

/* ================================================================ boot */
function boot() {
  rail = $('#rail'); main = $('#main');
  var sel = $('#ds-select');
  ORDER.forEach(function (d) { sel.appendChild(h('option', { value: d, text: dsLabel(d) })); });
  sel.value = curDs();
  sel.addEventListener('change', function () { setDs(sel.value); });
  $('#menu-btn').addEventListener('click', function () { rail.classList.toggle('open'); $('#scrim').classList.toggle('open'); });
  $('#scrim').addEventListener('click', closeRail);
  $('#pal-btn').addEventListener('click', openPalette);
  document.addEventListener('click', function (ev) {
    var t = ev.target; while (t && t !== document && !(t.tagName === 'A' && (t.getAttribute('href') || '').charAt(0) === '#')) t = t.parentNode;
    if (!t || t === document) return;
    ev.preventDefault(); navigate(t.getAttribute('href').slice(1));
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); }
    else if (currentPage && currentPage.__keys) currentPage.__keys(e);
  });
  window.addEventListener('hashchange', function () { var r = (location.hash || '').replace('#', ''); if (r && r !== routeId) { routeId = r; route(); } });
  paintRail(); paintMeter();
  setDs(curDs(), true);
  route();
  Engine.open(curDs()).then(function () { $('#engine').classList.add('ready'); $('#engine').textContent = 'Engine ready'; }).catch(function (e) { $('#engine').textContent = 'Engine failed: ' + e.message; });
}

/* ================================================================ self-test hook (used for verification) */
window.__qcSelfTest = function (dsList) {
  var jobs = [];
  (dsList || ORDER).forEach(function (ds) {
    var items = [];
    MODS.forEach(function (m) {
      m.examples.forEach(function (e) { if (e.ref || /fails on purpose/.test(e.tryIt || '')) return; items.push({ ds: ds, label: ds + ' ' + e.id, sql: e.v[ds], pre: e.pre ? (typeof e.pre === 'string' ? e.pre : e.pre[ds]) : null, ddl: !/^\s*(--[^\n]*\n\s*)*(SELECT|WITH)/i.test(e.v[ds]) }); });
      m.exercises.forEach(function (e) { var v = e.v[ds]; items.push({ ds: ds, label: ds + ' ' + e.id, sql: v.sql, pre: v.pre, verify: v.verify, expectRows: v.rows }); });
    });
    jobs.push(Engine.req(ds, { cmd: 'selftest', items: items }, 120000));
  });
  return Promise.all(jobs).then(function (rs) { var out = { checked: 0, problems: [] }; rs.forEach(function (r) { out.checked += r.checked || 0; out.problems = out.problems.concat(r.problems || [r.error]); }); return out; });
};
window.__qcCompare = compare;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
