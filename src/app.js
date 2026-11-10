(function () {
'use strict';
var DATA = JSON.parse(document.getElementById('qc-data').textContent);
var MODS = DATA.modules, DSETS = DATA.datasets, ORDER = DATA.order;
var EX_BY_ID = Object.create(null), MOD_BY_ID = Object.create(null);   // no prototype, so a URL like #constructor is not a route
MODS.forEach(function (m) { MOD_BY_ID[m.id] = m; m.exercises.forEach(function (e, i) { e.n = i + 1; e.mod = m; EX_BY_ID[e.id] = e; }); });
var ALL_EX = []; MODS.forEach(function (m) { m.exercises.forEach(function (e) { ALL_EX.push(e); }); });

/* ================================================================ helpers */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function md(s) {
  return esc(s || '').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s"(])\*(\w[^*\n]*?\w|\w)\*(?=[\s.,;:!?")]|$)/g, '$1<em>$2</em>');   // *word* italics; leaves COUNT(*) and SELECT * alone
}
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
var MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl';

/* ================================================================ storage */
var KEY = 'gagequery-v1';
var S = { v: 2, ds: null, progress: {}, drafts: {}, hints: {}, helped: {}, days: {}, reviewed: {} };
/* Saved or pasted progress is untrusted text: keep only known keys of the right shape, drop everything else. */
function cleanState(d) {
  var out = { v: typeof d.v === 'number' ? d.v : 1, ds: DSETS[d.ds] ? d.ds : null, progress: {}, drafts: {}, hints: {}, helped: {}, days: {}, reviewed: {} };
  var STATES = { attempted: 1, helped: 1, solved: 1 };
  function each(o, fn) { if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function (k) { fn(k, o[k]); }); }
  function exKey(k) { var m = /^(m\d\d-e\d\d)(?:@(\w+))?$/.exec(k); return m && EX_BY_ID[m[1]] && (!m[2] || DSETS[m[2]]) ? m[1] : null; }
  each(d.progress, function (k, v) { if (EX_BY_ID[k] && v && STATES[v.state]) out.progress[k] = { state: v.state, ds: DSETS[v.ds] ? v.ds : 'sales', at: isFinite(v.at) ? +v.at : 0 }; });
  each(d.helped, function (k, v) { if (EX_BY_ID[k] && v) out.helped[k] = true; });
  each(d.hints, function (k, v) { if (exKey(k) && v >= 0 && v <= 3) out.hints[k] = Math.floor(v); });
  each(d.reviewed, function (k, v) { if (EX_BY_ID[k] && isFinite(v)) out.reviewed[k] = +v; });
  each(d.days, function (k, v) { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v >= 0 && v < 1e6) out.days[k] = Math.floor(v); });
  each(d.drafts, function (k, v) {
    var m = /^(?:(m\d\d-e\d\d)|playground)(?:@(\w+))?$/.exec(k);
    if (m && (!m[1] || EX_BY_ID[m[1]]) && (!m[2] || DSETS[m[2]]) && typeof v === 'string') out.drafts[k] = v.slice(0, 20000);
    else if (/^m\d\d-e\d\d@ds$/.test(k) && DSETS[v]) out.drafts[k] = v;
  });
  return out;
}
try { var raw = localStorage.getItem(KEY) || localStorage.getItem('querycraft-v1'); if (raw) { var p = JSON.parse(raw); var clean = cleanState(p); for (var k in clean) S[k] = clean[k]; migrate(p); } } catch (e) {}
/* v1 had no version, activity days or review times. Rebuild the days from the time each exercise was last updated. */
function migrate(old) {
  if ((old.v || 1) < 2) {
    S.days = S.days || {}; S.reviewed = S.reviewed || {};
    for (var id in S.progress) { var at = S.progress[id] && S.progress[id].at; if (at) { var d = dayKey(new Date(at)); S.days[d] = (S.days[d] || 0) + 1; } }
    S.v = 2;
  }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
/* Streaks follow the learner's real calendar; the datasets' fixed "today" (2025-12-31) is only for query answers. */
function dayKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function markActive() { var d = dayKey(new Date()); S.days[d] = (S.days[d] || 0) + 1; save(); }
function curDs() { return S.ds && DSETS[S.ds] ? S.ds : 'sales'; }
function exState(id) { return (S.progress[id] || {}).state || 'new'; }
function setState(id, st) {
  var cur = exState(id);
  var rank = { 'new': 0, attempted: 1, helped: 2, solved: 3 };
  var before = earned(), lvl = level().n, ex = EX_BY_ID[id], modWas = ex && modComplete(ex.mod), wasDone = isDone(id);
  if (rank[st] > rank[cur] || (st === 'solved' && cur === 'helped' && !S.helped[id])) S.progress[id] = { state: st, ds: curDs(), at: Date.now() };
  save(); paintRail(); paintMeter();
  if (ex && !wasDone && isDone(id)) { Analytics.event('solved/' + id); GA.event('exercise_solved', { exercise_id: id, module_id: ex.mod.id, level: ex.level, help: st === 'helped' ? 'solution' : 'none' }); }
  if (ex && !modWas && modComplete(ex.mod)) { Analytics.event('module-complete/' + ex.mod.id); GA.event('module_completed', { module_id: ex.mod.id }); }
  earned().forEach(function (b) { if (before.indexOf(b) < 0) toast('Badge earned: ' + BADGES.filter(function (x) { return x.id === b; })[0].name); });
  if (level().n > lvl) toast('Level up! You are now ' + level().name + '.');
}

/* ---------------------------------------------------------------- XP, levels, streaks, badges (all derived from S) */
var XP = { Easy: 50, Medium: 100, Hard: 200 };
function isDone(id) { var s = exState(id); return s === 'solved' || s === 'helped'; }
function xpFor(e) { var s = exState(e.id); return s === 'solved' ? XP[e.level] : s === 'helped' ? XP[e.level] / 2 : 0; }
function xp() { var t = 0; ALL_EX.forEach(function (e) { t += xpFor(e); }); return t; }
var LEVELS = [[0, 'Beginner'], [300, 'Explorer'], [1000, 'Query Writer'], [2500, 'Analyst'], [4500, 'Senior Analyst'], [7000, 'SQL Expert']];
function level() {
  var t = xp(), i = 0; while (i + 1 < LEVELS.length && t >= LEVELS[i + 1][0]) i++;
  var next = LEVELS[i + 1];
  return { n: i + 1, name: LEVELS[i][1], xp: t, from: LEVELS[i][0], to: next ? next[0] : null, nextName: next ? next[1] : null };
}
function streaks() {
  var days = S.days || {}, today = new Date(), d = new Date(today), cur = 0;
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);          // a streak is still alive until the end of today
  while (days[dayKey(d)]) { cur++; d.setDate(d.getDate() - 1); }
  var keys = Object.keys(days).sort(), best = 0, run = 0, prev = null;
  keys.forEach(function (k) { var t = new Date(k + 'T12:00:00'); run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
  function week(x) { var t = new Date(x); t.setHours(12, 0, 0, 0); t.setDate(t.getDate() - (t.getDay() + 6) % 7); return dayKey(t); }   // Monday of x's week
  var weeks = {}; keys.forEach(function (k) { weeks[week(new Date(k + 'T12:00:00'))] = 1; });
  var w = new Date(today), wk = 0; if (!weeks[week(w)]) w.setDate(w.getDate() - 7);
  while (weeks[week(w)]) { wk++; w.setDate(w.getDate() - 7); }
  return { daily: cur, best: Math.max(best, cur), weekly: wk, activeDays: keys.length };
}
function modById(id) { return MOD_BY_ID[id]; }
function allDone(ids) { return ids.every(function (id) { return modById(id) && modById(id).exercises.every(function (e) { return isDone(e.id); }); }); }
function cleanSolves() { return ALL_EX.filter(function (e) { return exState(e.id) === 'solved' && !ORDER.some(function (d) { return S.hints[e.id + '@' + d]; }); }).length; }
function modsText(ids) { var n = ids.map(function (id) { return MOD_BY_ID[id].number; }); return n.length === 1 ? 'Module ' + n[0] : 'Modules ' + n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; }
var BADGES = [
  { id: 'first', name: 'First query', how: 'Solve your first exercise.', test: function () { return ALL_EX.some(function (e) { return isDone(e.id); }); } },
  { id: 'ten', name: 'Ten correct answers', how: 'Solve 10 exercises.', test: function () { return ALL_EX.filter(function (e) { return isDone(e.id); }).length >= 10; } },
  { id: 'fifty', name: 'Fifty correct answers', how: 'Solve 50 exercises.', test: function () { return ALL_EX.filter(function (e) { return isDone(e.id); }).length >= 50; } },
  { id: 'nohints', name: 'On my own', how: 'Solve 10 exercises without a hint or the solution.', test: function () { return cleanSolves() >= 10; } },
  { id: 'tables', name: 'Table builder', how: 'Solve every exercise in ' + modsText(['m15']) + '.', test: function () { return allDone(['m15']); } },
  { id: 'joins', name: 'Join builder', how: 'Solve every exercise in ' + modsText(['m04']) + '.', test: function () { return allDone(['m04']); } },
  { id: 'windows', name: 'Window wizard', how: 'Solve every exercise in ' + modsText(['m07', 'm08']) + '.', test: function () { return allDone(['m07', 'm08']); } },
  { id: 'cleaner', name: 'Data cleaner', how: 'Solve every exercise in ' + modsText(['m13']) + '.', test: function () { return allDone(['m13']); } },
  { id: 'capstone', name: 'Business reviewer', how: 'Solve every capstone task.', test: function () { return allDone(['m14']); } },
  { id: 'datasets', name: 'Sector hopper', how: 'Solve exercises on three different datasets.', test: function () { var u = {}; ALL_EX.forEach(function (e) { if (isDone(e.id)) u[S.progress[e.id].ds] = 1; }); return Object.keys(u).length >= 3; } },
  { id: 'streak', name: 'Seven-day streak', how: 'Practise on 7 days in a row.', test: function () { return streaks().best >= 7; } },
  { id: 'master', name: 'Master analyst', how: 'Solve every exercise in the course.', test: function () { return ALL_EX.every(function (e) { return isDone(e.id); }); } }
];
function earned() { return BADGES.filter(function (b) { return b.test(); }).map(function (b) { return b.id; }); }
function modDone(m) { var n = 0; m.exercises.forEach(function (e) { if (isDone(e.id)) n++; }); return n; }
function nextExercise() { return ALL_EX.filter(function (e) { return !isDone(e.id); })[0] || null; }
function modName(m) { return m.capstone ? 'Capstone' : 'Module ' + m.number; }
function exName(e) { return (e.mod.capstone ? 'Task ' : 'Exercise ') + e.n; }
/* One status per module, used by the course map, module pages and the home dashboard. */
function modStatus(m) {
  var nx = nextExercise();
  if (modComplete(m)) return { key: 'done', label: modDone(m) === m.exercises.length ? 'Complete' : 'Complete · Hard left' };
  if (nx && nx.mod === m) return { key: 'next', label: 'Up next' };
  if (m.exercises.some(function (e) { return exState(e.id) !== 'new'; })) return { key: 'going', label: 'In progress' };
  return { key: 'todo', label: 'Not started' };
}
function statusChip(m) { var s = modStatus(m); return h('span', { class: 'status ' + s.key, text: (s.key === 'done' ? '✓ ' : '') + s.label }); }
function hoursText(m) { return m.minutes < 60 ? m.minutes + ' min' : 'about ' + Math.round(m.minutes / 60) + ' h'; }
function modComplete(m) { return m.exercises.every(function (e) { return e.level === 'Hard' || isDone(e.id); }); }

/* ================================================================ privacy: consent first (GDPR, ePrivacy and Nigeria's NDPA)
   Necessary storage (progress, settings, the privacy choice itself) never leaves the device and needs no consent.
   The two optional tools (cookie-free visit counting with GoatCounter, and Google Analytics with cookies) do nothing at
   all, and store nothing, until the learner says yes to each one. Do Not Track or Global Privacy Control means no to
   both, with no banner. Choices are recorded with a date and the notice version, and asked again after 12 months. */
var PRIVACY = { contact: 'gagexplorerinc@gmail.com', owner: 'GageQuery', updated: '10 November 2026', version: 1 };

/* Anonymous visit counting: a 1x1 image from GoatCounter per page view and milestone. No script and no cookies. */
var Analytics = (function () {
  var endpoint = null, active = false, last = null, sentRef = false, MARK = 'gagequery-seen';
  function init() {
    var m = document.querySelector('meta[name="analytics-endpoint"]'), u = m && m.getAttribute('content');
    if (/^https:\/\/[a-z0-9-]+\.goatcounter\.com$/.test(u || '')) endpoint = u;
  }
  function send(path, title, isEvent, force) {
    if (!endpoint || (!active && !force)) return;   // force: a rating the learner chose to send
    var q = 'p=' + encodeURIComponent(path) + '&t=' + encodeURIComponent(title || '') + (isEvent ? '&e=true' : '') + '&s=' + [screen.width, screen.height, window.devicePixelRatio || 1].join(',');
    if (!sentRef && !isEvent) {
      sentRef = true;
      try { if (document.referrer && new URL(document.referrer).origin !== location.origin) q += '&r=' + encodeURIComponent(document.referrer); } catch (e) {}
    }
    try { new Image().src = endpoint + '/count?' + q + '&rnd=' + Math.random().toString(36).slice(2); } catch (e) {}
  }
  /* `visit` once per app load (GoatCounter counts it once per person per session), `first-visit` when this device has no
     marker yet, `return-visit` when the marker is over a day old. The marker is only the date of the last visit. */
  function countVisit() {
    var prev = 0;
    try { prev = +localStorage.getItem(MARK) || 0; } catch (e) {}
    send('visit', 'visit', true);
    if (!prev) send('first-visit', 'first-visit', true);
    else if (Date.now() - prev > 864e5) send('return-visit', 'return-visit', true);
    try { localStorage.setItem(MARK, String(Date.now())); } catch (e) {}
  }
  function pageNow(route, title) { send('/' + (route === 'home' ? '' : route), title, false); }
  return {
    init: init,
    configured: function () { return !!endpoint; },
    enable: function () { if (!endpoint || active) return; active = true; countVisit(); if (last) pageNow(last[0], last[1]); },
    disable: function () { active = false; try { localStorage.removeItem(MARK); } catch (e) {} },
    page: function (route, title) { if (last && last[0] === route) return; last = [route, title]; if (active) pageNow(route, title); },
    event: function (name) { send(name, name, true); },
    feedback: function (name) { send(name, name, true, true); }
  };
})();

/* Google Analytics 4: loaded only after consent, with advertising features denied and cookies kept at most 13 months. */
var GA = (function () {
  var id = null, loaded = false, last = null;
  function init() {
    var m = document.querySelector('meta[name="ga-measurement-id"]'), v = m && m.getAttribute('content');
    if (/^G-[A-Z0-9]{4,16}$/.test(v || '')) id = v;
  }
  /* The app uses #routes; GA ignores the part after #, so each route is reported as a path such as /gagequery/m04. */
  function sendPage(route, title) {
    var base = location.origin + location.pathname.replace(/\/+$/, '');
    window.gtag('event', 'page_view', { page_location: base + '/' + (route === 'home' ? '' : route), page_title: title });
  }
  function enable() {
    if (!id) return;
    window['ga-disable-' + id] = false;
    if (loaded) { window.gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };   // gtag needs the arguments object itself
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', id, { send_page_view: false, cookie_expires: 34128000, allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    if (last) sendPage(last[0], last[1]);
  }
  function disable() {
    if (!id) return;
    window['ga-disable-' + id] = true;
    if (loaded && window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!/^_ga(_|$)/.test(name)) return;
      var host = location.hostname, parts = host.split('.'), domains = ['', host, '.' + host];
      for (var i = 1; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
      domains.forEach(function (d) { document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : ''); });
    });
  }
  return {
    init: init, enable: enable, disable: disable,
    configured: function () { return !!id; },
    page: function (route, title) { if (last && last[0] === route) return; last = [route, title]; if (loaded && !window['ga-disable-' + id]) sendPage(route, title); },
    event: function (name, params) { if (loaded && !window['ga-disable-' + id]) window.gtag('event', name, params || {}); }
  };
})();

