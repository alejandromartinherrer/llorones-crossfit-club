/* Prueba en vivo: cinco personas (cinco móviles distintos) usan la app de verdad
   y publican en la nube compartida (rama `data` del repositorio).
   Uso: node live5.js            (la app en http://127.0.0.1:8765/dist/index.html)  */
const fs = require('fs');
const path = require('path');
const { Phone, sleep } = require('./drive');

const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const PUB = 'https://alejandromartinherrer.github.io/llorones-crossfit-club/';
const CLOUD = 'https://raw.githubusercontent.com/alejandromartinherrer/llorones-crossfit-club/data/data/sync.json';
const SHOTS = path.join(__dirname, 'shots');
const TOKEN = fs.readFileSync(path.join(__dirname, 'gh_token.txt'), 'utf8').trim();
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };

async function nuevoMovil(nombre, port, opts) {
  const p = new Phone(nombre, port, opts);
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('llorones:gh_token', ${JSON.stringify(TOKEN)}); return 'ok';`);
  await p.go(APP);
  await sleep(3500);            // arranque + descarga de la nube
  return p;
}
async function altaAtleta(p, nombre, color) {
  let titulo = await p.sheetTitle();
  if (titulo === null) { await p.click('Crear atleta'); await sleep(600); titulo = await p.sheetTitle(); }
  if (titulo === '¿Quién eres?') { await p.click('Soy nuevo'); await sleep(600); titulo = await p.sheetTitle(); }
  if (titulo !== 'Nuevo atleta') throw new Error(p.name + ': esperaba la hoja "Nuevo atleta" y hay "' + titulo + '"');
  p.say('hoja de alta abierta');
  await p.type('#a-name', nombre);
  await p.clickSel('.color-picks button[aria-label*="' + color + '"]');
  await p.clickSel('[data-action="save-athlete"]');
  await sleep(900);
}
async function abrirApuntar(p) {
  const t = await p.all();
  if (!t.includes('Apuntar resultado') && !t.includes('APUNTAR')) await p.click('Hoy', '.tab');
  try { await p.click('Apuntar resultado'); } catch (e) { await p.click('Apuntar'); }
  await sleep(700);
}
async function apuntar(p, wodId, campos) {
  await abrirApuntar(p);
  await p.select('#f-wod', wodId);
  if (campos.capped) { await p.clickSel('#f-capped'); await sleep(300); }
  if (campos.min != null) { await p.type('#f-m', campos.min); await p.type('#f-s', campos.seg); }
  if (campos.rondas != null) { await p.type('#f-rounds', campos.rondas); await p.type('#f-reps', campos.reps); }
  else if (campos.reps != null && campos.min == null) await p.type('#f-reps', campos.reps);
  if (campos.kg != null) await p.type('#f-load', campos.kg);
  if (campos.rx) await p.clickSel('#f-rx');
  if (campos.nota) await p.type('#f-notes', campos.nota);
  await p.clickSel('[data-action="save-result"]');
  await sleep(1000);
  const abierta = await p.eval("return !!document.querySelector('.sheet')");
  if (abierta) { const err = await p.eval("return (document.querySelector('#f-error')||{}).textContent || 'la hoja sigue abierta'"); throw new Error('no se guardó: ' + err); }
}
async function esperarSubida(p, quien) {
  for (let i = 0; i < 24; i++) {
    const y = await p.eval("var y = state.store.status(); return JSON.stringify({p:y.pending, e:y.error, up:y.lastPush});");
    const s = JSON.parse(y);
    if (!s.p && s.up) { p.say('subido a la nube'); return true; }
    if (s.e) p.say('aviso de la nube: ' + s.e);
    await sleep(1000);
  }
  fails.push(quien + ': no llegó a subir a la nube');
  return false;
}
async function nube() {
  const r = await fetch('https://api.github.com/repos/alejandromartinherrer/llorones-crossfit-club/contents/data/sync.json?ref=data&t=' + Date.now(),
    { headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github.raw' }, cache: 'no-store' });
  return r.json();
}
async function vaciarNube() {
  const api = 'https://api.github.com/repos/alejandromartinherrer/llorones-crossfit-club/contents/data/sync.json';
  const h = { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const r = await fetch(api + '?ref=data&t=' + Date.now(), { headers: h, cache: 'no-store' });
  const sha = r.ok ? (await r.json()).sha : null;
  const vacio = { app: 'llorones', version: 'reset', updatedAt: new Date().toISOString(), athletes: {}, workouts: {}, results: {}, deleted: {} };
  const body = { message: 'reset antes de la prueba en vivo', content: Buffer.from(JSON.stringify(vacio), 'utf8').toString('base64'), branch: 'data' };
  if (sha) body.sha = sha;
  const w = await fetch(api, { method: 'PUT', headers: h, body: JSON.stringify(body) });
  if (!w.ok) throw new Error('no pude vaciar la nube: ' + w.status);
  console.log('   nube vaciada para empezar de cero');
}

(async () => {
  fs.rmSync(SHOTS, { recursive: true, force: true });
  console.log('APP:', APP);
  await vaciarNube();

  /* ---------------- 1. ÁLEX ---------------- */
  console.log('\n== ÁLEX (móvil 1)');
  const alex = await nuevoMovil('Alex', 9331);
  await altaAtleta(alex, 'Álex', 'azul');
  await apuntar(alex, 'girl:fran', { min: 4, seg: 12, rx: true });
  await apuntar(alex, 'hero:murph', { min: 48, seg: 30, nota: 'primera vez, sin chaleco' });
  await esperarSubida(alex, 'Álex');
  let t = await alex.text();
  check(/Fran/.test(t) && /4:12/.test(t), 'Álex ve su Fran 4:12 en el tablón');
  check(/Murph/.test(t) && /48:30/.test(t), 'Álex ve su Murph 48:30');
  alex.say('puntos: ' + (await alex.eval("return computeStandings('season').map(r=>r.athlete.name+' '+r.total).join(', ')")));

  /* ---------------- 2. BEA (a la vez que Álex sigue abierto) ---------------- */
  console.log('\n== BEA (móvil 2)');
  const bea = await nuevoMovil('Bea', 9332);
  const listaBea = await bea.all();
  check(/Álex/.test(listaBea), 'Bea ve a Álex nada más abrir (viene de la nube)');
  await altaAtleta(bea, 'Bea', 'verde');
  t = await bea.text();
  check(/Fran/.test(t) && /Murph/.test(t), 'Bea ve las marcas de Álex en Últimos tiempos');
  await apuntar(bea, 'girl:cindy', { rondas: 19, reps: 4, rx: true });
  await apuntar(bea, 'girl:grace', { capped: true, reps: 21 });
  await apuntar(bea, 'girl:fran', { min: 4, seg: 40, rx: true });
  await esperarSubida(bea, 'Bea');
  await bea.click('Entrenos', '.tab'); await sleep(600);
  await bea.click('Girls', '.segmented button'); await sleep(600);
  await bea.click('Fran', '.row'); await sleep(800);
  const franBea = await bea.text();
  check(/Álex/.test(franBea) && /Bea/.test(franBea), 'la pizarra de Fran junta a Álex y Bea');
  check(franBea.indexOf('Álex') < franBea.indexOf('Bea'), 'Álex (4:12) va por delante de Bea (4:40)');
  await bea.shot(path.join(SHOTS, 'b-fran-pizarra.png'));

  /* ---------------- 3. CARLOS: crea WOD, usa el crono ---------------- */
  console.log('\n== CARLOS (móvil 3)');
  const carlos = await nuevoMovil('Carlos', 9333);
  check(/Álex/.test(await carlos.all()) && /Bea/.test(await carlos.all()), 'Carlos ve a Álex y Bea al abrir');
  await altaAtleta(carlos, 'Carlos', 'rojo');
  await carlos.click('Entrenos', '.tab'); await sleep(600);
  await carlos.clickSel('.fab'); await sleep(700);
  await carlos.type('#w-name', 'Jueves de llorar');
  await carlos.select('#w-type', 'amrap');
  await carlos.type('#w-dur', 15);
  await carlos.type('#w-desc', '12 kettlebell swings 24/16 kg\n9 burpees box jump\n6 pull-ups');
  await carlos.setValue('#w-date', new Date().toISOString().slice(0, 10));
  await carlos.clickSel('[data-action="save-workout"]');
  await sleep(1200);
  const ficha = await carlos.text();
  check(/Jueves de llorar/.test(ficha) && /AMRAP/i.test(ficha), 'Carlos crea el WOD "Jueves de llorar" (AMRAP 15)');
  const wodId = await carlos.eval("return (Object.values(JSON.parse(localStorage.getItem('llorones:workouts')||'{}'))[0]||{}).id");
  await carlos.click('Hoy', '.tab'); await sleep(700);
  check(/WOD DE HOY|WOD de hoy/i.test(await carlos.text()) && /Jueves de llorar/.test(await carlos.text()), 'sale como WOD de hoy');
  await carlos.shot(path.join(SHOTS, 'c-wod-de-hoy.png'));
  await carlos.click('Cronómetro'); await sleep(900);
  const crono = await carlos.text();
  check(/AMRAP 15/.test(crono), 'el crono se abre configurado como AMRAP 15’');
  for (let i = 0; i < 7; i++) await carlos.clickSel('[data-action="step"][data-id="prepSec"][data-d="-1"]');
  await carlos.click('Empezar'); await sleep(6500);
  await carlos.shot(path.join(SHOTS, 'c-crono-corriendo.png'));
  const enMarcha = await carlos.text();
  check(/AMRAP 15/.test(enMarcha) && /14:5|14:4/.test(enMarcha), 'el crono descuenta (' + (enMarcha.match(/1[0-9]:[0-9]{2}/) || ['?'])[0] + ')');
  for (let i = 0; i < 3; i++) { await carlos.click('+1 ronda'); await sleep(700); }
  await carlos.click('Terminar'); await sleep(1200);
  const fin = await carlos.text();
  check(/3 rd/.test(fin) && /parado a los/.test(fin), 'la pantalla final muestra 3 rondas y a los cuántos paró');
  await carlos.click('Apuntar resultado'); await sleep(900);
  const pre = await carlos.eval("return JSON.stringify({wod:(document.querySelector('#f-wod')||{}).value, rondas:(document.querySelector('#f-rounds')||{}).value})");
  check(JSON.parse(pre).rondas === '3', 'la hoja viene rellena con las 3 rondas del crono');
  await carlos.type('#f-reps', 5);
  await carlos.clickSel('[data-action="save-result"]');
  await sleep(1200);
  await apuntar(carlos, 'hero:dt-new', { min: 12, seg: 5 });
  await esperarSubida(carlos, 'Carlos');

  /* ---------------- 4. DIANA: PR y ranking ---------------- */
  console.log('\n== DIANA (móvil 4)');
  const diana = await nuevoMovil('Diana', 9334);
  const inicioDiana = await diana.all();
  check(/Jueves de llorar/.test(inicioDiana), 'Diana ve el WOD de hoy creado por Carlos');
  await altaAtleta(diana, 'Diana', 'amarillo');
  await apuntar(diana, wodId, { rondas: 14, reps: 2 });
  await apuntar(diana, 'girl:fran', { min: 5, seg: 30 });
  await apuntar(diana, 'girl:fran', { min: 5, seg: 2 });
  await apuntar(diana, 'hero:nate', { rondas: 16, reps: 0, rx: true });
  await esperarSubida(diana, 'Diana');
  const hoyDiana = await diana.text();
  check(/PR/.test(hoyDiana), 'la segunda Fran de Diana (5:02) sale marcada como PR');
  await diana.click('Entrenos', '.tab'); await sleep(500);
  await diana.click('Girls', '.segmented button'); await sleep(500);
  await diana.click('Fran', '.row'); await sleep(800);
  const franTodos = await diana.text();
  check((franTodos.match(/Diana/g) || []).length === 1, 'Diana aparece una sola vez en la pizarra de Fran (su mejor marca)');
  const soloPizarra = franTodos.slice(franTodos.indexOf('Pizarra'), franTodos.indexOf('Tus marcas') >= 0 ? franTodos.indexOf('Tus marcas') : undefined);
  check(/5:02/.test(soloPizarra) && !/5:30/.test(soloPizarra), 'en la pizarra sale su mejor marca (5:02) y no la peor (5:30)');
  check(/5:30/.test(franTodos), 'el histórico "Tus marcas" sí guarda las dos');
  check(franTodos.indexOf('Bea') < franTodos.indexOf('Diana'), 'las Rx (Álex, Bea) van por delante de la escalada (Diana)');

  /* ---------------- 5. EVA: cargas, reps y clasificación ---------------- */
  console.log('\n== EVA (móvil 5)');
  const eva = await nuevoMovil('Eva', 9335);
  await altaAtleta(eva, 'Eva', 'blanco');
  await apuntar(eva, 'girl:gwen', { kg: 62 });
  await apuntar(eva, 'girl:lynne', { reps: 96 });
  await apuntar(eva, wodId, { rondas: 15, reps: 1 });
  await esperarSubida(eva, 'Eva');
  await eva.click('Ranking', '.tab'); await sleep(900);
  const ranking = await eva.text();
  ['Álex', 'Bea', 'Carlos', 'Diana', 'Eva'].forEach((n) => check(ranking.includes(n), 'el ranking incluye a ' + n));
  await eva.shot(path.join(SHOTS, 'e-ranking.png'));
  const tabla = await eva.eval("return computeStandings('season').map(r=>r.pos+'. '+r.athlete.name+' '+r.total+' pts ('+r.count+' entrenos, '+r.prs+' PR, '+r.wins+' victorias)').join(' | ')");
  console.log('   RANKING:', tabla);

  /* ---------------- 6. Comprobación cruzada: móvil de Álex, ya abierto ---------------- */
  console.log('\n== ÁLEX vuelve a mirar (sin recargar)');
  await alex.eval('state.store.pull(); return 1;');
  await sleep(4000);
  const alexFinal = await alex.eval("return computeStandings('season').map(r=>r.athlete.name+' '+r.total).join(', ')");
  check(/Eva/.test(alexFinal) && /Diana/.test(alexFinal), 'el móvil de Álex, abierto todo el rato, se ha enterado de todo: ' + alexFinal);
  await alex.click('Ranking', '.tab'); await sleep(800);
  await alex.shot(path.join(SHOTS, 'a-ranking-alex.png'));

  /* ---------------- 7. Un amigo con el enlace, sin código ---------------- */
  console.log('\n== AMIGO NUEVO (web publicada, sin código de acceso)');
  const amigo = new Phone('Amigo', 9336, {});
  await amigo.start();
  await amigo.go(PUB);
  await amigo.eval("localStorage.clear(); sessionStorage.clear(); return 'ok';");
  await amigo.go(PUB);
  await sleep(5000);
  const vista = await amigo.all();
  ['Álex', 'Bea', 'Carlos', 'Diana', 'Eva'].forEach((n) => check(vista.includes(n), 'el amigo ve a ' + n + ' sin tener código'));
  check(/Solo lectura/i.test(vista), 'el amigo ve el aviso de solo lectura');
  await amigo.eval("closeSheet(); return 1;"); await sleep(400);
  await amigo.shot(path.join(SHOTS, 'f-amigo-hoy.png'));
  const puedeEscribir = await amigo.eval("return !state.store.status().readOnly");
  check(!puedeEscribir, 'el amigo no puede publicar (solo lectura)');

  /* ---------------- capturas para enseñar ---------------- */
  await eva.click('Hoy', '.tab'); await sleep(900);
  await eva.shot(path.join(SHOTS, 'd-hoy.png'));
  await eva.click('Entrenos', '.tab'); await sleep(700);
  await eva.click('Héroes', '.segmented button'); await sleep(700);
  await eva.shot(path.join(SHOTS, 'g-entrenos.png'));
  await eva.type('#wod-search', 'murph'); await sleep(700);
  await eva.click('Murph', '.row'); await sleep(900);
  await eva.shot(path.join(SHOTS, 'h-murph.png'));
  const claro = new Phone('Claro', 9337, { theme: 'light' });
  await claro.start(); await claro.go(PUB); await sleep(5000);
  await claro.eval("closeSheet(); return 1;"); await sleep(400);
  await claro.shot(path.join(SHOTS, 'i-tema-claro.png'));
  await claro.stop();

  /* ---------------- resumen ---------------- */
  const fin2 = await nube();
  console.log('\n== NUBE (data/sync.json)');
  console.log('   atletas:', Object.values(fin2.athletes || {}).map((a) => a.name).join(', '));
  console.log('   entrenos propios:', Object.values(fin2.workouts || {}).map((w) => w.name).join(', '));
  console.log('   marcas:', Object.keys(fin2.results || {}).length);
  const errores = [alex, bea, carlos, diana, eva, amigo].flatMap((p) => (p.consoleErrors || []).map((e) => p.name + ': ' + e));
  console.log('   errores de consola:', errores.length ? errores.join(' | ') : 'ninguno');
  for (const p of [alex, bea, carlos, diana, eva, amigo]) await p.stop();
  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('\nFALLO GENERAL:', e.message); process.exit(1); });
