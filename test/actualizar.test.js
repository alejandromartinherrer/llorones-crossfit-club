/* La app se pone al día sola cuando se publica una versión nueva (version.json), sin bucles,
   y si estás a medias avisa en vez de recargar. Uso: node test/actualizar.test.js
   (app servida en http://127.0.0.1:8765; la prueba cambia dist/version.json y lo deja como estaba) */
const fs = require('fs');
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const VJSON = path.join(__dirname, '..', 'dist', 'version.json');
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };
const T = '2026-09-01T10:00:00.000Z';
const publica = (v) => fs.writeFileSync(VJSON, JSON.stringify({ version: v }) + '\n');
async function evalSeguro(p, expr, def) { for (let i = 0; i < 20; i++) { try { return await p.eval(expr); } catch (e) { await sleep(300); } } return def; }

(async () => {
  const original = fs.readFileSync(VJSON, 'utf8');
  const actual = JSON.parse(original).version;
  const p = new Phone('Version', 9961, { theme: 'dark', sinNube: true });
  try {
    await p.start();
    // cuenta cada carga de la página (sobrevive a las recargas, es por pestaña)
    await p.send('Page.addScriptToEvaluateOnNewDocument', { source: "try { sessionStorage.setItem('cargas', String(Number(sessionStorage.getItem('cargas') || 0) + 1)); } catch (e) {}" });
    await p.go(APP);
    await p.eval(`localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('cargas', '0');
      localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify({ yo: { id: 'yo', name: 'Yo', color: 'red', createdAt: T, updatedAt: T } }))});
      localStorage.setItem('llorones:me', 'yo'); return 1;`);

    console.log('\n== MISMA VERSIÓN: NO PASA NADA');
    await p.go(APP); await sleep(3500);
    check(await evalSeguro(p, "return APP_VERSION") === actual, 'la app corre la ' + actual + ' y version.json dice lo mismo');
    check(await evalSeguro(p, "return !document.querySelector('.aviso-version') && !state.versionNueva"), 'sin aviso');
    check(await evalSeguro(p, "return sessionStorage.getItem('cargas')") === '1', 'y sin recargas (1 carga)');

    console.log('\n== SE PUBLICA OTRA: SE RECARGA SOLA, SIN BUCLES');
    publica('9.9.9');
    await p.eval("document.dispatchEvent(new Event('visibilitychange')); _ultimaComprobacion = 0; buscaVersionNueva(); return 1;").catch(() => 1);
    await sleep(9000);
    const cargas = Number(await evalSeguro(p, "return sessionStorage.getItem('cargas')", '0'));
    check(cargas === 3, 'al volver a la app ve la 9.9.9 y lo intenta dos veces: recarga normal y con otra dirección (' + cargas + ' cargas)');
    check(await evalSeguro(p, "return JSON.parse(sessionStorage.getItem('llorones:actualizando') || '{}').n") === 2, 'y lo apunta para no intentarlo más en esta sesión');
    await sleep(3000);
    check(Number(await evalSeguro(p, "return sessionStorage.getItem('cargas')", '0')) === 3, 'no entra en bucle: tres segundos después sigue en 3 cargas');
    check(await evalSeguro(p, "var a = document.querySelector('.aviso-version'); return !!a && /9\\.9\\.9/.test(a.textContent) && !!a.querySelector('[data-action=\"actualizar-app\"]')"), 'como el móvil no le da la nueva, deja el aviso con el botón Actualizar');
    check(await evalSeguro(p, "return location.search === ''"), 'y la dirección queda limpia, sin el ?v=');
    await p.shot('shots/aviso-version.png');

    console.log('\n== SI ESTÁS A MEDIAS, AVISA Y NO RECARGA');
    publica('9.9.10');
    await evalSeguro(p, "ACTIONS['new-workout']({dataset:{}}); return 1;");
    await sleep(400);
    await evalSeguro(p, "buscaVersionNueva(true); return 1;");
    await sleep(2500);
    check(Number(await evalSeguro(p, "return sessionStorage.getItem('cargas')", '0')) === 3, 'con el formulario de entreno abierto no recarga');
    check(await evalSeguro(p, "return !!document.querySelector('#sheet-root .sheet') && /9\\.9\\.10/.test((document.querySelector('.aviso-version') || {}).textContent || '')"), 'la hoja sigue abierta y el aviso ya dice 9.9.10');
    await evalSeguro(p, "dismissSheet(); return 1;"); await sleep(400);
    await p.clickSel('[data-action="actualizar-app"]');
    await sleep(9000);
    check(Number(await evalSeguro(p, "return sessionStorage.getItem('cargas')", '0')) >= 4, 'el botón Actualizar vuelve a pedir la página');

    console.log('\n== VUELVE A ESTAR AL DÍA');
    publica(actual);
    await p.go(APP); await sleep(3500);
    check(await evalSeguro(p, "return !document.querySelector('.aviso-version') && !state.versionNueva"), 'con la versión publicada igual a la que corre, no hay aviso');
    check(!(p.consoleErrors || []).length, 'sin errores de consola' + ((p.consoleErrors || []).length ? ': ' + p.consoleErrors.join(' | ') : ''));
  } finally {
    fs.writeFileSync(VJSON, original);
    await p.stop();
  }
  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