var Consent = (function () {
  var KEY = 'gagequery-consent', MAX_AGE = 365 * 864e5;
  function signal() { return navigator.doNotTrack === '1' || window.doNotTrack === '1' || !!navigator.globalPrivacyControl; }
  function relevant() { return Analytics.configured() || GA.configured(); }
  function record() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c && c.v === PRIVACY.version && typeof c.at === 'number' && Date.now() - c.at < MAX_AGE && typeof c.counting === 'boolean' && typeof c.ga === 'boolean') return c;
    } catch (e) {}
    return null;
  }
  function apply(c) {
    if (c && c.counting) Analytics.enable(); else Analytics.disable();
    if (c && c.ga) GA.enable(); else GA.disable();
  }
  function save(counting, ga) {
    var c = { v: PRIVACY.version, at: Date.now(), counting: !!counting && Analytics.configured(), ga: !!ga && GA.configured() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); localStorage.removeItem('gagequery-analytics'); } catch (e) {}
    apply(c);
    var b = document.getElementById('consent'); if (b) b.remove();
    return c;
  }
  function init() {
    try { localStorage.removeItem('gagequery-analytics'); } catch (e) {}   // the earlier GA-only choice did not cover visit counting, so ask again
    if (!relevant() || signal()) { apply(null); return; }
    var c = record();
    if (c) apply(c); else banner();
  }
  function banner() {
    if (document.getElementById('consent')) return;
    var b = h('section', { id: 'consent', class: 'consent', role: 'region', 'aria-label': 'Privacy choices' });
    var intro = h('div', { class: 'consent-intro' },
      h('p', null, h('b', { text: 'Your privacy choices. ' }), h('span', { text: 'With your permission we use ' + [Analytics.configured() ? 'visit counting (GoatCounter, no cookies)' : '', GA.configured() ? 'Google Analytics (cookies)' : ''].filter(Boolean).join(' and ') + ' to see which lessons help and where learners get stuck. We never collect your name, your SQL or your progress, and the course works the same whatever you choose. ' }), h('a', { href: '#privacy', text: 'Read the privacy notice' })),
      h('div', { class: 'actions' },
        h('button', { class: 'btn strong sm', type: 'button', text: 'Accept all', onclick: function () { save(true, true); toast('Thank you. You can change this at any time under Privacy.'); } }),
        h('button', { class: 'btn strong sm', type: 'button', text: 'Reject all', onclick: function () { save(false, false); toast('Nothing optional will run. You can change this under Privacy.'); } }),
        h('button', { class: 'btn ghost sm', type: 'button', text: 'Choose', 'aria-expanded': 'false', onclick: function () { intro.hidden = true; b.appendChild(choices(function () { toast('Your choices are saved.'); })); } })));
    b.appendChild(intro);
    document.body.appendChild(b);
  }
  /* The same switches serve the banner, the Privacy page and My progress. Both start off unless already chosen. */
  function choices(onSave) {
    var c = record() || { counting: false, ga: false };
    var box = h('div', { class: 'choices' });
    box.appendChild(h('div', { class: 'choice' }, h('input', { type: 'checkbox', id: 'ch-need', checked: true, disabled: true }),
      h('label', { for: 'ch-need' }, h('b', { text: 'Necessary (always on)' }), h('span', { text: 'Your progress, settings and these choices, saved in your browser. Not cookies, and never sent anywhere.' }))));
    var cnt = null, ga = null;
    if (Analytics.configured()) {
      cnt = h('input', { type: 'checkbox', id: 'ch-count', checked: c.counting });
      box.appendChild(h('div', { class: 'choice' }, cnt, h('label', { for: 'ch-count' }, h('b', { text: 'Visit counting (GoatCounter)' }), h('span', { text: 'Counts visits and the lessons opened, without cookies. Saves only the date of your last visit, to tell new visitors from returning ones.' }))));
    }
    if (GA.configured()) {
      ga = h('input', { type: 'checkbox', id: 'ch-ga', checked: c.ga });
      box.appendChild(h('div', { class: 'choice' }, ga, h('label', { for: 'ch-ga' }, h('b', { text: 'Google Analytics (cookies)' }), h('span', { text: 'Shows how learners move through the course: pages, exercises solved and modules completed. Uses Google cookies for up to 13 months; advertising features are off.' }))));
    }
    if (signal()) box.appendChild(h('p', { class: 'muted sm', text: 'Your browser asks sites not to track you (Do Not Track or Global Privacy Control), so the optional tools stay off.' }));
    box.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary sm', type: 'button', text: 'Save my choices', disabled: signal(), onclick: function () {
      save(cnt ? cnt.checked : false, ga ? ga.checked : false);
      if (onSave) onSave();
    } })));
    return box;
  }
  return { init: init, relevant: relevant, choices: choices, record: record, signal: signal };
})();

