/* For quality (sin crono ni marca: se apunta hecho), unidades en las filas del constructor
   (metros, calorías, segundos) y puntuar por metros.
   Uso: node test/calidad.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';
const T = '2026-09-01T10:00:00.000Z';

function atleta(id, name) { return { id, name, color: 'red', createdAt: T, updatedAt: T }; }
async function movil(nombre, port, siembra, yo) {
  const p = new Phone(nombre, port, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify(siembra.athletes || {}))});
    localStorage.setItem('llorones:workouts', ${JSON.stringify(JSON.stringify(siembra.workouts || {}))});
    localStorage.setItem('llorones:results', ${JSON.stringify(JSON.stringify(siembra.results || {}))});
    localStorage.setItem('llorones:me', ${JSON.stringify(yo)});
    return 1;`);
  await p.go(APP);
  await sleep(2500);
  return p;
}
const filas = (p) => p.eval("return JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('#w-rows .mv-item')).map(function(it){ var s = it.querySelector('.ud-sel'); return { cant: it.querySelector('.cant').value, ud: s.value, chip: it.querySelector('.ud-txt').textContent, elegida: !!s.dataset.elegida, mov: it.querySelector('.mv-q').dataset.mov, carga: it.querySelector('.carga').value }; }))").then(JSON.parse);
const entreno = (p, name) => p.eval("return JSON.stringify(state.workouts.find(function(w){return w.name===" + JSON.stringify(name) + ";}) || null)").then(JSON.parse);
const preview = (p) => p.eval("return document.querySelector('#w-preview').innerText");
async function fila(p, n, cant, q, mov, carga) {
  if (n > 1) { await p.clickSel('[data-action="w-row-add"]'); await sleep(200); }
  const it = '#w-rows .mv-item:nth-child(' + n + ')';
  if (cant) await p.type(it + ' .cant', cant);
  await p.type(it + ' .mv-q', q); await sleep(300);
  await p.clickSel(it + ' .mv-opt[data-mov="' + mov + '"]'); await sleep(250);
  if (carga) await p.type(it + ' .carga', carga);
}
const pts = (p, id) => p.eval("var s = computeStandings('season').find(function(x){ return x.athlete.id === '" + id + "'; }); return JSON.stringify({ base: s.base, rend: s.rend, rx: s.rx, pr: s.pr, lider: s.lider, total: s.total })").then(JSON.parse);

(async () => {
  // uno de antes de las unidades, como el 10.02 - 3 de la nube: "15 sled" y "15 farmers" eran metros
  const viejo = { id: 'viejo', name: '10.02 - 3', type: 'amrap', scoreType: 'rounds', durationMin: 15, modo: 'bloques', esquema: '', notas: '',
    bloques: [{ cant: '15', mov: 'sled' }, { cant: '15', mov: 'farmers-carry', carga: '48' }, { cant: '2', mov: 'rope-climb' }, { cant: '400 m', mov: 'run' }, { cant: '40', mov: 'plank' }, { cant: '20 cal', mov: 'row' }],
    description: 'AMRAP 15 min:\n15 Sled push / pull\n15 Farmers carry 48\n2 Rope climbs\n400 m Run\n40 Plank\n20 cal Row', createdBy: ADMIN, createdAt: T, updatedAt: T };
  const p = await movil('Jefe', 9971, { athletes: { [ADMIN]: atleta(ADMIN, 'Jefe'), santi: atleta('santi', 'Santi'), carlos: atleta('carlos', 'Carlos') }, workouts: { viejo } }, ADMIN);
  await p.eval("closeSheet(); return 1;");
  const hoy = await p.eval('return todayISO()');

  /* ---------- 1. For quality en el formulario ---------- */
  console.log('\n== FOR QUALITY EN EL FORMULARIO');
  await p.eval("go('wods'); return 1;"); await sleep(500);
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  check(await p.eval("return Array.prototype.some.call(document.querySelectorAll('#w-type option'), function(o){ return o.value === 'quality' && o.textContent === 'For quality'; })"), 'el formato For quality está en la lista');
  await p.type('#w-name', 'Accesorios');
  await p.select('#w-type', 'quality'); await sleep(300);
  check(await p.eval("var s = document.querySelector('#w-score'); return s.disabled && s.value === 'done' && s.options.length === 1 && /solo hecho/.test(s.options[0].textContent)"), 'se puntúa por "nada: solo hecho", sin poder cambiarlo');
  check(/Sin crono ni marca/.test(await p.eval("return document.querySelector('#w-params').innerText")), 'y lo explica debajo');
  check(await p.eval("return !document.querySelector('#w-esq-field').hidden"), 'pide rondas o esquema, como un For time');
  await p.type('#w-esq', '3');
  await fila(p, 1, '6', 'strict pull', 'strict-pull-up');
  await fila(p, 2, '10', 'hollow', 'hollow-rock');
  await fila(p, 3, '30', 'plank', 'plank');
  const f1 = await filas(p);
  check(f1[0].chip === 'reps' && f1[2].chip === 's' && f1[2].ud === 's', 'la plancha se pone sola en segundos; lo demás, reps');
  let pv = await preview(p);
  console.log('   vista previa:\n      ' + pv.replace(/\n/g, '\n      '));
  check(pv === '3 rounds for quality of:\n6 Strict pull-ups\n10 Hollow rocks\n30 s Plank', 'queda "3 rounds for quality of:" con "30 s Plank"');
  await p.setValue('#w-date', hoy);
  await p.shot('shots/calidad-form.png');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1200);
  const q = await entreno(p, 'Accesorios');
  check(!!q && q.type === 'quality' && q.scoreType === 'done' && q.description === pv, 'se guarda como For quality, sin marca (done)');
  check(!!q && q.bloques.map((b) => b.ud).join(',') === 'reps,reps,s', 'y cada fila con su unidad');
  // al cambiar a otro formato vuelve a dejar elegir por qué se puntúa
  await p.clickSel('[data-action="edit-workout"]'); await sleep(600);
  check(await p.eval("return document.querySelector('#w-type').value === 'quality' && document.querySelector('#w-score').disabled"), 'al editarlo sigue siendo For quality');
  await p.select('#w-type', 'fortime'); await sleep(300);
  check(await p.eval("var s = document.querySelector('#w-score'); return !s.disabled && s.value === 'time' && s.options.length === 5 && Array.prototype.some.call(s.options, function(o){ return o.value === 'distance' && o.textContent === 'metros'; })"), 'pasado a For time se puntúa por tiempo y se puede elegir (también metros)');
  check(/^3 rounds for time of:/.test(await preview(p)), 'y la cabecera cambia a "3 rounds for time of:"');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  /* ---------- 2. ficha, Hoy y apuntar ---------- */
  console.log('\n== FICHA, HOY Y APUNTAR UN FOR QUALITY');
  check(await p.eval("return state.view === 'wod' && !document.querySelector('[data-action=\"timer-for\"]') && document.querySelector('[data-action=\"log-result\"]').classList.contains('primary')"), 'la ficha no tiene cronómetro y "Apuntar resultado" pasa a ser el botón principal');
  check(/For quality/i.test(await p.eval("return document.querySelector('.view .card .meta-line').textContent")), 'y lleva la etiqueta For quality');
  await p.eval("go('home'); return 1;"); await sleep(500);
  check(await p.eval("var h = document.querySelector('.hero-wod'); return !!h && /Accesorios/.test(h.innerText) && !h.querySelector('[data-action=\"timer-for\"]') && h.querySelector('[data-action=\"log-result\"]').classList.contains('primary')"), 'en Hoy, como WOD del día, tampoco sale el cronómetro');
  await p.clickSel('.hero-wod [data-action="log-result"]'); await sleep(700);
  check(await p.eval("var f = document.querySelector('#f-score'); return /For quality: no hay crono ni marca/.test(f.innerText) && !f.querySelector('input')"), 'al apuntar no pide tiempo ni reps: solo lo explica');
  check(/sin marca: se apunta que está hecho/.test(await p.eval("return document.querySelector('#f-wod').parentElement.querySelector('.hint').innerText")), 'y la pista dice que es sin marca');
  await p.clickSel('[data-action="save-result"]'); await sleep(1000);
  const toast = await p.eval("var t = document.querySelector('#toast-root'); return t ? t.innerText : ''");
  const r1 = await p.eval("return JSON.stringify(state.results.find(function(r){ return r.workoutName === 'Accesorios'; }) || null)").then(JSON.parse);
  check(!!r1 && r1.scoreType === 'done' && r1.rx === true && r1.date === hoy, 'se guarda la marca: hecho, Rx');
  check(/Apuntado: Hecho en Accesorios/.test(toast), 'y avisa "Apuntado: Hecho en Accesorios" (' + toast + ')');

  /* ---------- 3. puntos ---------- */
  console.log('\n== PUNTOS DE UN FOR QUALITY');
  await p.eval("var w = state.workouts.find(function(x){ return x.name === 'Accesorios'; }); var base = { workoutId: w.id, workoutName: w.name, category: 'custom', scoreType: 'done', notes: '', createdAt: nowISO(), updatedAt: nowISO() };" +
    "return Promise.all([" +
    "state.store.set('results', 'q-santi', Object.assign({ id: 'q-santi', athleteId: 'santi', date: todayISO(), rx: true }, base))," +
    "state.store.set('results', 'q-carlos', Object.assign({ id: 'q-carlos', athleteId: 'carlos', date: todayISO(), rx: false }, base))," +
    "state.store.set('results', 'q-ayer', Object.assign({ id: 'q-ayer', athleteId: '" + ADMIN + "', date: isoHaceDias(1), rx: false }, base))" +
    "]).then(function(){ go('wod', { id: w.id }); return 1; });"); await sleep(700);
  const yo = await pts(p, ADMIN), santi = await pts(p, 'santi'), carlos = await pts(p, 'carlos');
  console.log('   Jefe ' + JSON.stringify(yo) + '\n   Santi ' + JSON.stringify(santi) + '\n   Carlos ' + JSON.stringify(carlos));
  check(santi.rend === 20 && carlos.rend === 20 && yo.rend === 20, 'todos suman la mitad del rendimiento (20), no hay marca que comparar');
  check(santi.lider === 0 && carlos.lider === 0 && yo.lider === 0, 'nadie es "mejor marca del club"');
  check(yo.pr === 0 && !(await p.eval("return isPR(state.results.find(function(r){ return r.id === '" + r1.id + "'; }))")), 'hacerlo Rx hoy tras hacerlo scaled ayer no es PR (no hay marca)');
  check(santi.total === 5 + 20 + 5 && carlos.total === 5 + 20, 'Santi (Rx) 30 y Carlos (scaled) 25');
  check(yo.base === 10 && yo.rx === 5 && yo.total === 10 + 20 + 5, 'y el Jefe, dos días (ayer scaled, hoy Rx): 35');
  const lb = await p.eval("return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.wod-lb li'), function(li){ return { hecho: !!li.querySelector('.pos.hecho svg'), txt: li.innerText.replace(/\\s+/g, ' ') }; }))").then(JSON.parse);
  console.log('   pizarra: ' + lb.map((x) => x.txt).join(' | '));
  check(lb.length === 3 && lb.every((x) => x.hecho && /Hecho/.test(x.txt)) && /Carlos/.test(lb[2].txt), 'la pizarra lista quién lo ha hecho con un ✓ (sin puestos), Rx delante');
  check(/hecho, sin marca/i.test(await p.eval("return Array.prototype.find.call(document.querySelectorAll('.section-head'), function(s){ return /Pizarra/.test(s.textContent); }).querySelector('.eyebrow').textContent")), 'y en la cabecera pone "hecho, sin marca"');
  await p.eval("document.querySelector('.wod-lb').scrollIntoView({ block: 'center' }); return 1;"); await sleep(300);
  await p.shot('shots/calidad-pizarra.png');
  await p.eval("go('ranking'); return 1;"); await sleep(500);
  check(/For quality/.test(await p.eval("return document.querySelector('.rules').textContent")), 'las reglas del ranking lo explican (+20)');

  /* ---------- 4. unidades en las filas ---------- */
  console.log('\n== METROS, CALORÍAS Y SEGUNDOS EN LAS FILAS');
  await p.eval("go('wods'); return 1;"); await sleep(400);
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  await p.type('#w-name', 'Carries');
  await fila(p, 1, '400', 'run', 'run');
  await fila(p, 2, '50', 'farmers', 'farmers-carry', '2×24 kg');
  await fila(p, 3, '15', 'sled', 'sled');
  await fila(p, 4, '20', 'bike', 'bike');
  await fila(p, 5, '10', 'burpee', 'burpee');
  await fila(p, 6, '25', 'row', 'row');
  let f2 = await filas(p);
  check(f2.map((x) => x.chip).join(',') === 'm,m,m,cal,reps,m', 'cada movimiento trae su unidad: Run, Farmers carry y Sled en metros, la bici en calorías, burpees en reps (' + f2.map((x) => x.chip).join(',') + ')');
  await p.select('#w-rows .mv-item:nth-child(6) .ud-sel', 'cal'); await sleep(300);
  f2 = await filas(p);
  check(f2[5].chip === 'cal' && f2[5].elegida, 'el remo se cambia a calorías tocando la unidad');
  await p.type('#w-rows .mv-item:nth-child(6) .mv-q', 'ski'); await sleep(300);
  await p.clickSel('#w-rows .mv-item:nth-child(6) .mv-opt[data-mov="ski"]'); await sleep(250);
  check((await filas(p))[5].chip === 'cal', 'y si luego cambias el movimiento, la unidad elegida a mano se respeta');
  await p.type('#w-rows .mv-item:nth-child(6) .mv-q', 'row'); await sleep(300);
  await p.clickSel('#w-rows .mv-item:nth-child(6) .mv-opt[data-mov="row"]'); await sleep(250);
  pv = await preview(p);
  console.log('   vista previa:\n      ' + pv.replace(/\n/g, '\n      '));
  check(pv === 'For time:\n400 m Run\n50 m Farmers carry 2×24 kg\n15 m Sled push / pull\n20 cal Bike\n10 Burpees\n25 cal Row', 'la vista previa lo escribe con su unidad y sin plural raro ("50 m Farmers carry")');
  await p.shot('shots/calidad-unidades.png');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1200);
  const c = await entreno(p, 'Carries');
  check(!!c && c.description === pv && c.bloques.map((b) => b.cant + b.ud).join(',') === '400m,50m,15m,20cal,10reps,25cal', 'se guarda número y unidad por separado');
  check(await p.eval("return movimientosDe(state.workouts.find(function(w){ return w.name === 'Carries'; })).map(function(m){ return m.id; }).sort().join(',')") === 'bike,burpee,farmers-carry,row,run,sled', 'reconoce los seis movimientos');
  const est = await p.eval("return estimaTexto(state.workouts.find(function(w){ return w.name === 'Carries'; }).description, '')");
  console.log('   estimación: ' + Math.round(est) + ' s');
  check(est > 400 && est < 900, 'y la duración estimada cuenta metros, calorías y reps (' + Math.round(est / 60) + ' min)');
  check(Math.round(await p.eval("return estimaTexto('30 s Plank', '')")) === 38, '"30 s Plank" son 30 segundos (+ el cambio)');
  await p.clickSel('[data-action="edit-workout"]'); await sleep(600);
  f2 = await filas(p);
  check(f2.map((x) => x.cant + x.chip).join(',') === '400m,50m,15m,20cal,10reps,25cal' && f2[5].elegida && !f2[0].elegida, 'al editar vuelven número y unidad (y el remo en calorías sigue como elegido)');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  /* ---------- 5. los de antes ---------- */
  console.log('\n== LOS ENTRENOS DE ANTES SE LEEN CON SU UNIDAD');
  await p.eval("go('wod', { id: 'viejo' }); return 1;"); await sleep(500);
  await p.clickSel('[data-action="edit-workout"]'); await sleep(600);
  const fv = await filas(p);
  console.log('   filas: ' + fv.map((x) => x.cant + ' ' + x.chip + ' ' + x.mov).join(' | '));
  check(fv.map((x) => x.cant + x.chip).join(',') === '15m,15m,2reps,400m,40s,20cal', '"15 sled" y "15 farmers" pasan a metros, "40 plank" a segundos, "400 m" y "20 cal" se separan');
  pv = await preview(p);
  check(pv === 'AMRAP 15 min:\n15 m Sled push / pull\n15 m Farmers carry 48\n2 Rope climbs\n400 m Run\n40 s Plank\n20 cal Row', 'y la vista previa ya sale bien');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);
  check((await entreno(p, '10.02 - 3')).description === viejo.description, 'sin guardar no se toca: el texto guardado sigue igual hasta que alguien lo edite');

  /* ---------- 6. escrito a mano ---------- */
  console.log('\n== ESCRITO A MANO → FILAS CON UNIDAD');
  await p.eval("go('wods'); return 1;"); await sleep(400);
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  await p.clickSel('[data-action="w-modo"][data-modo="texto"]'); await sleep(300);
  await p.setValue('#w-desc', 'For time:\n1 km Run\n30 seg Plank\n20 calorías Bike\n12 Thrusters 43 kg');
  await p.clickSel('[data-action="w-modo"][data-modo="bloques"]'); await sleep(400);
  const fm = await filas(p);
  console.log('   filas: ' + fm.map((x) => x.cant + ' ' + x.chip + ' ' + x.mov + (x.carga ? ' ' + x.carga : '')).join(' | '));
  check(fm.map((x) => x.cant + x.chip + ':' + x.mov).join(',') === '1000m:run,30s:plank,20cal:bike,12reps:thruster' && fm[3].carga === '43 kg', '"1 km", "30 seg" y "20 calorías" se convierten en número + unidad');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  /* ---------- 7. puntuar por metros ---------- */
  console.log('\n== PUNTUAR POR METROS');
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  await p.type('#w-name', 'Max sled');
  await p.select('#w-type', 'amrap'); await sleep(300);
  await p.setValue('#w-dur', 5);
  await p.select('#w-score', 'distance');
  await fila(p, 1, '', 'sled', 'sled', '+40 kg');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1200);
  const ms = await entreno(p, 'Max sled');
  check(!!ms && ms.scoreType === 'distance', 'un AMRAP que se puntúa por metros');
  await p.clickSel('[data-action="log-result"]'); await sleep(700);
  check(await p.eval("return !!document.querySelector('#f-meters') && /Metros/i.test(document.querySelector('#f-score').textContent) && /se puntúa por metros/i.test(document.querySelector('#f-wod').parentElement.querySelector('.hint').textContent)"), 'al apuntar pide los metros');
  await p.clickSel('[data-action="save-result"]'); await sleep(500);
  check(/metros/.test(await p.eval("return document.querySelector('#f-error').textContent")), 'sin metros no deja guardar');
  await p.type('#f-meters', '1250');
  await p.clickSel('[data-action="save-result"]'); await sleep(1000);
  const rm = await p.eval("return JSON.stringify(state.results.find(function(r){ return r.workoutName === 'Max sled'; }) || null)").then(JSON.parse);
  check(!!rm && rm.meters === 1250 && rm.scoreType === 'distance', 'se guardan 1250 m');
  await p.eval("var w = state.workouts.find(function(x){ return x.name === 'Max sled'; }); return state.store.set('results', 'm-santi', { id: 'm-santi', athleteId: 'santi', workoutId: w.id, workoutName: w.name, category: 'custom', scoreType: 'distance', meters: 1500, date: todayISO(), rx: true, notes: '', createdAt: nowISO(), updatedAt: nowISO() }).then(function(){ render(); return 1; });"); await sleep(600);
  const lbm = await p.eval("return Array.prototype.map.call(document.querySelectorAll('.wod-lb li .s'), function(s){ return s.textContent; }).join(' > ')");
  console.log('   pizarra: ' + lbm);
  check(lbm === '1500 m > 1250 m', 'más metros va delante: 1500 m > 1250 m');
  const m1 = await p.eval("var w = state.workouts.find(function(x){ return x.name === 'Max sled'; }); var b = {}; state.results.filter(function(r){ return r.workoutId === w.id; }).forEach(function(r){ b[r.athleteId] = r; }); return JSON.stringify(rendimientosDeEntreno(b))").then(JSON.parse);
  check(m1.santi === 1 && Math.abs(m1[ADMIN] - 1250 / 1500) < 1e-9, 'y el rendimiento es proporcional a los metros (1250/1500)');

  /* ---------- 8. en un móvil pequeño ---------- */
  console.log('\n== EN UN MÓVIL DE 375 PX');
  await p.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true }); await sleep(400);
  await p.eval("go('wod', { id: state.workouts.find(function(w){ return w.name === 'Carries'; }).id }); return 1;"); await sleep(500);
  await p.clickSel('[data-action="edit-workout"]'); await sleep(700);
  await p.eval("document.querySelector('#w-rows .mv-item:nth-child(2)').scrollIntoView({ block: 'center' }); return 1;"); await sleep(600);
  const med = await p.eval("var it = document.querySelector('#w-rows .mv-item:nth-child(2)'); var c = it.querySelector('.cant'), q = it.querySelector('.mv-q'), ud = it.querySelector('.ud'); var r = ud.getBoundingClientRect(); var encima = [r.left + 3, r.left + r.width / 2, r.right - 3].map(function(x){ var e = document.elementFromPoint(x, r.top + r.height / 2); return e ? e.tagName + '.' + e.className : '-'; }); c.value = '1000'; return JSON.stringify({ q: Math.round(q.getBoundingClientRect().width), cabe: c.scrollWidth <= c.clientWidth + 1, toca: encima.every(function(e){ return e === 'SELECT.ud-sel'; }), encima: encima, pagina: document.documentElement.scrollWidth <= 375 })").then(JSON.parse);
  console.log('   ' + JSON.stringify(med));
  check(med.q >= 120, 'el movimiento sigue teniendo sitio (' + med.q + ' px)');
  check(med.cabe, 'caben cuatro cifras (1000) junto a la unidad');
  check(med.toca, 'tocar la unidad (por el texto o por la flecha) abre su desplegable');
  check(med.pagina, 'sin scroll horizontal');
  await p.eval("document.querySelector('#w-rows .mv-item:nth-child(2) .cant').value = '50'; return 1;");
  await p.shot('shots/calidad-375.png');
  await p.eval("dismissSheet(); return 1;");

  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();
  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
