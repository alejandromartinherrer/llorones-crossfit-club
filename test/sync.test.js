// Pruebas de la sincronización: fusión (unitaria) y viaje de ida y vuelta real contra GitHub (si hay GH_TOKEN).
// Uso: node test/sync.test.js            (solo fusión)
//      GH_TOKEN=... node test/sync.test.js  (fusión + GitHub real, deja data/sync.json vacío al final)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
const between = (a, b) => src.slice(src.indexOf(a) + a.length, src.indexOf(b));
const core = between('/* SYNC-CORE-START */', '/* SYNC-CORE-END */');
const store = between('/* GH-STORE-START */', '/* GH-STORE-END */');

// --- entorno mínimo de navegador ---
const mem = new Map();
global.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
global.window = { addEventListener() { } };
global.document = { hidden: false, addEventListener() { } };
global.state = { meId: null };
global.athleteById = () => null;
const COLS = ['athletes', 'workouts', 'results'];
const APP_VERSION = 'test';
const LS_PREFIX = 'llorones:';
const nowISO = () => new Date().toISOString();
const ctx = { COLS, APP_VERSION, LS_PREFIX, nowISO };
const fn = new Function('COLS', 'APP_VERSION', 'LS_PREFIX', 'nowISO', core + '\n' + store + '\nreturn { mergeSnapshots, sameData, utf8ToB64, b64ToUtf8, GitHubStore };');
const { mergeSnapshots, sameData, utf8ToB64, b64ToUtf8, GitHubStore } = fn(COLS, APP_VERSION, LS_PREFIX, nowISO);

// --- fusión ---
const T0 = '2026-09-01T10:00:00.000Z', T1 = '2026-09-01T11:00:00.000Z', T2 = '2026-09-01T12:00:00.000Z';
const doc = (id, extra) => Object.assign({ id, createdAt: T0, updatedAt: T0 }, extra || {});
{
  const cloud = { results: { a: doc('a'), b: doc('b', { updatedAt: T1, seconds: 100 }) }, athletes: {}, workouts: {}, deleted: {} };
  const local = { results: { b: doc('b', { updatedAt: T2, seconds: 90 }), c: doc('c') }, athletes: { x: doc('x') }, workouts: {}, deleted: {} };
  const m = mergeSnapshots(cloud, local);
  assert.deepStrictEqual(Object.keys(m.results).sort(), ['a', 'b', 'c'], 'unión por id');
  assert.strictEqual(m.results.b.seconds, 90, 'gana la marca más reciente');
  assert.ok(m.athletes.x, 'atleta local nuevo se conserva');
  console.log('ok: unión y última modificación');
}
{
  const cloud = { results: { a: doc('a', { updatedAt: T1 }) }, athletes: {}, workouts: {}, deleted: {} };
  const local = { results: {}, athletes: {}, workouts: {}, deleted: { 'results:a': T2 } };
  const m = mergeSnapshots(cloud, local);
  assert.ok(!m.results.a, 'la baja posterior elimina el documento');
  assert.ok(m.deleted['results:a'], 'la baja se conserva');
  const m2 = mergeSnapshots({ results: { a: doc('a', { updatedAt: '2026-09-02T00:00:00.000Z' }) }, deleted: {} }, { deleted: { 'results:a': T2 } });
  assert.ok(m2.results.a, 'una modificación posterior a la baja resucita el documento');
  console.log('ok: bajas registradas');
}
{
  const a = { results: { a: doc('a') }, deleted: {} }, b = { results: { a: doc('a') }, deleted: {}, updatedAt: 'x' };
  assert.ok(sameData(a, b) && !sameData(a, { results: {}, deleted: {} }), 'sameData ignora updatedAt');
  assert.strictEqual(b64ToUtf8(utf8ToB64('Lucía · 5:10 ♀')), 'Lucía · 5:10 ♀', 'base64 utf-8');
  console.log('ok: utilidades');
}

