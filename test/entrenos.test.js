/* Entrenos por bloques (movimientos de la lista), el admin sobre entrenos ajenos y Mis Rx al %.
   Uso: node test/entrenos.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';

function atleta(id, name) { return { id, name, color: 'red', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' }; }
async function movil(nombre, port, siembra, yo) {
  const p = new Phone(nombre, port, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify(siembra.athletes || {}))});
    localStorage.setItem('llorones:workouts', ${JSON.stringify(JSON.stringify(siembra.workouts || {}))});
    localStorage.setItem('llorones:results', ${JSON.stringify(JSON.stringify(siembra.results || {}))});
    ${yo ? "localStorage.setItem('llorones:me', " + JSON.stringify(yo) + ");" : ''}
    return 1;`);
  await p.go(APP);
  await sleep(2500);
  return p;
}
const enter = async (p) => { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await sleep(300); };
const filas = (p) => p.eval("return JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('#w-rows .mv-item')).map(function(it){ return { cant: it.querySelector('.cant').value, mov: it.querySelector('.mv-q').dataset.mov, nombre: it.querySelector('.mv-q').value, carga: it.querySelector('.carga').value }; }))").then(JSON.parse);
const entreno = (p, name) => p.eval("return JSON.stringify(state.workouts.find(function(w){return w.name===" + JSON.stringify(name) + ";}) || null)").then(JSON.parse);

(async () => {
  /* ---------- 1. el admin edita lo de cualquiera (guardado sin category, como en la nube real) ---------- */
  console.log('\n== EL ADMIN EDITA UN ENTRENO DE OTRO');
  const siembra = {
    athletes: { [ADMIN]: atleta(ADMIN, 'Jefe'), carlos: atleta('carlos', 'Carlos') },
    workouts: {
      w1: { id: 'w1', name: '07.09', type: 'amrap', scoreType: 'rounds', durationMin: 12, description: '5 Push press\n5 Front squat\n5 High jump\n5 Mountain climbers\n\nRx 22,5', createdBy: 'carlos', createdAt: '2026-09-07T09:00:00.000Z', updatedAt: '2026-09-07T09:00:00.000Z' },
      w2: { id: 'w2', name: 'Viejo sin dueño', type: 'fortime', scoreType: 'time', timeCapMin: 0, description: '30 Push Ups\n24 Deadlift\n18 Burpee over the bar\n\nRx 60kg', createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z' },
    },
  };
  const p = await movil('Jefe', 9901, siembra, ADMIN);
  await p.eval("closeSheet(); go('wod', {id:'w1'}); return 1;"); await sleep(600);
  check(await p.eval("return !!document.querySelector('[data-action=\"edit-workout\"]')"), 've el botón Editar en el entreno de Carlos');
  await p.clickSel('[data-action="edit-workout"]'); await sleep(700);
  check((await p.sheetTitle()) === 'Editar entreno', 'y se abre la hoja de edición (antes saltaba "lo creó otra persona")');
  check(await p.eval("return document.querySelector('#w-build').hidden && !document.querySelector('#w-texto').hidden"), 'un entreno escrito a mano se abre en modo texto');
  await p.clickSel('[data-action="w-modo"][data-modo="bloques"]'); await sleep(500);
  const conv = await filas(p);
  console.log('   filas convertidas: ' + JSON.stringify(conv));
  check(conv.length === 4 && conv[0].mov === 'push-press' && conv[0].cant === '5' && conv[1].mov === 'front-squat' && conv[3].mov === 'mountain-climber', 'convierte "5 Push press", "5 Front squat" y "5 Mountain climbers" en movimientos de la lista');
  check(conv[2].mov === '' && /high jump/i.test(conv[2].nombre), 'lo que no reconoce se queda escrito tal cual');
  check(await p.eval("return document.querySelector('#w-notas').value === 'Rx 22,5'"), 'la línea "Rx 22,5" pasa a las notas');
  await p.type('#w-name', '07.09 bis');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1200);
  const w1 = await entreno(p, '07.09 bis');
  check(!!w1 && w1.createdBy === 'carlos' && w1.id === 'w1', 'guarda el entreno de Carlos, que sigue siendo suyo');
  check(!!w1 && w1.modo === 'bloques' && w1.bloques.length === 4 && w1.bloques[0].mov === 'push-press', 'y ya está por bloques');
  check(!!w1 && w1.description === 'AMRAP 12 min:\n5 Push presses\n5 Front squats\n5 High jump\n5 Mountain climbers\n\nRx 22,5', 'con el texto generado: ' + JSON.stringify(w1 && w1.description));
  check(await p.eval("return movimientosDe(state.workouts.find(function(w){return w.id==='w1';})).map(function(m){return m.id;}).join(',') === 'push-press,front-squat,mountain-climber'"), 'los movimientos del entreno salen de lo elegido, sin adivinar en el texto');
  check(await p.eval("return state.view === 'wod' && document.querySelectorAll('.rx-chips li').length === 3"), 'la ficha enseña Tus Rx aquí con esos tres');
  // uno viejo sin createdBy: el admin también puede; un atleta normal no
  await p.eval("ACTIONS['edit-workout']({dataset:{id:'w2'}}); return 1;"); await sleep(500);
  check((await p.sheetTitle()) === 'Editar entreno', 'también puede con uno antiguo sin dueño');
  await p.eval("dismissSheet(); setMe('carlos'); render(); return 1;"); await sleep(500);
  await p.eval("ACTIONS['edit-workout']({dataset:{id:'w2'}}); return 1;"); await sleep(500);
  check((await p.sheetTitle()) === null, 'Carlos, que no es admin, no puede con el que no es suyo');
  await p.eval("ACTIONS['edit-workout']({dataset:{id:'w1'}}); return 1;"); await sleep(500);
  check((await p.sheetTitle()) === 'Editar entreno', 'pero sí con el suyo');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  /* ---------- 2. crear un AMRAP eligiendo de la lista ---------- */
  console.log('\n== CREAR UN AMRAP ELIGIENDO MOVIMIENTOS DE LA LISTA');
  await p.eval("setMe('" + ADMIN + "'); go('wods'); return 1;"); await sleep(500);
  await p.clickSel('[data-action="new-workout"]'); await sleep(700);
  check((await p.sheetTitle()) === 'Nuevo entreno', 'se abre el formulario');
  check(await p.eval("return !document.querySelector('#w-build').hidden && document.querySelector('#w-texto').hidden"), 'por defecto se construye eligiendo movimientos');
  await p.type('#w-name', 'Lunes');
  await p.select('#w-type', 'amrap'); await sleep(300);
  check(await p.eval("return document.querySelector('#w-esq-field').hidden"), 'un AMRAP no pide esquema de reps');
  await p.setValue('#w-dur', 15);
  await p.type('#w-rows .mv-item:nth-child(1) .cant', '10');
  await p.clickSel('#w-rows .mv-item:nth-child(1) .mv-q'); await sleep(300);
  check(await p.eval("return !document.querySelector('#w-rows .mv-item:nth-child(1) .mv-list').hidden && document.querySelectorAll('#w-rows .mv-item:nth-child(1) .mv-opt').length > 90 && document.querySelectorAll('#w-rows .mv-item:nth-child(1) .mv-group').length === 7"), 'al tocar el movimiento sale la lista entera, por grupos');
  await p.send('Input.insertText', { text: 'thr' }); await sleep(300);
  const ops = JSON.parse(await p.eval("return JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('#w-rows .mv-item:nth-child(1) .mv-opt')).map(function(b){return b.dataset.mov;}))"));
  console.log('   con "thr": ' + ops.join(', '));
  check(ops[0] === 'thruster' && ops.indexOf('db-thruster') > 0 && ops.indexOf('kb-thruster') > 0 && ops.length <= 8, 'con "thr" filtra en vivo (thruster, DB, KB, cluster, hip thrust) y Thruster va el primero');
  await p.shot('shots/entreno-lista.png');
  await p.clickSel('#w-rows .mv-item:nth-child(1) .mv-opt[data-mov="thruster"]'); await sleep(300);
  check(await p.eval("var q = document.querySelector('#w-rows .mv-item:nth-child(1) .mv-q'); return q.value === 'Thruster' && q.dataset.mov === 'thruster' && document.querySelector('#w-rows .mv-item:nth-child(1) .mv-list').hidden"), 'al elegir queda Thruster y la lista se cierra');
  await p.type('#w-rows .mv-item:nth-child(1) .carga', '43/30 kg');
  await p.clickSel('[data-action="w-row-add"]'); await sleep(300);
  check(await p.eval("return document.querySelectorAll('#w-rows .mv-item').length === 2 && document.activeElement === document.querySelector('#w-rows .mv-item:nth-child(2) .cant')"), '"Añadir movimiento" crea otra fila con el foco en las reps');
  await p.send('Input.insertText', { text: '15' }); await sleep(100);
  await p.type('#w-rows .mv-item:nth-child(2) .mv-q', 'pull-up'); await sleep(300);
  await enter(p);
  check(await p.eval("var q = document.querySelector('#w-rows .mv-item:nth-child(2) .mv-q'); return q.dataset.mov === 'pull-up' && !!document.querySelector('#sheet-root .sheet')"), 'Enter elige la primera opción y NO guarda el formulario a medias');
  await p.clickSel('[data-action="w-row-add"]'); await sleep(200);
  await p.type('#w-rows .mv-item:nth-child(3) .cant', '400');
  await p.type('#w-rows .mv-item:nth-child(3) .mv-q', 'run'); await sleep(300);
  await p.clickSel('#w-rows .mv-item:nth-child(3) .mv-opt[data-mov="run"]'); await sleep(300);
  await p.clickSel('[data-action="w-row-add"]'); await sleep(200);
  await p.type('#w-rows .mv-item:nth-child(4) .cant', '5');
  await p.type('#w-rows .mv-item:nth-child(4) .mv-q', 'Sandbag toss'); await sleep(300);
  check(await p.eval("return !!document.querySelector('#w-rows .mv-item:nth-child(4) .mv-opt.libre')"), 'si no está en la lista ofrece usarlo tal cual');
  await p.clickSel('#w-rows .mv-item:nth-child(4) .mv-opt.libre'); await sleep(300);
  const preview = await p.eval("return document.querySelector('#w-preview').innerText");
  console.log('   vista previa:\n      ' + preview.replace(/\n/g, '\n      '));
  check(preview === 'AMRAP 15 min:\n10 Thrusters 43/30 kg\n15 Pull-ups\n400 m Run\n5 Sandbag toss', 'la vista previa enseña el entreno tal como quedará (plurales, "400 m" en el cardio)');
  await p.type('#w-notas', 'descansa 1 min entre rondas'); await sleep(200);
  await p.shot('shots/entreno-form.png');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1200);
  const lunes = await entreno(p, 'Lunes');
  check(!!lunes && lunes.bloques.length === 4 && lunes.bloques[0].mov === 'thruster' && lunes.bloques[0].carga === '43/30 kg' && lunes.bloques[3].nombre === 'Sandbag toss' && !lunes.bloques[3].mov, 'se guarda con sus bloques');
  check(!!lunes && lunes.description === 'AMRAP 15 min:\n10 Thrusters 43/30 kg\n15 Pull-ups\n400 m Run\n5 Sandbag toss\n\ndescansa 1 min entre rondas', 'y el texto generado, notas incluidas');
  check(await p.eval("return state.view === 'wod' && /Tus Rx aquí/.test(document.querySelector('main').innerText) && document.querySelectorAll('.rx-chips li').length === 3"), 'la ficha enseña Tus Rx aquí con Thruster, Pull-up y Run');
  await p.shot('shots/entreno-ficha.png');
  // se puede reabrir y las filas vuelven tal cual
  await p.clickSel('[data-action="edit-workout"]'); await sleep(600);
  const otraVez = await filas(p);
  check(otraVez.length === 4 && otraVez[0].mov === 'thruster' && otraVez[0].cant === '10' && otraVez[2].cant === '400' && otraVez[3].nombre === 'Sandbag toss', 'al editar vuelven las mismas filas');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  /* ---------- 3. 21-15-9 ---------- */
  console.log('\n== 21-15-9 FOR TIME');
  await p.eval("go('wods'); return 1;"); await sleep(400);
  await p.clickSel('[data-action="new-workout"]'); await sleep(600);
  await p.type('#w-name', 'Fran casera');
  check(!(await p.eval("return document.querySelector('#w-esq-field').hidden")), 'un for time sí pide rondas o esquema');
  await p.clickSel('#w-esq-chips .chip[data-v="21-15-9"]'); await sleep(200);
  check(await p.eval("return document.querySelector('#w-esq').value === '21-15-9'"), 'el chip 21-15-9 rellena el esquema');
  await p.type('#w-rows .mv-item:nth-child(1) .mv-q', 'thruster'); await sleep(250);
  await p.clickSel('#w-rows .mv-item:nth-child(1) .mv-opt[data-mov="thruster"]'); await sleep(200);
  await p.type('#w-rows .mv-item:nth-child(1) .carga', '43/30 kg');
  await p.clickSel('[data-action="w-row-add"]'); await sleep(200);
  await p.type('#w-rows .mv-item:nth-child(2) .mv-q', 'Pull-up'); await sleep(250);   // escrito entero sin elegir: se enlaza solo
  await p.clickSel('#w-name');                                                          // tocar fuera cierra la lista
  await sleep(200);
  check(await p.eval("return !document.querySelector('.mv-item.abierta')"), 'tocar fuera cierra la lista');
  const prev2 = await p.eval("return document.querySelector('#w-preview').innerText");
  check(prev2 === '21-15-9 reps for time of:\nThrusters 43/30 kg\nPull-ups', 'queda "21-15-9 reps for time of:" y los movimientos en plural: ' + JSON.stringify(prev2));
  await p.clickSel('[data-action="save-workout"]'); await sleep(1000);
  const fran = await entreno(p, 'Fran casera');
  check(!!fran && fran.esquema === '21-15-9' && fran.bloques[1].mov === 'pull-up' && fran.description === '21-15-9 reps for time of:\nThrusters 43/30 kg\nPull-ups', 'se guarda el esquema y el Pull-up escrito a mano queda enlazado a la lista');
  // esquema de rondas y validación
  await p.eval("go('wods'); return 1;"); await sleep(400);
  await p.clickSel('[data-action="new-workout"]'); await sleep(600);
  await p.type('#w-name', 'Cinco rondas');
  await p.type('#w-esq', 'cinco'); await sleep(200);
  await p.type('#w-rows .mv-item:nth-child(1) .cant', '12');
  await p.type('#w-rows .mv-item:nth-child(1) .mv-q', 'burpee'); await sleep(250);
  await p.clickSel('#w-rows .mv-item:nth-child(1) .mv-opt[data-mov="burpee"]'); await sleep(200);
  await p.clickSel('[data-action="save-workout"]'); await sleep(600);
  check(/esquema/.test(await p.eval("return document.querySelector('#w-error').textContent")) && !!(await p.sheetTitle()), 'un esquema que no son números no se traga');
  await p.clickSel('#w-esq-chips .chip[data-v="5"]'); await sleep(200);
  check(await p.eval("return document.querySelector('#w-preview').innerText === '5 rounds for time of:\\n12 Burpees'"), 'con "5" queda "5 rounds for time of:"');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1000);
  check(!!(await entreno(p, 'Cinco rondas')), 'y se guarda');

  /* ---------- 4. escribirlo a mano sigue siendo posible ---------- */
  console.log('\n== ESCRIBIRLO A MANO SIGUE SIENDO POSIBLE');
  await p.eval("go('wods'); return 1;"); await sleep(400);
  await p.clickSel('[data-action="new-workout"]'); await sleep(600);
  await p.type('#w-name', 'Raro');
  await p.clickSel('[data-action="save-workout"]'); await sleep(500);
  check(/movimiento/.test(await p.eval("return document.querySelector('#w-error').textContent")), 'sin movimientos no deja guardar');
  await p.type('#w-rows .mv-item:nth-child(1) .cant', '10');
  await p.type('#w-rows .mv-item:nth-child(1) .mv-q', 'burpee'); await sleep(250);
  await p.clickSel('#w-rows .mv-item:nth-child(1) .mv-opt[data-mov="burpee"]'); await sleep(200);
  await p.clickSel('[data-action="w-modo"][data-modo="texto"]'); await sleep(400);
  check(await p.eval("return !document.querySelector('#w-texto').hidden && document.querySelector('#w-desc').value === 'For time:\\n10 Burpees'"), 'al pasar a texto el cuadro viene relleno con lo construido');
  await p.setValue('#w-desc', 'For time:\n10 Burpees\n1 mile of pain');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1000);
  const raro = await entreno(p, 'Raro');
  check(!!raro && raro.modo === 'texto' && !raro.bloques && raro.description === 'For time:\n10 Burpees\n1 mile of pain', 'se guarda como texto, sin bloques');
  check(await p.eval("return movimientosDe(state.workouts.find(function(w){return w.name==='Raro';})).map(function(m){return m.id;}).join(',') === 'burpee'"), 'y los movimientos se siguen adivinando en el texto');

  /* ---------- 5. Mis Rx al porcentaje ---------- */
  console.log('\n== MIS RX AL PORCENTAJE');
  await p.eval("go('rx'); return 1;"); await sleep(500);
  const li = "Array.prototype.slice.call(document.querySelectorAll('.rx-list li')).find(function(l){return l.querySelector('[data-mov=\"thruster\"]');})";
  await p.type('[data-action="rx-num"][data-mov="thruster"]', '60'); await sleep(500);
  check(await p.eval("return (misRx(me()).thruster||{}).kg === 60"), 'apunta 60 kg en Thruster');
  check(await p.eval("return document.querySelector('[data-action=\"rx-pct\"][data-v=\"100\"]').getAttribute('aria-pressed') === 'true' && !" + li + ".querySelector('.pct').textContent"), 'por defecto se ve al 100% y no hay porcentaje debajo');
  await p.clickSel('[data-action="rx-pct"][data-v="70"]'); await sleep(500);
  check(await p.eval("return " + li + ".querySelector('.pct').textContent === '70% → 42 kg'"), 'al 70% enseña "70% → 42 kg" debajo de Thruster');
  await p.type('[data-action="rx-num"][data-mov="thruster"]', '65'); await sleep(400);
  check(await p.eval("return " + li + ".querySelector('.pct').textContent === '70% → 45,5 kg'"), 'y se recalcula al cambiar la carga (65 → 45,5 kg)');
  await p.setValue('[data-action="rx-pct-input"]', 85); await sleep(500);
  check(await p.eval("return " + li + ".querySelector('.pct').textContent === '85% → 55,5 kg'"), 'un porcentaje a mano (85%) también vale: 55,5 kg');
  await p.shot('shots/rx-pct.png');
  await p.eval("go('profile'); go('rx'); return 1;"); await sleep(500);
  check(await p.eval("return state.rxPct === 85 && document.querySelector('[data-action=\"rx-pct-input\"]').value === '85'"), 'el porcentaje elegido se recuerda');
  check(await p.eval("return !document.querySelector('[data-mov=\"box-jump\"]').closest('li').querySelector('.pct').textContent"), 'los movimientos en cm no llevan porcentaje');
  check(await p.eval("return document.querySelectorAll('.rx-list li').length === MOVIMIENTOS.length && MOVIMIENTOS.length >= 100"), 'el catálogo tiene ya ' + (await p.eval('return MOVIMIENTOS.length')) + ' movimientos');
  check(await p.eval("return document.querySelector('[data-mov=\"plank\"]').placeholder === 'p. ej. 2:00'"), 'los de tiempo (plank) sugieren cómo apuntarlo');
  await p.type('#rx-search', 'hspu'); await sleep(300);
  const vivos = await p.eval("return Array.prototype.filter.call(document.querySelectorAll('.rx-list li'), function(l){return l.style.display!=='none';}).map(function(l){return l.querySelector('[data-mov]').dataset.mov;}).join(',')");
  check(vivos === 'hspu,strict-hspu,parallette-hspu', 'el buscador de Mis Rx filtra también por abreviaturas (hspu → ' + vivos + ')');
  check(await p.eval("return Array.prototype.filter.call(document.querySelectorAll('main section.card'), function(s){return s.style.display!=='none';}).length === 2"), 'y esconde los grupos vacíos');
  await p.setValue('#rx-search', ''); await sleep(200);
  check(await p.eval("return !Array.prototype.some.call(document.querySelectorAll('.rx-list li, main section.card'), function(l){return l.style.display==='none';})"), 'al borrarlo vuelven todos');
  await p.type('#rx-search', 'around'); await sleep(300);
  check(await p.eval("return Array.prototype.filter.call(document.querySelectorAll('.rx-list li'), function(l){return l.style.display!=='none';}).length === 1 && document.querySelector('[data-mov=\"around-the-world\"]')"), 'el around the world está en la lista');
  await p.setValue('#rx-search', ''); await sleep(200);

  /* ---------- 6. cabecera bajo la barra de estado ---------- */
  const reglas = await p.eval("return Array.prototype.slice.call(document.styleSheets).filter(function(s){return !s.href;}).map(function(s){return Array.prototype.map.call(s.cssRules, function(r){return r.cssText;}).join('\\n');}).join('\\n')");
  check(/\.topbar\s*\{[^}]*safe-area-inset-top/.test(reglas), 'la cabecera reserva sitio para la hora y la batería del iPhone');
  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
