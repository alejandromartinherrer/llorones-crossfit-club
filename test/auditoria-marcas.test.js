/* Auditoría de marcas: puntos, pizarras y la hoja «Apuntar» (hallazgos B1-B15 de la auditoría de 5 probadores).
   Cada bloque lleva el código del hallazgo (T3-01, T5-01…) y está pensado para fallar con el código anterior.
   Uso: node test/auditoria-marcas.test.js   (con la app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };

const ADMIN = 'mtr14k1bb9bg49';
const T = '2026-09-01T10:00:00.000Z';
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hace = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const hoy = hace(0);
const NOMBRES = { a: 'Ana', b: 'Bruno', c: 'Cris', d: 'Dani', e: 'Eva', g: 'Gus', h: 'Hugo', i: 'Iker', j: 'Jon', k: 'Kai', l: 'Lola', m: 'Mar', n: 'Nora', o: 'Olga', colega: 'Colega', [ADMIN]: 'Jefe' };
const atletas = (ids) => { const o = {}; ids.forEach((id) => { o[id] = { id, name: NOMBRES[id], color: 'red', createdAt: T, updatedAt: T }; }); return o; };
const porId = (lista) => { const o = {}; lista.forEach((x) => { o[x.id] = x; }); return o; };
const entreno = (id, name, campos) => Object.assign({ id, name, type: 'other', scoreType: 'time', description: '', createdBy: ADMIN, createdAt: T, updatedAt: T }, campos);
const marca = (id, athleteId, workoutId, date, extra, creada) => Object.assign({ id, athleteId, workoutId, workoutName: workoutId, category: /^girl:/.test(workoutId) ? 'girl' : 'custom', date, rx: true, notes: '', createdAt: creada || T, updatedAt: creada || T }, extra);
const rondas = (id, quien, wod, date, r, creada) => marca(id, quien, wod, date, { scoreType: 'rounds', rounds: r, reps: 0 }, creada);
const tiempo = (id, quien, wod, date, s, creada) => marca(id, quien, wod, date, { scoreType: 'time', seconds: s, finished: true }, creada);

const phones = [];
async function siembra(p, s, yo) {
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify(s.athletes || {}))});
    localStorage.setItem('llorones:workouts', ${JSON.stringify(JSON.stringify(s.workouts || {}))});
    localStorage.setItem('llorones:results', ${JSON.stringify(JSON.stringify(s.results || {}))});
    localStorage.setItem('llorones:me', ${JSON.stringify(yo)}); return 1;`);
  await p.go(APP); await sleep(2500);
  await p.eval('closeSheet(); return 1;');
}
async function movil(nombre, port, s, yo) {
  const p = new Phone(nombre, port, { theme: 'dark', sinNube: true });
  phones.push(p);
  await p.start();
  await p.go(APP);
  await siembra(p, s, yo);
  return p;
}
// la hoja «Apuntar»: abrirla, rellenarla, guardar y leer el aviso o el error
async function abre(p, wid, editId) {
  await p.eval(`closeSheet(); openLogResult(${JSON.stringify(wid)}${editId ? ', state.results.find(function(r){ return r.id === ' + JSON.stringify(editId) + '; }), ' + JSON.stringify(editId) : ''}); return 1;`);
  await sleep(500);
}
// si la hoja se cerró sola (el código anterior guardaba lo que no debía), los pasos siguientes no fallan con una excepción: lo dirá el check
const poner = async (p, campos) => { for (const k of Object.keys(campos)) { try { await p.setValue(k, campos[k]); } catch (e) { } } };
const toca = async (f) => { try { await f(); } catch (e) { } };
const guarda = async (p) => { await toca(() => p.clickSel('.sheet-foot [data-action="save-result"]')); await sleep(700); };
const error = (p) => p.eval("var e = document.querySelector('#f-error'); return e ? e.innerText.trim() : ''");
const aviso = (p) => p.eval("var e = document.querySelector('#toast-root'); return e ? e.innerText.trim() : ''");
const nMarcas = (p) => p.eval('return state.results.length');
const marcaDe = (p, id) => p.eval(`var r = state.results.find(function(x){ return x.id === ${JSON.stringify(id)}; }); return JSON.stringify(r || null)`).then(JSON.parse);

(async () => {
  /* ============ móvil 1: puntos, pizarras, Hoy y Ranking ============ */
  const mix = entreno('mix', 'MIX', { type: 'amrap', scoreType: 'rounds', description: 'AMRAP 10 min:\n10 Pull-ups' });
  const pm = entreno('pm', 'Sentadilla 1RM', { type: 'strength', scoreType: 'load', description: 'Back squat\nSu 1RM' });
  const A = {
    athletes: atletas(['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'j', 'k', 'l', 'n', 'o']),
    workouts: porId([mix, pm]),
    results: porId([
      // «MIX» se puntuaba por tiempo (Ana, Bruno, Eva) y ahora se puntúa por rondas (Cris, Dani, Eva)
      tiempo('ra', 'a', 'mix', hace(3), 600), tiempo('rb', 'b', 'mix', hace(3), 900), tiempo('re1', 'e', 'mix', hace(8), 700),
      rondas('rc', 'c', 'mix', hace(1), 10), rondas('rd', 'd', 'mix', hace(1), 5), rondas('re2', 'e', 'mix', hace(2), 6),
      // Gus: una marca en Grace y otra en un entreno que ya no existe
      tiempo('rg1', 'g', 'girl:grace', hace(2), 300), rondas('rg2', 'g', 'borrado', hace(2), 20),
      // Hugo e Iker en Diane: 3:30 frente a 8:00 son 17,5 puntos de rendimiento
      tiempo('rh', 'h', 'girl:diane', hace(2), 210), tiempo('ri', 'i', 'girl:diane', hace(2), 480),
      // Cindy: dos empatadas a 12 rondas y una a 10
      rondas('rj', 'j', 'girl:cindy', hoy, 12), rondas('rk', 'k', 'girl:cindy', hoy, 12), rondas('rl', 'l', 'girl:cindy', hoy, 10),
      // Nora (la del móvil): hoy, un Fran repetido (cuenta uno), un entreno borrado y una marca a cero
      tiempo('rn1', 'n', 'girl:fran', hoy, 700, '2026-10-01T08:00:00.000Z'), tiempo('rn2', 'n', 'girl:fran', hoy, 650, '2026-10-01T09:00:00.000Z'),
      rondas('rn3', 'n', 'borrado', hoy, 5), rondas('rn4', 'n', 'girl:cindy', hoy, 0),
      // kilos con decimales
      marca('ro', 'o', 'pm', hace(1), { scoreType: 'load', load: 82.5 }), marca('rl2', 'l', 'pm', hace(1), { scoreType: 'load', load: 80 }),
    ]),
  };
  const p = await movil('Marcas A', 9605, A, 'n');
  const tabla = async (per) => JSON.parse(await p.eval(`return JSON.stringify(computeStandings(${JSON.stringify(per || 'season')}).map(function(r){ return { id: r.athlete.id, total: r.total, rend: r.rend, prs: r.prs, count: r.count, results: r.results, pos: r.pos }; }))`));
  const t = await tabla();
  const de = (id) => t.find((x) => x.id === id) || {};
  console.log('   tabla:', JSON.stringify(t.filter((x) => x.count)));

  console.log('\n== B1 · T5-01 / T3-02: LAS MARCAS DE ANTES DE CAMBIAR «SE PUNTÚA POR» NO SE MEZCLAN CON LAS NUEVAS');
  const orden = JSON.parse(await p.eval("var x = state.results.find(function(r){ return r.id === 'ra'; }), y = state.results.find(function(r){ return r.id === 'rc'; }); return JSON.stringify([compareResults(x, y), compareResults(y, x)])"));
  check(orden[0] !== 0 && Math.sign(orden[0]) === -Math.sign(orden[1]), 'dos formatos distintos nunca empatan y el orden es el mismo en los dos sentidos (' + orden.join(' / ') + ')');
  const pizarra = JSON.parse(await p.eval("return JSON.stringify(wodBoard('mix').map(function(r){ return r.athleteId; }))"));
  check(JSON.stringify(pizarra) === '["c","e","d"]', 'la pizarra de MIX solo tiene las marcas por rondas: Cris, Eva, Dani (sale ' + pizarra.join(', ') + ')');
  check(de('a').rend === 40 && de('b').rend === 27, 'las de tiempo se miden entre sí: Ana ' + de('a').rend + ' (40) y Bruno ' + de('b').rend + ' (27)');
  check(de('c').rend === 40 && de('d').rend === 20, 'las de rondas también: Cris ' + de('c').rend + ' (40) y Dani ' + de('d').rend + ' (20)');
  const prEva = await p.eval("return isPR(state.results.find(function(r){ return r.id === 're2'; }))");
  check(de('e').prs === 0 && prEva === false, 'pasar de tiempo a rondas no es mejorar un PR: Eva tiene ' + de('e').prs + ' PR y isPR dice ' + prEva);
  await p.eval("go('wod', { id: 'mix' }); return 1;"); await sleep(900);
  const listas = JSON.parse(await p.eval("return JSON.stringify(Array.from(document.querySelectorAll('.wod-lb')).map(function(ul){ return Array.from(ul.querySelectorAll('li')).map(function(li){ return li.innerText.replace(/\\s+/g, ' ').trim(); }); }))"));
  console.log('   listas de la ficha:', JSON.stringify(listas));
  check(listas.length === 2 && listas[0].length === 3 && listas[1].length === 3, 'la ficha separa la pizarra de ahora (3 marcas) de las de antes (3 marcas)');
  const fichaMix = await p.text();
  check(/Apuntadas cuando se puntuaba por tiempo/i.test(fichaMix) && /No se comparan con las de ahora: edítala y ponla por rondas \+ reps/i.test(fichaMix), 'y explica por qué: «Apuntadas cuando se puntuaba por tiempo… No se comparan con las de ahora…»');
  check((listas[1] || []).some((x) => /Ana/.test(x) && /10:00/.test(x)), 'las de antes salen con su marca (Ana, 10:00)');

  console.log('\n== B3 · T5-02: UNA MARCA DE UN ENTRENO BORRADO NO PUNTÚA');
  check(await p.eval('return !!state.loaded.workouts'), 'los entrenos ya han cargado');
  check(de('g').count === 1 && de('g').results === 1 && de('g').rend === 20, 'Gus cuenta solo su Grace (alone: 20 de rendimiento): ' + de('g').count + ' marca, rend ' + de('g').rend);

  console.log('\n== B4 · T5-04: 17,5 PUNTOS DE RENDIMIENTO SE REDONDEAN A 18');
  check(de('h').rend === 40 && de('i').rend === 18, 'Diane: 3:30 saca ' + de('h').rend + ' y 8:00 saca ' + de('i').rend + ' (17,5 sube a 18)');

  console.log('\n== B5 · T5-05 / T4-06: LOS EMPATES COMPARTEN PUESTO');
  await p.eval("go('wod', { id: 'girl:cindy' }); return 1;"); await sleep(900);
  const puestos = JSON.parse(await p.eval("return JSON.stringify(Array.from(document.querySelectorAll('.wod-lb li .pos')).map(function(e){ return [e.textContent.trim(), e.className]; }))"));
  check(JSON.stringify(puestos.map((x) => x[0])) === '["1","1","3"]', 'la pizarra de Cindy numera 1, 1, 3 (dos a 12 rondas y una a 10): ' + puestos.map((x) => x[0]).join(', '));
  check(puestos.map((x) => x[1]).join('|') === 'pos p1|pos p1|pos p3', 'y las clases siguen al puesto: ' + puestos.map((x) => x[1]).join(' | '));

  console.log('\n== B6 · T5-06: «ENTRENOS ESTA SEMANA» CUENTA LO MISMO QUE LA CLASIFICACIÓN');
  await p.eval("go('home'); return 1;"); await sleep(900);
  const semana = await p.eval("var s = Array.from(document.querySelectorAll('.stat')).find(function(x){ return /Entrenos esta semana/i.test(x.innerText); }); return s ? s.querySelector('.v').innerText.trim() : null");
  const sem = (await tabla('week')).find((x) => x.id === 'n') || {};
  check(sem.count === 1 && semana === '1', 'Nora, con un Fran repetido, un entreno borrado y una marca a cero, lleva 1 entreno esta semana (Hoy dice ' + semana + ', la clasificación ' + sem.count + ')');

  console.log('\n== B7 · T4-05: LOS KILOS DECIMALES SALEN CON COMA');
  const fm = JSON.parse(await p.eval("return JSON.stringify([fmtScore({ scoreType: 'load', load: 82.5 }), fmtScore({ scoreType: 'load', load: 80 })])"));
  check(fm[0] === '82,5 kg' && fm[1] === '80 kg', 'fmtScore: ' + fm.join(' / ') + ' (82,5 kg / 80 kg)');
  await p.eval("go('wod', { id: 'pm' }); return 1;"); await sleep(900);
  const fichaPm = await p.text();
  check(/82,5 kg/.test(fichaPm) && /80 kg/.test(fichaPm) && !/82\.5/.test(fichaPm), 'la pizarra de la sentadilla dice «82,5 kg» y «80 kg»');

  console.log('\n== B5 · T5-05: EL PODIO ENSEÑA EL PUESTO, NO EL HUECO');
  await siembra(p, {
    athletes: atletas(['j', 'k', 'l', 'm']),
    results: porId([rondas('sj', 'j', 'girl:cindy', hoy, 12), rondas('sk', 'k', 'girl:cindy', hoy, 12), rondas('sl', 'l', 'girl:cindy', hoy, 10), rondas('sm', 'm', 'girl:cindy', hoy, 8)]),
  }, 'j');
  const pos = (await tabla()).filter((x) => x.total > 0).map((x) => x.pos);
  check(JSON.stringify(pos) === '[1,1,3,4]', 'Jon y Kai empatan a puntos: puestos ' + pos.join(', ') + ' (1, 1, 3, 4)');
  await p.eval("go('ranking'); return 1;"); await sleep(900);
  const podio = JSON.parse(await p.eval("return JSON.stringify(Array.from(document.querySelectorAll('.podium .pos')).map(function(e){ return e.textContent.trim(); }).sort())"));
  check(JSON.stringify(podio) === '["1.º","1.º","3.º"]', 'el podio dice 1.º, 1.º y 3.º (no 1.º, 2.º, 3.º): ' + podio.join(', '));
  const reglas = await p.eval("return Array.from(document.querySelectorAll('details')).map(function(d){ return d.textContent; }).join(' ')");
  check(/Los empates comparten puesto/.test(reglas) && /Si un entreno cambia de «Se puntúa por»/.test(reglas), 'las reglas del Ranking explican los empates y el cambio de «Se puntúa por»');

  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  /* ============ móvil 2: la hoja «Apuntar» ============ */
  const wcap = { type: 'fortime', scoreType: 'time', timeCapMin: 12, description: 'For time:\n100 Air squats' };
  const B = {
    athletes: atletas([ADMIN, 'colega']),
    workouts: porId([
      entreno('mix', 'MIX', { type: 'amrap', scoreType: 'rounds', description: 'AMRAP 10 min:\n10 Pull-ups' }),
      entreno('nota', 'EMOM con nota', { type: 'emom', scoreType: 'reps', intervalSec: 60, rounds: 9, bloques: [{ cant: '10', q: 'pull', mov: 'pull-up' }], description: 'EMOM 9 min:\n10 Pull-ups\nMáximo 2 min de descanso' }),
      entreno('maxrow', 'AMRAP con máximo', { type: 'amrap', scoreType: 'reps', bloques: [{ q: 'pull', mov: 'pull-up', ud: 'max' }], description: 'AMRAP 10 min:\nMax Pull-ups' }),
      entreno('maxcal', 'AMRAP con calorías', { type: 'amrap', scoreType: 'reps', bloques: [{ q: 'pull', mov: 'pull-up', ud: 'max' }, { q: 'row', mov: 'row', ud: 'maxcal' }], description: 'AMRAP 10 min:\nMax Pull-ups\nMax cal Row' }),
      entreno('wcap', 'Con cap', wcap), entreno('wcap2', 'Con cap B', wcap),
      entreno('wtime', 'Sin cap', { type: 'fortime', scoreType: 'time', timeCapMin: 0, description: 'For time:\n50 Burpees' }),
      entreno('wreps', 'Reps', { type: 'emom', scoreType: 'reps', intervalSec: 60, rounds: 9, description: 'EMOM 9 min:\nToes-to-bars' }),
      entreno('wdist', 'Distancia', { type: 'other', scoreType: 'distance', description: 'Row\nLa mayor distancia en 10 min' }),
      entreno('wload', 'Carga', { type: 'strength', scoreType: 'load', description: 'Back squat\nSu 1RM' }),
      entreno('wq', 'Calidad', { type: 'quality', scoreType: 'done', description: 'For quality:\n3 rondas, sin prisa' }),
    ]),
    results: porId([
      rondas('x1', ADMIN, 'girl:cindy', hoy, 10),
      tiempo('p1', ADMIN, 'girl:fran', hace(10), 600), tiempo('p2', ADMIN, 'girl:fran', hace(3), 700),
      marca('m1', ADMIN, 'mix', hace(2), { scoreType: 'reps', reps: 120 }),    // de cuando MIX se puntuaba por reps
      marca('m2', ADMIN, 'wq', hace(4), { scoreType: 'rounds', rounds: 7, reps: 2 }),    // de cuando «Calidad» se puntuaba por rondas
    ]),
  };
  const q = await movil('Marcas B', 9606, B, ADMIN);

  console.log('\n== B8 · T3-08: UNA NOTA QUE EMPIEZA POR «MÁXIMO» NO ES UNA FILA DE MÁXIMO');
  const mx = JSON.parse(await q.eval("return JSON.stringify({ nota: maximosDe(getWorkout('nota')), fila: maximosDe(getWorkout('maxrow')), cal: maximosDe(getWorkout('maxcal')), serie: maximosDe(getWorkout('girl:nicole')) })"));
  check(mx.nota === '' && mx.fila === 'reps' && mx.cal === 'cal', 'maximosDe: nota «' + mx.nota + '» (vacío), fila de máximo «' + mx.fila + '» (reps), fila de calorías «' + mx.cal + '» (cal)');
  check(mx.serie === 'reps', 'y los de serie siguen leyéndose del texto: Nicole «' + mx.serie + '» (reps)');
  await abre(q, 'nota');
  const pistaNota = await q.eval("var h = document.querySelector('#f-score .hint'); return h ? h.innerText : ''");
  await abre(q, 'maxrow');
  const pistaMax = await q.eval("var h = document.querySelector('#f-score .hint'); return h ? h.innerText : ''");
  check(!/Suma las reps/.test(pistaNota) && /Suma las reps de todas las rondas/.test(pistaMax), 'la hoja solo avisa de «Suma las reps de todas las rondas» cuando hay una fila de máximo');

  console.log('\n== B9 · T3-09: SIN ENTRENO ELEGIDO, LA HOJA LO DICE');
  await abre(q, 'girl:cindy');
  await toca(() => q.select('#f-wod', ''));
  const vacio = await q.eval("return document.querySelector('#f-score').innerText.trim()");
  check(/Elige un entreno para ver qué se apunta/.test(vacio), 'al quitar el entreno, la hoja dice «' + vacio + '»');

  console.log('\n== B2 · T3-01: AL EDITAR UNA MARCA DE OTRO FORMATO NO SE PRECARGAN CIFRAS QUE NO SIGNIFICAN LO MISMO');
  await abre(q, 'mix', 'm1');
  const hoja = JSON.parse(await q.eval("var v = function(s){ var e = document.querySelector(s); return e ? e.value : null; }; return JSON.stringify({ reps: v('#f-reps'), rounds: v('#f-rounds'), fecha: v('#f-date'), pista: (document.querySelector('#f-score .sin-marca') || {}).innerText || '' })"));
  check(hoja.reps !== '120', 'las 120 reps de la marca vieja no se cuelan en el campo de la de ahora (reps «' + hoja.reps + '», rondas «' + hoja.rounds + '»)');
  check(/Esta marca se apuntó como 120 reps \(por reps\)/.test(hoja.pista) && /pon la marca de nuevo/.test(hoja.pista), 'y la hoja avisa: «' + hoja.pista + '»');
  check(hoja.fecha === hace(2), 'la fecha de la marca se conserva (' + hoja.fecha + ')');
  await guarda(q);
  const sinRellenar = await error(q);
  const m1 = await marcaDe(q, 'm1');
  check(sinRellenar !== '' && m1.scoreType === 'reps' && m1.reps === 120, 'guardar sin poner la marca da el error del campo («' + sinRellenar + '») y no cambia nada');
  await abre(q, 'wq', 'm2');
  const pistaDone = await q.eval("return (document.querySelector('#f-score .sin-marca') || {}).innerText || ''");
  check(/Esta marca se apuntó como 7 rd \+ 2/.test(pistaDone) && /al guardar solo queda apuntado que lo hiciste/.test(pistaDone) && !/pon la marca de nuevo/.test(pistaDone), 'y si el entreno ya es For quality no pide una marca que no existe: «' + pistaDone + '»');

  console.log('\n== B11 · T4-02: UNA FECHA DE AÑO CORTO NO ES UN DÍA');
  await abre(q, 'girl:cindy');
  check(await q.eval("return document.querySelector('#f-date').getAttribute('min') === '2000-01-01'"), 'el campo de fecha no deja pasar de 2000');
  const antes11 = await nMarcas(q);
  await poner(q, { '#f-date': '0026-10-07', '#f-rounds': 5 }); await guarda(q);
  check(/fecha válida/.test(await error(q)) && (await nMarcas(q)) === antes11, 'una marca del año 0026 se rechaza («' + (await error(q)) + '») y no se guarda');

  console.log('\n== B12 · T4-03: RONDAS, REPS, METROS, MINUTOS Y SEGUNDOS, SOLO ENTEROS (LOS KILOS ADMITEN DECIMALES)');
  const antes12 = await nMarcas(q);
  const intenta = async (wid, campos) => { await abre(q, wid); await poner(q, campos); await guarda(q); return error(q); };
  const eRondas = await intenta('mix', { '#f-rounds': 10.5, '#f-reps': 0 });
  const eRepsRd = await intenta('mix', { '#f-rounds': 10, '#f-reps': 3.5 });
  const eReps = await intenta('wreps', { '#f-reps': 20.5 });
  const eMetros = await intenta('wdist', { '#f-meters': 100.5 });
  const eMin = await intenta('wtime', { '#f-m': 5.5, '#f-s': 0 });
  const eSeg = await intenta('wtime', { '#f-m': 5, '#f-s': 30.5 });
  console.log('   errores:', JSON.stringify([eRondas, eRepsRd, eReps, eMetros, eMin, eSeg]));
  check([eRondas, eRepsRd, eReps, eMetros, eMin, eSeg].every((e) => /entero/.test(e)), 'las seis cifras con decimales se rechazan con un error que habla de enteros');
  check((await nMarcas(q)) === antes12, 'y no se guarda ninguna');
  await abre(q, 'wload'); await poner(q, { '#f-load': 82.5 }); await guarda(q);
  const kilos = await q.eval("var r = state.results.find(function(x){ return x.workoutId === 'wload'; }); return r ? r.load : null");
  check(kilos === 82.5 && /82,5 kg/.test(await aviso(q)), 'los kilos sí admiten decimales: guarda ' + kilos + ' y avisa «' + (await aviso(q)) + '»');

  console.log('\n== B13 · T4-04: UN TIEMPO «TERMINADO» NO PASA DEL TIME CAP');
  const antes13 = await nMarcas(q);
  await abre(q, 'wcap'); await poner(q, { '#f-m': 15, '#f-s': 0 }); await guarda(q);
  const e13 = await error(q);
  check(/time cap \(12 min\)/.test(e13) && /No lo terminé/.test(e13) && (await nMarcas(q)) === antes13, '15:00 con un cap de 12 min se rechaza y manda a «No lo terminé»: «' + e13 + '»');
  await poner(q, { '#f-m': 11, '#f-s': 30 }); await guarda(q);
  const m13 = await q.eval("var r = state.results.find(function(x){ return x.workoutId === 'wcap'; }); return JSON.stringify(r ? { f: r.finished, s: r.seconds } : null)").then(JSON.parse);
  check(m13 && m13.f === true && m13.s === 690, '11:30 sí se guarda como terminado: ' + JSON.stringify(m13));

  console.log('\n== B15 · T4-08: «NO LO TERMINÉ» CON TIME CAP NO PIDE EL TIEMPO');
  await abre(q, 'wcap2');
  await toca(() => q.click('No lo terminé')); await sleep(300);
  check(await q.eval("var e = document.querySelector('#f-time'), r = document.querySelector('#f-capped-reps'); return !!e && e.hidden && getComputedStyle(e).display === 'none' && !!r && !r.hidden"), 'con cap y sin terminar, el tiempo se esconde y se piden las reps');
  await poner(q, { '#f-reps': 30 }); await guarda(q);
  const m15 = await q.eval("var r = state.results.find(function(x){ return x.workoutId === 'wcap2'; }); return JSON.stringify(r ? { f: r.finished, s: r.seconds, reps: r.reps } : null)").then(JSON.parse);
  check(m15 && m15.f === false && m15.s === 720 && m15.reps === 30, 'y guarda el cap (12 min = 720 s) con las 30 reps: ' + JSON.stringify(m15));
  await abre(q, 'wtime');
  await toca(() => q.click('No lo terminé')); await sleep(300);
  check(await q.eval("var m = document.querySelector('#f-m'); return !!m && m.offsetParent !== null"), 'sin time cap, el tiempo sigue a la vista');
  const antes15 = await nMarcas(q);
  await poner(q, { '#f-m': 5, '#f-s': 75, '#f-reps': 30 }); await guarda(q);
  const e15 = await error(q);
  check(/minutos y segundos/.test(e15) && (await nMarcas(q)) === antes15, '5:75 sin terminar ya no se guarda como 0:00: «' + e15 + '»');
  await poner(q, { '#f-m': '', '#f-s': '' }); await guarda(q);
  const m15b = await q.eval("var r = state.results.find(function(x){ return x.workoutId === 'wtime'; }); return JSON.stringify(r ? { f: r.finished, s: r.seconds, reps: r.reps } : null)").then(JSON.parse);
  check(m15b && m15b.f === false && m15b.s === 0 && m15b.reps === 30, 'y con el tiempo vacío (sin cap) guarda 0 s y las 30 reps: ' + JSON.stringify(m15b));

  console.log('\n== B10 · T4-01: «CAMBIARLA POR ESTA» SOLO CAMBIA LA MARCA QUE DIO EL AVISO');
  await abre(q, 'girl:cindy'); await poner(q, { '#f-rounds': 11 }); await guarda(q);
  check(await q.eval("return !!document.querySelector('#f-error [data-reemplaza=\"x1\"]')"), 'Cindy hoy ya tiene marca: sale «Cambiarla por esta»');
  await q.select('#f-wod', 'girl:fran');
  check((await error(q)) === '', 'al cambiar de entreno el aviso desaparece');
  await abre(q, 'girl:cindy'); await poner(q, { '#f-rounds': 11 }); await guarda(q);
  await poner(q, { '#f-date': hace(1) });
  check((await error(q)) === '', 'al cambiar de día el aviso desaparece');
  await abre(q, 'girl:cindy'); await poner(q, { '#f-rounds': 11 }); await guarda(q);
  await q.select('#f-athlete', 'colega');
  check((await error(q)) === '', 'y al cambiar de atleta también');
  await q.eval("return saveResult('x1').then(function(){ return 1; })"); await sleep(700);   // el enlace viejo, pulsado a pesar de todo
  const x1 = await marcaDe(q, 'x1');
  const deColega = await q.eval("return JSON.stringify(state.results.filter(function(r){ return r.athleteId === 'colega' && r.workoutId === 'girl:cindy'; }).map(function(r){ return r.rounds; }))").then(JSON.parse);
  check(x1.athleteId === ADMIN && x1.rounds === 10, 'el enlace viejo no le quita a Jefe su marca ni se la pasa a Colega (x1: ' + x1.athleteId + ', ' + x1.rounds + ' rondas)');
  check(JSON.stringify(deColega) === '[11]', 'Colega recibe una marca nueva de 11 rondas, no la de Jefe cambiada (' + JSON.stringify(deColega) + ')');

  console.log('\n== B14 · T4-07: AL CORREGIR UNA MARCA QUE ES PR TAMBIÉN SE AVISA CON «¡PR!»');
  await abre(q, 'girl:fran'); await poner(q, { '#f-date': hace(3), '#f-m': 8, '#f-s': 20 }); await guarda(q);
  await toca(() => q.clickSel('#f-error [data-action="save-result"]')); await sleep(500);
  const avisoCambiar = await aviso(q);
  check(/^¡PR! Marca actualizada: 8:20 en Fran/.test(avisoCambiar), '«Cambiarla por esta» con 8:20 frente a 10:00 de hace 10 días: «' + avisoCambiar + '»');
  await abre(q, 'girl:fran', 'p2'); await poner(q, { '#f-m': 8, '#f-s': 10 }); await guarda(q);
  const avisoEditar = await aviso(q);
  check(/^¡PR! Marca actualizada: 8:10 en Fran/.test(avisoEditar), 'editándola a 8:10: «' + avisoEditar + '»');
  await abre(q, 'girl:fran', 'p1'); await poner(q, { '#f-m': 9, '#f-s': 50 }); await guarda(q);
  const avisoPrimera = await aviso(q);
  check(/^Marca actualizada: 9:50 en Fran/.test(avisoPrimera), 'la más antigua no es PR, así que sin «¡PR!»: «' + avisoPrimera + '»');

  check(!(q.consoleErrors || []).length, 'sin errores de consola' + ((q.consoleErrors || []).length ? ': ' + q.consoleErrors.join(' | ') : ''));
  await q.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch(async (e) => {
  console.error('FALLO GENERAL:', e.message);
  for (const ph of phones) { try { await ph.stop(); } catch (x) { } }
  process.exit(1);
});
