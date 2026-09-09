/* ============================================================
   Llorones Crossfit Club — la app de la cuadrilla
   Un solo archivo. Sin dependencias. Funciona en GitHub Pages.
   ============================================================ */
'use strict';

/* ------------------------------------------------------------
   NUBE: los datos de todos se guardan en data/sync.json, en la
   rama `data` de este mismo repositorio (igual que la app de
   nutrición). Leer es público; para escribir hace falta pegar en
   Perfil → Nube un código de acceso (token fine-grained de GitHub
   con permiso Contents: Read and write solo sobre este repo).
   Si GITHUB_SYNC es null la app funciona en modo local.
   ------------------------------------------------------------ */
const GITHUB_SYNC = { owner: 'alejandromartinherrer', repo: 'llorones-crossfit-club', branch: 'data', path: 'data/sync.json' };
const APP_VERSION = '1.6.0';
/* Quien montó el club manda desde el principio. Después puede nombrar a más
   admins desde Perfil, y eso queda guardado en el propio atleta. */
const ADMINS_INICIALES = ['mtr14k1bb9bg49'];
const APP_NAME = 'Llorones Crossfit Club';
const CREW_NAME = 'Crossfit Club';

/* Datos incrustados en el build */
const HEROES = /*__HEROES__*/[];
const GIRLS = /*__GIRLS__*/[];
const MOVIMIENTOS = /*__MOVIMIENTOS__*/[];

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
  /* Solo letras: los emojis del nombre no deben romper la inicial del disco. */
  const letra = (w) => (Array.from(w || '').find((ch) => /\p{L}/u.test(ch)) || '').toUpperCase();
  const palabras = String(name || '?').trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
  return (letra(palabras[0]) + letra(palabras[1])) || '?';
}
const COLORS = ['red', 'blue', 'yellow', 'green', 'white', 'black'];
const COLOR_LABEL = { red: 'Disco rojo · 25 kg', blue: 'Disco azul · 20 kg', yellow: 'Disco amarillo · 15 kg', green: 'Disco verde · 10 kg', white: 'Disco blanco · 5 kg', black: 'Disco negro' };
/* ---- PIN opcional de cada atleta ----
   El PIN no es una contraseña de verdad (son cuatro números y su huella viaja
   con los datos del club), así que al menos se guarda derivado con PBKDF2 y sal
   propia, para que no baste una tabla para adivinarlo. */
const PIN_VUELTAS = 210000;
const hex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
const deHex = (h) => new Uint8Array((String(h).match(/../g) || []).map((x) => parseInt(x, 16)));
async function hashPinSimple(pin, id) {
  const datos = new TextEncoder().encode('llorones:' + id + ':' + String(pin));
  const buf = await crypto.subtle.digest('SHA-256', datos);
  return hex(new Uint8Array(buf));
}
async function creaPin(pin, id) {
  if (!(window.crypto && crypto.subtle)) return { v: 0, hash: 'plano:' + id + ':' + pin };
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { v: 2, sal: hex(sal), hash: await derivaPin(pin, id, sal) };
}
async function derivaPin(pin, id, sal) {
  const enc = new TextEncoder();
  const clave = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const etiqueta = enc.encode('llorones:' + id + ':');
  const mezcla = new Uint8Array(etiqueta.length + sal.length);
  mezcla.set(etiqueta, 0); mezcla.set(sal, etiqueta.length);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: mezcla, iterations: PIN_VUELTAS, hash: 'SHA-256' }, clave, 256);
  return hex(new Uint8Array(bits));
}
async function compruebaPin(pin, a) {
  if (!a || !a.pin) return false;
  if (typeof a.pin === 'string') return (await hashPinSimple(pin, a.id)) === a.pin;   // formato antiguo
  if (a.pin.v === 0) return a.pin.hash === 'plano:' + a.id + ':' + pin;
  return (await derivaPin(pin, a.id, deHex(a.pin.sal))) === a.pin.hash;
}
function tienePin(a) { return !!(a && a.pin); }
function pinValidado(id) { try { return sessionStorage.getItem(LS_PREFIX + 'pin:' + id) === '1'; } catch (e) { return false; } }
function marcaPinValidado(id) { try { sessionStorage.setItem(LS_PREFIX + 'pin:' + id, '1'); } catch (e) { } }

function stripUndefined(o) { const r = {}; for (const k in o) if (o[k] !== undefined) r[k] = o[k]; return r; }

/* ============================================================
   Almacenamiento
   LocalStore: caché en localStorage (con bajas registradas).
   GitHubStore: la misma caché + sincronización con data/sync.json
   en la rama `data` del repositorio. Interfaz común:
   subscribe(col, cb) · set(col,id,data) · update(col,id,patch) · remove(col,id)
   ============================================================ */
const COLS = ['athletes', 'workouts', 'results'];
const LS_PREFIX = 'llorones:';

class LocalStore {
  constructor() {
    this.mode = 'local';
    this.subs = {};
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.indexOf(LS_PREFIX) === 0) { const col = e.key.slice(LS_PREFIX.length); if (COLS.indexOf(col) >= 0) this._emit(col); }
    });
  }
  _key(col) { return LS_PREFIX + col; }
  _read(col) { try { return JSON.parse(localStorage.getItem(this._key(col)) || '{}') || {}; } catch (e) { return {}; } }
  _write(col, obj, silent) { localStorage.setItem(this._key(col), JSON.stringify(obj)); if (!silent) this._emit(col); }
  _emit(col) { const docs = Object.values(this._read(col)); (this.subs[col] || []).forEach((cb) => cb(docs)); }
  emitAll() { COLS.forEach((c) => this._emit(c)); }
  deleted() { try { return JSON.parse(localStorage.getItem(LS_PREFIX + 'deleted') || '{}') || {}; } catch (e) { return {}; } }
  _writeDeleted(obj) { localStorage.setItem(LS_PREFIX + 'deleted', JSON.stringify(obj)); }
  subscribe(col, cb) {
    (this.subs[col] = this.subs[col] || []).push(cb);
    cb(Object.values(this._read(col)));
    return () => { this.subs[col] = (this.subs[col] || []).filter((f) => f !== cb); };
  }
  async set(col, id, data) { const o = this._read(col); o[id] = Object.assign({}, data, { id, updatedAt: nowISO() }); this._write(col, o); }
  async update(col, id, patch) { const o = this._read(col); o[id] = Object.assign({}, o[id] || {}, patch, { id, updatedAt: nowISO() }); this._write(col, o); }
  async remove(col, id) { const o = this._read(col); delete o[id]; const d = this.deleted(); d[col + ':' + id] = nowISO(); this._writeDeleted(d); this._write(col, o); }
  snapshot() { const out = { app: 'llorones', version: APP_VERSION, updatedAt: nowISO(), deleted: this.deleted() }; COLS.forEach((c) => { out[c] = this._read(c); }); return out; }
  exportAll() { return this.snapshot(); }
  replaceAll(doc) { COLS.forEach((c) => this._write(c, doc[c] || {}, true)); this._writeDeleted(doc.deleted || {}); this.emitAll(); }
  importAll(data) { let n = 0; COLS.forEach((c) => { if (data[c] && typeof data[c] === 'object') { const o = this._read(c); for (const id in data[c]) { o[id] = Object.assign({}, data[c][id], { id, updatedAt: nowISO() }); n++; } this._write(c, o); } }); return n; }
}

/* SYNC-CORE-START */
function docStamp(d) { return (d && (d.updatedAt || d.createdAt)) || ''; }
/* Fusiona la copia de la nube con la local: por id gana la marca más reciente; una baja registrada
   (tombstone) elimina el documento si es posterior a su última modificación. */
