/* Editar y borrar marcas (y el entreno del día) desde donde se ven: Hoy, la pizarra y Tus marcas.
   Uso: node test/marcas.test.js   (app servida en http://127.0.0.1:8765) */
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
const marca = (p, id) => p.eval("return JSON.stringify(state.results.find(function(r){return r.id===" + JSON.stringify(id) + ";}) || null)").then(JSON.parse);

(async () => {
  const hoy = hace(0);
  const siembra = {
    athletes: { [ADMIN]: atleta(ADMIN, 'Jefe'), colega: atleta('colega', 'Colega') },
    workouts: { w1: { id: 'w1', name: 'El de hoy', type: 'amrap', scoreType: 'rounds', durationMin: 10, description: '10 burpees', scheduledDate: hoy, createdBy: 'colega', createdAt: T, updatedAt: T } },
    results: {
      r1: { id: 'r1', athleteId: ADMIN, workoutId: 'girl:cindy', workoutName: 'Cindy', category: 'girl', scoreType: 'rounds', rounds: 12, reps: 0, date: hace(1), rx: true, notes: '', createdAt: '2026-09-10T10:00:00.000Z', updatedAt: '2026-09-10T10:00:00.000Z' },
      r2: { id: 'r2', athleteId: 'colega', workoutId: 'w1', workoutName: 'El de hoy', category: 'custom', scoreType: 'rounds', rounds: 5, reps: 3, date: hoy, rx: true, createdAt: T, updatedAt: T },
    },
  };

  console.log('\n== EDITAR UNA MARCA DESDE HOY');
  const p = await movil('Jefe', 9931, siembra, ADMIN);
  await p.eval("go('home'); return 1;"); await sleep(500);
  check(await p.eval("return !!document.querySelector('.feed-li [data-action=\"edit-result\"][data-id=\"r1\"]')"), 'en Últimos tiempos, mi marca lleva lápiz');
  check(await p.eval("return !!document.querySelector('.feed-li [data-action=\"edit-result\"][data-id=\"r2\"]')"), 'y como admin, también la de Colega');
  await p.clickSel('.feed-li [data-action="edit-result"][data-id="r1"]'); await sleep(700);
  check((await p.sheetTitle()) === 'Editar marca', 'se abre "Editar marca"');
  check(await p.eval("return document.querySelector('#f-wod').value === 'girl:cindy' && document.querySelector('#f-date').value === '" + hace(1) + "' && document.querySelector('#f-rounds').value === '12' && document.querySelector('#f-rx').checked"), 'con el entreno, la fecha, las rondas y el Rx tal como estaban');
  check(await p.eval("return !!document.querySelector('.sheet-foot [data-action=\"delete-result\"][data-id=\"r1\"]')"), 'y con papelera en el pie');
  await p.setValue('#f-date', hace(3)); await p.type('#f-rounds', '15'); await p.type('#f-notes', 'era del lunes');
  await p.clickSel('[data-action="save-result"]'); await sleep(1200);
  const r1 = await marca(p, 'r1');
  check(!!r1 && r1.date === hace(3) && r1.rounds === 15 && r1.notes === 'era del lunes' && r1.createdAt === '2026-09-10T10:00:00.000Z' && r1.athleteId === ADMIN, 'se guarda con la fecha y las rondas nuevas, mismo id y misma fecha de creación');
  check(await p.eval("return state.view === 'home' && !document.querySelector('#sheet-root .sheet') && state.results.length === 2"), 'sigo en Hoy, con la hoja cerrada y sin duplicar la marca');
  await p.shot('shots/marcas-hoy.png');
  await p.clickSel('.feed-li [data-action="edit-result"][data-id="r1"]'); await sleep(600);
  await p.select('#f-wod', 'girl:fran'); await sleep(400);
  check(await p.eval("return !!document.querySelector('#f-m') && !document.querySelector('#f-rounds')"), 'al cambiar a un entreno por tiempo cambian los campos');
  await p.type('#f-m', '5'); await p.type('#f-s', '30');
  await p.clickSel('[data-action="save-result"]'); await sleep(1200);
  const r1b = await marca(p, 'r1');
  check(!!r1b && r1b.workoutId === 'girl:fran' && r1b.scoreType === 'time' && r1b.seconds === 330 && r1b.rounds === undefined && r1b.workoutName === 'Fran', 'la marca pasa a Fran con 5:30 y sin rastro de las rondas');

  console.log('\n== EDITAR Y BORRAR DESDE LA FICHA');
  await p.eval("go('wod', {id:'w1'}); return 1;"); await sleep(600);
  check(await p.eval("return !!document.querySelector('.wod-lb [data-action=\"edit-result\"][data-id=\"r2\"]') && !!document.querySelector('.wod-lb [data-action=\"delete-result\"][data-id=\"r2\"]')"), 'en la pizarra el admin ve lápiz y papelera en la marca de Colega');
  await p.clickSel('.wod-lb [data-action="edit-result"][data-id="r2"]'); await sleep(600);
  check(await p.eval("return document.querySelector('#f-athlete').value === 'colega'"), 'la hoja abre con Colega como atleta');
  await p.type('#f-rounds', '6'); await p.clickSel('[data-action="save-result"]'); await sleep(1200);
  check(await p.eval("var r = state.results.find(function(x){return x.id==='r2';}); return r.rounds === 6 && r.athleteId === 'colega'"), 'y la marca de Colega queda con 6 rondas, a su nombre');
  await p.clickSel('.wod-lb [data-action="edit-result"][data-id="r2"]'); await sleep(600);
  await p.clickSel('.sheet-foot [data-action="delete-result"]'); await sleep(600);
  check((await p.sheetTitle()) === 'Borrar resultado', 'la papelera de la hoja pide confirmación');
  await p.clickSel('[data-action="confirm-yes"]'); await sleep(900);
  check(await p.eval("return !state.results.some(function(x){return x.id==='r2';}) && state.view === 'wod'"), 'y se borra');

  console.log('\n== QUITAR EL ENTRENO DEL DÍA DESDE HOY');
  await p.eval("go('home'); return 1;"); await sleep(500);
  check(await p.eval("return !!document.querySelector('.hero-wod [data-action=\"edit-workout\"][data-id=\"w1\"]') && !!document.querySelector('.hero-wod [data-action=\"delete-workout\"][data-id=\"w1\"]')"), 'la tarjeta WOD de hoy tiene Editar y Quitar (el admin puede con el de Colega)');
  await p.clickSel('.hero-wod [data-action="edit-workout"][data-id="w1"]'); await sleep(600);
  check((await p.sheetTitle()) === 'Editar entreno', 'Editar abre el formulario');
  await p.eval("dismissSheet(); return 1;"); await sleep(400);
  await p.clickSel('.hero-wod [data-action="delete-workout"][data-id="w1"]'); await sleep(600);
  check((await p.sheetTitle()) === 'Borrar entreno', 'Quitar pide confirmación');
  await p.clickSel('[data-action="confirm-yes"]'); await sleep(1000);
  check(await p.eval("return state.view === 'home' && !state.workouts.length && /Nadie ha programado/.test(document.querySelector('main').innerText) && !document.querySelector('#sheet-root .sheet')"), 'se quita y me quedo en Hoy');

  console.log('\n== UN ATLETA NORMAL SOLO LO SUYO');
  const s2 = { athletes: siembra.athletes, workouts: {}, results: { r1: siembra.results.r1, r3: { id: 'r3', athleteId: 'colega', workoutId: 'girl:cindy', workoutName: 'Cindy', category: 'girl', scoreType: 'rounds', rounds: 10, reps: 0, date: hoy, rx: true, createdAt: T, updatedAt: T } } };
  const q = await movil('Colega', 9932, s2, 'colega');
  await q.eval("go('home'); return 1;"); await sleep(500);
  check(await q.eval("return !!document.querySelector('.feed-li [data-action=\"edit-result\"][data-id=\"r3\"]') && !document.querySelector('.feed-li [data-action=\"edit-result\"][data-id=\"r1\"]')"), 'Colega ve lápiz en su marca y no en la de Jefe');
  await q.eval("ACTIONS['edit-result']({dataset:{id:'r1'}}); return 1;"); await sleep(500);
  check((await q.sheetTitle()) === null, 'y aunque lo fuerce, no puede editar la de Jefe');
  await q.eval("go('wod', {id:'girl:cindy'}); return 1;"); await sleep(600);
  check(await q.eval("return !!document.querySelector('.wod-lb [data-action=\"edit-result\"][data-id=\"r3\"]') && !document.querySelector('.wod-lb [data-action=\"edit-result\"][data-id=\"r1\"]')"), 'en la pizarra, igual');
  await q.clickSel('.history [data-action="edit-result"][data-id="r3"]'); await sleep(600);
  check((await q.sheetTitle()) === 'Editar marca' && (await q.eval("return document.querySelector('#f-athlete').disabled")), 'desde Tus marcas edita la suya, con el atleta fijado');
  await q.type('#f-rounds', '11'); await q.clickSel('[data-action="save-result"]'); await sleep(1000);
  check(await q.eval("var r = state.results.find(function(x){return x.id==='r3';}); return r.rounds === 11 && r.athleteId === 'colega'"), 'y se guarda a su nombre');

  console.log('\n== LAS MARCAS SALEN CON EL NOMBRE DE HOY DEL ENTRENO');
  const s3 = {
    athletes: siembra.athletes,
    workouts: { w9: { id: 'w9', name: '11.14 - 01', type: 'amrap', scoreType: 'rounds', durationMin: 10, description: '10 burpees', scheduledDate: '', createdBy: ADMIN, createdAt: T, updatedAt: T } },
    results: {
      r4: { id: 'r4', athleteId: ADMIN, workoutId: 'w9', workoutName: '10.14 - 1', category: 'custom', scoreType: 'rounds', rounds: 5, reps: 0, date: hace(7), rx: true, createdAt: '2026-11-14T16:28:00.000Z', updatedAt: T },
      r5: { id: 'r5', athleteId: ADMIN, workoutId: 'girl:cindy', workoutName: 'cindy vieja', category: 'girl', scoreType: 'rounds', rounds: 12, reps: 0, date: hace(6), rx: true, createdAt: '2026-11-15T10:00:00.000Z', updatedAt: T },
      r6: { id: 'r6', athleteId: ADMIN, workoutId: 'ya-no-esta', workoutName: 'Uno borrado', category: 'custom', scoreType: 'rounds', rounds: 3, reps: 0, date: hace(5), rx: true, createdAt: '2026-11-16T10:00:00.000Z', updatedAt: T },
    },
  };
  const z = await movil('Jefe', 9933, s3, ADMIN);
  await z.eval("go('home'); return 1;"); await sleep(500);
  const feedTxt = await z.eval("return Array.prototype.map.call(document.querySelectorAll('.feed-li .what'), function (e) { return e.innerText; }).join(' | ')");
  check(/· 11\.14 - 01/.test(feedTxt) && !/10\.14 - 1/.test(feedTxt), 'en Últimos tiempos, la marca de un entreno renombrado sale con el nombre nuevo (' + feedTxt + ')');
  check(/· Cindy\b/.test(feedTxt) && !/cindy vieja/.test(feedTxt), 'la de una Girl, con el nombre de la Girl');
  check(/· Uno borrado/.test(feedTxt), 'y la de un entreno que ya no existe, con el nombre que se guardó');
  check(await z.eval("var b = document.querySelector('.feed-li [data-action=\"open-wod\"][data-id=\"w9\"]'); return !!b && /11\\.14 - 01/.test(b.getAttribute('aria-label'))"), 'también en la etiqueta del botón (lectores de pantalla)');
  await z.eval("ACTIONS['delete-result']({dataset:{id:'r4'}}); return 1;"); await sleep(500);
  check((await z.sheetTitle()) === 'Borrar resultado' && /de 11\.14 - 01\?/.test(await z.eval("return document.querySelector('#sheet-root').innerText")), 'al borrarla, la pregunta dice el nombre nuevo');
  await z.eval('dismissSheet(); return 1;'); await sleep(300);
  check(await z.eval("return state.results.some(function(x){return x.id==='r4';})"), 'y al cancelar no se borra');

  const errores = (p.consoleErrors || []).concat(q.consoleErrors || [], z.consoleErrors || []);
  check(!errores.length, 'sin errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await p.stop(); await q.stop(); await z.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
