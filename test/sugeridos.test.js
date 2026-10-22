/* Entrenos sugeridos: duración estimada, estado muscular, propuestas a medida y del catálogo.
   Uso: node test/sugeridos.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';
const T = '2026-09-01T10:00:00.000Z';
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hace = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const atleta = (id, name, extra) => Object.assign({ id, name, color: 'red', createdAt: T, updatedAt: T }, extra || {});
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
const tarjetas = (p) => p.eval("return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.sug-card'), function(c){ return { f: c.dataset.formato, min: Number(c.dataset.min), movs: c.dataset.movs.split(','), txt: c.querySelector('.wod-desc').innerText }; }))").then(JSON.parse);
const catalogo = (p) => p.eval("return JSON.stringify(Array.prototype.map.call(document.querySelectorAll('.sug-cat li'), function(l){ return { id: l.dataset.id, min: Number(l.dataset.min) }; }))").then(JSON.parse);
const principales = (p, ids) => p.eval("return JSON.stringify(" + JSON.stringify(ids) + ".map(function(id){ return movPorId(id).mu; }))").then(JSON.parse);
const desliza = async (p, v) => { await p.setValue('#sug-dur', v); await sleep(500); };

(async () => {
  /* Jefe: hoy piernas (front squat, lunges, box jumps) y hace 2 días Cindy (pull-ups, push-ups, squats). */
  const siembra = {
    athletes: { [ADMIN]: atleta(ADMIN, 'Jefe'), colega: atleta('colega', 'Colega') },
    workouts: { piernas: { id: 'piernas', name: 'Piernas', type: 'fortime', scoreType: 'time', modo: 'bloques', esquema: '5', bloques: [{ cant: '10', mov: 'front-squat', carga: '60/40 kg' }, { cant: '20', mov: 'walking-lunge' }, { cant: '15', mov: 'box-jump' }], description: '5 rounds for time of:\n10 Front squats 60/40 kg\n20 Walking lunges\n15 Box jumps', createdBy: ADMIN, createdAt: T, updatedAt: T } },
    results: {
      r1: { id: 'r1', athleteId: ADMIN, workoutId: 'piernas', workoutName: 'Piernas', category: 'custom', scoreType: 'time', seconds: 900, finished: true, date: hace(0), rx: true, createdAt: T, updatedAt: T },
      r2: { id: 'r2', athleteId: ADMIN, workoutId: 'girl:cindy', workoutName: 'Cindy', category: 'girl', scoreType: 'rounds', rounds: 16, reps: 0, date: hace(2), rx: true, createdAt: T, updatedAt: T },
      r3: { id: 'r3', athleteId: 'colega', workoutId: 'girl:fran', workoutName: 'Fran', category: 'girl', scoreType: 'time', seconds: 600, finished: true, date: hace(20), rx: true, createdAt: T, updatedAt: T },
    },
  };
  const p = await movil('Jefe', 9941, siembra, ADMIN);

  console.log('\n== DURACIÓN DE LOS ENTRENOS');
  const dur = JSON.parse(await p.eval("var m = medianasClub(); var f = function(id){ var e = estimaMin(getWorkout(id), m); return e ? [Math.round(e.min * 10) / 10, e.fuente] : null; }; return JSON.stringify({ cindy: f('girl:cindy'), chelsea: f('girl:chelsea'), fran: f('girl:fran'), grace: f('girl:grace'), helen: f('girl:helen'), karen: f('girl:karen'), angie: f('girl:angie'), murph: f('hero:murph'), dt: f('hero:dt-new'), gwen: f('girl:gwen'), piernas: f('piernas') });"));
  console.log('   ' + JSON.stringify(dur));
  check(dur.cindy[0] === 20 && dur.cindy[1] === 'fijo' && dur.chelsea[0] === 30, 'un AMRAP o un EMOM dura lo que dice (Cindy 20, Chelsea 30)');
  check(dur.fran[1] === 'club' && dur.fran[0] === 10, 'Fran usa lo que tarda el club (la marca de 10:00 de Colega)');
  check(dur.grace[1] === 'estimado' && dur.grace[0] >= 3 && dur.grace[0] <= 7, 'Grace se estima en unos 4 min');
  check(dur.helen[0] >= 8 && dur.helen[0] <= 15 && dur.karen[0] >= 7 && dur.karen[0] <= 15, 'Helen y Karen, entre 8 y 15');
  check(dur.angie[0] >= 15 && dur.angie[0] <= 30 && dur.murph[0] >= 40 && dur.dt[0] >= 10 && dur.dt[0] <= 18, 'Angie ~20, DT ~14, Murph más de 40');
  check(dur.gwen === null, 'los de fuerza (Gwen) no tienen duración y no se sugieren');
  check(dur.piernas[1] === 'club' && dur.piernas[0] === 15, 'los nuestros también: Piernas, 15 min por la marca de Jefe');
  check(await p.eval("return POOL_SUG.every(function(x){ return !!movPorId(x.id); })"), 'todos los movimientos del generador existen en el catálogo');

  console.log('\n== ESTADO MUSCULAR');
  const est = JSON.parse(await p.eval("return JSON.stringify(estadoMuscular(me()))"));
  check(est.estado.cua === 'fatigado' && est.estado.glu === 'fatigado' && est.estado.gem === 'fatigado', 'cuádriceps, glúteos y gemelos (piernas de hoy) fatigados');
  check(est.estado.dor === 'recuperando' && est.estado.pec === 'recuperando', 'espalda alta y pecho (Cindy, hace 2 días) recuperando');
  console.log('   valor: ' + Object.keys(est.valor).map(function (g) { return g + ' ' + est.valor[g].toFixed(2); }).join(' · '));
  check(est.estado.hom === 'listo' && est.estado.abd === 'listo' && est.valor.hom > 0.8, 'hombros y abdominales, listos; los hombros, con poca carga en 30 días, piden trabajo');
  check(est.valor.obl === 1 && est.valor.abd < est.valor.hom, 'los oblicuos, sin nada, a tope; los abdominales (carga secundaria de Cindy y las piernas) menos');

  console.log('\n== PERFIL → ENTRENOS SUGERIDOS');
  await p.eval("go('profile'); return 1;"); await sleep(500);
  check(/Entrenos sugeridos/.test(await p.text()) && /Hoy toca/.test(await p.text()), 'el perfil tiene la tarjeta, con lo que toca hoy');
  await p.click('Entrenos sugeridos', 'button.card'); await sleep(900);
  check(await p.eval("return state.view === 'sugeridos' && document.querySelector('#tabbar .tab[data-view=\"profile\"]').getAttribute('aria-current') === 'page'"), 'se abre la pantalla, con la pestaña Perfil marcada');
  check(await p.eval("return document.querySelector('#sug-dur').value === '15' && document.querySelector('#sug-dur-val').textContent === '15 min'"), 'por defecto, 15 min');
  const fill = (g) => p.eval("var e = document.querySelector('.cuerpo path[data-musculo=\"" + g + "\"]'); return e ? e.getAttribute('fill') : null");
  const toca = await p.eval("return gruposQueTocan(estadoMuscular(me())).join(',')");
  check((await fill('cua')) === (await p.eval('return FATIGA.fatigado')) && (await fill('pec')) === (await p.eval('return FATIGA.recuperando')) && (await fill(toca.split(',')[0])) === (await p.eval('return CALOR[3]')), 'el cuerpo pinta fatigado, recuperando y lo que toca (' + toca + ')');
  check(/Descansan:/i.test(await p.text()) && /Toca:/i.test(await p.text()), 'y lo resume: Toca / Descansan / Recuperando');
  let gen = await tarjetas(p);
  gen.forEach((g) => console.log('   [' + g.f + ' ' + g.min + '] ' + g.txt.replace(/\n/g, ' | ')));
  check(gen.length === 3 && gen[0].f === 'amrap' && gen[1].f === 'fortime' && gen[2].f === 'emom', 'propone un AMRAP, un for time y un EMOM');
  check(gen[0].min === 15 && gen[2].min === 15 && Math.abs(gen[1].min - 15) <= 4, 'que duran lo que tienes (el for time, ≈ ' + gen[1].min + ' min)');
  const todos = [].concat.apply([], gen.map((g) => g.movs));
  const mus = await principales(p, todos);
  check(mus.every((m) => m.indexOf('cua') < 0 && m.indexOf('glu') < 0 && m.indexOf('gem') < 0), 'ninguno carga como principal lo fatigado (' + todos.join(', ') + ')');
  check(new Set(todos).size === todos.length, 'y cada propuesta usa movimientos distintos');
  let cat = await catalogo(p);
  console.log('   catálogo: ' + cat.map((c) => c.id + ' ' + c.min).join(' · '));
  check(cat.length >= 3 && cat.every((c) => Math.abs(c.min - 15) <= 5.25), 'el catálogo trae entrenos de unos 15 min (±35 %)');
  check(!cat.some((c) => c.id === 'girl:cindy' || c.id === 'piernas'), 'sin lo que ha hecho esta semana (Cindy, Piernas)');
  const top = await p.eval("var b = sugerenciasCatalogo(me(), estadoMuscular(me()), 15, 0).items[0]; return JSON.stringify({ id: b.w.id, s: b.s })").then(JSON.parse);
  check(top.s > 0, 'el primero del catálogo le viene bien a su estado (' + top.id + ', encaje ' + top.s.toFixed(2) + ')');
  await p.shot('shots/sugeridos-arriba.png');
  await p.eval("document.querySelector('.sug-cat').scrollIntoView({block:'start'}); window.scrollBy(0, -140); return 1;"); await sleep(300);
  await p.shot('shots/sugeridos-catalogo.png');
  await p.eval('window.scrollTo(0,0); return 1;');

  console.log('\n== LA DURACIÓN MANDA');
  await desliza(p, 5);
  gen = await tarjetas(p); cat = await catalogo(p);
  console.log('   5 min: ' + gen.map((g) => g.f + ' ' + g.min + ' [' + g.movs.join(',') + ']').join(' · ') + ' | catálogo ' + cat.map((c) => c.id + ' ' + c.min).join(', '));
  check(await p.eval("return document.querySelector('#sug-dur-val').textContent === '5 min'"), 'el número sigue al deslizador');
  check(gen.length === 2 && gen[0].min === 5 && gen[0].movs.length === 2 && Math.abs(gen[1].min - 5) <= 2.5, 'a 5 min: AMRAP 5 de dos movimientos y un for time corto (sin EMOM)');
  check(/^\d+(-\d+)+ reps for time of:/.test(gen[1].txt) || /rounds for time/.test(gen[1].txt), 'el for time corto es del estilo 21-15-9: "' + gen[1].txt.split('\n')[0] + '"');
  check(cat.every((c) => c.min >= 2.5 && c.min <= 7.5), 'el catálogo, entre 2,5 y 7,5 min');
  await desliza(p, 25);
  gen = await tarjetas(p); cat = await catalogo(p);
  check(gen[0].min === 25 && gen[0].movs.length === 4 && gen[2].min === 25, 'a 25 min: AMRAP 25 de cuatro movimientos y EMOM 25');
  check(cat.length > 0 && cat.every((c) => Math.abs(c.min - 25) <= 8.75), 'y el catálogo, de unos 25');
  await p.go(APP); await sleep(2500);
  await p.eval("closeSheet(); go('sugeridos'); return 1;"); await sleep(700);
  check(await p.eval("return document.querySelector('#sug-dur').value === '25'"), 'la duración elegida se recuerda al volver a abrir');

  console.log('\n== OTRAS IDEAS Y USAR UNA');
  const antes = (await tarjetas(p)).map((g) => g.movs.join(',')).join('|');
  await p.click('Otras ideas'); await sleep(500);
  const despues = (await tarjetas(p)).map((g) => g.movs.join(',')).join('|');
  check(antes !== despues, '"Otras ideas" cambia las propuestas');
  const primera = (await tarjetas(p))[0];
  await p.clickSel('[data-action="sug-usar"][data-i="0"]'); await sleep(800);
  check((await p.sheetTitle()) === 'Nuevo entreno', '"Usar este entreno" abre el formulario');
  const form = JSON.parse(await p.eval("return JSON.stringify({ nombre: document.querySelector('#w-name').value, tipo: document.querySelector('#w-type').value, dur: (document.querySelector('#w-dur')||{}).value, fecha: document.querySelector('#w-date').value, movs: Array.prototype.map.call(document.querySelectorAll('#w-rows .mv-q'), function(q){ return q.dataset.mov; }) })"));
  check(form.nombre === 'Sugerido · AMRAP 25 min' && form.tipo === 'amrap' && form.dur === '25' && form.fecha === hace(0) && form.movs.join(',') === primera.movs.join(','), 'relleno: nombre, AMRAP 25, programado para hoy y los mismos movimientos');
  await p.clickSel('[data-action="save-workout"]'); await sleep(1200);
  const nuevo = JSON.parse(await p.eval("return JSON.stringify(state.workouts.find(function(w){ return w.name === 'Sugerido · AMRAP 25 min'; }) || null)"));
  check(!!nuevo && nuevo.modo === 'bloques' && nuevo.scheduledDate === hace(0) && nuevo.durationMin === 25 && nuevo.createdBy === ADMIN, 'se guarda como entreno nuestro, por bloques y programado para hoy');
  check(await p.eval("return state.view === 'wod'") && /Músculos que trabaja/.test(await p.text()), 'y se abre su ficha');
  await p.eval("go('home'); return 1;"); await sleep(500);
  check(/Sugerido · AMRAP 25 min/i.test(await p.text()), 'sale como WOD de hoy');
  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  console.log('\n== LO QUE NO PUEDE HACER NO SE LO PROPONE');
  const s2 = { athletes: { yo: atleta('yo', 'Novato', { rx: { 'pull-up': { estado: 'no' }, c2b: { estado: 'no' }, hspu: { estado: 'no' } } }) } };
  const q = await movil('Novato', 9942, s2, 'yo');
  await q.eval("go('sugeridos'); return 1;"); await sleep(800);
  check(/todo está fresco/.test(await q.text()), 'sin marcas: avisa de que todo está fresco');
  let vistos = [];
  for (let i = 0; i < 6; i++) { (await tarjetas(q)).forEach((g) => { vistos = vistos.concat(g.movs); }); await q.click('Otras ideas'); await sleep(300); }
  const prohibidos = vistos.filter((id) => ['pull-up', 'c2b', 'hspu', 'muscle-up', 'bar-muscle-up'].indexOf(id) >= 0);
  check(vistos.length > 20 && !prohibidos.length, 'en ' + vistos.length + ' movimientos propuestos no salen pull-ups, C2B ni HSPU («Aún no») ni muscle-ups (no los tiene como Rx)');
  check(new Set(vistos).size >= 12, 'y hay variedad: ' + new Set(vistos).size + ' movimientos distintos');
  await q.shot('shots/sugeridos-lista.png');
  check(!(q.consoleErrors || []).length, 'sin errores de consola' + ((q.consoleErrors || []).length ? ': ' + q.consoleErrors.join(' | ') : ''));
  await q.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
