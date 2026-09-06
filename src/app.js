/* ============================================================
   La Pizarra — la app de la cuadrilla de CrossFit
   Un solo archivo. Sin dependencias. Funciona en GitHub Pages.
   ============================================================ */
'use strict';

/* ------------------------------------------------------------
   CONFIGURACIÓN DE SINCRONIZACIÓN COMPARTIDA
   Para que todos los amigos vean los mismos datos, crea un
   proyecto gratuito en Firebase con "Realtime Database" y pega
   aquí la configuración (ver README). Si se deja en null, la app
   funciona en modo local: los datos solo viven en cada móvil.
   ------------------------------------------------------------ */
const FIREBASE_CONFIG = null;
/* Ejemplo:
const FIREBASE_CONFIG = {
  apiKey: "AIza....",
  authDomain: "la-pizarra-1234.firebaseapp.com",
  databaseURL: "https://la-pizarra-1234-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "la-pizarra-1234",
  groupKey: "cuadrilla-2026"   // cualquier palabra: separa los datos de vuestro grupo
};
*/
const APP_VERSION = '1.0.0';
const CREW_NAME = 'Cuadrilla';

/* Datos incrustados en el build */
const HEROES = /*__HEROES__*/[];
const GIRLS = /*__GIRLS__*/[];

/* ============================================================
   Utilidades
   ============================================================ */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad2 = (n) => String(n).padStart(2, '0');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function nowISO() { return new Date().toISOString(); }
function parseDate(iso) { const [y, m, d] = String(iso || '').split('-').map(Number); return new Date(y || 1970, (m || 1) - 1, d || 1); }
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDate(iso) {
  if (!iso) return '';
  const d = parseDate(iso); const now = new Date();
  return d.getDate() + ' ' + MESES[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
}
function relDate(iso) {
  if (!iso) return '';
  const t = parseDate(todayISO()); const d = parseDate(iso);
  const diff = Math.round((t - d) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff > 1 && diff < 7) return 'hace ' + diff + ' días';
  return fmtDate(iso);
}
function isoWeekKey(iso) {
  const d = parseDate(iso);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + pad2(w);
}
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
}
const MONTHS_EN = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fmtPosted(s) {
  if (!s) return '';
  const m = String(s).match(/^([A-Za-z]+)\.?\s+(?:(\d{1,2}),?\s+)?(\d{4})/);
  if (!m) return s;
  const key = m[1].toLowerCase();
  const mi = MONTHS_EN[key.slice(0, 4)] != null ? MONTHS_EN[key.slice(0, 4)] : MONTHS_EN[key.slice(0, 3)];
  if (mi == null) return s;
  return (m[2] ? m[2] + ' de ' : '') + MESES_LARGO[mi] + ' de ' + m[3];
}
function withKg(s) {
  if (!s) return '';
  return String(s).replace(/(\d+(?:\.\d+)?)(?:-lb\b|\s?lbs?\b)/g, (all, n) => n + ' lb (' + Math.round(Number(n) * 0.4536) + ' kg)');
}
function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
}
const COLORS = ['red', 'blue', 'yellow', 'green', 'white', 'black'];
const COLOR_LABEL = { red: 'Disco rojo · 25 kg', blue: 'Disco azul · 20 kg', yellow: 'Disco amarillo · 15 kg', green: 'Disco verde · 10 kg', white: 'Disco blanco · 5 kg', black: 'Disco negro' };
function stripUndefined(o) { const r = {}; for (const k in o) if (o[k] !== undefined) r[k] = o[k]; return r; }

/* ============================================================
   Almacenamiento: tres adaptadores con la misma interfaz
   subscribe(col, cb) · set(col,id,data) · update(col,id,patch) · remove(col,id)
   ============================================================ */
const COLS = ['athletes', 'workouts', 'results'];
const LS_PREFIX = 'pizarra:';

class LocalStore {
  constructor() {
    this.mode = 'local';
    this.subs = {};
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.indexOf(LS_PREFIX) === 0) this._emit(e.key.slice(LS_PREFIX.length));
    });
  }
  _key(col) { return LS_PREFIX + col; }
  _read(col) { try { return JSON.parse(localStorage.getItem(this._key(col)) || '{}') || {}; } catch (e) { return {}; } }
  _write(col, obj) { localStorage.setItem(this._key(col), JSON.stringify(obj)); this._emit(col); }
  _emit(col) { const docs = Object.values(this._read(col)); (this.subs[col] || []).forEach((cb) => cb(docs)); }
  subscribe(col, cb) {
    (this.subs[col] = this.subs[col] || []).push(cb);
    cb(Object.values(this._read(col)));
    return () => { this.subs[col] = (this.subs[col] || []).filter((f) => f !== cb); };
  }
  async set(col, id, data) { const o = this._read(col); o[id] = Object.assign({}, data, { id }); this._write(col, o); }
  async update(col, id, patch) { const o = this._read(col); o[id] = Object.assign({}, o[id] || {}, patch, { id }); this._write(col, o); }
  async remove(col, id) { const o = this._read(col); delete o[id]; this._write(col, o); }
  exportAll() { const out = { app: 'la-pizarra', version: APP_VERSION, exportedAt: nowISO() }; COLS.forEach((c) => { out[c] = this._read(c); }); return out; }
  importAll(data) { let n = 0; COLS.forEach((c) => { if (data[c] && typeof data[c] === 'object') { const o = this._read(c); for (const id in data[c]) { o[id] = Object.assign({}, data[c][id], { id }); n++; } this._write(c, o); } }); return n; }
}

class ClaudeDbStore {
  constructor(db) { this.mode = 'claude'; this.db = db; }
  subscribe(col, cb) {
    return this.db.collection(col).onSnapshot(
      (snap) => cb(snap.docs.filter((d) => d.exists).map((d) => Object.assign({}, d.data(), { id: d.id }))),
      (err) => console.warn('db error', err)
    );
  }
  async set(col, id, data) { await this.db.doc(col + '/' + id).set(stripUndefined(Object.assign({}, data, { id }))); }
  async update(col, id, patch) {
    try { await this.db.doc(col + '/' + id).update(stripUndefined(patch)); }
    catch (e) { const s = await this.db.doc(col + '/' + id).get(); await this.db.doc(col + '/' + id).set(stripUndefined(Object.assign({}, s.data() || {}, patch, { id }))); }
  }
  async remove(col, id) { await this.db.doc(col + '/' + id).delete(); }
}

