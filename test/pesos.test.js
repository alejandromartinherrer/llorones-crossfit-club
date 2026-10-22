/* Marcas por kg con «Reps con ese peso» (v1.11.5): 180 kg × 2. Las reps son opcionales y solo desempatan:
   manda el peso, a igualdad de kilos gana quien hizo más reps y una marca sin reps cuenta como 1.
   Uso: node test/pesos.test.js   (con la app servida en http://127.0.0.1:8765) */
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
const NOMBRES = { a: 'Ana', b: 'Bruno', c: 'Cris', d: 'Dani', e: 'Eva', [ADMIN]: 'Jefe' };
const atletas = (ids) => { const o = {}; ids.forEach((id) => { o[id] = { id, name: NOMBRES[id], color: 'red', createdAt: T, updatedAt: T }; }); return o; };
const porId = (lista) => { const o = {}; lista.forEach((x) => { o[x.id] = x; }); return o; };
const entreno = (id, name, campos) => Object.assign({ id, name, type: 'other', scoreType: 'time', description: '', createdBy: ADMIN, createdAt: T, updatedAt: T }, campos);
const marca = (id, athleteId, workoutId, date, extra) => Object.assign({ id, athleteId, workoutId, workoutName: workoutId, category: 'custom', date, rx: true, notes: '', createdAt: T, updatedAt: T }, extra);
const kilos = (id, quien, wod, date, load, reps) => marca(id, quien, wod, date, reps == null ? { scoreType: 'load', load } : { scoreType: 'load', load, reps });

let p = null;
const J = JSON.stringify;
async function abre(wid, editId, pre) {
  await p.eval(`closeSheet(); openLogResult(${J(wid)}, ${editId ? 'state.results.find(function(r){ return r.id === ' + J(editId) + '; })' : J(pre || null)}${editId ? ', ' + J(editId) : ''}); return 1;`);
  await sleep(500);
}
const poner = async (campos) => { for (const k of Object.keys(campos)) { try { await p.setValue(k, campos[k]); } catch (e) { } } };
const guarda = async () => { try { await p.clickSel('.sheet-foot [data-action="save-result"]'); } catch (e) { } await sleep(700); };
const error = () => p.eval("var e = document.querySelector('#f-error'); return e ? e.innerText.trim() : ''");
const aviso = () => p.eval("var e = document.querySelector('#toast-root'); return e ? e.innerText.trim() : ''");
const nMarcas = () => p.eval('return state.results.length');
const valor = (sel) => p.eval(`var e = document.querySelector(${J(sel)}); return e ? e.value : null`);
const marcaDe = (fn) => p.eval(`var r = state.results.find(${fn}); return JSON.stringify(r || null)`).then(JSON.parse);

