/* Capturas de la app con los datos REALES de la nube (rama data del repositorio).
   Recorre la app como un usuario (clics de verdad) en un móvil emulado de 430x932.
   Uso: node shots.js   ->  shots/*.png */
const fs = require('fs');
const path = require('path');
const { Phone, sleep } = require('./drive');

const APP = process.env.APP_URL || 'http://127.0.0.1:8765/dist/index.html';
const CLOUD_API = 'https://api.github.com/repos/alejandromartinherrer/llorones-crossfit-club/contents/data/sync.json?ref=data';
const TOKEN = fs.readFileSync(path.join(__dirname, 'gh_token.txt'), 'utf8').trim();
const OUT = path.join(__dirname, 'shots');

async function movil(nombre, port, theme, cloud, meId) {
  const p = new Phone(nombre, port, { theme });
  await p.start();
  await p.go(APP);
  await p.eval(`
    localStorage.clear();
    localStorage.setItem('llorones:athletes', ${JSON.stringify(JSON.stringify(cloud.athletes || {}))});
    localStorage.setItem('llorones:workouts', ${JSON.stringify(JSON.stringify(cloud.workouts || {}))});
    localStorage.setItem('llorones:results', ${JSON.stringify(JSON.stringify(cloud.results || {}))});
    localStorage.setItem('llorones:me', ${JSON.stringify(meId)});
    return 'ok';`);
  await p.go(APP);
  await sleep(2500);
  return p;
}

(async () => {
  const cloud = await (await fetch(CLOUD_API + '&t=' + Date.now(), { headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github.raw' }, cache: 'no-store' })).json();
  const atletas = Object.values(cloud.athletes || {});
  if (!atletas.length) throw new Error('la nube está vacía');
  const yo = atletas.find((a) => /^(Álex|Alex)$/i.test(a.name)) || atletas[0];
  console.log('nube:', atletas.map((a) => a.name).join(', '), '·', Object.keys(cloud.results || {}).length, 'marcas');
  fs.rmSync(OUT, { recursive: true, force: true });

  const p = await movil('Shots', 9341, 'dark', cloud, yo.id);
  await p.shot(path.join(OUT, '1-hoy.png')); console.log('  1-hoy');

  await p.click('Ranking', '.tab'); await sleep(900);
  await p.click(yo.name, '.lb-row'); await sleep(600);
  await p.shot(path.join(OUT, '2-ranking.png')); console.log('  2-ranking');

  await p.click('Entrenos', '.tab'); await sleep(800);
  await p.shot(path.join(OUT, '3-entrenos.png')); console.log('  3-entrenos');

  await p.type('#wod-search', 'murph'); await sleep(800);
  await p.click('Murph', '.row'); await sleep(900);
  await p.shot(path.join(OUT, '4-murph.png')); console.log('  4-murph');

  await p.click('Entrenos', '.tab'); await sleep(700);
  await p.click('Nuestros', '.segmented button'); await sleep(700);
  await p.click('Jueves', '.row'); await sleep(900);
  await p.shot(path.join(OUT, '5-nuestro-wod.png')); console.log('  5-nuestro-wod');

  await p.click('Cronómetro'); await sleep(900);
  for (let i = 0; i < 10; i++) await p.clickSel('[data-action="step"][data-id="prepSec"][data-d="-1"]');
  await p.click('Empezar'); await sleep(1500);
  await p.click('+1 ronda'); await sleep(800);
  await p.click('+1 ronda'); await sleep(2500);
  await p.shot(path.join(OUT, '6-crono.png')); console.log('  6-crono');
  await p.stop();

  const claro = await movil('Claro', 9342, 'light', cloud, yo.id);
  await claro.shot(path.join(OUT, '7-hoy-claro.png')); console.log('  7-hoy-claro');
  await claro.click('Ranking', '.tab'); await sleep(900);
  await claro.shot(path.join(OUT, '8-ranking-claro.png')); console.log('  8-ranking-claro');
  await claro.stop();
  console.log('listo →', OUT);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
