/* Una marca por atleta, entreno y día; el PR solo contra días anteriores; tiempos en min:seg.
   Uso: node test/duplicados.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';
const T = '2026-09-01T10:00:00.000Z';
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hace = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const atleta = (id, name) => ({ id, name, color: 'red', createdAt: T, updatedAt: T });
const marca = (id, athleteId, workoutId, date, extra, creada) => Object.assign({ id, athleteId, workoutId, workoutName: workoutId, category: 'custom', date, rx: true, createdAt: creada || T, updatedAt: creada || T }, extra);
async function movil(nombre, port, siembra, yo) {
  const p = new Phone(nombre, port, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify(siembra.athletes || {}))});
    localStorage.setItem('llorones:workouts', ${JSON.stringify(JSON.stringify(siembra.workouts || {}))});
    localStorage.setItem('llorones:results', ${JSON.stringify(JSON.stringify(siembra.results || {}))});
    localStorage.setItem('llorones:me', ${JSON.stringify(yo)}); return 1;`);
  await p.go(APP); await sleep(2500);
  await p.eval("closeSheet(); return 1;");
  return p;
}

(async () => {
  const siembra = {
    athletes: { [ADMIN]: atleta(ADMIN, 'Jefe'), colega: atleta('colega', 'Colega') },
    workouts: { emom: { id: 'emom', name: 'EMOM T2B', type: 'emom', scoreType: 'reps', intervalSec: 60, rounds: 9, description: 'EMOM 9 min:\nToes-to-bars', createdBy: ADMIN, createdAt: T, updatedAt: T } },
    results: {
      c1: Object.assign(marca('c1', 'colega', 'girl:cindy', hace(5), { scoreType: 'rounds', rounds: 10, reps: 0 }), { category: 'girl', workoutName: 'Cindy' }),
      c2: Object.assign(marca('c2', 'colega', 'girl:cindy', hace(2), { scoreType: 'rounds', rounds: 12, reps: 0 }), { category: 'girl', workoutName: 'Cindy' }),
      e1: marca('e1', 'colega', 'emom', hace(1), { scoreType: 'reps', reps: 8 }, '2026-09-24T06:00:22.634Z'),
      e2: marca('e2', 'colega', 'emom', hace(1), { scoreType: 'reps', reps: 20 }, '2026-09-24T06:49:12.128Z'),
      f1: Object.assign(marca('f1', ADMIN, 'girl:fran', hace(3), { scoreType: 'time', seconds: 600, finished: true }), { category: 'girl', workoutName: 'Fran' }),
    },
  };
  const p = await movil('Jefe', 9981, siembra, ADMIN);

  console.log('\n== EL PR, SOLO CONTRA DÍAS ANTERIORES');
  check(await p.eval("return isPR(state.results.find(function(r){return r.id==='c2';}))"), 'Cindy: 12 rondas hace 2 días mejoran las 10 de hace 5 → PR');
  check(await p.eval("return !isPR(state.results.find(function(r){return r.id==='e2';}))"), 'EMOM: 20 reps el mismo día que 8 (una corrección) → no es PR');
  check(await p.eval("return !isPR(state.results.find(function(r){return r.id==='c1';}))"), 'la primera vez que haces un entreno no es PR');
  const col = await p.eval("var s = computeStandings('season').find(function(x){return x.athlete.id==='colega';}); return JSON.stringify({ prs: s.prs, pr: s.pr, count: s.count, results: s.results })").then(JSON.parse);
  check(col.prs === 1 && col.pr === 5, 'en la clasificación Colega tiene 1 PR (el de Cindy), no 2');

  console.log('\n== LAS REPETIDAS DE ANTES');
  check(await p.eval("return esRepetida(state.results.find(function(r){return r.id==='e1';})) && !esRepetida(state.results.find(function(r){return r.id==='e2';}))"), 'de las dos del mismo día cuenta la última apuntada (20) y la otra (8) es repetida');
  check(col.results === 3 && col.count === 3, 'la repetida no suma: 3 marcas y 3 entrenos');
  check(await p.eval("var b = wodBoard('emom'); return b.length === 1 && b[0].reps === 20"), 'en la pizarra solo sale la que cuenta');
  await p.eval("go('home'); return 1;"); await sleep(500);
  check(/Repetida/i.test(await p.text()), 'en Últimos tiempos la repetida lleva su etiqueta');
  await p.eval("go('profile'); return 1;"); await sleep(600);
  check(/1 marca repetida/.test(await p.text()), 'el admin ve el aviso de 1 marca repetida en Administración');
  await p.clickSel('[data-action="borrar-repetidas"]'); await sleep(600);
  check((await p.sheetTitle()) === 'Borrar marcas repetidas' && /Colega, emom del /.test(await p.eval("return document.querySelector('.sheet-body').textContent")), 'pide confirmación y dice cuál borra');
  await p.clickSel('[data-action="confirm-yes"]'); await sleep(900);
  check(await p.eval("return !state.results.some(function(r){return r.id==='e1';}) && state.results.some(function(r){return r.id==='e2';})"), 'borra la de 8 y deja la de 20');
  check(!(/marca repetida/.test(await p.text())), 'y el aviso desaparece');

  console.log('\n== NO SE PUEDE APUNTAR DOS VECES EL MISMO DÍA');
  await p.eval("go('wod', {id:'girl:fran'}); return 1;"); await sleep(500);
  await p.clickSel('[data-action="log-result"][data-id="girl:fran"]'); await sleep(700);
  check(!(await p.eval("return !!document.querySelector('#f-h')")) && /min : seg/.test(await p.eval("return document.querySelector('#f-score').textContent")), 'el tiempo se apunta en minutos y segundos, sin casilla de horas');
  await p.setValue('#f-date', hace(3));
  await p.type('#f-m', '8'); await p.type('#f-s', '45');
  await p.clickSel('[data-action="save-result"]'); await sleep(800);
  const aviso = await p.eval("return document.querySelector('#f-error').textContent");
  check(/Ese día ya tienes una marca en Fran: 10:00/.test(aviso) && !!(await p.eval("return document.querySelector('#f-error [data-reemplaza=\"f1\"]')")), 'avisa: "' + aviso.trim() + '"');
  check(await p.eval("return state.results.filter(function(r){return r.workoutId==='girl:fran';}).length === 1"), 'y no guarda una segunda');
  await p.clickSel('#f-error [data-reemplaza="f1"]'); await sleep(1200);
  const f1 = await p.eval("return JSON.stringify(state.results.filter(function(r){return r.workoutId==='girl:fran';}))").then(JSON.parse);
  check(f1.length === 1 && f1[0].id === 'f1' && f1[0].seconds === 525 && f1[0].createdAt === T, '"Cambiarla por esta" deja una sola, la misma, con el tiempo nuevo (8:45)');
  check(!(await p.eval("return !!document.querySelector('#sheet-root .sheet')")), 'y cierra la hoja');
  // el admin, apuntando por otro
  await p.clickSel('[data-action="log-result"][data-id="girl:fran"]'); await sleep(700);
  await p.select('#f-athlete', 'colega');
  await p.type('#f-m', '9'); await p.type('#f-s', '0');
  await p.clickSel('[data-action="save-result"]'); await sleep(1000);
  check(await p.eval("return state.results.filter(function(r){return r.workoutId==='girl:fran' && r.athleteId==='colega';}).length === 1"), 'otro atleta sí puede tener su marca el mismo día');
  await p.clickSel('[data-action="log-result"][data-id="girl:fran"]'); await sleep(700);
  await p.select('#f-athlete', 'colega');
  await p.type('#f-m', '7'); await p.type('#f-s', '0');
  await p.clickSel('[data-action="save-result"]'); await sleep(800);
  check(/Ese día ya tiene Colega una marca en Fran: 9:00/.test(await p.eval("return document.querySelector('#f-error').textContent")), 'y si el admin le apunta otra el mismo día, avisa con su nombre');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);
  // editar una marca para llevarla a un día que ya tiene otra
  await p.clickSel('[data-action="log-result"][data-id="girl:fran"]'); await sleep(600);
  await p.type('#f-m', '11'); await p.type('#f-s', '0');
  await p.clickSel('[data-action="save-result"]'); await sleep(1000);
  const hoyId = await p.eval("var r = state.results.find(function(r){return r.workoutId==='girl:fran' && r.athleteId==='" + ADMIN + "' && r.date===todayISO();}); return r ? r.id : null");
  check(!!hoyId, 'otro día sí se puede (hoy, 11:00)');
  await p.eval("ACTIONS['edit-result']({dataset:{id:'" + hoyId + "'}}); return 1;"); await sleep(600);
  await p.setValue('#f-date', hace(3));
  await p.clickSel('[data-action="save-result"]'); await sleep(800);
  check(/Ese día ya tienes otra marca en Fran \(8:45\)/.test(await p.eval("return document.querySelector('#f-error').textContent")) && await p.eval("return state.results.find(function(r){return r.id==='" + hoyId + "';}).date === todayISO()"), 'al editar, no deja moverla a un día que ya tiene otra');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  console.log('\n== TIEMPOS DE MÁS DE UNA HORA Y EL 18:30 MAL PUESTO');
  const larga = marca('larga', ADMIN, 'girl:angie', hace(9), { scoreType: 'time', seconds: 66600, finished: true });
  await p.eval("var r = " + JSON.stringify(Object.assign(larga, { category: 'girl', workoutName: 'Angie' })) + "; state.store.set('results', r.id, r); return 1;"); await sleep(600);
  await p.eval("ACTIONS['edit-result']({dataset:{id:'larga'}}); return 1;"); await sleep(600);
  check(await p.eval("return document.querySelector('#f-m').value === '1110' && document.querySelector('#f-s').value === '0'"), 'una marca de 18 h 30 min se ve como 1110:00, para poder corregirla');
  await p.type('#f-m', '18'); await p.type('#f-s', '30');
  await p.clickSel('[data-action="save-result"]'); await sleep(1000);
  check(await p.eval("return state.results.find(function(r){return r.id==='larga';}).seconds === 1110"), 'corregida a 18:30 (1110 s)');
  await p.eval("ACTIONS['edit-result']({dataset:{id:'larga'}}); return 1;"); await sleep(600);
  await p.type('#f-m', '75'); await p.type('#f-s', '0');
  await p.clickSel('[data-action="save-result"]'); await sleep(1000);
  check(await p.eval("return state.results.find(function(r){return r.id==='larga';}).seconds === 4500"), 'más de una hora, en minutos: 75:00 son 4500 s');
  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  console.log('\n== UN ATLETA NORMAL NO VE EL BOTÓN DE BORRAR REPETIDAS');
  const q = await movil('Colega', 9982, siembra, 'colega');
  await q.eval("go('profile'); return 1;"); await sleep(600);
  check(!(await q.eval("return !!document.querySelector('[data-action=\"borrar-repetidas\"]')")), 'no hay aviso ni botón para quien no administra');
  await q.eval("ACTIONS['borrar-repetidas'](); return 1;"); await sleep(600);
  check(await q.eval("return state.results.some(function(r){return r.id==='e1';})"), 'y aunque lo fuerce, no borra nada');
  await q.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
