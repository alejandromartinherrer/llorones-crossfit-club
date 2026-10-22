/* El reloj a pantalla completa debe llenar la pantalla sin salirse, en cualquier tamaño. */
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };

async function medir(nombre, port, w, h, modo) {
  const p = new Phone(nombre, port, { theme: 'dark' });
  await p.start();
  await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await p.go(APP);
  await p.eval("localStorage.clear(); sessionStorage.clear(); return 1;");
  await p.go(APP);
  await sleep(3000);
  const t = await p.sheetTitle();
  if (t === '¿Quién eres?') { await p.click('Soy nuevo'); await sleep(600); }
  await p.type('#a-name', nombre);
  await p.clickSel('[data-action="save-athlete"]');
  await sleep(900);
  await p.click('Crono', '.tab'); await sleep(700);
  if (modo) { await p.click(modo, '.segmented button'); await sleep(500); }
  for (let i = 0; i < 10; i++) await p.clickSel('[data-action="step"][data-id="prepSec"][data-d="-1"]');
  await p.clickSel('[data-action="timer-start"]'); await sleep(2200);
  const m = JSON.parse(await p.eval(`
    var ck = document.querySelector('#clock'), st = document.querySelector('#tstage'), giro = document.querySelector('.crono-giro');
    return JSON.stringify({
      fuente: parseFloat(getComputedStyle(ck).fontSize),
      textoAncho: ck.scrollWidth, textoAlto: ck.offsetHeight,
      cajaAncho: st.clientWidth, cajaAlto: st.clientHeight,
      giroAncho: giro ? giro.clientWidth : 0, giroAlto: giro ? giro.clientHeight : 0,
      texto: ck.textContent
    });`));
  await p.shot('shots/reloj-' + nombre + '.png');
  await p.stop();
  return m;
}

(async () => {
  for (const caso of [
    { nombre: 'Apaisado', port: 9701, w: 932, h: 430, modo: 'AMRAP' },
    { nombre: 'Vertical', port: 9702, w: 430, h: 932, modo: 'AMRAP' },
    { nombre: 'Pequeno', port: 9703, w: 667, h: 375, modo: 'AMRAP' },
    { nombre: 'ForTime', port: 9704, w: 932, h: 430, modo: 'For time' },
  ]) {
    const m = await medir(caso.nombre, caso.port, caso.w, caso.h, caso.modo);
    const ladoLargo = Math.max(m.giroAncho || m.cajaAncho, m.cajaAncho);
    console.log('\n== ' + caso.nombre + ' ' + caso.w + 'x' + caso.h + ': ' + JSON.stringify(m));
    check(m.textoAncho <= m.cajaAncho + 2, 'el reloj no se sale por los lados (' + m.textoAncho + ' de ' + m.cajaAncho + ')');
    check(m.textoAlto <= m.cajaAlto + 2, 'ni por arriba y abajo (' + m.textoAlto + ' de ' + m.cajaAlto + ')');
    check(m.textoAncho >= m.cajaAncho * 0.8 || m.textoAlto >= m.cajaAlto * 0.8, 'y llena la caja: ocupa ' + Math.round(100 * m.textoAncho / m.cajaAncho) + '% de ancho y ' + Math.round(100 * m.textoAlto / m.cajaAlto) + '% de alto');
    check(m.fuente >= 200, 'la letra es enorme: ' + Math.round(m.fuente) + ' px');
  }
  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