// --- GitHub real ---
const token = process.env.GH_TOKEN;
if (!token) { console.log('sin GH_TOKEN: se omite la prueba contra GitHub'); process.exit(0); }
const cfg = { owner: 'alejandromartinherrer', repo: 'llorones-crossfit-club', branch: 'data', path: 'data/sync.json' };
class MemLocal {
  constructor() { this.data = { athletes: {}, workouts: {}, results: {} }; this.del = {}; this.subs = {}; }
  subscribe() { return () => { }; }
  async set(col, id, d) { this.data[col][id] = Object.assign({}, d, { id, updatedAt: nowISO() }); }
  async update(col, id, p) { this.data[col][id] = Object.assign({}, this.data[col][id] || {}, p, { id, updatedAt: nowISO() }); }
  async remove(col, id) { delete this.data[col][id]; this.del[col + ':' + id] = nowISO(); }
  snapshot() { const o = { app: 'llorones', version: APP_VERSION, updatedAt: nowISO(), deleted: Object.assign({}, this.del) }; COLS.forEach((c) => { o[c] = Object.assign({}, this.data[c]); }); return o; }
  exportAll() { return this.snapshot(); }
  replaceAll(doc) { COLS.forEach((c) => { this.data[c] = Object.assign({}, doc[c] || {}); }); this.del = Object.assign({}, doc.deleted || {}); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  mem.set(LS_PREFIX + 'gh_token', token);
  const A = new GitHubStore(new MemLocal(), cfg), B = new GitHubStore(new MemLocal(), cfg);
  // 0) partir de una nube vacía
  await A.push(); // sube (o confirma) el estado vacío
  await A.pull(); assert.ok(!A.sync.error, 'pull A: ' + A.sync.error);
  // 1) A apunta un atleta y un resultado; B, otro resultado, ambos sin haberse visto
  await A.local.set('athletes', 'luc', { name: 'Lucía', color: 'yellow', createdAt: nowISO() });
  await A.local.set('results', 'r1', { athleteId: 'luc', workoutId: 'girl:fran', workoutName: 'Fran', category: 'girl', scoreType: 'time', seconds: 310, finished: true, rx: true, date: '2026-09-06', createdAt: nowISO() });
  await B.local.set('results', 'r2', { athleteId: 'luc', workoutId: 'hero:murph', workoutName: 'Murph', category: 'hero', scoreType: 'time', seconds: 2700, finished: true, rx: false, date: '2026-09-06', createdAt: nowISO() });
  await Promise.all([A.push(), B.push()]);
  assert.ok(!A.sync.error && !B.sync.error, 'push concurrente: ' + A.sync.error + ' / ' + B.sync.error);
  await A.pull(); await B.pull();
  assert.deepStrictEqual(Object.keys(A.local.data.results).sort(), ['r1', 'r2'], 'A ve ambos resultados');
  assert.deepStrictEqual(Object.keys(B.local.data.results).sort(), ['r1', 'r2'], 'B ve ambos resultados');
  assert.ok(B.local.data.athletes.luc, 'B ve el atleta de A');
  console.log('ok: dos clientes suben a la vez y ninguno pierde datos');
  // 2) B borra r1; A modifica r2; tras sincronizar: r1 desaparece en A, r2 modificado llega a B
  await B.local.remove('results', 'r1'); await B.push();
  await sleep(1100);
  await A.local.update('results', 'r2', { notes: 'con chaleco' }); await A.push();
  await B.pull(); await A.pull();
  assert.ok(!A.local.data.results.r1 && !B.local.data.results.r1, 'la baja se propaga');
  assert.strictEqual(B.local.data.results.r2.notes, 'con chaleco', 'la modificación se propaga');
  console.log('ok: bajas y cambios se propagan');
  // 3) lectura pública sin token (raw)
  const R = new GitHubStore(new MemLocal(), cfg); R.token = '';
  const { doc } = await R.fetchCloud();
  assert.ok(doc && doc.results && doc.results.r2, 'lectura pública devuelve la nube');
  console.log('ok: lectura sin código de acceso');
  // 4) dejar la nube vacía para el estreno
  const Z = new GitHubStore(new MemLocal(), cfg);
  await Z.pull(); Z.local.replaceAll({ athletes: {}, workouts: {}, results: {}, deleted: {} });
  // forzar subida de vacío: la fusión conservaría los datos, así que subimos directamente
  const { sha } = await Z.fetchCloud();
  const empty = { app: 'llorones', version: APP_VERSION, updatedAt: nowISO(), athletes: {}, workouts: {}, results: {}, deleted: {} };
  const r = await fetch(Z._apiPath(), { method: 'PUT', headers: Z._headers(), body: JSON.stringify({ message: 'reset sync.json', content: utf8ToB64(JSON.stringify(empty)), branch: cfg.branch, sha }) });
  assert.ok(r.ok, 'reset final: ' + r.status);
  console.log('ok: nube reiniciada a vacío');
  console.log('TODO OK');
})().catch((e) => { console.error('FALLO:', e); process.exit(1); });
