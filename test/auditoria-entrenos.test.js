/* Auditoría del formulario de entreno (crear y editar): «Se puntúa por» con máximos, texto ⇄ bloques,
   esquema, campos numéricos, cantidades y unidades, alias, plurales, avisos al guardar y marcas de otro tipo.
   Uso: node test/auditoria-entrenos.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const fs = require('fs');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';
const T = '2026-09-01T10:00:00.000Z';
const J = JSON.stringify;

function atleta(id, name) { return { id, name, color: 'red', createdAt: T, updatedAt: T }; }
async function movil(nombre, port, siembra, yo) {
  const p = new Phone(nombre, port, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${J(J(siembra.athletes || {}))});
    localStorage.setItem('llorones:workouts', ${J(J(siembra.workouts || {}))});
    localStorage.setItem('llorones:results', ${J(J(siembra.results || {}))});
    localStorage.setItem('llorones:me', ${J(yo)});
    return 1;`);
  await p.go(APP);
  await sleep(2500);
  await p.eval("if (document.querySelector('#sheet-root').firstChild) closeSheet(); return 1;");
  return p;
}

/* ---------- formulario ---------- */
const filas = (p) => p.eval("return JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('#w-rows .mv-item')).map(function(it){ var s = it.querySelector('.ud-sel'); return { cant: it.querySelector('.cant').value, ud: s.value, chip: it.querySelector('.ud-txt').textContent, elegida: !!s.dataset.elegida, mov: it.querySelector('.mv-q').dataset.mov, nombre: it.querySelector('.mv-q').value, carga: it.querySelector('.carga').value }; }))").then(JSON.parse);
const entreno = (p, name) => p.eval("return JSON.stringify(state.workouts.find(function(w){return w.name===" + J(name) + ";}) || null)").then(JSON.parse);
const entrenoId = (p, id) => p.eval("return JSON.stringify(state.workouts.find(function(w){return w.id===" + J(id) + ";}) || null)").then(JSON.parse);
const preview = (p) => p.eval("return document.querySelector('#w-preview').innerText");
const score = (p) => p.eval("return document.querySelector('#w-score').value");
const desc = (p) => p.eval("return document.querySelector('#w-desc').value");
const val = (p, sel) => p.eval("var e = document.querySelector(" + J(sel) + "); return e ? e.value : null");
const toastTxt = (p) => p.eval("var t = document.querySelector('#toast-root'); return t ? t.innerText : ''");
const limpiaToast = (p) => p.eval("var t = document.querySelector('#toast-root'); if (t) t.innerHTML = ''; return 1;");
const hojaAbierta = (p) => p.eval("return !!document.querySelector('#sheet-root').firstChild");
async function nuevo(p, tipo) {
  await p.eval("if (document.querySelector('#sheet-root').firstChild) dismissSheet(); go('wods'); return 1;"); await sleep(500);
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  if (tipo) { await p.select('#w-type', tipo); await sleep(250); }
}
async function abreEditar(p, id) {
  await p.eval("if (document.querySelector('#sheet-root').firstChild) dismissSheet(); go('wod', { id: " + J(id) + " }); return 1;"); await sleep(600);
  await p.clickSel('[data-action="edit-workout"]'); await sleep(700);
}
/* Fila n: cantidad, texto del movimiento, id a elegir de la lista (false = dejar lo escrito sin elegir) y carga. */
async function fila(p, n, cant, q, mov, carga) {
  if (n > 1) { await p.clickSel('[data-action="w-row-add"]'); await sleep(200); }
  const it = '#w-rows .mv-item:nth-child(' + n + ')';
  if (cant) await p.type(it + ' .cant', cant);
  if (q) {
    await p.type(it + ' .mv-q', q); await sleep(300);
    if (mov === false) await p.eval('cierraListasMov(); document.activeElement.blur(); return 1;');
    else await p.clickSel(it + ' .mv-opt[data-mov="' + mov + '"]');
    await sleep(250);
  }
  if (carga) await p.type(it + ' .carga', carga);
}
const ud = async (p, n, unidad) => { await p.select('#w-rows .mv-item:nth-child(' + n + ') .ud-sel', unidad); await sleep(150); };
const modoTexto = async (p) => { await p.clickSel('[data-action="w-modo"][data-modo="texto"]'); await sleep(300); };
const modoBloques = async (p) => { await p.clickSel('[data-action="w-modo"][data-modo="bloques"]'); await sleep(400); };
async function guarda(p) {
  await p.clickSel('.sheet-foot [data-action="save-workout"]'); await sleep(1200);
  const abierta = await hojaAbierta(p);
  return { abierta, error: abierta ? await p.eval("var e = document.querySelector('#w-error'); return e ? e.innerText : ''") : '' };
}
/* Teclas de verdad, una a una (lo que hace un teclado): el foco se queda donde está. */
async function teclas(p, texto) {
  for (const ch of texto) {
    if (ch.charCodeAt(0) < 128) { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); }
    else await p.send('Input.insertText', { text: ch });
    await sleep(40);
  }
}
async function teclea(p, sel, texto) {
  await p.clickSel(sel);
  await p.eval("document.querySelector(" + J(sel) + ").value = ''; return 1;");
  await teclas(p, texto);
}
const cierraLista = (p) => p.eval('cierraListasMov(); return 1;');
async function seccion(titulo, fn) {
  console.log('\n== ' + titulo);
  try { await fn(); } catch (e) { console.log('   MAL la sección se cortó: ' + e.message); fails.push(titulo + ': ' + e.message); }
}