class FirebaseStore {
  constructor(root) { this.mode = 'firebase'; this.db = window.firebase.database(); this.root = root; }
  ref(path) { return this.db.ref(this.root + '/' + path); }
  subscribe(col, cb) {
    const r = this.ref(col);
    const h = (snap) => { const v = snap.val() || {}; cb(Object.keys(v).map((k) => Object.assign({}, v[k], { id: k }))); };
    r.on('value', h, (err) => { console.warn('firebase error', err); toast('Sin conexión con la base de datos', true); });
    return () => r.off('value', h);
  }
  async set(col, id, data) { await this.ref(col + '/' + id).set(stripUndefined(Object.assign({}, data, { id }))); }
  async update(col, id, patch) { await this.ref(col + '/' + id).update(stripUndefined(patch)); }
  async remove(col, id) { await this.ref(col + '/' + id).remove(); }
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
function readLocalFirebaseConfig() {
  try { const c = JSON.parse(localStorage.getItem(LS_PREFIX + 'firebase') || 'null'); return c && c.databaseURL ? c : null; } catch (e) { return null; }
}
async function initFirebase(cfg) {
  const v = '10.14.1';
  await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-database-compat.js');
  const clean = Object.assign({}, cfg); delete clean.groupKey;
  window.firebase.initializeApp(clean);
  const root = 'pizarra/' + String(cfg.groupKey || 'default').replace(/[.#$\[\]\/\s]+/g, '-');
  return new FirebaseStore(root);
}
async function chooseStore() {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const db = await window.claude.use('db');
      if (db) return new ClaudeDbStore(db);
    }
  } catch (e) { console.warn('claude db no disponible', e); }
  const cfg = FIREBASE_CONFIG || readLocalFirebaseConfig();
  if (cfg && cfg.databaseURL) {
    try { return await initFirebase(cfg); }
    catch (e) { console.warn(e); setTimeout(() => toast('No se pudo conectar con Firebase. Modo local.', true), 300); }
  }
  return new LocalStore();
}

/* ============================================================
   Estado
   ============================================================ */
const state = {
  store: null,
  athletes: [], workouts: [], results: [],
  loaded: { athletes: false, workouts: false, results: false },
  meId: null,
  view: 'home', params: {},
  period: 'season', wodTab: 'hero', search: '',
  expanded: null,
  sound: localStorage.getItem(LS_PREFIX + 'sound') !== 'off',
  promptedProfile: false,
};
const athleteById = (id) => state.athletes.find((a) => a.id === id) || null;
const me = () => athleteById(state.meId);

function readMe() {
  let id = null;
  try { id = sessionStorage.getItem(LS_PREFIX + 'me') || localStorage.getItem(LS_PREFIX + 'me'); } catch (e) { }
  return id || null;
}
function setMe(id) {
  state.meId = id;
  try { if (id) { sessionStorage.setItem(LS_PREFIX + 'me', id); localStorage.setItem(LS_PREFIX + 'me', id); } else { sessionStorage.removeItem(LS_PREFIX + 'me'); localStorage.removeItem(LS_PREFIX + 'me'); } } catch (e) { }
}

/* ============================================================
   Dominio: entrenos, resultados y puntos
   ============================================================ */
const TYPE_LABEL = { fortime: 'For time', amrap: 'AMRAP', emom: 'EMOM', tabata: 'Tabata', interval: 'Intervalos', strength: 'Fuerza', other: 'Otro' };
const SCORE_LABEL = { time: 'tiempo', rounds: 'rondas + reps', reps: 'reps', load: 'kg' };

let _builtin = null;
function builtinWorkouts() {
  if (_builtin) return _builtin;
  const mk = (h, cat) => ({
    id: cat + ':' + h.slug, category: cat, name: h.name,
    type: h.type || 'fortime', scoreType: h.scoreType || 'time',
    durationMin: h.durationMin || 0, timeCapMin: h.timeCapMin || 0,
    description: (h.prescription || []).join('\n'),
    loadF: h.loadF || '', loadM: h.loadM || '',
    tributeEs: h.tributeEs || '', tributeEn: h.tributeEn || '', honoree: h.honoree || '',
    firstPosted: h.firstPosted || '', url: h.url || '', partner: !!h.partner,
    searchKey: (h.name + ' ' + (h.prescription || []).join(' ') + ' ' + (h.honoree || '')).toLowerCase(),
  });
  _builtin = HEROES.map((h) => mk(h, 'hero')).concat(GIRLS.map((g) => mk(g, 'girl')));
  return _builtin;
}
function allWorkouts() {
  const custom = state.workouts.map((w) => Object.assign({ category: 'custom', searchKey: (w.name + ' ' + (w.description || '')).toLowerCase() }, w, { category: 'custom' }));
  return builtinWorkouts().concat(custom);
}
function getWorkout(id) { return allWorkouts().find((w) => w.id === id) || null; }
function workoutMeta(w) {
  const bits = [TYPE_LABEL[w.type] || w.type];
  if (w.durationMin) bits.push(w.durationMin + ' min');
  if (w.timeCapMin) bits.push('cap ' + w.timeCapMin + '’');
  if (w.type === 'emom' && w.intervalSec && w.rounds) bits.push('cada ' + w.intervalSec + ' s × ' + w.rounds);
  if (w.type === 'tabata' && w.workSec) bits.push(w.workSec + '/' + (w.restSec || 0) + ' × ' + (w.rounds || 8));
  if (w.partner) bits.push('en pareja');
  return bits;
}
function firstLine(w) {
  const lines = String(w.description || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const moves = lines.filter((l) => !/:$/.test(l)).slice(0, 4).join(' · ');
  return moves || lines[0] || '';
}

/* --- comparación de resultados: negativo = a mejor que b --- */
function compareResults(a, b) {
  const rx = (b.rx ? 1 : 0) - (a.rx ? 1 : 0);
  if (rx) return rx;
  switch (a.scoreType) {
    case 'time': {
      const af = a.finished !== false, bf = b.finished !== false;
      if (af && !bf) return -1; if (!af && bf) return 1;
      if (af) return (a.seconds || 0) - (b.seconds || 0);
      return (b.reps || 0) - (a.reps || 0);
    }
    case 'rounds': return ((b.rounds || 0) - (a.rounds || 0)) || ((b.reps || 0) - (a.reps || 0));
    case 'reps': return (b.reps || 0) - (a.reps || 0);
    case 'load': return (b.load || 0) - (a.load || 0);
    default: return 0;
  }
}
function fmtScore(r) {
  switch (r.scoreType) {
    case 'time': return r.finished === false ? 'CAP · ' + (r.reps || 0) + ' reps' : fmtTime(r.seconds || 0);
    case 'rounds': return (r.rounds || 0) + ' rd' + (r.reps ? ' + ' + r.reps : '');
    case 'reps': return (r.reps || 0) + ' reps';
    case 'load': return (r.load || 0) + ' kg';
    default: return '';
  }
}
function periodContains(period, iso) {
  if (!iso) return false;
  if (period === 'season') return true;
  const t = todayISO();
  if (period === 'month') return iso.slice(0, 7) === t.slice(0, 7);
  if (period === 'week') return isoWeekKey(iso) === isoWeekKey(t);
  return true;
}
const PERIOD_LABEL = { week: 'esta semana', month: 'este mes', season: 'la temporada' };
const PODIUM_PTS = [15, 10, 6];
const RULES = [
  ['Apuntar un entreno', 10],
  ['Hacerlo Rx', '+5'],
  ['Si es un Hero WOD', '+10'],
  ['Si es un benchmark (Girls)', '+5'],
  ['Mejorar tu marca (PR)', '+5'],
  ['1.º / 2.º / 3.º de la pizarra de ese entreno', '15 / 10 / 6'],
  ['A partir del 4.º (con 2+ atletas)', '3'],
  ['Semana activa (3 días o más)', '+5'],
];

function computeStandings(period) {
  const valid = state.results.filter((r) => athleteById(r.athleteId));
  const inP = (r) => periodContains(period, r.date);
  const pr = valid.filter(inP);
  const per = {};
  const ensure = (id) => (per[id] = per[id] || { base: 0, rx: 0, cat: 0, pr: 0, podium: 0, weeks: 0, total: 0, count: 0, prs: 0, wins: 0, podiums: 0 });
  const seen = new Set();
  pr.forEach((r) => {
    const p = ensure(r.athleteId); p.results = (p.results || 0) + 1;
    const k = r.athleteId + '|' + r.workoutId + '|' + r.date;
    if (seen.has(k)) return; seen.add(k);
    p.count++;
    p.base += 10;
    if (r.rx) p.rx += 5;
    if (r.category === 'hero') p.cat += 10; else if (r.category === 'girl') p.cat += 5;
  });
  const chrono = valid.slice().sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  const best = {};
  chrono.forEach((r) => {
    const k = r.athleteId + '|' + r.workoutId; const prev = best[k];
    if (prev && compareResults(r, prev) < 0) { if (inP(r)) { const p = ensure(r.athleteId); p.pr += 5; p.prs++; } }
    if (!prev || compareResults(r, prev) < 0) best[k] = r;
  });
  const byWod = {};
  pr.forEach((r) => (byWod[r.workoutId] = byWod[r.workoutId] || []).push(r));
  Object.keys(byWod).forEach((wid) => {
    const bestBy = {};
    byWod[wid].forEach((r) => { if (!bestBy[r.athleteId] || compareResults(r, bestBy[r.athleteId]) < 0) bestBy[r.athleteId] = r; });
    const ranked = Object.values(bestBy).sort(compareResults);
    if (ranked.length < 2) return;
    let pos = 0;
    ranked.forEach((r, i) => {
      if (i === 0 || compareResults(r, ranked[i - 1]) !== 0) pos = i;
      const p = ensure(r.athleteId);
      p.podium += pos < 3 ? PODIUM_PTS[pos] : 3;
      if (pos === 0) p.wins++;
      if (pos < 3) p.podiums++;
    });
  });
  const days = {};
  pr.forEach((r) => { const k = r.athleteId + '|' + isoWeekKey(r.date); (days[k] = days[k] || new Set()).add(r.date); });
  Object.keys(days).forEach((k) => { if (days[k].size >= 3) ensure(k.split('|')[0]).weeks += 5; });
  const rows = state.athletes.map((a) => {
    const p = ensure(a.id);
    p.total = p.base + p.rx + p.cat + p.pr + p.podium + p.weeks;
    return Object.assign({ athlete: a }, p);
  }).sort((x, y) => y.total - x.total || y.count - x.count || x.athlete.name.localeCompare(y.athlete.name));
  rows.forEach((r, i) => { r.pos = i > 0 && rows[i - 1].total === r.total ? rows[i - 1].pos : i + 1; });
  return rows;
}
function wodBoard(workoutId) {
  const bestBy = {};
  state.results.filter((r) => r.workoutId === workoutId && athleteById(r.athleteId)).forEach((r) => {
    if (!bestBy[r.athleteId] || compareResults(r, bestBy[r.athleteId]) < 0) bestBy[r.athleteId] = r;
  });
  return Object.values(bestBy).sort(compareResults);
}
function isPR(result) {
  const prev = state.results.filter((r) => r.athleteId === result.athleteId && r.workoutId === result.workoutId && r.id !== result.id && (r.date + (r.createdAt || '')) < (result.date + (result.createdAt || '')));
  if (!prev.length) return false;
  return prev.every((p) => compareResults(result, p) < 0);
}

/* ============================================================
   UI: helpers
   ============================================================ */
function avatar(a, size) {
  if (!a) return '<span class="avatar ' + (size || '') + '" data-color="black">?</span>';
  return '<span class="avatar ' + (size || '') + '" data-color="' + esc(a.color || 'red') + '" aria-hidden="true">' + esc(initials(a.name)) + '</span>';
}
function badge(cls, text) { return '<span class="badge ' + cls + '">' + esc(text) + '</span>'; }
function catBadge(cat) { return cat === 'hero' ? badge('hero', 'Hero') : cat === 'girl' ? badge('girl', 'Girl') : badge('custom', 'Nuestro'); }
function icon(name) {
  const p = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    pen: '<path d="M4 20h4l10-10-4-4L4 16zM13 7l4 4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  }[name] || '';
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
}
let toastTimer = 0;
function toast(msg, bad) {
  const root = $('#toast-root');
  root.innerHTML = '<div class="toast' + (bad ? ' bad' : '') + '" role="status">' + esc(msg) + '</div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2600);
}
/* --- sheets --- */
function openSheet(opts) {
  const root = $('#sheet-root');
  root.innerHTML =
    '<div class="sheet-backdrop" data-action="sheet-backdrop">' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
    '<div class="sheet-head"><h2 class="h-display h3" id="sheet-title">' + esc(opts.title) + '</h2>' +
    '<button class="close" data-action="close-sheet" aria-label="Cerrar">' + icon('x') + '</button></div>' +
    '<div class="sheet-body">' + opts.body + '</div>' +
    (opts.foot ? '<div class="sheet-foot">' + opts.foot + '</div>' : '') +
    '</div></div>';
  const first = $('.sheet-body input, .sheet-body select, .sheet-body textarea, .sheet-body button', root);
  if (first && opts.focus !== false) setTimeout(() => first.focus(), 60);
  return root;
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }
function confirmSheet(title, text, okLabel) {
  return new Promise((resolve) => {
    openSheet({
      title, focus: false,
      body: '<p>' + esc(text) + '</p>',
      foot: '<button class="btn ghost" data-action="confirm-no">Cancelar</button><button class="btn danger" data-action="confirm-yes">' + esc(okLabel || 'Eliminar') + '</button>',
    });
    pendingConfirm = resolve;
  });
}
let pendingConfirm = null;

/* ============================================================
   Vistas
   ============================================================ */
function renderTopbar() {
  const chip = $('#me-chip'); const m = me();
  chip.innerHTML = m ? avatar(m, 'sm') + '<span class="name">' + esc(m.name) + '</span>' : '<span class="avatar sm" data-color="black">?</span><span class="name">¿Quién eres?</span>';
  $('#brand-crew').textContent = CREW_NAME;
}
function renderTabs() {
  $$('#tabbar .tab').forEach((b) => {
    const active = b.dataset.view === state.view || (state.view === 'wod' && b.dataset.view === 'wods');
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
function modeBanner() {
  const mode = state.store ? state.store.mode : 'local';
  if (mode === 'local') return '<div class="banner"><span class="dot"></span><span><b>Modo local:</b> los datos solo se guardan en este dispositivo. Configura la sincronización en Perfil para compartirlos.</span></div>';
  return '';
}
function loadingAll() { return !(state.loaded.athletes && state.loaded.workouts && state.loaded.results); }

/* --- HOY --- */
function viewHome() {
  const m = me();
  const today = todayISO();
  const todays = state.workouts.filter((w) => w.scheduledDate === today);
  const upcoming = state.workouts.filter((w) => w.scheduledDate && w.scheduledDate > today).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 3);
  const standings = computeStandings('season');
  const feed = state.results.filter((r) => athleteById(r.athleteId)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 12);
  let html = '<div class="view">' + modeBanner();

  if (!m) {
    html += '<section class="card hero-wod"><span class="eyebrow">Bienvenido</span><h1 class="h-display h1">Apúntate en la pizarra</h1>' +
      '<p class="muted">Elige tu atleta o crea uno nuevo para apuntar tiempos y sumar puntos.</p>' +
      '<div class="btn-row"><button class="btn primary" data-action="pick-athlete">Elegir atleta</button><button class="btn" data-action="new-athlete">Crear atleta</button></div></section>';
  }

  html += '<section class="card ' + (todays.length ? 'hero-wod' : '') + '"><div class="section-head"><span class="eyebrow">WOD de hoy · ' + esc(fmtDate(today)) + '</span>' +
    '<button class="link" data-action="new-workout" data-date="' + today + '">Programar</button></div>';
  if (todays.length) {
    todays.forEach((w) => {
      html += '<div><h2 class="h-display h1">' + esc(w.name) + '</h2><div class="meta-line">' + workoutMeta(w).map((b) => badge('type', b)).join('') + '</div>' +
        '<div class="wod-desc" style="margin-top:8px">' + esc(w.description) + '</div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn primary" data-action="timer-for" data-id="' + esc(w.id) + '">' + icon('timer') + 'Cronómetro</button>' +
        '<button class="btn" data-action="log-result" data-id="' + esc(w.id) + '">Apuntar</button></div></div>';
    });
  } else {
    html += '<p class="muted">Nadie ha programado un entreno para hoy. Elige uno de la lista o crea el vuestro.</p>' +
      '<div class="btn-row"><button class="btn" data-action="go" data-view="wods">Ver entrenos</button><button class="btn" data-action="log-result">Apuntar resultado</button></div>';
  }
  if (upcoming.length) {
    html += '<div class="divider"></div><span class="eyebrow">Próximos</span><ul>' + upcoming.map((w) => '<li class="kv"><button class="link" style="background:none;border:0;padding:0;color:var(--text);font:inherit;text-align:left" data-action="open-wod" data-id="' + esc(w.id) + '">' + esc(w.name) + '</button><span class="muted">' + esc(fmtDate(w.scheduledDate)) + '</span></li>').join('') + '</ul>';
  }
  html += '</section>';

  if (m) {
    const mine = standings.find((s) => s.athlete.id === m.id) || { total: 0, pos: '–', count: 0 };
    const week = new Set(state.results.filter((r) => r.athleteId === m.id && periodContains('week', r.date)).map((r) => r.workoutId + '|' + r.date)).size;
    html += '<section class="stat-strip">' +
      '<div class="stat"><span class="v">' + week + '</span><span class="l">Entrenos esta semana</span></div>' +
      '<div class="stat"><span class="v">' + mine.total + '</span><span class="l">Puntos temporada</span></div>' +
      '<div class="stat"><span class="v">' + (mine.count ? mine.pos + '.º' : '–') + '</span><span class="l">Posición</span></div></section>';
  }

  const top = standings.filter((s) => s.count > 0).slice(0, 3);
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Clasificación</h2><button class="link" data-action="go" data-view="ranking">Ver toda</button></div>';
  if (top.length) {
    html += '<ul class="list" style="border:0">' + top.map((s) => '<li><div class="lb-row"><span class="pos">' + s.pos + '</span>' + avatar(s.athlete) + '<span class="title">' + esc(s.athlete.name) + '</span><span class="pts">' + s.total + '<small>PTS</small></span></div></li>').join('') + '</ul>';
  } else {
    html += '<p class="muted">Todavía no hay puntos. El primero que apunte un tiempo se pone líder.</p>';
  }
  html += '</section>';

  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Últimos tiempos</h2>' + (feed.length ? '<button class="link" data-action="log-result">+ Apuntar</button>' : '') + '</div>';
  if (feed.length) {
    html += '<ul class="list" style="border:0">' + feed.map((r) => {
      const a = athleteById(r.athleteId);
      return '<li><button class="feed-item row pressable" data-action="open-wod" data-id="' + esc(r.workoutId) + '" aria-label="' + esc((a ? a.name : '?') + ', ' + r.workoutName + ', ' + fmtScore(r)) + '">' + avatar(a) +
        '<span><span class="what"><b>' + esc(a ? a.name : '?') + '</b> · ' + esc(r.workoutName) + '</span><br><span class="when">' + esc(relDate(r.date)) + (r.notes ? ' · ' + esc(r.notes) : '') + '</span></span>' +
        '<span class="right"><span class="score">' + esc(fmtScore(r)) + '</span><span>' + (r.rx ? badge('rx', 'Rx') : '') + (isPR(r) ? ' ' + badge('pr', 'PR') : '') + '</span></span></button></li>';
    }).join('') + '</ul>';
  } else {
    html += '<div class="empty"><span class="h-display h2">Pizarra en blanco</span><span>Apunta el primer tiempo de la cuadrilla.</span><button class="btn primary" data-action="log-result">Apuntar resultado</button></div>';
  }
  html += '</section></div>';
  return html;
}

/* --- ENTRENOS --- */
function viewWods() {
  const counts = { hero: HEROES.length, girl: GIRLS.length, custom: state.workouts.length };
  return '<div class="view">' +
    '<div class="search">' + icon('search') + '<input type="search" id="wod-search" placeholder="Buscar entreno o movimiento…" value="' + esc(state.search) + '" autocomplete="off"></div>' +
    '<div class="segmented" role="tablist">' + ['hero', 'girl', 'custom'].map((t) => '<button role="tab" data-action="wod-tab" data-tab="' + t + '" aria-pressed="' + (state.wodTab === t) + '">' + ({ hero: 'Héroes', girl: 'Girls', custom: 'Nuestros' })[t] + ' <span class="faint">' + counts[t] + '</span></button>').join('') + '</div>' +
    '<div id="wod-list">' + wodListHtml() + '</div>' +
    '<button class="fab" data-action="new-workout" aria-label="Nuevo entreno">' + icon('plus') + '</button>' +
    '</div>';
}
function wodListHtml() {
  const q = state.search.trim().toLowerCase();
  let items = allWorkouts().filter((w) => q ? true : w.category === state.wodTab);
  if (q) items = items.filter((w) => w.searchKey.indexOf(q) >= 0);
  if (state.wodTab === 'custom' && !q) items = items.slice().sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!items.length) {
    if (state.wodTab === 'custom' && !q) return '<div class="empty"><span class="h-display h2">Aún no hay entrenos propios</span><span>Crea el primero con el botón +. Puedes programarlo para un día y saldrá en “Hoy”.</span></div>';
    return '<div class="empty"><span class="h-display h2">Nada por aquí</span><span>No hay entrenos que coincidan con “' + esc(state.search) + '”.</span></div>';
  }
  const today = todayISO();
  return '<ul class="list">' + items.map((w) => {
    const meta = workoutMeta(w);
    return '<li><button class="row pressable" data-action="open-wod" data-id="' + esc(w.id) + '" aria-label="' + esc(w.name) + '">' +
      '<span class="badge ' + (w.category === 'hero' ? 'hero' : w.category === 'girl' ? 'girl' : 'custom') + '" style="min-width:52px;justify-content:center">' + (w.category === 'hero' ? 'Hero' : w.category === 'girl' ? 'Girl' : 'WOD') + '</span>' +
      '<span><span class="title">' + esc(w.name) + (w.scheduledDate === today ? ' ' + badge('today', 'Hoy') : '') + '</span><span class="sub">' + esc(meta.join(' · ')) + ' — ' + esc(firstLine(w)) + '</span></span>' +
      '<span class="chev">' + icon('chev') + '</span></button></li>';
  }).join('') + '</ul>' + (q ? '<p class="faint small" style="margin-top:8px">' + items.length + ' resultado' + (items.length === 1 ? '' : 's') + '</p>' : '');
}

/* --- DETALLE DE ENTRENO --- */
function viewWod() {
  const w = getWorkout(state.params.id);
  if (!w) return '<div class="view"><button class="btn ghost sm" data-action="go" data-view="wods">' + icon('back') + 'Entrenos</button><div class="empty"><span class="h-display h2">Entreno no encontrado</span><span>Puede que alguien lo haya borrado.</span></div></div>';
  const board = wodBoard(w.id);
  const m = me();
  const mine = state.results.filter((r) => r.workoutId === w.id && m && r.athleteId === m.id).sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
  const lines = String(w.description || '').split('\n');
  let html = '<div class="view">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><button class="btn ghost sm" data-action="go" data-view="wods">' + icon('back') + 'Entrenos</button>' +
    (w.category === 'custom' ? '<span class="btn-row"><button class="btn ghost sm" data-action="edit-workout" data-id="' + esc(w.id) + '">' + icon('pen') + 'Editar</button><button class="btn ghost sm danger" data-action="delete-workout" data-id="' + esc(w.id) + '">' + icon('trash') + '</button></span>' : '') + '</div>' +
    '<section class="card"><div class="meta-line">' + catBadge(w.category) + workoutMeta(w).map((b) => badge('type', b)).join('') + (w.scheduledDate ? badge('today', fmtDate(w.scheduledDate)) : '') + '</div>' +
    '<h1 class="h-display h1">' + esc(w.name) + '</h1>' +
    (w.honoree ? '<p class="muted small">' + esc(w.honoree) + '</p>' : '') +
    '<div class="wod-desc">' + lines.map((l, i) => (i === 0 || /:$/.test(l.trim())) ? '<span class="head">' + esc(l) + '</span>' : esc(l)).join('\n') + '</div>' +
    ((w.loadF || w.loadM) ? '<div class="loads">' + (w.loadF ? '<span class="sym">♀</span><span>' + esc(withKg(w.loadF)) + '</span>' : '') + (w.loadM ? '<span class="sym">♂</span><span>' + esc(withKg(w.loadM)) + '</span>' : '') + '</div>' : '') +
    (w.tributeEs ? '<div class="tribute">' + esc(w.tributeEs) + '</div>' : '') +
    '<div class="meta-line">' + (w.firstPosted ? '<span>Publicado por CrossFit en ' + esc(fmtPosted(w.firstPosted)) + '</span>' : '') + (w.url ? '<a href="' + esc(w.url) + '" target="_blank" rel="noopener">crossfit.com ↗</a>' : '') + (w.createdBy && athleteById(w.createdBy) ? '<span>Creado por ' + esc(athleteById(w.createdBy).name) + '</span>' : '') + '</div>' +
    '<div class="btn-row">' + (w.scoreType !== 'load' ? '<button class="btn primary" data-action="timer-for" data-id="' + esc(w.id) + '">' + icon('timer') + 'Cronómetro</button>' : '') + '<button class="btn" data-action="log-result" data-id="' + esc(w.id) + '">Apuntar resultado</button></div>' +
    '</section>';
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Pizarra</h2><span class="eyebrow">' + esc(SCORE_LABEL[w.scoreType] || '') + '</span></div>';
  if (board.length) {
    html += '<ul class="list wod-lb" style="border:0">' + board.map((r, i) => {
      const a = athleteById(r.athleteId);
      return '<li><span class="pos p' + (i + 1) + '">' + (i + 1) + '</span>' + avatar(a, 'sm') + '<span><span class="title">' + esc(a.name) + '</span><br><span class="small muted">' + esc(fmtDate(r.date)) + '</span></span><span class="right"><span class="s">' + esc(fmtScore(r)) + '</span>' + (r.rx ? badge('rx', 'Rx') : '<span class="faint small">scaled</span>') + '</span></li>';
    }).join('') + '</ul>';
  } else {
    html += '<p class="muted">Nadie lo ha hecho todavía. Sé el primero en la pizarra.</p>';
  }
  html += '</section>';
  if (m) {
    html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Tus marcas</h2></div>';
    if (mine.length) {
      html += '<ul class="list history" style="border:0">' + mine.map((r) => '<li><span><span class="d">' + esc(fmtDate(r.date)) + '</span>' + (r.notes ? '<br><span class="small">' + esc(r.notes) + '</span>' : '') + '</span><span class="s">' + esc(fmtScore(r)) + (r.rx ? ' ' + badge('rx', 'Rx') : '') + (isPR(r) ? ' ' + badge('pr', 'PR') : '') + '</span><button class="icon-btn" data-action="delete-result" data-id="' + esc(r.id) + '" aria-label="Borrar resultado">' + icon('trash') + '</button></li>').join('') + '</ul>';
    } else {
      html += '<p class="muted">Todavía no tienes marca en este entreno.</p>';
    }
    html += '</section>';
  }
  return html + '</div>';
}

/* --- RANKING --- */
function viewRanking() {
  const rows = computeStandings(state.period);
  const active = rows.filter((r) => r.count > 0);
  const top = active.slice(0, 3);
  const order = [1, 0, 2];
  let html = '<div class="view"><div class="segmented" role="tablist">' + ['week', 'month', 'season'].map((p) => '<button data-action="period" data-period="' + p + '" aria-pressed="' + (state.period === p) + '">' + ({ week: 'Semana', month: 'Mes', season: 'Temporada' })[p] + '</button>').join('') + '</div>';
  if (!active.length) {
    html += '<div class="empty"><span class="h-display h2">Sin puntos ' + esc(PERIOD_LABEL[state.period]) + '</span><span>Apunta un entreno para estrenar la clasificación.</span><button class="btn primary" data-action="log-result">Apuntar resultado</button></div>';
  } else {
    html += '<div class="podium">' + order.map((i) => {
      const s = top[i]; if (!s) return '<div></div>';
      return '<div class="slot p' + (i + 1) + '"><span class="pos">' + (i + 1) + '.º</span>' + avatar(s.athlete, i === 0 ? 'lg' : '') + '<span class="nm">' + esc(s.athlete.name) + '</span><span class="pts">' + s.total + '</span></div>';
    }).join('') + '</div>';
    html += '<ul class="list">' + rows.map((s) => {
      const open = state.expanded === s.athlete.id;
      return '<li><button class="lb-row' + (s.athlete.id === state.meId ? ' me' : '') + '" data-action="expand" data-id="' + esc(s.athlete.id) + '" aria-expanded="' + open + '" aria-label="' + esc(s.athlete.name) + ', ' + s.total + ' puntos"><span class="pos">' + (s.count ? s.pos : '–') + '</span>' + avatar(s.athlete) +
        '<span><span class="title">' + esc(s.athlete.name) + '</span><br><span class="small muted">' + s.count + ' entreno' + (s.count === 1 ? '' : 's') + ((s.results || 0) > s.count ? ' (' + s.results + ' marcas)' : '') + ' · ' + s.prs + ' PR · ' + s.wins + ' victoria' + (s.wins === 1 ? '' : 's') + '</span></span>' +
        '<span class="pts">' + s.total + '<small>PTS</small></span></button>' +
        (open ? '<div class="breakdown"><span>Entrenos apuntados</span><b>' + s.base + '</b><span>Rx</span><b>' + s.rx + '</b><span>Héroes y benchmarks</span><b>' + s.cat + '</b><span>PRs</span><b>' + s.pr + '</b><span>Podios (' + s.podiums + ')</span><b>' + s.podium + '</b><span>Semanas activas</span><b>' + s.weeks + '</b></div>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  html += '<details class="card"><summary><span class="eyebrow">Cómo se puntúa</span></summary><div class="rules" style="margin-top:10px">' + RULES.map((r) => '<span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b>').join('') + '</div>' +
    '<p class="faint small" style="margin-top:10px">Cuenta la mejor marca de cada atleta en cada entreno. Rx siempre queda por delante de scaled. Un mismo entreno solo suma una vez al día (base, Rx y bonus de héroe o benchmark); las marcas extra del mismo día solo cuentan para el PR. Los puntos se recalculan en vivo con los resultados del periodo.</p></details></div>';
  return html;
}

/* --- PERFIL --- */
function viewProfile() {
  const m = me();
  const rows = computeStandings('season');
  const mine = m ? rows.find((r) => r.athlete.id === m.id) : null;
  const mode = state.store ? state.store.mode : 'local';
  let html = '<div class="view">';
  if (m) {
    html += '<section class="card"><div class="profile-head">' + avatar(m, 'lg') + '<div><span class="eyebrow">Atleta</span><div class="nm">' + esc(m.name) + '</div></div></div>' +
      '<div class="stat-strip"><div class="stat"><span class="v">' + (mine ? mine.count : 0) + '</span><span class="l">Entrenos</span></div><div class="stat"><span class="v">' + (mine ? mine.prs : 0) + '</span><span class="l">PRs</span></div><div class="stat"><span class="v">' + (mine ? mine.total : 0) + '</span><span class="l">Puntos</span></div></div>' +
      '<div class="btn-row"><button class="btn" data-action="edit-athlete" data-id="' + esc(m.id) + '">' + icon('pen') + 'Editar</button><button class="btn ghost" data-action="pick-athlete">Cambiar de atleta</button></div></section>';
  } else {
    html += '<section class="card"><span class="eyebrow">Atleta</span><h2 class="h-display h2">¿Quién eres?</h2><p class="muted">Elige tu atleta para que los tiempos que apuntes cuenten para ti.</p></section>';
  }
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">La cuadrilla</h2><button class="link" data-action="new-athlete">+ Nuevo atleta</button></div>';
  if (state.athletes.length) {
    html += '<div class="athlete-grid">' + state.athletes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) => '<button class="athlete-card" data-action="select-athlete" data-id="' + esc(a.id) + '" aria-pressed="' + (a.id === state.meId) + '" aria-label="' + esc(a.name) + '">' + avatar(a, 'lg') + '<span class="nm">' + esc(a.name) + '</span><span class="small muted">' + (rows.find((r) => r.athlete.id === a.id) || { total: 0 }).total + ' pts</span></button>').join('') + '</div>';
  } else {
    html += '<p class="muted">Todavía no hay nadie apuntado.</p>';
  }
  html += '</section>';
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Sincronización</h2></div>' +
    (mode === 'local'
      ? '<div class="banner"><span class="dot"></span><span>Modo local: los datos solo están en este dispositivo.</span></div><p class="small muted">Para compartir con la cuadrilla, crea una base de datos gratuita en Firebase y pega su configuración aquí (o en el archivo de la app, para que valga para todos).</p><button class="btn" data-action="firebase-config">Configurar Firebase</button>'
      : '<div class="banner live"><span class="dot"></span><span>' + (mode === 'firebase' ? 'Conectado a Firebase: todos veis los mismos datos.' : 'Base de datos compartida del Artifact.') + '</span></div>' + (mode === 'firebase' && !FIREBASE_CONFIG ? '<button class="btn ghost sm" data-action="firebase-forget">Quitar configuración de este dispositivo</button>' : '')) +
    '<div class="btn-row"><button class="btn ghost" data-action="export">Exportar copia</button><button class="btn ghost" data-action="import">Importar copia</button></div></section>';
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Ajustes</h2></div>' +
    '<label class="check"><input type="checkbox" data-action="toggle-sound" ' + (state.sound ? 'checked' : '') + '> Pitidos del cronómetro</label>' +
    '<p class="faint small">La Pizarra v' + APP_VERSION + ' · ' + HEROES.length + ' Hero WODs y ' + GIRLS.length + ' Girls de crossfit.com</p></section>';
  return html + '</div>';
}

/* ============================================================
   CRONÓMETRO
   ============================================================ */
const timer = {
  mode: 'fortime',
  cfg: { capMin: 0, amrapMin: 12, emomSec: 60, emomRounds: 10, workSec: 20, restSec: 10, tabRounds: 8, prepSec: 10 },
  status: 'idle', // idle | prep | running | paused | done
  t0: 0, acc: 0, prepAcc: 0,
  rounds: 0, laps: [], workoutId: null,
  lastSec: -1, lastPhase: '', iv: 0, endReason: '', finalSec: 0,
  wake: null,
};
let actx = null;
function beep(freq, dur, vol) {
  if (!state.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'square'; o.frequency.value = freq || 880;
    o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime; const v = vol || 0.25; const d = dur || 0.12;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.start(t); o.stop(t + d + 0.02);
  } catch (e) { }
}
const beepShort = () => beep(880, 0.12);
const beepLong = () => beep(660, 0.55, 0.3);
const beepRest = () => beep(440, 0.3);
async function wakeLock(on) {
  try {
    if (on && navigator.wakeLock && !timer.wake) timer.wake = await navigator.wakeLock.request('screen');
    if (!on && timer.wake) { await timer.wake.release(); timer.wake = null; }
  } catch (e) { timer.wake = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && (timer.status === 'running' || timer.status === 'prep')) wakeLock(true); });

function timerTotal() {
  const c = timer.cfg;
  if (timer.mode === 'amrap') return c.amrapMin * 60;
  if (timer.mode === 'emom') return c.emomSec * c.emomRounds;
  if (timer.mode === 'tabata') return (c.workSec + c.restSec) * c.tabRounds - c.restSec;
  if (timer.mode === 'fortime') return c.capMin ? c.capMin * 60 : 0;
  return 0;
}
function elapsed() {
  const now = performance.now();
  if (timer.status === 'running') return timer.acc + (now - timer.t0) / 1000;
  return timer.acc;
}
function prepElapsed() { return timer.status === 'prep' ? timer.prepAcc + (performance.now() - timer.t0) / 1000 : timer.prepAcc; }

function timerStart() {
  if (timer.status !== 'idle') return;
  actx = actx || (window.AudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null);
  if (actx && actx.state === 'suspended') actx.resume();
  timer.acc = 0; timer.prepAcc = 0; timer.rounds = 0; timer.laps = []; timer.lastSec = -1; timer.lastPhase = ''; timer.endReason = ''; timer.finalSec = 0;
  timer.t0 = performance.now();
  timer.status = timer.cfg.prepSec > 0 ? 'prep' : 'running';
  wakeLock(true);
  clearInterval(timer.iv); timer.iv = setInterval(timerTick, 100);
  render(); timerTick();
}
function timerSkipPrep() { if (timer.status !== 'prep') return; timer.status = 'running'; timer.t0 = performance.now(); timer.acc = 0; timer.lastSec = -1; beepLong(); render(); }
function timerPause() { if (timer.status !== 'running') return; timer.acc = elapsed(); timer.status = 'paused'; render(); }
function timerResume() { if (timer.status !== 'paused') return; timer.t0 = performance.now(); timer.status = 'running'; render(); timerTick(); }
function timerFinish(reason) {
  if (timer.status === 'idle' || timer.status === 'done') return;
  timer.finalSec = timer.status === 'prep' ? 0 : elapsed();
  timer.acc = timer.finalSec; timer.status = 'done'; timer.endReason = reason || 'manual';
  clearInterval(timer.iv); wakeLock(false); beepLong(); setTimeout(beepLong, 350);
  render();
}
function timerReset() { clearInterval(timer.iv); timer.status = 'idle'; timer.acc = 0; timer.rounds = 0; timer.laps = []; wakeLock(false); render(); }
function timerRound() {
  if (timer.status !== 'running' && timer.status !== 'paused') return;
  timer.rounds++; timer.laps.push(elapsed());
  const el = $('#round-val'); if (el) el.textContent = timer.rounds;
  const laps = $('#laps'); if (laps) laps.innerHTML = lapsHtml();
  beep(1200, 0.08, 0.15);
}
function lapsHtml() { return timer.laps.map((t, i) => '<span>' + (i + 1) + ' · ' + fmtTime(t) + '</span>').join(''); }

function timerTick() {
  if (timer.status === 'prep') {
    const remaining = timer.cfg.prepSec - prepElapsed();
    const sec = Math.ceil(remaining);
    if (remaining <= 0) { timer.status = 'running'; timer.t0 = performance.now(); timer.acc = 0; timer.lastSec = -1; beepLong(); render(); return; }
    if (sec !== timer.lastSec) { timer.lastSec = sec; if (sec <= 3) beepShort(); }
    setStage('prep', 'Preparados', String(sec), timerModeLabel(), true);
    return;
  }
  if (timer.status !== 'running') return;
  const e = elapsed(); const c = timer.cfg; const total = timerTotal();
  const whole = Math.floor(e);
  const newSec = whole !== timer.lastSec; timer.lastSec = whole;
  if (timer.mode === 'fortime') {
    if (total && e >= total) { timerFinish('cap'); return; }
    if (total && newSec && total - whole <= 3 && total - whole > 0) beepShort();
    setStage('work', total ? 'For time · cap ' + fmtTime(total) : 'For time', fmtTime(whole), timer.rounds ? timer.rounds + ' rondas' : 'Tiempo corriendo');
  } else if (timer.mode === 'amrap') {
    const rem = total - e;
    if (rem <= 0) { timerFinish('time'); return; }
    const r = Math.ceil(rem);
    if (newSec && r <= 3) beepShort();
    setStage('work', 'AMRAP ' + c.amrapMin + '’', fmtTime(r), timer.rounds + ' ronda' + (timer.rounds === 1 ? '' : 's'));
  } else if (timer.mode === 'emom') {
    if (e >= total) { timerFinish('time'); return; }
    const idx = Math.floor(e / c.emomSec); const within = e - idx * c.emomSec; const rem = Math.ceil(c.emomSec - within);
    const phase = 'r' + idx;
    if (phase !== timer.lastPhase) { timer.lastPhase = phase; if (idx > 0) beepLong(); }
    else if (newSec && rem <= 3 && rem > 0) beepShort();
    setStage('work', 'EMOM · ronda ' + (idx + 1) + ' de ' + c.emomRounds, fmtTime(rem), 'total ' + fmtTime(whole));
  } else if (timer.mode === 'tabata') {
    if (e >= total) { timerFinish('time'); return; }
    const cycle = c.workSec + c.restSec; const idx = Math.floor(e / cycle); const within = e - idx * cycle;
    const work = within < c.workSec; const rem = Math.ceil(work ? c.workSec - within : cycle - within);
    const phase = idx + (work ? 'w' : 'r');
    if (phase !== timer.lastPhase) { timer.lastPhase = phase; if (work && idx > 0) beepLong(); else if (!work) beepRest(); }
    else if (newSec && rem <= 3 && rem > 0) beepShort();
    setStage(work ? 'work' : 'rest', (work ? 'TRABAJO' : 'DESCANSO') + ' · ' + (idx + 1) + ' de ' + c.tabRounds, String(rem), 'total ' + fmtTime(whole));
  }
}
function setStage(cls, stateText, clock, sub, big) {
  const st = $('#tstage'); if (!st) return;
  st.className = 'timer-stage ' + cls;
  $('#tstate').textContent = stateText;
  const ck = $('#clock'); ck.textContent = clock; ck.className = 'clock' + (big || clock.length <= 2 ? '' : clock.length > 5 ? ' small' : '');
  $('#tsub').textContent = sub || '';
}
function timerModeLabel() {
  const c = timer.cfg;
  return { fortime: 'For time' + (c.capMin ? ' · cap ' + c.capMin + '’' : ''), amrap: 'AMRAP ' + c.amrapMin + '’', emom: 'EMOM ' + c.emomRounds + ' × ' + c.emomSec + ' s', tabata: 'Tabata ' + c.workSec + '/' + c.restSec + ' × ' + c.tabRounds }[timer.mode];
}
function timerApplyWorkout(w) {
  timer.workoutId = w ? w.id : null;
  if (!w) return;
  if (w.type === 'amrap' && w.durationMin) { timer.mode = 'amrap'; timer.cfg.amrapMin = w.durationMin; }
  else if (w.type === 'emom') { timer.mode = 'emom'; timer.cfg.emomSec = w.intervalSec || 60; timer.cfg.emomRounds = w.rounds || 10; }
  else if (w.type === 'tabata') { timer.mode = 'tabata'; timer.cfg.workSec = w.workSec || 20; timer.cfg.restSec = w.restSec || 10; timer.cfg.tabRounds = w.rounds || 8; }
  else if (w.scoreType === 'reps' && w.durationMin) { timer.mode = 'amrap'; timer.cfg.amrapMin = w.durationMin; }
  else { timer.mode = 'fortime'; timer.cfg.capMin = w.timeCapMin || 0; }
}
function stepper(id, label, value, min, max, step, unit) {
  return '<div class="field"><span class="label">' + esc(label) + '</span><div class="stepper"><button type="button" data-action="step" data-id="' + id + '" data-d="-1" aria-label="Menos">−</button><input type="number" id="' + id + '" value="' + value + '" min="' + min + '" max="' + max + '" step="' + step + '" data-action="cfg" inputmode="numeric"><button type="button" data-action="step" data-id="' + id + '" data-d="1" aria-label="Más">+</button></div>' + (unit ? '<span class="hint">' + esc(unit) + '</span>' : '') + '</div>';
}
function viewTimer() {
  const w = timer.workoutId ? getWorkout(timer.workoutId) : null;
  const c = timer.cfg; const s = timer.status;
  let html = '<div class="view timer">';
  if (s === 'idle') {
    html += '<div class="timer-config">' +
      (w ? '<div class="banner live" style="justify-content:space-between"><span><b>' + esc(w.name) + '</b> · ' + esc(workoutMeta(w).join(' · ')) + '</span><button class="icon-btn" data-action="timer-detach" aria-label="Quitar entreno">' + icon('x') + '</button></div>' : '') +
      '<div class="segmented" role="tablist">' + ['fortime', 'amrap', 'emom', 'tabata'].map((m) => '<button data-action="timer-mode" data-mode="' + m + '" aria-pressed="' + (timer.mode === m) + '">' + TYPE_LABEL[m] + '</button>').join('') + '</div>' +
      '<div class="inline-fields">' +
      (timer.mode === 'fortime' ? stepper('capMin', 'Time cap (min)', c.capMin, 0, 180, 1, '0 = sin cap') : '') +
      (timer.mode === 'amrap' ? stepper('amrapMin', 'Minutos', c.amrapMin, 1, 120, 1) : '') +
      (timer.mode === 'emom' ? stepper('emomSec', 'Cada (segundos)', c.emomSec, 10, 600, 10) + stepper('emomRounds', 'Rondas', c.emomRounds, 1, 60, 1) : '') +
      (timer.mode === 'tabata' ? stepper('workSec', 'Trabajo (s)', c.workSec, 5, 300, 5) + stepper('restSec', 'Descanso (s)', c.restSec, 0, 300, 5) + stepper('tabRounds', 'Rondas', c.tabRounds, 1, 30, 1) : '') +
      stepper('prepSec', 'Cuenta atrás (s)', c.prepSec, 0, 30, 1) +
      '</div></div>';
    html += '<div class="timer-stage" id="tstage"><span class="state" id="tstate">' + esc(timerModeLabel()) + '</span><span class="clock" id="clock">' + (timer.mode === 'fortime' ? '0:00' : fmtTime(timerTotal())) + '</span><span class="sub" id="tsub">' + (w ? '' : 'Listo') + '</span>' + (w ? '<span class="wod-name">' + esc(w.name) + '</span>' : '') + '</div>';
    html += '<div class="timer-controls"><button class="btn primary big full" data-action="timer-start">' + icon('play') + 'Empezar</button></div>';
  } else {
    html += '<div class="timer-stage" id="tstage"><span class="state" id="tstate"></span><span class="clock" id="clock">' + (s === 'done' ? fmtTime(timer.finalSec) : '') + '</span><span class="sub" id="tsub"></span>' + (w ? '<span class="wod-name">' + esc(w.name) + '</span>' : '') + '</div>';
    if (s === 'prep') {
      html += '<div class="timer-controls"><button class="btn big" data-action="timer-skip">Saltar cuenta atrás</button><button class="btn ghost big" data-action="timer-reset">Cancelar</button></div>';
    } else if (s === 'running' || s === 'paused') {
      const showRounds = timer.mode === 'fortime' || timer.mode === 'amrap';
      html += (showRounds ? '<div class="round-counter"><span><span class="val" id="round-val">' + timer.rounds + '</span><span class="lbl">' + (timer.mode === 'amrap' ? 'rondas' : 'vueltas') + '</span></span><span class="laps" id="laps">' + lapsHtml() + '</span><button class="btn primary" data-action="timer-round">+1 ' + (timer.mode === 'amrap' ? 'ronda' : 'vuelta') + '</button></div>' : '') +
        '<div class="timer-controls">' + (s === 'running' ? '<button class="btn big" data-action="timer-pause">Pausa</button>' : '<button class="btn primary big" data-action="timer-resume">Reanudar</button>') +
        '<button class="btn danger big" data-action="timer-finish">Terminar</button>' + (s === 'paused' ? '<button class="btn ghost full" data-action="timer-reset">Reiniciar</button>' : '') + '</div>';
    } else if (s === 'done') {
      const endText = timer.endReason === 'cap' ? 'Time cap' : timer.endReason === 'time' ? 'Tiempo cumplido' : 'Terminado';
      const summary = timer.mode === 'amrap' ? timer.rounds + ' ronda' + (timer.rounds === 1 ? '' : 's') + ' completas' : timer.mode === 'fortime' ? (timer.endReason === 'cap' ? 'Se acabó el tiempo' : 'Tiempo final') : 'Sesión completada';
      html += '<div class="card" style="text-align:center"><span class="eyebrow">' + esc(endText) + '</span><div class="h-display h1">' + esc(timer.mode === 'amrap' ? timer.rounds + ' rd' : fmtTime(timer.finalSec)) + '</div><span class="muted">' + esc(summary) + (timer.mode === 'amrap' && timer.endReason !== 'time' ? ' · parado a los ' + fmtTime(timer.finalSec) : '') + '</span>' + (timer.laps.length ? '<div class="laps" style="justify-content:center">' + lapsHtml() + '</div>' : '') + '</div>';
      html += '<div class="timer-controls"><button class="btn primary big" data-action="timer-save">Apuntar resultado</button><button class="btn ghost big" data-action="timer-reset">Reiniciar</button></div>';
    }
  }
  return html + '</div>';
}
function afterRenderTimer() {
  if (state.view !== 'timer') return;
  if (timer.status === 'prep' || timer.status === 'running') timerTick();
  else if (timer.status === 'paused') { setStage('', 'En pausa', timer.mode === 'amrap' ? fmtTime(Math.ceil(timerTotal() - timer.acc)) : fmtTime(Math.floor(timer.acc)), timerModeLabel()); }
  else if (timer.status === 'done') { setStage('done', timer.endReason === 'cap' ? 'Time cap' : timer.endReason === 'time' ? 'Tiempo cumplido' : 'Terminado a los ' + fmtTime(timer.finalSec), timer.mode === 'amrap' ? (timer.rounds + ' rd') : fmtTime(timer.finalSec), timerModeLabel()); }
}

/* ============================================================
   Formularios
   ============================================================ */
function workoutOptions(selected) {
  const custom = state.workouts.slice().sort((a, b) => a.name.localeCompare(b.name));
  const opt = (w) => '<option value="' + esc(w.id) + '"' + (w.id === selected ? ' selected' : '') + '>' + esc(w.name) + '</option>';
  return '<option value="">— Elige un entreno —</option>' +
    (custom.length ? '<optgroup label="Nuestros">' + custom.map(opt).join('') + '</optgroup>' : '') +
    '<optgroup label="Girls">' + builtinWorkouts().filter((w) => w.category === 'girl').map(opt).join('') + '</optgroup>' +
    '<optgroup label="Héroes">' + builtinWorkouts().filter((w) => w.category === 'hero').map(opt).join('') + '</optgroup>';
}
function scoreFields(scoreType, pre) {
  pre = pre || {};
  if (scoreType === 'time') {
    const s = pre.seconds || 0; const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return '<div class="field"><span class="label">Tiempo</span><div class="time-input" style="grid-template-columns:1fr auto 1fr auto 1fr"><input type="number" id="f-h" min="0" max="23" placeholder="h" value="' + (h || '') + '" inputmode="numeric"><span class="colon">:</span><input type="number" id="f-m" min="0" max="59" placeholder="min" value="' + (pre.seconds != null ? mm : '') + '" inputmode="numeric"><span class="colon">:</span><input type="number" id="f-s" min="0" max="59" placeholder="seg" value="' + (pre.seconds != null ? ss : '') + '" inputmode="numeric"></div></div>' +
      '<label class="check"><input type="checkbox" id="f-capped" data-action="toggle-capped"' + (pre.finished === false ? ' checked' : '') + '> No lo terminé (time cap)</label>' +
      '<div class="field" id="f-capped-reps"' + (pre.finished === false ? '' : ' hidden') + '><label for="f-reps">Reps completadas al llegar al cap</label><input type="number" id="f-reps" min="0" value="' + (pre.reps || '') + '" inputmode="numeric"></div>';
  }
  if (scoreType === 'rounds') return '<div class="inline-fields"><div class="field"><label for="f-rounds">Rondas completas</label><input type="number" id="f-rounds" min="0" value="' + (pre.rounds != null ? pre.rounds : '') + '" inputmode="numeric"></div><div class="field"><label for="f-reps">Reps de la última</label><input type="number" id="f-reps" min="0" value="' + (pre.reps || 0) + '" inputmode="numeric"></div></div>';
  if (scoreType === 'reps') return '<div class="field"><label for="f-reps">Reps totales</label><input type="number" id="f-reps" min="0" value="' + (pre.reps != null ? pre.reps : '') + '" inputmode="numeric"></div>';
  if (scoreType === 'load') return '<div class="field"><label for="f-load">Peso (kg)</label><input type="number" id="f-load" min="0" step="0.5" value="' + (pre.load != null ? pre.load : '') + '" inputmode="decimal"></div>';
  return '';
}
function openLogResult(workoutId, pre) {
  pre = pre || {};
  const w = workoutId ? getWorkout(workoutId) : null;
  const athletes = state.athletes.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!athletes.length) { openNewAthlete(); return; }
  const body =
    '<div class="field"><label for="f-wod">Entreno</label><select id="f-wod" data-action="log-wod-change">' + workoutOptions(w ? w.id : '') + '</select>' + (w ? '<span class="hint">' + esc(workoutMeta(w).join(' · ')) + ' · se puntúa por ' + esc(SCORE_LABEL[w.scoreType]) + '</span>' : '') + '</div>' +
    '<div class="inline-fields"><div class="field"><label for="f-athlete">Atleta</label><select id="f-athlete">' + athletes.map((a) => '<option value="' + esc(a.id) + '"' + (a.id === (pre.athleteId || state.meId) ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="f-date">Fecha</label><input type="date" id="f-date" value="' + esc(pre.date || todayISO()) + '" max="' + todayISO() + '"></div></div>' +
    '<div id="f-score">' + (w ? scoreFields(w.scoreType, pre) : '<p class="muted small">Elige un entreno para ver qué se apunta.</p>') + '</div>' +
    '<label class="check"><input type="checkbox" id="f-rx"' + (pre.rx ? ' checked' : '') + '> Rx (tal cual está escrito, con las cargas prescritas)</label>' +
    '<div class="field"><label for="f-notes">Notas</label><input type="text" id="f-notes" placeholder="Escalado a 40 kg, con chaleco, etc." value="' + esc(pre.notes || '') + '" maxlength="140"></div>' +
    '<p class="form-error" id="f-error"></p>';
  openSheet({ title: 'Apuntar resultado', body, foot: '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="save-result">Guardar</button>' });
}
function readTime() {
  const h = Number($('#f-h').value || 0), m = Number($('#f-m').value || 0), s = Number($('#f-s').value || 0);
  if ([h, m, s].some((n) => isNaN(n) || n < 0) || m > 59 || s > 59) return null;
  return Math.round(h * 3600 + m * 60 + s);
}
async function saveResult() {
  const err = $('#f-error'); err.textContent = '';
  const wid = $('#f-wod').value; const w = getWorkout(wid);
  if (!w) { err.textContent = 'Elige un entreno.'; return; }
  const athleteId = $('#f-athlete').value; const date = $('#f-date').value;
  if (!athleteById(athleteId)) { err.textContent = 'Elige un atleta.'; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = 'Pon una fecha válida.'; return; }
  if (date > todayISO()) { err.textContent = 'La fecha no puede ser futura.'; return; }
  const r = { id: uid(), athleteId, workoutId: w.id, workoutName: w.name, category: w.category, scoreType: w.scoreType, date, rx: $('#f-rx').checked, notes: $('#f-notes').value.trim(), createdAt: nowISO(), createdBy: state.meId || athleteId };
  if (w.scoreType === 'time') {
    const capped = $('#f-capped').checked;
    if (capped) {
      const reps = Number($('#f-reps').value);
      if (!(reps >= 0) || $('#f-reps').value === '') { err.textContent = 'Indica las reps completadas al llegar al cap.'; return; }
      r.finished = false; r.reps = reps; r.seconds = w.timeCapMin ? w.timeCapMin * 60 : (readTime() || 0);
    } else {
      const sec = readTime();
      if (sec == null || sec <= 0) { err.textContent = 'Pon el tiempo en minutos y segundos.'; return; }
      r.finished = true; r.seconds = sec;
    }
  } else if (w.scoreType === 'rounds') {
    const rounds = Number($('#f-rounds').value), reps = Number($('#f-reps').value || 0);
    if ($('#f-rounds').value === '' || !(rounds >= 0) || !(reps >= 0)) { err.textContent = 'Pon las rondas completas (y las reps de la última, si las hay).'; return; }
    r.rounds = rounds; r.reps = reps;
  } else if (w.scoreType === 'reps') {
    const reps = Number($('#f-reps').value);
    if ($('#f-reps').value === '' || !(reps >= 0)) { err.textContent = 'Pon las reps totales.'; return; }
    r.reps = reps;
  } else if (w.scoreType === 'load') {
    const load = Number($('#f-load').value);
    if (!(load > 0)) { err.textContent = 'Pon el peso en kilos.'; return; }
    r.load = load;
  }
  try {
    await state.store.set('results', r.id, r);
    closeSheet();
    const pr = isPR(Object.assign({}, r));
    toast(pr ? '¡PR! ' + fmtScore(r) + ' en ' + w.name : 'Apuntado: ' + fmtScore(r) + ' en ' + w.name);
    if (state.view === 'timer') { timerReset(); go('wod', { id: w.id }); }
  } catch (e) { err.textContent = 'No se pudo guardar: ' + (e.message || e); }
}
function openWorkoutForm(existing, presetDate) {
  const w = existing || { name: '', type: 'fortime', scoreType: 'time', durationMin: 12, timeCapMin: 0, intervalSec: 60, rounds: 10, workSec: 20, restSec: 10, description: '', scheduledDate: presetDate || '' };
  const body =
    '<div class="field"><label for="w-name">Nombre</label><input type="text" id="w-name" value="' + esc(w.name) + '" placeholder="Ej. Viernes de infierno" maxlength="60"></div>' +
    '<div class="inline-fields"><div class="field"><label for="w-type">Formato</label><select id="w-type" data-action="w-type-change">' + ['fortime', 'amrap', 'emom', 'tabata', 'interval', 'strength', 'other'].map((t) => '<option value="' + t + '"' + (w.type === t ? ' selected' : '') + '>' + TYPE_LABEL[t] + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="w-score">Se puntúa por</label><select id="w-score">' + ['time', 'rounds', 'reps', 'load'].map((s) => '<option value="' + s + '"' + (w.scoreType === s ? ' selected' : '') + '>' + SCORE_LABEL[s] + '</option>').join('') + '</select></div></div>' +
    '<div id="w-params">' + workoutParams(w) + '</div>' +
    '<div class="field"><label for="w-desc">Entreno</label><textarea id="w-desc" placeholder="21-15-9 reps for time of:&#10;Thrusters 43/30 kg&#10;Pull-ups">' + esc(w.description) + '</textarea><span class="hint">Una línea por movimiento. Pon las cargas para que quede claro qué es Rx.</span></div>' +
    '<div class="field"><label for="w-date">Programar para (opcional)</label><input type="date" id="w-date" value="' + esc(w.scheduledDate || '') + '"><span class="hint">Saldrá como “WOD de hoy” ese día.</span></div>' +
    '<p class="form-error" id="w-error"></p>';
  openSheet({ title: existing ? 'Editar entreno' : 'Nuevo entreno', body, foot: '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="save-workout" data-id="' + esc(existing ? existing.id : '') + '">Guardar</button>' });
}
function workoutParams(w) {
  const t = w.type;
  if (t === 'amrap') return '<div class="field"><label for="w-dur">Minutos</label><input type="number" id="w-dur" min="1" max="120" value="' + (w.durationMin || 12) + '" inputmode="numeric"></div>';
  if (t === 'fortime' || t === 'interval') return '<div class="field"><label for="w-cap">Time cap (min, 0 = sin cap)</label><input type="number" id="w-cap" min="0" max="180" value="' + (w.timeCapMin || 0) + '" inputmode="numeric"></div>';
  if (t === 'emom') return '<div class="inline-fields"><div class="field"><label for="w-int">Cada (segundos)</label><input type="number" id="w-int" min="10" step="10" value="' + (w.intervalSec || 60) + '" inputmode="numeric"></div><div class="field"><label for="w-rounds">Rondas</label><input type="number" id="w-rounds" min="1" value="' + (w.rounds || 10) + '" inputmode="numeric"></div></div>';
  if (t === 'tabata') return '<div class="inline-fields three"><div class="field"><label for="w-work">Trabajo (s)</label><input type="number" id="w-work" min="5" value="' + (w.workSec || 20) + '" inputmode="numeric"></div><div class="field"><label for="w-rest">Descanso (s)</label><input type="number" id="w-rest" min="0" value="' + (w.restSec == null ? 10 : w.restSec) + '" inputmode="numeric"></div><div class="field"><label for="w-rounds">Rondas</label><input type="number" id="w-rounds" min="1" value="' + (w.rounds || 8) + '" inputmode="numeric"></div></div>';
  return '';
}
const DEFAULT_SCORE = { fortime: 'time', amrap: 'rounds', emom: 'reps', tabata: 'reps', interval: 'time', strength: 'load', other: 'reps' };
async function saveWorkout(existingId) {
  const err = $('#w-error'); err.textContent = '';
  const name = $('#w-name').value.trim(); const type = $('#w-type').value; const scoreType = $('#w-score').value;
  const description = $('#w-desc').value.trim(); const scheduledDate = $('#w-date').value;
  if (!name) { err.textContent = 'Ponle un nombre al entreno.'; return; }
  if (!description) { err.textContent = 'Escribe el entreno (movimientos y reps).'; return; }
  if (scheduledDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) { err.textContent = 'Fecha no válida.'; return; }
  const num = (id, def) => { const el = $(id); const v = el ? Number(el.value) : NaN; return isNaN(v) ? def : v; };
  const existing = existingId ? state.workouts.find((x) => x.id === existingId) : null;
  const w = Object.assign({}, existing || {}, {
    id: existingId || uid(), name, type, scoreType, description, scheduledDate: scheduledDate || '',
    durationMin: type === 'amrap' ? clamp(num('#w-dur', 12), 1, 120) : 0,
    timeCapMin: (type === 'fortime' || type === 'interval') ? clamp(num('#w-cap', 0), 0, 180) : 0,
    intervalSec: type === 'emom' ? clamp(num('#w-int', 60), 10, 600) : 0,
    rounds: type === 'emom' ? clamp(num('#w-rounds', 10), 1, 60) : type === 'tabata' ? clamp(num('#w-rounds', 8), 1, 30) : 0,
    workSec: type === 'tabata' ? clamp(num('#w-work', 20), 5, 300) : 0,
    restSec: type === 'tabata' ? clamp(num('#w-rest', 10), 0, 300) : 0,
    createdBy: existing ? existing.createdBy : (state.meId || ''),
    createdAt: existing ? existing.createdAt : nowISO(), updatedAt: nowISO(),
  });
  try {
    await state.store.set('workouts', w.id, w);
    closeSheet(); toast(existing ? 'Entreno actualizado' : 'Entreno creado: ' + w.name);
    go('wod', { id: w.id });
  } catch (e) { err.textContent = 'No se pudo guardar: ' + (e.message || e); }
}
function openNewAthlete(existing) {
  const a = existing || { name: '', color: COLORS[state.athletes.length % COLORS.length] };
  const body = (existing ? '' : (state.athletes.length ? '' : '<p class="muted">Bienvenido a La Pizarra. Crea tu atleta para empezar a apuntar tiempos.</p>')) +
    '<div class="field"><label for="a-name">Nombre</label><input type="text" id="a-name" value="' + esc(a.name) + '" placeholder="Como te llaman en el box" maxlength="30"></div>' +
    '<div class="field"><span class="label">Tu disco</span><div class="color-picks">' + COLORS.map((c) => '<button type="button" data-action="pick-color" data-color="' + c + '" aria-pressed="' + (a.color === c) + '" aria-label="' + esc(COLOR_LABEL[c]) + '" title="' + esc(COLOR_LABEL[c]) + '" style="--c:var(--plate-' + (c === 'black' ? 'white' : c) + ')' + (c === 'black' ? ';background:#3a3f39' : '') + '"></button>').join('') + '</div></div>' +
    '<p class="form-error" id="a-error"></p>';
  openSheet({ title: existing ? 'Editar atleta' : 'Nuevo atleta', body, foot: (existing ? '<button class="btn danger" data-action="delete-athlete" data-id="' + esc(existing.id) + '">' + icon('trash') + '</button>' : '') + '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="save-athlete" data-id="' + esc(existing ? existing.id : '') + '">Guardar</button>' });
}
async function saveAthlete(existingId) {
  const err = $('#a-error'); err.textContent = '';
  const name = $('#a-name').value.trim();
  const colorBtn = $('.color-picks [aria-pressed="true"]'); const color = colorBtn ? colorBtn.dataset.color : 'red';
  if (name.length < 2) { err.textContent = 'Pon un nombre (mínimo 2 letras).'; $('#a-name').focus(); return; }
  if (state.athletes.some((a) => a.id !== existingId && a.name.toLowerCase() === name.toLowerCase())) { err.textContent = 'Ya hay un atleta con ese nombre.'; $('#a-name').focus(); return; }
  const existing = existingId ? athleteById(existingId) : null;
  const a = Object.assign({}, existing || {}, { id: existingId || uid(), name, color, createdAt: existing ? existing.createdAt : nowISO() });
  try {
    await state.store.set('athletes', a.id, a);
    if (!existing) { state.athletes = state.athletes.filter((x) => x.id !== a.id).concat([a]); setMe(a.id); }
    closeSheet(); toast(existing ? 'Atleta actualizado' : '¡Bienvenido, ' + a.name + '!'); render();
  } catch (e) { err.textContent = 'No se pudo guardar: ' + (e.message || e); }
}
function openPickAthlete() {
  if (!state.athletes.length) { openNewAthlete(); return; }
  const body = '<p class="muted">¿Quién está usando este móvil? Los tiempos que apuntes contarán para ese atleta.</p><div class="athlete-grid">' + state.athletes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) => '<button class="athlete-card" data-action="select-athlete" data-id="' + esc(a.id) + '" aria-pressed="' + (a.id === state.meId) + '" aria-label="' + esc(a.name) + '">' + avatar(a, 'lg') + '<span class="nm">' + esc(a.name) + '</span></button>').join('') + '</div>';
  openSheet({ title: '¿Quién eres?', body, focus: false, foot: '<button class="btn" data-action="new-athlete">+ Soy nuevo</button>' });
}
function openFirebaseConfig() {
  const cur = readLocalFirebaseConfig();
  const body = '<p class="small muted">Pega el objeto de configuración de tu proyecto de Firebase (Consola → Configuración del proyecto → Tus apps → SDK). Añade <code>groupKey</code> con una palabra para vuestro grupo. Se guarda solo en este dispositivo; para que valga para todos, ponlo en el archivo de la app.</p>' +
    '<div class="field"><label for="fb-json">Configuración</label><textarea id="fb-json" placeholder=\'{ "apiKey": "...", "databaseURL": "https://....firebasedatabase.app", "projectId": "...", "groupKey": "cuadrilla" }\'>' + esc(cur ? JSON.stringify(cur, null, 2) : '') + '</textarea></div><p class="form-error" id="fb-error"></p>';
  openSheet({ title: 'Configurar Firebase', body, foot: '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="save-firebase">Guardar y recargar</button>' });
}
function exportData() {
  const data = state.store.exportAll ? state.store.exportAll() : { app: 'la-pizarra', version: APP_VERSION, exportedAt: nowISO(), athletes: Object.fromEntries(state.athletes.map((a) => [a.id, a])), workouts: Object.fromEntries(state.workouts.map((w) => [w.id, w])), results: Object.fromEntries(state.results.map((r) => [r.id, r])) };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'la-pizarra-' + todayISO() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  toast('Copia exportada');
}
function importData() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.app !== 'la-pizarra') throw new Error('No es una copia de La Pizarra');
      let n = 0;
      for (const c of COLS) { for (const id in (data[c] || {})) { await state.store.set(c, id, data[c][id]); n++; } }
      toast('Importados ' + n + ' registros');
    } catch (e) { toast('No se pudo importar: ' + e.message, true); }
  };
  input.click();
}