function mergeSnapshots(cloud, local) {
  cloud = cloud || {}; local = local || {};
  const merged = { app: 'llorones', version: APP_VERSION, updatedAt: nowISO(), deleted: {} };
  const del = Object.assign({}, cloud.deleted || {});
  Object.keys(local.deleted || {}).forEach((k) => { if (!del[k] || del[k] < local.deleted[k]) del[k] = local.deleted[k]; });
  COLS.forEach((c) => {
    const a = cloud[c] || {}, b = local[c] || {}; const out = {};
    const ids = Object.keys(a).concat(Object.keys(b).filter((id) => !(id in a)));
    ids.forEach((id) => {
      const x = a[id], y = b[id];
      const doc = (x && y) ? (docStamp(y) > docStamp(x) ? y : x) : (x || y);
      const t = del[c + ':' + id];               // se aplican TODAS las bajas...
      if (t && t >= docStamp(doc)) return;
      out[id] = Object.assign({}, doc, { id });
    });
    merged[c] = out;
  });
  // ...y solo después se podan las más viejas de dos años, para que una baja
  // antigua no resucite nada al desaparecer.
  const cutoff = new Date(Date.now() - 730 * 86400000).toISOString();
  Object.keys(del).forEach((k) => { if (del[k] >= cutoff) merged.deleted[k] = del[k]; });
  return merged;
}
function sameData(a, b) { const pick = (d) => JSON.stringify(COLS.map((c) => (d && d[c]) || {}).concat([(d && d.deleted) || {}])); return pick(a) === pick(b); }
function utf8ToB64(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64ToUtf8(str) { return decodeURIComponent(escape(atob(String(str).replace(/\s/g, '')))); }
/* SYNC-CORE-END */

/* GH-STORE-START */
/* GitHub devuelve la caducidad del código en una cabecera de cada respuesta:
   "2027-09-05 09:00:00 UTC". Se guarda para poder avisar antes de tiempo. */
function parseCaducidad(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}
function diasHasta(ms) { return ms == null ? null : Math.ceil((ms - Date.now()) / 86400000); }
class GitHubStore {
  constructor(local, cfg) {
    this.mode = 'github'; this.local = local; this.cfg = cfg;
    this.token = localStorage.getItem(LS_PREFIX + 'gh_token') || '';
    this.caduca = Number(localStorage.getItem(LS_PREFIX + 'gh_exp')) || null;
    this.sync = { lastPull: 0, lastPush: 0, pending: localStorage.getItem(LS_PREFIX + 'pending') === '1', error: '', fatal: false, busy: false };
    this.listeners = []; this.timer = 0; this.again = false; this.poll = 0;
  }
  onStatus(cb) { this.listeners.push(cb); }
  _notify() { this.listeners.forEach((cb) => { try { cb(this.status()); } catch (e) { } }); }
  status() {
    return {
      readOnly: !this.token || this.sync.fatal, badToken: this.sync.fatal,
      pending: this.sync.pending, error: this.sync.error, busy: this.sync.busy,
      lastPull: this.sync.lastPull, lastPush: this.sync.lastPush,
      caduca: this.caduca, diasParaCaducar: this.token && !this.sync.fatal ? diasHasta(this.caduca) : null,
    };
  }
  _anotaCaducidad(r) {
    const exp = parseCaducidad(r && r.headers && r.headers.get && r.headers.get('github-authentication-token-expiration'));
    if (exp) { this.caduca = exp; localStorage.setItem(LS_PREFIX + 'gh_exp', String(exp)); }
  }
  subscribe(col, cb) { return this.local.subscribe(col, cb); }
  async set(col, id, data) { await this.local.set(col, id, data); this._dirty(); }
  async update(col, id, patch) { await this.local.update(col, id, patch); this._dirty(); }
  async remove(col, id) { await this.local.remove(col, id); this._dirty(); }
  exportAll() { return this.local.exportAll(); }
  importAll(data) { const n = this.local.importAll(data); this._dirty(); return n; }
  _setPending(v) { this.sync.pending = v; if (v) localStorage.setItem(LS_PREFIX + 'pending', '1'); else localStorage.removeItem(LS_PREFIX + 'pending'); }
  _dirty() { this._setPending(true); this._notify(); clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 2500); }
  _headers() { return { Authorization: 'Bearer ' + this.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }
  _apiPath() { const c = this.cfg; return 'https://api.github.com/repos/' + c.owner + '/' + c.repo + '/contents/' + c.path; }
  async fetchCloud() {
    const c = this.cfg;
    const url = this._apiPath() + '?ref=' + encodeURIComponent(c.branch) + '&t=' + Date.now();
    if (this.token) {
      const r = await fetch(url, { headers: this._headers(), cache: 'no-store' });
      if (r.status === 404) { this.sync.fatal = false; return { doc: null, sha: null }; }
      if (r.status === 401 || r.status === 403) {
        /* El código no vale: se sigue leyendo como cualquier visitante, para no
           quedarse a ciegas; escribir sí queda bloqueado. */
        this.sync.fatal = true;
      } else if (r.ok) {
        this.sync.fatal = false;
        this._anotaCaducidad(r);
        const j = await r.json();
        /* Por encima de 1 MB la API no devuelve el contenido: se pide en bruto. */
        let doc;
        if (j.content && j.encoding === 'base64') doc = JSON.parse(b64ToUtf8(j.content));
        else doc = await (await fetch(url, { headers: Object.assign({}, this._headers(), { Accept: 'application/vnd.github.raw' }), cache: 'no-store' })).json();
        return { doc, sha: j.sha };
      } else throw new Error('GitHub respondió ' + r.status);
    }
    /* Sin código de acceso: la API pública devuelve la copia recién publicada
       (60 peticiones por hora y IP). Si no está disponible se usa el fichero en
       bruto, que puede ir hasta cinco minutos por detrás. */
    try {
      const a = await fetch(this._apiPath() + '?ref=' + encodeURIComponent(c.branch) + '&t=' + Date.now(), { headers: { Accept: 'application/vnd.github.raw' }, cache: 'no-store' });
      if (a.status === 404) return { doc: null, sha: null };
      if (a.ok) return { doc: await a.json(), sha: null };
    } catch (e) { /* sin red o límite alcanzado: se prueba con el fichero en bruto */ }
    const r = await fetch('https://raw.githubusercontent.com/' + c.owner + '/' + c.repo + '/' + c.branch + '/' + c.path + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.status === 404) return { doc: null, sha: null };
    if (!r.ok) throw new Error('GitHub respondió ' + r.status);
    return { doc: await r.json(), sha: null };
  }
  async pull() {
    if (this.sync.busy) return;
    this.sync.busy = true; this._notify();
    try {
      const { doc } = await this.fetchCloud();
      const localSnap = this.local.snapshot();
      const merged = mergeSnapshots(doc, localSnap);
      if (!sameData(merged, localSnap)) this.local.replaceAll(merged);
      this.sync.lastPull = Date.now();
      this.sync.error = this.sync.fatal ? 'El código de acceso no vale o ha caducado' : '';
      const hasLocal = COLS.some((c) => Object.keys(localSnap[c] || {}).length) || Object.keys(localSnap.deleted || {}).length;
      if (this.token && ((doc && !sameData(merged, doc)) || (!doc && hasLocal))) this._setPending(true);
    } catch (e) { this.sync.error = e.message || String(e); }
    this.sync.busy = false; this._notify();
    if (this.sync.pending && this.token && !this.sync.fatal) this.push();
  }
  async push() {
    if (!this.token || this.sync.fatal) { this._notify(); return; }
    if (this.sync.busy) { this.again = true; return; }
    this.sync.busy = true; this._notify();
    try {
      let ok = false;
      for (let attempt = 0; attempt < 6 && !ok; attempt++) {
        const { doc, sha } = await this.fetchCloud();
        const merged = mergeSnapshots(doc, this.local.snapshot());
        if (!sameData(merged, this.local.snapshot())) this.local.replaceAll(merged);
        if (doc && sameData(merged, doc)) { ok = true; break; }
        const who = (typeof state !== 'undefined' && state.meId && athleteById(state.meId)) ? ' · ' + athleteById(state.meId).name : '';
        const body = { message: 'sync ' + merged.updatedAt + who, content: utf8ToB64(JSON.stringify(merged)), branch: this.cfg.branch };
        if (sha) body.sha = sha;
        const r = await fetch(this._apiPath(), { method: 'PUT', headers: this._headers(), body: JSON.stringify(body) });
        if (r.status === 409 || r.status === 422) { await new Promise((z) => setTimeout(z, 250 * Math.pow(2, attempt) + Math.floor(Math.random() * 250))); continue; }
        if (r.status === 404 && attempt === 0) { await this._ensureBranch(); continue; }
        if (r.status === 401 || r.status === 403) { this.sync.fatal = true; throw new Error('El código de acceso no vale o ha caducado'); }
        if (!r.ok) throw new Error('GitHub respondió ' + r.status);
        ok = true;
      }
      if (!ok) throw new Error('Conflicto al guardar; se reintentará');
      this._setPending(false); this.sync.lastPush = Date.now(); this.sync.error = '';
    } catch (e) { this.sync.error = e.message || String(e); }
    this.sync.busy = false; this._notify();
    if (this.again) { this.again = false; this._dirty(); }
  }
  async _ensureBranch() {
    const c = this.cfg; const base = 'https://api.github.com/repos/' + c.owner + '/' + c.repo;
    const r = await fetch(base + '/git/ref/heads/main', { headers: this._headers() });
    if (!r.ok) throw new Error('No se encontró la rama main del repositorio');
    const sha = (await r.json()).object.sha;
    const r2 = await fetch(base + '/git/refs', { method: 'POST', headers: this._headers(), body: JSON.stringify({ ref: 'refs/heads/' + c.branch, sha }) });
    if (!r2.ok && r2.status !== 422) throw new Error('No se pudo crear la rama de datos');
  }
  /* Comprueba el código contra GitHub antes de guardarlo, para no perder el bueno. */
  async checkToken(t) {
    t = (t || '').trim();
    if (!t) return { ok: false, motivo: 'Pega el código de acceso.' };
    const c = this.cfg;
    let r;
    try {
      r = await fetch(this._apiPath() + '?ref=' + encodeURIComponent(c.branch) + '&t=' + Date.now(),
        { headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store' });
    } catch (e) { return { ok: false, motivo: 'Sin conexión: inténtalo otra vez.' }; }
    if (r.status === 401 || r.status === 403) return { ok: false, motivo: 'Ese código no vale para este club (o ha caducado). Pide uno nuevo.' };
    if (!r.ok && r.status !== 404) return { ok: false, motivo: 'GitHub respondió ' + r.status + '. Inténtalo otra vez.' };
    this._anotaCaducidad(r);
    return { ok: true, caduca: this.caduca };
  }
  setToken(t) {
    this.token = (t || '').trim();
    if (this.token) localStorage.setItem(LS_PREFIX + 'gh_token', this.token);
    else { localStorage.removeItem(LS_PREFIX + 'gh_token'); localStorage.removeItem(LS_PREFIX + 'gh_exp'); this.caduca = null; }
    this.sync.error = ''; this.sync.fatal = false; this._notify();
    this._startPoll();
    this.pull();
  }
  _startPoll() {
    clearInterval(this.poll);
    this.poll = setInterval(() => { if (!document.hidden && !this.sync.busy) this.pull(); }, this.token ? 60000 : 180000);
  }
  start() {
    this.pull();
    this._startPoll();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.pull(); });
    window.addEventListener('online', () => this.pull());
  }
}
/* GH-STORE-END */

async function chooseStore() {
  const local = new LocalStore();
  if (GITHUB_SYNC && GITHUB_SYNC.repo) return new GitHubStore(local, GITHUB_SYNC);
  return local;
}
function fmtDateFull(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.getDate() + ' de ' + MESES_LARGO[d.getMonth()] + ' de ' + d.getFullYear();
}
function fmtAgo(ts) {
  if (!ts) return 'nunca';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'ahora mismo';
  if (s < 60) return 'hace ' + s + ' s';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  return 'hace ' + Math.round(s / 3600) + ' h';
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
/* ---- quién puede qué (dentro de la app) ---- */
function esAdmin(a) { return !!a && (a.admin === true || ADMINS_INICIALES.indexOf(a.id) >= 0); }
function soyAdmin() { return esAdmin(me()); }
function soyYo(id) { const m = me(); return !!m && m.id === id; }
function puedoEditarAtleta(a) { return !!a && (soyAdmin() || soyYo(a.id)); }
function puedoBorrarAtleta(a) { return !!a && (soyAdmin() || soyYo(a.id)); }
function puedoBorrarResultado(r) { return !!r && (soyAdmin() || soyYo(r.athleteId)); }
function puedoEditarEntreno(w) { return !!w && w.category === 'custom' && (soyAdmin() || (w.createdBy && soyYo(w.createdBy))); }
function noPuedes(quePasa) { toast(quePasa || 'Eso solo lo puede hacer quien administra el club', true); }
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

/* --- validez: una marca a cero no cuenta --- */
function marcaValida(r) {
  if (!r) return false;
  switch (r.scoreType) {
    case 'time': return r.finished === false ? (r.reps || 0) > 0 : (r.seconds || 0) > 0;
    case 'rounds': return (r.rounds || 0) > 0 || (r.reps || 0) > 0;
    case 'reps': return (r.reps || 0) > 0;
    case 'load': return (r.load || 0) > 0;
    default: return false;
  }
}
/* --- valor comparable dentro de un mismo entreno: cuanto más alto, mejor --- */
function valorMarca(r) {
  switch (r.scoreType) {
    case 'time': return r.finished === false ? null : (r.seconds > 0 ? 1 / r.seconds : null);
    case 'rounds': return (r.rounds || 0) + (r.reps || 0) / 1000;
    case 'reps': return r.reps || 0;
    case 'load': return r.load || 0;
  }
  return null;
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
const PTS = { marca: 5, rendimiento: 40, lider: 5, rx: 5, hero: 10, girl: 5, pr: 5, semana: 5 };
const RULES = [
  ['Apuntar una marca válida (cero no cuenta)', 5],
  ['Rendimiento: tu marca frente a la mejor del club', 'hasta 40'],
  ['Tener la mejor marca del club en ese entreno', '+5'],
  ['Hacerlo Rx', '+5'],
  ['Si es un Hero WOD', '+10'],
  ['Si es un benchmark (Girls)', '+5'],
  ['Mejorar tu marca (PR)', '+5'],
  ['Semana activa (3 días o más)', '+5'],
];

/* Rendimiento de cada atleta en un entreno: 0 a 1 comparando su mejor marca con
   la mejor del club. Quien lo ha hecho solo se queda a la mitad hasta que otro lo
   haga; una marca sin terminar (time cap) nunca pasa de la mitad. */
function rendimientosDeEntreno(mejorPorAtleta) {
  const ids = Object.keys(mejorPorAtleta);
  const out = {};
  const valores = {}, capReps = {};
  ids.forEach((id) => {
    const r = mejorPorAtleta[id];
    const v = valorMarca(r);
    if (v != null && v > 0) valores[id] = v;
    else if (r.scoreType === 'time' && r.finished === false) capReps[id] = r.reps || 0;
  });
  const maxV = Math.max.apply(null, Object.values(valores).concat([0]));
  const maxCap = Math.max.apply(null, Object.values(capReps).concat([0]));
  const solo = ids.length < 2;
  ids.forEach((id) => {
    let ratio = 0;
    if (valores[id] != null && maxV > 0) ratio = valores[id] / maxV;
    else if (capReps[id] != null) ratio = 0.5 * (maxCap > 0 ? capReps[id] / maxCap : 1);
    if (solo) ratio = ratio * 0.5;
    out[id] = Math.max(0, Math.min(1, ratio));
  });
  return out;
}
function computeStandings(period) {
  const valid = state.results.filter((r) => athleteById(r.athleteId) && marcaValida(r));
  const inP = (r) => periodContains(period, r.date);
  const pr = valid.filter(inP);
  const per = {};
  const ensure = (id) => (per[id] = per[id] || { base: 0, rend: 0, rx: 0, cat: 0, pr: 0, lider: 0, weeks: 0, total: 0, count: 0, results: 0, prs: 0, wins: 0 });
  const seen = new Set();
  pr.forEach((r) => {
    const p = ensure(r.athleteId); p.results = (p.results || 0) + 1;
    const k = r.athleteId + '|' + r.workoutId + '|' + r.date;
    if (seen.has(k)) return; seen.add(k);
    p.count++;
    p.base += PTS.marca;
    if (r.rx) p.rx += PTS.rx;
    if (r.category === 'hero') p.cat += PTS.hero; else if (r.category === 'girl') p.cat += PTS.girl;
  });
  const chrono = valid.slice().sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  const best = {};
  chrono.forEach((r) => {
    const k = r.athleteId + '|' + r.workoutId; const prev = best[k];
    if (prev && compareResults(r, prev) < 0) { if (inP(r)) { const p = ensure(r.athleteId); p.pr += PTS.pr; p.prs++; } }
    if (!prev || compareResults(r, prev) < 0) best[k] = r;
  });
  const byWod = {};
  pr.forEach((r) => (byWod[r.workoutId] = byWod[r.workoutId] || []).push(r));
  Object.keys(byWod).forEach((wid) => {
    const bestBy = {};
    byWod[wid].forEach((r) => { if (!bestBy[r.athleteId] || compareResults(r, bestBy[r.athleteId]) < 0) bestBy[r.athleteId] = r; });
    const rend = rendimientosDeEntreno(bestBy);
    Object.keys(bestBy).forEach((id) => { ensure(id).rend += Math.round(PTS.rendimiento * rend[id]); });
    const ranked = Object.values(bestBy).sort(compareResults);
    if (ranked.length >= 2) {
      ranked.forEach((r, i) => {
        if (i === 0 || compareResults(r, ranked[0]) === 0) { const p = ensure(r.athleteId); p.lider += PTS.lider; p.wins++; }
      });
    }
  });
  const days = {};
  pr.forEach((r) => { const k = r.athleteId + '|' + isoWeekKey(r.date); (days[k] = days[k] || new Set()).add(r.date); });
  Object.keys(days).forEach((k) => { if (days[k].size >= 3) ensure(k.split('|')[0]).weeks += PTS.semana; });
  const rows = state.athletes.map((a) => {
    const p = ensure(a.id);
    p.total = p.base + p.rend + p.rx + p.cat + p.pr + p.lider + p.weeks;
    return Object.assign({ athlete: a }, p);
  }).sort((x, y) => y.total - x.total || y.count - x.count || x.athlete.name.localeCompare(y.athlete.name));
  rows.forEach((r, i) => { r.pos = i > 0 && rows[i - 1].total === r.total ? rows[i - 1].pos : i + 1; });
  return rows;
}
function wodBoard(workoutId) {
  const bestBy = {};
  state.results.filter((r) => r.workoutId === workoutId && athleteById(r.athleteId) && marcaValida(r)).forEach((r) => {
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
   Movimientos y Rx personales
   ============================================================ */
const CATS_MOV = [
  ['barra', 'Barbell'],
  ['mancuerna', 'Dumbbell & kettlebell'],
  ['balon', 'Ball, sandbag & vest'],
  ['cajon', 'Box'],
  ['gimnastico', 'Gymnastics'],
  ['cardio', 'Cardio'],
  ['otros', 'Other'],
];
const ESTADOS_MOV = [['rx', 'Rx'], ['escalado', 'Scaled'], ['no', 'Aún no']];
function movById(id) { return MOVIMIENTOS.find((m) => m.id === id) || null; }
function misRx(a) { return (a && a.rx) || {}; }
function rxTexto(m, v) {
  if (!v) return '';
  if (m.tipo === 'kg') return v.kg ? v.kg + ' kg' : '';
  if (m.tipo === 'cm') return v.cm ? v.cm + ' cm' : '';
  if (m.tipo === 'estado') { const e = (ESTADOS_MOV.find((x) => x[0] === v.estado) || [])[1]; return e ? e + (v.nota ? ' · ' + v.nota : '') : (v.nota || ''); }
  return v.nota || '';
}
/* Movimientos que aparecen en la descripción de un entreno. Se queda con el más
   específico: "strict pull-ups" gana a "pull-ups". */
function movimientosDe(w) {
  const texto = ' ' + String(w.description || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  const hallados = [];
  MOVIMIENTOS.forEach((m) => {
    let mejor = '';
    m.en.forEach((alias) => { if (texto.indexOf(alias.toLowerCase()) >= 0 && alias.length > mejor.length) mejor = alias; });
    if (mejor) hallados.push({ mov: m, alias: mejor });
  });
  return hallados.filter((h) => !hallados.some((o) => o !== h && o.alias.length > h.alias.length && o.alias.toLowerCase().indexOf(h.alias.toLowerCase()) >= 0)).map((h) => h.mov);
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
    expandir: '<path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/>',
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
  if (!root.firstChild) { try { history.pushState({ sheet: true }, ''); } catch (e) { } }
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
/* Cierra la hoja sin tocar el historial. Si después se navega, go() sustituye
   la entrada de la hoja por la pantalla de destino. */
function closeSheet() { $('#sheet-root').innerHTML = ''; }
/* La cierra el usuario (X, Cancelar, tocar fuera o Escape): se retrocede, de
   modo que el historial queda como antes de abrirla. */
function dismissSheet() {
  const habia = !!$('#sheet-root').firstChild;
  closeSheet();
  if (habia && history.state && history.state.sheet) { try { history.back(); } catch (e) { } }
}
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
  const st = state.store;
  if (!st) return '';
  if (st.mode === 'local') return '<div class="banner"><span class="dot"></span><span><b>Modo local:</b> los datos solo se guardan en este dispositivo.</span></div>';
  const y = st.status();
  if (y.badToken) return '<button class="banner bad" style="width:100%;text-align:left;border:0;cursor:pointer" data-action="gh-token"><span class="dot"></span><span><b>El código de acceso ha caducado o ya no vale.</b> Los códigos duran como mucho un año: hay que crear uno nuevo en GitHub y repartirlo. Mientras tanto sigues viendo las marcas de todos, pero las tuyas no se comparten. Toca aquí.</span></button>';
  if (y.diasParaCaducar != null && y.diasParaCaducar <= 21) return '<button class="banner" style="width:100%;text-align:left;border:0;cursor:pointer" data-action="gh-token"><span class="dot"></span><span><b>El código de acceso caduca ' + esc(y.diasParaCaducar <= 0 ? 'hoy' : y.diasParaCaducar === 1 ? 'mañana' : 'en ' + y.diasParaCaducar + ' días') + '</b> (' + esc(fmtDateFull(y.caduca)) + '). Cread uno nuevo en GitHub y repartidlo antes de que pase. Toca aquí.</span></button>';
  if (y.readOnly) return '<button class="banner" style="width:100%;text-align:left;border:0;cursor:pointer" data-action="gh-token"><span class="dot"></span><span><b>Solo lectura:</b> ves las marcas de todos, pero las tuyas no se comparten. Toca aquí para pegar el código de acceso.</span></button>';
  if (y.error) return '<div class="banner"><span class="dot"></span><span><b>Sin conexión con la nube:</b> ' + esc(y.error) + '. Tus marcas se guardan aquí y se subirán solas.</span></div>';
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
    html += '<section class="card hero-wod"><span class="eyebrow">Bienvenido a ' + esc(APP_NAME) + '</span><h1 class="h-display h1">Apúntate en la pizarra</h1>' +
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
        '<span class="right"><span class="score">' + esc(fmtScore(r)) + '</span><span>' + (!marcaValida(r) ? badge('nocuenta', 'No cuenta') : (r.rx ? badge('rx', 'Rx') : '') + (isPR(r) ? ' ' + badge('pr', 'PR') : '')) + '</span></span></button></li>';
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
    (puedoEditarEntreno(w) ? '<span class="btn-row"><button class="btn ghost sm" data-action="edit-workout" data-id="' + esc(w.id) + '">' + icon('pen') + 'Editar</button><button class="btn ghost sm danger" data-action="delete-workout" data-id="' + esc(w.id) + '">' + icon('trash') + '</button></span>' : '') + '</div>' +
    '<section class="card"><div class="meta-line">' + catBadge(w.category) + workoutMeta(w).map((b) => badge('type', b)).join('') + (w.scheduledDate ? badge('today', fmtDate(w.scheduledDate)) : '') + '</div>' +
    '<h1 class="h-display h1">' + esc(w.name) + '</h1>' +
    (w.honoree ? '<p class="muted small">' + esc(w.honoree) + '</p>' : '') +
    '<div class="wod-desc">' + lines.map((l, i) => (i === 0 || /:$/.test(l.trim())) ? '<span class="head">' + esc(l) + '</span>' : esc(l)).join('\n') + '</div>' +
    ((w.loadF || w.loadM) ? '<div class="loads">' + (w.loadF ? '<span class="sym">♀</span><span>' + esc(withKg(w.loadF)) + '</span>' : '') + (w.loadM ? '<span class="sym">♂</span><span>' + esc(withKg(w.loadM)) + '</span>' : '') + '</div>' : '') +
    (w.tributeEs ? '<div class="tribute">' + esc(w.tributeEs) + '</div>' : '') +
    '<div class="meta-line">' + (w.firstPosted ? '<span>Publicado por CrossFit en ' + esc(fmtPosted(w.firstPosted)) + '</span>' : '') + (w.url ? '<a href="' + esc(w.url) + '" target="_blank" rel="noopener">crossfit.com ↗</a>' : '') + (w.createdBy && athleteById(w.createdBy) ? '<span>Creado por ' + esc(athleteById(w.createdBy).name) + '</span>' : '') + '</div>' +
    '<div class="btn-row">' + (w.scoreType !== 'load' ? '<button class="btn primary" data-action="timer-for" data-id="' + esc(w.id) + '">' + icon('timer') + 'Cronómetro</button>' : '') + '<button class="btn" data-action="log-result" data-id="' + esc(w.id) + '">Apuntar resultado</button></div>' +
    '</section>';
  const movs = movimientosDe(w);
  if (movs.length) {
    const rx = misRx(m);
    html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Tus Rx aquí</h2><button class="link" data-action="go" data-view="rx">Editar</button></div>' +
      '<ul class="rx-chips">' + movs.map((x) => {
        const t = rxTexto(x, rx[x.id]);
        return '<li class="' + (t ? 'puesto' : '') + '"><span>' + esc(x.nombre) + '</span><b>' + esc(t || '—') + '</b></li>';
      }).join('') + '</ul>' +
      (m ? '' : '<p class="faint small">Elige tu atleta para ver tus cargas.</p>') + '</section>';
  }
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Pizarra</h2><span class="eyebrow">' + esc(SCORE_LABEL[w.scoreType] || '') + '</span></div>';
  if (board.length) {
    html += '<ul class="list wod-lb" style="border:0">' + board.map((r, i) => {
      const a = athleteById(r.athleteId);
      return '<li><span class="pos p' + (i + 1) + '">' + (i + 1) + '</span>' + avatar(a, 'sm') + '<span><span class="title">' + esc(a.name) + '</span><br><span class="small muted">' + esc(fmtDate(r.date)) + '</span></span><span class="right"><span class="s">' + esc(fmtScore(r)) + '</span>' + (r.rx ? badge('rx', 'Rx') : '<span class="faint small">scaled</span>') + '</span>' + (soyAdmin() && !soyYo(r.athleteId) ? '<button class="icon-btn" data-action="delete-result" data-id="' + esc(r.id) + '" aria-label="Borrar la marca de ' + esc(a.name) + '">' + icon('trash') + '</button>' : '') + '</li>';
    }).join('') + '</ul>';
  } else {
    html += '<p class="muted">Nadie lo ha hecho todavía. Sé el primero en la pizarra.</p>';
  }
  html += '</section>';
  if (m) {
    html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Tus marcas</h2></div>';
    if (mine.length) {
      html += '<ul class="list history" style="border:0">' + mine.map((r) => '<li><span><span class="d">' + esc(fmtDate(r.date)) + '</span>' + (r.notes ? '<br><span class="small">' + esc(r.notes) + '</span>' : '') + '</span><span class="s">' + esc(fmtScore(r)) + (!marcaValida(r) ? ' ' + badge('nocuenta', 'No cuenta') : (r.rx ? ' ' + badge('rx', 'Rx') : '') + (isPR(r) ? ' ' + badge('pr', 'PR') : '')) + '</span><button class="icon-btn" data-action="delete-result" data-id="' + esc(r.id) + '" aria-label="Borrar resultado">' + icon('trash') + '</button></li>').join('') + '</ul>';
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
        (open ? '<div class="breakdown"><span>Marcas apuntadas</span><b>' + s.base + '</b><span>Rendimiento</span><b>' + s.rend + '</b><span>Rx</span><b>' + s.rx + '</b><span>Héroes y benchmarks</span><b>' + s.cat + '</b><span>PRs</span><b>' + s.pr + '</b><span>Mejores del club (' + s.wins + ')</span><b>' + s.lider + '</b><span>Semanas activas</span><b>' + s.weeks + '</b></div>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  html += '<details class="card"><summary><span class="eyebrow">Cómo se puntúa</span></summary><div class="rules" style="margin-top:10px">' + RULES.map((r) => '<span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b>').join('') + '</div>' +
    '<p class="faint small" style="margin-top:10px">Cuenta la mejor marca de cada atleta en cada entreno. El <b>rendimiento</b> compara tu marca con la mejor del club en ese entreno: quien la tiene se lleva los 40, y el resto la parte proporcional (la mitad de tiempo, la mitad de rondas o la mitad de kilos son la mitad de puntos). Si eres el único que lo ha hecho cuenta a la mitad, hasta que otro lo haga. Una marca sin terminar (time cap) no pasa de la mitad. Un mismo entreno solo suma una vez al día; las marcas extra de ese día solo cuentan para el PR. Los puntos se recalculan en vivo.</p></details></div>';
  return html;
}

/* --- MIS RX --- */
function viewRx() {
  const m = me();
  if (!m) return '<div class="view"><div class="empty"><span class="h-display h2">¿Quién eres?</span><span>Elige tu atleta para guardar tus Rx.</span><button class="btn primary" data-action="pick-athlete">Elegir atleta</button></div></div>';
  const rx = misRx(m);
  const puestos = MOVIMIENTOS.filter((x) => rxTexto(x, rx[x.id])).length;
  let html = '<div class="view">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><button class="btn ghost sm" data-action="go" data-view="profile">' + icon('back') + 'Perfil</button><span class="eyebrow">' + puestos + ' de ' + MOVIMIENTOS.length + '</span></div>' +
    '<section class="card"><span class="eyebrow">' + esc(m.name) + '</span><h1 class="h-display h2">Mis Rx</h1>' +
    '<p class="muted small">Apunta con qué carga haces cada movimiento y cómo lo tienes. Es tuyo y solo tuyo: sirve para saber, de un vistazo, con qué peso vas en cada entreno y para no discutir si algo fue Rx.</p></section>';
  CATS_MOV.forEach((c) => {
    const lista = MOVIMIENTOS.filter((x) => x.cat === c[0]);
    if (!lista.length) return;
    html += '<section class="card"><div class="section-head"><h2 class="h-display h3">' + esc(c[1]) + '</h2></div><ul class="rx-list">' +
      lista.map((x) => {
        const v = rx[x.id] || {};
        let control = '';
        if (x.tipo === 'kg' || x.tipo === 'cm') {
          control = '<input type="number" inputmode="decimal" min="0" step="' + (x.tipo === 'kg' ? '0.5' : '1') + '" value="' + esc(v[x.tipo] != null ? v[x.tipo] : '') + '" placeholder="—" data-action="rx-num" data-mov="' + esc(x.id) + '" data-campo="' + x.tipo + '" aria-label="' + esc(x.nombre) + ' en ' + x.tipo + '"><span class="ud">' + x.tipo + '</span>';
        } else if (x.tipo === 'estado') {
          control = '<select data-action="rx-estado" data-mov="' + esc(x.id) + '" aria-label="' + esc(x.nombre) + '"><option value="">—</option>' +
            ESTADOS_MOV.map((e) => '<option value="' + e[0] + '"' + (v.estado === e[0] ? ' selected' : '') + '>' + e[1] + '</option>').join('') + '</select>';
        } else {
          control = '<input type="text" maxlength="24" value="' + esc(v.nota || '') + '" placeholder="p. ej. 1 km en 4:10" data-action="rx-nota" data-mov="' + esc(x.id) + '" aria-label="' + esc(x.nombre) + '">';
        }
        return '<li><span class="nm">' + esc(x.nombre) + '</span><span class="ctrl">' + control + '</span></li>';
      }).join('') + '</ul></section>';
  });
  return html + '</div>';
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
      '<div class="btn-row"><button class="btn" data-action="edit-athlete" data-id="' + esc(m.id) + '">' + icon('pen') + (tienePin(m) ? 'Editar · PIN puesto' : 'Editar y poner PIN') + '</button><button class="btn ghost" data-action="pick-athlete">Cambiar de atleta</button></div>' +
      (esAdmin(m) ? '<div class="banner live"><span class="dot"></span><span>Administras el club' + (tienePin(m) ? '.' : ': pon un PIN para que nadie se ponga tu nombre.') + '</span></div>' : '') + '</section>' +
      '<button class="card" style="text-align:left;cursor:pointer" data-action="go" data-view="rx"><div class="section-head"><h2 class="h-display h2">Mis Rx</h2><span class="chev">' + icon('chev') + '</span></div>' +
      '<p class="muted small">Tus cargas y tu nivel en cada movimiento: ' + MOVIMIENTOS.filter((x) => rxTexto(x, misRx(m)[x.id])).length + ' de ' + MOVIMIENTOS.length + ' puestos.</p></button>';
  } else {
    html += '<section class="card"><span class="eyebrow">Atleta</span><h2 class="h-display h2">¿Quién eres?</h2><p class="muted">Elige tu atleta para que los tiempos que apuntes cuenten para ti.</p></section>';
  }
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">La cuadrilla</h2><button class="link" data-action="new-athlete">+ Nuevo atleta</button></div>';
  if (state.athletes.length) {
    html += '<div class="athlete-grid">' + state.athletes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) => '<button class="athlete-card" data-action="select-athlete" data-id="' + esc(a.id) + '" aria-pressed="' + (a.id === state.meId) + '" aria-label="' + esc(a.name) + '">' + avatar(a, 'lg') + '<span class="nm">' + esc(a.name) + (tienePin(a) ? ' 🔒' : '') + '</span><span class="small muted">' + (rows.find((r) => r.athlete.id === a.id) || { total: 0 }).total + ' pts' + (esAdmin(a) ? ' · admin' : '') + '</span></button>').join('') + '</div>';
  } else {
    html += '<p class="muted">Todavía no hay nadie apuntado.</p>';
  }
  html += '</section>';
  if (soyAdmin()) {
    html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Administración</h2><span class="badge admin">Admin</span></div>' +
      '<p class="small muted">Puedes editar o borrar a cualquiera y nombrar más administradores. El resto solo puede tocar lo suyo: su nombre, sus marcas y los entrenos que haya creado.</p>' +
      '<ul class="list" style="border:0">' + state.athletes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) =>
        '<li><div class="row"><span>' + avatar(a, 'sm') + '</span><span><span class="title">' + esc(a.name) + (tienePin(a) ? ' 🔒' : '') + '</span><span class="sub">' + (esAdmin(a) ? 'Administra el club' : 'Atleta') + (soyYo(a.id) ? ' · eres tú' : '') + '</span></span>' +
        '<button class="btn ghost sm" data-action="edit-athlete" data-id="' + esc(a.id) + '">' + icon('pen') + 'Editar</button></div></li>').join('') + '</ul>' +
      '<p class="faint small">Esto ordena quién toca qué dentro de la app, pero no es un candado: todos compartís el mismo código de acceso a la nube, así que quien sepa hacerlo puede saltárselo editando los datos en GitHub. Entre amigos sobra; para más, haría falta un servidor.</p></section>';
  }
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Nube</h2></div>';
  if (mode === 'github') {
    const y = state.store.status();
    if (y.readOnly) {
      html += '<div class="banner"><span class="dot"></span><span>' + (y.badToken ? 'El código de acceso ya no vale: tus marcas se quedan en este móvil.' : 'Solo lectura: tus marcas se quedan en este móvil.') + '</span></div>' +
        '<p class="small muted">Los datos de la cuadrilla viven en el repositorio de GitHub. Para que tus marcas se compartan, pega el código de acceso que te pase quien administra el club.</p>' +
        '<button class="btn primary" data-action="gh-token">' + (y.badToken ? 'Pegar un código nuevo' : 'Pegar código de acceso') + '</button>';
    } else {
      html += '<div class="banner live"><span class="dot"></span><span>Conectado: todos veis las mismas marcas.</span></div>' +
        '<div class="kv"><span class="muted">Última descarga</span><b>' + esc(fmtAgo(y.lastPull)) + '</b></div>' +
        '<div class="kv"><span class="muted">Última subida</span><b>' + esc(y.pending ? (y.busy ? 'subiendo…' : 'pendiente') : fmtAgo(y.lastPush)) + '</b></div>' +
        (y.caduca ? '<div class="kv"><span class="muted">El código caduca</span><b>' + esc(fmtDateFull(y.caduca)) + (y.diasParaCaducar != null && y.diasParaCaducar <= 60 ? ' (' + (y.diasParaCaducar <= 0 ? 'ya' : 'en ' + y.diasParaCaducar + ' días') + ')' : '') + '</b></div>' : '') +
        (y.error ? '<p class="form-error">' + esc(y.error) + '</p>' : '') +
        '<div class="btn-row"><button class="btn" data-action="gh-sync">Sincronizar ahora</button><button class="btn ghost" data-action="gh-forget">Quitar código</button></div>';
    }
  } else {
    html += '<div class="banner"><span class="dot"></span><span>Modo local: los datos solo están en este dispositivo.</span></div>';
  }
  html += '<div class="btn-row"><button class="btn ghost" data-action="export">Exportar copia</button>' + (soyAdmin() ? '<button class="btn ghost" data-action="import">Importar copia</button>' : '') + '</div></section>';
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Ajustes</h2></div>' +
    '<label class="check"><input type="checkbox" data-action="toggle-sound" ' + (state.sound ? 'checked' : '') + '> Pitidos del cronómetro</label>' +
    '<p class="faint small">' + APP_NAME + ' v' + APP_VERSION + ' · ' + HEROES.length + ' Hero WODs y ' + GIRLS.length + ' Girls de crossfit.com</p></section>';
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
  wake: null, full: true,
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
/* Pantalla completa apaisada mientras corre el crono. En Android se pide de
   verdad al sistema; en iPhone no se puede, así que el CSS gira la pantalla y
   se ve igual de grande al poner el móvil de lado. */
async function pantallaCompleta(on) {
  try {
    if (on) {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen && !document.webkitFullscreenElement) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen && document.fullscreenElement) await document.exitFullscreen();
      else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
    }
  } catch (e) { }
  try {
    if (on && screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    else if (!on && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  } catch (e) { }
}
async function wakeLock(on) {
  try {
    if (on && navigator.wakeLock && !timer.wake) timer.wake = await navigator.wakeLock.request('screen');
    if (!on && timer.wake) { await timer.wake.release(); timer.wake = null; }
  } catch (e) { timer.wake = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && (timer.status === 'running' || timer.status === 'prep')) wakeLock(true); });
timer.full = localStorage.getItem(LS_PREFIX + 'full') !== 'off';

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
  if (timer.full) pantallaCompleta(true);
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
  clearInterval(timer.iv); wakeLock(false); pantallaCompleta(false); beepLong(); setTimeout(beepLong, 350);
  render();
}
function timerReset() { clearInterval(timer.iv); timer.status = 'idle'; timer.acc = 0; timer.rounds = 0; timer.laps = []; wakeLock(false); pantallaCompleta(false); render(); }
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
    setStage('work', total ? 'For time · cap ' + fmtTime(total) : 'For time', fmtTime(whole), timer.rounds ? timer.rounds + ' vuelta' + (timer.rounds === 1 ? '' : 's') : 'Tiempo corriendo');
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
/* A pantalla completa el reloj se mide y se estira hasta llenar el hueco que
   queda dentro del marco, sin salirse ni por ancho ni por alto. */
function ajustaReloj() {
  const st = $('#tstage'), ck = $('#clock');
  if (!st || !ck) return;
  if (!st.closest('.crono-capa')) { ck.style.fontSize = ''; return; }   // fuera de pantalla completa manda el CSS
  const cs = getComputedStyle(st);
  const hueco = st.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
  const ancho = st.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
  const gap = parseFloat(cs.rowGap || cs.gap || 0) || 0;
  let otros = 0, hermanos = 0;
  Array.prototype.forEach.call(st.children, (el) => {
    if (el === ck || getComputedStyle(el).position === 'absolute') return;
    otros += el.offsetHeight; hermanos++;
  });
  const alto = Math.max(40, hueco - otros - gap * hermanos);
  const libre = Math.max(40, ancho);
  ck.style.fontSize = '100px';
  const w = ck.scrollWidth || 100;
  const h = ck.offsetHeight || ck.scrollHeight || 100;
  const escala = Math.min(libre / w, alto / h);
  ck.style.fontSize = Math.max(28, Math.floor(100 * escala)) + 'px';
  timer.relojLen = (ck.textContent || '').length;
}
function setStage(cls, stateText, clock, sub, big) {
  const st = $('#tstage'); if (!st) return;
  st.className = 'timer-stage ' + cls;
  $('#tstate').textContent = stateText;
  const ck = $('#clock');
  const cambiaAncho = (ck.textContent || '').length !== clock.length;
  ck.textContent = clock; ck.className = 'clock' + (big || clock.length <= 2 ? '' : clock.length > 5 ? ' small' : '');
  const subAntes = $('#tsub').textContent;
  $('#tsub').textContent = sub || '';
  if (cambiaAncho || subAntes !== (sub || '') || timer.relojLen == null) ajustaReloj();
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
      '<label class="check"><input type="checkbox" data-action="toggle-full"' + (timer.full ? ' checked' : '') + '> Pantalla completa en horizontal al empezar</label>' +
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
    const enMarcha = (s === 'prep' || s === 'running' || s === 'paused');
    const capa = enMarcha && timer.full;
    if (capa) html += '<div class="crono-capa"><div class="crono-giro">';
    html += '<div class="timer-stage" id="tstage"><span class="state" id="tstate"></span><span class="clock" id="clock">' + (s === 'done' ? fmtTime(timer.finalSec) : '') + '</span><span class="sub" id="tsub"></span>' + (w ? '<span class="wod-name">' + esc(w.name) + '</span>' : '') +
      '<button class="crono-salir" data-action="' + (capa ? 'timer-ventana' : 'timer-pantalla') + '" aria-label="' + (capa ? 'Salir de pantalla completa' : 'Ver a pantalla completa') + '">' + icon(capa ? 'x' : 'expandir') + '</button>' + '</div>';
    if (s === 'prep') {
      html += '<div class="timer-controls"><button class="btn big" data-action="timer-skip">Saltar cuenta atrás</button><button class="btn ghost big" data-action="timer-reset">Cancelar</button></div>';
    } else if (s === 'running' || s === 'paused') {
      const showRounds = timer.mode === 'fortime' || timer.mode === 'amrap';
      const rondaBtn = showRounds ? '<button class="btn primary big" data-action="timer-round">+1 ' + (timer.mode === 'amrap' ? 'ronda' : 'vuelta') + '</button>' : '';
      if (capa) {
        /* En pantalla completa manda el reloj: una sola barra de botones. */
        html += '<div class="timer-controls barra">' + rondaBtn +
          (s === 'running' ? '<button class="btn big" data-action="timer-pause">Pausa</button>' : '<button class="btn primary big" data-action="timer-resume">Reanudar</button>') +
          '<button class="btn danger big" data-action="timer-finish">Terminar</button></div>';
      } else {
        html += (showRounds ? '<div class="round-counter"><span><span class="val" id="round-val">' + timer.rounds + '</span><span class="lbl">' + (timer.mode === 'amrap' ? 'rondas' : 'vueltas') + '</span></span><span class="laps" id="laps">' + lapsHtml() + '</span><button class="btn primary" data-action="timer-round">+1 ' + (timer.mode === 'amrap' ? 'ronda' : 'vuelta') + '</button></div>' : '') +
          '<div class="timer-controls">' + (s === 'running' ? '<button class="btn big" data-action="timer-pause">Pausa</button>' : '<button class="btn primary big" data-action="timer-resume">Reanudar</button>') +
          '<button class="btn danger big" data-action="timer-finish">Terminar</button>' + (s === 'paused' ? '<button class="btn ghost full" data-action="timer-reset">Reiniciar</button>' : '') + '</div>';
      }
    } else if (s === 'done') {
      const endText = timer.endReason === 'cap' ? 'Time cap' : timer.endReason === 'time' ? 'Tiempo cumplido' : 'Terminado';
      const summary = timer.mode === 'amrap' ? timer.rounds + ' ronda' + (timer.rounds === 1 ? '' : 's') + ' completas' : timer.mode === 'fortime' ? (timer.endReason === 'cap' ? 'Se acabó el tiempo' : 'Tiempo final') : 'Sesión completada';
      html += '<div class="card" style="text-align:center"><span class="eyebrow">' + esc(endText) + '</span><div class="h-display h1">' + esc(timer.mode === 'amrap' ? timer.rounds + ' rd' : fmtTime(timer.finalSec)) + '</div><span class="muted">' + esc(summary) + (timer.mode === 'amrap' && timer.endReason !== 'time' ? ' · parado a los ' + fmtTime(timer.finalSec) : '') + '</span>' + (timer.laps.length ? '<div class="laps" style="justify-content:center">' + lapsHtml() + '</div>' : '') + '</div>';
      html += '<div class="timer-controls"><button class="btn primary big" data-action="timer-save">Apuntar resultado</button><button class="btn ghost big" data-action="timer-reset">Reiniciar</button></div>';
    }
    if (capa) html += '</div></div>';       // cierra la capa apaisada
  }
  return html + '</div>';
}
function afterRenderTimer() {
  if (state.view !== 'timer') return;
  timer.relojLen = null;
  if (timer.status === 'prep' || timer.status === 'running') timerTick();
  else if (timer.status === 'paused') { setStage('', 'En pausa', timer.mode === 'amrap' ? fmtTime(Math.ceil(timerTotal() - timer.acc)) : fmtTime(Math.floor(timer.acc)), timerModeLabel()); }
  else if (timer.status === 'done') { setStage('done', timer.endReason === 'cap' ? 'Time cap' : timer.endReason === 'time' ? 'Tiempo cumplido' : 'Terminado a los ' + fmtTime(timer.finalSec), timer.mode === 'amrap' ? (timer.rounds + ' rd') : fmtTime(timer.finalSec), timerModeLabel()); }
  ajustaReloj();
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
    '<div class="inline-fields"><div class="field"><label for="f-athlete">Atleta</label>' +
    (soyAdmin()
      ? '<select id="f-athlete">' + athletes.map((a) => '<option value="' + esc(a.id) + '"' + (a.id === (pre.athleteId || state.meId) ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select>'
      : '<select id="f-athlete" disabled><option value="' + esc(state.meId || '') + '">' + esc((me() || { name: '—' }).name) + '</option></select>') + '</div>' +
    '<div class="field"><label for="f-date">Fecha</label><input type="date" id="f-date" value="' + esc(pre.date || todayISO()) + '" max="' + todayISO() + '"></div></div>' +
    '<div id="f-score">' + (w ? scoreFields(w.scoreType, pre) : '<p class="muted small">Elige un entreno para ver qué se apunta.</p>') + '</div>' +
    '<label class="check"><input type="checkbox" id="f-rx"' + (pre.rx === false ? '' : ' checked') + '> Rx (tal cual está escrito, con las cargas prescritas). Quítalo si lo escalaste.</label>' +
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
  const athleteId = soyAdmin() ? $('#f-athlete').value : state.meId; const date = $('#f-date').value;
  if (!athleteById(athleteId)) { err.textContent = 'Elige tu atleta antes de apuntar.'; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = 'Pon una fecha válida.'; return; }
  if (date > todayISO()) { err.textContent = 'La fecha no puede ser futura.'; return; }
  const r = { id: uid(), athleteId, workoutId: w.id, workoutName: w.name, category: w.category, scoreType: w.scoreType, date, rx: $('#f-rx').checked, notes: $('#f-notes').value.trim(), createdAt: nowISO(), createdBy: state.meId || athleteId };
  if (w.scoreType === 'time') {
    const capped = $('#f-capped').checked;
    if (capped) {
      const reps = Number($('#f-reps').value);
      if (!(reps > 0) || $('#f-reps').value === '') { err.textContent = 'Indica las reps completadas al llegar al cap (si no hiciste ninguna, no hay marca que apuntar).'; return; }
      r.finished = false; r.reps = reps; r.seconds = w.timeCapMin ? w.timeCapMin * 60 : (readTime() || 0);
    } else {
      const sec = readTime();
      if (sec == null || sec <= 0) { err.textContent = 'Pon el tiempo en minutos y segundos.'; return; }
      r.finished = true; r.seconds = sec;
    }
  } else if (w.scoreType === 'rounds') {
    const rounds = Number($('#f-rounds').value), reps = Number($('#f-reps').value || 0);
    if ($('#f-rounds').value === '' || !(rounds >= 0) || !(reps >= 0)) { err.textContent = 'Pon las rondas completas (y las reps de la última, si las hay).'; return; }
    if (rounds + reps <= 0) { err.textContent = 'Una marca en cero no cuenta: pon al menos una ronda o unas repeticiones.'; return; }
    r.rounds = rounds; r.reps = reps;
  } else if (w.scoreType === 'reps') {
    const reps = Number($('#f-reps').value);
    if ($('#f-reps').value === '' || !(reps >= 0)) { err.textContent = 'Pon las reps totales.'; return; }
    if (reps <= 0) { err.textContent = 'Una marca en cero no cuenta: pon las repeticiones que hiciste.'; return; }
    r.reps = reps;
  } else if (w.scoreType === 'load') {
    const load = Number($('#f-load').value);
    if (!(load > 0)) { err.textContent = 'Pon el peso en kilos.'; return; }
    r.load = load;
  }
  try {
    await state.store.set('results', r.id, r);
    const pr = isPR(Object.assign({}, r));
    toast(pr ? '¡PR! ' + fmtScore(r) + ' en ' + w.name : 'Apuntado: ' + fmtScore(r) + ' en ' + w.name);
    if (state.view === 'timer') { closeSheet(); timerReset(); go('wod', { id: w.id }); }
    else { dismissSheet(); render(); }
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
  if (existingId && !puedoEditarEntreno(state.workouts.find((x) => x.id === existingId))) { err.textContent = 'Ese entreno lo creó otra persona.'; return; }
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
    toast(existing ? 'Entreno actualizado' : 'Entreno creado: ' + w.name);
    go('wod', { id: w.id });                 // go() cierra la hoja y sustituye su entrada
  } catch (e) { err.textContent = 'No se pudo guardar: ' + (e.message || e); }
}
function openNewAthlete(existing) {
  if (existing && !puedoEditarAtleta(existing)) { noPuedes('Solo puedes editar tu atleta'); return; }
  const a = existing || { name: '', color: COLORS[state.athletes.length % COLORS.length] };
  const body = (existing ? '' : (state.athletes.length ? '' : '<p class="muted">Bienvenido a ' + APP_NAME + '. Crea tu atleta para empezar a apuntar tiempos.</p>')) +
    '<div class="field"><label for="a-name">Nombre</label><input type="text" id="a-name" value="' + esc(a.name) + '" placeholder="Como te llaman en el box" maxlength="30"></div>' +
    '<div class="field"><span class="label">Tu disco</span><div class="color-picks">' + COLORS.map((c) => '<button type="button" data-action="pick-color" data-color="' + c + '" aria-pressed="' + (a.color === c) + '" aria-label="' + esc(COLOR_LABEL[c]) + '" title="' + esc(COLOR_LABEL[c]) + '" style="--c:var(--plate-' + (c === 'black' ? 'white' : c) + ')' + (c === 'black' ? ';background:#3a3f39' : '') + '"></button>').join('') + '</div></div>' +
    (!existing || soyYo(existing.id)
      ? '<div class="field"><label for="a-pin">PIN (opcional)</label><input type="password" id="a-pin" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="' + (tienePin(a) ? 'ya tienes uno: escribe otro para cambiarlo' : 'de 4 a 8 números') + '">' +
        '<span class="hint">Con PIN, nadie más puede ponerse tu nombre en “¿Quién eres?” ni apuntar marcas por ti.' + (tienePin(a) ? ' <button type="button" class="link" data-action="quitar-pin" data-id="' + esc(a.id) + '">Quitar el PIN</button>' : '') + '</span></div>'
      : '<div class="banner"><span class="dot"></span><span>' + (tienePin(a) ? esc(a.name) + ' tiene PIN. Solo puede cambiarlo o quitarlo ' + esc(a.name) + '.' : 'El PIN solo se lo puede poner cada uno.') + '</span></div>') +
    (existing && soyAdmin() && !soyYo(existing.id) ? '<label class="check"><input type="checkbox" id="a-admin"' + (esAdmin(existing) ? ' checked' : '') + (ADMINS_INICIALES.indexOf(existing.id) >= 0 ? ' disabled' : '') + '> Puede administrar el club</label>' : '') +
    '<p class="form-error" id="a-error"></p>';
  openSheet({ title: existing ? 'Editar atleta' : 'Nuevo atleta', body, foot: (existing && puedoBorrarAtleta(existing) ? '<button class="btn danger" data-action="delete-athlete" data-id="' + esc(existing.id) + '">' + icon('trash') + '</button>' : '') + '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="save-athlete" data-id="' + esc(existing ? existing.id : '') + '">Guardar</button>' });
}
async function saveAthlete(existingId) {
  const err = $('#a-error'); err.textContent = '';
  if (existingId && !puedoEditarAtleta(athleteById(existingId))) { err.textContent = 'Solo puedes editar tu atleta.'; return; }
  const name = $('#a-name').value.trim();
  const colorBtn = $('.color-picks [aria-pressed="true"]'); const color = colorBtn ? colorBtn.dataset.color : 'red';
  if (name.length < 2) { err.textContent = 'Pon un nombre (mínimo 2 letras).'; $('#a-name').focus(); return; }
  if (state.athletes.some((a) => a.id !== existingId && a.name.toLowerCase() === name.toLowerCase())) { err.textContent = 'Ya hay un atleta con ese nombre.'; $('#a-name').focus(); return; }
  const existing = existingId ? athleteById(existingId) : null;
  if (!existing && state.store.pull) {                    // por si alguien se ha dado de alta hace un momento
    try { await state.store.pull(); } catch (e) { }
    if (state.athletes.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      err.textContent = 'Alguien acaba de crear ese atleta. Elígelo en “¿Quién eres?”.'; return;
    }
  }
  const a = Object.assign({}, existing || {}, { id: existingId || uid(), name, color, createdAt: existing ? existing.createdAt : nowISO() });
  /* Club recién estrenado: el primero que se da de alta administra, para que no
     se quede nadie con los mandos. */
  if (!existing && !state.athletes.some(esAdmin)) a.admin = true;
  const campoPin = $('#a-pin');
  if (campoPin && campoPin.value.trim()) {
    if (existing && !soyYo(existing.id)) { err.textContent = 'El PIN solo se lo puede poner cada uno.'; return; }
    const pin = campoPin.value.trim();
    if (!/^\d{4,8}$/.test(pin)) { err.textContent = 'El PIN son de 4 a 8 números.'; return; }
    a.pin = await creaPin(pin, a.id);
    marcaPinValidado(a.id);
  }
  const campoAdmin = $('#a-admin');
  if (campoAdmin && soyAdmin() && existing && !soyYo(existing.id)) a.admin = !!campoAdmin.checked;
  try {
    await state.store.set('athletes', a.id, a);
    if (!existing) { state.athletes = state.athletes.filter((x) => x.id !== a.id).concat([a]); setMe(a.id); }
    dismissSheet(); toast(existing ? 'Atleta actualizado' : '¡Bienvenido, ' + a.name + '!'); render();
  } catch (e) { err.textContent = 'No se pudo guardar: ' + (e.message || e); }
}
function openPinSheet(a) {
  openSheet({
    title: 'PIN de ' + a.name,
    body: '<p class="small muted">' + esc(a.name) + ' ha puesto un PIN para que nadie apunte marcas en su nombre. Si eres ' + esc(a.name) + ', escríbelo.</p>' +
      '<div class="field"><label for="pin-valor">PIN</label><input type="password" id="pin-valor" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="••••"></div>' +
      '<p class="form-error" id="pin-error"></p>',
    foot: '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="pin-check" data-id="' + esc(a.id) + '">Entrar</button>',
  });
}
function openPickAthlete() {
  if (!state.athletes.length) { openNewAthlete(); return; }
  const body = '<p class="muted">¿Quién está usando este móvil? Los tiempos que apuntes contarán para ese atleta.</p><div class="athlete-grid">' + state.athletes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) => '<button class="athlete-card" data-action="select-athlete" data-id="' + esc(a.id) + '" aria-pressed="' + (a.id === state.meId) + '" aria-label="' + esc(a.name) + '">' + avatar(a, 'lg') + '<span class="nm">' + esc(a.name) + (tienePin(a) ? ' 🔒' : '') + '</span></button>').join('') + '</div>';
  openSheet({ title: '¿Quién eres?', body, focus: false, foot: '<button class="btn" data-action="new-athlete">+ Soy nuevo</button>' });
}
function openTokenSheet() {
  const y = state.store.status ? state.store.status() : {};
  const aviso = y.badToken
    ? '<div class="banner bad"><span class="dot"></span><span>El código que tenías ha caducado o ya no vale. Hace falta uno nuevo.</span></div>'
    : (y.diasParaCaducar != null && y.diasParaCaducar <= 21 ? '<div class="banner"><span class="dot"></span><span>El código actual caduca el ' + esc(fmtDateFull(y.caduca)) + '.</span></div>' : '');
  const body = aviso +
    '<p class="small muted">El código de acceso es un token de GitHub que permite escribir en el repositorio del club. Pídeselo a quien administra el club y pégalo aquí: se guarda solo en este dispositivo y nunca sale en las copias exportadas.</p>' +
    '<p class="small muted">Quien administra el club lo crea en <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Fine-grained tokens</a>: acceso solo a este repositorio y permiso <b>Contents: Read and write</b>.</p>' +
    '<div class="field"><label for="gh-tok">Código de acceso</label><input type="text" id="gh-tok" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"></div><p class="form-error" id="gh-error"></p>';
  openSheet({ title: 'Código de acceso', body, foot: '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="gh-save-token">Conectar</button>' });
}
function exportData() {
  const data = state.store.exportAll(); delete data.deleted;
  /* Las huellas de los PIN no salen del club en una copia. */
  Object.keys(data.athletes || {}).forEach((id) => { if (data.athletes[id]) { data.athletes[id] = Object.assign({}, data.athletes[id]); delete data.athletes[id].pin; } });
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'llorones-' + todayISO() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  toast('Copia exportada');
}
function importData() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json,.json';
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || (data.app !== 'llorones' && data.app !== 'la-pizarra')) throw new Error('No es una copia de ' + APP_NAME);
      const n = state.store.importAll(data);
      toast('Importados ' + n + ' registros'); render();
    } catch (e) { toast('No se pudo importar: ' + e.message, true); }
  };
  input.click();
}

