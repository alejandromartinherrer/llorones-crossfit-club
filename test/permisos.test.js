/* Permisos, PIN y bordes del modelo de convivencia.
   Uso: node test/permisos.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';

function atleta(id, name, extra) { return Object.assign({ id, name, color: 'red', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' }, extra || {}); }
function marca(id, athleteId, workoutId, extra) {
  return Object.assign({ id, athleteId, workoutId, workoutName: workoutId, category: 'custom', scoreType: 'rounds', rounds: 5, reps: 0,
    date: new Date().toISOString().slice(0, 10), rx: false, createdAt: '2026-09-07T10:00:00.000Z', updatedAt: '2026-09-07T10:00:00.000Z' }, extra || {});
}

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

(async () => {
  /* ---------- 1. un club nuevo siempre tiene quien mande ---------- */
  console.log('\n== CLUB RECIÉN ESTRENADO');
  const p1 = await movil('Nuevo', 9801, { athletes: {} });
  let t = await p1.sheetTitle();
  if (t === '¿Quién eres?') { await p1.click('Soy nuevo'); await sleep(600); }
  await p1.type('#a-name', 'Primero');
  await p1.clickSel('[data-action="save-athlete"]');
  await sleep(1200);
  check(await p1.eval('return soyAdmin()'), 'el primero que se da de alta administra el club');
  await p1.click('Perfil', '.tab'); await sleep(700);
  check(/Administración/.test(await p1.text()), 'y ve la sección de administración');
  // el segundo NO hereda el mando
  await p1.click('Cambiar de atleta'); await sleep(700);
  await p1.click('Soy nuevo'); await sleep(700);
  await p1.type('#a-name', 'Segundo');
  await p1.clickSel('[data-action="save-athlete"]'); await sleep(1200);
  check(!(await p1.eval('return soyAdmin()')), 'el segundo entra como atleta normal');
  await p1.stop();

  /* ---------- 2. sin permisos no se toca lo ajeno ---------- */
  console.log('\n== UN ATLETA NORMAL NO PUEDE CON LO AJENO');
  const siembra = {
    athletes: { [ADMIN]: atleta(ADMIN, 'Jefe'), colega: atleta('colega', 'Colega') },
    workouts: { wj: { id: 'wj', name: 'El de Jefe', category: 'custom', type: 'amrap', scoreType: 'rounds', durationMin: 10, description: '10 burpees', createdBy: ADMIN, createdAt: '2026-09-07T09:00:00.000Z' } },
    results: { rj: marca('rj', ADMIN, 'wj'), rc: marca('rc', 'colega', 'wj') },
  };
  const p2 = await movil('Colega', 9802, siembra, 'colega');
  await p2.eval("closeSheet(); return 1;"); await sleep(300);
  check(!(await p2.eval('return soyAdmin()')), 'Colega no es admin');
  check(await p2.eval("return ACTIONS['edit-athlete']({dataset:{id:'" + ADMIN + "'}}) === undefined && !document.querySelector('#a-name')"), 'no puede abrir la ficha de Jefe para renombrarlo');
  await p2.eval("ACTIONS['delete-athlete']({dataset:{id:'" + ADMIN + "'}}); return 1;"); await sleep(700);
  check(await p2.eval("return !!state.athletes.find(function(a){return a.id==='" + ADMIN + "';})"), 'no puede borrar a Jefe');
  await p2.eval("ACTIONS['delete-result']({dataset:{id:'rj'}}); return 1;"); await sleep(700);
  check(await p2.eval("return !!state.results.find(function(r){return r.id==='rj';})"), 'no puede borrar la marca de Jefe');
  await p2.eval("ACTIONS['edit-workout']({dataset:{id:'wj'}}); return 1;"); await sleep(500);
  check(!(await p2.eval("return !!document.querySelector('#w-name')")), 'no puede editar el entreno de Jefe');
  await p2.eval("ACTIONS['delete-workout']({dataset:{id:'wj'}}); return 1;"); await sleep(700);
  check(await p2.eval("return !!state.workouts.find(function(w){return w.id==='wj';})"), 'ni borrarlo');
  await p2.eval("go('home'); return 1;"); await sleep(500);
  await p2.click('Apuntar'); await sleep(800);
  check(await p2.eval("return document.querySelector('#f-athlete').disabled"), 'el selector de atleta está fijado en él');
  await p2.eval("var s=document.querySelector('#f-athlete'); s.disabled=false; var o=document.createElement('option'); o.value='" + ADMIN + "'; s.appendChild(o); s.value='" + ADMIN + "'; return 1;");
  await p2.select('#f-wod', 'girl:cindy');
  await p2.type('#f-rounds', 7); await p2.type('#f-reps', 0);
  await p2.clickSel('[data-action="save-result"]'); await sleep(1200);
  const nuevaDeJefe = await p2.eval("return state.results.filter(function(r){return r.workoutId==='girl:cindy' && r.athleteId==='" + ADMIN + "';}).length");
  check(nuevaDeJefe === 0, 'aunque trastee el selector, la marca no se guarda a nombre de Jefe');
  check(await p2.eval("return state.results.filter(function(r){return r.workoutId==='girl:cindy' && r.athleteId==='colega';}).length === 1"), 'se guarda a su nombre');
  check(!(await p2.eval("return !!document.querySelector('[data-action=\"import\"]')")), 'no tiene botón de importar copia');
  await p2.stop();

  /* ---------- 3. PIN ---------- */
  console.log('\n== PIN');
  const p3 = await movil('Pin', 9803, siembra, 'colega');
  await p3.eval("closeSheet(); return 1;"); await sleep(300);
  const conPin = await p3.eval("return creaPin('4821', '" + ADMIN + "').then(function(x){ return JSON.stringify(x); })");
  await p3.eval("var a = state.athletes.find(function(x){return x.id==='" + ADMIN + "';}); a.pin = " + conPin + "; state.store.set('athletes', a.id, a); return 1;");
  await sleep(800);
  check(JSON.parse(conPin).v === 2 && JSON.parse(conPin).sal, 'el PIN se guarda derivado con PBKDF2 y sal propia');
  await p3.eval("go('profile'); return 1;"); await sleep(700);
  await p3.click('Jefe', '.athlete-card'); await sleep(900);
  check((await p3.sheetTitle()) === 'PIN de Jefe', 'para ser Jefe hay que poner el PIN');
  await p3.type('#pin-valor', '0000');
  await p3.clickSel('[data-action="pin-check"]'); await sleep(1500);
  check(/no es el de Jefe/.test(await p3.eval("return document.querySelector('#pin-error').textContent")), 'un PIN equivocado no pasa');
  check(await p3.eval("return state.meId === 'colega'"), 'y sigue siendo Colega');
  await p3.type('#pin-valor', '4821');
  await p3.clickSel('[data-action="pin-check"]'); await sleep(2000);
  check(await p3.eval("return state.meId === '" + ADMIN + "'"), 'con el PIN correcto sí entra');
  check(await p3.eval("return soyAdmin()"), 'y manda');
  // nadie puede tocar el PIN de otro, ni siendo admin
  await p3.eval("setMe('colega'); render(); return 1;"); await sleep(500);
  await p3.eval("ACTIONS['quitar-pin']({dataset:{id:'" + ADMIN + "'}}); return 1;"); await sleep(800);
  check(await p3.eval("return !!(state.athletes.find(function(a){return a.id==='" + ADMIN + "';})||{}).pin"), 'Colega no puede quitarle el PIN a Jefe');
  await p3.eval("ACTIONS['edit-athlete']({dataset:{id:'colega'}}); return 1;"); await sleep(600);
  check(!(await p3.eval("return !!document.querySelector('#a-pin')")) === false, 'en su propia ficha sí tiene campo de PIN');
  await p3.eval("dismissSheet(); setMe('" + ADMIN + "'); render(); ACTIONS['edit-athlete']({dataset:{id:'colega'}}); return 1;"); await sleep(700);
  check(!(await p3.eval("return !!document.querySelector('#a-pin')")), 'el admin, editando a otro, no ve el campo del PIN');
  await p3.eval("dismissSheet(); return 1;"); await sleep(300);
  await p3.eval("ACTIONS['quitar-pin']({dataset:{id:'" + ADMIN + "'}}); return 1;"); await sleep(900);
  check(!(await p3.eval("return !!(state.athletes.find(function(a){return a.id==='" + ADMIN + "';})||{}).pin")), 'su dueño sí puede quitárselo');
  const copia = await p3.eval("var d = state.store.exportAll(); Object.keys(d.athletes).forEach(function(id){ d.athletes[id] = Object.assign({}, d.athletes[id]); delete d.athletes[id].pin; }); return JSON.stringify(d.athletes).indexOf('pin') < 0;");
  check(copia, 'las copias exportadas no llevan la huella del PIN');
  await p3.stop();

  /* ---------- 4. el club no se queda sin admin ---------- */
  console.log('\n== NO SE PUEDE DEJAR EL CLUB SIN NADIE QUE MANDE');
  const p4 = await movil('Jefe', 9804, siembra, ADMIN);
  await p4.eval("closeSheet(); return 1;"); await sleep(300);
  check(await p4.eval('return soyAdmin()'), 'Jefe administra');
  await p4.eval("ACTIONS['delete-athlete']({dataset:{id:'" + ADMIN + "'}}); return 1;"); await sleep(900);
  check(await p4.eval("return !!state.athletes.find(function(a){return a.id==='" + ADMIN + "';})"), 'no puede borrarse a sí mismo siendo el único admin');
  // el admin sí puede con lo ajeno
  await p4.eval("ACTIONS['delete-result']({dataset:{id:'rc'}}); return 1;"); await sleep(700);
  const hoja = await p4.sheetTitle();
  check(hoja === 'Borrar resultado', 'el admin sí puede borrar una marca ajena (pide confirmación)');
  await p4.clickSel('[data-action="confirm-yes"]'); await sleep(900);
  check(!(await p4.eval("return !!state.results.find(function(r){return r.id==='rc';})")), 'y se borra');
  // borrar entreno arrastra las marcas
  await p4.eval("go('wod',{id:'wj'}); return 1;"); await sleep(700);
  await p4.eval("ACTIONS['delete-workout']({dataset:{id:'wj'}}); return 1;"); await sleep(800);
  const aviso = await p4.eval("return (document.querySelector('.sheet-body')||{}).textContent || ''");
  check(/marca/.test(aviso), 'al borrar un entreno avisa de las marcas que se lleva: "' + aviso.trim().slice(0, 90) + '"');
  await p4.clickSel('[data-action="confirm-yes"]'); await sleep(1200);
  check(await p4.eval("return !state.workouts.length && !state.results.filter(function(r){return r.workoutId==='wj';}).length"), 'y no deja marcas huérfanas puntuando');
  await p4.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
