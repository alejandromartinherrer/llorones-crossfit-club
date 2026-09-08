/* Puntuación coherente con el rendimiento + movimientos y Rx personales.
   Uso: node test/puntos.test.js   (con la app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };

const hoy = new Date().toISOString().slice(0, 10);
const atleta = (id, name) => ({ id, name, color: 'red', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' });
let n = 0;
function marca(athleteId, wod, cat, scoreType, campos, rx) {
  n++;
  return Object.assign({ id: 'r' + n, athleteId, workoutId: wod, workoutName: wod, category: cat, scoreType,
    date: hoy, rx: !!rx, notes: '', createdAt: '2026-09-07T1' + (n % 10) + ':00:00.000Z', updatedAt: '2026-09-07T1' + (n % 10) + ':00:00.000Z' }, campos);
}

(async () => {
  const p = new Phone('Puntos', 9601, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);

  const atletas = { a: atleta('a', 'Ana'), b: atleta('b', 'Bruno'), c: atleta('c', 'Cris'), d: atleta('d', 'Dani') };
  const marcas = {};
  const add = (m) => { marcas[m.id] = m; };
  // AMRAP hero: 20 rondas / 2 rondas / 0 rondas (esta no debería contar)
  add(marca('a', 'hero:nate', 'hero', 'rounds', { rounds: 20, reps: 0 }));
  add(marca('b', 'hero:nate', 'hero', 'rounds', { rounds: 2, reps: 0 }));
  add(marca('c', 'hero:nate', 'hero', 'rounds', { rounds: 0, reps: 0 }));
  // Hero por tiempo: 10 minutos / 20 minutos
  add(marca('a', 'hero:dt-new', 'hero', 'time', { seconds: 600, finished: true }));
  add(marca('b', 'hero:dt-new', 'hero', 'time', { seconds: 1200, finished: true }));
  // Entreno que solo ha hecho una persona
  add(marca('d', 'girl:grace', 'girl', 'time', { seconds: 300, finished: true }));
  // Marca con time cap sin terminar frente a una terminada
  add(marca('a', 'girl:fran', 'girl', 'time', { seconds: 180, finished: true }));
  add(marca('b', 'girl:fran', 'girl', 'time', { seconds: 0, finished: false, reps: 45 }));

  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify(atletas))});
    localStorage.setItem('llorones:results', ${JSON.stringify(JSON.stringify(marcas))});
    localStorage.setItem('llorones:me', 'a');
    return 1;`);
  await p.go(APP);
  await sleep(3000);

  const tabla = JSON.parse(await p.eval("return JSON.stringify(computeStandings('season').map(function(r){ return {n: r.athlete.name, total: r.total, base: r.base, rend: r.rend, rx: r.rx, cat: r.cat, lider: r.lider, marcas: r.count}; }))"));
  console.log('   tabla:', JSON.stringify(tabla));
  const de = (nm) => tabla.find((x) => x.n === nm) || {};

  console.log('\n== UNA MARCA A CERO NO CUENTA');
  check(de('Cris').total === 0 && de('Cris').marcas === 0, 'Cris, con 0 rondas en el Nate, no suma nada (total ' + de('Cris').total + ')');

  console.log('\n== 20 RONDAS NO ES LO MISMO QUE 2');
  // Ana: Nate 5+40+10 +5 lider ; DT 5+40+10+5 ; Fran 5+40+5+5 -> comprobamos que Ana >> Bruno
  check(de('Ana').rend > de('Bruno').rend, 'Ana (20 rondas, 10 min) saca más rendimiento que Bruno (2 rondas, 20 min): ' + de('Ana').rend + ' vs ' + de('Bruno').rend);
  const detalle = JSON.parse(await p.eval(`
    var byWod = {};
    state.results.filter(marcaValida).forEach(function(r){ (byWod[r.workoutId] = byWod[r.workoutId] || []).push(r); });
    var out = {};
    Object.keys(byWod).forEach(function(w){
      var best = {};
      byWod[w].forEach(function(r){ if (!best[r.athleteId] || compareResults(r, best[r.athleteId]) < 0) best[r.athleteId] = r; });
      out[w] = rendimientosDeEntreno(best);
    });
    return JSON.stringify(out);`));
  console.log('   rendimiento por entreno:', JSON.stringify(detalle));
  check(Math.abs(detalle['hero:nate'].a - 1) < 0.001, 'en el Nate, las 20 rondas valen 1 (el máximo)');
  check(Math.abs(detalle['hero:nate'].b - 0.1) < 0.001, 'y las 2 rondas valen 0,1: la décima parte');
  check(!('c' in detalle['hero:nate']), 'las 0 rondas ni aparecen');

  console.log('\n== 10 MINUTOS NO ES LO MISMO QUE 20');
  check(Math.abs(detalle['hero:dt-new'].a - 1) < 0.001, 'los 10 minutos valen 1');
  check(Math.abs(detalle['hero:dt-new'].b - 0.5) < 0.001, 'los 20 minutos valen 0,5: la mitad');
  const nateA = 5 + 40 + 10 + 5, dtA = 5 + 40 + 10 + 5, franA = 5 + 40 + 5 + 5;
  check(de('Ana').total === nateA + dtA + franA, 'Ana suma ' + de('Ana').total + ' (Nate ' + nateA + ' + DT ' + dtA + ' + Fran ' + franA + ')');
  const nateB = 5 + 4 + 10, dtB = 5 + 20 + 10, franB = 5 + Math.round(40 * 0.5 * (45 / 45)) + 5;
  check(de('Bruno').total === nateB + dtB + franB, 'Bruno suma ' + de('Bruno').total + ' (esperado ' + (nateB + dtB + franB) + ')');

  console.log('\n== HACERLO SOLO CUENTA A LA MITAD');
  check(Math.abs(detalle['girl:grace'].d - 0.5) < 0.001, 'Dani, único en Grace, se queda en 0,5');
  check(de('Dani').total === 5 + 20 + 5, 'Dani suma ' + de('Dani').total + ' (5 por la marca + 20 de rendimiento + 5 de benchmark) y no se lleva el bonus de líder');

  console.log('\n== SIN TERMINAR (TIME CAP) NO PASA DE LA MITAD');
  check(detalle['girl:fran'].b <= 0.5 + 0.001 && detalle['girl:fran'].a === 1, 'la marca con cap vale ' + detalle['girl:fran'].b + ' frente al 1 de la terminada');

  console.log('\n== LA APP NO DEJA GUARDAR UN CERO');
  await p.eval("go('home'); return 1;"); await sleep(500);
  await p.click('Apuntar'); await sleep(800);
  await p.select('#f-wod', 'girl:cindy');
  await p.type('#f-rounds', 0); await p.type('#f-reps', 0);
  await p.clickSel('[data-action="save-result"]'); await sleep(900);
  const err = await p.eval("return (document.querySelector('#f-error')||{}).textContent || ''");
  check(/cero no cuenta/i.test(err), 'avisa: "' + err.trim() + '"');
  check(await p.eval("return !!document.querySelector('.sheet')"), 'y no guarda: la hoja sigue abierta');
  await p.type('#f-rounds', 12); await p.type('#f-reps', 3);
  await p.clickSel('[data-action="save-result"]'); await sleep(1200);
  check(!(await p.eval("return !!document.querySelector('.sheet')")), 'con 12 rondas + 3 reps sí guarda');

  console.log('\n== MOVIMIENTOS Y RX PERSONALES');
  const cat = JSON.parse(await p.eval("return JSON.stringify({total: MOVIMIENTOS.length, cats: Array.from(new Set(MOVIMIENTOS.map(function(m){return m.cat;})))})"));
  console.log('   catálogo:', JSON.stringify(cat));
  check(cat.total >= 70, 'el catálogo tiene ' + cat.total + ' movimientos');
  const detectados = JSON.parse(await p.eval("return JSON.stringify({fran: movimientosDe(getWorkout('girl:fran')).map(function(m){return m.es;}), murph: movimientosDe(getWorkout('hero:murph')).map(function(m){return m.es;}), dt: movimientosDe(getWorkout('hero:dt-new')).map(function(m){return m.es;})})"));
  console.log('   detectados:', JSON.stringify(detectados));
  check(detectados.fran.join(',').includes('Thruster') && detectados.fran.join(',').includes('Dominadas'), 'en Fran detecta thruster y dominadas');
  check(detectados.murph.some((x) => /Carrera/.test(x)) && detectados.murph.some((x) => /Flexiones$/.test(x)), 'en Murph detecta carrera y flexiones');
  check(detectados.dt.some((x) => /Peso muerto/.test(x)), 'en DT detecta el peso muerto');
  await p.eval("go('rx'); return 1;"); await sleep(900);
  check(/Mis Rx/.test(await p.text()), 'la pantalla Mis Rx se abre desde Perfil');
  await p.type('input[data-mov="thruster"]', 43); await sleep(900);
  const guardado = await p.eval("return JSON.stringify((JSON.parse(localStorage.getItem('llorones:athletes')).a||{}).rx||{})");
  console.log('   guardado:', guardado);
  check(/"thruster":\{"kg":43\}/.test(guardado.replace(/\s/g, '')), 'guarda 43 kg en thruster');
  await p.eval("var s = document.querySelector('select[data-mov=\"pull-up\"]'); s.value='rx'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1;"); await sleep(900);
  check(/"pull-up":\{"estado":"rx"\}/.test((await p.eval("return JSON.stringify((JSON.parse(localStorage.getItem('llorones:athletes')).a||{}).rx||{})")).replace(/\s/g, '')), 'guarda el estado Rx en dominadas');
  await p.eval("go('wod',{id:'girl:fran'}); return 1;"); await sleep(900);
  const fran = await p.text();
  check(/Tus Rx aquí/.test(fran), 'la ficha de Fran muestra "Tus Rx aquí"');
  check(/43 kg/.test(fran), 'con tus 43 kg de thruster');
  await p.shot('shots/rx.png');
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