/* ============================================================
   Navegación y acciones
   ============================================================ */
function go(view, params) {
  state.view = view; state.params = params || {}; state.expanded = null;
  window.scrollTo(0, 0);
  render();
}
function render() {
  renderTopbar(); renderTabs();
  const views = { home: viewHome, wods: viewWods, wod: viewWod, timer: viewTimer, ranking: viewRanking, profile: viewProfile };
  $('#main').innerHTML = (views[state.view] || viewHome)();
  afterRenderTimer();
}
const ACTIONS = {
  'go': (el) => go(el.dataset.view),
  'open-wod': (el) => go('wod', { id: el.dataset.id }),
  'wod-tab': (el) => { state.wodTab = el.dataset.tab; state.search = ''; render(); },
  'period': (el) => { state.period = el.dataset.period; state.expanded = null; render(); },
  'expand': (el) => { state.expanded = state.expanded === el.dataset.id ? null : el.dataset.id; render(); },
  'pick-athlete': () => openPickAthlete(),
  'new-athlete': () => openNewAthlete(),
  'edit-athlete': (el) => openNewAthlete(athleteById(el.dataset.id)),
  'select-athlete': (el) => { setMe(el.dataset.id); closeSheet(); toast('Ahora eres ' + (athleteById(el.dataset.id) || { name: '?' }).name); render(); },
  'pick-color': (el) => { $$('.color-picks button').forEach((b) => b.setAttribute('aria-pressed', b === el)); },
  'save-athlete': (el) => saveAthlete(el.dataset.id || null),
  'delete-athlete': async (el) => {
    const a = athleteById(el.dataset.id); if (!a) return;
    const n = state.results.filter((r) => r.athleteId === a.id).length;
    if (await confirmSheet('Borrar atleta', '¿Borrar a ' + a.name + '? ' + (n ? 'Sus ' + n + ' resultados dejarán de contar en la clasificación.' : ''))) {
      await state.store.remove('athletes', a.id); if (state.meId === a.id) setMe(null); toast('Atleta borrado'); render();
    } else closeSheet();
  },
  'new-workout': (el) => openWorkoutForm(null, el.dataset.date || ''),
  'edit-workout': (el) => { const w = state.workouts.find((x) => x.id === el.dataset.id); if (w) openWorkoutForm(w); },
  'delete-workout': async (el) => {
    const w = state.workouts.find((x) => x.id === el.dataset.id); if (!w) return;
    if (await confirmSheet('Borrar entreno', '¿Borrar “' + w.name + '”? Los resultados ya apuntados se conservan.')) { await state.store.remove('workouts', w.id); closeSheet(); toast('Entreno borrado'); go('wods'); }
    else closeSheet();
  },
  'save-workout': (el) => saveWorkout(el.dataset.id || null),
  'w-type-change': () => {
    const t = $('#w-type').value; $('#w-score').value = DEFAULT_SCORE[t];
    $('#w-params').innerHTML = workoutParams({ type: t, durationMin: 12, timeCapMin: 0, intervalSec: 60, rounds: t === 'tabata' ? 8 : 10, workSec: 20, restSec: 10 });
  },
  'log-result': (el) => openLogResult(el.dataset.id || (state.view === 'wod' ? state.params.id : null)),
  'log-wod-change': () => {
    const w = getWorkout($('#f-wod').value);
    $('#f-score').innerHTML = w ? scoreFields(w.scoreType) : '';
    const hint = $('#f-wod').parentElement.querySelector('.hint'); if (hint) hint.remove();
    if (w) $('#f-wod').insertAdjacentHTML('afterend', '<span class="hint">' + esc(workoutMeta(w).join(' · ')) + ' · se puntúa por ' + esc(SCORE_LABEL[w.scoreType]) + '</span>');
  },
  'toggle-capped': () => { const c = $('#f-capped').checked; $('#f-capped-reps').hidden = !c; },
  'save-result': () => saveResult(),
  'delete-result': async (el) => {
    const r = state.results.find((x) => x.id === el.dataset.id); if (!r) return;
    if (await confirmSheet('Borrar resultado', '¿Borrar ' + fmtScore(r) + ' de ' + r.workoutName + '?')) { await state.store.remove('results', r.id); closeSheet(); toast('Resultado borrado'); render(); }
    else closeSheet();
  },
  'close-sheet': () => closeSheet(),
  'sheet-backdrop': (el, e) => { if (e.target === el) closeSheet(); },
  'confirm-yes': () => { const f = pendingConfirm; pendingConfirm = null; if (f) f(true); },
  'confirm-no': () => { const f = pendingConfirm; pendingConfirm = null; if (f) f(false); },
  'timer-for': (el) => { const w = getWorkout(el.dataset.id); if (timer.status !== 'idle') timerReset(); timerApplyWorkout(w); go('timer'); },
  'timer-detach': () => { timer.workoutId = null; render(); },
  'timer-mode': (el) => { timer.mode = el.dataset.mode; render(); },
  'step': (el) => { const inp = $('#' + el.dataset.id); const step = Number(inp.step || 1); const v = clamp(Number(inp.value || 0) + Number(el.dataset.d) * step, Number(inp.min), Number(inp.max)); inp.value = v; timer.cfg[el.dataset.id] = v; render(); },
  'timer-start': () => timerStart(),
  'timer-skip': () => timerSkipPrep(),
  'timer-pause': () => timerPause(),
  'timer-resume': () => timerResume(),
  'timer-finish': () => timerFinish('manual'),
  'timer-reset': () => timerReset(),
  'timer-round': () => timerRound(),
  'timer-save': () => {
    const w = timer.workoutId ? getWorkout(timer.workoutId) : null;
    const pre = {};
    if (timer.mode === 'amrap') { pre.rounds = timer.rounds; pre.reps = 0; }
    else if (timer.mode === 'fortime') { if (timer.endReason === 'cap') { pre.finished = false; pre.reps = 0; } else pre.seconds = Math.round(timer.finalSec); }
    else pre.reps = 0;
    openLogResult(w ? w.id : null, pre);
  },
  'firebase-config': () => openFirebaseConfig(),
  'save-firebase': () => {
    const err = $('#fb-error'); err.textContent = '';
    try {
      const txt = $('#fb-json').value.trim();
      const cfg = txt ? JSON.parse(txt) : null;
      if (!cfg || !cfg.databaseURL) throw new Error('Falta databaseURL');
      localStorage.setItem(LS_PREFIX + 'firebase', JSON.stringify(cfg)); location.reload();
    } catch (e) { err.textContent = 'Configuración no válida: ' + e.message; }
  },
  'firebase-forget': () => { localStorage.removeItem(LS_PREFIX + 'firebase'); location.reload(); },
  'export': () => exportData(),
  'import': () => importData(),
  'toggle-sound': (el) => { state.sound = el.checked; localStorage.setItem(LS_PREFIX + 'sound', state.sound ? 'on' : 'off'); if (state.sound) beepShort(); },
};
function onAction(e) {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const fn = ACTIONS[el.dataset.action]; if (!fn) return;
  if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return; // los inputs se gestionan en change
  if (e.target.closest('input, select, textarea, label, a')) { if (el.dataset.action !== 'sheet-backdrop') fn(el, e); return; } // no bloquear checkboxes/labels dentro de una hoja
  fn(el, e);
}
function onChange(e) {
  const el = e.target.closest('[data-action]'); if (!el) return;
  if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') return;
  if (el.dataset.action === 'cfg') { const v = clamp(Number(el.value || 0), Number(el.min), Number(el.max)); timer.cfg[el.id] = v; el.value = v; const st = $('#tstate'); if (st) { st.textContent = timerModeLabel(); $('#clock').textContent = timer.mode === 'fortime' ? '0:00' : fmtTime(timerTotal()); } return; }
  const fn = ACTIONS[el.dataset.action]; if (fn) fn(el, e);
}

