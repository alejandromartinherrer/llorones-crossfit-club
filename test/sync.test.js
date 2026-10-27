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
const fn = new Function('COLS', 'APP_VERSION', 'LS_PREFIX', 'nowISO', core + '\n' + store + '\nreturn { mergeSnapshots, sameData, utf8ToB64, b64ToUtf8, GitHubStore, saneaDoc, limpiaToken };');
const { mergeSnapshots, sameData, utf8ToB64, b64ToUtf8, GitHubStore, saneaDoc, limpiaToken } = fn(COLS, APP_VERSION, LS_PREFIX, nowISO);

// --- fusión --- (dentro de una función asíncrona para poder usar await)
async function fusion() {
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
  // una baja antigua debe seguir borrando el documento aunque luego se pode del registro
  const viejo = new Date(Date.now() - 900 * 86400000).toISOString();
  const masViejo = new Date(Date.now() - 950 * 86400000).toISOString();
  const m = mergeSnapshots({ results: { z: doc('z', { updatedAt: masViejo }) }, deleted: {} }, { results: {}, deleted: { 'results:z': viejo } });
  assert.ok(!m.results.z, 'la baja se aplica antes de podarla');
  assert.ok(!m.deleted['results:z'], 'la baja de más de dos años se poda del registro');
  const reciente = new Date(Date.now() - 10 * 86400000).toISOString();
  const m2 = mergeSnapshots({ results: { z: doc('z', { updatedAt: masViejo }) }, deleted: {} }, { results: {}, deleted: { 'results:z': reciente } });
  assert.ok(!m2.results.z && m2.deleted['results:z'], 'las bajas recientes se conservan');
  console.log('ok: bajas antiguas no resucitan nada');
}
{
  // lectura de un fichero de más de 1 MB: la API no manda el contenido y hay que pedirlo en bruto
  const real = global.fetch; let pidioRaw = false;
  global.fetch = async (url, opts) => {
    const accept = (opts && opts.headers && opts.headers.Accept) || '';
    if (accept.includes('vnd.github.raw')) { pidioRaw = true; return { ok: true, status: 200, json: async () => ({ app: 'llorones', results: { grande: { id: 'grande' } } }) }; }
    return { ok: true, status: 200, json: async () => ({ sha: 'abc', size: 1400000, content: '', encoding: 'none' }) };
  };
  const g = new GitHubStore({ snapshot: () => ({}) }, { owner: 'o', repo: 'r', branch: 'data', path: 'data/sync.json' });
  g.token = 'x';
  const { doc: d, sha } = await g.fetchCloud();
  assert.ok(pidioRaw && d.results.grande && sha === 'abc', 'con el fichero grande se pide el contenido en bruto');
  global.fetch = real;
  console.log('ok: ficheros de más de 1 MB se siguen leyendo');
}
{
  const a = { results: { a: doc('a') }, deleted: {} }, b = { results: { a: doc('a') }, deleted: {}, updatedAt: 'x' };
  assert.ok(sameData(a, b) && !sameData(a, { results: {}, deleted: {} }), 'sameData ignora updatedAt');
  assert.strictEqual(b64ToUtf8(utf8ToB64('Lucía · 5:10 ♀')), 'Lucía · 5:10 ♀', 'base64 utf-8');
  console.log('ok: utilidades');
}
{
  // v1.12.0: texto colado en un campo numérico (quien tiene el código puede escribir lo que quiera)
  // no llega a pintarse: se fuerza a número o se descarta
  const xss = '"><img src=x onerror=alert(1)>';
  const nube = {
    results: { r: doc('r', { reps: xss, rounds: '7', load: 62.5, meters: '', seconds: null }) },
    workouts: { w: doc('w', { durationMin: xss, timeCapMin: '12', rounds: 5 }) },
    athletes: { a: doc('a', { name: 'Ana', rx: { clean: { kg: xss, nota: 'ok' }, snatch: { kg: '40' } } }) },
    deleted: {},
  };
  const m = mergeSnapshots(nube, { deleted: {} });
  assert.ok(!('reps' in m.results.r) && m.results.r.rounds === 7 && m.results.r.load === 62.5 && !('meters' in m.results.r) && m.results.r.seconds === null, 'resultados saneados');
  assert.ok(!('durationMin' in m.workouts.w) && m.workouts.w.timeCapMin === 12 && m.workouts.w.rounds === 5, 'entrenos saneados');
  assert.ok(!('kg' in m.athletes.a.rx.clean) && m.athletes.a.rx.clean.nota === 'ok' && m.athletes.a.rx.snatch.kg === 40, 'cargas saneadas');
  assert.strictEqual(nube.athletes.a.rx.clean.kg, xss, 'sanear no toca la copia de origen');
  assert.strictEqual(saneaDoc('results', null), null, 'sanear un hueco no rompe');
  console.log('ok: los campos numéricos no dejan pasar HTML');
}
{
  // v1.12.0: repo de datos privado. Sin código no se pide nada; un 404 con código se distingue
  // preguntando por el repo (fichero que falta vs. código que no ve el repo)
  const real = global.fetch;
  const pide = [];
  const mk = (fileStatus, repoStatus) => async (url) => {
    pide.push(url);
    const st = /\/contents\//.test(url) ? fileStatus : repoStatus;
    return { ok: st >= 200 && st < 300, status: st, headers: { get: () => null }, json: async () => ({}) };
  };
  const cfgT = { owner: 'o', repo: 'r', branch: 'main', path: 'data/sync.json' };
  const sin = new GitHubStore({ snapshot: () => ({}) }, cfgT); sin.token = '';
  global.fetch = mk(200, 200);
  assert.strictEqual((await sin.fetchCloud()).doc, null, 'sin código no hay nube');
  assert.strictEqual(pide.length, 0, 'sin código no se llama a GitHub');
  const g = new GitHubStore({ snapshot: () => ({}) }, cfgT); g.token = 'x';
  global.fetch = mk(404, 404);
  await g.fetchCloud();
  assert.ok(g.sync.fatal, 'un código que no ve el repo privado bloquea la escritura');
  global.fetch = mk(404, 200);
  const r404 = await g.fetchCloud();
  assert.ok(!g.sync.fatal && r404.doc === null, 'con el repo visible, un 404 es que el fichero aún no existe');
  global.fetch = mk(401, 200);
  await g.fetchCloud();
  assert.ok(g.sync.fatal, 'un 401 bloquea la escritura');
  global.fetch = mk(404, 404);
  assert.ok(!(await g.checkToken('github_pat_y')).ok, 'checkToken rechaza un código que no ve el repo privado');
  global.fetch = mk(404, 200);
  assert.ok((await g.checkToken('github_pat_y')).ok, 'checkToken acepta un código que ve el repo aunque falte el fichero');
  // push(): el código caduca con la app abierta; la lectura lo descubre y no se sube nada
  const metodos = [];
  const mkP = (fileStatus, repoStatus) => async (url, opts) => {
    metodos.push((opts && opts.method) || 'GET');
    const st = (opts && opts.method === 'PUT') ? 201 : (/\/contents\//.test(url) ? fileStatus : repoStatus);
    return { ok: st >= 200 && st < 300, status: st, headers: { get: () => null }, json: async () => ({}) };
  };
  const conDatos = { snapshot: () => ({ app: 'llorones', athletes: { a: { id: 'a', name: 'A', updatedAt: 1 } }, workouts: {}, results: {}, deleted: {} }), replaceAll() {} };
  const p = new GitHubStore(conDatos, cfgT); p.token = 'x';
  global.fetch = mkP(404, 404);
  await p.push();
  assert.ok(!metodos.includes('PUT'), 'push no sube nada con un código que no ve el repo');
  assert.ok(p.sync.fatal && /caducado/.test(p.sync.error), 'y avisa del código, no de otra cosa');
  metodos.length = 0;
  const p2 = new GitHubStore(conDatos, cfgT); p2.token = 'x';
  global.fetch = mkP(404, 200);
  await p2.push();
  assert.ok(metodos.includes('PUT') && !p2.sync.error, 'con el repo visible y sin fichero, la primera subida sale');
  global.fetch = real;
  console.log('ok: repo privado: sin código no se lee y un código ajeno no escribe');
}
{
  // v1.12.1: el código pegado se limpia, y checkToken dice qué le falta (entero, acceso al repo, leer o
  // escribir). Un código con Contents en Read-only pasaba la comprobación y luego no guardaba nada.
  const real = global.fetch;
  const BUENO = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVW';
  assert.strictEqual(limpiaToken(' ' + BUENO + '\n'), BUENO, 'limpiaToken quita espacios y saltos de los bordes');
  assert.strictEqual(limpiaToken(BUENO.slice(0, 30) + '\u200B\n ' + BUENO.slice(30) + '\u00A0'), BUENO, 'y los invisibles y saltos de en medio');
  assert.strictEqual(limpiaToken('Código: «' + BUENO + '»'), BUENO, 'y lo que venga pegado alrededor');
  assert.strictEqual(limpiaToken('ghp_ABCdef0123456789'), 'ghp_ABCdef0123456789', 'vale también un token clásico');
  assert.strictEqual(limpiaToken('hola que tal'), '', 'lo que no es un código se queda en nada');
  let pide = [];
  const mkT = (fileStatus, repoStatus, blobStatus, resto) => async (url, opts) => {
    pide.push({ url, metodo: (opts && opts.method) || 'GET', auth: opts && opts.headers && opts.headers.Authorization });
    const st = /\/git\/blobs$/.test(url) ? blobStatus : (/\/contents\//.test(url) ? fileStatus : repoStatus);
    return { ok: st >= 200 && st < 300, status: st, headers: { get: (k) => (k === 'x-ratelimit-remaining' ? (resto == null ? '4999' : resto) : null) }, json: async () => ({}) };
  };
  const cfgT = { owner: 'o', repo: 'r', branch: 'main', path: 'data/sync.json' };
  const g = new GitHubStore({ snapshot: () => ({}) }, cfgT);
  const prueba = async (st, t) => { pide = []; global.fetch = mkT.apply(null, st); return g.checkToken(t == null ? BUENO : t); };
  let r = await prueba([200, 200, 201], '  ' + BUENO.slice(0, 40) + '\u200B' + BUENO.slice(40) + '\n');
  assert.ok(r.ok && r.token === BUENO, 'lee y escribe: vale, y devuelve el código limpio para guardarlo');
  assert.ok(pide.length && pide.every((p) => p.auth === 'Bearer ' + BUENO), 'a GitHub solo llega el código limpio');
  assert.ok(pide.some((p) => p.metodo === 'POST' && /\/repos\/o\/r\/git\/blobs$/.test(p.url)) && !pide.some((p) => p.metodo === 'PUT'), 'la prueba de escritura es un blob suelto: no toca los datos');
  assert.ok((await prueba([404, 200, 201])).ok, 'con el repo visible y sin fichero también vale');
  r = await prueba([200, 200, 403]);
  assert.ok(!r.ok && /no puede guardar/.test(r.motivo) && /Read and write/.test(r.motivo), 'Read-only: dice que no puede guardar y qué cambiar');
  r = await prueba([401, 200, 201]);
  assert.ok(!r.ok && /no reconoce/.test(r.motivo), '401: código incompleto, caducado o borrado');
  r = await prueba([404, 404, 201]);
  assert.ok(!r.ok && /no tiene acceso a r/.test(r.motivo) && /Only select repositories/.test(r.motivo), 'sin el repo en Repository access: lo dice');
  assert.ok(!pide.some((p) => p.metodo === 'POST'), 'y no prueba a escribir');
  r = await prueba([403, 200, 201]);
  assert.ok(!r.ok && /no puede leer/.test(r.motivo), '403 al leer: le falta Contents');
  r = await prueba([403, 200, 201, '0']);
  assert.ok(!r.ok && /frenado/.test(r.motivo), '403 por exceso de peticiones: que espere, no que cambie el código');
  r = await prueba([200, 200, 201], 'hola que tal');
  assert.ok(!r.ok && /no parece/.test(r.motivo) && pide.length === 0, 'lo que no es un código ni se manda');
  r = await prueba([200, 200, 201], '   ');
  assert.ok(!r.ok && /Pega/.test(r.motivo), 'vacío: que lo pegue');
  // push(): un 403 al guardar tras una lectura buena es un código que no escribe, no uno caducado
  const conDatos = { snapshot: () => ({ app: 'llorones', athletes: { a: { id: 'a', name: 'A', updatedAt: 1 } }, workouts: {}, results: {}, deleted: {} }), replaceAll() {} };
  const mkPut = (putStatus) => async (url, opts) => {
    const st = (opts && opts.method === 'PUT') ? putStatus : (/\/contents\//.test(url) ? 404 : 200);
    return { ok: st >= 200 && st < 300, status: st, headers: { get: (k) => (k === 'x-ratelimit-remaining' ? '4999' : null) }, json: async () => ({}) };
  };
  const p403 = new GitHubStore(conDatos, cfgT); p403.token = BUENO;
  global.fetch = mkPut(403);
  await p403.push();
  assert.ok(!p403.sync.fatal && /no guardar/.test(p403.sync.error) && /Read and write/.test(p403.sync.error), 'push con 403: dice que no puede guardar y lo seguirá intentando');
  const p401 = new GitHubStore(conDatos, cfgT); p401.token = BUENO;
  global.fetch = mkPut(401);
  await p401.push();
  assert.ok(p401.sync.fatal && /caducado/.test(p401.sync.error), 'push con 401: código que ya no vale');
  global.fetch = real;
  console.log('ok: el código pegado se limpia y la comprobación dice qué le falta');
}

}

// --- GitHub real ---
const token = process.env.GH_TOKEN;
const cfg = { owner: 'alejandromartinherrer', repo: 'llorones-data', branch: 'main', path: 'data/sync.json' };
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
  await fusion();
  if (!token) { console.log('sin GH_TOKEN: se omite la prueba contra GitHub'); process.exit(0); }
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
  // 3) sin token no se lee nada: los datos son privados (v1.12.0)
  const R = new GitHubStore(new MemLocal(), cfg); R.token = '';
  const { doc } = await R.fetchCloud();
  assert.strictEqual(doc, null, 'sin código de acceso no llega la nube');
  console.log('ok: sin código de acceso no se ven los datos');
  // 3.b) código de acceso equivocado: ni lee ni escribe
  const M = new GitHubStore(new MemLocal(), cfg);
  M.token = 'github_pat_11ESTONOVALE0000000000000000000000000000000000000000';
  await M.pull();
  assert.ok(M.sync.fatal, 'con un código malo se marca el aviso');
  assert.ok(!M.local.data.results.r2, 'con un código malo no llegan las marcas de la nube');
  assert.strictEqual(M.status().readOnly, true, 'con un código malo la app queda en solo lectura');
  const antesMal = JSON.stringify((await A.fetchCloud()).doc);
  await M.local.set('results', 'nope', { athleteId: 'luc', workoutId: 'x', workoutName: 'X', date: '2026-09-06' });
  await M.push();
  const despuesMal = JSON.stringify((await A.fetchCloud()).doc);
  assert.strictEqual(antesMal, despuesMal, 'un código malo no puede escribir en la nube');
  const malo = await M.checkToken('github_pat_11ESTONOVALE0000000000000000000000000000000000000000');
  const bueno = await M.checkToken(token);
  assert.ok(!malo.ok, 'checkToken rechaza el código malo');
  assert.ok(bueno.ok, 'checkToken acepta el bueno');
  console.log('ok: un código de acceso malo no lee ni pisa la nube');

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