/* ---------- datos de partida ---------- */
const base = { createdBy: ADMIN, createdAt: T, updatedAt: T, scheduledDate: '', timeCapMin: 0, intervalSec: 0, rounds: 0, workSec: 0, restSec: 0, esquema: '', notas: '' };
const rondas = Object.assign({}, base, { id: 'rondas', name: 'Rondas con marcas', type: 'amrap', scoreType: 'rounds', durationMin: 12, modo: 'bloques', bloques: [{ cant: '10', mov: 'burpee', ud: 'reps' }], description: 'AMRAP 12 min:\n10 Burpees' });
const libre = Object.assign({}, rondas, { id: 'libre', name: 'Sin marcas' });
const una = Object.assign({}, rondas, { id: 'una', name: 'Una marca' });
const emommax = Object.assign({}, base, { id: 'emommax', name: 'EMOM con máx', type: 'emom', scoreType: 'rounds', intervalSec: 60, rounds: 10, modo: 'bloques', bloques: [{ mov: 'pull-up', ud: 'max' }, { cant: '10', mov: 'burpee', ud: 'reps' }], description: 'EMOM 10 min:\nMax Pull-ups\n10 Burpees' });
const bloques = Object.assign({}, base, { id: 'bloques', name: 'AMRAP de bloques', type: 'amrap', scoreType: 'rounds', durationMin: 12, modo: 'bloques', bloques: [{ cant: '10', mov: 'burpee', ud: 'reps' }, { cant: '15', mov: 'pull-up', ud: 'reps' }], description: 'AMRAP 12 min:\n10 Burpees\n15 Pull-ups' });
const marca = (id, atl, extra) => Object.assign({ id, athleteId: atl, workoutId: 'rondas', workoutName: 'Rondas con marcas', category: 'custom', scoreType: 'rounds', date: '2026-10-05', rx: true, notes: '', rounds: 5, reps: 0, createdAt: T, updatedAt: T, createdBy: atl }, extra || {});
const semilla = {
  athletes: { [ADMIN]: atleta(ADMIN, 'Jefe'), santi: atleta('santi', 'Santi'), carlos: atleta('carlos', 'Carlos') },
  workouts: { rondas, libre, una, emommax, bloques },
  results: { r1: marca('r1', 'santi'), r2: marca('r2', 'carlos', { rounds: 4 }), r3: marca('r3', 'santi', { workoutId: 'una', workoutName: 'Una marca' }) },
};

