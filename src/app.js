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
const APP_VERSION = '1.9.2';
/* Quien montó el club manda desde el principio. Después puede nombrar a más
   admins desde Perfil, y eso queda guardado en el propio atleta. */
const ADMINS_INICIALES = ['mtr14k1bb9bg49'];
const APP_NAME = 'Llorones Crossfit Club';
const CREW_NAME = 'Crossfit Club';

/* Datos incrustados en el build */
const HEROES = /*__HEROES__*/[];
const GIRLS = /*__GIRLS__*/[];
const MOVIMIENTOS = /*__MOVIMIENTOS__*/[];
const CUERPO = /*__CUERPO__*/{ front: [], back: [] };   // paths SVG del cuerpo (react-native-body-highlighter, MIT)

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
  rxPct: leePct(),                 // Mis Rx: porcentaje con el que se miran las cargas
  rxSearch: '',                    // Mis Rx: filtro del buscador
  muscTab: 'equilibrio',           // Tus músculos: equilibrio | fatiga
  muscPeriodo: '30',               // Tus músculos: semana | 30 | 90 | todo
  sugDur: leeSugDur(),             // Entrenos sugeridos: minutos que tienes (5-25)
  sugSeed: 0,                      // Entrenos sugeridos: "Otras ideas" cambia la semilla
  versionNueva: '',                // versión publicada más nueva que la que corre, si la hay
};
const athleteById = (id) => state.athletes.find((a) => a.id === id) || null;
/* ---- quién puede qué (dentro de la app) ---- */
function esAdmin(a) { return !!a && (a.admin === true || ADMINS_INICIALES.indexOf(a.id) >= 0); }
function soyAdmin() { return esAdmin(me()); }
function soyYo(id) { const m = me(); return !!m && m.id === id; }
function puedoEditarAtleta(a) { return !!a && (soyAdmin() || soyYo(a.id)); }
function puedoBorrarAtleta(a) { return !!a && (soyAdmin() || soyYo(a.id)); }
function puedoBorrarResultado(r) { return !!r && (soyAdmin() || soyYo(r.athleteId)); }
function puedoEditarResultado(r) { return puedoBorrarResultado(r); }
/* Los héroes y las girls no se tocan. Los nuestros (los guardados no llevan `category`)
   los edita quien los creó o quien administra el club, da igual quién los metiera. */
function puedoEditarEntreno(w) { return !!w && (!w.category || w.category === 'custom') && (soyAdmin() || (w.createdBy && soyYo(w.createdBy))); }
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
  ['Mejorar tu mejor marca de días anteriores (PR)', '+5'],
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
  const valid = state.results.filter((r) => athleteById(r.athleteId) && marcaValida(r) && !esRepetida(r));   // una por atleta, entreno y día
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
  state.results.filter((r) => r.workoutId === workoutId && athleteById(r.athleteId) && marcaValida(r) && !esRepetida(r)).forEach((r) => {
    if (!bestBy[r.athleteId] || compareResults(r, bestBy[r.athleteId]) < 0) bestBy[r.athleteId] = r;
  });
  return Object.values(bestBy).sort(compareResults);
}
/* Una marca por atleta, entreno y día. Si hay más (una corrección apuntada como marca nueva),
   cuenta la última que se apuntó y las demás son "repetidas": no suman, no salen en la pizarra
   ni en los músculos, y quien administra puede borrarlas de una vez. */
let _cuentan = null, _cuentanClave = '';
function marcasQueCuentan() {
  const clave = state.results.length + '|' + state.results.reduce((m, r) => ((r.updatedAt || '') > m ? r.updatedAt : m), '');
  if (_cuentan && clave === _cuentanClave) return _cuentan;
  const elegida = {};
  state.results.forEach((r) => {
    const k = r.athleteId + '|' + r.workoutId + '|' + r.date, o = elegida[k];
    const vr = marcaValida(r), vo = o && marcaValida(o);
    if (!o || (vr && !vo) || (vr === vo && (r.createdAt || '') > (o.createdAt || ''))) elegida[k] = r;
  });
  _cuentan = {};
  Object.keys(elegida).forEach((k) => { _cuentan[elegida[k].id] = true; });
  _cuentanClave = clave;
  return _cuentan;
}
function esRepetida(r) { return !!r && !!r.id && state.results.some((x) => x.id === r.id) && !marcasQueCuentan()[r.id]; }
function marcasRepetidas() { return state.results.filter((r) => athleteById(r.athleteId) && esRepetida(r)); }
/* PR: mejorar tu mejor marca de días anteriores en ese entreno. La primera vez que lo haces no
   es PR, y una corrección del mismo día tampoco. */
