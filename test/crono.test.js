/* Comprueba las tres peticiones: sin zoom por doble toque, crono a pantalla
   completa en horizontal y avisos de caducidad del código de acceso.
   Uso: node test/crono.test.js   (con la app servida en http://127.0.0.1:8765) */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };

async function movil(nombre, port, opts) {
  const p = new Phone(nombre, port, opts || {});
  await p.start();
  await p.go(APP);
  await p.eval("localStorage.clear(); sessionStorage.clear(); return 1;");
  await p.go(APP);
  await sleep(3500);
  const t = await p.sheetTitle();
  if (t === '¿Quién eres?') { await p.click('Soy nuevo'); await sleep(600); }
  await p.type('#a-name', nombre);
  await p.clickSel('[data-action="save-athlete"]');
  await sleep(900);
  return p;
}

(async () => {
  /* ---------- 1. sin zoom por doble toque ---------- */
  console.log('\n== ZOOM POR DOBLE TOQUE');
  const p = await movil('Probador', 9501, { theme: 'dark' });
  const touch = await p.eval("return JSON.stringify({ body: getComputedStyle(document.body).touchAction, boton: getComputedStyle(document.querySelector('.tab')).touchAction })");
  const ta = JSON.parse(touch);
  check(ta.body === 'manipulation', 'el cuerpo de la app usa touch-action: manipulation (era ' + ta.body + ')');
  check(ta.boton === 'manipulation', 'los botones también (' + ta.boton + ')');
  check(!(await p.eval("return /user-scalable\\s*=\\s*no/.test((document.querySelector('meta[name=viewport]')||{}).content||'')")), 'el pellizco para ampliar sigue permitido (no se bloquea el zoom entero)');

  /* ---------- 2. crono a pantalla completa ---------- */
  console.log('\n== CRONO A PANTALLA COMPLETA');
  await p.click('Crono', '.tab'); await sleep(800);
  check(/Pantalla completa en horizontal/.test(await p.text()), 'el ajuste de pantalla completa aparece en el crono');
  await p.click('AMRAP', '.segmented button'); await sleep(600);
  for (let i = 0; i < 10; i++) await p.clickSel('[data-action="step"][data-id="prepSec"][data-d="-1"]');
  await p.clickSel('[data-action="timer-start"]'); await sleep(1500);
  check(await p.eval("return !!document.querySelector('.crono-capa')"), 'al empezar se abre la capa a pantalla completa');
  const medidas = await p.eval(`
    var capa = document.querySelector('.crono-capa'), giro = document.querySelector('.crono-giro'), reloj = document.querySelector('#clock');
    var rc = capa.getBoundingClientRect(), rg = giro.getBoundingClientRect(), rr = reloj.getBoundingClientRect();
    return JSON.stringify({ capaW: Math.round(rc.width), capaH: Math.round(rc.height), vw: innerWidth, vh: innerHeight,
      giroAncho: Math.round(rg.width), giroAlto: Math.round(rg.height), giroTransform: getComputedStyle(giro).transform,
      relojAlto: Math.round(rr.height), relojFuente: getComputedStyle(reloj).fontSize, texto: reloj.textContent });`);
  const m = JSON.parse(medidas);
  console.log('   medidas:', medidas);
  check(m.capaW === m.vw && m.capaH === m.vh, 'la capa ocupa toda la pantalla');
  check(m.giroTransform !== 'none', 'con el móvil en vertical el contenido se gira para verse apaisado');
  check(m.relojAlto > m.vh * 0.25, 'el reloj se ve grande (' + m.relojAlto + ' px de alto, fuente ' + m.relojFuente + ')');
  check(/^\d+:\d\d$/.test(m.texto.trim()), 'el reloj está contando: ' + m.texto.trim());
  check(await p.eval("return !!document.querySelector('.crono-capa [data-action=\"timer-round\"]')"), 'el botón +1 ronda está dentro de la capa');
  await p.click('+1 ronda'); await sleep(600);
  check((await p.eval("return document.querySelector('#round-val').textContent")) === '1', 'y funciona: 1 ronda');
  await p.clickSel('.crono-salir'); await sleep(700);
  check(!(await p.eval("return !!document.querySelector('.crono-capa')")), 'la X sale de la pantalla completa sin parar el crono');
  check(await p.eval("return timer.status === 'running'"), 'el crono sigue corriendo');
  await p.click('Terminar'); await sleep(1000);
  check(/rd|:/.test(await p.text()), 'al terminar se ve el resultado');

  /* ---------- 3. avisos de caducidad ---------- */
  console.log('\n== AVISOS DE CADUCIDAD DEL CÓDIGO');
  const dias = (n) => Date.now() + n * 86400000;
  await p.eval("localStorage.setItem('llorones:gh_token','github_pat_ficticio_para_la_prueba_0000000000'); return 1;");
  await p.eval("localStorage.setItem('llorones:gh_exp', String(" + dias(200) + ")); return 1;");
  await p.eval("state.store.token = localStorage.getItem('llorones:gh_token'); state.store.caduca = Number(localStorage.getItem('llorones:gh_exp')); state.store.sync.fatal = false; go('home'); return 1;");
  await sleep(600);
  check(!/caduca/i.test(await p.text()), 'con 200 días por delante no molesta con avisos');
  await p.eval("state.store.caduca = " + dias(12) + "; go('home'); return 1;"); await sleep(600);
  const aviso = await p.text();
  check(/caduca en 12 días/i.test(aviso), 'a 12 días avisa: "' + ((aviso.match(/El código de acceso caduca[^.]*\./) || [''])[0]).trim() + '"');
  await p.eval("state.store.sync.fatal = true; go('home'); return 1;"); await sleep(600);
  const caducado = await p.text();
  check(/ha caducado o ya no vale/i.test(caducado), 'caducado: "' + ((caducado.match(/El código de acceso ha caducado[^.]*\./) || [''])[0]).trim() + '"');
  check(/crear uno nuevo/i.test(caducado), 'y dice que hay que crear uno nuevo y repartirlo');
  await p.click('Perfil', '.tab'); await sleep(700);
  check(/El código caduca/.test(await p.text()) || /ya no vale/.test(await p.text()), 'en Perfil → Nube también se ve el estado del código');
  await p.stop();

  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