(async () => {
  const p = await movil('Jefe', 9975, semilla, ADMIN);
  const p2 = await movil('Segundo', 9976, semilla, ADMIN);

  /* ---------- 1. «Se puntúa por» con máximos (A1) ---------- */
  await seccion('1. «SE PUNTÚA POR» CON MÁXIMOS', async () => {
    // lo elegido a mano después del máximo no se pisa al tocar otra fila (T2-02, T3-03)
    await nuevo(p, 'amrap'); await p.type('#w-name', 'Max A');
    await fila(p, 1, '', 'pull', 'pull-up'); await ud(p, 1, 'max');
    check(await score(p) === 'reps' && /reps totales/.test(await toastTxt(p)), 'un máx de Pull-ups pasa el AMRAP a reps y lo avisa');
    await fila(p, 2, '400', 'run', 'run');
    await p.select('#w-score', 'rounds');
    await ud(p, 2, 'cal'); await sleep(200);
    check(await score(p) === 'rounds', 'elegir «rondas» a mano y tocar la unidad de otra fila no lo pisa (T2-02)');
    await p.clickSel('#w-rows .mv-item:nth-child(2) [data-action="w-row-del"]'); await sleep(250);
    check(await score(p) === 'rounds', 'ni quitar esa otra fila (T3-03)');
    let g = await guarda(p); let w = await entreno(p, 'Max A');
    check(!g.abierta && !!w && w.scoreType === 'rounds', 'y se guarda por rondas (' + (w && w.scoreType) + ')');

    // quitar el último máximo devuelve el valor del formato y lo avisa (T3-06, T2-11)
    await nuevo(p, 'amrap');
    await fila(p, 1, '', 'run', 'run'); await ud(p, 1, 'max');
    await fila(p, 2, '10', 'pull', 'pull-up');
    check(await score(p) === 'distance', 'un máx de Run puntúa por metros');
    await p.clickSel('#w-rows .mv-item:nth-child(1) [data-action="w-row-del"]'); await sleep(250);
    check(await score(p) === 'rounds' && /Sin máximos, se puntúa por rondas \+ reps/.test(await toastTxt(p)), 'quitar la fila del máx devuelve el AMRAP a rondas y lo avisa (T3-06)');
    await nuevo(p, 'amrap');
    await fila(p, 1, '', 'run', 'run'); await ud(p, 1, 'max');
    await ud(p, 1, 'm'); await sleep(200);
    check(await score(p) === 'rounds', 'pasar el máx a metros también lo devuelve a rondas (T2-11)');
    await nuevo(p, 'amrap');
    await fila(p, 1, '', 'run', 'run'); await ud(p, 1, 'max');
    await p.select('#w-score', 'time'); await limpiaToast(p);
    await ud(p, 1, 'm'); await sleep(200);
    check(await score(p) === 'time' && !(await toastTxt(p)), 'si lo habías cambiado a mano, quitar el máx lo deja como estaba, sin avisos');

    // movimiento escrito entero, sin elegirlo de la lista (T3-04)
    await nuevo(p, 'amrap'); await ud(p, 1, 'max');
    await fila(p, 1, '', 'pull-up', false);
    check(await score(p) === 'reps', 'un «pull-up» escrito entero con máx cuenta al salir del campo (T3-04)');
    await nuevo(p, 'amrap'); await ud(p, 1, 'max');
    await fila(p, 1, '', 'run', false);
    check(await score(p) === 'distance' && /Max meters Run/.test(await preview(p)), '«run» escrito entero con máx va por metros, como dice la vista previa (T3-04)');
    await nuevo(p, 'amrap'); await p.type('#w-name', 'Directo'); await ud(p, 1, 'max');
    await p.type('#w-rows .mv-item:nth-child(1) .mv-q', 'pull-up'); await limpiaToast(p);
    await p.eval("cierraListasMov(); ACTIONS['save-workout']({ dataset: {} }); return 1;"); await sleep(900);
    w = await entreno(p, 'Directo'); const tt = await toastTxt(p);
    check(!!w && w.scoreType === 'reps' && /Entreno creado: Directo\. Con máximos se puntúa por reps totales/.test(tt), 'al guardar sin haber salido del campo se puntúa por reps y el aviso va en el toast final (' + tt + ')');
    // «max» tecleado en la casilla de cantidad y guardar sin salir de ella (en Safari/iOS tocar «Guardar» no quita el foco de la casilla)
    for (const [txt, u, sc, aviso] of [['max', 'max', 'distance', 'Con máximos de distancia se puntúa por metros'], ['max cal', 'maxcal', 'reps', 'Con máximos se puntúa por reps totales']]) {
      await nuevo(p, 'amrap'); await p.type('#w-name', 'Cant ' + txt);
      await fila(p, 1, '', 'run', 'run');
      await teclea(p, '#w-rows .mv-item:nth-child(1) .cant', txt); await limpiaToast(p);
      await p.eval("ACTIONS['save-workout']({ dataset: {} }); return 1;"); await sleep(900);
      const wc = await entreno(p, 'Cant ' + txt), tc = await toastTxt(p);
      check(!!wc && wc.scoreType === sc && wc.bloques.length === 1 && wc.bloques[0].ud === u && !wc.bloques[0].cant && tc.indexOf('Entreno creado: Cant ' + txt + '. ' + aviso) >= 0, '«' + txt + '» tecleado en la casilla y guardado sin salir de ella: ' + u + ' en Run, por ' + sc + ' y con el aviso en el toast (' + J(wc && wc.bloques) + ', ' + (wc && wc.scoreType) + ', ' + tc + ')');
    }

    // modo texto (T3-05, T1-06)
    await nuevo(p, 'amrap'); await p.type('#w-name', 'Texto max');
    await modoTexto(p);
    await p.setValue('#w-desc', 'AMRAP 10 min:\nMax pull-ups');
    check(await score(p) === 'reps' && /reps totales/.test(await toastTxt(p)), 'escrito a mano, «Max pull-ups» pasa el AMRAP a reps y lo avisa (T3-05)');
    g = await guarda(p); w = await entreno(p, 'Texto max');
    check(!g.abierta && !!w && w.modo === 'texto' && w.scoreType === 'reps', 'y se guarda por reps (' + (w && w.scoreType) + ')');
    await nuevo(p, 'interval'); await modoTexto(p);
    await p.setValue('#w-desc', 'Max meters Run');
    check(await score(p) === 'distance', 'unos Intervalos con «Max meters Run» escrito a mano van por metros (T1-06)');
    await p.setValue('#w-desc', '5 intervals of:\n200 m Run');
    check(await score(p) === 'time' && /Sin máximos, se puntúa por tiempo/.test(await toastTxt(p)), 'y quitando el máx vuelven a tiempo');

    // «max cal» tecla a tecla (T2-03, T2-01)
    await nuevo(p, 'amrap');
    await fila(p, 1, '', 'run', 'run');
    const it1 = '#w-rows .mv-item:nth-child(1)', it2 = '#w-rows .mv-item:nth-child(2)', it3 = '#w-rows .mv-item:nth-child(3)';
    await teclea(p, it1 + ' .cant', 'max');
    const mid = await p.eval("var c = document.querySelector(" + J(it1 + ' .cant') + "); var s = document.querySelector(" + J(it1 + ' .ud-sel') + "); return JSON.stringify({ activo: document.activeElement === c, valor: c.value, ud: s.value, esmax: c.closest('.cant-ud').classList.contains('es-max') });").then(JSON.parse);
    check(mid.activo && mid.valor === 'max' && mid.ud === 'm' && !mid.esmax, 'a media palabra («max») la casilla sigue ahí, con el foco y sin tocar la unidad (' + J(mid) + ')');
    await teclas(p, ' cal');
    await p.clickSel(it1 + ' .mv-q'); await sleep(250);
    let f = await filas(p);
    check(f[0].chip === 'máx cal' && f[0].ud === 'maxcal' && f[0].cant === '' && f[0].elegida, '«max cal» tecleado tecla a tecla acaba en «máx cal» al salir de la casilla (T2-03) (' + J(f[0]) + ')');
    check(/Max cal Run/.test(await preview(p)) && await score(p) === 'reps', 'con la vista previa «Max cal Run» y puntuación por reps');
    await cierraLista(p);
    await fila(p, 2, '', 'pull', 'pull-up');
    check(await p.eval("return document.querySelector(" + J(it2 + ' .cant') + ").maxLength") === 16, 'la casilla de cantidad admite 16 caracteres (T2-01)');
    await teclea(p, it2 + ' .cant', 'max calories');
    await p.clickSel(it2 + ' .mv-q'); await sleep(250);
    f = await filas(p);
    check(f[1].chip === 'máx cal' && f[1].cant === '', '«max calories» (12 letras) cabe y acaba en «máx cal» (T2-01) (' + J(f[1]) + ')');
    await cierraLista(p);
    await fila(p, 3, '', 'bike', 'bike');
    await teclea(p, it3 + ' .cant', 'máx cal');
    await p.clickSel(it3 + ' .mv-q'); await sleep(250);
    f = await filas(p);
    check(f[2].chip === 'máx cal' && f[2].cant === '', '«máx cal» con tilde, tecla a tecla, también (' + J(f[2]) + ')');
    await cierraLista(p);
  });

  await seccion('1b. EDITAR UN EMOM CON MÁXIMOS PUNTUADO A MANO', async () => {
    await abreEditar(p2, 'emommax');
    check(await score(p2) === 'rounds', 'se abre por rondas, como se guardó');
    await p2.clickSel('[data-action="w-row-add"]'); await sleep(200);
    await p2.clickSel('#w-rows .mv-item:nth-child(3) [data-action="w-row-del"]'); await sleep(250);
    check(await score(p2) === 'rounds', 'añadir y quitar una fila no lo vuelve a pisar con reps (T2-02)');
    await ud(p2, 2, 'cal');
    check(await score(p2) === 'rounds', 'ni cambiar la unidad de otra fila');
    const g = await guarda(p2); const w = await entrenoId(p2, 'emommax');
    check(!g.abierta && !!w && w.scoreType === 'rounds', 'y se guarda por rondas (' + (w && w.scoreType) + ')');
  });

  /* ---------- 2. texto generado ⇄ bloques (A2, A3, A4) ---------- */
  await seccion('2. TEXTO ESCRITO A MANO Y BLOQUES', async () => {
    await nuevo(p, 'fortime'); await p.type('#w-name', 'Texto A');
    await fila(p, 1, '10', 'burpee', 'burpee');
    await modoTexto(p);
    check(await desc(p) === 'For time:\n10 Burpees', 'al pasar a texto el cuadro viene relleno con lo construido');
    await modoBloques(p);
    await fila(p, 2, '20', 'push-up', 'push-up');
    await modoTexto(p);
    check(await desc(p) === 'For time:\n10 Burpees\n20 Push-ups', 'volver a bloques, añadir una fila y pasar a texto rehace el texto (T1-02)');
    await p.select('#w-type', 'amrap'); await sleep(300);
    const g = await guarda(p); const w = await entreno(p, 'Texto A');
    check(!g.abierta && !!w && w.modo === 'bloques' && w.type === 'amrap' && w.bloques.length === 2 && w.description === 'AMRAP 12 min:\n10 Burpees\n20 Push-ups', 'el texto generado sin tocar se guarda como bloques, con la cabecera del formato nuevo (T1-02) (' + J(w && w.description) + ')');

    await abreEditar(p, 'bloques');
    await p.type('#w-rows .mv-item:nth-child(2) .cant', '25');
    await modoTexto(p);
    check(await desc(p) === 'AMRAP 12 min:\n10 Burpees\n25 Pull-ups', 'editar un entreno de bloques y pasar a mano trae lo construido, no lo guardado (T1-01)');
    await modoBloques(p); await p.setValue('#w-dur', '40'); await modoTexto(p);
    check(/^AMRAP 40 min:\n10 Burpees\n25 Pull-ups$/.test(await desc(p)), 'y con los minutos nuevos');
    const g2 = await guarda(p); const w2 = await entrenoId(p, 'bloques');
    check(!g2.abierta && !!w2 && w2.modo === 'bloques' && w2.durationMin === 40 && w2.description === 'AMRAP 40 min:\n10 Burpees\n25 Pull-ups' && w2.bloques[1].cant === '25', 'se guarda con el cambio y sin perder las filas (T1-01)');

    // un entreno sin movimientos no se guarda (T1-03)
    await nuevo(p, 'fortime'); await p.type('#w-name', 'Sin movs');
    await modoTexto(p);
    check(await desc(p) === 'For time:', 'sin filas el cuadro trae solo la cabecera');
    let g3 = await guarda(p);
    check(g3.abierta && /Escribe el entreno/.test(g3.error) && !(await entreno(p, 'Sin movs')), 'una cabecera sin movimientos no se guarda (T1-03) (' + g3.error + ')');
    await p.setValue('#w-desc', '5 rounds for time of:\n\n  ');
    g3 = await guarda(p);
    check(g3.abierta && /Escribe el entreno/.test(g3.error), 'ni una cabecera con líneas en blanco');
    await p.setValue('#w-desc', '5 rounds for time of:\n10 Burpees');
    g3 = await guarda(p);
    check(!g3.abierta && !!(await entreno(p, 'Sin movs')), 'con una línea de movimiento ya se guarda');
  });

  await seccion('2b. LA CABECERA ESCRITA A MANO PASA AL ESQUEMA Y A LOS MINUTOS', async () => {
    // la cabecera pasa al esquema y a los minutos al volver a bloques (T1-07)
    const cab = async (tipo, texto, previo) => {
      await nuevo(p, tipo); if (previo) await p.type('#w-esq', previo);
      await modoTexto(p); await p.setValue('#w-desc', texto); await modoBloques(p);
      return { esq: await val(p, '#w-esq'), dur: await val(p, '#w-dur'), notas: await val(p, '#w-notas'), pv: await preview(p) };
    };
    let c = await cab('fortime', '21-15-9 reps for time of:\nThrusters 43/30 kg\n30 Push Ups\n400 m Run\nRx: 43/30');
    check(c.esq === '21-15-9' && /^21-15-9 reps for time of:/.test(c.pv) && c.notas === 'Rx: 43/30', 'el 21-15-9 de la cabecera pasa al campo de esquema y la línea Rx a las notas (T1-07) (' + J(c) + ')');
    c = await cab('fortime', '5 rounds for time of:\n10 Burpees');
    check(c.esq === '5', '«5 rounds…» pasa a esquema 5');
    c = await cab('fortime', '3 rondas for time of:\n10 Burpees');
    check(c.esq === '3', '«3 rondas…» pasa a esquema 3');
    c = await cab('interval', '5 intervals of:\n200 m Run');
    check(c.esq === '5', '«5 intervals…» pasa a esquema 5');
    c = await cab('fortime', '21-15-9 reps for time of:\n10 Burpees', '3');
    check(c.esq === '3', 'si el campo ya tenía esquema, no se pisa');
    c = await cab('strength', '5x5:\nBack squat 100 kg');
    check(c.esq === '5x5', 'en Fuerza «5x5:» pasa a esquema 5x5');
    c = await cab('amrap', 'AMRAP 20 min:\n10 Thrusters');
    check(c.dur === '20', '«AMRAP 20 min:» pasa a los minutos');
    c = await cab('emom', 'EMOM 10 min:\n10 Thrusters');
    check(c.esq === '', 'un EMOM no lleva esquema (' + J(c) + ')');
  });

  await seccion('2c. LA LÍNEA RX SE SUMA A LAS NOTAS', async () => {
    await nuevo(p, 'fortime'); await p.type('#w-name', 'Notas Rx');
    await fila(p, 1, '10', 'burpee', 'burpee'); await p.type('#w-notas', 'Descansa 1 min');
    await modoTexto(p); await p.setValue('#w-desc', 'For time:\n10 Burpees\nRx: 43/30');
    await modoBloques(p);
    check(await val(p, '#w-notas') === 'Descansa 1 min · Rx: 43/30', 'la línea Rx se añade a las notas que hubiera, no se pierde (T1-08) (' + await val(p, '#w-notas') + ')');
    await modoTexto(p); await modoBloques(p);
    check(await val(p, '#w-notas') === 'Descansa 1 min · Rx: 43/30', 'y no se duplica al repetir');
  });

  /* ---------- 3. esquema, campos numéricos, filas sin movimiento y fecha (A5, A6, A12, A14) ---------- */
  await seccion('3a. ESQUEMA DE REPS', async () => {
    for (const v of ['5x5', '3 x 10', '5×5', '21-0-9', '99999', '1000', '0']) {
      await nuevo(p, 'fortime'); await p.type('#w-name', 'Esq ' + v);
      await fila(p, 1, '10', 'burpee', 'burpee'); await p.type('#w-esq', v);
      const g = await guarda(p);
      check(g.abierta && /esquema/.test(g.error), 'en For time el esquema «' + v + '» da el error de esquema (T1-04, T1-13)' + (g.abierta ? '' : ' (se guardó)'));
    }
    await nuevo(p, 'fortime'); await p.type('#w-name', 'Esq');
    await fila(p, 1, '10', 'burpee', 'burpee'); await p.type('#w-esq', '5');
    let g = await guarda(p);
    const w = await entreno(p, 'Esq');
    check(!g.abierta && !!w && w.esquema === '5' && /^5 rounds for time of:/.test(w.description), 'el esquema «5» sí vale y queda en «5 rounds for time of:» (' + J(w && w.description) + ')');
    await nuevo(p, 'strength'); await p.type('#w-name', 'Fuerza 5x5');
    await fila(p, 1, '5', 'back-squat', 'back-squat', '100 kg'); await p.type('#w-esq', '5x5');
    g = await guarda(p); const wf = await entreno(p, 'Fuerza 5x5');
    check(!g.abierta && !!wf && wf.esquema === '5x5' && /^5x5:/.test(wf.description), 'en Fuerza el esquema 5x5 sigue valiendo');
    await nuevo(p, 'strength'); await p.type('#w-esq', '5x5'); await p.select('#w-type', 'fortime'); await sleep(250);
    check(await val(p, '#w-esq') === '', 'al pasar de Fuerza a For time, el 5x5 se vacía (T1-04)');
    await nuevo(p, 'fortime'); await p.type('#w-esq', '21-15-9'); await p.select('#w-type', 'interval'); await sleep(250);
    check(await val(p, '#w-esq') === '21-15-9', 'pero un 21-15-9 viaja entre formatos');
    const pur = await p.eval("return JSON.stringify({ a: numerosEsquema('5x5', 'fortime'), b: numerosEsquema('21-15-9', 'fortime'), c: numerosEsquema('5x5', 'strength'), d: cabeceraEntreno({ type: 'fortime', esquema: '5x5' }), e: cabeceraEntreno({ type: 'fortime', esquema: '21-15-9' }), f: numerosEsquema('21 - 15 - 9', 'fortime') })").then(JSON.parse);
    check(J(pur.a) === '[]' && J(pur.b) === '[21,15,9]' && J(pur.c) === '[5,5]' && pur.d === 'For time:' && pur.e === '21-15-9 reps for time of:' && J(pur.f) === '[21,15,9]', 'numerosEsquema parte solo por guiones fuera de Fuerza (' + J(pur) + ')');
  });

  await seccion('3b. CAMPOS NUMÉRICOS VACÍOS O CON DECIMALES', async () => {
    // campos numéricos vacíos o con decimales (T1-05, T1-10)
    const num = async (tipo, nombre, campos) => {
      await nuevo(p, tipo); await p.type('#w-name', nombre); await fila(p, 1, '10', 'burpee', 'burpee');
      for (const k of Object.keys(campos)) await p.setValue(k, campos[k]);
      const g = await guarda(p); return { g, w: await entreno(p, nombre) };
    };
    let r = await num('amrap', 'Dur vacío', { '#w-dur': '' });
    check(!r.g.abierta && r.w.durationMin === 12 && /^AMRAP 12 min:/.test(r.w.description), 'AMRAP con los minutos vacíos: 12, no 1 (T1-05) (' + J(r.w && r.w.durationMin) + ')');
    r = await num('amrap', 'Dur decimal', { '#w-dur': '12.4' });
    check(!r.g.abierta && r.w.durationMin === 12 && /^AMRAP 12 min:/.test(r.w.description), 'AMRAP de 12,4 min: 12 (T1-10) (' + J(r.w && r.w.durationMin) + ')');
    r = await num('emom', 'Emom vacío', { '#w-int': '', '#w-rounds': '' });
    check(!r.g.abierta && r.w.intervalSec === 60 && r.w.rounds === 10 && /^EMOM 10 min:/.test(r.w.description), 'EMOM con «cada» y rondas vacíos: 60 s × 10, no 10 s × 1 (T1-05) (' + J(r.w && [r.w.intervalSec, r.w.rounds]) + ')');
    r = await num('emom', 'Emom decimal', { '#w-rounds': '10.6' });
    check(!r.g.abierta && r.w.rounds === 11 && /^EMOM 11 min:/.test(r.w.description), 'EMOM de 10,6 rondas: 11 (T1-10)');
    r = await num('tabata', 'Tabata vacío', { '#w-work': '', '#w-rest': '', '#w-rounds': '' });
    check(!r.g.abierta && r.w.workSec === 20 && r.w.restSec === 10 && r.w.rounds === 8 && /^Tabata 20\/10 × 8:/.test(r.w.description), 'Tabata con todo vacío: 20/10 × 8 (T1-05) (' + J(r.w && r.w.description) + ')');
    r = await num('tabata', 'Tabata decimal', { '#w-rounds': '8.4' });
    check(!r.g.abierta && r.w.rounds === 8, 'Tabata de 8,4 rondas: 8 (T1-10)');
    r = await num('fortime', 'Cap decimal', { '#w-cap': '20.6' });
    check(!r.g.abierta && r.w.timeCapMin === 21, 'time cap de 20,6 min: 21 (T1-10) (' + J(r.w && r.w.timeCapMin) + ')');
    r = await num('fortime', 'Cap vacío', { '#w-cap': '' });
    check(!r.g.abierta && r.w.timeCapMin === 0, 'time cap vacío: sin cap');
  });

  await seccion('3c. FILAS CON CANTIDAD Y SIN MOVIMIENTO', async () => {
    // filas sin movimiento (T2-12)
    await nuevo(p, 'fortime'); await p.type('#w-name', 'Sin mov');
    await fila(p, 1, '10', 'pull', 'pull-up'); await fila(p, 2, '', ''); await fila(p, 3, '400', '');
    let g = await guarda(p); await cierraLista(p);
    check(g.abierta && g.error === 'A la fila 3 le falta el movimiento.', 'una cantidad sin movimiento da «A la fila 3 le falta el movimiento.» (T2-12) (' + g.error + ')');
    check(!(await entreno(p, 'Sin mov')), 'y no se guarda nada');
    if (!g.abierta) return;
    await p.type('#w-rows .mv-item:nth-child(3) .cant', ''); await p.type('#w-rows .mv-item:nth-child(2) .carga', '20 kg');
    g = await guarda(p); await cierraLista(p);
    check(g.abierta && g.error === 'A la fila 2 le falta el movimiento.', 'una carga sin movimiento también');
    if (!g.abierta) return;
    await p.type('#w-rows .mv-item:nth-child(2) .carga', ''); await ud(p, 2, 'max');
    g = await guarda(p); await cierraLista(p);
    check(g.abierta && g.error === 'A la fila 2 le falta el movimiento.', 'y un máx sin movimiento');
    if (!g.abierta) return;
    await ud(p, 2, 'reps');
    g = await guarda(p); const ws = await entreno(p, 'Sin mov');
    check(!g.abierta && !!ws && ws.bloques.length === 1 && ws.bloques[0].mov === 'pull-up', 'las filas del todo vacías se siguen ignorando (' + g.error + ')');
  });

  await seccion('3d. FECHA', async () => {
    // fecha (A14)
    await nuevo(p, 'fortime'); await p.type('#w-name', 'Fecha vieja'); await fila(p, 1, '10', 'burpee', 'burpee');
    check(await p.eval("return document.querySelector('#w-date').min") === '2000-01-01', 'el campo de fecha lleva min 2000-01-01 (T4-02)');
    await p.setValue('#w-date', '1999-12-31');
    let g = await guarda(p);
    check(g.abierta && g.error === 'Fecha no válida.' && !(await entreno(p, 'Fecha vieja')), 'una fecha anterior a 2000 da «Fecha no válida.» (' + g.error + ')');
    await p.setValue('#w-date', '2026-10-07');
    g = await guarda(p);
    check(!g.abierta && !!(await entreno(p, 'Fecha vieja')), 'y una fecha normal se guarda');
  });

  /* ---------- 4. cantidades, unidades, alias, plurales (A7, A8, A9, A10, A11) ---------- */
  await seccion('4. CANTIDADES Y UNIDADES', async () => {
    await nuevo(p, 'fortime'); await p.type('#w-name', 'Unidades');
    const it1 = '#w-rows .mv-item:nth-child(1)', it2 = '#w-rows .mv-item:nth-child(2)', it3 = '#w-rows .mv-item:nth-child(3)';
    await fila(p, 1, '', 'run', 'run');
    await teclea(p, it1 + ' .cant', '1,5 km'); await p.clickSel(it1 + ' .mv-q'); await sleep(250);
    let f = await filas(p);
    check(f[0].cant === '1500' && f[0].chip === 'm' && f[0].elegida, '«1,5 km» queda en 1500 con el chip «m» al salir de la casilla (T2-09) (' + J(f[0]) + ')');
    await cierraLista(p);
    await fila(p, 2, '', 'pull', 'pull-up');
    await teclea(p, it2 + ' .cant', '400 m'); await p.clickSel(it2 + ' .mv-q'); await sleep(250);
    f = await filas(p);
    check(f[1].cant === '400' && f[1].chip === 'm', '«400 m» queda en 400 con el chip «m» (T2-09) (' + J(f[1]) + ')');
    await ud(p, 2, 'reps'); f = await filas(p);
    check(f[1].cant === '400' && f[1].chip === 'reps' && /400 Pull-ups/.test(await preview(p)), 'elegir «reps» después gana a la «m» escrita (T2-04) (' + J(f[1]) + ')');
    await cierraLista(p);
    await fila(p, 3, '', 'pull', 'pull-up');
    await teclea(p, it3 + ' .cant', '400 m'); await ud(p, 3, 'cal'); f = await filas(p);
    check(f[2].cant === '400' && f[2].chip === 'cal', 'también si se cambia la unidad sin haber salido de la casilla (T2-04) (' + J(f[2]) + ')');
    const g = await guarda(p); const w = await entreno(p, 'Unidades');
    check(!g.abierta && !!w && J(w.bloques.map((b) => b.cant + b.ud)) === '["1500m","400reps","400cal"]', 'lo guardado lleva cada unidad elegida (' + J(w && w.bloques.map((b) => b.cant + b.ud)) + ')');

    // alias (A9)
    const movs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'movimientos.json'), 'utf8'));
    const norm = (t) => String(t || '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const dueno = {}, dup = [];
    movs.forEach((m) => new Set([m.nombre].concat(m.en).map(norm)).forEach((a) => { if (dueno[a] && dueno[a] !== m.id) dup.push(a + ' → ' + dueno[a] + ' / ' + m.id); else dueno[a] = m.id; }));
    check(dup.length === 0, 'ningún nombre ni alias normalizado apunta a dos movimientos' + (dup.length ? ': ' + dup.join(' | ') : ''));
    const sinEnlace = movs.filter((m) => m.ud && m.ud !== 'reps' && dueno[norm(m.id)] !== m.id).map((m) => m.id);
    check(sinEnlace.length === 0, 'todo movimiento con unidad distinta de reps se enlaza escribiendo su id con espacios (T2-05)' + (sinEnlace.length ? ': faltan ' + sinEnlace.join(', ') : ''));
    const en = await p.eval("return JSON.stringify({ sled: (movPorNombre('sled') || {}).id, carry: (movPorNombre('plate carry') || {}).id, push: (movPorNombre('sled push') || {}).id, run: (movPorNombre('Run') || {}).id })").then(JSON.parse);
    check(en.sled === 'sled' && en.carry === 'plate-carry' && en.push === 'sled' && en.run === 'run', '«sled» y «plate carry» escritos enteros se enlazan (' + J(en) + ')');
    await nuevo(p, 'amrap'); await ud(p, 1, 'max');
    await fila(p, 1, '', 'sled', false);
    check(await score(p) === 'distance' && /Max meters Sled push \/ pull/.test(await preview(p)), '«Max sled» se puntúa por metros (T2-05) (' + await score(p) + ')');
    await nuevo(p, 'fortime'); await modoTexto(p);
    await p.setValue('#w-desc', 'For time:\n15 Sled\n10 Burpees'); await modoBloques(p);
    f = await filas(p);
    check(f[0].mov === 'sled' && f[0].cant === '15' && f[0].chip === 'm', '«15 Sled» escrito a mano pasa a 15 m de Sled push / pull (' + J(f[0]) + ')');

    // plurales y unidad en rangos (A10, A11)
    const pl = await p.eval("var m = movPorId('pull-up'); return JSON.stringify(['1', '1-2', '1-3', '1,5', '1.5', '2-3', '10-12', '15', ''].map(function(c){ return plural(m, c); }))").then(JSON.parse);
    check(J(pl) === J(['Pull-up', 'Pull-ups', 'Pull-ups', 'Pull-ups', 'Pull-ups', 'Pull-ups', 'Pull-ups', 'Pull-ups', 'Pull-ups']), 'solo «1» exacto va en singular (T2-06) (' + J(pl) + ')');
    const ln = await p.eval("return JSON.stringify([{ cant: '3-5', mov: 'run', ud: 'm' }, { cant: '10-15', mov: 'bike', ud: 'cal' }, { cant: '3-5', mov: 'plank', ud: 's' }, { cant: '3-5', mov: 'pull-up', ud: 'reps' }, { cant: '400', mov: 'run', ud: 'm' }, { cant: '1,5', mov: 'run', ud: 'm' }].map(lineaBloque))").then(JSON.parse);
    check(J(ln) === J(['3-5 m Run', '10-15 cal Bike', '3-5 s Plank', '3-5 Pull-ups', '400 m Run', '1,5 m Run']), 'la unidad también sale en los rangos (T2-07) (' + J(ln) + ')');
    await nuevo(p, 'fortime'); await fila(p, 1, '3-5', 'run', 'run');
    check(/^3-5 m Run$/m.test(await preview(p)), 'y en la vista previa del formulario («3-5 m Run»)');
  });

  /* ---------- 5. marcas de otro tipo al cambiar «Se puntúa por» (A13) ---------- */
  await seccion('5. CAMBIAR «SE PUNTÚA POR» CON MARCAS DE OTRO TIPO', async () => {
    await abreEditar(p2, 'rondas');
    await p2.select('#w-score', 'time');
    let g = await guarda(p2);
    const btn = await p2.eval("return !!document.querySelector('#w-error [data-action=\"save-workout\"][data-confirma=\"1\"][data-id=\"rondas\"]')");
    check(g.abierta && /Hay 2 marcas apuntadas por rondas \+ reps\. Si lo cambias a tiempo, se quedan aparte en la pizarra hasta que cada uno corrija la suya\./.test(g.error) && btn, 'con 2 marcas por rondas, cambiar a tiempo avisa y ofrece «Guardar igualmente» (' + g.error + ')');
    check((await entrenoId(p2, 'rondas')).scoreType === 'rounds' && await val(p2, '#w-name') === 'Rondas con marcas', 'y mientras tanto no se guarda nada ni se pierde el formulario');
    if (btn) { await p2.clickSel('#w-error [data-action="save-workout"]'); await sleep(1200); }
    check(btn && !(await hojaAbierta(p2)) && (await entrenoId(p2, 'rondas')).scoreType === 'time', '«Guardar igualmente» lo guarda');
    await abreEditar(p2, 'rondas'); g = await guarda(p2);
    check(!g.abierta, 'sin cambiar «Se puntúa por», guardar no avisa de nada (' + g.error + ')');
    await abreEditar(p2, 'rondas'); await p2.select('#w-score', 'rounds'); g = await guarda(p2);
    check(!g.abierta && (await entrenoId(p2, 'rondas')).scoreType === 'rounds', 'volver al tipo de las marcas tampoco avisa: vuelven a contar (' + g.error + ')');
    await abreEditar(p2, 'libre'); await p2.select('#w-score', 'reps'); g = await guarda(p2);
    check(!g.abierta && (await entrenoId(p2, 'libre')).scoreType === 'reps', 'un entreno sin marcas cambia de puntuación sin avisos (' + g.error + ')');
    await abreEditar(p2, 'una'); await p2.select('#w-score', 'reps'); g = await guarda(p2);
    check(g.abierta && /^Hay 1 marca apuntada por rondas \+ reps\. Si lo cambias a reps, se queda aparte en la pizarra hasta que quien la apuntó la corrija\./.test(g.error), 'con una sola marca el aviso va en singular (' + g.error + ')');
    await p2.select('#w-score', 'rounds'); g = await guarda(p2);
    check(!g.abierta && (await entrenoId(p2, 'una')).scoreType === 'rounds', 'y deshaciendo el cambio se guarda sin más (' + g.error + ')');
    // un cambio de formato también cambia «Se puntúa por»: AMRAP → For time con marcas por rondas
    await abreEditar(p2, 'una'); await p2.select('#w-type', 'fortime'); g = await guarda(p2);
    check(g.abierta && /Hay 1 marca apuntada por rondas \+ reps\. Si lo cambias a tiempo/.test(g.error) && (await entrenoId(p2, 'una')).type === 'amrap', 'cambiar el formato a For time avisa igual y no guarda (' + g.error + ')');
  });

  check(!(p.consoleErrors || []).length && !(p2.consoleErrors || []).length, 'sin errores de consola' + (((p.consoleErrors || []).concat(p2.consoleErrors || [])).length ? ': ' + (p.consoleErrors || []).concat(p2.consoleErrors || []).join(' | ') : ''));
  await p.stop(); await p2.stop();
  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
