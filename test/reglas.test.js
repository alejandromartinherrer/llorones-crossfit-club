/* Dudas de «Pendiente» decididas el 14/10/2026 (v1.11.6): botones Hoy / Ayer en la fecha al apuntar,
   un escalado no saca más rendimiento que el peor Rx, la semana activa cuenta en el mes de su jueves,
   las cantidades de las filas se validan al guardar y una marca rara (¿una cifra de más?) se avisa.
   Uso: node test/reglas.test.js   (con la app servida en http://127.0.0.1:8765) */
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
const entreno = (id, name, campos) => Object.assign({ id, name, type: 'other', scoreType: 'time', description: name + ':\n10 Burpees', createdBy: ADMIN, createdAt: T, updatedAt: T }, campos);
const marca = (id, athleteId, workoutId, date, extra) => Object.assign({ id, athleteId, workoutId, workoutName: workoutId, category: 'custom', date, rx: true, notes: '', createdAt: T, updatedAt: T }, extra);
const tiempo = (id, quien, wod, date, seconds, rx) => marca(id, quien, wod, date, { scoreType: 'time', finished: true, seconds, rx: rx !== false });
const reps = (id, quien, wod, date, n) => marca(id, quien, wod, date, { scoreType: 'reps', reps: n });

let p = null;
const J = JSON.stringify;
async function abre(wid, editId) {
  await p.eval(`if (document.querySelector('#sheet-root').firstChild) dismissSheet(); openLogResult(${J(wid)}${editId ? ', state.results.find(function(r){ return r.id === ' + J(editId) + '; }), ' + J(editId) : ''}); return 1;`);
  await sleep(500);
}
const poner = async (campos) => { for (const k of Object.keys(campos)) await p.setValue(k, campos[k]); };
const guarda = async () => { await p.clickSel('.sheet-foot [data-action="save-result"]'); await sleep(700); };
const error = () => p.eval("var e = document.querySelector('#f-error'); return e ? e.innerText.trim() : ''");
const aviso = () => p.eval("var e = document.querySelector('#toast-root'); return e ? e.innerText.trim() : ''");
const limpiaAviso = () => p.eval("var t = document.querySelector('#toast-root'); if (t) t.innerHTML = ''; return 1;");
const valor = (sel) => p.eval(`var e = document.querySelector(${J(sel)}); return e ? e.value : null`);
const marcas = (fn) => p.eval(`return JSON.stringify(state.results.filter(${fn}))`).then(JSON.parse);
const chips = () => p.eval("return JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.fecha-chips .chip')).map(function(b){ return [b.textContent.trim(), b.getAttribute('aria-pressed')]; }))").then(JSON.parse);