function viewPrivacy() {
  var p = page('prose');
  p.appendChild(h('div', { class: 'eyebrow', text: 'Privacy' }));
  p.appendChild(h('h1', { text: 'Privacy notice' }));
  p.appendChild(h('p', { class: 'muted', text: 'Version ' + PRIVACY.version + ' · last updated ' + PRIVACY.updated }));
  if (Consent.relevant()) {
    p.appendChild(h('h2', { text: 'Your choices' }));
    var c = Consent.record();
    p.appendChild(h('p', { class: 'muted', text: c ? 'You last chose on ' + new Date(c.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) + '. Change anything below and press Save; it takes effect straight away.' : 'You have not chosen yet. Nothing optional runs until you do.' }));
    p.appendChild(Consent.choices(function () { toast('Your choices are saved.'); route(true); }));
  }
  var S1 = [
    ['The short version', 'GageQuery is a free SQL course that runs in your browser. Your progress stays on your device. We do not ask for your name or email, and we never collect your SQL or answers. Two optional tools help us improve the course, and they run only if you say yes.'],
    ['Who is responsible', PRIVACY.owner + ' runs this site and decides how the optional tools are used. For any privacy question or request, email ' + PRIVACY.contact + '.'],
    ['Stored on your device (necessary)', 'Your progress, drafts, hints, practice days, review times, chosen dataset, theme and these privacy choices are saved in your browser’s local storage. They are not cookies, they are never sent to us or anyone else, and the course cannot work without them. You can download, import or erase them on My progress, or by clearing this site’s data in your browser.'],
    ['Optional: visit counting (GoatCounter)', 'If you allow it, your browser sends GoatCounter (goatcounter.com) the page you open, its title, your screen size, the site you came from, and milestones such as "solved/m03-e02" or "module-complete/m04". GoatCounter uses your IP address and browser type briefly to avoid counting the same visit twice and, according to GoatCounter, never stores them. No cookies are used. We also save the date of your last visit on your device to tell new visitors from returning ones. Purpose: knowing how many people use the course and which lessons they reach. Legal basis: your consent.'],
    ['Optional: Google Analytics', 'If you allow it, Google Analytics records the pages you open, the exercises you solve, the modules you complete, your device and browser type and your approximate location, using Google cookies (_ga and _ga_*) for up to 13 months. Advertising features, Google signals and ad personalisation are off. Google stores the event data for 2 months. Purpose: understanding how learners move through the course and where they get stuck. Legal basis: your consent. The provider is Google (Google Ireland Limited for people in the EEA and UK, and Google LLC in the United States).'],
    ['Ratings and feedback', 'When you complete a module we ask for a star rating and, optionally, what would help most. Only if you click, the stars and your choice (for example "rating/m04/4") are sent to GoatCounter as an anonymous count, with no name, text or progress; this is separate from the optional tools above because you send it yourself. We remember on your device which modules you rated, so we do not ask twice. If you email us from the Feedback page, we receive your email address and message; we use them only to reply and to improve the course, keep them no longer than needed, and delete them on request.'],
    ['International transfers', 'Google may process data in the United States. Google LLC is certified under the EU-US Data Privacy Framework and offers standard contractual clauses. Under the NDPA, transfers outside Nigeria rely on your consent and these safeguards. If you prefer, choose Reject all and nothing is sent.'],
    ['What we never collect', 'Your name, email or phone number (unless you choose to email us), the SQL you write, your answers, or your progress. We do not sell data, show ads or share data with anyone apart from the two tools above.'],
    ['Your rights', 'Under the GDPR and the Nigeria Data Protection Act you can ask to access, correct or delete personal data, object to or restrict its use, and withdraw consent at any time. Withdrawing is as easy as giving: open Privacy in the menu, change the switches and save. Switching a tool off stops it at once and deletes what it stored on your device. Because we hold no names or emails, we usually cannot link analytics records to you; email ' + PRIVACY.contact + ' and we will help as far as we can.'],
    ['Complaints', 'You can complain to the Nigeria Data Protection Commission (ndpc.gov.ng), to the data protection authority in your EU or EEA country, or in the UK to the Information Commissioner’s Office (ico.org.uk). We would appreciate the chance to put things right first.'],
    ['Children', 'GageQuery is intended for learners aged 16 and over. If you are younger, ask a parent or guardian before allowing the optional tools. The course works fully without them.'],
    ['Changes to this notice', 'If we change what the optional tools collect, we will update this page and ask for your choice again. Your choice is also asked again after 12 months.']
  ];
  S1.forEach(function (s) { p.appendChild(h('h2', { text: s[0] })); p.appendChild(h('p', { text: s[1] })); });
  return p;
}

/* ================================================================ learner feedback
   Star ratings appear once, when a module is complete. A rating and the optional "what would help" choice are sent only
   when the learner clicks, as anonymous GoatCounter events (rating/m04/4, help/m04/more-examples): no name, no text, no
   progress. Ratings are kept on the device so we do not ask twice. Longer comments go by email from the Feedback page. */
var RATINGS_KEY = 'gagequery-ratings';
var HELP_OPTIONS = [['more-examples', 'More examples'], ['clearer-explanations', 'Clearer explanations'], ['easier-exercises', 'Easier exercises'],
  ['harder-exercises', 'Harder exercises'], ['a-short-video', 'A short video'], ['nothing', 'Nothing, it was great']];
var feedbackAbout = null;   // the module or exercise the learner was on when they chose to send feedback