(async () => {
  const S = {
    athletes: atletas(['a', 'b', 'c', 'd', 'e', ADMIN]),
    workouts: porId([
      entreno('dl', 'Deadlift 5-5-4-4-3-3-2-2', { type: 'emom', scoreType: 'load', intervalSec: 90, rounds: 8, description: 'Every 90 s × 8:\n5 Deadlifts\n5 Deadlifts\n4 Deadlifts\n4 Deadlifts\n3 Deadlifts\n3 Deadlifts\n2 Deadlifts\n2 Deadlifts' }),
      entreno('pm', 'Peso muerto', { type: 'strength', scoreType: 'load', esquema: '4-3-2-1', description: '4-3-2-1:\nDeadlifts' }),
    ]),
    results: porId([
      // Ana 180 × 2, Bruno 180 × 1, Cris 180 sin reps (cuenta 1), Dani 170 × 4; Eva, de cuando se puntuaba por reps
      kilos('ra', 'a', 'dl', hoy, 180, 2), kilos('rb', 'b', 'dl', hoy, 180, 1), kilos('rc', 'c', 'dl', hoy, 180), kilos('rd', 'd', 'dl', hoy, 170, 4),
      marca('re', 'e', 'dl', hace(1), { scoreType: 'reps', reps: 28 }),
      // el Jefe, hace una semana, 180 × 2 en «Peso muerto»
      kilos('rj', ADMIN, 'pm', hace(7), 180, 2),
    ]),
  };
  p = new Phone('Pesos', 9951, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${J(J(S.athletes))});
    localStorage.setItem('llorones:workouts', ${J(J(S.workouts))});
    localStorage.setItem('llorones:results', ${J(J(S.results))});
    localStorage.setItem('llorones:me', ${J(ADMIN)}); return 1;`);
  await p.go(APP); await sleep(2500);
  await p.eval('closeSheet(); return 1;');
  console.log('   versión', await p.eval('return APP_VERSION'));

  console.log('\n== 1 · «180 KG × 2»: LAS REPS SALEN CON LOS KILOS SOLO SI SE APUNTARON');
  const fm = JSON.parse(await p.eval("return JSON.stringify([fmtScore({ scoreType: 'load', load: 180, reps: 2 }), fmtScore({ scoreType: 'load', load: 180 }), fmtScore({ scoreType: 'load', load: 82.5, reps: 1 }), fmtScore({ scoreType: 'load', load: 80, reps: 0 })])"));
  check(J(fm) === J(['180 kg × 2', '180 kg', '82,5 kg × 1', '80 kg']), 'fmtScore: ' + fm.join(' / ') + ' (180 kg × 2 / 180 kg / 82,5 kg × 1 / 80 kg)');

  console.log('\n== 2 · MANDAN LOS KILOS; A IGUALDAD, MÁS REPS; SIN REPS CUENTA COMO 1');
  const cmp = JSON.parse(await p.eval(`var c = function(a, b){ return Math.sign(compareResults(a, b)); }, k = function(load, reps){ var r = { scoreType: 'load', load: load, rx: true }; if (reps != null) r.reps = reps; return r; };
    return JSON.stringify({ masReps: c(k(180, 2), k(180, 1)), sinReps: c(k(180), k(180, 1)), sinRepsPierde: c(k(180), k(180, 2)), kilosMandan: c(k(185, 1), k(180, 5)), simetrico: c(k(180, 1), k(180, 2)), rxDelante: c(Object.assign(k(190, 3), { rx: false }), k(180)) })`));
  check(cmp.masReps === -1 && cmp.simetrico === 1, '180 × 2 va delante de 180 × 1, y al revés detrás (' + cmp.masReps + ' / ' + cmp.simetrico + ')');
  check(cmp.sinReps === 0 && cmp.sinRepsPierde === 1, '180 sin reps empata con 180 × 1 y va detrás de 180 × 2 (' + cmp.sinReps + ' / ' + cmp.sinRepsPierde + ')');
  check(cmp.kilosMandan === -1, '185 × 1 gana a 180 × 5: las reps solo desempatan (' + cmp.kilosMandan + ')');
  check(cmp.rxDelante === 1, 'y Rx sigue delante de scaled aunque el scaled levante más (' + cmp.rxDelante + ')');

  console.log('\n== 3 · LA PIZARRA');
  const tablero = JSON.parse(await p.eval("return JSON.stringify(wodBoard('dl').map(function(r){ return r.athleteId; }))"));
  check(tablero[0] === 'a' && tablero[3] === 'd' && tablero.slice(1, 3).sort().join() === 'b,c', 'orden: Ana, (Bruno y Cris), Dani; sale ' + tablero.join(', '));
  await p.eval("go('wod', { id: 'dl' }); return 1;"); await sleep(900);
  const filas = JSON.parse(await p.eval("var l = document.querySelector('.wod-lb'); return JSON.stringify(l ? Array.from(l.querySelectorAll('li')).map(function(li){ return [li.querySelector('.pos').textContent.trim(), li.querySelector('.title').textContent.trim(), li.querySelector('.s').textContent.trim()]; }) : [])"));
  console.log('   pizarra:', J(filas));
  const fila = (n) => filas.find((x) => x[1] === n) || [];
  check(fila('Ana')[0] === '1' && fila('Ana')[2] === '180 kg × 2', 'Ana, 1.ª con «180 kg × 2»');
  check(fila('Bruno')[0] === '2' && fila('Cris')[0] === '2' && fila('Bruno')[2] === '180 kg × 1' && fila('Cris')[2] === '180 kg', 'Bruno (180 kg × 1) y Cris (180 kg, sin reps) empatan en el 2.º puesto');
  check(fila('Dani')[0] === '4' && fila('Dani')[2] === '170 kg × 4', 'Dani, 4.º con «170 kg × 4»: más reps no compensan menos kilos');
  const ficha = await p.text();
  check(/Apuntadas cuando se puntuaba por reps/i.test(ficha) && /28 reps/.test(ficha), 'la de Eva, de cuando se puntuaba por reps, sigue aparte con sus 28 reps');

  console.log('\n== 4 · PUNTOS: EL RENDIMIENTO SIGUE SALIENDO DE LOS KILOS; EL +5 DEL MEJOR, SOLO PARA QUIEN DESEMPATA');
  const t = JSON.parse(await p.eval("return JSON.stringify(computeStandings('season').map(function(r){ return { id: r.athlete.id, rend: r.rend, lider: r.lider, wins: r.wins }; }))"));
  const de = (id) => t.find((x) => x.id === id) || {};
  check(de('a').rend === 40 && de('b').rend === 40 && de('c').rend === 40 && de('d').rend === 38, 'rendimiento: Ana ' + de('a').rend + ', Bruno ' + de('b').rend + ', Cris ' + de('c').rend + ' (40 los tres) y Dani ' + de('d').rend + ' (38 = 40 × 170/180)');
  check(de('a').lider === 5 && de('b').lider === 0 && de('c').lider === 0, 'el +5 del mejor es solo para Ana (' + de('a').lider + '), no para Bruno (' + de('b').lider + ') ni Cris (' + de('c').lider + ')');

  console.log('\n== 5 · LA HOJA «APUNTAR»');
  await abre('dl');
  const hoja = JSON.parse(await p.eval("var l = document.querySelector('label[for=\"f-load-reps\"]'), h = document.querySelector('#f-score .hint'), i = document.querySelector('#f-load-reps'); return JSON.stringify({ label: l ? l.textContent.trim() : null, pista: h ? h.innerText.trim() : '', valor: i ? i.value : null, min: i ? i.getAttribute('min') : null, kg: !!document.querySelector('#f-load') })"));
  check(hoja.kg && hoja.label === 'Reps con ese peso' && hoja.valor === '' && hoja.min === '1', 'pide «Peso (kg)» y «Reps con ese peso», vacío y desde 1: ' + J(hoja));
  check(/Opcional/.test(hoja.pista) && /vacío cuenta como 1/.test(hoja.pista), 'y explica que es opcional y cómo cuenta: «' + hoja.pista + '»');
  await abre('dl', null, { reps: 0 });                                       // lo que manda el crono al acabar un EMOM
  check((await valor('#f-load-reps')) === '', 'desde el crono (reps 0) el campo sale vacío, no con un 0');
  await abre('dl', 'ra');
  check((await valor('#f-load')) === '180' && (await valor('#f-load-reps')) === '2', 'al editar la de Ana salen sus 180 kg y sus 2 reps');
  await abre('dl', 're');
  check((await valor('#f-load-reps')) === '' && /Esta marca se apuntó como 28 reps/.test(await p.eval("return (document.querySelector('#f-score .sin-marca') || {}).innerText || ''")), 'al editar la de Eva (28 reps, de cuando era por reps) las 28 no se cuelan como reps con ese peso');

  console.log('\n== 6 · LAS REPS, ENTERAS Y DE 1 EN ADELANTE; SI NO, NO SE GUARDA');
  const antes = await nMarcas();
  const errores = [];
  for (const reps of ['0', '2.5', '-1']) { await abre('dl'); await poner({ '#f-athlete': ADMIN, '#f-load': 175, '#f-load-reps': reps }); await guarda(); errores.push(await error()); }
  await abre('dl'); await poner({ '#f-athlete': ADMIN, '#f-load': 175 }); await p.type('#f-load-reps', '1e'); await guarda(); errores.push(await error());
  console.log('   errores:', J(errores));
  check(errores.every((e) => /reps con ese peso van en un número entero, de 1 en adelante/.test(e)), '0, 2,5, -1 y «1e» se rechazan con el error de las reps');
  check((await nMarcas()) === antes, 'y no se guarda ninguna marca');

  console.log('\n== 7 · GUARDAR CON Y SIN REPS');
  await abre('dl'); await poner({ '#f-athlete': ADMIN, '#f-load': 175 }); await guarda();
  const sin = await marcaDe("function(x){ return x.workoutId === 'dl' && x.athleteId === '" + ADMIN + "'; }");
  check(!(await error()) && sin && sin.load === 175 && !('reps' in sin) && /^Apuntado: 175 kg en Deadlift/.test(await aviso()), 'sin reps se guarda 175 kg a secas, sin campo reps (' + J(sin && { load: sin.load, reps: sin.reps }) + ', «' + (await aviso()) + '»)');
  await abre('dl', sin.id); await poner({ '#f-load-reps': '3' }); await guarda();
  const con = await marcaDe("function(x){ return x.id === '" + sin.id + "'; }");
  check(con.load === 175 && con.reps === 3 && /Marca actualizada: 175 kg × 3/.test(await aviso()), 'al editarla y poner 3 reps queda 175 kg × 3 («' + (await aviso()) + '»)');
  await abre('dl', sin.id); await poner({ '#f-load-reps': '' }); await guarda();
  const otraVez = await marcaDe("function(x){ return x.id === '" + sin.id + "'; }");
  check(otraVez.load === 175 && !('reps' in otraVez), 'y al vaciar el campo las reps desaparecen de la marca (' + J({ load: otraVez.load, reps: otraVez.reps }) + ')');

  console.log('\n== 8 · PR: MÁS REPS CON EL MISMO PESO ES MEJORAR');
  await abre('pm'); await poner({ '#f-athlete': ADMIN, '#f-load': 180, '#f-load-reps': '3' }); await guarda();
  const pr1 = await aviso();
  check(/^¡PR! 180 kg × 3 en Peso muerto/.test(pr1), 'el Jefe hizo 180 × 2 hace una semana: hoy 180 × 3 es PR («' + pr1 + '»)');
  const mia = await marcaDe("function(x){ return x.workoutId === 'pm' && x.date === '" + hoy + "'; }");
  await abre('pm', mia.id); await poner({ '#f-load-reps': '2' }); await guarda();
  const pr2 = await aviso();
  check(/^Marca actualizada: 180 kg × 2 en Peso muerto/.test(pr2), 'corregida a 180 × 2 (igual que la otra vez) ya no es PR («' + pr2 + '»)');
  await abre('pm', mia.id); await poner({ '#f-load-reps': '' }); await guarda();
  const pr3 = await aviso();
  check(/^Marca actualizada: 180 kg en Peso muerto/.test(pr3), 'y sin reps (cuenta 1) tampoco («' + pr3 + '»)');
  await abre('pm', mia.id); await poner({ '#f-load': 182.5, '#f-load-reps': '' }); await guarda();
  const pr4 = await aviso();
  check(/^¡PR! Marca actualizada: 182,5 kg en Peso muerto/.test(pr4), 'más kilos, aunque sea sin reps, sí es PR («' + pr4 + '»)');

  console.log('\n== 9 · HOY: LOS ÚLTIMOS RESULTADOS LLEVAN LAS REPS');
  await p.eval("closeSheet(); go('home'); return 1;"); await sleep(900);
  const casa = await p.text();
  check(/180 kg × 2/.test(casa), 'en Hoy sale «180 kg × 2» (la de Ana)');

  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch(async (e) => {
  console.error('FALLO GENERAL:', e.message);
  try { if (p) await p.stop(); } catch (x) { }
  process.exit(1);
});