/* ============================================================
   Arranque
   ============================================================ */
async function boot() {
  document.addEventListener('click', onAction);
  document.addEventListener('change', onChange);
  document.addEventListener('input', (e) => {
    if (e.target.id === 'wod-search') { state.search = e.target.value; const l = $('#wod-list'); if (l) l.innerHTML = wodListHtml(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#sheet-root').firstChild) closeSheet();
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest('.sheet')) { const btn = $('.sheet-foot .btn.primary'); if (btn && e.target.type !== 'number') { e.preventDefault(); btn.click(); } }
  });
  $$('#tabbar .tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  window.addEventListener('beforeunload', (e) => { if (timer.status === 'running' || timer.status === 'prep') { e.preventDefault(); e.returnValue = ''; } });

  state.meId = readMe();
  render();
  state.store = await chooseStore();
  COLS.forEach((col) => {
    state.store.subscribe(col, (docs) => {
      state[col] = docs.slice();
      state.loaded[col] = true;
      if (col === 'results') state.results.sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
      if (col === 'athletes' && state.meId && !athleteById(state.meId)) setMe(null);
      if (state.view !== 'timer' || timer.status === 'idle') render();
      if (col === 'athletes' && !state.promptedProfile && !state.meId) {
        state.promptedProfile = true;
        setTimeout(() => { if (!state.meId && !$('#sheet-root').firstChild) openPickAthlete(); }, 400);
      }
    });
  });
  render();
}
boot();
