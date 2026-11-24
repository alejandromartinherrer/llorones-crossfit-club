/* Datos graciosos (v1.14.0): en Perfil, lo que llevas corrido, levantado y saltado, contado con cosas de la vida.
   Cuentas exactas con marcas sembradas, la tarjeta de Perfil, las pestañas Tú / La cuadrilla y los periodos.
   Uso: node test/datos.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const J = JSON.stringify;
const ADMIN = 'mtr14k1bb9bg49';
const T = '2026-09-01T10:00:00.000Z';
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hoy = iso(new Date());
const atleta = (id, name, rx) => Object.assign({ id, name, color: 'red', createdAt: T, updatedAt: T }, rx ? { rx } : {});
const entreno = (id, o) => Object.assign({ id, name: id, modo: 'bloques', scheduledDate: hoy, createdBy: ADMIN, createdAt: T, updatedAt: T, esquema: '' }, o);
const marca = (id, athleteId, workoutId, o) => Object.assign({ id, athleteId, workoutId, workoutName: workoutId, category: 'custom', date: hoy, rx: true, notes: '', createdAt: T, updatedAt: T }, o);

async function movil(nombre, port, siembra, yo) {
  const p = new Phone(nombre, port, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${J(J(siembra.athletes))});
    localStorage.setItem('llorones:workouts', ${J(J(siembra.workouts))});
    localStorage.setItem('llorones:results', ${J(J(siembra.results))});
    localStorage.setItem('llorones:me', ${J(yo)}); return 1;`);
  await p.go(APP); await sleep(2500);
  await p.eval('closeSheet(); return 1;');
  return p;
}

(async () => {
  const siembra = {
    athletes: {
      [ADMIN]: atleta(ADMIN, 'Jefe', { deadlift: { kg: 100 }, 'box-jump': { cm: 50 } }),
      colega: atleta('colega', 'Colega'),
      nuevo: atleta('nuevo', 'Nuevo'),
    },
    workouts: {
      // AMRAP: una ronda son 400 m, 10 box jumps y 5 deadlifts a 60/40
      wa: entreno('wa', { type: 'amrap', scoreType: 'rounds', durationMin: 10,
        bloques: [{ cant: '400', mov: 'run', ud: 'm' }, { cant: '10', mov: 'box-jump', ud: 'reps' }, { cant: '5', mov: 'deadlift', ud: 'reps', carga: '60/40' }],
        description: 'AMRAP 10 min:\n400 m Run\n10 Box jumps\n5 Deadlifts 60/40' }),
      // For time 21-15-9 con las filas sin cantidad: 45 de cada
      wb: entreno('wb', { type: 'fortime', scoreType: 'time', esquema: '21-15-9',
        bloques: [{ cant: '', mov: 'thruster', ud: 'reps', carga: '40/30' }, { cant: '', mov: 'pull-up', ud: 'reps' }],
        description: '21-15-9 reps for time of:\nThrusters 40/30\nPull-ups' }),
      // EMOM por kilos: 10 minutos de 3 deadlifts
      wc: entreno('wc', { type: 'emom', scoreType: 'load', intervalSec: 60, rounds: 10,
        bloques: [{ cant: '3', mov: 'deadlift', ud: 'reps' }], description: 'EMOM 10 min:\n3 Deadlifts' }),
      // la escalera 21-15-9 escrita fila a fila: ya lleva el esquema, no se multiplica por tres
      wd: entreno('wd', { type: 'fortime', scoreType: 'time', esquema: '21-15-9',
        bloques: [{ cant: '21', mov: 'wall-ball', ud: 'reps', carga: '9/6' }, { cant: '21', mov: 'burpee', ud: 'reps' }, { cant: '15', mov: 'wall-ball', ud: 'reps', carga: '9/6' },
          { cant: '15', mov: 'burpee', ud: 'reps' }, { cant: '9', mov: 'wall-ball', ud: 'reps', carga: '9/6' }, { cant: '9', mov: 'burpee', ud: 'reps' }],
        description: 'For time:\n21 Wall balls 9/6\n21 Burpees\n15 Wall balls 9/6\n15 Burpees\n9 Wall balls 9/6\n9 Burpees' }),
      // EMOM de 20 min por tiempo, con un «14:00:00» apuntado por un 14:00
      we: entreno('we', { type: 'emom', scoreType: 'time', intervalSec: 120, rounds: 10,
        bloques: [{ cant: '15', mov: 'bike', ud: 'cal' }], description: 'EMOM 20 min:\n15 cal Bike' }),
    },
    results: {
      r1: marca('r1', ADMIN, 'wa', { scoreType: 'rounds', rounds: 3, reps: 12 }),
      r2: marca('r2', ADMIN, 'wb', { scoreType: 'time', seconds: 300, finished: true }),
      r3: marca('r3', ADMIN, 'wc', { scoreType: 'load', load: 120 }),
      r4: marca('r4', ADMIN, 'wd', { scoreType: 'time', seconds: 600, finished: true }),
      r5: marca('r5', ADMIN, 'girl:cindy', { workoutName: 'Cindy', category: 'girl', scoreType: 'rounds', rounds: 12, reps: 0 }),
      r6: marca('r6', ADMIN, 'wa', { scoreType: 'rounds', rounds: 10, reps: 0, date: '2025-06-01' }),
      r7: marca('r7', 'colega', 'wa', { scoreType: 'rounds', rounds: 3, reps: 0, rx: false }),
      r8: marca('r8', ADMIN, 'we', { scoreType: 'time', seconds: 50400, finished: true }),
    },
  };
  const p = await movil('Jefe', 9911, siembra, ADMIN);

  console.log('\n== LAS PIEZAS');
  check(await p.eval("return J(opcionesCarga('60/40')) + J(opcionesCarga('17,5/12,5')) + J(opcionesCarga('2x24')) + J(opcionesCarga('1.5/1 pood')); function J(x){return JSON.stringify(x);}") === '[60,40][17.5,12.5][48][24,16]',
    'las cargas se leen: 60/40, 17,5/12,5, 2x24 (48) y en pood');
  check(await p.eval("return opcionesCarga('95/65 lb').map(function(n){return Math.round(n*10)/10;}).join('/')") === '43.1/29.5', 'y las de libras pasan a kilos');
  check(await p.eval("return [numCant('10/10'), numCant('8-20'), numCant('12'), numCant('máx')].join(',')") === '20,14,12,0', '«10/10» son 20, «8-20» la media y lo que no es número, 0');
  check(await p.eval("return [kgPesoCorporal('100 bodyweight deadlifts'), kgPesoCorporal('deadlift 1.5 times bodyweight'), kgPesoCorporal('clean (1.5× bodyweight)')].join(',')") === '75,112.5,112.5',
    '«100 bodyweight deadlifts» son 75 kg, no 7.500; «1.5 times bodyweight», 112,5');
  check(await p.eval("var f = pasadaDe(getWorkout('hero:martin')).find(function(x){return x.m && x.m.id==='deadlift';}); return f ? f.kg : -1") === 75, 'en Martin, el deadlift va a 75 kg');
  check(await p.eval("return [fmtEntero(181412), fmtEntero(6945), fmtCuantos(3.84), fmtCuantos(12.6)].join('|')") === '181.412|6945|3,8|13', 'los números, a la española');
  check(await p.eval("return pasadaDe(getWorkout('wd')).reduce(function(s,x){return s + x.n;}, 0)") === 90, 'la escalera escrita fila a fila suma 45 + 45, sin multiplicar por tres');
  check(await p.eval("return volumenMarca(state.results.find(function(r){return r.id==='r8';}), getWorkout('we')).map(function(x){return x.n + x.u;}).join()") === '150cal', 'en el EMOM, 15 cal por cada uno de los 10 intervalos');
  check(await p.eval("return segundosMarca(state.results.find(function(r){return r.id==='r8';}), getWorkout('we'), {})") === 1200, 'y un «14:00:00» se queda en los 20 minutos del EMOM');

  console.log('\n== MIS CUENTAS DE ESTE AÑO');
  const d = await p.eval(`var d = datosDe([${J(ADMIN)}], desdeDatos('anio')); return JSON.stringify(d);`).then(JSON.parse);
  check(d.marcas === 6, '6 marcas este año (la del año pasado no cuenta): ' + d.marcas);
  check(Math.round(d.run) === 1520, '3 rondas y 12 reps de 15 son 3,8 rondas: 1.520 m corridos (' + d.run + ')');
  check(Math.round(d.kg) === 6945, 'kilos: 19 deadlifts a 60 (el 60 % de mis 100 de Mis Rx) + 45 thrusters a 40 + 30 deadlifts a 120 + 45 wall balls a 9 = 6.945 (' + d.kg + ')');
  check(Math.round(d.saltoM * 10) === 190, '38 box jumps a 50 cm, los de Mis Rx: 19 m (' + d.saltoM + ')');
  check(d.reps['pull-up'] === 105 && d.reps['push-up'] === 120 && d.reps['air-squat'] === 180 && d.reps.burpee === 45 && d.reps['wall-ball'] === 45, 'Cindy y los demás: 105 dominadas, 120 flexiones, 180 air squats, 45 burpees y 45 wall balls');
  check(d.cal === 150 && d.seg === 4500, '150 calorías y 75 minutos sudando (' + d.cal + ' · ' + d.seg + ')');
  const frases = await p.eval(`return JSON.stringify(frasesDatos(datosDe([${J(ADMIN)}], desdeDatos('anio')), true));`).then(JSON.parse);
  const duro = (x) => String(x).replace(/ /g, ' ');            // el número y su unidad van con espacio duro
  check(frases[0].t.indexOf('1,5 km') > 0 && frases[1].t.indexOf('6945 kg') > 0 && /Roma, \d+ km\.$/.test(frases[0].s), 'número y unidad con espacio duro: «1108 km» no se parte al final de la línea');
  frases.forEach((f) => { f.t = duro(f.t); f.s = duro(f.s); });
  const t = frases.map((f) => f.t);
  check(/^Has corrido 1,5 km: 3,8 vueltas a una pista de atletismo\.$/.test(t[0]) && /^Te faltan [\d,]+ km para llegar a Utebo\. Hasta Roma, [\d.]+ km\.$/.test(frases[0].s), 'lo primero, lo corrido: 3,8 vueltas a la pista y lo que falta hasta Utebo y hasta Roma');
  check(t[1] === 'Has levantado 6945 kg: lo que pesan 1,2 elefantes africanos.' && frases[1].s === 'A 6000 kg el elefante africano.', 'lo levantado, en elefantes: ' + t[1]);
  check(t[2] === '38 box jumps: has subido 19 m, un edificio de 6 plantas.', 'los box jumps, en plantas: ' + t[2]);
  check(t[3] === '45 burpees: te has tirado al suelo 45 veces, y te has levantado todas.', 'los burpees');
  check(t[4] === '45 wall balls: has lanzado el balón 135 m hacia arriba, 1,4 veces el Big Ben (96 m).', 'los wall balls, en Big Bens: ' + t[4]);
  check(t[5] === '105 dominadas: has subido tu cuerpo 53 m, un edificio de 18 plantas.', 'las dominadas: ' + t[5]);
  check(t[6] === '120 flexiones: has empujado el suelo 120 veces, y sigue en su sitio.', 'las flexiones');
  check(t[7] === '270 sentadillas: te has sentado 270 veces sin silla.', 'las sentadillas, con los thrusters y los wall balls: ' + t[7]);
  check(t[8] === '150 calorías en el remo, la bici o el SkiErg: 0,6 dónuts.', 'las calorías, en dónuts: ' + t[8]);
  check(t[9] === '1 h 15 min sudando: 0,8 partidos de fútbol.' && t.length === 10, 'y el tiempo, en partidos de fútbol; nada más: ' + t.slice(9).join(' | '));

  console.log('\n== EN PERFIL');
  await p.eval("go('profile'); return 1;"); await sleep(500);
  const tarjeta = duro(await p.eval("var b = document.querySelector('[data-action=\"go\"][data-view=\"datos\"]'); return b ? b.innerText : ''"));
  check(/Datos graciosos/.test(tarjeta) && /Este año has corrido 1,5 km: 3,8 vueltas a una pista de atletismo\./.test(tarjeta), 'Perfil lleva la tarjeta «Datos graciosos» con lo corrido este año');
  await p.clickSel('[data-action="go"][data-view="datos"]'); await sleep(600);
  check(await p.eval("return state.view") === 'datos', 'al tocarla se abre la sección');
  check(await p.eval("return document.querySelector('#tabbar .tab[data-view=\"profile\"]').getAttribute('aria-current')") === 'page', 'con la pestaña de Perfil encendida');
  const txt = () => p.eval("return document.querySelector('#main').innerText").then(duro);
  let v = await txt();
  check(/6 entrenos/i.test(v) && /Has levantado 6945 kg/.test(v) && /1,2 elefantes africanos/.test(v), 'Tú, este año: 6 entrenos y los 6945 kg en elefantes');
  check(await p.eval("return document.querySelectorAll('.datos-list li').length") === 10, 'diez datos en la lista');
  check(await p.eval("return document.querySelector('[data-action=\"datos-tab\"][data-tab=\"tu\"]').getAttribute('aria-pressed') + document.querySelector('[data-action=\"datos-periodo\"][data-periodo=\"anio\"]').getAttribute('aria-pressed')") === 'truetrue', 'de entrada, Tú y Este año');
  await p.shot('shots/datos-tu.png');
  await p.clickSel('[data-action="datos-periodo"][data-periodo="mes"]'); await sleep(400);
  check(/6 entrenos/i.test(await txt()), 'Este mes: las mismas 6, que son de hoy');
  await p.clickSel('[data-action="datos-periodo"][data-periodo="todo"]'); await sleep(400);
  v = await txt();
  check(/7 entrenos/i.test(v) && /Has levantado 9945 kg: lo que pesan 1,7 elefantes africanos/.test(v) && /Has corrido 5,5 km/.test(v), 'Siempre: entra la del año pasado (7 entrenos, 9945 kg, 5,5 km)');
  await p.clickSel('[data-action="datos-tab"][data-tab="cuadrilla"]'); await sleep(400);
  v = await txt();
  check(/8 entrenos/i.test(v) && /^la cuadrilla$/im.test(v) && /Habéis corrido 6,7 km/.test(v), 'La cuadrilla, siempre: 8 entrenos y 6,7 km entre todos' + (/8 entrenos/i.test(v) ? '' : ' [' + v.slice(0, 200).replace(/\s+/g, ' ') + ']'));
  await p.clickSel('[data-action="datos-periodo"][data-periodo="anio"]'); await sleep(400);
  v = await txt();
  check(/7 entrenos/i.test(v) && /Habéis corrido 2,7 km: 6,8 vueltas/.test(v) && /Habéis levantado 7545 kg: lo que pesan 1,3 elefantes africanos/.test(v),
    'La cuadrilla, este año: con Colega escalado (sus deadlifts, a 40) salen 7545 kg');
  check(/68 box jumps: habéis subido 37 m, un edificio de 12 plantas/.test(v), 'y sus box jumps sin altura en Mis Rx suben 60 cm: 68 entre los dos, 37 m');
  check(/os habéis tirado al suelo/.test(v) && !/te has tirado/.test(v), 'en plural: «os habéis tirado al suelo»');
  await p.shot('shots/datos-cuadrilla.png');
  await p.clickSel('[data-action="go"][data-view="profile"]'); await sleep(400);
  check(await p.eval("return state.view") === 'profile', 'el botón Perfil vuelve a Perfil');

  console.log('\n== SIN MARCAS');
  await p.eval("state.meId = 'nuevo'; state.datosTab = 'tu'; go('profile'); return 1;"); await sleep(400);
  check(/Lo que llevas corrido, levantado y saltado/.test(await p.eval("return document.querySelector('[data-action=\"go\"][data-view=\"datos\"]').innerText")), 'sin marcas, la tarjeta cuenta qué hay dentro');
  await p.eval("go('datos'); return 1;"); await sleep(400);
  v = await txt();
  check(/0 entrenos/i.test(v) && /Sin entrenos apuntados en este periodo/.test(v) && !document_tiene_lista(v), 'y la sección lo dice sin lista');

  const errores = p.consoleErrors || [];
  check(!errores.length, 'sin errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });

function document_tiene_lista(v) { return /Has corrido|Has levantado/.test(v); }