function isPR(result) {
  if (!marcaValida(result) || esRepetida(result)) return false;
  const prev = state.results.filter((r) => r.athleteId === result.athleteId && r.workoutId === result.workoutId && r.id !== result.id && r.date < result.date && marcaValida(r) && !esRepetida(r));
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
const _movsMemo = new WeakMap();
function movimientosDe(w) {
  if (!w) return [];
  if (w.category === 'hero' || w.category === 'girl') {                 // los de serie no cambian: se detecta una vez
    if (!_movsMemo.has(w)) _movsMemo.set(w, movimientosDeTexto(w));
    return _movsMemo.get(w);
  }
  return movimientosDeTexto(w);
}
function movimientosDeTexto(w) {
  if (w.modo === 'bloques' && Array.isArray(w.bloques)) {      // por bloques manda lo que se eligió de la lista
    const vistos = {};
    return w.bloques.map((b) => movPorId(b.mov)).filter((m) => m && !vistos[m.id] && (vistos[m.id] = true));
  }
  const texto = ' ' + String(w.description || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  const hallados = [];
  MOVIMIENTOS.forEach((m) => {
    let mejor = '';
    m.en.concat([m.nombre]).forEach((alias) => { if (texto.indexOf(alias.toLowerCase()) >= 0 && alias.length > mejor.length) mejor = alias; });
    if (mejor) hallados.push({ mov: m, alias: mejor });
  });
  return hallados.filter((h) => !hallados.some((o) => o !== h && o.alias.length > h.alias.length && o.alias.toLowerCase().indexOf(h.alias.toLowerCase()) >= 0)).map((h) => h.mov);
}
let _movIdx = null;
function movPorId(id) {
  if (!_movIdx) { _movIdx = {}; MOVIMIENTOS.forEach((m) => { _movIdx[m.id] = m; }); }
  return id ? _movIdx[id] || null : null;
}
/* Mis Rx al porcentaje: el 70 % de 65 kg son 45,5 (se redondea a medio kilo). */
function leePct() { try { const v = Number(localStorage.getItem(LS_PREFIX + 'rxpct')); return v >= 1 && v <= 200 ? Math.round(v) : 100; } catch (e) { return 100; } }
function fijaPct(p) { state.rxPct = p; try { localStorage.setItem(LS_PREFIX + 'rxpct', String(p)); } catch (e) { } render(); }
function cargaAlPct(kg, pct) { return Math.round(kg * pct / 100 * 2) / 2; }
function fmtKgNum(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
/* Guarda mis Rx sin redibujar la vista (el campo ya enseña lo escrito) y actualiza el contador. */
async function guardaRx(m, rx) {
  state.rxEditando = true;
  try { await state.store.update('athletes', m.id, { rx }); } finally { state.rxEditando = false; }
  const c = $('#rx-cuenta'); if (c) c.textContent = MOVIMIENTOS.filter((x) => rxTexto(x, rx[x.id])).length + ' de ' + MOVIMIENTOS.length;
}
/* El buscador de Mis Rx esconde lo que no casa (por nombre o alias: "hspu", "kb swing"). */
function aplicaFiltroRx() {
  const q = normaliza(state.rxSearch || '');
  $$('.rx-list').forEach((ul) => {
    let vivos = 0;
    $$('li', ul).forEach((li) => {
      const ctl = $('[data-mov]', li); const m = movPorId(ctl && ctl.dataset.mov);
      const casa = !q || !m || [m.nombre].concat(m.en).some((n) => normaliza(n).indexOf(q) >= 0);
      li.style.display = casa ? '' : 'none'; if (casa) vivos++;
    });
    const sec = ul.closest('section'); if (sec) sec.style.display = vivos ? '' : 'none';
  });
}
function pctTexto(x, v, pct) {
  if (!x || x.tipo !== 'kg' || !(v && v.kg > 0) || !pct || pct === 100) return '';
  return pct + '% → ' + fmtKgNum(cargaAlPct(v.kg, pct)) + ' kg';
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
    const active = b.dataset.view === state.view || (state.view === 'wod' && b.dataset.view === 'wods') || (['rx', 'musculos', 'sugeridos'].indexOf(state.view) >= 0 && b.dataset.view === 'profile');
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
        '<button class="btn" data-action="log-result" data-id="' + esc(w.id) + '">Apuntar</button></div>' +
        '<div class="btn-row" style="margin-top:8px"><button class="btn ghost sm" data-action="open-wod" data-id="' + esc(w.id) + '">Ver ficha</button>' +
        (puedoEditarEntreno(w) ? '<button class="btn ghost sm" data-action="edit-workout" data-id="' + esc(w.id) + '">' + icon('pen') + 'Editar</button><button class="btn ghost sm danger" data-action="delete-workout" data-id="' + esc(w.id) + '">' + icon('trash') + 'Quitar</button>' : '') + '</div></div>';
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
      return '<li class="feed-li"><button class="feed-item row pressable" data-action="open-wod" data-id="' + esc(r.workoutId) + '" aria-label="' + esc((a ? a.name : '?') + ', ' + r.workoutName + ', ' + fmtScore(r)) + '">' + avatar(a) +
        '<span><span class="what"><b>' + esc(a ? a.name : '?') + '</b> · ' + esc(r.workoutName) + '</span><br><span class="when">' + esc(relDate(r.date)) + (r.notes ? ' · ' + esc(r.notes) : '') + '</span></span>' +
        '<span class="right"><span class="score">' + esc(fmtScore(r)) + '</span><span>' + (esRepetida(r) ? badge('nocuenta', 'Repetida') : !marcaValida(r) ? badge('nocuenta', 'No cuenta') : (r.rx ? badge('rx', 'Rx') : '') + (isPR(r) ? ' ' + badge('pr', 'PR') : '')) + '</span></span></button>' + (puedoBorrarResultado(r) ? '<button class="icon-btn" data-action="edit-result" data-id="' + esc(r.id) + '" aria-label="Editar marca">' + icon('pen') + '</button>' : '') + '</li>';
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
    const pesos = musculosDeMovs(movs);
    const orden = Object.keys(pesos).sort((a, b) => pesos[b] - pesos[a]);
    const principales = {}; movs.forEach((x) => (x.mu || []).forEach((id) => { principales[id] = true; }));
    if (orden.length) {
      html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Músculos que trabaja</h2><span class="eyebrow">' + orden.length + ' grupos</span></div>' +
        cuerpoSvg(coloresCalor(pesos), { tocable: true }) + leyenda([[CALOR[0], 'Ayuda'], [CALOR[3], 'Principal']]) +
        '<ul class="musc-chips">' + orden.map((id) => '<li class="' + (principales[id] ? 'principal' : '') + '" data-action="musculo" data-id="' + id + '">' + esc(MUSC_NOMBRE[id]) + '</li>').join('') + '</ul>' +
        '<p class="faint small">Toca un músculo para ver qué movimientos del entreno lo trabajan.</p></section>';
    }
  }
  html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Pizarra</h2><span class="eyebrow">' + esc(SCORE_LABEL[w.scoreType] || '') + '</span></div>';
  if (board.length) {
    html += '<ul class="list wod-lb" style="border:0">' + board.map((r, i) => {
      const a = athleteById(r.athleteId);
      return '<li><span class="pos p' + (i + 1) + '">' + (i + 1) + '</span>' + avatar(a, 'sm') + '<span><span class="title">' + esc(a.name) + '</span><br><span class="small muted">' + esc(fmtDate(r.date)) + '</span></span><span class="right"><span class="s">' + esc(fmtScore(r)) + '</span>' + (r.rx ? badge('rx', 'Rx') : '<span class="faint small">scaled</span>') + '</span>' + (puedoBorrarResultado(r) ? '<span class="acciones"><button class="icon-btn" data-action="edit-result" data-id="' + esc(r.id) + '" aria-label="Editar la marca de ' + esc(a.name) + '">' + icon('pen') + '</button><button class="icon-btn" data-action="delete-result" data-id="' + esc(r.id) + '" aria-label="Borrar la marca de ' + esc(a.name) + '">' + icon('trash') + '</button></span>' : '') + '</li>';
    }).join('') + '</ul>';
  } else {
    html += '<p class="muted">Nadie lo ha hecho todavía. Sé el primero en la pizarra.</p>';
  }
  html += '</section>';
  if (m) {
    html += '<section class="card"><div class="section-head"><h2 class="h-display h2">Tus marcas</h2></div>';
    if (mine.length) {
      html += '<ul class="list history" style="border:0">' + mine.map((r) => '<li><span><span class="d">' + esc(fmtDate(r.date)) + '</span>' + (r.notes ? '<br><span class="small">' + esc(r.notes) + '</span>' : '') + '</span><span class="s">' + esc(fmtScore(r)) + (esRepetida(r) ? ' ' + badge('nocuenta', 'Repetida') : !marcaValida(r) ? ' ' + badge('nocuenta', 'No cuenta') : (r.rx ? ' ' + badge('rx', 'Rx') : '') + (isPR(r) ? ' ' + badge('pr', 'PR') : '')) + '</span><span class="acciones"><button class="icon-btn" data-action="edit-result" data-id="' + esc(r.id) + '" aria-label="Editar marca">' + icon('pen') + '</button><button class="icon-btn" data-action="delete-result" data-id="' + esc(r.id) + '" aria-label="Borrar resultado">' + icon('trash') + '</button></span></li>').join('') + '</ul>';
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
    '<p class="faint small" style="margin-top:10px">Cuenta la mejor marca de cada atleta en cada entreno. El <b>rendimiento</b> compara tu marca con la mejor del club en ese entreno: quien la tiene se lleva los 40, y el resto la parte proporcional (la mitad de tiempo, la mitad de rondas o la mitad de kilos son la mitad de puntos). Si eres el único que lo ha hecho cuenta a la mitad, hasta que otro lo haga. Una marca sin terminar (time cap) no pasa de la mitad. Cada uno tiene una marca por entreno y día. El PR es mejorar tu mejor marca de días anteriores en ese entreno: la primera vez que lo haces no es PR, ni una corrección del mismo día. Los puntos se recalculan en vivo.</p></details></div>';
  return html;
}

/* --- MIS RX --- */
function viewRx() {
  const m = me();
  if (!m) return '<div class="view"><div class="empty"><span class="h-display h2">¿Quién eres?</span><span>Elige tu atleta para guardar tus Rx.</span><button class="btn primary" data-action="pick-athlete">Elegir atleta</button></div></div>';
  const rx = misRx(m);
  const pct = state.rxPct || 100;
  const fijos = [50, 60, 70, 80, 90, 100];
  const puestos = MOVIMIENTOS.filter((x) => rxTexto(x, rx[x.id])).length;
  let html = '<div class="view">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><button class="btn ghost sm" data-action="go" data-view="profile">' + icon('back') + 'Perfil</button><span class="eyebrow" id="rx-cuenta">' + puestos + ' de ' + MOVIMIENTOS.length + '</span></div>' +
    '<section class="card"><span class="eyebrow">' + esc(m.name) + '</span><h1 class="h-display h2">Mis Rx</h1>' +
    '<p class="muted small">Apunta con qué carga haces cada movimiento y cómo lo tienes. Es tuyo y solo tuyo: sirve para saber, de un vistazo, con qué peso vas en cada entreno y para no discutir si algo fue Rx.</p>' +
    '<div class="rx-pct"><span class="label">Ver las cargas al</span><div class="chips">' +
      fijos.map((p) => '<button type="button" class="chip sm" data-action="rx-pct" data-v="' + p + '" aria-pressed="' + (pct === p) + '">' + p + '%</button>').join('') +
      '<span class="otro"><input type="number" inputmode="numeric" min="1" max="200" value="' + (fijos.indexOf(pct) >= 0 ? '' : pct) + '" placeholder="otro" data-action="rx-pct-input" aria-label="Otro porcentaje"><span class="ud">%</span></span></div>' +
    '<p class="faint small">' + (pct === 100 ? 'Elige un porcentaje y debajo de cada movimiento con kilos verás qué carga te toca hoy, redondeada a medio kilo.' : 'Debajo de cada movimiento con kilos tienes tu ' + pct + '%, redondeado a medio kilo.') + '</p></div></section>' +
    '<div class="search rx-search">' + icon('search') + '<input type="search" id="rx-search" placeholder="Buscar movimiento (thr, hspu, kb…)" value="' + esc(state.rxSearch || '') + '" autocomplete="off" autocapitalize="off"></div>';
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
          control = '<input type="text" maxlength="24" value="' + esc(v.nota || '') + '" placeholder="' + esc(x.ph || 'p. ej. 1 km en 4:10') + '" data-action="rx-nota" data-mov="' + esc(x.id) + '" aria-label="' + esc(x.nombre) + '">';
        }
        return '<li><span class="nm">' + esc(x.nombre) + '<span class="pct">' + esc(pctTexto(x, v, pct)) + '</span></span><span class="ctrl">' + control + '</span></li>';
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
      '<p class="muted small">Tus cargas y tu nivel en cada movimiento: ' + MOVIMIENTOS.filter((x) => rxTexto(x, misRx(m)[x.id])).length + ' de ' + MOVIMIENTOS.length + ' puestos.</p></button>' +
      '<button class="card" style="text-align:left;cursor:pointer" data-action="go" data-view="musculos"><div class="section-head"><h2 class="h-display h2">Tus músculos</h2><span class="chev">' + icon('chev') + '</span></div>' +
      '<p class="muted small">Qué has trabajado y qué toca descansar, según los entrenos que has apuntado.</p></button>' +
      '<button class="card" style="text-align:left;cursor:pointer" data-action="go" data-view="sugeridos"><div class="section-head"><h2 class="h-display h2">Entrenos sugeridos</h2><span class="chev">' + icon('chev') + '</span></div>' +
      '<p class="muted small">' + (function () { const t = gruposQueTocan(estadoMuscular(m)).slice(0, 3); return 'Según tu carga y tu fatiga, para lo que tengas: de 5 a 25 min.' + (t.length ? ' Hoy toca ' + esc(nombresMusc(t)) + '.' : ''); })() + '</p></button>';
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
      (function () {
        const r = marcasRepetidas(), n = r.length;
        return n ? '<div class="banner"><span class="dot"></span><span>' + n + ' marca' + (n === 1 ? '' : 's') + ' repetida' + (n === 1 ? '' : 's') + ' (mismo atleta, entreno y día). Solo cuenta la última apuntada.</span><button class="btn sm danger" data-action="borrar-repetidas">Borrar</button></div>' : '';
      })() +
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
    const s = pre.seconds || 0; const mm = Math.floor(s / 60), ss = s % 60;
    return '<div class="field"><span class="label">Tiempo (min : seg)</span><div class="time-input"><input type="number" id="f-m" min="0" max="999" placeholder="min" value="' + (pre.seconds != null ? mm : '') + '" inputmode="numeric" aria-label="Minutos"><span class="colon">:</span><input type="number" id="f-s" min="0" max="59" placeholder="seg" value="' + (pre.seconds != null ? ss : '') + '" inputmode="numeric" aria-label="Segundos"></div><span class="hint">Si pasa de una hora, en minutos: 1 h 15 min son 75:00.</span></div>' +
      '<label class="check"><input type="checkbox" id="f-capped" data-action="toggle-capped"' + (pre.finished === false ? ' checked' : '') + '> No lo terminé (time cap)</label>' +
      '<div class="field" id="f-capped-reps"' + (pre.finished === false ? '' : ' hidden') + '><label for="f-reps">Reps completadas al llegar al cap</label><input type="number" id="f-reps" min="0" value="' + (pre.reps || '') + '" inputmode="numeric"></div>';
  }
  if (scoreType === 'rounds') return '<div class="inline-fields"><div class="field"><label for="f-rounds">Rondas completas</label><input type="number" id="f-rounds" min="0" value="' + (pre.rounds != null ? pre.rounds : '') + '" inputmode="numeric"></div><div class="field"><label for="f-reps">Reps de la última</label><input type="number" id="f-reps" min="0" value="' + (pre.reps || 0) + '" inputmode="numeric"></div></div>';
  if (scoreType === 'reps') return '<div class="field"><label for="f-reps">Reps totales</label><input type="number" id="f-reps" min="0" value="' + (pre.reps != null ? pre.reps : '') + '" inputmode="numeric"></div>';
  if (scoreType === 'load') return '<div class="field"><label for="f-load">Peso (kg)</label><input type="number" id="f-load" min="0" step="0.5" value="' + (pre.load != null ? pre.load : '') + '" inputmode="decimal"></div>';
  return '';
}
function openLogResult(workoutId, pre, editId) {
  pre = pre || {};
  const existente = editId ? state.results.find((x) => x.id === editId) : null;
  const w = workoutId ? getWorkout(workoutId) : null;
  const athletes = state.athletes.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!athletes.length) { openNewAthlete(); return; }
  const body =
    '<input type="hidden" id="f-id" value="' + esc(editId || '') + '">' +
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
  openSheet({ title: existente ? 'Editar marca' : 'Apuntar resultado', body, foot: (existente && puedoBorrarResultado(existente) ? '<button class="btn danger" data-action="delete-result" data-id="' + esc(existente.id) + '" aria-label="Borrar marca">' + icon('trash') + '</button>' : '') + '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="save-result">Guardar</button>' });
}
function readTime() {
  const m = Number($('#f-m').value || 0), s = Number($('#f-s').value || 0);
  if ([m, s].some((n) => isNaN(n) || n < 0) || s > 59 || m > 999) return null;
  return Math.round(m * 60 + s);
}
async function saveResult(reemplazaId) {
  const err = $('#f-error'); err.textContent = '';
  const wid = $('#f-wod').value; const w = getWorkout(wid);
  if (!w) { err.textContent = 'Elige un entreno.'; return; }
  const editId = ($('#f-id') || {}).value || '';
  let existente = editId ? state.results.find((x) => x.id === editId) : null;
  if (editId && !existente) { err.textContent = 'Esa marca ya no existe.'; return; }
  if (!existente && reemplazaId) existente = state.results.find((x) => x.id === reemplazaId) || null;   // "Cambiarla por esta"
  if (existente && !puedoEditarResultado(existente)) { err.textContent = 'Solo puedes cambiar tus marcas.'; return; }
  const athleteId = soyAdmin() ? $('#f-athlete').value : (existente ? existente.athleteId : state.meId); const date = $('#f-date').value;
  if (!athleteById(athleteId)) { err.textContent = 'Elige tu atleta antes de apuntar.'; return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { err.textContent = 'Pon una fecha válida.'; return; }
  if (date > todayISO()) { err.textContent = 'La fecha no puede ser futura.'; return; }
  // una marca por atleta, entreno y día: si ya hay una, se ofrece cambiarla en vez de duplicarla
  const otra = state.results.find((x) => x.athleteId === athleteId && x.workoutId === w.id && x.date === date && (!existente || x.id !== existente.id));
  if (otra) {
    const quien = athleteId === state.meId ? 'tienes' : 'tiene ' + athleteById(athleteId).name;
    if (editId) { err.textContent = 'Ese día ya ' + quien + ' otra marca en ' + w.name + ' (' + fmtScore(otra) + '). Solo cabe una por día: cambia la fecha o borra la otra.'; return; }
    err.innerHTML = esc('Ese día ya ' + quien + ' una marca en ' + w.name + ': ' + fmtScore(otra) + '. Solo cabe una por día.') +
      ' <button type="button" class="link" data-action="save-result" data-reemplaza="' + esc(otra.id) + '">Cambiarla por esta</button>';
    return;
  }
  // al editar se rehace entera (mismo id y creación): no quedan campos de otro tipo de marca
  const r = Object.assign(existente ? { id: existente.id, createdAt: existente.createdAt || nowISO(), createdBy: existente.createdBy || existente.athleteId } : { id: uid(), createdAt: nowISO(), createdBy: state.meId || athleteId },
    { athleteId, workoutId: w.id, workoutName: w.name, category: w.category, scoreType: w.scoreType, date, rx: $('#f-rx').checked, notes: $('#f-notes').value.trim() });
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
    if (existente) { toast('Marca actualizada: ' + fmtScore(r) + ' en ' + w.name); dismissSheet(); render(); return; }
    const pr = isPR(Object.assign({}, r));
    toast(pr ? '¡PR! ' + fmtScore(r) + ' en ' + w.name : 'Apuntado: ' + fmtScore(r) + ' en ' + w.name);
    if (state.view === 'timer') { closeSheet(); timerReset(); go('wod', { id: w.id }); }
    else { dismissSheet(); render(); }
  } catch (e) { err.textContent = 'No se pudo guardar: ' + (e.message || e); }
}
/* ============================================================
   Músculos: qué trabaja cada entreno y qué has trabajado tú
   ============================================================ */
const MUSCULOS = [
  ['hom', 'Hombros', 'deltoids'], ['pec', 'Pecho', 'chest'], ['bic', 'Bíceps', 'biceps'], ['tri', 'Tríceps', 'triceps'],
  ['ant', 'Antebrazos', 'forearm'], ['tra', 'Trapecio', 'trapezius'], ['dor', 'Espalda alta', 'upper-back'], ['lum', 'Lumbar', 'lower-back'],
  ['abd', 'Abdominales', 'abs'], ['obl', 'Oblicuos', 'obliques'], ['glu', 'Glúteos', 'gluteal'], ['cua', 'Cuádriceps', 'quadriceps'],
  ['isq', 'Isquios', 'hamstring'], ['adu', 'Aductores', 'adductors'], ['gem', 'Gemelos', 'calves'], ['tib', 'Tibiales', 'tibialis'],
];
const MUSC_NOMBRE = {}, MUSC_POR_PARTE = {};
MUSCULOS.forEach((m) => { MUSC_NOMBRE[m[0]] = m[1]; MUSC_POR_PARTE[m[2]] = m[0]; });
const CALOR = ['#2c6b3d', '#2f9a4d', '#3fc45f', '#6dff8a'];              // de menos a más trabajado
const FATIGA = { fatigado: '#ef4444', recuperando: '#f5c518' };
const PESO_SEC = 0.3;                                                    // lo que suma un músculo que solo ayuda
const PERIODOS_MUSC = { semana: ['Semana', 7], '30': ['30 d', 30], '90': ['90 d', 90], todo: ['Todo', 0] };
function isoHaceDias(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function diasEntre(isoA, isoB) { return Math.round((parseDate(isoB) - parseDate(isoA)) / 86400000); }
/* Peso de cada grupo: 1 por movimiento que lo tiene de principal, 0,5 de secundario. */
function musculosDeMovs(movs) {
  const pesos = {};
  movs.forEach((m) => {
    (m.mu || []).forEach((id) => { pesos[id] = (pesos[id] || 0) + 1; });
    (m.ms || []).forEach((id) => { pesos[id] = (pesos[id] || 0) + PESO_SEC; });
  });
  return pesos;
}
function musculosDe(w) { return musculosDeMovs(movimientosDe(w)); }
/* Lo que ha trabajado un atleta según sus marcas válidas en el periodo: pesos por grupo,
   veces por movimiento y última fecha en que tocó cada grupo. */
function trabajoDe(a, periodo) {
  const dias = PERIODOS_MUSC[periodo] ? PERIODOS_MUSC[periodo][1] : 0;
  const desde = dias ? isoHaceDias(dias - 1) : '';
  const t = { pesos: {}, veces: {}, ultimo: {}, marcas: 0 };
  if (!a) return t;
  state.results.filter((r) => r.athleteId === a.id && marcaValida(r) && !esRepetida(r) && (!desde || r.date >= desde)).forEach((r) => {
    const w = getWorkout(r.workoutId); if (!w) return;
    const movs = movimientosDe(w); if (!movs.length) return;
    t.marcas++;
    const toca = (id, peso) => { t.pesos[id] = (t.pesos[id] || 0) + peso; if (peso >= 1 && (!t.ultimo[id] || r.date > t.ultimo[id])) t.ultimo[id] = r.date; };   // la fatiga solo mira dónde fue principal
    movs.forEach((m) => {
      t.veces[m.id] = (t.veces[m.id] || 0) + 1;
      (m.mu || []).forEach((id) => toca(id, 1));
      (m.ms || []).forEach((id) => toca(id, PESO_SEC));
    });
  });
  return t;
}
/* De pesos a colores: cuatro verdes según el máximo. */
function coloresCalor(pesos) {
  const max = Math.max(0, ...Object.values(pesos));
  const out = {};
  if (max > 0) Object.keys(pesos).forEach((id) => { if (pesos[id] > 0) out[id] = CALOR[Math.min(3, Math.floor(pesos[id] / max * 3.999))]; });
  return out;
}
/* Colores de fatiga: hoy o ayer, fatigado; hasta tres días, recuperando; después, listo. */
function coloresFatiga(ultimo) {
  const hoy = todayISO(), out = {};
  Object.keys(ultimo).forEach((id) => { const d = diasEntre(ultimo[id], hoy); if (d <= 1) out[id] = FATIGA.fatigado; else if (d <= 3) out[id] = FATIGA.recuperando; });
  return out;
}
/* Dibuja el cuerpo, de frente y de espaldas. colores: {grupo: '#hex'}; lo demás va en gris. */
function cuerpoSvg(colores, opts) {
  opts = opts || {};
  const lado = (partes, vb) => '<svg viewBox="' + vb + '" aria-hidden="true">' + partes.map((p) => {
    const id = MUSC_POR_PARTE[p.m];
    const fill = id && colores[id] ? colores[id] : 'var(--cuerpo-base)';
    const attrs = id ? ' class="musc' + (colores[id] ? ' on' : '') + '" data-musculo="' + id + '"' + (opts.tocable ? ' data-action="musculo" data-id="' + id + '"' : '') : ' class="resto"';
    return p.d.map((d) => '<path d="' + d + '" fill="' + fill + '"' + attrs + '></path>').join('');
  }).join('') + '</svg>';
  return '<div class="cuerpo' + (opts.tocable ? ' tocable' : '') + '">' + lado(CUERPO.front, '44 158 614 1192') + lado(CUERPO.back, '779 156 615 1195') + '</div>';
}
function leyenda(items) { return '<div class="leyenda">' + items.map((x) => '<span><i style="background:' + x[0] + '"></i>' + esc(x[1]) + '</span>').join('') + '</div>'; }
/* La hoja de un músculo: qué lo trabaja, en el entreno o en lo que has hecho. */
function abreMusculo(id) {
  if (!MUSC_NOMBRE[id]) return;
  let movs = [], donde = 'aquí';
  if (state.view === 'wod') { const w = getWorkout(state.params.id); movs = w ? movimientosDe(w) : []; donde = 'en este entreno'; }
  else if (state.view === 'musculos') {
    const t = trabajoDe(me(), state.muscTab === 'fatiga' ? 'todo' : state.muscPeriodo);
    movs = Object.keys(t.veces).map((k) => Object.assign({ veces: t.veces[k] }, movPorId(k))).filter((m) => m.id);
    donde = state.muscTab === 'fatiga' ? 'en tus entrenos' : 'en este periodo';
  }
  const porVeces = (a, b) => (b.veces || 0) - (a.veces || 0);
  const pri = movs.filter((m) => (m.mu || []).indexOf(id) >= 0).sort(porVeces);
  const sec = movs.filter((m) => (m.ms || []).indexOf(id) >= 0).sort(porVeces);
  const fila = (m, tipo) => '<li><b>' + esc(m.nombre) + '</b><span>' + tipo + (m.veces ? ' · ' + m.veces + (m.veces === 1 ? ' vez' : ' veces') : '') + '</span></li>';
  const vistos = {}; pri.concat(sec).forEach((m) => { vistos[m.id] = true; });
  const otros = MOVIMIENTOS.filter((m) => !vistos[m.id] && (m.mu || []).indexOf(id) >= 0).slice(0, 10);
  const body = ((pri.length || sec.length)
    ? '<ul class="musc-movs">' + pri.map((m) => fila(m, 'Principal')).join('') + sec.map((m) => fila(m, 'Secundario')).join('') + '</ul>'
    : '<p class="muted">Nada de lo que hay ' + donde + ' trabaja este músculo.</p>') +
    (otros.length ? '<p class="small muted" style="margin-top:12px">Otros movimientos que lo tienen de principal:</p><ul class="rx-chips">' + otros.map((m) => '<li><span>' + esc(m.nombre) + '</span></li>').join('') + '</ul>' : '');
  openSheet({ title: MUSC_NOMBRE[id], body, foot: '<button class="btn ghost" data-action="close-sheet">Cerrar</button>', focus: false });
}
/* --- TUS MÚSCULOS --- */
function viewMusculos() {
  const m = me();
  if (!m) return '<div class="view"><div class="empty"><span class="h-display h2">¿Quién eres?</span><span>Elige tu atleta para ver qué has trabajado.</span><button class="btn primary" data-action="pick-athlete">Elegir atleta</button></div></div>';
  const tab = state.muscTab === 'fatiga' ? 'fatiga' : 'equilibrio';
  const per = PERIODOS_MUSC[state.muscPeriodo] ? state.muscPeriodo : '30';
  const t = trabajoDe(m, tab === 'fatiga' ? 'todo' : per);
  let html = '<div class="view">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><button class="btn ghost sm" data-action="go" data-view="profile">' + icon('back') + 'Perfil</button><span class="eyebrow">' + t.marcas + ' entreno' + (t.marcas === 1 ? '' : 's') + '</span></div>' +
    '<section class="card"><span class="eyebrow">' + esc(m.name) + '</span><h1 class="h-display h2">Tus músculos</h1>' +
    '<div class="segmented" role="tablist">' + [['equilibrio', 'Equilibrio'], ['fatiga', 'Fatiga']].map((x) => '<button role="tab" data-action="musc-tab" data-tab="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + x[1] + '</button>').join('') + '</div>';
  if (tab === 'equilibrio') {
    const orden = Object.keys(t.pesos).sort((a, b) => t.pesos[b] - t.pesos[a]);
    const max = orden.length ? t.pesos[orden[0]] : 0;
    const sin = MUSCULOS.filter((x) => !t.pesos[x[0]]);
    html += '<div class="segmented sm" style="margin-top:10px">' + ['semana', '30', '90', 'todo'].map((k) => '<button data-action="musc-periodo" data-periodo="' + k + '" aria-pressed="' + (per === k) + '">' + PERIODOS_MUSC[k][0] + '</button>').join('') + '</div>' +
      '<p class="muted small" style="margin-top:10px">Reparto del trabajo entre grupos según los entrenos que has apuntado: cada movimiento suma 1 a sus músculos principales y 0,3 a los que ayudan.</p>' +
      (t.marcas ? '' : '<p class="muted">Sin entrenos apuntados en este periodo.</p>') +
      cuerpoSvg(coloresCalor(t.pesos), { tocable: true }) + leyenda([[CALOR[0], 'Menos'], [CALOR[1], ''], [CALOR[2], ''], [CALOR[3], 'Más']]) +
      (orden.length ? '<p class="faint small">Toca un músculo para ver qué lo ha trabajado.</p><ul class="musc-list">' + orden.map((id) => { const pct = Math.round(t.pesos[id] / max * 100); return '<li data-action="musculo" data-id="' + id + '"><span>' + esc(MUSC_NOMBRE[id]) + '</span><span class="bar"><i style="width:' + pct + '%"></i></span><b>' + pct + ' %</b></li>'; }).join('') + '</ul>' : '') +
      (sin.length && t.marcas ? '<p class="small muted" style="margin-top:12px">Sin trabajar en este periodo</p><ul class="musc-chips">' + sin.map((x) => '<li class="sin" data-action="musculo" data-id="' + x[0] + '">' + esc(x[1]) + '</li>').join('') + '</ul>' : '');
  } else {
    const hoy = todayISO();
    const filas = MUSCULOS.map((x) => ({ id: x[0], nombre: x[1], dias: t.ultimo[x[0]] ? diasEntre(t.ultimo[x[0]], hoy) : null })).sort((a, b) => (a.dias == null ? 1e9 : a.dias) - (b.dias == null ? 1e9 : b.dias));
    html += '<p class="muted small" style="margin-top:10px">Días desde la última marca en que cada músculo fue principal: hoy o ayer, fatigado; hasta tres días, en recuperación; después, listo para otra.</p>' +
      cuerpoSvg(coloresFatiga(t.ultimo), { tocable: true }) + leyenda([[FATIGA.fatigado, 'Fatigado'], [FATIGA.recuperando, 'En recuperación'], ['var(--cuerpo-base)', 'Listo']]) +
      '<ul class="musc-list fatiga">' + filas.map((f) => '<li data-action="musculo" data-id="' + f.id + '"><span>' + esc(f.nombre) + '</span><i style="background:' + (f.dias == null ? 'var(--cuerpo-base)' : f.dias <= 1 ? FATIGA.fatigado : f.dias <= 3 ? FATIGA.recuperando : 'var(--cuerpo-base)') + '"></i><b>' + (f.dias == null ? 'nunca' : f.dias === 0 ? 'hoy' : f.dias === 1 ? 'ayer' : 'hace ' + f.dias + ' días') + '</b></li>').join('') + '</ul>';
  }
  return html + '</section></div>';
}

/* ============================================================
   Entrenos sugeridos: cuánto dura cada entreno, cómo tienes cada
   músculo y qué entrenos encajan con eso y con el tiempo que tienes
   ============================================================ */
/* Segundos por repetición de un atleta medio, con la carga de metcon de referencia. */
const SPR = {
  thruster: 3, 'front-squat': 2.4, 'back-squat': 2.6, 'overhead-squat': 3.6, deadlift: 2, sdhp: 2.3, clean: 3.2, 'power-clean': 2.8, 'squat-clean': 3.2,
  'hang-power-clean': 2.6, 'clean-and-jerk': 4, jerk: 2.6, 'push-jerk': 2.4, 'push-press': 2.4, 'strict-press': 2.6, 'shoulder-to-overhead': 2.4, snatch: 3.6,
  'power-snatch': 3, 'squat-snatch': 3.8, 'hang-power-snatch': 2.8, 'bench-press': 2.4, 'overhead-lunge': 3, 'front-rack-lunge': 2.8, 'hang-squat-clean': 3.2,
  'hang-snatch': 3.4, 'split-jerk': 2.8, 'romanian-deadlift': 2.2, 'good-morning': 2.2, 'barbell-row': 2.2, 'back-rack-lunge': 2.8, cluster: 3.8, 'sumo-deadlift': 2.2,
  'floor-press': 2.4, 'snatch-balance': 3, 'muscle-snatch': 2.8, 'clean-pull': 2.2, 'snatch-pull': 2.2, 'ground-to-overhead': 3.4, 'hip-thrust': 2.2, curl: 2, 'landmine-press': 2.2,
  'kb-swing': 2, 'turkish-get-up': 20, 'db-snatch': 2.4, 'db-thruster': 2.6, 'db-squat-clean': 2.8, 'db-split-clean': 3.5, 'db-deadlift': 2, 'db-lunge': 2.6, 'goblet-squat': 2.4,
  'devil-press': 5, 'db-push-press': 2.2, 'db-clean': 2.4, 'db-clean-and-jerk': 3.4, 'db-bench-press': 2.4, 'kb-clean': 2.4, 'kb-snatch': 2.6, 'around-the-world': 3, halo: 3,
  windmill: 4, 'man-maker': 8, 'renegade-row': 3.2, 'db-row': 2.2, 'db-front-squat': 2.4, 'kb-deadlift': 2, 'kb-press': 2.4, 'kb-front-squat': 2.4, 'kb-thruster': 2.6,
  'wall-ball': 2.8, 'med-ball-clean': 2.8, sandbag: 5, 'ball-slam': 2.2, 'plate-g2oh': 3,
  'pull-up': 2.5, 'strict-pull-up': 3.5, c2b: 3, 'l-pull-up': 4, 'burpee-pull-up': 6, 'muscle-up': 10, 'bar-muscle-up': 7, hspu: 4, 'strict-hspu': 6, 'parallette-hspu': 5,
  t2b: 3, k2e: 2.6, 'ring-dip': 3.5, 'push-up': 2.2, 'hr-push-up': 2.8, pistol: 3, 'double-under': 0.6, 'rope-climb': 30, ghd: 2.6, 'back-extension': 2.2, 'sit-up': 2.2,
  'air-squat': 1.7, burpee: 4.5, 'ring-row': 2.2, 'jumping-pull-up': 2, 'strict-t2b': 3.5, 'strict-muscle-up': 10, 'wall-walk': 12, 'hollow-rock': 1, 'v-up': 2,
  'mountain-climber': 0.7, 'jumping-lunge': 1.6, 'jump-squat': 2, 'tuck-jump': 2.2, 'broad-jump': 3, 'single-under': 0.4, crossover: 1, 'weighted-pull-up': 3, 'chin-up': 2.2,
  'bar-dip': 2.4, pegboard: 40, 'hanging-knee-raise': 2, 'russian-twist': 1.2, 'pike-push-up': 2.4, 'shoulder-tap': 1, superman: 2, 'cossack-squat': 3, 'burpee-broad-jump': 5,
  'up-down': 2.5, 'triple-under': 3, 'forward-roll': 2.5, 'reverse-hyper': 2, 'box-jump': 3, 'box-jump-over': 3.2, 'box-step-up': 3, 'walking-lunge': 2, inchworm: 5, 'jumping-jack': 1,
};
const SPR_CAT = { barra: 3, mancuerna: 2.6, balon: 3, cajon: 3, gimnastico: 2.5, cardio: 4, otros: 2.5 };
/* Segundos por metro en los de distancia, y por caloría en las máquinas. */
const SPM = { run: 0.3, row: 0.26, ski: 0.28, bike: 0.12, swim: 1.8, 'handstand-walk': 2.5, 'walking-lunge': 2.7, 'overhead-lunge': 3, 'front-rack-lunge': 3, 'back-rack-lunge': 3, 'db-lunge': 2.8, 'bear-crawl': 2, 'farmers-carry': 1, 'overhead-carry': 1.2, 'waiters-walk': 1.2, 'front-rack-carry': 1.1, sandbag: 1.3, 'plate-carry': 0.45, 'buddy-carry': 1.5, 'yoke-carry': 1.5, sled: 2, 'broad-jump': 1.5, 'burpee-broad-jump': 2.5 };
const SPC = { row: 4.2, bike: 4.5, ski: 4.5 };
const UNIDAD_M = { m: 1, meter: 1, meters: 1, metre: 1, metres: 1, km: 1000, k: 1000, mile: 1609, miles: 1609, foot: 0.3048, feet: 0.3048, ft: 0.3048, yard: 0.9144, yards: 0.9144 };
const NUM_PAL = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const numeroTexto = (t) => NUM_PAL[t] || Number(String(t).replace(/,/g, ''));
const sprDe = (m) => SPR[m.id] || SPR_CAT[m.cat] || 2.5;
/* Kilos escritos en un texto: "43/30 kg", "(95/65 lb)", "1.5/1 pood", "Rx 60kg". Se queda con el primero (el de ellos). */
function kgDe(t) {
  const x = String(t || '').match(/(\d+(?:\.\d+)?)\s*(?:\/\s*\d+(?:\.\d+)?)?\s*-?\s*(lbs?|pounds?|kg|pood)\b/);
  if (!x) return 0;
  const n = Number(x[1]);
  return x[2] === 'kg' ? n : x[2] === 'pood' ? n * 16 : n * 0.4536;
}
function kgPesoCorporal(t) { const x = String(t || '').match(/(\d+(?:\.\d+)?)?\s*[×x]?\s*bodyweight/); return x ? (Number(x[1]) || 1) * 75 : 0; }
/* La carga de un movimiento según las cargas de un héroe: "53-lb kettlebell, 95-lb barbell, 24-inch box", "225-lb cleans". */
function cargaDeTexto(t, m) {
  if (!t || !m) return 0;
  const partes = String(t).toLowerCase().split(/,|;| and /);
  const nombres = [m.nombre].concat(m.en).map((a) => a.toLowerCase());
  const equipo = /kettlebell|dumbbell|medicine|ball|vest|box|rope|armor|plate|sandbag|rower|bike|target/;
  const tiene = (p) => kgDe(p) || kgPesoCorporal(p);
  let p = partes.find((x) => nombres.some((a) => x.indexOf(a) >= 0) && tiene(x));
  if (!p && m.cat === 'barra') p = partes.find((x) => /barbell/.test(x) && tiene(x)) || partes.find((x) => !equipo.test(x) && tiene(x));
  if (!p && m.cat === 'mancuerna') {
    const kb = /^kb|kettlebell|swing|turkish/.test(m.id + ' ' + m.nombre.toLowerCase());
    p = partes.find((x) => (kb ? /kettlebell/ : /dumbbell/).test(x) && tiene(x)) || partes.find((x) => !equipo.test(x) && tiene(x));
  }
  return p ? tiene(p) : 0;
}
/* Más kilos que los de referencia, más lento; y a partir de 30 repeticiones seguidas se va parando. */
function factorCarga(m, kg) {
  const ref = m.cat === 'barra' ? 43 : m.cat === 'mancuerna' ? 24 : 0;
  if (!(kg > ref) || !ref) return 1;
  return Math.min(5, 1 + (m.cat === 'barra' ? 2 : 1.2) * (kg - ref) / ref);
}
function factorVolumen(reps) { return Math.min(2.2, 1 + Math.max(0, reps - 30) / 150); }
/* Cantidad de una línea: {n, u} con u = 'rep' | 'm' | 'cal' | 's'. */
function cantidadLinea(b) {
  const lead = b.match(/^(\d[\d,]*(?:\.\d+)?)\s*-?\s*([a-z]+)?/);
  if (lead) {
    const u = lead[2] || '';
    if (UNIDAD_M[u]) return { n: numeroTexto(lead[1]) * UNIDAD_M[u], u: 'm' };
    if (/^(calories|calorie|cals?)$/.test(u)) return { n: numeroTexto(lead[1]), u: 'cal' };
    if (/^(seconds?|secs?)$/.test(u)) return { n: numeroTexto(lead[1]), u: 's' };
    if (/^(minutes?|mins?)$/.test(u)) return { n: numeroTexto(lead[1]) * 60, u: 's' };
    return { n: numeroTexto(lead[1]), u: 'rep' };
  }
  let x;
  if ((x = b.match(/(\d[\d,]*(?:\.\d+)?)\s*-?\s*(meters?|metres?|miles?|km|k|feet|foot|ft|yards?|m)\b/))) return { n: numeroTexto(x[1]) * UNIDAD_M[x[2]], u: 'm' };
  if ((x = b.match(/(\d+)\s*-?\s*(calories|calorie|cals?)\b/))) return { n: numeroTexto(x[1]), u: 'cal' };
  if ((x = b.match(/(\d+)\s*-?\s*(seconds?|secs?|minutes?|mins?)\b/))) return { n: numeroTexto(x[1]) * (/min/.test(x[2]) ? 60 : 1), u: 's' };
  return null;
}
const sinGuiones = (t) => String(t || '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
/* El movimiento de una línea: el alias más largo que aparece como palabra entera. */
function movEnLinea(b, cands) {
  const t = ' ' + sinGuiones(b) + ' ';
  let mejor = null, largo = 0;
  cands.forEach((m) => {
    [m.nombre].concat(m.en).forEach((a) => {
      const al = sinGuiones(a);
      if (al.length <= largo) return;
      for (let i = t.indexOf(al); i >= 0; i = t.indexOf(al, i + 1)) {
        if (!/[a-z]/.test(t[i - 1] || ' ') && /^(s|es)?([^a-z]|$)/.test(t.slice(i + al.length))) { mejor = m; largo = al.length; break; }
      }
    });
  });
  return mejor;
}
/* Segundos que lleva un entreno escrito (el de un héroe, una girl o uno nuestro). */
function estimaTexto(desc, cargas) {
  const texto = String(desc || '');
  const bajo = sinGuiones(texto);
  const cands = MOVIMIENTOS.filter((m) => m.mu && m.mu.length && [m.nombre].concat(m.en).some((a) => bajo.indexOf(sinGuiones(a)) >= 0));
  let mult = 1, esquema = 0, seg = 0, cargaNota = 0;
  texto.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
    let b = l.toLowerCase().replace(/[“”"]/g, '').replace(/(\d),(\d{3})\b/g, '$1$2').replace(/(\d),(\d{1,2})\b/g, '$1.$2');
    if (/^rx\b/.test(b)) { cargaNota = kgDe(b) || cargaNota; return; }
    if (/^then\b/.test(b)) { mult = 1; esquema = 0; b = b.replace(/^then\b[,:]?\s*/, ''); if (!b) return; }
    let x;
    if ((x = b.match(/\brest\b\D*(\d+)\s*(minutes?|mins?|seconds?|secs?)/))) { const s = Number(x[1]) * (/min/.test(x[2]) ? 60 : 1); seg += /between/.test(b) ? s * Math.max(0, mult - 1) : s * mult; return; }
    if ((x = b.match(/^(\d+(?:\s*-\s*\d+)+)\b/)) && (/:$/.test(b) || /\b(reps?|for time|of)\b/.test(b))) { esquema = x[1].split('-').reduce((s, n) => s + Number(n), 0); mult = 1; return; }
    if ((x = b.match(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+rounds?\b/)) && (/:$/.test(b) || /rounds?,? (each )?(for time|of)\b/.test(b))) { mult = numeroTexto(x[1]); esquema = 0; return; }
    if (/:$/.test(b)) return;
    if (b.length > 70 || /\b(if|partition|score|wear|wearing|start and finish|as needed)\b|\bsplit (the |all )?(work|reps)\b/.test(b)) return;
    const m = movEnLinea(b, cands); if (!m) return;
    let q = cantidadLinea(b);
    if ((!q || (q.u === 'rep' && !/^\d/.test(b))) && esquema) q = { n: esquema, u: 'rep' };
    if (!q) return;
    let s;
    if (q.u === 'm') s = q.n * (SPM[m.id] || 1.5) * (m.id === 'run' && q.n > 1600 ? 1 + (q.n - 1600) / 8000 : 1);
    else if (q.u === 'cal') s = q.n * (SPC[m.id] || 4.4);
    else if (q.u === 's') s = q.n;
    else s = q.n * sprDe(m) * factorCarga(m, kgDe(b) || kgPesoCorporal(b) || cargaDeTexto(cargas, m) || (m.cat === 'barra' ? cargaNota : 0)) * factorVolumen(q.n);
    seg += (s + clamp(s * 0.25, 1, 8)) * mult;          // más el cambio de un movimiento a otro
  });
  return seg;
}
/* Minutos que dura un entreno: fijo en AMRAP, EMOM y Tabata; si no, la mediana del club y, si nadie
   lo ha hecho, una estimación. null si no se puede saber (fuerza, parejas, "máximas reps"...). */
function estimaMin(w, medianas) {
  if (!w || w.partner || w.scoreType === 'load' || w.type === 'strength') return null;
  if (w.type === 'emom' && w.intervalSec && w.rounds && !w.durationMin) return { min: w.intervalSec * w.rounds / 60, fuente: 'fijo' };
  if (w.type === 'tabata') return { min: ((w.workSec || 20) + (w.restSec == null ? 10 : w.restSec)) * (w.rounds || 8) / 60, fuente: 'fijo' };
  if (w.durationMin) return { min: w.durationMin, fuente: 'fijo' };
  if (medianas && medianas[w.id]) return { min: medianas[w.id] / 60, fuente: 'club' };
  const seg = estimaTexto(w.description, w.loadM);
  if (!(seg > 30)) return null;
  const min = seg / 60;
  return { min: w.timeCapMin ? Math.min(min, w.timeCapMin) : min, fuente: 'estimado' };
}
function medianasClub() {
  const t = {};
  state.results.forEach((r) => { if (r.scoreType === 'time' && r.finished !== false && r.seconds > 0 && !esRepetida(r)) (t[r.workoutId] = t[r.workoutId] || []).push(r.seconds); });
  const out = {};
  Object.keys(t).forEach((id) => { const v = t[id].sort((a, b) => a - b); const k = Math.floor(v.length / 2); out[id] = v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2; });
  return out;
}

/* ---- cómo tienes cada músculo ---- */
let _reparto = null;
/* Reparto típico del trabajo en CrossFit: el de los Héroes y las Girls juntos. */
function repartoTipico() {
  if (_reparto) return _reparto;
  const tot = {}; let suma = 0;
  builtinWorkouts().forEach((w) => { const p = musculosDe(w); Object.keys(p).forEach((g) => { tot[g] = (tot[g] || 0) + p[g]; suma += p[g]; }); });
  _reparto = {};
  MUSCULOS.forEach((x) => { _reparto[x[0]] = suma ? (tot[x[0]] || 0) / suma : 1 / MUSCULOS.length; });
  return _reparto;
}
let _estado = null, _estadoClave = '';
/* Para cada grupo: fatiga (días desde que fue principal), déficit de carga en 30 días frente al
   reparto típico, y un valor de -1 (fatigado) a 1 (fresco y poco trabajado). */
function estadoMuscular(a) {
  const clave = (a ? a.id : '') + '|' + todayISO() + '|' + state.results.length + '|' + state.results.reduce((m, r) => ((r.updatedAt || '') > m ? r.updatedAt : m), '') + '|' + state.workouts.length;
  if (_estado && clave === _estadoClave) return _estado;
  const t30 = trabajoDe(a, '30'), tAll = trabajoDe(a, 'todo');
  const tipico = repartoTipico(), hoy = todayISO();
  const suma30 = Object.values(t30.pesos).reduce((s, x) => s + x, 0);
  const e = { marcas30: t30.marcas, estado: {}, dias: {}, deficit: {}, valor: {} };
  MUSCULOS.forEach((x) => {
    const g = x[0];
    const d = tAll.ultimo[g] ? diasEntre(tAll.ultimo[g], hoy) : null;
    const estado = d == null ? 'listo' : d <= 1 ? 'fatigado' : d <= 3 ? 'recuperando' : 'listo';
    const deficit = suma30 ? clamp(1 - ((t30.pesos[g] || 0) / suma30) / (tipico[g] || 0.01), 0, 1) : 1;
    e.estado[g] = estado; e.dias[g] = d; e.deficit[g] = deficit;
    e.valor[g] = estado === 'fatigado' ? -1 : estado === 'recuperando' ? 0.15 + 0.25 * deficit : 0.55 + 0.45 * deficit;
  });
  _estado = e; _estadoClave = clave;
  return e;
}
/* Lo bien que le viene un entreno a ese estado: de -1 (todo fatigado) a 1 (todo fresco y con falta de trabajo). */
function encaje(movs, est) {
  const p = musculosDeMovs(movs);
  let s = 0, n = 0;
  Object.keys(p).forEach((g) => { s += p[g] * est.valor[g]; n += p[g]; });
  return n ? s / n : 0;
}
/* Grupos que "tocan": frescos, con falta de trabajo y que pintan algo en CrossFit. */
function gruposQueTocan(est) {
  const tip = repartoTipico();
  return MUSCULOS.map((x) => x[0]).filter((g) => est.estado[g] === 'listo' && est.deficit[g] >= 0.35 && tip[g] >= 0.03).sort((a, b) => est.deficit[b] * tip[b] - est.deficit[a] * tip[a]);
}
const listaY = (xs) => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
const nombresMusc = (gs) => listaY(gs.map((g) => MUSC_NOMBRE[g].toLowerCase()));
function porQue(movs, est) {
  const p = musculosDeMovs(movs), prin = {};
  movs.forEach((m) => (m.mu || []).forEach((g) => { prin[g] = true; }));
  const orden = Object.keys(prin).sort((a, b) => p[b] - p[a]);
  const frescos = orden.filter((g) => est.estado[g] === 'listo');
  const cansados = orden.filter((g) => est.estado[g] === 'fatigado');
  const descansan = MUSCULOS.map((x) => x[0]).filter((g) => est.estado[g] === 'fatigado' && !prin[g]);
  let t = frescos.length ? 'Carga ' + nombresMusc(frescos.slice(0, 3)) + (est.marcas30 ? ', que tienes frescos' : '') : 'Trabaja ' + nombresMusc(orden.slice(0, 3));
  if (cansados.length) t += '. Ojo: también ' + nombresMusc(cansados.slice(0, 3)) + ', que están fatigados';
  else if (descansan.length) t += ' y deja descansar ' + nombresMusc(descansan.slice(0, 3));
  return t + '.';
}

/* ---- entrenos a medida ---- */
/* Los movimientos de siempre en un box. mod: M monoestructural, G gimnástico, W con peso. */
const POOL_SUG = [
  { id: 'run', mod: 'M', u: 'm' }, { id: 'row', mod: 'M', u: 'cal' }, { id: 'bike', mod: 'M', u: 'cal' }, { id: 'ski', mod: 'M', u: 'cal' }, { id: 'double-under', mod: 'M' },
  { id: 'pull-up', mod: 'G' }, { id: 'c2b', mod: 'G' }, { id: 't2b', mod: 'G' }, { id: 'hspu', mod: 'G' }, { id: 'push-up', mod: 'G' }, { id: 'hr-push-up', mod: 'G' },
  { id: 'burpee', mod: 'G' }, { id: 'air-squat', mod: 'G' }, { id: 'sit-up', mod: 'G' }, { id: 'ghd', mod: 'G' }, { id: 'v-up', mod: 'G' }, { id: 'k2e', mod: 'G' },
  { id: 'box-jump', mod: 'G', carga: '60/50 cm' }, { id: 'box-jump-over', mod: 'G', carga: '60/50 cm' }, { id: 'walking-lunge', mod: 'G' }, { id: 'pistol', mod: 'G' },
  { id: 'ring-dip', mod: 'G' }, { id: 'wall-walk', mod: 'G' }, { id: 'back-extension', mod: 'G' }, { id: 'rope-climb', mod: 'G' },
  { id: 'muscle-up', mod: 'G', avanzado: true }, { id: 'bar-muscle-up', mod: 'G', avanzado: true },
  { id: 'thruster', mod: 'W', carga: '43/30 kg' }, { id: 'deadlift', mod: 'W', carga: '80/55 kg' }, { id: 'power-clean', mod: 'W', carga: '60/40 kg' },
  { id: 'hang-power-clean', mod: 'W', carga: '60/40 kg' }, { id: 'front-squat', mod: 'W', carga: '60/40 kg' }, { id: 'overhead-squat', mod: 'W', carga: '43/30 kg' },
  { id: 'push-press', mod: 'W', carga: '50/35 kg' }, { id: 'push-jerk', mod: 'W', carga: '60/40 kg' }, { id: 'shoulder-to-overhead', mod: 'W', carga: '50/35 kg' },
  { id: 'power-snatch', mod: 'W', carga: '43/30 kg' }, { id: 'hang-power-snatch', mod: 'W', carga: '43/30 kg' }, { id: 'clean-and-jerk', mod: 'W', carga: '60/40 kg' },
  { id: 'sdhp', mod: 'W', carga: '43/30 kg' }, { id: 'kb-swing', mod: 'W', carga: '24/16 kg' }, { id: 'wall-ball', mod: 'W', carga: '9/6 kg' },
  { id: 'db-snatch', mod: 'W', carga: '22,5/15 kg' }, { id: 'db-thruster', mod: 'W', carga: '2 × 15/10 kg' }, { id: 'devil-press', mod: 'W', carga: '2 × 15/10 kg' },
  { id: 'goblet-squat', mod: 'W', carga: '24/16 kg' }, { id: 'db-lunge', mod: 'W', carga: '2 × 15/10 kg' }, { id: 'db-push-press', mod: 'W', carga: '2 × 15/10 kg' },
  { id: 'db-clean', mod: 'W', carga: '2 × 15/10 kg' }, { id: 'kb-deadlift', mod: 'W', carga: '32/24 kg' }, { id: 'ball-slam', mod: 'W', carga: '9/6 kg' },
];
const TOPE_REPS = { 'muscle-up': 7, 'bar-muscle-up': 10, 'rope-climb': 4, 'wall-walk': 5, hspu: 15, pistol: 20, 'devil-press': 12, 'clean-and-jerk': 12, deadlift: 15, 'power-clean': 15, 'hang-power-clean': 15, 'front-squat': 15, 'push-jerk': 15, 'power-snatch': 15, 'hang-power-snatch': 15, 'overhead-squat': 15, thruster: 21, 'push-press': 15, 'shoulder-to-overhead': 15, sdhp: 20, 'ring-dip': 20, 'double-under': 100, 'air-squat': 50, 'sit-up': 40, 'push-up': 30, 'hr-push-up': 25, burpee: 20, 'box-jump-over': 20, 'box-jump': 24, 'db-lunge': 24, 'kb-deadlift': 25 };
const MIN_REPS = { 'muscle-up': 2, 'bar-muscle-up': 3, 'rope-climb': 1, 'wall-walk': 2 };
const REPS_BONITAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 30, 35, 40, 45, 50, 60, 75, 100];
const METROS_BONITOS = [100, 200, 300, 400, 500, 600, 800, 1000];
const CAL_BONITAS = [5, 6, 8, 10, 12, 14, 15, 18, 20, 25, 30];
const bonito = (n, lista) => lista.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
function cantidadPara(p, seg) {
  const m = movPorId(p.id);
  if (p.u === 'm') return String(bonito(seg / (SPM[p.id] || 0.3), METROS_BONITOS));
  if (p.u === 'cal') return bonito(seg / (SPC[p.id] || 4.4), CAL_BONITAS) + ' cal';
  let n = clamp(bonito(seg / (sprDe(m) * factorCarga(m, kgDe(p.carga || ''))), REPS_BONITAS), MIN_REPS[p.id] || 3, TOPE_REPS[p.id] || 30);
  if (/lunge/.test(p.id) && n % 2) n++;
  return String(n);
}
/* Generador reproducible: la misma semilla da las mismas propuestas. */
function azar(semilla) {
  let a = 0;
  String(semilla).split('').forEach((c) => { a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0; });
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const parecidos = (a, b) => a.mu.filter((g) => b.mu.indexOf(g) >= 0).length / Math.min(a.mu.length, b.mu.length) > 0.7;
/* Elige n movimientos para los músculos que más lo piden, sin repetir patrón y mezclando modalidades. */
function eligeMovs(est, n, rnd, opc) {
  const rx = opc.rx || {};
  const pool = POOL_SUG.filter((p) => {
    const m = movPorId(p.id), e = (rx[p.id] || {}).estado;
    if (!m || e === 'no' || (p.avanzado && e !== 'rx')) return false;
    if (opc.sinDistancia && p.u === 'm') return false;
    if (opc.sinMaquinas && (p.u === 'm' || p.u === 'cal')) return false;
    return true;
  });
  const libres = pool.filter((p) => !(opc.usados && opc.usados[p.id]));
  const lista = libres.length >= n + 3 ? libres : pool;          // no repetir entre propuestas mientras haya dónde elegir
  const elegidos = [], cubierto = {};
  while (elegidos.length < n) {
    let mejor = null, mejorS = -Infinity;
    lista.forEach((p) => {
      if (elegidos.indexOf(p) >= 0) return;
      const m = movPorId(p.id);
      if (p.mod === 'M' && elegidos.some((e) => e.mod === 'M')) return;
      if (elegidos.some((e) => parecidos(movPorId(e.id), m))) return;
      let s = 0;
      m.mu.forEach((g) => { const v = est.valor[g]; s += v > 0 && cubierto[g] ? v * 0.35 : v; });
      s /= m.mu.length;
      s -= 0.8 * m.mu.filter((g) => est.estado[g] === 'fatigado').length;     // fatigado como principal: casi fuera
      m.ms.forEach((g) => { if (est.valor[g] < 0) s += est.valor[g] * PESO_SEC / m.mu.length; });
      if ((rx[p.id] || {}).estado === 'escalado') s -= 0.15;
      if (opc.usados && opc.usados[p.id]) s -= 0.35;
      if (elegidos.length && !elegidos.some((e) => e.mod === p.mod)) s += 0.1;
      s += (rnd() - 0.5) * 0.3;
      if (s > mejorS) { mejorS = s; mejor = p; }
    });
    if (!mejor) break;
    elegidos.push(mejor);
    movPorId(mejor.id).mu.forEach((g) => { cubierto[g] = true; });
  }
  return elegidos;
}
const bloqueDe = (p, cant) => Object.assign({ cant, mov: p.id }, p.carga ? { carga: p.carga } : {});
function montaAmrap(D, ps) {
  const Tr = clamp(30 + 7 * D, 60, 210);
  const pes = ps.map((p) => (p.mod === 'M' ? 1.3 : 1)), suma = pes.reduce((s, x) => s + x, 0);
  return { etiqueta: 'AMRAP ' + D + ' min', type: 'amrap', scoreType: 'rounds', durationMin: D, esquema: '', notas: '', min: D,
    bloques: ps.map((p, i) => bloqueDe(p, cantidadPara(p, (Tr - 5 * ps.length) * pes[i] / suma))) };
}
function montaForTime(D, ps) {
  const cap = D + Math.max(2, Math.round(D * 0.25));
  const base = { type: 'fortime', scoreType: 'time', timeCapMin: cap, notas: '' };
  const est = (w) => estimaTexto(generaDescripcion(w)) / 60;
  if (D <= 9 && ps.every((p) => !p.u)) {                      // corto: esquema de reps, al estilo de Fran
    let mejor = null;
    ['9-6-3', '12-9-6', '15-12-9', '21-15-9', '27-21-15-9', '30-20-10', '50-40-30-20-10'].forEach((e) => {
      const total = e.split('-').reduce((s, n) => s + Number(n), 0);
      if (ps.some((p) => total > (TOPE_REPS[p.id] || 30) * 3)) return;
      const w = Object.assign({}, base, { esquema: e, bloques: ps.map((p) => bloqueDe(p, '')) });
      const min = est(w);
      if (!mejor || Math.abs(min - D) < Math.abs(mejor.min - D)) mejor = Object.assign(w, { min, etiqueta: e + ' for time' });
    });
    if (mejor) return mejor;
  }
  const R = D <= 9 ? 2 : D <= 14 ? 3 : D <= 20 ? 4 : 5;
  const Tr = D * 60 / R;
  const pes = ps.map((p) => (p.mod === 'M' ? 1.3 : 1)), suma = pes.reduce((s, x) => s + x, 0);
  const w = Object.assign({}, base, { esquema: String(R), bloques: ps.map((p, i) => bloqueDe(p, cantidadPara(p, (Tr - 5 * ps.length) * pes[i] / suma))) });
  return Object.assign(w, { min: est(w), etiqueta: R + ' rondas for time' });
}
function montaEmom(D, ps) {
  return { etiqueta: 'EMOM ' + D + ' min', type: 'emom', scoreType: 'reps', intervalSec: 60, rounds: D, esquema: '', min: D,
    notas: 'Cada minuto, un movimiento: en este orden y vuelta a empezar.', bloques: ps.map((p) => bloqueDe(p, cantidadPara(p, p.mod === 'M' ? 40 : 36))) };
}
/* Tres propuestas a medida (AMRAP, for time y EMOM), cada una con movimientos distintos. */
function sugerenciasAMedida(a, est, D, semilla) {
  const rx = misRx(a), usados = {}, out = [];
  const formatos = [
    ['amrap', D <= 6 ? 2 : D >= 20 ? 4 : 3, {}, montaAmrap],
    ['fortime', D <= 9 ? 2 : 3, D <= 9 ? { sinMaquinas: true } : {}, montaForTime],
  ];
  if (D >= 6) formatos.push(['emom', D >= 12 ? 3 : 2, { sinDistancia: true }, montaEmom]);
  formatos.forEach((f) => {
    const ps = eligeMovs(est, f[1], azar(semilla + '|' + f[0]), Object.assign({ rx, usados }, f[2]));
    if (!ps.length) return;
    ps.forEach((p) => { usados[p.id] = true; });
    const b = f[3](D, ps);
    b.name = 'Sugerido · ' + b.etiqueta;
    b.modo = 'bloques';
    b.description = generaDescripcion(b);
    b.movs = ps.map((p) => movPorId(p.id));
    out.push(b);
  });
  return out;
}

/* ---- del catálogo ---- */
let _baseCat = null, _baseCatClave = '';
function baseCatalogo() {
  const clave = state.results.length + '|' + state.results.reduce((m, r) => ((r.updatedAt || '') > m ? r.updatedAt : m), '') + '|' + state.workouts.map((w) => w.id + (w.updatedAt || '')).join(',');
  if (_baseCat && clave === _baseCatClave) return _baseCat;
  const medianas = medianasClub();
  _baseCat = allWorkouts().map((w) => {
    const movs = movimientosDe(w);
    const e = movs.length ? estimaMin(w, medianas) : null;
    return e ? { w, movs, min: e.min, fuente: e.fuente } : null;
  }).filter(Boolean);
  _baseCatClave = clave;
  return _baseCat;
}
/* Los que duran más o menos D minutos, ordenados por lo bien que encajan con tu estado.
   Lo que has hecho esta semana no sale; los que piden algo que tienes como "Aún no" bajan. */
function sugerenciasCatalogo(a, est, D, pagina) {
  const recientes = {};
  state.results.forEach((r) => { if (a && r.athleteId === a.id && r.date >= isoHaceDias(6)) recientes[r.workoutId] = true; });
  const rx = misRx(a), tol = Math.max(2.5, D * 0.35);
  const lista = [];
  baseCatalogo().forEach((b) => {
    if (recientes[b.w.id]) return;
    const fit = 1 - Math.abs(b.min - D) / tol;
    if (fit <= 0) return;
    const noPuede = b.movs.filter((m) => (rx[m.id] || {}).estado === 'no');
    const s = encaje(b.movs, est);
    const cargaFatigado = b.movs.some((m) => (m.mu || []).some((g) => est.estado[g] === 'fatigado'));
    lista.push(Object.assign({ s, fit, noPuede, val: s + 0.3 * fit + (b.w.category !== 'custom' ? 0.05 : 0) - 0.3 * noPuede.length - (cargaFatigado ? 0.4 : 0) }, b));
  });
  lista.sort((x, y) => y.val - x.val);
  const paginas = Math.max(1, Math.ceil(Math.min(lista.length, 18) / 6));
  const k = (pagina || 0) % paginas;
  return { total: lista.length, items: lista.slice(k * 6, k * 6 + 6) };
}

/* ---- la pantalla ---- */
function leeSugDur() { try { const v = Number(localStorage.getItem(LS_PREFIX + 'sugdur')); return v >= 5 && v <= 25 ? Math.round(v) : 15; } catch (e) { return 15; } }
function coloresSug(est) {
  const out = {}, toca = gruposQueTocan(est).slice(0, 5);
  MUSCULOS.forEach((x) => {
    const g = x[0];
    if (est.estado[g] === 'fatigado') out[g] = FATIGA.fatigado;
    else if (est.estado[g] === 'recuperando') out[g] = FATIGA.recuperando;
    else if (toca.indexOf(g) >= 0) out[g] = CALOR[3];
  });
  return out;
}
function descHtml(t) { return String(t || '').split('\n').map((l, i) => (i === 0 && /:$/.test(l.trim())) ? '<span class="head">' + esc(l) + '</span>' : esc(l)).join('\n'); }
/* Los grupos que carga un entreno, de más a menos, con el color de cómo los tienes. */
function chipsSug(movs, est) {
  const p = musculosDeMovs(movs), prin = [];
  movs.forEach((m) => (m.mu || []).forEach((g) => { if (prin.indexOf(g) < 0) prin.push(g); }));
  prin.sort((x, y) => p[y] - p[x]);
  return '<span class="sug-chips">' + prin.slice(0, 6).map((g) => '<span class="' + est.estado[g] + '" data-musculo="' + g + '">' + esc(MUSC_NOMBRE[g]) + '</span>').join('') + '</span>';
}
let _sugGeneradas = [], _sugPendiente = false;
function sugListaHtml(a, est) {
  const D = state.sugDur, pag = state.sugSeed || 0;
  const gen = sugerenciasAMedida(a, est, D, todayISO() + '|' + a.id + '|' + pag);
  const cat = sugerenciasCatalogo(a, est, D, pag);
  _sugGeneradas = gen;
  let html = '<section class="sug-sec"><div class="section-head"><h2 class="h-display h2">A tu medida</h2><button class="link" data-action="sug-otras">Otras ideas</button></div>' +
    '<p class="faint small">Montados para ti con movimientos de siempre, para unos ' + D + ' minutos y apuntando a lo que tienes fresco.</p>' +
    gen.map((g, i) => '<article class="card sug-card" data-formato="' + g.type + '" data-min="' + Math.round(g.min) + '" data-movs="' + esc(g.movs.map((m) => m.id).join(',')) + '">' +
      '<div class="meta-line">' + badge('type', TYPE_LABEL[g.type]) + badge('type', (g.type === 'fortime' ? '≈ ' : '') + Math.round(g.min) + ' min') + (g.timeCapMin ? badge('type', 'cap ' + g.timeCapMin + '’') : '') + '</div>' +
      '<div class="wod-desc">' + descHtml(g.description) + '</div>' + chipsSug(g.movs, est) +
      '<p class="small muted">' + esc(porQue(g.movs, est)) + '</p>' +
      '<div class="btn-row"><button class="btn primary sm" data-action="sug-usar" data-i="' + i + '">Usar este entreno</button></div></article>').join('') +
    '</section>';
  html += '<section class="sug-sec"><div class="section-head"><h2 class="h-display h2">Del catálogo</h2><span class="eyebrow">≈ ' + D + ' min</span></div>' +
    '<p class="faint small">Héroes, Girls y los vuestros que duran más o menos eso y le vienen bien a cómo estás. Lo que has hecho esta semana no sale.</p>';
  if (cat.items.length) {
    html += '<ul class="list sug-cat">' + cat.items.map((c) => {
      const w = c.w, cls = w.category === 'hero' ? 'hero' : w.category === 'girl' ? 'girl' : 'custom';
      return '<li data-id="' + esc(w.id) + '" data-min="' + c.min.toFixed(1) + '"><button class="row pressable" data-action="open-wod" data-id="' + esc(w.id) + '" aria-label="' + esc(w.name) + '">' +
        '<span class="badge ' + cls + '" style="min-width:52px;justify-content:center">' + (cls === 'hero' ? 'Hero' : cls === 'girl' ? 'Girl' : 'WOD') + '</span>' +
        '<span><span class="title">' + esc(w.name) + '</span><span class="sub">≈ ' + Math.round(c.min) + ' min' + (c.fuente === 'club' ? ' (lo que tarda el club)' : c.fuente === 'estimado' ? ' (estimado)' : '') + ' · ' + esc(TYPE_LABEL[w.type] || w.type) + ' — ' + esc(firstLine(w)) + '</span>' +
        chipsSug(c.movs, est) + '<span class="sub por-que">' + esc(porQue(c.movs, est)) + (c.noPuede.length ? ' Pide ' + esc(listaY(c.noPuede.map((m) => m.nombre))) + ', que tienes como «Aún no».' : '') + '</span></span>' +
        '<span class="chev">' + icon('chev') + '</span></button></li>';
    }).join('') + '</ul>';
  } else {
    html += '<p class="muted">Nada del catálogo dura unos ' + D + ' min y encaja con cómo estás. Prueba con otra duración.</p>';
  }
  return html + '</section>';
}
function refrescaSug() {
  const l = $('#sug-lista'), a = me();
  if (l && a) l.innerHTML = sugListaHtml(a, estadoMuscular(a));
}
/* ============================================================
   Versión nueva publicada
   GitHub Pages deja la página 10 minutos en caché (y el móvil a veces más). Al abrir la app y al
   volver a ella se mira version.json: si hay otra versión, se recarga sola si no estás a medias
   (con una hoja abierta, el crono en marcha, escribiendo o subiendo); si lo estás, se avisa.
   ============================================================ */
let _ultimaComprobacion = 0;
function esMasNueva(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}
function sePuedeRecargar() {
  const ae = document.activeElement;
  return !$('#sheet-root').firstChild && (timer.status === 'idle' || timer.status === 'done') &&
    !(state.store && state.store.status && state.store.status().busy) && !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName));
}
async function buscaVersionNueva(forzar) {
  if (!/^https?:$/.test(location.protocol)) return;
  const ahora = Date.now();
  if (!forzar && ahora - _ultimaComprobacion < 60000) return;
  _ultimaComprobacion = ahora;
  let v = '';
  try {
    const r = await fetch('version.json?t=' + ahora, { cache: 'no-store' });
    if (!r.ok) return;
    v = String((await r.json()).version || '');
  } catch (e) { return; }
  if (!esMasNueva(v, APP_VERSION)) { if (state.versionNueva) { state.versionNueva = ''; render(); } return; }
  state.versionNueva = v;
  if (sePuedeRecargar()) actualizaApp(); else render();
}
/* Primero una recarga normal; si el móvil insiste en la copia vieja, se pide la página con otra
   dirección. Como mucho dos intentos por versión y sesión: nunca en bucle. */
function actualizaApp() {
  const v = state.versionNueva; if (!v) return;
  let n = 0;
  try { const g = JSON.parse(sessionStorage.getItem(LS_PREFIX + 'actualizando') || '{}'); n = g.v === v ? g.n || 0 : 0; } catch (e) { }
  if (n >= 2) { render(); return; }                            // ya se intentó: se queda el aviso con su botón
  try { sessionStorage.setItem(LS_PREFIX + 'actualizando', JSON.stringify({ v, n: n + 1 })); } catch (e) { }
  if (n === 0) location.reload();
  else location.replace(location.pathname + '?v=' + encodeURIComponent(v));
}
function avisoVersion() {
  if (!state.versionNueva) return '';
  return '<div class="banner live aviso-version"><span class="dot"></span><span>Hay una versión nueva de la app (' + esc(state.versionNueva) + ').</span><button class="btn sm" data-action="actualizar-app">Actualizar</button></div>';
}

/* --- ENTRENOS SUGERIDOS --- */
function viewSugeridos() {
  const a = me();
  if (!a) return '<div class="view"><div class="empty"><span class="h-display h2">¿Quién eres?</span><span>Elige tu atleta para ver qué te toca entrenar.</span><button class="btn primary" data-action="pick-athlete">Elegir atleta</button></div></div>';
  const est = estadoMuscular(a), D = state.sugDur;
  const grupos = MUSCULOS.map((x) => x[0]);
  const toca = gruposQueTocan(est).slice(0, 4);
  const cansados = grupos.filter((g) => est.estado[g] === 'fatigado');
  const recu = grupos.filter((g) => est.estado[g] === 'recuperando');
  const tip = repartoTipico();
  const muyCansado = grupos.filter((g) => tip[g] >= 0.05 && est.estado[g] === 'fatigado').length >= 5;
  let html = '<div class="view">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><button class="btn ghost sm" data-action="go" data-view="profile">' + icon('back') + 'Perfil</button><span class="eyebrow">' + est.marcas30 + ' entreno' + (est.marcas30 === 1 ? '' : 's') + ' en 30 días</span></div>' +
    '<section class="card"><span class="eyebrow">' + esc(a.name) + '</span><h1 class="h-display h2">Entrenos sugeridos</h1>' +
    '<p class="muted small">Según lo que has apuntado: lo que tienes fatigado descansa, y lo que menos has trabajado en 30 días (comparado con el reparto de los Héroes y las Girls) pasa delante.</p>' +
    '<div class="sug-dur"><div class="sug-dur-cab"><label for="sug-dur" class="label">¿Cuánto tiempo tienes?</label><output id="sug-dur-val" for="sug-dur">' + D + ' min</output></div>' +
    '<input type="range" id="sug-dur" min="5" max="25" step="1" value="' + D + '" aria-label="Duración del entreno en minutos">' +
    '<div class="sug-marcas" aria-hidden="true"><span>5’</span><span>10’</span><span>15’</span><span>20’</span><span>25’</span></div></div>' +
    cuerpoSvg(coloresSug(est)) + leyenda([[FATIGA.fatigado, 'Fatigado'], [FATIGA.recuperando, 'Recuperando'], [CALOR[3], 'Toca'], ['var(--cuerpo-base)', 'Listo']]);
  if (est.marcas30 || cansados.length || recu.length) {
    html += '<div class="sug-estado">' +
      (toca.length ? '<p class="small"><b>Toca:</b> ' + esc(listaY(toca.map((g) => MUSC_NOMBRE[g]))) + '</p>' : '') +
      (cansados.length ? '<p class="small"><b>Descansan:</b> ' + esc(listaY(cansados.map((g) => MUSC_NOMBRE[g]))) + '</p>' : '') +
      (recu.length ? '<p class="small"><b>Recuperando:</b> ' + esc(listaY(recu.map((g) => MUSC_NOMBRE[g]))) + '</p>' : '') + '</div>';
  } else {
    html += '<p class="muted small">No has apuntado nada en 30 días: todo está fresco. En cuanto apuntes, las sugerencias se ajustan a tu carga y a tu fatiga.</p>';
  }
  if (muyCansado) html += '<div class="banner"><span class="dot"></span><span>Tienes medio cuerpo fatigado: hoy mejor algo suave, o descansar.</span></div>';
  html += '</section><div id="sug-lista">' + sugListaHtml(a, est) + '</div></div>';
  return html;
}

/* ============================================================
   Entrenos por bloques: reps + movimiento de la lista + carga
   ============================================================ */
const ESQUEMA_RE = /^\d+(\s*[-x×]\s*\d+)*$/;
const PLURAL_ESP = { c2b: 'Chest-to-bar pull-ups' };
const SIN_PLURAL = { k2e: 1, 'handstand-walk': 1, chaleco: 1, sandbag: 1, sled: 1, 'plate-carry': 1, 'farmers-carry': 1, 'waiters-walk': 1, 'overhead-carry': 1, 'bear-crawl': 1, 'buddy-carry': 1, plank: 1, 'l-sit': 1, 'handstand-hold': 1, 'yoke-carry': 1, 'front-rack-carry': 1 };
const normaliza = (t) => String(t || '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
/* Busca según se escribe: primero los que empiezan así, luego los que lo contienen. */
function buscaMovimientos(q) {
  const t = normaliza(q);
  if (!t) return MOVIMIENTOS.slice();
  const empieza = [], contiene = [];
  MOVIMIENTOS.forEach((m) => {
    const nombres = [m.nombre].concat(m.en).map(normaliza);
    if (nombres.some((n) => n.indexOf(t) === 0)) empieza.push(m);
    else if (nombres.some((n) => n.indexOf(t) >= 0)) contiene.push(m);
  });
  return empieza.concat(contiene);
}
/* Escrito entero ("pull-up", "Thrusters") se enlaza solo con el de la lista. */
function movPorNombre(texto) {
  const t = normaliza(texto);
  if (!t) return null;
  return MOVIMIENTOS.find((m) => normaliza(m.nombre) === t || m.en.some((a) => normaliza(a) === t)) || null;
}
function plural(m, cant) {
  const n = parseInt(String(cant || '').trim(), 10);
  if (n === 1 || m.tipo === 'nota' || SIN_PLURAL[m.id]) return m.nombre;
  if (PLURAL_ESP[m.id]) return PLURAL_ESP[m.id];
  const s = m.nombre;
  if (/[^aeiou]y$/i.test(s)) return s.slice(0, -1) + 'ies';
  if (/(s|x|ch|sh)$/i.test(s)) return s + 'es';
  return s + 's';
}
/* "400" con un movimiento de cardio son metros (calorías en la bici). */
function cantidadBloque(b) {
  const c = String(b.cant || '').trim();
  const m = movPorId(b.mov);
  if (m && m.cat === 'cardio' && /^\d+([.,]\d+)?$/.test(c)) return c + (m.id === 'bike' ? ' cal' : ' m');
  return c;
}
function lineaBloque(b) {
  const m = movPorId(b.mov);
  return [cantidadBloque(b), m ? plural(m, b.cant) : String(b.nombre || '').trim(), String(b.carga || '').trim()].filter(Boolean).join(' ');
}
function numerosEsquema(esq) {
  const t = String(esq || '').trim();
  return ESQUEMA_RE.test(t) ? t.split(/\s*[-x×]\s*/).map(Number).filter((n) => n > 0) : [];
}
function llevaEsquema(type) { return type === 'fortime' || type === 'interval' || type === 'strength' || type === 'other'; }
/* La primera línea, al estilo de los héroes: "21-15-9 reps for time of:", "5 rounds for time of:", "AMRAP 12 min:". */
function cabeceraEntreno(w) {
  const esq = String(w.esquema || '').trim();
  const nums = llevaEsquema(w.type) ? numerosEsquema(esq) : [];
  const serie = nums.length > 1 ? nums.join('-') : '';
  const rondas = nums.length === 1 ? nums[0] : 0;
  switch (w.type) {
    case 'amrap': return 'AMRAP ' + (w.durationMin || 0) + ' min:';
    case 'emom': return (w.intervalSec || 60) === 60 ? 'EMOM ' + (w.rounds || 0) + ' min:' : 'Every ' + (w.intervalSec || 60) + ' s × ' + (w.rounds || 0) + ':';
    case 'tabata': return 'Tabata ' + (w.workSec || 20) + '/' + (w.restSec || 0) + ' × ' + (w.rounds || 8) + ':';
    case 'fortime': return serie ? serie + ' reps for time of:' : rondas > 1 ? rondas + ' rounds for time of:' : 'For time:';
    case 'interval': return serie ? serie + ' reps, in intervals of:' : (rondas > 1 ? rondas + ' intervals' : 'Intervals') + ' of:';
    case 'strength': return esq ? esq + ':' : 'Strength:';
    default: return serie ? serie + ' reps of:' : rondas > 1 ? rondas + ' rounds of:' : '';
  }
}
function generaDescripcion(w) {
  const lineas = (w.bloques || []).map(lineaBloque).filter(Boolean);
  const cab = cabeceraEntreno(w);
  const notas = String(w.notas || '').trim();
  return (cab ? [cab] : []).concat(lineas).concat(notas ? ['', notas] : []).join('\n');
}
/* Un entreno escrito a mano se convierte en filas, en lo que se pueda: "30 Push Ups" → 30 × Push-up. */
function parseaTexto(desc) {
  const filas = [], notas = [];
  String(desc || '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
    if (/:$/.test(l)) return;
    if (/^rx\b/i.test(l)) { notas.push(l); return; }
    const m = l.match(/^(\d+(?:[.,]\d+)?(?:\s*(?:m|km|cal|s|min|reps?))?)\s+(.+)$/i);
    const cant = m ? m[1] : '';
    const resto = (m ? m[2] : l).trim();
    const bajo = normaliza(resto);
    let mejor = null, largo = 0;
    MOVIMIENTOS.forEach((mv) => {
      [mv.nombre].concat(mv.en).forEach((a) => {
        const al = normaliza(a);
        if (al.length > largo && bajo.indexOf(al) === 0 && (bajo.length === al.length || bajo[al.length] === ' ')) { mejor = mv; largo = al.length; }
      });
    });
    filas.push(mejor ? { cant, mov: mejor.id, carga: bajo.slice(largo).trim() } : { cant, nombre: resto });
  });
  return { filas, notas: notas.join(' · ') };
}
function filaMovHtml(b) {
  b = b || {};
  const m = movPorId(b.mov);
  const cardio = !!(m && m.cat === 'cardio');
  return '<div class="mv-item"><div class="mv-row">' +
    '<input class="cant" type="text" inputmode="' + (cardio ? 'text' : 'numeric') + '" placeholder="' + (cardio ? '400 m' : 'reps') + '" value="' + esc(b.cant || '') + '" maxlength="12" autocomplete="off" aria-label="Cantidad">' +
    '<input class="mv-q" type="text" placeholder="Movimiento" value="' + esc(m ? m.nombre : (b.nombre || '')) + '" data-mov="' + esc(m ? m.id : '') + '" maxlength="40" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Movimiento">' +
    '<input class="carga" type="text" placeholder="kg" value="' + esc(b.carga || '') + '" maxlength="16" autocomplete="off" aria-label="Carga">' +
    '<button type="button" class="icon-btn" data-action="w-row-del" aria-label="Quitar movimiento">' + icon('x') + '</button>' +
    '</div><div class="mv-list" hidden></div></div>';
}
function opcionMovHtml(m) {
  const c = CATS_MOV.find((x) => x[0] === m.cat);
  return '<button type="button" class="mv-opt" data-action="mv-pick" data-mov="' + esc(m.id) + '" data-nombre="' + esc(m.nombre) + '">' + esc(m.nombre) + '<span class="cat">' + esc(c ? c[1] : '') + '</span></button>';
}
function listaMovHtml(q) {
  const t = String(q || '').trim();
  const res = buscaMovimientos(t);
  if (!t) return CATS_MOV.map((c) => { const l = res.filter((m) => m.cat === c[0]); return l.length ? '<div class="mv-group">' + esc(c[1]) + '</div>' + l.map(opcionMovHtml).join('') : ''; }).join('');
  let html = res.length ? res.slice(0, 40).map(opcionMovHtml).join('') : '<div class="mv-group">Nada parecido en la lista</div>';
  if (!movPorNombre(t)) html += '<button type="button" class="mv-opt libre" data-action="mv-pick" data-mov="" data-nombre="' + esc(t) + '">Usar «' + esc(t) + '» tal cual<span class="cat">no está en la lista</span></button>';
  return html;
}
function abreListaMov(input) {
  const item = input.closest('.mv-item'); if (!item) return;
  cierraListasMov(item);
  const list = $('.mv-list', item);
  list.innerHTML = listaMovHtml(input.value);
  list.hidden = false; item.classList.add('abierta');
}
function cierraListasMov(salvo) {
  $$('.mv-item.abierta').forEach((it) => {
    if (it === salvo) return;
    it.classList.remove('abierta'); const l = $('.mv-list', it); if (l) { l.hidden = true; l.innerHTML = ''; }
  });
}
function eligeMov(item, id, nombre) {
  const q = $('.mv-q', item), cant = $('.cant', item);
  const m = movPorId(id);
  q.value = m ? m.nombre : String(nombre || '').trim(); q.dataset.mov = m ? m.id : '';
  const cardio = !!(m && m.cat === 'cardio');
  cant.inputMode = cardio ? 'text' : 'numeric'; cant.placeholder = cardio ? '400 m' : 'reps';
  cierraListasMov(); q.blur();
  pintaPreviewEntreno();
}
function esquemaChips(type) {
  const chips = type === 'strength' ? [['5x5', '5x5'], ['5x3', '5x3'], ['3x3', '3x3'], ['10x1', '10x1']] : [['1 ronda', ''], ['3', '3'], ['5', '5'], ['21-15-9', '21-15-9'], ['15-12-9', '15-12-9'], ['10→1', '10-9-8-7-6-5-4-3-2-1']];
  return chips.map((c) => '<button type="button" class="chip sm" data-action="w-esq-chip" data-v="' + esc(c[1]) + '">' + esc(c[0]) + '</button>').join('');
}
function esquemaHtml(w) {
  return '<div class="field" id="w-esq-field"' + (llevaEsquema(w.type) ? '' : ' hidden') + '><label for="w-esq">Rondas o esquema de reps</label>' +
    '<input type="text" id="w-esq" value="' + esc(w.esquema || '') + '" placeholder="5 (rondas) · 21-15-9 · 5x5" maxlength="40" autocomplete="off">' +
    '<div class="chips" id="w-esq-chips">' + esquemaChips(w.type) + '</div></div>';
}
/* Lee el formulario tal cual está (sirve para la vista previa y para guardar). */
function leerFormEntreno() {
  const num = (id, def) => { const el = $(id); const v = el ? Number(el.value) : NaN; return isNaN(v) ? def : v; };
  const type = $('#w-type').value;
  const build = $('#w-build');
  const bloques = $$('#w-rows .mv-item').map((it) => {
    const q = $('.mv-q', it); const nombre = q.value.trim();
    const m = movPorId(q.dataset.mov) || movPorNombre(nombre);
    const b = {};
    const cant = $('.cant', it).value.trim(), carga = $('.carga', it).value.trim();
    if (cant) b.cant = cant;
    if (m) b.mov = m.id; else if (nombre) b.nombre = nombre;
    if (carga) b.carga = carga;
    return b;
  }).filter((b) => b.mov || b.nombre);
  return {
    type, scoreType: $('#w-score').value, modo: build && !build.hidden ? 'bloques' : 'texto',
    durationMin: type === 'amrap' ? clamp(num('#w-dur', 12), 1, 120) : 0,
    timeCapMin: (type === 'fortime' || type === 'interval') ? clamp(num('#w-cap', 0), 0, 180) : 0,
    intervalSec: type === 'emom' ? clamp(num('#w-int', 60), 10, 600) : 0,
    rounds: type === 'emom' ? clamp(num('#w-rounds', 10), 1, 60) : type === 'tabata' ? clamp(num('#w-rounds', 8), 1, 30) : 0,
    workSec: type === 'tabata' ? clamp(num('#w-work', 20), 5, 300) : 0,
    restSec: type === 'tabata' ? clamp(num('#w-rest', 10), 0, 300) : 0,
    esquema: llevaEsquema(type) && $('#w-esq') ? $('#w-esq').value.trim() : '',
    bloques, notas: $('#w-notas') ? $('#w-notas').value.trim() : '',
    texto: $('#w-desc') ? $('#w-desc').value.trim() : '',
  };
}
function pintaPreviewEntreno() {
  const p = $('#w-preview'); if (!p || !$('#w-type')) return;
  const texto = generaDescripcion(leerFormEntreno());
  p.innerHTML = texto ? texto.split('\n').map((l, i) => (i === 0 && /:$/.test(l.trim())) ? '<span class="head">' + esc(l) + '</span>' : esc(l)).join('\n') : '<span class="faint">Añade movimientos y aquí verás cómo queda.</span>';
}
function openWorkoutForm(existing, presetDate, borrador) {
  const w = existing || Object.assign({ name: '', type: 'fortime', scoreType: 'time', durationMin: 12, timeCapMin: 0, intervalSec: 60, rounds: 10, workSec: 20, restSec: 10, description: '', scheduledDate: presetDate || '', esquema: '', bloques: [], notas: '' }, borrador || {});
  const porBloques = !existing || existing.modo === 'bloques' || !existing.description;   // los escritos a mano se abren como texto
  const filas = (w.bloques && w.bloques.length ? w.bloques : [{}]).map(filaMovHtml).join('');
  const body =
    '<div class="field"><label for="w-name">Nombre</label><input type="text" id="w-name" value="' + esc(w.name || '') + '" placeholder="Ej. Viernes de infierno" maxlength="60"></div>' +
    '<div class="inline-fields"><div class="field"><label for="w-type">Formato</label><select id="w-type" data-action="w-type-change">' + ['fortime', 'amrap', 'emom', 'tabata', 'interval', 'strength', 'other'].map((t) => '<option value="' + t + '"' + (w.type === t ? ' selected' : '') + '>' + TYPE_LABEL[t] + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="w-score">Se puntúa por</label><select id="w-score">' + ['time', 'rounds', 'reps', 'load'].map((s) => '<option value="' + s + '"' + (w.scoreType === s ? ' selected' : '') + '>' + SCORE_LABEL[s] + '</option>').join('') + '</select></div></div>' +
    '<div id="w-params">' + workoutParams(w) + '</div>' +
    '<div id="w-build" class="w-build"' + (porBloques ? '' : ' hidden') + '>' +
      esquemaHtml(w) +
      '<div class="field"><span class="label">Movimientos</span><div id="w-rows">' + filas + '</div>' +
      '<button type="button" class="btn sm" data-action="w-row-add">' + icon('plus') + 'Añadir movimiento</button>' +
      '<span class="hint">Reps a la izquierda, el movimiento en medio (escribe y elige de la lista) y la carga Rx a la derecha, si la hay.</span></div>' +
      '<div class="field"><label for="w-notas">Notas (opcional)</label><input type="text" id="w-notas" value="' + esc(w.notas || '') + '" placeholder="p. ej. descansa 1 min entre rondas" maxlength="120"></div>' +
      '<div class="field"><span class="label">Así quedará</span><div class="w-preview" id="w-preview"></div><button type="button" class="link" data-action="w-modo" data-modo="texto">Prefiero escribirlo a mano</button></div>' +
    '</div>' +
    '<div id="w-texto" class="w-build"' + (porBloques ? ' hidden' : '') + '>' +
      '<div class="field"><label for="w-desc">Entreno</label><textarea id="w-desc" placeholder="21-15-9 reps for time of:&#10;Thrusters 43/30 kg&#10;Pull-ups">' + esc(w.description || '') + '</textarea><span class="hint">Una línea por movimiento. Pon las cargas para que quede claro qué es Rx.</span>' +
      '<button type="button" class="link" data-action="w-modo" data-modo="bloques">Mejor elegir los movimientos de la lista</button></div>' +
    '</div>' +
    '<div class="field"><label for="w-date">Programar para (opcional)</label><input type="date" id="w-date" value="' + esc(w.scheduledDate || '') + '"><span class="hint">Saldrá como “WOD de hoy” ese día.</span></div>' +
    '<p class="form-error" id="w-error"></p>';
  openSheet({ title: existing ? 'Editar entreno' : 'Nuevo entreno', body, foot: '<button class="btn ghost" data-action="close-sheet">Cancelar</button><button class="btn primary" data-action="save-workout" data-id="' + esc(existing ? existing.id : '') + '">Guardar</button>' });
  pintaPreviewEntreno();
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
  const existing = existingId ? state.workouts.find((x) => x.id === existingId) : null;
  if (existingId && !puedoEditarEntreno(existing)) { err.textContent = 'Ese entreno lo creó otra persona.'; return; }
  const name = $('#w-name').value.trim(); const scheduledDate = $('#w-date').value;
  const f = leerFormEntreno();
  if (!name) { err.textContent = 'Ponle un nombre al entreno.'; $('#w-name').focus(); return; }
  if (scheduledDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) { err.textContent = 'Fecha no válida.'; return; }
  if (f.modo === 'bloques') {
    if (f.esquema && f.type !== 'strength' && !ESQUEMA_RE.test(f.esquema)) { err.textContent = 'El esquema es un número de rondas (5) o reps separadas por guiones (21-15-9).'; $('#w-esq').focus(); return; }
    if (!f.bloques.length) { err.textContent = 'Añade al menos un movimiento.'; return; }
  } else if (!f.texto) { err.textContent = 'Escribe el entreno (movimientos y reps).'; return; }
  const w = Object.assign({}, existing || {}, {
    id: existingId || uid(), name, type: f.type, scoreType: f.scoreType, scheduledDate: scheduledDate || '', modo: f.modo,
    description: f.modo === 'bloques' ? generaDescripcion(f) : f.texto,
    durationMin: f.durationMin, timeCapMin: f.timeCapMin, intervalSec: f.intervalSec, rounds: f.rounds, workSec: f.workSec, restSec: f.restSec,
    createdBy: existing ? existing.createdBy : (state.meId || ''),
    createdAt: existing ? existing.createdAt : nowISO(), updatedAt: nowISO(),
  });
  if (f.modo === 'bloques') { w.bloques = f.bloques; w.esquema = f.esquema; w.notas = f.notas; }
  else { delete w.bloques; delete w.esquema; delete w.notas; }
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
/* Si algo pide redibujar mientras se está redibujando (un change que salta al quitar del
   DOM un campo con foco), se apunta y se hace al terminar, en vez de pisarse. */
let renderizando = false, renderPendiente = false;
function render() {
  if (renderizando) { renderPendiente = true; return; }
  renderizando = true;
  try {
    renderTopbar(); renderTabs();
    const views = { home: viewHome, wods: viewWods, wod: viewWod, timer: viewTimer, ranking: viewRanking, profile: viewProfile, rx: viewRx, musculos: viewMusculos, sugeridos: viewSugeridos };
    $('#main').innerHTML = avisoVersion() + (views[state.view] || viewHome)();
    afterRenderTimer();
    if (state.view === 'rx' && state.rxSearch) aplicaFiltroRx();
  } finally { renderizando = false; }
  if (renderPendiente) { renderPendiente = false; render(); }
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
      toast('Entreno borrado'); await state.store.remove('workouts', w.id);
      if (state.view === 'wod') go('wods'); else { dismissSheet(); render(); }   // desde Hoy se queda en Hoy
    } else dismissSheet();
  },
  'save-workout': (el) => saveWorkout(el.dataset.id || null),
  'w-type-change': () => {
    const t = $('#w-type').value; $('#w-score').value = DEFAULT_SCORE[t];
    $('#w-params').innerHTML = workoutParams({ type: t, durationMin: 12, timeCapMin: 0, intervalSec: 60, rounds: t === 'tabata' ? 8 : 10, workSec: 20, restSec: 10 });
    const f = $('#w-esq-field'); if (f) { f.hidden = !llevaEsquema(t); $('#w-esq-chips').innerHTML = esquemaChips(t); }
    pintaPreviewEntreno();
  },
  'w-row-add': () => {
    const rows = $('#w-rows'); if (!rows) return;
    cierraListasMov();
    rows.insertAdjacentHTML('beforeend', filaMovHtml({}));
    const c = $('.cant', rows.lastElementChild); if (c) c.focus();
    pintaPreviewEntreno();
  },
  'w-row-del': (el) => {
    const it = el.closest('.mv-item'); const rows = $('#w-rows'); if (!it || !rows) return;
    it.remove();
    if (!rows.children.length) rows.insertAdjacentHTML('beforeend', filaMovHtml({}));
    pintaPreviewEntreno();
  },
  'mv-pick': (el) => { const it = el.closest('.mv-item'); if (it) eligeMov(it, el.dataset.mov, el.dataset.nombre); },
  'w-esq-chip': (el) => { const i = $('#w-esq'); if (!i) return; i.value = el.dataset.v; pintaPreviewEntreno(); },
  'w-modo': (el) => {
    const build = $('#w-build'), texto = $('#w-texto'), d = $('#w-desc'); if (!build || !texto || !d) return;
    if (el.dataset.modo === 'texto') {
      if (!d.value.trim()) { d.value = generaDescripcion(leerFormEntreno()); texto.dataset.generado = d.value; }
      build.hidden = true; texto.hidden = false; d.focus();
    } else {
      if (d.value.trim() && d.value !== texto.dataset.generado) {     // lo escrito a mano se convierte en filas, en lo que se pueda
        const r = parseaTexto(d.value);
        if (r.filas.length) $('#w-rows').innerHTML = r.filas.map(filaMovHtml).join('');
        if (r.notas && $('#w-notas') && !$('#w-notas').value) $('#w-notas').value = r.notas;
      }
      texto.hidden = true; build.hidden = false; pintaPreviewEntreno();
    }
  },
  'log-result': (el) => openLogResult(el.dataset.id || (state.view === 'wod' ? state.params.id : null)),
  'log-wod-change': () => {
    const w = getWorkout($('#f-wod').value);
    $('#f-score').innerHTML = w ? scoreFields(w.scoreType) : '';
    const hint = $('#f-wod').parentElement.querySelector('.hint'); if (hint) hint.remove();
    if (w) $('#f-wod').insertAdjacentHTML('afterend', '<span class="hint">' + esc(workoutMeta(w).join(' · ')) + ' · se puntúa por ' + esc(SCORE_LABEL[w.scoreType]) + '</span>');
  },
  'toggle-capped': () => { const c = $('#f-capped').checked; $('#f-capped-reps').hidden = !c; },
  'save-result': (el) => saveResult((el && el.dataset && el.dataset.reemplaza) || null),
  'edit-result': (el) => {
    const r = state.results.find((x) => x.id === el.dataset.id); if (!r) return;
    if (!puedoEditarResultado(r)) { noPuedes('Solo puedes cambiar tus marcas'); return; }
    openLogResult(r.workoutId, r, r.id);
  },
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
  'musculo': (el) => abreMusculo(el.dataset.id),
  'actualizar-app': () => {
    try { sessionStorage.removeItem(LS_PREFIX + 'actualizando'); } catch (e) { }
    location.replace(location.pathname + '?v=' + encodeURIComponent(state.versionNueva || APP_VERSION) + '&r=' + Date.now());
  },
  'borrar-repetidas': async () => {
    if (!soyAdmin()) { noPuedes(); return; }
    const rep = marcasRepetidas(); if (!rep.length) return;
    const lista = rep.map((r) => athleteById(r.athleteId).name + ', ' + r.workoutName + ' del ' + fmtDate(r.date) + ' (' + fmtScore(r) + ')').join('; ');
    if (await confirmSheet('Borrar marcas repetidas', 'Se borrará' + (rep.length === 1 ? '' : 'n') + ' ' + rep.length + ' marca' + (rep.length === 1 ? '' : 's') + ' que no cuenta' + (rep.length === 1 ? '' : 'n') + ' porque ese día hay otra más reciente del mismo entreno: ' + lista + '.')) {
      for (const r of rep) await state.store.remove('results', r.id);
      dismissSheet(); toast('Marcas repetidas borradas'); render();
    } else dismissSheet();
  },
  'sug-otras': () => { state.sugSeed = (state.sugSeed || 0) + 1; refrescaSug(); },
  'sug-usar': (el) => {
    const g = _sugGeneradas[Number(el.dataset.i)]; if (!g) return;
    if (!me()) { openPickAthlete(); return; }
    const hoy = todayISO();
    openWorkoutForm(null, hoy, { name: g.name, type: g.type, scoreType: g.scoreType, durationMin: g.durationMin || 12, timeCapMin: g.timeCapMin || 0, intervalSec: g.intervalSec || 60,
      rounds: g.rounds || 10, esquema: g.esquema || '', bloques: g.bloques.map((b) => Object.assign({}, b)), notas: g.notas || '', scheduledDate: hoy });
  },
  'musc-tab': (el) => { state.muscTab = el.dataset.tab; render(); },
  'musc-periodo': (el) => { state.muscPeriodo = el.dataset.periodo; render(); },
  'rx-pct': (el) => fijaPct(Number(el.dataset.v) || 100),
  'rx-pct-input': (el) => { const v = Math.round(Number(el.value)); if (v >= 1 && v <= 200) fijaPct(v); else if (!el.value) fijaPct(100); else el.value = ''; },
  'rx-num': async (el) => {
    const m = me(); if (!m) return;
    const rx = Object.assign({}, misRx(m));
    const v = Object.assign({}, rx[el.dataset.mov] || {});
    const n = Number(el.value);
    if (el.value === '' || !(n > 0)) delete v[el.dataset.campo]; else v[el.dataset.campo] = n;
    if (Object.keys(v).length) rx[el.dataset.mov] = v; else delete rx[el.dataset.mov];
    const li = el.closest('li'); const p = li && $('.pct', li); if (p) p.textContent = pctTexto(movPorId(el.dataset.mov), v, state.rxPct);
    await guardaRx(m, rx);
  },
  'rx-estado': async (el) => {
    const m = me(); if (!m) return;
    const rx = Object.assign({}, misRx(m));
    const v = Object.assign({}, rx[el.dataset.mov] || {});
    if (!el.value) delete v.estado; else v.estado = el.value;
    if (Object.keys(v).length) rx[el.dataset.mov] = v; else delete rx[el.dataset.mov];
    await guardaRx(m, rx);
  },
  'rx-nota': async (el) => {
    const m = me(); if (!m) return;
    const rx = Object.assign({}, misRx(m));
    const v = Object.assign({}, rx[el.dataset.mov] || {});
    const t = el.value.trim();
    if (!t) delete v.nota; else v.nota = t;
    if (Object.keys(v).length) rx[el.dataset.mov] = v; else delete rx[el.dataset.mov];
    await guardaRx(m, rx);
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
    const t = e.target;
    if (t.id === 'wod-search') { state.search = t.value; const l = $('#wod-list'); if (l) l.innerHTML = wodListHtml(); return; }
    if (t.id === 'rx-search') { state.rxSearch = t.value; aplicaFiltroRx(); return; }
    if (t.id === 'sug-dur') {                                  // la lista se rehace al deslizar, sin tocar el control
      const v = clamp(Math.round(Number(t.value) || 15), 5, 25);
      state.sugDur = v;
      try { localStorage.setItem(LS_PREFIX + 'sugdur', String(v)); } catch (e2) { }
      const o = $('#sug-dur-val'); if (o) o.textContent = v + ' min';
      if (!_sugPendiente) { _sugPendiente = true; requestAnimationFrame(() => { _sugPendiente = false; refrescaSug(); }); }
      return;
    }
    if (t.classList && t.classList.contains('mv-q')) { t.dataset.mov = ''; abreListaMov(t); }   // se filtra según se escribe
    if (t.closest && t.closest('.sheet') && $('#w-preview')) pintaPreviewEntreno();
  });
  document.addEventListener('focusin', (e) => { const t = e.target; if (t.classList && t.classList.contains('mv-q')) abreListaMov(t); });
  document.addEventListener('pointerdown', (e) => {         // tocar fuera de la lista de movimientos la cierra
    const t = e.target; if (!$('.mv-item.abierta')) return;
    if (t.closest && (t.closest('.mv-list') || (t.classList && t.classList.contains('mv-q')))) return;
    cierraListasMov();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('.mv-item.abierta')) { cierraListasMov(); return; }
    if (e.key === 'Escape' && $('#sheet-root').firstChild) dismissSheet();
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest && e.target.closest('#w-build')) {   // en el constructor, Enter no guarda a medias
      e.preventDefault();
      const it = e.target.closest('.mv-item');
      if (e.target.classList.contains('mv-q')) { const op = it && $('.mv-opt', it); if (op) op.click(); else e.target.blur(); return; }
      const sig = it && e.target.classList.contains('cant') ? $('.mv-q', it) : null;
      if (sig) sig.focus(); else e.target.blur();
      return;
    }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest('.sheet')) { const btn = $('.sheet-foot .btn.primary'); if (btn && e.target.type !== 'number') { e.preventDefault(); btn.click(); } }
  });
  $$('#tabbar .tab').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  try { history.replaceState({ view: 'home', params: {} }, '', /[?&](v|r)=/.test(location.search) ? location.pathname : undefined); } catch (e) { }   // sin el ?v= de una actualización
  try { const g = JSON.parse(sessionStorage.getItem(LS_PREFIX + 'actualizando') || '{}'); if (g.v && !esMasNueva(g.v, APP_VERSION)) sessionStorage.removeItem(LS_PREFIX + 'actualizando'); } catch (e) { }
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
  setTimeout(() => buscaVersionNueva(true), 1200);                       // ¿hay una versión más nueva publicada?
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscaVersionNueva(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) buscaVersionNueva(true); });
  if (state.store.onStatus) state.store.onStatus(() => { if ((state.view === 'home' || state.view === 'profile') && !$('#sheet-root').firstChild) render(); });
  COLS.forEach((col) => {
    state.store.subscribe(col, (docs) => {
      state[col] = docs.slice();
      state.loaded[col] = true;
      if (col === 'results') state.results.sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
      if (col === 'athletes' && state.meId && !athleteById(state.meId)) setMe(null);
      const tecleandoRx = state.view === 'rx' && (state.rxEditando || (document.activeElement && document.activeElement.closest('.rx-list, .rx-search')));   // los campos ya están al día: no quitar el foco
      const deslizando = state.view === 'sugeridos' && document.activeElement && document.activeElement.id === 'sug-dur';
      if (tecleandoRx || deslizando) { /* nada */ }
      else if (state.view !== 'timer' || timer.status === 'idle') render();
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
