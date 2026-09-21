/* Mapa de músculos: qué trabaja un entreno y qué ha trabajado el atleta (equilibrio y fatiga).
   Uso: node test/musculos.test.js   (app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const ADMIN = 'mtr14k1bb9bg49';
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hace = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const T = '2026-09-01T10:00:00.000Z';

(async () => {
  const siembra = {
    athletes: { [ADMIN]: { id: ADMIN, name: 'Jefe', color: 'red', createdAt: T, updatedAt: T } },
    workouts: {
      fran: { id: 'fran', name: 'Fran casera', type: 'fortime', scoreType: 'time', timeCapMin: 0, modo: 'bloques', esquema: '21-15-9', bloques: [{ mov: 'thruster', carga: '43/30 kg' }, { mov: 'pull-up' }], description: '21-15-9 reps for time of:\nThrusters 43/30 kg\nPull-ups', createdBy: ADMIN, createdAt: T, updatedAt: T },
      piernas: { id: 'piernas', name: 'Piernas raras', type: 'amrap', scoreType: 'rounds', durationMin: 10, modo: 'bloques', bloques: [{ cant: '10', mov: 'cossack-squat' }, { cant: '200', mov: 'run' }], description: 'AMRAP 10 min:\n10 Cossack squats\n200 m Run', createdBy: ADMIN, createdAt: T, updatedAt: T },
    },
    results: {
      r1: { id: 'r1', athleteId: ADMIN, workoutId: 'fran', workoutName: 'Fran casera', category: 'custom', scoreType: 'time', seconds: 300, finished: true, date: hace(0), rx: true, createdAt: T, updatedAt: T },
      r2: { id: 'r2', athleteId: ADMIN, workoutId: 'girl:cindy', workoutName: 'Cindy', category: 'girl', scoreType: 'rounds', rounds: 15, reps: 0, date: hace(2), rx: true, createdAt: T, updatedAt: T },
      r3: { id: 'r3', athleteId: ADMIN, workoutId: 'piernas', workoutName: 'Piernas raras', category: 'custom', scoreType: 'rounds', rounds: 5, reps: 0, date: hace(10), rx: true, createdAt: T, updatedAt: T },
    },
  };
  const p = new Phone('Musc', 9921, { theme: 'dark', sinNube: true });
  await p.start();
  await p.go(APP);
  await p.eval(`localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify(siembra.athletes))});
    localStorage.setItem('llorones:workouts', ${JSON.stringify(JSON.stringify(siembra.workouts))});
    localStorage.setItem('llorones:results', ${JSON.stringify(JSON.stringify(siembra.results))});
    localStorage.setItem('llorones:me', ${JSON.stringify(ADMIN)}); return 1;`);
  await p.go(APP); await sleep(2500);
  await p.eval("closeSheet(); return 1;");

  console.log('\n== DATOS');
  check(await p.eval("return MOVIMIENTOS.every(function(m){ return Array.isArray(m.mu) && Array.isArray(m.ms) && m.mu.concat(m.ms).every(function(g){ return !!MUSC_NOMBRE[g]; }); })"), 'los ' + (await p.eval('return MOVIMIENTOS.length')) + ' movimientos llevan músculos válidos');
  check(await p.eval("return MOVIMIENTOS.filter(function(m){ return !m.mu.length; }).map(function(m){return m.id;}).join(',') === 'chaleco'"), 'solo el chaleco no trabaja nada por sí mismo');
  check(await p.eval("return CUERPO.front.length === 19 && CUERPO.back.length === 16 && Object.keys(MUSC_POR_PARTE).every(function(k){ return CUERPO.front.concat(CUERPO.back).some(function(p){ return p.m === k; }); })"), 'el dibujo tiene todas las partes de los 16 grupos');

  console.log('\n== LA FICHA DEL ENTRENO DIBUJA LO QUE TRABAJA');
  await p.eval("go('wod', {id:'fran'}); return 1;"); await sleep(600);
  check(/Músculos que trabaja/.test(await p.text()) && (await p.eval("return document.querySelectorAll('.cuerpo svg').length")) === 2, 'sale la tarjeta con el cuerpo de frente y de espaldas');
  const fill = (id) => p.eval("var e = document.querySelector('.cuerpo path[data-musculo=\"" + id + "\"]'); return e ? e.getAttribute('fill') : null");
  check((await fill('hom')) === (await p.eval('return CALOR[3]')), 'los hombros (principal en thruster y ayuda en pull-up) van en el verde más vivo');
  check((await fill('cua')) === (await p.eval('return CALOR[3]')) && (await fill('dor')) === (await p.eval('return CALOR[3]')), 'cuádriceps y espalda alta, principales, también en verde vivo');
  check((await fill('tri')) === (await p.eval('return CALOR[0]')), 'el tríceps, que solo ayuda, en verde apagado');
  check((await fill('pec')) === 'var(--cuerpo-base)' && (await fill('gem')) === 'var(--cuerpo-base)', 'pecho y gemelos, que no se tocan, en gris');
  const chips = await p.eval("return Array.prototype.map.call(document.querySelectorAll('.musc-chips li'), function(l){ return l.textContent + (l.classList.contains('principal') ? '*' : ''); }).join(',')");
  console.log('   grupos: ' + chips);
  check(/^Hombros\*/.test(chips) && /Tríceps(,|$)/.test(chips) && !/Tríceps\*/.test(chips), 'la lista va de más a menos y marca los principales');
  await p.clickSel('.musc-chips li[data-id="cua"]'); await sleep(600);
  check((await p.sheetTitle()) === 'Cuádriceps' && /Thruster/.test(await p.eval("return document.querySelector('.sheet-body').textContent")) && /Principal/.test(await p.eval("return document.querySelector('.sheet-body').textContent")), 'tocar un músculo enseña qué movimientos del entreno lo trabajan');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);
  await p.clickSel('.cuerpo path[data-musculo="pec"]'); await sleep(600);
  check((await p.sheetTitle()) === 'Pecho' && /Nada de lo que hay/.test(await p.eval("return document.querySelector('.sheet-body').textContent")), 'tocar el dibujo también vale, y un músculo sin trabajo lo dice');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);
  await p.shot('shots/musculos-ficha.png');
  // un héroe también (movimientos adivinados en el texto)
  await p.eval("go('wod', {id:'girl:cindy'}); return 1;"); await sleep(600);
  check(/Músculos que trabaja/.test(await p.text()) && (await fill('pec')) !== 'var(--cuerpo-base)', 'en Cindy (texto) también sale, con el pecho de las flexiones');

  console.log('\n== PERFIL → TUS MÚSCULOS: EQUILIBRIO');
  await p.eval("go('profile'); return 1;"); await sleep(500);
  check(/Tus músculos/.test(await p.text()), 'el perfil tiene la tarjeta');
  await p.click('Tus músculos', 'button.card'); await sleep(600);
  check(await p.eval("return state.view === 'musculos' && document.querySelector('[data-action=\"musc-tab\"][data-tab=\"equilibrio\"]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-action=\"musc-periodo\"][data-periodo=\"30\"]').getAttribute('aria-pressed') === 'true'"), 'abre en Equilibrio a 30 días');
  check(/3 entrenos/i.test(await p.text()), 'cuenta los 3 entrenos (hoy, hace 2 y hace 10 días)');
  const lista = await p.eval("return Array.prototype.map.call(document.querySelectorAll('.musc-list li'), function(l){ return l.dataset.id + ':' + l.querySelector('b').textContent; }).join(' ')");
  console.log('   ' + lista);
  check(/^cua:100 %/.test(lista), 'los cuádriceps (thruster, air squat, cossack, run) van los primeros al 100 %');
  check(/adu:\d+ %/.test(lista) && /tib:\d+ %/.test(lista), 'aductores y tibiales (del entreno de hace 10 días) cuentan a 30 días');
  check((await p.eval("return Array.prototype.map.call(document.querySelectorAll('.musc-chips li.sin'), function(l){ return l.dataset.id; }).join(',')")) === 'obl', 'a 30 días solo los oblicuos quedan sin trabajar');
  await p.clickSel('[data-action="musc-periodo"][data-periodo="semana"]'); await sleep(500);
  const sin = await p.eval("return Array.prototype.map.call(document.querySelectorAll('.musc-chips li.sin'), function(l){ return l.dataset.id; }).join(',')");
  check(/2 entrenos/i.test(await p.text()) && sin.indexOf('adu') >= 0 && sin.indexOf('tib') >= 0 && !(await p.eval("return !!document.querySelector('.musc-list li[data-id=\"adu\"]')")), 'a una semana salen aductores y tibiales como "sin trabajar" (' + sin + ')');
  await p.shot('shots/musculos-equilibrio.png');
  await p.clickSel('.musc-list li[data-id="cua"]'); await sleep(600);
  const hoja = await p.eval("return document.querySelector('.sheet-body').textContent");
  check((await p.sheetTitle()) === 'Cuádriceps' && /Thruster/.test(hoja) && /1 vez/.test(hoja) && /Air squat/.test(hoja), 'tocar un músculo enseña los movimientos hechos con sus veces');
  await p.eval("dismissSheet(); return 1;"); await sleep(300);

  console.log('\n== FATIGA');
  await p.clickSel('[data-action="musc-tab"][data-tab="fatiga"]'); await sleep(500);
  check((await fill('cua')) === (await p.eval('return FATIGA.fatigado')) && (await fill('hom')) === (await p.eval('return FATIGA.fatigado')), 'lo de hoy (Fran) sale fatigado en rojo');
  check((await fill('pec')) === (await p.eval('return FATIGA.recuperando')), 'el pecho de Cindy (hace 2 días) sale en recuperación');
  check((await fill('adu')) === 'var(--cuerpo-base)', 'los aductores de hace 10 días ya están listos');
  const fat = await p.eval("return Array.prototype.map.call(document.querySelectorAll('.musc-list.fatiga li'), function(l){ return l.dataset.id + ':' + l.querySelector('b').textContent; }).join(' ')");
  console.log('   ' + fat);
  check(/cua:hoy/.test(fat) && /pec:hace 2 días/.test(fat) && /adu:hace 10 días/.test(fat) && /obl:nunca/.test(fat), 'la lista dice hoy / hace 2 días / hace 10 días / nunca');
  await p.shot('shots/musculos-fatiga.png');
  check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
