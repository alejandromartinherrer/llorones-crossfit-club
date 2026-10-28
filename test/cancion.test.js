/* La canción del final del crono (v1.13.0; en iPhone, v1.13.1; con música de fondo, v1.13.2): se elige un audio del móvil con el selector de archivos de verdad,
   se guarda solo en ese móvil y suena en los últimos segundos (7 por defecto) en vez de los pitidos, entrando
   por donde toca para que su final caiga en el cero. Pausa, Terminar, «Que suene», «Probar» y «Quitar».
   Uso: node test/cancion.test.js   (con la app servida en http://127.0.0.1:8765) */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Phone, sleep } = require(path.join(__dirname, '..', 'drive'));
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const fails = [];
const check = (cond, msg) => { if (cond) console.log('   OK  ' + msg); else { console.log('   MAL ' + msg); fails.push(msg); } };

/* Un .wav de prueba: un tono de 440 Hz de `seg` segundos. */
function wav(seg, file) {
  const sr = 22050, n = Math.round(seg * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sr) * 8000), 44 + i * 2);
  fs.writeFileSync(file, b);
}
/* Lo que hace el selector de archivos del móvil: deja el archivo en el <input type=file> y avisa con change. */
async function elige(p, file) {
  const doc = await p.send('DOM.getDocument', { depth: -1 });
  const q = await p.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#cancion-file' });
  await p.send('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [file] });
}
/* Apunta cada sonido: los arranques de audio (con lo que quedaba de crono y desde dónde entra) y los pitidos. */
const ESPIA = `window.__arr = []; window.__osc = [];
  var ps = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (w, off) { window.__arr.push({ off: off || 0, st: timer.status, rem: timer.status === 'running' ? timerTotal() - elapsed() : null }); return ps.apply(this, arguments); };
  var po = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () { window.__osc.push(timer.status === 'running' ? +(timerTotal() - elapsed()).toFixed(2) : timer.status); return po.apply(this, arguments); };
  return 1;`;
const espia = (p) => p.eval("return JSON.stringify({ arr: window.__arr, osc: window.__osc, song: !!timer.song, status: timer.status, rem: timer.status === 'running' ? timerTotal() - elapsed() : null, ctx: actx && actx.state })").then(JSON.parse);
/* La sesión de audio de Safari (navigator.audioSession), de mentira: apunta cada cambio de tipo con lo que quedaba
   de crono. Chrome no la tiene. */
const SESION = `window.__ses = []; var tipo = 'auto';
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: {
    get type() { return tipo; },
    set type(v) { tipo = v; window.__ses.push(v + '@' + (timer.status === 'running' ? (timerTotal() - elapsed()).toFixed(1) : timer.status)); } } });
  return 1;`;
const ses = (p) => p.eval('return JSON.stringify(window.__ses)').then(JSON.parse);
/* Un crono corto a mano: AMRAP o For time con cap, en minutos con decimales, sin cuenta atrás ni pantalla completa. */
async function crono(p, modo, min) {
  await p.click('Crono', '.tab'); await sleep(600);
  await p.eval(`if (timer.status !== 'idle') timerReset(); timer.mode = '${modo}'; timer.full = false; timer.cfg.prepSec = 0; timer.cfg.${modo === 'amrap' ? 'amrapMin' : 'capMin'} = ${min}; window.__arr = []; window.__osc = []; render(); return 1;`);
  await sleep(300);
  await p.clickSel('[data-action="timer-start"]');
}
const hasta = async (p, cond, ms) => { for (let t = 0; t < ms; t += 50) { if (await p.eval('return !!(' + cond + ')')) return true; await sleep(50); } return false; };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llorones-cancion-'));
  const largo = path.join(dir, 'se-acabo.wav'), malo = path.join(dir, 'no-es-audio.mp3');
  wav(40, largo); fs.writeFileSync(malo, 'esto no es un audio');

  const p = new Phone('cancion', 9877, { sinNube: true });
  await p.start(); await p.go(APP);
  await p.eval("localStorage.clear(); sessionStorage.clear(); indexedDB.deleteDatabase('llorones-audio'); return 1;");
  await p.go(APP); await sleep(2500);
  await p.eval('closeSheet(); return 1;');

  console.log('\n== ELEGIR LA CANCIÓN');
  await p.click('Perfil', '.tab'); await sleep(600);
  let t = await p.text();
  check(/Canción del final/i.test(t) && /Elegir audio/i.test(t) && /no se sube a la nube/i.test(t), 'Perfil → Ajustes ofrece «Canción del final», que se queda en el móvil');
  check((await p.eval("return document.querySelector('#cancion-file').getAttribute('accept')")) === 'audio/*' && !/app Archivos/.test(t), 'fuera del iPhone el selector enseña solo audios, sin el aviso de Archivos');
  check(!(await p.eval('return !!navigator.audioSession')) && !/darle al play/.test(t), 'sin sesión de audio (Chrome) no avisa de que para la música');
  await elige(p, malo); await sleep(1500);
  check(/no es un audio que este móvil sepa leer/.test(await p.all()), 'un archivo que no es audio se rechaza con un aviso claro');
  check(!(await p.eval("return localStorage.getItem('llorones:cancion-nombre')")), 'y no se guarda nada');
  await elige(p, largo); await sleep(2500);
  t = await p.text();
  check(/se-acabo\.wav/i.test(t) && /Que suene al final del crono/i.test(t) && /Probar/i.test(t) && /Quitar/i.test(t), 'con un audio bueno se ve su nombre, «Que suene», «Probar» y «Quitar»');
  const dur = await p.eval('return cancion.buf && cancion.buf.duration');
  check(Math.abs(dur - 33) < 0.05, 'de un audio de 40 s solo se guarda descodificado el principio: ' + (dur && dur.toFixed(2)) + ' s');
  check((await p.eval("return document.querySelector('#cancion-seg').value")) === '7', 'por defecto empieza 7 s antes del final');

  await p.go(APP); await sleep(2500); await p.eval('closeSheet(); return 1;');
  check((await p.eval('return cancion.nombre')) === 'se-acabo.wav' && (await p.eval('return cancion.buf')) === null, 'al volver a abrir la app sigue elegida (y no se descodifica hasta que hace falta)');
  const dur2 = await p.eval('return cancionBuffer().then(function (b) { return b.duration; })');
  check(Math.abs(dur2 - 33) < 0.05, 'el audio está guardado en el móvil (IndexedDB) y se lee bien');
  await p.eval(ESPIA);

  console.log('\n== AMRAP: SUENA EN LOS ÚLTIMOS 7 S Y NO PITA');
  await p.click('Crono', '.tab'); await sleep(500);
  await p.click('AMRAP', '.segmented button'); await sleep(400);
  check(/se-acabo\.wav: suena en los últimos 7 s/.test(await p.text()), 'el crono avisa de que la canción está puesta');
  await crono(p, 'amrap', 0.25);
  await sleep(6000);
  let s = await espia(p);
  check(s.status === 'running' && s.arr.length === 0 && !s.song, 'a falta de 9 s todavía no suena (contexto de audio: ' + s.ctx + ')');
  await hasta(p, 'timer.song', 3000);
  s = await espia(p);
  const a = s.arr[0] || {};
  console.log('   entra con ' + (a.rem || 0).toFixed(2) + ' s por delante, desde el segundo ' + (a.off || 0).toFixed(3) + ' del audio');
  check(s.arr.length === 1 && a.rem <= 7 && a.rem > 6.8 && Math.abs(a.off - (7 - a.rem)) < 0.02, 'entra al quedar 7 s, por donde toca para acabar en el cero');
  await hasta(p, "timer.status === 'done'", 8000);
  s = await espia(p);
  check(s.status === 'done' && (await p.eval('return timer.endReason')) === 'time', 'el AMRAP acaba por tiempo');
  check(s.osc.length === 0, 'mientras suena no hay pitidos: ni el 3-2-1 ni los del final (' + JSON.stringify(s.osc) + ')');
  check(s.song, 'al acabar se deja sonar la cola (la última palabra)');
  await sleep(3500);
  check(!(await espia(p)).song, 'y a los pocos segundos se apaga');

  console.log('\n== «QUE SUENE» QUITADO: VUELVEN LOS PITIDOS');
  await p.click('Perfil', '.tab'); await sleep(500);
  await p.click('Que suene al final del crono', 'label'); await sleep(300);
  check((await p.eval("return localStorage.getItem('llorones:cancion')")) === 'off' && !(await p.eval('return cancion.on')), 'se apaga y se recuerda');
  await crono(p, 'amrap', 0.1);
  await hasta(p, "timer.status === 'done'", 9000); await sleep(800);
  s = await espia(p);
  check(s.arr.length === 0 && s.osc.length === 5, 'sin canción, los pitidos de siempre: 3-2-1 y dos largos (' + JSON.stringify(s.osc) + ')');
  await p.click('Perfil', '.tab'); await sleep(500);
  await p.click('Que suene al final del crono', 'label'); await sleep(300);
  check(await p.eval('return cancion.on'), 'se vuelve a encender');

  console.log('\n== 5 S ANTES, PAUSA, REANUDAR Y TERMINAR');
  await p.setValue('#cancion-seg', '5');
  check((await p.eval("return localStorage.getItem('llorones:cancion-seg')")) === '5' && (await p.eval('return cancion.seg')) === 5, 'se puede cambiar a 5 s y se recuerda');
  await crono(p, 'amrap', 0.2);
  await hasta(p, 'timer.song', 9000);
  s = await espia(p);
  check(s.arr.length === 1 && s.arr[0].rem <= 5 && s.arr[0].rem > 4.8, 'entra al quedar 5 s (' + (s.arr[0] || {}).rem + ')');
  await sleep(1200);
  await p.click('Pausa'); await sleep(300);
  s = await espia(p);
  check(s.status === 'paused' && !s.song, 'al pausar se corta');
  await sleep(1000);
  await p.click('Reanudar'); await hasta(p, 'window.__arr.length === 2', 1500);
  s = await espia(p);
  const b = s.arr[1] || {};
  console.log('   vuelve a entrar con ' + (b.rem || 0).toFixed(2) + ' s por delante, desde el segundo ' + (b.off || 0).toFixed(3));
  check(s.arr.length === 2 && b.off > 1 && Math.abs(b.off - (5 - b.rem)) < 0.05, 'al reanudar vuelve a entrar donde iba, no desde el principio');
  await p.click('Terminar'); await sleep(150);
  s = await espia(p);
  check(s.status === 'done' && (await p.eval('return timer.endReason')) === 'manual' && !s.song, 'Terminar a mano la corta en el acto');
  await sleep(700);
  check((await espia(p)).osc.length === 2, 'y entonces sí pitan los dos largos del final');

  console.log('\n== FOR TIME: SOLO CON TIME CAP');
  await crono(p, 'fortime', 0);
  await sleep(1500);
  check(!(await p.eval('return cancionToca()')), 'sin cap no hay final fijo: no suena');
  await p.click('Terminar'); await sleep(400);
  await crono(p, 'fortime', 0.15);
  await hasta(p, "timer.status === 'done'", 12000);
  s = await espia(p);
  check(s.arr.length === 1 && s.arr[0].rem <= 5 && s.arr[0].rem > 4.8 && (await p.eval('return timer.endReason')) === 'cap', 'con cap suena en los últimos 5 s y acaba en el cap');
  await sleep(3000);

  console.log('\n== iPHONE: SE PUEDE ELEGIR EL MP3 Y «PROBAR» DESPIERTA EL AUDIO EN EL TOQUE');
  await p.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1', platform: 'iPhone' });
  await p.go(APP); await sleep(2500); await p.eval('closeSheet(); return 1;');
  await p.eval(ESPIA); await p.eval(SESION);
  await p.click('Perfil', '.tab'); await sleep(500);
  check(/se para para que se oiga, y luego hay que volver a darle al play/.test(await p.text()), 'con sesión de audio (Safari) avisa de que la música de fondo se para y hay que volver a darle al play');
  check((await p.eval('return ES_IOS')) && !(await p.eval("return document.querySelector('#cancion-file').hasAttribute('accept')")), 'en iPhone el selector no filtra: accept="audio/*" deja los mp3 en gris');
  check((await p.eval('return cancion.buf')) === null && !(await p.eval('return actx')), 'la canción sigue guardada, sin descodificar y sin audio despierto');
  await p.eval(`window.__orden = [];
    var AC = window.AudioContext;
    window.AudioContext = function () { window.__orden.push('crea'); return new AC(); };
    var pr = AC.prototype.resume; AC.prototype.resume = function () { window.__orden.push('despierta'); return pr.apply(this, arguments); };
    var pg = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function () { window.__orden.push('lee'); return pg.apply(this, arguments); };
    window.__arr = []; return 1;`);
  await p.click('Probar'); await sleep(900);
  const orden = JSON.parse(await p.eval('return JSON.stringify(window.__orden)'));
  check(orden[0] === 'crea' && orden.indexOf('lee') > 0, '«Probar» crea el audio en el mismo toque, antes de leer la canción guardada: ' + orden.join(' → '));
  s = await espia(p);
  check(s.arr.length === 1 && s.arr[0].off === 0 && s.ctx === 'running', 'y suena desde el principio (contexto: ' + s.ctx + ')');
  check(JSON.stringify(await ses(p)) === '["playback@idle"]', '«Probar» también para la música de fondo mientras suena');
  await p.click('Parar'); await sleep(600);
  check(JSON.stringify(await ses(p)) === '["playback@idle","auto@idle"]', 'y al pararla suelta el audio');

  console.log('\n== iPHONE CON MÚSICA PUESTA: SE PARA MIENTRAS SUENA LA CANCIÓN Y LUEGO SE SUELTA');
  await p.eval('window.__ses = []; return 1;');
  await crono(p, 'amrap', 0.2);
  await sleep(4000);
  check((await ses(p)).length === 0 && (await p.eval('return navigator.audioSession.type')) === 'auto', 'mientras no toca la canción el audio se mezcla: la música de fondo sigue');
  await hasta(p, 'timer.song', 9000);
  let u = await ses(p);
  check(u.length === 1 && /^playback@[45]\./.test(u[0]), 'al entrar la canción pide el audio para ella sola («playback») y el iPhone para la otra música: ' + u.join(' → '));
  await sleep(800);
  await p.click('Pausa'); await hasta(p, "navigator.audioSession.type === 'auto'", 1500);
  u = await ses(p);
  check(u.length === 2 && u[1] === 'auto@paused', 'al pausar se corta y lo suelta');
  await sleep(500);
  await p.click('Reanudar'); await hasta(p, "navigator.audioSession.type === 'playback'", 1500);
  u = await ses(p);
  check(u.length === 3 && /^playback@[0-4]\./.test(u[2]), 'al reanudar lo vuelve a pedir');
  await hasta(p, "timer.status === 'done'", 8000);
  check((await p.eval('return navigator.audioSession.type')) === 'playback' && (await p.eval('return !!timer.song')), 'al acabarse el tiempo lo sigue teniendo mientras suena la cola');
  await hasta(p, "navigator.audioSession.type === 'auto'", 4500);
  u = await ses(p);
  check(u.length === 4 && u[3] === 'auto@done' && !(await p.eval('return !!timer.song')), 'y al apagarse la cola lo suelta: ' + u.join(' → '));

  console.log('\n== PROBAR Y QUITAR');
  await p.click('Perfil', '.tab'); await sleep(500);
  await p.eval('window.__arr = []; return 1;');
  await p.click('Probar'); await sleep(700);
  s = await espia(p);
  check(s.arr.length === 1 && s.arr[0].off === 0 && /^Parar · [45]$/.test(await p.eval("return document.querySelector('[data-action=\"cancion-probar\"]').textContent")), '«Probar» suena desde el principio con la cuenta atrás en el botón');
  await p.click('Parar'); await sleep(600);
  check((await p.eval("return document.querySelector('[data-action=\"cancion-probar\"]').textContent")) === 'Probar' && !(await p.eval('return cancion.prueba')), 'otro toque la para');
  await p.click('Quitar'); await sleep(1200);
  t = await p.text();
  check(/Elegir audio/i.test(t) && !/se-acabo/i.test(t) && !(await p.eval("return localStorage.getItem('llorones:cancion-nombre')")), '«Quitar» la borra del móvil');
  check(/tiene que estar en la app Archivos/.test(t), 'en iPhone, sin canción, dice que el audio tiene que estar en Archivos');
  check(!(await p.eval("return cancionDb('readonly', function (s) { return s.get('final'); })")), 'también de IndexedDB');
  await p.click('Crono', '.tab'); await sleep(500);
  check(!/suena en los últimos/.test(await p.text()), 'y el crono ya no la anuncia');

  const errores = (p.consoleErrors || []).filter((e) => !/ERR_BLOCKED|net::|Failed to load resource/.test(e));
  check(errores.length === 0, 'sin errores de JS' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await p.stop();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\n== RESULTADO:', fails.length ? 'FALLOS -> ' + fails.join(' | ') : 'TODO CORRECTO');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('FALLO GENERAL:', e.message); process.exit(1); });