function ratings() { try { var r = JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}'); return r && typeof r === 'object' && !Array.isArray(r) ? r : {}; } catch (e) { return {}; } }
function saveRating(modId, patch) {
  var r = ratings(), cur = r[modId] || {};
  for (var k in patch) cur[k] = patch[k];
  cur.at = Date.now(); r[modId] = cur;
  try { localStorage.setItem(RATINGS_KEY, JSON.stringify(r)); } catch (e) {}
}

function ratingCard(m) {
  var card = h('section', { class: 'rate', 'aria-label': 'Rate ' + modName(m) });
  card.appendChild(h('p', { class: 'rate-q' }, h('b', { text: 'How was ' + modName(m) + ': ' + m.title + '?' })));
  var stars = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Your rating, 1 to 5 stars' });
  var after = h('div', { class: 'rate-after' });
  function choose(n) {
    Array.prototype.forEach.call(stars.children, function (b, i) { b.classList.toggle('on', i < n); b.setAttribute('aria-checked', i + 1 === n ? 'true' : 'false'); b.disabled = true; });
    saveRating(m.id, { stars: n });
    Analytics.feedback('rating/' + m.id + '/' + n);
    GA.event('module_rating', { module_id: m.id, stars: n });
    after.innerHTML = '';
    after.appendChild(h('p', { class: 'muted sm', text: 'Thank you! What would help most? (optional)' }));
    var chips = h('div', { class: 'chips' });
    HELP_OPTIONS.forEach(function (o) {
      chips.appendChild(h('button', { class: 'chip', type: 'button', text: o[1], onclick: function () {
        saveRating(m.id, { help: o[0] });
        Analytics.feedback('help/' + m.id + '/' + o[0]);
        GA.event('module_help', { module_id: m.id, help: o[0] });
        after.innerHTML = '';
        after.appendChild(h('p', { class: 'muted sm' }, h('span', { text: 'Thanks, that helps us improve ' + modName(m) + '. Want to say more? ' }),
          h('a', { href: '#feedback', text: 'Send us a message', onclick: function () { feedbackAbout = { mod: m }; } })));
      } }));
    });
    after.appendChild(chips);
  }
  for (var i = 1; i <= 5; i++) (function (n) {
    stars.appendChild(h('button', { class: 'star', type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': n + (n === 1 ? ' star' : ' stars'), title: n + (n === 1 ? ' star' : ' stars'), text: '★', onclick: function () { choose(n); } }));
  })(i);
  card.appendChild(stars);
  card.appendChild(after);
  card.appendChild(h('p', { class: 'muted sm rate-note', text: 'Sent anonymously: only the stars and your choice, never your name or progress.' }));
  return card;
}
function wantsRating(m) { return modComplete(m) && !ratings()[m.id]; }

function feedbackMail(about, kind) {
  var label = about && about.ex ? modName(about.ex.mod) + ', ' + exName(about.ex) : about && about.mod ? modName(about.mod) + ': ' + about.mod.title : 'General';
  var subject = 'GageQuery feedback: ' + label;
  var body = (kind === 'problem'
    ? 'What were you trying to do?\n\n\nWhat happened instead?\n\n\n'
    : 'What would you like to tell us?\n\n\n') +
    '--\nAbout: ' + label + (about && about.ex ? ' (' + about.ex.id + ')' : '') + '\nDataset: ' + DSETS[curDs()].name +
    '\n(You can delete these lines. Please do not include passwords or personal details.)';
  return 'mailto:' + PRIVACY.contact + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

function viewFeedback() {
  var p = page('prose');
  p.appendChild(h('div', { class: 'eyebrow', text: 'Feedback' }));
  p.appendChild(h('h1', { text: 'Tell us what you think' }));
  p.appendChild(h('p', { class: 'lede', text: 'Found a mistake, got stuck, or have an idea for a lesson? We read every message, and it shapes what we fix and build next.' }));
  var about = feedbackAbout; feedbackAbout = null;
  var sel = h('select', { id: 'fb-about', 'aria-label': 'What is your message about?' });
  sel.appendChild(h('option', { value: '', text: 'General feedback' }));
  if (about && about.ex) sel.appendChild(h('option', { value: 'ex:' + about.ex.id, text: modName(about.ex.mod) + ', ' + exName(about.ex), selected: true }));
  MODS.forEach(function (m) { sel.appendChild(h('option', { value: 'mod:' + m.id, text: modName(m) + ': ' + m.title, selected: !!(about && !about.ex && about.mod === m) })); });
  var kind = h('select', { id: 'fb-kind', 'aria-label': 'Kind of message' },
    h('option', { value: 'idea', text: 'An idea or comment' }), h('option', { value: 'problem', text: 'Something is wrong or confusing', selected: !!(about && about.ex) }));
  var mail = h('a', { class: 'btn primary', id: 'fb-mail', text: 'Write an email' });
  function current() { var v = sel.value; return v.indexOf('ex:') === 0 ? { ex: EX_BY_ID[v.slice(3)] } : v.indexOf('mod:') === 0 ? { mod: MOD_BY_ID[v.slice(4)] } : null; }
  function refresh() { mail.setAttribute('href', feedbackMail(current(), kind.value)); }
  sel.addEventListener('change', refresh); kind.addEventListener('change', refresh); refresh();
  var copy = h('button', { class: 'btn', type: 'button', text: 'Copy email address', onclick: function () { copyText(PRIVACY.contact, copy); } });
  p.appendChild(h('div', { class: 'panel fb-form' },
    h('label', { for: 'fb-about', class: 'lbl', text: 'What is it about?' }), sel,
    h('label', { for: 'fb-kind', class: 'lbl', text: 'What kind of message?' }), kind,
    h('div', { class: 'actions' }, mail, copy),
    h('p', { class: 'muted sm', html: 'This opens your email app with a short template. No email app? Write to <b>' + esc(PRIVACY.contact) + '</b> from any email service.' })));
  p.appendChild(h('h2', { text: 'Quick ratings' }));
  p.appendChild(h('p', { text: 'When you complete a module, we ask for a star rating and what would help most. It takes one tap and is sent anonymously. You can also rate any module you have completed here:' }));
  var done = MODS.filter(function (m) { return modComplete(m); });
  if (!done.length) p.appendChild(h('p', { class: 'muted', text: 'Complete a module to rate it.' }));
  done.forEach(function (m) { var r = ratings()[m.id]; p.appendChild(r ? h('p', { class: 'muted', text: modName(m) + ': you rated it ' + '★'.repeat(r.stars || 0) + '☆'.repeat(5 - (r.stars || 0)) + '. Thank you.' }) : ratingCard(m)); });
  p.appendChild(h('h2', { text: 'What happens to your message' }));
  p.appendChild(h('p', { text: 'Emails go to the GageQuery inbox. We use them only to reply and to improve the course, never for marketing, and we delete them on request. See the privacy notice for details.' }));
  return p;
}

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
    function attempt() { return call({ cmd: 'open', ds: ds, sql: DSETS[ds].sql }, 30000).then(function (r) { if (r.error) throw new Error(r.error); return r; }); }
    /* Some browsers give a background worker a much smaller call stack, or restrict it. If the worker cannot start the
       engine, retry once on the main page, where the stack is larger. */
    opened[ds] = attempt().catch(function (err) { if (mode === 'worker') { fallback(); return attempt(); } throw err; })
      .catch(function (err) { delete opened[ds]; throw err; });
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
  if (isScript(v)) return '-- Write your SQL here. The checker runs it on a fresh copy of the data,\n-- then checks the result as described under "How it is checked".\n';
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
  /* structural mistakes: compare the shape of the learner's query with the model answer */
  var M = solution.replace(/--[^\n]*/g, ''), kind = cmp && cmp.kind, rowsOff = kind === 'values' || kind === 'extra' || kind === 'missing' || kind === 'duplicates';
  function both(re) { return re.test(M) && !re.test(L); }
  var joins = (L.match(/\bJOIN\b/gi) || []).length - (L.match(/\bCROSS\s+JOIN\b/gi) || []).length, ons = (L.match(/\b(ON|USING)\b/gi) || []).length;
  if (joins > ons) tips.push('A JOIN is missing its <code>ON</code> condition, so every row was paired with every row of the other table. Add <code>ON a.key = b.key</code> to each JOIN.');
  if (rowsOff && both(/\bGROUP\s+BY\b/i) && /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(L) && !/\bOVER\s*\(/i.test(L)) tips.push('The answer has one row per group, but your query has no <code>GROUP BY</code>, so the totals were squeezed into one row. Add GROUP BY with every column that is not inside COUNT, SUM or AVG. A MySQL server would reject this query.');
  if (kind === 'extra' && both(/\bWHERE\b/i)) tips.push('The answer leaves some rows out. Find the condition in the task and add a <code>WHERE</code> clause.');
  if (kind === 'extra' && both(/\bHAVING\b/i)) tips.push('The answer keeps only some of the groups. Filter groups after GROUP BY with <code>HAVING</code>.');
  if (kind === 'extra' && both(/\bLIMIT\b/i)) tips.push('The task asks for the top rows only. Sort with ORDER BY, then add <code>LIMIT</code>.');
  if (kind === 'order' && !/\bORDER\s+BY\b/i.test(L)) tips.push('Your query has no <code>ORDER BY</code>, so rows come back in whatever order is quickest. Add ORDER BY with the sort the task asks for.');
  else if (kind === 'order' && both(/\bDESC\b/i)) tips.push('The task wants the highest values first. Add <code>DESC</code> after that column in ORDER BY.');
  if (rowsOff && both(/\bCOUNT\s*\(\s*DISTINCT\b/i) && /\bCOUNT\s*\(/i.test(L)) tips.push('A join can repeat the same id, so <code>COUNT(column)</code> counts it more than once. Try <code>COUNT(DISTINCT column)</code>.');
  if (kind && kind !== 'columns' && kind !== 'no-rows' && both(/\bOVER\s*\(/i)) tips.push('This task needs a window function, such as <code>RANK() OVER (...)</code>, <code>LAG(...) OVER (...)</code> or <code>SUM(...) OVER ()</code>.');
  if (rowsOff && both(/\bTRIM\s*\(/i)) tips.push('Some values have spaces at the start or end. Wrap them in <code>TRIM()</code> before you compare or group them.');
  if (rowsOff && both(/\b(LOWER|UPPER)\s*\(/i)) tips.push('The same value is typed in different cases. Compare <code>LOWER(...)</code> of both sides, or group on it.');
  return tips.slice(0, 3);
}
/* What is already right: one line per check, so a near miss does not look like a total failure. */
function checklist(mine, exp, cmp) {
  var out = [], ok = mine.cols.length === exp.cols.length;
  out.push({ ok: ok, text: ok ? 'Right number of columns (' + exp.cols.length + ')' : exp.cols.length + ' columns expected, yours has ' + mine.cols.length });
  if (!ok) return out;
  var rows = mine.total === exp.total;
  out.push({ ok: rows, text: rows ? 'Right number of rows (' + exp.total + ')' : exp.total + ' rows expected, yours has ' + mine.total });
  var cols = exp.cols.map(function (c, i) {
    var a = mine.rows.map(function (r) { return key([r[i]]); }).sort(), b = exp.rows.map(function (r) { return key([r[i]]); }).sort();
    return { name: mine.cols[i], ok: a.length === b.length && a.every(function (x, j) { return x === b[j]; }) };
  });
  out.push({ ok: cols.every(function (c) { return c.ok; }), cols: cols });
  if (cmp.kind === 'order') out.push({ ok: false, text: 'The rows are right but in a different order' });
  return out;
}
function renderChecklist(items) {
  var ul = h('ul', { class: 'checklist', 'aria-label': 'What matches the answer' });
  items.forEach(function (it) {
    var li = h('li', { class: it.ok ? 'ok' : 'no' }, h('span', { class: 'ck', 'aria-hidden': 'true', text: it.ok ? '✓' : '✗' }));
    if (it.cols) {
      li.appendChild(h('span', { class: 'sr-only', text: it.ok ? 'All column values match. ' : 'Some column values differ. ' }));
      li.appendChild(h('span', { text: 'Column values: ' }));
      it.cols.forEach(function (c) { li.appendChild(h('code', { class: c.ok ? 'c-ok' : 'c-no', title: c.ok ? 'matches the answer' : 'differs from the answer', text: (c.ok ? '✓ ' : '✗ ') + c.name })); });
    } else li.appendChild(h('span', { text: it.text }));
    ul.appendChild(li);
  });
  return ul;
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
var PHASES = {1: 'Phase 1 \u00b7 Fundamentals', 2: 'Phase 2 \u00b7 Intermediate SQL and analytics', 3: 'Phase 3 \u00b7 Advanced SQL and optimisation', 4: 'Phase 4 \u00b7 Real-world analysis'};
var SHORT = { m00: 'Start here', m01: 'Getting started', m15: 'Creating tables', m02: 'Cleaning up results', m03: 'Summarising data', m04: 'Joins', m05: 'Subqueries',
  m06: 'CTEs and set operations', m07: 'Ranking windows', m08: 'Time-series windows', m09: 'Pivots, dates, strings', m10: 'Views and procedures',
  m11: 'Indexes and tuning', m12: 'Transactions', m13: 'Data cleaning', m14: 'Capstone' };   // keyed by id: numbers come from course order
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
  if (txt) txt.textContent = done + '/' + ALL_EX.length + ' solved \u00b7 ' + xp() + ' XP';
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
    rail.appendChild(link(m.id, h('span', { class: 'rl' }, h('b', { text: m.capstone ? '★' : m.number }), h('span', { text: SHORT[m.id] || m.title.split(':')[0] })), h('span', { class: 'cnt' + (n === m.exercises.length ? ' full' : ''), text: (n === m.exercises.length ? '✓ ' : '') + n + '/' + m.exercises.length })));
  });
  rail.appendChild(h('div', { class: 'rail-sec', text: 'Practice' }));
  rail.appendChild(link('practice', 'Practice arena'));
  rail.appendChild(link('playground', 'Playground'));
  rail.appendChild(link('progress', 'My progress'));
  rail.appendChild(link('about', 'How it works'));
  rail.appendChild(link('feedback', 'Feedback'));
  rail.appendChild(link('privacy', 'Privacy'));
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

function datasetGrid(ds) {
  var grid = h('div', { class: 'ds-grid' });
  ORDER.forEach(function (id) {
    var d = DSETS[id], on = id === ds;
    grid.appendChild(h('button', { class: 'ds-card' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick: function () { setDs(id); } },
      h('span', { class: 'ds-sector', text: d.sector + (on ? ' · in use' : '') }), h('b', { text: d.name }), h('span', { class: 'ds-story', text: d.story.split('. ')[0] + '.' }),
      h('span', { class: 'ds-meta', text: Object.keys(d.rowCounts).length + ' tables · ' + Object.values(d.rowCounts).reduce(function (a, b) { return a + b; }, 0).toLocaleString() + ' rows' })));
  });
  return grid;
}

function welcomePanel(next) {
  var done = ALL_EX.filter(function (e) { return isDone(e.id); }).length, pct = Math.round(100 * done / ALL_EX.length);
  var lv = level(), st = streaks(), review = reviewQueue().filter(function (it) { return it.w >= 2; }).length;
  var main = h('div', { class: 'welcome-main' });
  if (next) {
    main.appendChild(h('span', { class: 'lbl', text: 'Up next · ' + modName(next.mod) + ' · ' + exName(next) }));
    main.appendChild(h('h2', { text: next.mod.title }));
    main.appendChild(h('p', { class: 'next-task', html: md(next.v[curDs()].task) }));
    main.appendChild(h('div', { class: 'actions' },
      h('a', { class: 'btn primary lg', href: '#' + next.id, text: 'Continue with ' + exName(next).toLowerCase() }),
      review ? h('a', { class: 'btn lg', href: '#practice', text: 'Review ' + review + ' tricky exercise' + (review === 1 ? '' : 's') }) : h('a', { class: 'btn lg', href: '#' + next.mod.id, text: 'Open ' + modName(next.mod) })));
  } else {
    main.appendChild(h('span', { class: 'lbl', text: 'Course complete' }));
    main.appendChild(h('h2', { text: 'You have solved every exercise.' }));
    main.appendChild(h('p', { class: 'next-task', text: 'Keep your skills sharp in the practice arena, or try the exercises again on a different dataset.' }));
    main.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary lg', href: '#practice', text: 'Open the practice arena' }), h('a', { class: 'btn lg', href: '#progress', text: 'See your progress' })));
  }
  var lvPct = lv.to ? Math.round(100 * (lv.xp - lv.from) / (lv.to - lv.from)) : 100;
  var side = h('div', { class: 'welcome-side' },
    h('div', { class: 'ring-row' }, h('span', { class: 'ring', style: '--p:' + pct, role: 'img', 'aria-label': pct + ' percent of the course solved', text: pct + '%' }),
      h('div', null, h('b', { text: done + ' of ' + ALL_EX.length + ' exercises' }), h('div', { class: 'muted sm', text: 'solved across ' + MODS.length + ' modules' }))),
    h('div', { class: 'kv' }, h('span', { text: 'Level ' + lv.n + ' · ' + lv.name }), h('b', { text: lv.xp + ' XP' })),
    h('span', { class: 'bar', role: 'progressbar', 'aria-label': 'Progress to the next level', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(lvPct) }, h('i', { style: 'width:' + lvPct + '%' })),
    h('div', { class: 'kv' }, h('span', { text: 'Daily streak' }), h('b', { text: st.daily + (st.daily === 1 ? ' day' : ' days') })),
    h('div', { class: 'kv' }, h('span', { text: 'Dataset' }), h('a', { href: '#datasets', text: DSETS[curDs()].name })));
  return h('section', { class: 'welcome', 'aria-label': 'Your progress' }, main, side);
}

function viewHome() {
  var p = page('home');
  var ds = curDs();
  var next = nextExercise();
  var started = ALL_EX.some(function (e) { return exState(e.id) !== 'new'; });
  if (started) {
    p.appendChild(h('div', { class: 'eyebrow', text: 'Your dashboard' }));
    p.appendChild(h('h1', { text: 'Welcome back' }));
    p.appendChild(welcomePanel(next));
    p.appendChild(h('div', { class: 'section-head' }, h('h2', { text: 'Your dataset' }), h('span', { class: 'sp' }), h('a', { href: '#datasets', text: 'Compare datasets' })));
    p.appendChild(h('p', { class: 'muted', text: 'Every example and exercise exists on every dataset, so switching gives you fresh practice with the same skills.' }));
    p.appendChild(datasetGrid(ds));
    return p;
  }
  p.appendChild(h('section', { class: 'hero' },
    h('div', { class: 'eyebrow', text: 'SQL course from first query to capstone · MySQL syntax' }),
    h('h1', { text: 'Learn SQL on data you actually care about.' }),
    h('p', { class: 'lede', text: 'Pick a sector, then read a short concept, run real examples and solve exercises against a real database in your browser. Every answer is checked by running it.' })));
  p.appendChild(h('div', { class: 'cta-row' },
    h('a', { class: 'btn primary lg', href: '#' + MODS[0].id, text: 'Start the course' }),
    h('a', { class: 'btn lg', href: '#playground', text: 'Try the playground' })));
  p.appendChild(h('ol', { class: 'steps', 'aria-label': 'How GageQuery works' },
    h('li', null, h('b', { text: 'Read a short concept' }), h('span', { text: 'Plain-English explanations of what each part of SQL does and when analysts use it.' })),
    h('li', null, h('b', { text: 'Run real examples' }), h('span', { text: 'Edit and run every query against a real database. Nothing you do can break it.' })),
    h('li', null, h('b', { text: 'Solve business questions' }), h('span', { text: 'Every answer is checked by running it, with hints when you are stuck.' }))));
  p.appendChild(h('h2', { text: '1. Choose your dataset' }));
  p.appendChild(h('p', { class: 'muted', text: 'Every example and exercise exists on every dataset. You can switch at any time from the top bar.' }));
  p.appendChild(datasetGrid(ds));
  p.appendChild(h('h2', { text: '2. Run your first query' }));
  var first = { sales: 'SELECT * FROM customers LIMIT 5;', sport: 'SELECT * FROM players LIMIT 5;', fashion: 'SELECT * FROM products LIMIT 5;', politics: 'SELECT * FROM parties;', finance: 'SELECT * FROM loans LIMIT 5;', healthcare: 'SELECT * FROM doctors LIMIT 5;' }[ds];
  p.appendChild(runCell({ sql: first, explanation: 'Press Run (or ' + MOD_KEY + ' + Enter). SELECT * means "every column", FROM names the table, and LIMIT 5 keeps the first five rows.' }, ds, { autorun: true }));
  p.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#' + MODS[0].id, text: 'Next: start Module 0' })));
  return p;
}

function viewMap() {
  var p = page();
  p.appendChild(h('div', { class: 'eyebrow', text: 'Course map' }));
  p.appendChild(h('h1', { text: 'From your first query to a business review' }));
  p.appendChild(h('p', { class: 'lede', text: 'Each module has short concepts, runnable examples and graded exercises that go from Easy to Hard. A module is complete when its Easy and Medium exercises are solved. The capstone puts everything together in one business review on your dataset.' }));
  var done = ALL_EX.filter(function (e) { return isDone(e.id); }).length, nx = nextExercise();
  p.appendChild(h('div', { class: 'overall panel' },
    h('b', { text: done + ' of ' + ALL_EX.length + ' exercises solved' }),
    h('span', { class: 'bar', role: 'progressbar', 'aria-label': 'Course progress', 'aria-valuemin': '0', 'aria-valuemax': String(ALL_EX.length), 'aria-valuenow': String(done) }, h('i', { style: 'width:' + (100 * done / ALL_EX.length) + '%' })),
    nx ? h('a', { class: 'btn primary', href: '#' + nx.id, text: (done ? 'Continue: ' : 'Start: ') + modName(nx.mod) + ', ' + exName(nx).toLowerCase() }) : h('a', { class: 'btn', href: '#progress', text: 'See your progress' })));
  Object.keys(PHASES).forEach(function (n) {
    var mods = MODS.filter(function (m) { return m.phase === +n; });
    p.appendChild(h('h2', { text: PHASES[n] }));
    var g = h('div', { class: 'mod-grid' });
    mods.forEach(function (m) {
      var k = modDone(m), st = modStatus(m);
      g.appendChild(h('a', { class: 'mod-card' + (st.key === 'done' ? ' done' : '') + (st.key === 'next' ? ' upnext' : '') + (m.capstone ? ' cap' : ''), href: '#' + m.id },
        h('span', { class: 'mod-top' }, h('span', { class: 'mod-num', text: (m.capstone ? '★ ' : '') + modName(m) }), statusChip(m)),
        h('b', { text: m.title }),
        h('span', { class: 'muted sm', text: hoursText(m) + ' · ' + (m.examples.length ? m.examples.length + ' examples · ' : '') + m.exercises.length + (m.capstone ? ' tasks' : ' exercises') }),
        h('span', { class: 'mod-meta' },
          h('span', { class: 'bar' }, h('i', { style: 'width:' + (100 * k / m.exercises.length) + '%' })),
          h('span', { class: 'muted sm', text: k + ' of ' + m.exercises.length + ' solved' }))));
    });
    p.appendChild(g);
  });
  return p;
}

var tabMemory = {};
function viewModule(m, tab) {
  var p = page();
  var ds = curDs();
  p.appendChild(h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#learn', text: 'Course map' }), ' › ', h('span', { text: modName(m) })));
  p.appendChild(h('div', { class: 'eyebrow', text: PHASES[m.phase].split(' · ')[0] + ' · ' + modName(m) + ' · ' + hoursText(m) }));
  p.appendChild(h('h1', { text: m.title }));
  p.appendChild(h('span', { class: 'lbl', text: 'By the end you can' }));
  var ul = h('ul', { class: 'objectives' }); m.objectives.forEach(function (o) { ul.appendChild(h('li', { text: o })); });
  p.appendChild(ul);
  /* where the learner stands in this module, and the one thing to do next */
  var k = modDone(m), todo = m.exercises.filter(function (e) { return !isDone(e.id); })[0], nextMod = MODS[MODS.indexOf(m) + 1];
  var started = m.exercises.some(function (e) { return exState(e.id) !== 'new'; });
  if (modComplete(m)) {
    p.appendChild(h('div', { class: 'banner', role: 'status' }, h('b', { text: '✓ ' + modName(m) + ' complete.' }),
      h('span', { text: todo ? 'The Hard ' + (m.capstone ? 'task' : 'exercise') + ' is optional, and earns 200 XP.' : 'Every ' + (m.capstone ? 'task' : 'exercise') + ' solved.' }), h('span', { class: 'sp' }),
      todo ? h('a', { class: 'btn sm', href: '#' + todo.id, text: 'Try ' + exName(todo).toLowerCase() }) : null,
      nextMod ? h('a', { class: 'btn primary sm', href: '#' + nextMod.id, text: 'Next: ' + modName(nextMod) + ' →' }) : null));
    if (wantsRating(m)) p.appendChild(ratingCard(m));
  } else {
    p.appendChild(h('div', { class: 'mod-progress' }, statusChip(m),
      h('span', { class: 'bar', role: 'progressbar', 'aria-label': modName(m) + ' progress', 'aria-valuemin': '0', 'aria-valuemax': String(m.exercises.length), 'aria-valuenow': String(k) }, h('i', { style: 'width:' + (100 * k / m.exercises.length) + '%' })),
      h('span', { class: 'muted', text: k + ' of ' + m.exercises.length + ' solved' }),
      h('a', { class: 'btn primary sm', href: '#' + todo.id, text: (started ? 'Continue with ' : 'Start with ') + exName(todo).toLowerCase() })));
  }
  tab = tab || tabMemory[m.id] || 'concepts';
  if (tab === 'examples' && !m.examples.length) tab = 'exercises';
  tabMemory[m.id] = tab;
  var tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Module sections' }), step = 0;
  [['concepts', 'Concepts', m.concepts.length], ['examples', 'Examples', m.examples.length], ['exercises', m.capstone ? 'Tasks' : 'Exercises', m.exercises.length]].filter(function (t) { return t[2]; }).forEach(function (t) {
    tabs.appendChild(h('a', { class: 'tab', role: 'tab', href: '#' + m.id + '-' + t[0], 'aria-selected': t[0] === tab ? 'true' : 'false' }, h('span', { class: 'step', 'aria-hidden': 'true', text: ++step }), t[1], h('span', { class: 'ct', text: t[2] })));
  });
  p.appendChild(tabs);
  var body = h('div', { class: 'stack' });
  if (tab === 'concepts') {
    m.concepts.forEach(function (c) { body.appendChild(h('article', { class: 'concept' }, h('h3', { html: md(c.term) }), h('p', { class: 'what', html: md(c.what) }), c.whenWhy ? h('p', { class: 'why', html: '<b>When and why:</b> ' + md(c.whenWhy) }) : null, c.syntax ? h('pre', { class: 'syntax', text: c.syntax }) : null)); });
    if (m.dialects && m.dialects.length) {
      body.appendChild(h('h2', { class: 'dialect-head', text: 'In other databases' }));
      body.appendChild(h('p', { class: 'muted', text: 'You practise MySQL here. At work you may meet PostgreSQL or SQL Server. Most SQL is the same in all three, but these commands differ. Read them; you do not need to install anything.' }));
      m.dialects.forEach(function (d) {
        var grid = h('div', { class: 'dialect-grid' });
        [['MySQL', d.mysql], ['PostgreSQL', d.postgres], ['SQL Server', d.sqlserver]].forEach(function (x) { grid.appendChild(h('div', null, h('span', { class: 'lbl', text: x[0] }), h('pre', { class: 'syntax', text: x[1] }))); });
        body.appendChild(h('article', { class: 'concept dialect' }, h('h3', { text: d.topic }), grid, d.note ? h('p', { class: 'why', text: d.note }) : null));
      });
    }
    body.appendChild(h('div', { class: 'actions' }, m.examples.length ? h('a', { class: 'btn primary', href: '#' + m.id + '-examples', text: 'Next: run the examples' }) : h('a', { class: 'btn primary', href: '#' + m.id + '-exercises', text: m.capstone ? 'Next: start the review' : 'Next: try the exercises' })));
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
    body.appendChild(h('p', { class: 'muted', text: m.capstone ? 'Each task is one question from the business review. Choose the tables and joins yourself; every answer is checked by running it.' : 'Work through them in order. Easy and Medium complete the module; Hard is a stretch.' }));
    m.exercises.forEach(function (e) {
      var v = e.v[ds];
      body.appendChild(h('a', { class: 'ex-card', href: '#' + e.id },
        h('div', { class: 'ex-top' }, h('b', { text: exName(e) }), badge(e.level), h('span', { class: 'xp-tag', text: XP[e.level] + ' XP' }), h('span', { class: 'sp' }), stateChip(e.id)),
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
  cell.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: run, text: 'Run' }), h('button', { class: 'btn ghost', type: 'button', onclick: function () { ed.set(item.sql); out.innerHTML = ''; }, text: 'Reset code' }), h('span', { class: 'kbd', text: MOD_KEY + ' + Enter runs' })));
  cell.appendChild(out);
  if (item.tryIt) cell.appendChild(h('p', { class: 'try', html: '<b>Try it:</b> ' + md(item.tryIt) }));
  if (opts.autorun) setTimeout(run, 30);
  return cell;
}

/* ---------------------------------------------------------------- exercise workspace */
function emptyResult() { return h('p', { class: 'res-empty', text: 'Your result appears here. Run to preview it; when it looks right, press Check answer.' }); }
function viewExercise(ex) {
  var m = ex.mod, ds = curDs(), v = ex.v[ds];
  var p = page('wide');
  var modLbl = m.capstone ? 'Capstone' : 'Module ' + m.number, exWord = m.capstone ? 'Task ' : 'Exercise ';
  p.appendChild(h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#learn', text: 'Course map' }), ' \u203a ', h('a', { href: '#' + m.id + '-exercises', text: modLbl }), ' \u203a ', h('span', { text: exWord + ex.n })));
  var ws = h('div', { class: 'workspace' });
  /* task panel */
  var task = h('section', { class: 'task', 'aria-label': 'Task' });
  task.appendChild(h('div', { class: 'ex-top' }, h('b', { text: modLbl + ' \u00b7 ' + exWord + ex.n }), badge(ex.level), h('span', { class: 'xp-tag', text: XP[ex.level] + ' XP' }), h('span', { class: 'sp' }), stateChip(ex.id)));
  task.appendChild(h('p', { class: 'story', text: v.story }));
  task.appendChild(h('p', { class: 'task-text', html: md(v.task) }));
  var ret = h('div', { class: 'returns' });
  if (isScript(v)) {
    ret.appendChild(h('span', { class: 'lbl', text: 'How it is checked' }));
    if (v.verifyText) {   // plain words for beginners; the exact check query stays one click away
      ret.appendChild(h('p', { class: 'sm', text: 'Your SQL runs on a fresh copy of the data. Then GageQuery checks ' + v.verifyText + ', and compares it with what the model answer leaves behind.' }));
      ret.appendChild(h('details', { class: 'verify-more' }, h('summary', { text: 'Show the check query' }), h('pre', { class: 'skeleton verify', text: v.verify })));
    } else {
      ret.appendChild(h('p', { class: 'sm', text: 'Your SQL runs on a fresh copy of the data. Then this query runs, and its result must match what the model answer leaves behind:' }));
      ret.appendChild(h('pre', { class: 'skeleton verify', text: v.verify }));
    }
  } else {
    ret.appendChild(h('span', { class: 'lbl', text: 'Return these columns' }));
    var chips = h('div', { class: 'col-chips' }); v.cols.forEach(function (c) { chips.appendChild(h('code', { text: c })); });
    ret.appendChild(chips);
    ret.appendChild(h('span', { class: 'lbl', text: ex.orderMatters ? 'Order matters: sort as the task says' : 'Any order is fine' }));
  }
  var expBox = h('div', { class: 'expected', hidden: true });
  var expBtn = h('button', { class: 'btn ghost sm', type: 'button', 'aria-expanded': 'false', text: 'Show expected output', onclick: function () {
    if (!expBox.hidden) { expBox.hidden = true; expBtn.textContent = 'Show expected output'; expBtn.setAttribute('aria-expanded', 'false'); return; }
    expBox.hidden = false; expBtn.textContent = 'Hide expected output'; expBtn.setAttribute('aria-expanded', 'true');
    expBox.innerHTML = '<p class="muted sm">Running the model answer on a fresh copy…</p>';
    Engine.req(ds, { cmd: 'expected', solution: v.sql, pre: v.pre, verify: v.verify }, 6000).then(function (x) {
      expBox.innerHTML = '';
      if (x.error || !x.rows) { expBox.appendChild(h('p', { class: 'muted sm', text: 'The expected output is not available for this task.' })); return; }
      expBox.appendChild(h('p', { class: 'muted sm', text: (v.verify ? 'What the check query returns after a correct answer' : 'What a correct answer returns') + (x.total > 8 ? ' (first 8 of ' + x.total + ' rows).' : ' (' + x.total + ' row' + (x.total === 1 ? '' : 's') + ').') + ' Seeing it costs no XP.' }));
      expBox.appendChild(table(x.cols, x.rows.slice(0, 8)));
    });
  } });
  ret.appendChild(expBtn);
  task.appendChild(ret);
  task.appendChild(expBox);
  task.appendChild(h('p', { class: 'muted sm', text: 'Dataset: ' + dsLabel(ds) + ' \u00b7 concepts: ' + ex.concepts.join(', ') }));
  var hintsBox = h('div', { class: 'hints' });
  task.appendChild(hintsBox);
  var solBox = h('div');
  task.appendChild(solBox);
  var nav = h('div', { class: 'ex-nav' });
  var prev = m.exercises[ex.n - 2], next = m.exercises[ex.n];
  var nextMod = MODS[MODS.indexOf(m) + 1];
  if (prev) nav.appendChild(h('a', { class: 'btn ghost', href: '#' + prev.id, text: '\u2190 ' + exWord + prev.n }));
  nav.appendChild(h('span', { class: 'sp' }));
  if (next) nav.appendChild(h('a', { class: 'btn', href: '#' + next.id, text: exWord + next.n + ' \u2192' }));
  else if (nextMod) nav.appendChild(h('a', { class: 'btn', href: '#' + nextMod.id, text: (nextMod.capstone ? 'Capstone' : 'Module ' + nextMod.number) + ' \u2192' }));
  task.appendChild(h('p', { class: 'muted sm report' }, h('span', { text: 'Something wrong or confusing here? ' }), h('a', { href: '#feedback', text: 'Tell us', onclick: function () { feedbackAbout = { ex: ex }; } })));
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
  var out = h('div', { class: 'res', 'aria-live': 'polite' }, emptyResult());
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
    markActive();
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
      markActive();
      var wasDone = isDone(ex.id), xpBefore = xp(), modWasComplete = modComplete(m);
      if (exState(ex.id) === 'new') setState(ex.id, 'attempted');
      if (r.mine.error) { fb.innerHTML = ''; renderResult(out, r.mine); paintState(); return; }
      renderResult(out, r.mine);
      var cmp = compare(r.mine, r.expected, ex.orderMatters);
      if (cmp.ok && rule) cmp = { ok: false, kind: 'rule', msg: rule };
      fb.innerHTML = '';
      if (cmp.ok) {
        var st = S.helped[ex.id] ? 'helped' : 'solved';
        setState(ex.id, st);
        if (wasDone) { S.reviewed[ex.id] = Date.now(); save(); }
        var gained = xp() - xpBefore;
        var box = h('div', { class: 'fb ok', role: 'status' }, h('p', { class: 'fb-title', text: (v.verify ? 'Correct. The data after your SQL matches the model answer.' : 'Correct. Your ' + r.mine.total + (r.mine.total === 1 ? ' row matches' : ' rows match') + ' the answer exactly.') + (gained ? ' +' + gained + ' XP' : wasDone ? ' Reviewed.' : '') }));
        if (cmp.namesDiffer && !v.verify) box.appendChild(h('p', { text: 'Your column names differ from the suggested ones (' + v.cols.join(', ') + '). The values are right; matching names makes reports easier to share.' }));
        box.appendChild(h('p', { html: md(ex.explain) }));
        if (st === 'helped') box.appendChild(h('p', { class: 'muted sm', text: 'Marked as solved with help because the solution was shown. It earns half the XP.' }));
        if (!modWasComplete && modComplete(m)) {
          box.appendChild(h('p', { class: 'done-line', text: '\u2713 That completes ' + modName(m) + ': ' + m.title + '.' }));
          if (wantsRating(m)) box.appendChild(ratingCard(m));
        }
        var nx = next || (nextMod && nextMod.exercises[0]);
        if (nx) box.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#' + (next ? next.id : nextMod.id), text: next ?'Next: ' + exName(next).toLowerCase() + ' \u2192' : 'Next: ' + modName(nextMod) + ' \u2192' })));
        else box.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#progress', text: 'See your progress' })));
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
        if (!v.verify && r.mine.rows && cmp.kind !== 'rule') bx.appendChild(renderChecklist(checklist(r.mine, r.expected, cmp)));
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
    var before = ed.all(); ed.set(starter(ex, ds)); fb.innerHTML = ''; out.innerHTML = ''; out.appendChild(emptyResult());
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
  var resetBtn = h('button', { class: 'btn ghost sm', type: 'button', text: 'Reset', 'aria-haspopup': 'true', onclick: function () { resetMenu.hidden = !resetMenu.hidden; } });
  var schemaBtn = h('button', { class: 'btn ghost sm', type: 'button', text: 'Schema', 'aria-expanded': 'false', onclick: function () { toggleSchema(schemaBox, schemaBtn, ds, function (txt) { ed.cm.replaceSelection(txt); ed.focus(); }); } });
  /* three groups: do (run, check), get help (hint, solution), tools (format, schema, reset) */
  var bar = h('div', { class: 'actions action-bar', role: 'toolbar', 'aria-label': 'Exercise actions' },
    h('button', { class: 'btn strong', type: 'button', onclick: run, text: 'Run', title: 'Run your query to preview the result (' + MOD_KEY + '+Enter)' }),
    h('button', { class: 'btn primary', type: 'button', onclick: check, text: 'Check answer', title: 'Compare your result with the answer (' + MOD_KEY + '+Shift+Enter)' }),
    h('span', { class: 'bar-sep', 'aria-hidden': 'true' }),
    hintBtn, solBtn,
    h('span', { class: 'bar-sep', 'aria-hidden': 'true' }),
    h('button', { class: 'btn ghost sm', type: 'button', text: 'Format', title: 'Tidy the layout of your SQL (Shift+Alt+F)', onclick: function () { ed.set(formatSql(ed.all())); } }),
    schemaBtn,
    h('span', { class: 'reset-wrap' }, resetBtn, resetMenu));
  work.appendChild(h('div', { class: 'work-head' }, h('span', { class: 'lbl', text: 'Your SQL' }), h('span', { class: 'kbd', text: 'Run ' + MOD_KEY + '+Enter \u00b7 Check ' + MOD_KEY + '+Shift+Enter \u00b7 Hint Alt+H' })));
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

function levelCard(lv) {
  var pct = lv.to ? Math.round(100 * (lv.xp - lv.from) / (lv.to - lv.from)) : 100;
  return h('div', { class: 'level-card' },
    h('div', { class: 'level-top' }, h('span', { class: 'lbl', text: 'Level ' + lv.n }), h('b', { text: lv.name }), h('span', { class: 'sp' }), h('span', { class: 'muted sm', text: lv.xp + ' XP' })),
    h('span', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Progress to the next level' }, h('i', { style: 'width:' + pct + '%' })),
    h('span', { class: 'muted sm', text: lv.to ? (lv.to - lv.xp) + ' XP to ' + lv.nextName + '. Easy 50 · Medium 100 · Hard 200; half if you used the solution.' : 'Top level reached.' }));
}

var SKILLS = [['Basics', ['m00', 'm01', 'm02']], ['Aggregation', ['m03']], ['Joins', ['m04']], ['Subqueries and CTEs', ['m05', 'm06']],
  ['Window functions', ['m07', 'm08']], ['Dates, text, pivots', ['m09']], ['Design and tuning', ['m10', 'm11', 'm12']], ['Data cleaning', ['m13']]];
function skillScores() {
  return SKILLS.map(function (s) {
    var t = 0, n = 0;
    s[1].forEach(function (id) { var m = MOD_BY_ID[id]; if (m) m.exercises.forEach(function (e) { var st = exState(e.id); t += st === 'solved' ? 1 : st === 'helped' ? 0.5 : st === 'attempted' ? 0.15 : 0; n++; }); });
    return { name: s[0], pct: n ? Math.round(100 * t / n) : 0 };
  });
}
function radar(scores) {
  var cx = 280, cy = 160, R = 112, n = scores.length, out = '';
  function pt(i, r) { var a = -Math.PI / 2 + 2 * Math.PI * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  [25, 50, 75, 100].forEach(function (lvl) { out += '<polygon class="r-ring" points="' + scores.map(function (s, i) { return pt(i, R * lvl / 100).join(','); }).join(' ') + '"/>'; });
  scores.forEach(function (s, i) {
    var e = pt(i, R), l = pt(i, R + 16), anchor = Math.abs(l[0] - cx) < 4 ? 'middle' : l[0] > cx ? 'start' : 'end';
    out += '<line class="r-axis" x1="' + cx + '" y1="' + cy + '" x2="' + e[0] + '" y2="' + e[1] + '"/>';
    out += tx(l[0].toFixed(1), (l[1] + 5).toFixed(1), s.name, { cls: 'r-lbl', anchor: anchor });
  });
  out += '<polygon class="r-area" points="' + scores.map(function (s, i) { return pt(i, R * Math.max(s.pct, 2) / 100).join(','); }).join(' ') + '"/>';
  scores.forEach(function (s, i) { var q = pt(i, R * Math.max(s.pct, 2) / 100); out += '<circle class="r-dot" cx="' + q[0] + '" cy="' + q[1] + '" r="3.5"/>'; });
  var label = 'Skills radar. ' + scores.map(function (s) { return s.name + ' ' + s.pct + ' percent'; }).join(', ') + '.';
  var fig = h('figure', { class: 'viz radar', html: svgEl(560, 320, out, label) });
  var list = h('div', { class: 'mastery skill-list' });
  scores.forEach(function (s) { list.appendChild(h('div', { class: 'm-row' }, h('span', { text: s.name }), h('span', { class: 'bar' }, h('i', { style: 'width:' + s.pct + '%' })), h('span', { class: 'num', text: s.pct + '%' }))); });
  fig.appendChild(list);
  return fig;
}

function reviewQueue() {
  var now = Date.now(), DAY = 864e5, items = [];
  MODS.forEach(function (m) {
    if (!m.exercises.some(function (e) { return exState(e.id) !== 'new'; })) return;
    m.exercises.forEach(function (e) {
      var s = exState(e.id), at = (S.progress[e.id] || {}).at || 0, last = Math.max(at, S.reviewed[e.id] || 0);
      var hinted = ORDER.some(function (d) { return S.hints[e.id + '@' + d]; }), w = 0, why = '';
      if (S.reviewed[e.id] && now - S.reviewed[e.id] < 3 * DAY) return;
      if (s === 'attempted') { w = 4; why = 'Not solved yet. Have another go.'; }
      else if (s === 'helped') { w = 3; why = 'You needed the solution. Try it on your own now.'; }
      else if (s === 'solved' && hinted) { w = 2; why = 'You needed hints. See if you can do it without them.'; }
      else if (s === 'solved' && now - last > 7 * DAY) { w = 1; why = 'Solved ' + Math.round((now - last) / DAY) + ' days ago. Keep it fresh.'; }
      else if (s === 'new') { w = 0.5; why = 'Not tried yet, in a module you have started.'; }
      if (w) items.push({ e: e, w: w, why: why, t: last });
    });
  });
  return items.sort(function (a, b) { return b.w - a.w || a.t - b.t || ALL_EX.indexOf(a.e) - ALL_EX.indexOf(b.e); });
}
function viewPractice() {
  var p = page(), ds = curDs(), st = streaks();
  p.appendChild(h('div', { class: 'eyebrow', text: 'Practice arena' }));
  p.appendChild(h('h1', { text: 'Review what you have learned' }));
  p.appendChild(h('p', { class: 'lede', text: 'Short reviews make SQL stick. Your queue puts first what you found hardest: exercises you have not solved, ones where you needed the solution or hints, and ones you solved a while ago.' }));
  p.appendChild(h('div', { class: 'stats' },
    h('div', null, h('b', { text: st.daily }), h('span', { text: 'day streak' })), h('div', null, h('b', { text: st.weekly }), h('span', { text: 'week streak' })),
    h('div', null, h('b', { text: level().name }), h('span', { text: xp() + ' XP' }))));
  var q = reviewQueue();
  if (!q.length) {
    var started = ALL_EX.some(function (e) { return exState(e.id) !== 'new'; });
    p.appendChild(h('p', { class: 'muted', text: started ? 'Nothing to review right now. Everything you started is solved and fresh. Carry on with the course, or try a mixed challenge below.' : 'The arena fills up as you work. Solve a few exercises first.' }));
    if (!started) { p.appendChild(h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: '#' + MODS[0].id, text: 'Start here' }))); return p; }
  } else {
    p.appendChild(h('h2', { text: 'Your review queue' }));
    var list = h('div', { class: 'stack' });
    q.slice(0, 6).forEach(function (it) {
      var e = it.e;
      list.appendChild(h('a', { class: 'ex-card', href: '#' + e.id },
        h('div', { class: 'ex-top' }, h('b', { text: (e.mod.capstone ? 'Capstone' : 'Module ' + e.mod.number) + ' · ' + (e.mod.capstone ? 'Task ' : 'Exercise ') + e.n }), badge(e.level), h('span', { class: 'sp' }), stateChip(e.id)),
        h('p', { class: 'why-review', text: it.why }), h('p', { html: md(e.v[ds].task) })));
    });
    p.appendChild(list);
  }
  var done = ALL_EX.filter(function (e) { return isDone(e.id); });
  if (done.length) {
    p.appendChild(h('h2', { text: 'Mixed challenge' }));
    p.appendChild(h('p', { class: 'muted', text: 'Solve an exercise you already know on a different dataset. The skill is the same, but the tables, names and answers are new.' }));
    p.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', text: 'Give me a mixed challenge', onclick: function () {
      var e = done[Math.floor(Math.random() * done.length)], others = ORDER.filter(function (d) { return d !== (S.progress[e.id] || {}).ds && d !== curDs(); });
      setDs(others[Math.floor(Math.random() * others.length)] || curDs(), true);
      toast('Dataset: ' + dsLabel(curDs()));
      navigate(e.id);
    } })));
  }
  return p;
}

function viewProgress() {
  var p = page();
  p.appendChild(h('div', { class: 'eyebrow', text: 'My progress' }));
  p.appendChild(h('h1', { text: 'What you have mastered' }));
  var solved = ALL_EX.filter(function (e) { return exState(e.id) === 'solved'; }).length, helped = ALL_EX.filter(function (e) { return exState(e.id) === 'helped'; }).length, tried = ALL_EX.filter(function (e) { return exState(e.id) === 'attempted'; }).length;
  var lv = level(), st = streaks();
  p.appendChild(levelCard(lv));
  p.appendChild(h('div', { class: 'stats' },
    h('div', null, h('b', { text: solved }), h('span', { text: 'solved' })), h('div', null, h('b', { text: helped }), h('span', { text: 'solved with help' })),
    h('div', null, h('b', { text: tried }), h('span', { text: 'attempted' })), h('div', null, h('b', { text: lv.xp }), h('span', { text: 'XP' }))));
  p.appendChild(h('div', { class: 'stats' },
    h('div', null, h('b', { text: st.daily }), h('span', { text: 'day streak' + (st.best > st.daily ? ' (best ' + st.best + ')' : '') })),
    h('div', null, h('b', { text: st.weekly }), h('span', { text: 'week streak' })),
    h('div', null, h('b', { text: st.activeDays }), h('span', { text: 'days practised' }))));
  p.appendChild(h('h2', { text: 'Skills' }));
  p.appendChild(h('p', { class: 'muted', text: 'Each axis is the share of that skill’s exercises you have solved. Solving with help counts half; attempting counts a little.' }));
  p.appendChild(radar(skillScores()));
  p.appendChild(h('h2', { text: 'Badges' }));
  var got = earned(), bg = h('div', { class: 'badges' });
  BADGES.forEach(function (b) { var on = got.indexOf(b.id) >= 0; bg.appendChild(h('div', { class: 'badge-card' + (on ? ' on' : '') }, h('span', { class: 'medal', 'aria-hidden': 'true', text: on ? '★' : '☆' }), h('b', { text: b.name }), h('span', { class: 'muted sm', text: (on ? 'Earned. ' : '') + b.how }))); });
  p.appendChild(bg);
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
  /* show what the learner has touched; the full list of every concept sits behind a disclosure */
  function masteryRows(items) {
    var mg = h('div', { class: 'mastery' });
    items.slice().sort(function (a, b) { return a.c.localeCompare(b.c); }).forEach(function (x) { mg.appendChild(h('div', { class: 'm-row' }, h('span', { text: x.c }), h('span', { class: 'bar' }, h('i', { style: 'width:' + x.pct + '%' })), h('span', { class: 'num', text: x.pct + '%' }))); });
    return mg;
  }
  var touched = list.filter(function (x) { return x.pct > 0; });
  if (touched.length) p.appendChild(masteryRows(touched));
  else p.appendChild(h('p', { class: 'muted', text: 'Concepts appear here as you attempt exercises that use them.' }));
  p.appendChild(h('details', { class: 'all-concepts' }, h('summary', { text: 'Show all ' + list.length + ' concepts in the course' }), masteryRows(list)));
  p.appendChild(h('h2', { text: 'Your data' }));
  p.appendChild(h('p', { class: 'muted', text: 'Progress is saved in this browser only, so clearing site data erases it. Download a backup file now and then, and import it to restore your progress or move it to another browser or device. Importing replaces the progress here, and you can undo it.' }));
  var fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Choose a GageQuery progress file' });
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 2e6) { toast('That file is too large to be GageQuery progress.'); return; }
    f.text().then(importProgress, function () { toast('That file could not be read.'); });
  });
  var downloadBtn = h('button', { class: 'btn primary', type: 'button', text: 'Download progress file', onclick: downloadProgress });
  var uploadBtn = h('button', { class: 'btn', type: 'button', text: 'Import from file', onclick: function () { fileInput.click(); } });
  var area = h('textarea', { class: 'export', rows: '3', 'aria-label': 'Progress as text, for copying or pasting', placeholder: 'Or paste copied progress text here', spellcheck: 'false' });
  var exportBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Copy as text', onclick: function () { copyText(progressText(), exportBtn); } });
  var importBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Import pasted text', onclick: function () { importProgress(area.value); } });
  var armed = false, clearBtn = h('button', { class: 'btn ghost', type: 'button', text: 'Reset all progress', onclick: function () { if (!armed) { armed = true; clearBtn.textContent = 'Click again to erase everything'; return; } S.progress = {}; S.helped = {}; S.hints = {}; S.drafts = {}; S.days = {}; S.reviewed = {}; save(); toast('Progress erased.'); route(true); } });
  p.appendChild(h('div', { class: 'actions' }, downloadBtn, uploadBtn, fileInput));
  p.appendChild(h('details', { class: 'all-concepts' }, h('summary', { text: 'Copy and paste instead' }), area, h('div', { class: 'actions' }, exportBtn, importBtn)));
  if (Consent.relevant()) {
    p.appendChild(h('h2', { text: 'Privacy choices' }));
    p.appendChild(h('p', { class: 'muted', html: 'Optional visit counting and Google Analytics run only if you allow them. <a href="#privacy">Read the privacy notice</a>.' }));
    p.appendChild(Consent.choices(function () { toast('Your choices are saved.'); route(true); }));
  }
  p.appendChild(h('div', { class: 'actions' }, clearBtn));
  return p;
}

/* Progress backup: the same text can be downloaded as a file, copied, or imported back from either. */
function progressText() { return JSON.stringify({ app: 'gagequery', v: S.v, progress: S.progress, helped: S.helped, hints: S.hints, days: S.days, reviewed: S.reviewed }); }
function downloadProgress() {
  var url = URL.createObjectURL(new Blob([progressText()], { type: 'application/json' }));
  var a = h('a', { href: url, download: 'gagequery-progress-' + dayKey(new Date()) + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  toast('Progress file downloaded. Keep it somewhere safe.');
}
function importProgress(text) {
  var before = { progress: S.progress, helped: S.helped, hints: S.hints, days: S.days, reviewed: S.reviewed };
  try {
    if (String(text).length > 2e6) throw 0;
    var d = JSON.parse(text);
    if (!d || typeof d.progress !== 'object' || Array.isArray(d.progress)) throw 0;
    var c = cleanState(d);
    S.progress = c.progress; S.helped = c.helped; S.hints = c.hints; S.days = c.days; S.reviewed = c.reviewed;
    migrate(d); save(); paintRail(); paintMeter();
    toast('Progress imported: ' + Object.keys(c.progress).length + ' exercises restored.', { label: 'Undo', fn: function () { for (var k in before) S[k] = before[k]; save(); paintRail(); paintMeter(); toast('Import undone.'); route(true); } });
    route(true);
  } catch (e) { toast('That is not a GageQuery progress file. Use the file you got from Download progress file.'); }
}

function viewAbout() {
  var p = page('prose');
  p.appendChild(h('div', { class: 'eyebrow', text: 'How it works' }));
  p.appendChild(h('h1', { text: 'Real SQL, checked by result' }));
  [['Every query runs for real', 'GageQuery holds a private copy of each dataset and runs your SQL in your browser, inside a background worker. Nothing is sent anywhere and nothing needs installing.'],
   ['MySQL syntax on a browser engine', 'The course teaches MySQL syntax. The engine underneath is SQLite with a compatibility layer that adds CONCAT, CONCAT_WS, DATE_FORMAT, YEAR, MONTH, DAY, QUARTER, DAYNAME, MONTHNAME, DATEDIFF, LEFT, RIGHT, LOCATE, LPAD and MySQL-style ROUND, and accepts START TRANSACTION, CAST(... AS SIGNED), EXPLAIN, SHOW TABLES and DESCRIBE.'],
   ['How answers are checked', 'Check answer runs your query and the model answer on two fresh copies of the data, then compares the rows. Any correct query passes, however you write it. Column names do not have to match; values and, where the task asks, order do. Numbers match to within 0.005.'],
   ['Hints and solutions', 'Each exercise has three hints that go from where to look, to the concept, to a skeleton with blanks. Showing the solution marks the exercise as solved with help, which earns half the points.'],
   ['Expected output', 'Show expected output runs the model answer on a fresh copy of the data and shows what a correct answer returns. Use it when you are unsure of the shape of the answer. It costs no XP.'],
   ['Feedback that names the mistake', 'When an answer is wrong, the checker lists what already matches (columns, row count, each column’s values, order) and points at the most likely cause, such as a missing GROUP BY, a JOIN without ON, or an INNER JOIN that should be a LEFT JOIN.'],
   ['XP, levels, streaks and badges', 'Easy exercises earn 50 XP, Medium 100 and Hard 200, or half if you used the solution. Days you run or check a query count towards your streak. Everything is worked out from the progress saved in this browser.'],
   ['Practice arena', 'The arena brings back exercises you have not solved, needed the solution or hints for, or solved more than a week ago. A mixed challenge gives you an exercise you know on a dataset you have not used for it.'],
   ['Privacy', 'Your progress stays in your browser and is never sent anywhere. Optional visit counting (GoatCounter, no cookies) and Google Analytics (cookies) run only if you allow them, and you can change your choice at any time. The full privacy notice is under Privacy in the menu.'],
   ['Reset', 'Reset code puts the starter back. Reset data restores the original tables if you changed them with INSERT, UPDATE or DELETE. Both can be undone for 10 seconds.'],
   ['Differences from a MySQL server', 'Integer division and some date functions behave differently between databases, so the model answers multiply by 100.0 when they need decimals. Error messages and EXPLAIN output are worded differently from MySQL\u2019s. Stored procedures and triggers will be shown as reference cards in later modules.']].forEach(function (s) { p.appendChild(h('h2', { text: s[0] })); p.appendChild(h('p', { text: s[1] })); });
  p.appendChild(h('h2', { text: 'Keyboard shortcuts' }));
  var t = h('table', { class: 'grid plain' }); var tb = h('tbody');
  [['Run', MOD_KEY + ' + Enter'], ['Check answer', MOD_KEY + ' + Shift + Enter'], ['Next hint', 'Alt + H'], ['Format SQL', 'Shift + Alt + F'], ['Autocomplete', 'Ctrl + Space'], ['Search', MOD_KEY + ' + K'], ['Leave the editor', 'Esc, then Tab']].forEach(function (r) { tb.appendChild(h('tr', null, h('td', { text: r[0] }), h('td', null, h('code', { text: r[1] })))); });
  t.appendChild(tb); p.appendChild(h('div', { class: 'grid-wrap' }, t));
  return p;
}

/* ================================================================ palette */
function openPalette() {
  var dlg = $('#palette'); dlg.hidden = false;
  var input = $('#pal-input'), list = $('#pal-list'); input.value = ''; render(); input.focus();
  var items = [['Home', 'home'], ['Course map', 'learn'], ['Datasets', 'datasets'], ['Practice arena', 'practice'], ['Playground', 'playground'], ['My progress', 'progress'], ['Feedback', 'feedback'], ['Privacy', 'privacy'], ['How it works', 'about']];
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
  else if (r === 'practice') pg = viewPractice();
  else if (r === 'privacy') pg = viewPrivacy();
  else if (r === 'feedback') pg = viewFeedback();
  else if (r === 'about') pg = viewAbout();
  else if ((m = /^(m\d\d)(?:-(concepts|examples|exercises))?$/.exec(r)) && MOD_BY_ID[m[1]]) pg = viewModule(MOD_BY_ID[m[1]], m[2]);
  else if (EX_BY_ID[r]) pg = viewExercise(EX_BY_ID[r]);
  else pg = viewHome();
  main.innerHTML = ''; main.appendChild(pg); currentPage = pg;
  markRail();
  closeRail();
  window.scrollTo(0, keepScroll === true ? y : 0);
  var h1 = pg.querySelector('h1'); document.title = (h1 ? h1.textContent + ' \u00b7 ' : '') + 'GageQuery';
  var counted = EX_BY_ID[r] || (/^(m\d\d)(-(concepts|examples|exercises))?$/.test(r) && MOD_BY_ID[r.slice(0, 3)]) || /^(home|learn|playground|datasets|progress|practice|about|privacy|feedback)$/.test(r) ? r : 'home';
  Analytics.page(counted, document.title);
  GA.page(counted, document.title);
}
function closeRail() { rail.classList.remove('open'); $('#scrim').classList.remove('open'); }

/* ================================================================ theme (system, light or dark) */
var THEMES = ['system', 'light', 'dark'], THEME_LABEL = { system: 'System', light: 'Light', dark: 'Dark' };
var THEME_ICON = {
  system: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 14h4M8 11v3"/></svg>',
  light: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>',
  dark: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/></svg>'
};
function themePref() { try { var t = localStorage.getItem('gagequery-theme'); return THEMES.indexOf(t) >= 0 ? t : 'system'; } catch (e) { return 'system'; } }
function applyTheme(t) {
  var root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  try { if (t === 'system') localStorage.removeItem('gagequery-theme'); else localStorage.setItem('gagequery-theme', t); } catch (e) {}
  var next = THEMES[(THEMES.indexOf(t) + 1) % THEMES.length], btn = $('#theme-btn');
  $('#theme-ico').innerHTML = THEME_ICON[t]; $('#theme-txt').textContent = THEME_LABEL[t];
  btn.setAttribute('aria-label', 'Theme: ' + THEME_LABEL[t] + '. Switch to ' + THEME_LABEL[next].toLowerCase() + '.');
  btn.title = 'Theme: ' + THEME_LABEL[t] + (t === 'system' ? ' (follows your device)' : '') + '. Click for ' + THEME_LABEL[next].toLowerCase() + '.';
}
function initTheme() {
  applyTheme(themePref());
  $('#theme-btn').addEventListener('click', function () { var t = themePref(); applyTheme(THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]); });
}

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
  initTheme();
  Analytics.init();
  GA.init();
  Consent.init();
  $('#pal-kbd').textContent = MOD_KEY + ' K';
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
  Engine.open(curDs()).then(function () { $('#engine').classList.add('ready'); $('#engine').textContent = 'Engine ready'; }).catch(engineProblem);
}
/* If the SQL engine cannot start anywhere, say so in plain words and give the learner something to send back. */
function engineProblem(err) {
  var details = 'Error: ' + (err && err.message || err) + '\nEngine: ' + Engine.mode() + '\nBrowser: ' + navigator.userAgent + '\nPage: ' + location.href.split('#')[0];
  var copy = h('button', { class: 'btn', type: 'button', text: 'Copy details', onclick: function () { copyText(details, copy); } });
  $('#engine').textContent = 'Engine problem';
  var box = h('div', { class: 'banner warn', role: 'alert', id: 'engine-problem' },
    h('b', { text: 'GageQuery could not start its SQL engine in this browser.' }),
    h('span', { text: 'Reload with Ctrl+F5, update your browser, or open the site in the latest Chrome, Edge or Firefox. If it keeps happening, copy the details and send them to the course owner.' }),
    h('pre', { class: 'skeleton engine-details', text: details }),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', text: 'Reload the page', onclick: function () { location.reload(); } }), copy));
  var old = $('#engine-problem'); if (old) old.remove();
  $('.topbar').after(box);
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
