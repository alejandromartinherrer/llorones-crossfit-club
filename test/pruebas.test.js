/* Pruebas oficiales: la DEKA FIT en Entrenos → Pruebas, su ficha, sus puntos (+30) y su fecha en Hoy.
   Uso: node test/pruebas.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';
const T = '2026-09-01T10:00:00.000Z';
const DEKA = 'prueba:deka-fit';

(async () => {
  const p = new Phone('Deka', 9991, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify({ [ADMIN]: { id: ADMIN, name: 'Jefe', color: 'red', createdAt: T, updatedAt: T }, colega: { id: 'colega', name: 'Colega', color: 'blue', createdAt: T, updatedAt: T } }))});
    localStorage.setItem('llorones:me', ${JSON.stringify(ADMIN)}); return 1;`);
  await p.go(APP); await sleep(2500);
  await p.eval("closeSheet(); return 1;");
  const hoy = await p.eval('return todayISO()');
  const antesDeLaPrueba = hoy <= '2026-09-27';

  console.log('\n== ENTRENOS → PRUEBAS');
  await p.eval("go('wods'); return 1;"); await sleep(500);
  check(await p.eval("return !!document.querySelector('[data-action=\"wod-tab\"][data-tab=\"prueba\"]')"), 'hay una pestaña Pruebas');
  const anchos = await p.eval("return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.segmented.cuatro button'), function(b){ return [b.scrollWidth, b.clientWidth]; }))").then(JSON.parse);
  check(anchos.length === 4 && anchos.every((a) => a[0] <= a[1] + 1), 'las cuatro pestañas caben sin cortarse (' + JSON.stringify(anchos) + ')');
  await p.clickSel('[data-action="wod-tab"][data-tab="prueba"]'); await sleep(400);
  check(/DEKA FIT/.test(await p.text()) && await p.eval("return document.querySelectorAll('#wod-list .row').length === 1"), 'con la DEKA FIT');
  await p.shot('shots/pruebas-lista.png');
  await p.type('#wod-search', 'deka'); await sleep(300);
  check(await p.eval("return !!document.querySelector('#wod-list [data-id=\"" + DEKA + "\"]')"), 'y el buscador la encuentra');
  await p.eval("state.search = ''; return 1;");

  console.log('\n== LA FICHA');
  await p.eval("go('wod', {id:'" + DEKA + "'}); return 1;"); await sleep(700);
  const txt = await p.text();
  check(/Prueba/i.test(txt) && (txt.match(/500-meter run/g) || []).length === 10, 'sale como Prueba, con los 10 tramos de 500 m corriendo');
  check(/30 RAM alternating reverse lunges/.test(txt) && /20 RAM burpees/.test(txt) && /100-meter sled push\/pull/.test(txt), 'y las 10 zonas, de los lunges a los burpees');
  check(/27-kg dead ball/.test(txt) && /18-kg dead ball/.test(txt), 'con las cargas de ellos y de ellas');
  check(/spartan\.com/.test(txt) && /\+30/.test(txt), 'el enlace es a spartan.com y explica que suma +30');
  if (antesDeLaPrueba) check(/Barcelona · 27 sep/i.test(txt), 'y la fecha de Barcelona');
  const movs = await p.eval("return movimientosDe(getWorkout('" + DEKA + "')).map(function(m){ return m.id; }).sort().join(',')");
  console.log('   movimientos: ' + movs);
  check(movs === 'bike,box-jump-over,burpee,db-lunge,farmers-carry,row,run,sandbag,sit-up,ski,sled', 'reconoce los 11 movimientos de la DEKA');
  check(/Músculos que trabaja/i.test(txt), 'y dibuja los músculos que trabaja');
  const min = await p.eval("return Math.round(estimaMin(getWorkout('" + DEKA + "'), {}).min)");
  check(min >= 40 && min <= 75, 'se estima en unos ' + min + ' min');
  await p.shot('shots/pruebas-ficha.png');

  console.log('\n== PUNTÚA ALTO');
  await p.clickSel('[data-action="log-result"][data-id="' + DEKA + '"]'); await sleep(700);
  await p.type('#f-m', '62'); await p.type('#f-s', '30');
  await p.clickSel('[data-action="save-result"]'); await sleep(1200);
  const r = await p.eval("return JSON.stringify(state.results.find(function(x){ return x.workoutId === '" + DEKA + "'; }) || null)").then(JSON.parse);
  check(!!r && r.seconds === 3750 && r.category === 'prueba' && r.rx === true, 'se apunta 62:30, Rx, como prueba');
  const s = await p.eval("var s = computeStandings('season').find(function(x){ return x.athlete.id === '" + ADMIN + "'; }); return JSON.stringify(s)").then(JSON.parse);
  console.log('   puntos: ' + JSON.stringify({ base: s.base, rend: s.rend, rx: s.rx, cat: s.cat, total: s.total }));
  check(s.cat === 30 && s.total === 5 + 20 + 5 + 30, 'suma +30 por prueba oficial: 60 puntos en total (un Hero haría 40)');
  await p.eval("go('ranking'); return 1;"); await sleep(500);
  check(/prueba oficial \(DEKA\)/i.test(await p.text()) || /prueba oficial/i.test(await p.eval("return document.querySelector('.rules').textContent")), 'las reglas del ranking lo explican');

  console.log('\n== HOY');
  await p.eval("go('home'); return 1;"); await sleep(500);
  if (antesDeLaPrueba && hoy !== '2026-09-27') check(/DEKA FIT · Barcelona/.test(await p.text()), 'en Próximos: DEKA FIT · Barcelona');
  await p.eval("todayISO = function(){ return '2026-09-27'; }; render(); return 1;"); await sleep(400);
  check(/DEKA FIT/.test(await p.eval("return document.querySelector('.hero-wod') ? document.querySelector('.hero-wod').innerText : ''")), 'el domingo 27 sale como WOD de hoy');
  await p.shot('shots/pruebas-hoy.png');

  console.log('\n== NO SE MEZCLA CON LAS SUGERENCIAS');
  check(await p.eval("return !baseCatalogo().some(function(b){ return b.w.category === 'prueba'; })"), 'la DEKA no sale en los entrenos sugeridos');
  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