(async () => {
  const S = {
    athletes: atletas(['a', 'b', 'c', 'd', 'e', ADMIN]),
    workouts: porId([
      entreno('ft', 'Fran a medias', { type: 'fortime', scoreType: 'time' }),
      entreno('rp', 'Max burpees', { type: 'amrap', scoreType: 'reps', durationMin: 10 }),
      entreno('lib', 'Libre', { scoreType: 'reps' }),
      entreno('sem', 'Semanas', { scoreType: 'reps' }),
      entreno('dist', 'Correr', { type: 'amrap', scoreType: 'distance', durationMin: 30 }),
      entreno('pm', 'Peso muerto', { type: 'strength', scoreType: 'load', esquema: '5x1' }),
    ]),
    results: porId([
      // Fran a medias: Ana Rx 20:00, Cris Rx 15:00 y Bruno escalado en 10:00
      tiempo('fa', 'a', 'ft', hace(3), 1200), tiempo('fc', 'c', 'ft', hace(3), 900), tiempo('fb', 'b', 'ft', hace(3), 600, false),
      // Max burpees: Dani, 158
      reps('rd', 'd', 'rp', hace(2), 158),
      // Eva, en «Semanas»: lun 28/09, mar 29/09 y vie 02/10/2026 (su jueves, el 1/10) y vie 1, sáb 2 y dom 3/05/2026 (su jueves, el 30/04)
      ...['2026-09-28', '2026-09-29', '2026-10-02', '2026-05-01', '2026-05-02', '2026-05-03'].map((f, i) => reps('se' + i, 'e', 'sem', f, 10)),
    ]),
  };
  p = new Phone('Reglas', 9955, { theme: 'dark', sinNube: true });
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

  console.log('\n== 1 · FECHA AL APUNTAR: «HOY» Y «AYER» A UN TOQUE');
  await abre('lib');
  check(J(await chips()) === J([['Hoy', 'true'], ['Ayer', 'false']]) && (await valor('#f-date')) === hoy, 'la hoja propone hoy, con «Hoy» marcado y «Ayer» al lado: ' + J(await chips()));
  await p.clickSel('.fecha-chips [data-dias="1"]'); await sleep(200);
  check((await valor('#f-date')) === hace(1) && J(await chips()) === J([['Hoy', 'false'], ['Ayer', 'true']]), '«Ayer» pone la fecha de ayer (' + (await valor('#f-date')) + ') y queda marcado');
  await poner({ '#f-date': hace(4) });
  check(J(await chips()) === J([['Hoy', 'false'], ['Ayer', 'false']]), 'con otra fecha a mano no queda ninguno marcado');
  await p.clickSel('.fecha-chips [data-dias="0"]'); await sleep(200);
  check((await valor('#f-date')) === hoy, '«Hoy» la devuelve a hoy');
  await p.clickSel('.fecha-chips [data-dias="1"]'); await sleep(200);
  await poner({ '#f-reps': 20 }); await guarda();
  const ayer = await marcas("function(r){ return r.workoutId === 'lib'; }");
  check(ayer.length === 1 && ayer[0].date === hace(1), 'guardada con «Ayer», la marca queda con fecha ' + (ayer[0] || {}).date + ' (ayer: ' + hace(1) + ')');
  await abre('lib', ayer[0].id);
  check(J(await chips()) === J([['Hoy', 'false'], ['Ayer', 'true']]), 'al editarla sale marcado «Ayer»');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  console.log('\n== 2 · RENDIMIENTO: UN ESCALADO NO SACA MÁS QUE EL PEOR RX');
  const rend = JSON.parse(await p.eval(`var t = function(id, s, rx){ return { athleteId: id, scoreType: 'time', finished: true, seconds: s, rx: rx }; };
    var redondea = function(o){ var x = {}; Object.keys(o).forEach(function(k){ x[k] = Math.round(o[k] * 1000) / 1000; }); return x; };
    return JSON.stringify({
      mezcla: redondea(rendimientosDeEntreno({ a: t('a', 1200, true), c: t('c', 900, true), b: t('b', 600, false) })),
      todosEsc: redondea(rendimientosDeEntreno({ b: t('b', 600, false), d: t('d', 1200, false) })),
      rxCap: redondea(rendimientosDeEntreno({ a: { athleteId: 'a', scoreType: 'time', finished: false, reps: 50, seconds: 900, rx: true }, b: t('b', 600, false) })),
      rondas: redondea(rendimientosDeEntreno({ a: { athleteId: 'a', scoreType: 'rounds', rounds: 10, reps: 0, rx: true }, b: { athleteId: 'b', scoreType: 'rounds', rounds: 12, reps: 0, rx: false } })),
      escPeor: redondea(rendimientosDeEntreno({ a: { athleteId: 'a', scoreType: 'rounds', rounds: 10, reps: 0, rx: true }, b: { athleteId: 'b', scoreType: 'rounds', rounds: 5, reps: 0, rx: false } })),
      quality: redondea(rendimientosDeEntreno({ a: { athleteId: 'a', scoreType: 'done', rx: true }, b: { athleteId: 'b', scoreType: 'done', rx: false } })),
    });`));
  console.log('   ', J(rend));
  check(rend.mezcla.a === 0.5 && rend.mezcla.c === 0.667 && rend.mezcla.b === 0.5, 'Rx 20:00, Rx 15:00 y escalado 10:00: el escalado se queda en lo del peor Rx (0,5), no en 1');
  check(rend.todosEsc.b === 1 && rend.todosEsc.d === 0.5, 'sin ningún Rx, los escalados se miden entre ellos como siempre (1 y 0,5)');
  check(rend.rxCap.a === 0.5 && rend.rxCap.b === 0.5, 'un Rx con time cap (0,5) también pone el tope al escalado que terminó');
  check(rend.rondas.a === 0.833 && rend.rondas.b === 0.833, 'en rondas: escalado 12 frente a Rx 10, los dos con 10/12');
  check(rend.escPeor.a === 1 && rend.escPeor.b === 0.5, 'un escalado por debajo del peor Rx no cambia (0,5)');
  check(rend.quality.a === 0.5 && rend.quality.b === 0.5, 'en un For quality todos siguen con la mitad');
  const pts = JSON.parse(await p.eval("return JSON.stringify(computeStandings('season').filter(function(r){ return ['a','b','c'].indexOf(r.athlete.id) >= 0; }).map(function(r){ return [r.athlete.id, r.rend, r.rx, r.lider]; }))"));
  const de = (id) => (pts.find((x) => x[0] === id) || []);
  check(de('a')[1] === 20 && de('c')[1] === 27 && de('b')[1] === 20, 'en la clasificación: Ana 20, Cris 27 y Bruno (escalado, el más rápido) 20, no 40 (' + J(pts) + ')');
  const tablero = JSON.parse(await p.eval("return JSON.stringify(wodBoard('ft').map(function(r){ return r.athleteId; }))"));
  check(J(tablero) === J(['c', 'a', 'b']), 'la pizarra sigue igual: Cris, Ana y Bruno (' + tablero.join(', ') + ')');

  console.log('\n== 3 · SEMANA ACTIVA: CUENTA ENTERA EN EL MES DE SU JUEVES');
  const semanas = JSON.parse(await p.eval(`window.__hoyDeVerdad = todayISO;
    var eva = function(periodo, dia){ todayISO = function(){ return dia; }; var r = computeStandings(periodo).find(function(x){ return x.athlete.id === 'e'; }); return [r.weeks, r.count]; };
    var out = { oct: eva('month', '2026-10-14'), sep: eva('month', '2026-09-15'), may: eva('month', '2026-05-20'), abr: eva('month', '2026-04-20'), semana: eva('week', '2026-10-01'), temporada: eva('season', '2026-10-14') };
    todayISO = window.__hoyDeVerdad;
    out.restaurado = todayISO() === ${J(hoy)};
    return JSON.stringify(out);`));
  console.log('   ', J(semanas));
  check(semanas.oct[0] === 5 && semanas.oct[1] === 1, 'octubre: la semana del 28/09 al 4/10 (jueves 1/10) da +5 con sus tres días, aunque solo uno es de octubre ([semanas, marcas] = ' + J(semanas.oct) + ')');
  check(semanas.sep[0] === 0 && semanas.sep[1] === 2, 'septiembre: esa semana no es suya; las dos marcas sí cuentan (' + J(semanas.sep) + ')');
  check(semanas.may[0] === 0 && semanas.may[1] === 3, 'mayo: vie 1, sáb 2 y dom 3 son de la semana del jueves 30/04, así que en mayo no hay +5 (' + J(semanas.may) + ')');
  check(semanas.abr[0] === 5 && semanas.abr[1] === 0, 'abril: esa semana da +5 aunque sus marcas sean de mayo (' + J(semanas.abr) + ')');
  check(semanas.semana[0] === 5, '«Semana» no cambia: la de los tres días da +5 (' + J(semanas.semana) + ')');
  check(semanas.temporada[0] === 10 && semanas.abr[0] + semanas.may[0] + semanas.sep[0] + semanas.oct[0] === semanas.temporada[0], 'la temporada da +10 y es la suma de los meses');
  check(semanas.restaurado, 'y la fecha de hoy vuelve a ser la de verdad');

  console.log('\n== 4 · CANTIDADES DE LAS FILAS: SOLO NÚMEROS, RANGOS O ♀/♂');
  const cv = JSON.parse(await p.eval("var l = ['10', '1,5', '2.5', '10-15', '21-15-9', '15/12', ' 3 - 5 ', '15 kg', '5k', 'abc', '0', '0-5', '10-', '3x10', '-5']; var o = {}; l.forEach(function(x){ o[x] = cantValida(x); }); return JSON.stringify(o);"));
  console.log('   ', J(cv));
  check(['10', '1,5', '2.5', '10-15', '21-15-9', '15/12', ' 3 - 5 '].every((x) => cv[x] === true), 'valen 10, 1,5, 2.5, 10-15, 21-15-9, 15/12 y « 3 - 5 »');
  check(['15 kg', '5k', 'abc', '0', '0-5', '10-', '3x10', '-5'].every((x) => cv[x] === false), 'no valen «15 kg», «5k», «abc», «0», «0-5», «10-», «3x10» ni «-5»');
  await p.eval("if (document.querySelector('#sheet-root').firstChild) dismissSheet(); go('wods'); return 1;"); await sleep(500);
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  await p.type('#w-name', 'Cantidades');
  const fila = async (n, cant, q, mov) => {
    if (n > 1) { await p.clickSel('[data-action="w-row-add"]'); await sleep(200); }
    const it = '#w-rows .mv-item:nth-child(' + n + ')';
    await p.type(it + ' .cant', cant);
    await p.type(it + ' .mv-q', q); await sleep(300);
    await p.clickSel(it + ' .mv-opt[data-mov="' + mov + '"]'); await sleep(250);
  };
  await fila(1, '15/12', 'push-up', 'push-up');
  await fila(2, '5k', 'run', 'run');
  const nW = await p.eval('return state.workouts.length');
  await p.clickSel('.sheet-foot [data-action="save-workout"]'); await sleep(900);
  const errW = await p.eval("var e = document.querySelector('#w-error'); return e ? e.innerText.trim() : ''");
  const foco = await p.eval("var a = document.activeElement; return a && a.classList.contains('cant') ? Array.prototype.indexOf.call(document.querySelectorAll('#w-rows .cant'), a) + 1 : 0");
  check(/^La cantidad de la fila 2 \(«5k»\) no vale/.test(errW) && /15\/12/.test(errW) && /La carga va en su casilla/.test(errW), 'con «5k» en la fila 2 no se guarda: «' + errW + '»');
  check(foco === 2 && (await p.eval('return state.workouts.length')) === nW, 'el foco va a la cantidad de la fila 2 y no se crea el entreno');
  await p.type('#w-rows .mv-item:nth-child(2) .cant', '5000');
  await p.clickSel('.sheet-foot [data-action="save-workout"]'); await sleep(1200);
  const creado = JSON.parse(await p.eval("var w = state.workouts.find(function(x){ return x.name === 'Cantidades'; }); return JSON.stringify(w ? w.bloques : null)"));
  check(creado && creado[0].cant === '15/12' && creado[1].cant === '5000', 'con «5000» se guarda, y el «15/12» de la fila 1 vale: ' + J(creado));
  await p.eval("if (document.querySelector('#sheet-root').firstChild) dismissSheet(); go('wods'); return 1;"); await sleep(500);
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  await p.type('#w-name', 'Pasado a texto');
  await fila(1, '3x10', 'push-up', 'push-up');
  await p.clickSel('[data-action="w-modo"][data-modo="texto"]'); await sleep(300);
  await p.clickSel('.sheet-foot [data-action="save-workout"]'); await sleep(1200);
  const aTexto = JSON.parse(await p.eval("var w = state.workouts.find(function(x){ return x.name === 'Pasado a texto'; }); return JSON.stringify(w ? { modo: w.modo, description: w.description, bloques: w.bloques || null } : null)"));
  check(aTexto && aTexto.modo === 'texto' && /3x10 Push-ups/.test(aTexto.description) && !aTexto.bloques, 'en modo texto vale lo escrito: «3x10» pasado a texto sin tocarlo se guarda como texto, no como filas (' + J(aTexto) + ')');

  console.log('\n== 5 · MARCA RARA: ¿UNA CIFRA DE MÁS?');
  const jefeRp = () => marcas("function(r){ return r.workoutId === 'rp' && r.athleteId === " + J(ADMIN) + "; }");
  await abre('rp'); await poner({ '#f-reps': 1580 }); await guarda();
  let e = await error();
  check(/^¿Seguro\? 1580 reps es más del triple de la mejor marca del club en este entreno \(158 reps\)\. Guardar igualmente$/.test(e), '1580 con la mejor en 158: «' + e + '»');
  check((await jefeRp()).length === 0, 'y no se guarda todavía');
  await limpiaAviso();
  await p.clickSel('#f-error [data-action="save-result"][data-rara="1"]'); await sleep(700);
  let mias = await jefeRp();
  check(mias.length === 1 && mias[0].reps === 1580 && /^Apuntado: 1580 reps/.test(await aviso()), '«Guardar igualmente» la guarda (' + J(mias.map((r) => r.reps)) + ', «' + (await aviso()) + '»)');
  await abre('rp'); await poner({ '#f-reps': 400 }); await guarda();
  e = await error();
  check(/Ese día ya tienes una marca en Max burpees: 1580 reps/.test(e), 'otra el mismo día: primero ofrece cambiar la de 1580 («' + e + '»)');
  await p.clickSel('#f-error [data-action="save-result"]'); await sleep(700);
  mias = await jefeRp();
  check(mias.length === 1 && mias[0].reps === 400 && !(await error()), 'cambiada por 400: su propia marca de 1580 no cuenta de referencia, así que no avisa (' + J(mias.map((r) => r.reps)) + ')');
  await abre('rp'); await poner({ '#f-reps': 600 }); await guarda();
  await p.clickSel('#f-error [data-action="save-result"]'); await sleep(700);
  e = await error();
  const conReemplazo = await p.eval("var b = document.querySelector('#f-error [data-action=\"save-result\"][data-rara=\"1\"]'); return b ? b.dataset.reemplaza || '' : null");
  check(/^¿Seguro\? 600 reps es más del triple/.test(e) && conReemplazo === mias[0].id, 'cambiarla por 600 (más del triple de 158) avisa, y el botón sigue sabiendo qué marca cambia');
  await p.clickSel('#f-error [data-action="save-result"][data-rara="1"]'); await sleep(700);
  mias = await jefeRp();
  check(mias.length === 1 && mias[0].reps === 600 && mias[0].id === conReemplazo, 'y «Guardar igualmente» la cambia sin duplicarla (' + J(mias.map((r) => r.reps)) + ')');
  await abre('ft'); await poner({ '#f-m': 2, '#f-s': 0 }); await guarda();
  e = await error();
  check(/^¿Seguro\? 2:00 es menos de un tercio del mejor tiempo del club en este entreno \(10:00\)/.test(e), 'en tiempo, 2:00 con el mejor en 10:00: «' + e + '»');
  await poner({ '#f-m': 4 }); await guarda();
  check(!(await error()) && (await marcas("function(r){ return r.workoutId === 'ft' && r.athleteId === " + J(ADMIN) + "; }")).length === 1, '4:00 (más de un tercio) se guarda sin aviso');
  await abre('dist'); await poner({ '#f-meters': 60000 }); await guarda();
  e = await error();
  check(/^¿Seguro\? Más de 50\.000 metros es mucho para una marca/.test(e), 'sin marcas con las que comparar, 60.000 m pasa del tope: «' + e + '»');
  await poner({ '#f-meters': 42195 }); await guarda();
  check(!(await error()), 'un maratón (42.195 m) se guarda sin aviso');
  await abre('pm'); await poner({ '#f-load': 450 }); await guarda();
  e = await error();
  check(/^¿Seguro\? Más de 400 kg es mucho para una marca/.test(e), '450 kg: «' + e + '»');
  await poner({ '#f-date': hace(1) });
  check(!(await error()), 'y el aviso se va al cambiar la fecha, como el de «Cambiarla por esta»');
  await p.eval("dismissSheet(); return 1;");

  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch(async (e) => {
  console.error('FALLO GENERAL:', e.message);
  try { if (p) await p.stop(); } catch (x) { }
  process.exit(1);
});