/* ============================================================
   Navegación y acciones
   ============================================================ */
function go(view, params, desdeAtras) {
  if ($('#sheet-root').firstChild) closeSheet();   // se cierra sin tocar el historial...
  state.view = view; state.params = params || {}; state.expanded = null;
  if (!desdeAtras) {
    try {
      const st = { view: view, params: state.params };
      /* ...y su entrada del historial se sustituye por la pantalla de destino,
         para que el atrás no se quede en una hoja que ya no existe. */
      if (history.state && history.state.sheet) history.replaceState(st, '');
      else history.pushState(st, '');
    } catch (e) { }
  }
  window.scrollTo(0, 0);
  render();
}
function render() {
  renderTopbar(); renderTabs();
  const views = { home: viewHome, wods: viewWods, wod: viewWod, timer: viewTimer, ranking: viewRanking, profile: viewProfile, rx: viewRx };
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
  'select-athlete': (el) => {
    const a = athleteById(el.dataset.id);
    if (!a) return;
    if (tienePin(a) && !soyYo(a.id) && !pinValidado(a.id)) { openPinSheet(a); return; }
    setMe(a.id); dismissSheet(); toast('Ahora eres ' + a.name); render();
  },
  'pin-check': async (el) => {
    const a = athleteById(el.dataset.id); const err = $('#pin-error');
    const pin = ($('#pin-valor').value || '').trim();
    if (!a) return;
    if (!/^\d{4,8}$/.test(pin)) { err.textContent = 'El PIN son de 4 a 8 números.'; return; }
    const boton = el;
    boton.disabled = true; err.textContent = 'Comprobando…';
    const vale = await compruebaPin(pin, a);
    boton.disabled = false;
    if (!vale) {
      state.pinFallos = (state.pinFallos || 0) + 1;
      err.textContent = 'Ese PIN no es el de ' + a.name + '.' + (state.pinFallos >= 3 ? ' Llevas ' + state.pinFallos + ' intentos.' : '');
      $('#pin-valor').value = '';
      if (state.pinFallos >= 5) {           // a la quinta, un respiro para no ir probando a lo bruto
        boton.disabled = true; err.textContent = 'Demasiados intentos. Espera unos segundos.';
        setTimeout(() => { if ($('#pin-error')) { boton.disabled = false; $('#pin-error').textContent = ''; } }, 15000);
      } else $('#pin-valor').focus();
      return;
    }
    state.pinFallos = 0;
    marcaPinValidado(a.id); setMe(a.id); dismissSheet(); toast('Ahora eres ' + a.name); render();
  },
  'pick-color': (el) => { $$('.color-picks button').forEach((b) => b.setAttribute('aria-pressed', b === el)); },
  'save-athlete': (el) => saveAthlete(el.dataset.id || null),
  'quitar-pin': async (el) => {
    const a = athleteById(el.dataset.id);
    if (!a || !soyYo(a.id)) { noPuedes('El PIN solo lo puede quitar su dueño'); return; }
    const copia = Object.assign({}, a); delete copia.pin;
    await state.store.set('athletes', a.id, copia);
    dismissSheet(); toast('PIN quitado'); render();
  },
  'delete-athlete': async (el) => {
    const a = athleteById(el.dataset.id); if (!a) return;
    if (!puedoBorrarAtleta(a)) { noPuedes('Solo quien administra el club puede borrar a otros'); return; }
    if (ADMINS_INICIALES.indexOf(a.id) >= 0) { noPuedes('A quien montó el club no se le puede borrar'); return; }
    if (esAdmin(a) && state.athletes.filter(esAdmin).length <= 1) { noPuedes('Es la única persona que administra el club: nombra antes a otra'); return; }
    const suyas = state.results.filter((r) => r.athleteId === a.id);
    if (await confirmSheet('Borrar atleta', '¿Borrar a ' + a.name + '?' + (suyas.length ? ' Se borrarán también sus ' + suyas.length + ' marca' + (suyas.length === 1 ? '' : 's') + '.' : ''))) {
      for (const r of suyas) await state.store.remove('results', r.id);
      await state.store.remove('athletes', a.id);
      if (state.meId === a.id) setMe(null);
      dismissSheet(); toast('Atleta borrado'); render();
    } else dismissSheet();
  },
  'new-workout': (el) => {
    if (!me()) { openPickAthlete(); return; }      // sin atleta el entreno nacería sin dueño
    openWorkoutForm(null, el.dataset.date || '');
  },
  'edit-workout': (el) => {
    const w = state.workouts.find((x) => x.id === el.dataset.id);
    if (!w) return;
    if (!puedoEditarEntreno(w)) { noPuedes('Ese entreno lo creó otra persona'); return; }
    openWorkoutForm(w);
  },
  'delete-workout': async (el) => {
    const w = state.workouts.find((x) => x.id === el.dataset.id); if (!w) return;
    if (!puedoEditarEntreno(w)) { noPuedes('Ese entreno lo creó otra persona'); return; }
    const marcas = state.results.filter((r) => r.workoutId === w.id);
    const ajenas = marcas.filter((r) => !soyYo(r.athleteId)).length;
    if (ajenas && !soyAdmin()) { noPuedes('Hay ' + ajenas + ' marca' + (ajenas === 1 ? '' : 's') + ' de otra gente en ese entreno: que lo borre quien administra el club'); return; }
    if (await confirmSheet('Borrar entreno', '¿Borrar “' + w.name + '”?' + (marcas.length ? ' Se borrarán también las ' + marcas.length + ' marca' + (marcas.length === 1 ? '' : 's') + ' apuntadas' + (ajenas ? ' (' + ajenas + ' de otras personas)' : '') + '.' : ''))) {
      for (const r of marcas) await state.store.remove('results', r.id);
      toast('Entreno borrado'); await state.store.remove('workouts', w.id); go('wods');
    } else dismissSheet();
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
    if (!puedoBorrarResultado(r)) { noPuedes('Solo puedes borrar tus marcas'); return; }
    if (await confirmSheet('Borrar resultado', '¿Borrar ' + fmtScore(r) + ' de ' + r.workoutName + '?')) { await state.store.remove('results', r.id); dismissSheet(); toast('Resultado borrado'); render(); }
    else dismissSheet();
  },
  'close-sheet': () => dismissSheet(),
  'sheet-backdrop': (el, e) => { if (e.target === el) dismissSheet(); },
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
  'timer-ventana': () => { timer.full = false; localStorage.setItem(LS_PREFIX + 'full', 'off'); pantallaCompleta(false); render(); },
  'timer-pantalla': () => { timer.full = true; localStorage.setItem(LS_PREFIX + 'full', 'on'); pantallaCompleta(true); render(); },
  'timer-round': () => timerRound(),
  'timer-save': () => {
    const w = timer.workoutId ? getWorkout(timer.workoutId) : null;
    const pre = {};
    if (timer.mode === 'amrap') { pre.rounds = timer.rounds; pre.reps = 0; }
    else if (timer.mode === 'fortime') { if (timer.endReason === 'cap') { pre.finished = false; pre.reps = 0; } else pre.seconds = Math.round(timer.finalSec); }
    else pre.reps = 0;
    openLogResult(w ? w.id : null, pre);
  },
  'gh-token': () => openTokenSheet(),
  'gh-save-token': async (el) => {
    const t = $('#gh-tok').value.trim(); const err = $('#gh-error');
    if (t.length < 20) { err.textContent = 'Eso no parece un código de acceso de GitHub.'; return; }
    err.textContent = 'Comprobando el código…'; el.disabled = true;
    const r = await state.store.checkToken(t);
    el.disabled = false;
    if (!r.ok) { err.textContent = r.motivo; return; }
    state.store.setToken(t); dismissSheet(); toast('Conectado: ya compartes tus marcas'); render();
  },
  'gh-forget': async () => { if (await confirmSheet('Quitar código', 'Este móvil pasará a solo lectura: verás las marcas de todos, pero las tuyas no se compartirán.', 'Quitar')) { state.store.setToken(''); dismissSheet(); render(); } else dismissSheet(); },
  'gh-sync': () => { state.store.pull(); toast('Sincronizando…'); },
  'rx-num': async (el) => {
    const m = me(); if (!m) return;
    const rx = Object.assign({}, misRx(m));
    const v = Object.assign({}, rx[el.dataset.mov] || {});
    const n = Number(el.value);
    if (el.value === '' || !(n > 0)) delete v[el.dataset.campo]; else v[el.dataset.campo] = n;
    if (Object.keys(v).length) rx[el.dataset.mov] = v; else delete rx[el.dataset.mov];
    await state.store.update('athletes', m.id, { rx });
  },
  'rx-estado': async (el) => {
    const m = me(); if (!m) return;
    const rx = Object.assign({}, misRx(m));
    const v = Object.assign({}, rx[el.dataset.mov] || {});
    if (!el.value) delete v.estado; else v.estado = el.value;
    if (Object.keys(v).length) rx[el.dataset.mov] = v; else delete rx[el.dataset.mov];
    await state.store.update('athletes', m.id, { rx });
  },
  'rx-nota': async (el) => {
    const m = me(); if (!m) return;
    const rx = Object.assign({}, misRx(m));
    const v = Object.assign({}, rx[el.dataset.mov] || {});
    const t = el.value.trim();
    if (!t) delete v.nota; else v.nota = t;
    if (Object.keys(v).length) rx[el.dataset.mov] = v; else delete rx[el.dataset.mov];
    await state.store.update('athletes', m.id, { rx });
  },
  'export': () => exportData(),
  'import': () => { if (!soyAdmin()) { noPuedes('Importar una copia cambia los datos de todos: solo quien administra el club'); return; } importData(); },
  'toggle-full': (el) => { timer.full = el.checked; localStorage.setItem(LS_PREFIX + 'full', timer.full ? 'on' : 'off'); },
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
    if (e.key === 'Escape' && $('#sheet-root').firstChild) dismissSheet();
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest('.sheet')) { const btn = $('.sheet-foot .btn.primary'); if (btn && e.target.type !== 'number') { e.preventDefault(); btn.click(); } }
  });
  $$('#tabbar .tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  try { history.replaceState({ view: 'home', params: {} }, ''); } catch (e) { }
  window.addEventListener('popstate', (e) => {          // el atrás del móvil cierra la hoja o vuelve atrás en la app
    if ($('#sheet-root').firstChild) { closeSheet(); return; }
    const st = e.state;
    if (st && st.view) go(st.view, st.params, true);
  });
  window.addEventListener('resize', () => { if (state.view === 'timer') ajustaReloj(); });
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', () => setTimeout(ajustaReloj, 250));
  window.addEventListener('beforeunload', (e) => { if (timer.status === 'running' || timer.status === 'prep') { e.preventDefault(); e.returnValue = ''; } });

  state.meId = readMe();
  render();
  state.store = await chooseStore();
  if (state.store.onStatus) state.store.onStatus(() => { if ((state.view === 'home' || state.view === 'profile') && !$('#sheet-root').firstChild) render(); });
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
  if (state.store.start) state.store.start();
}
boot();
