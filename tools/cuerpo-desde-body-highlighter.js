/* Convierte los assets TS de react-native-body-highlighter (MIT, ELABBASSI Hicham) en data/cuerpo.json:
   { viewBox, front: [{ m, d: [...] }], back: [...] } — sin colores ni lados, solo el músculo y sus paths. */
const fs = require('fs');
function lee(f) {
  const src = fs.readFileSync('terceros/' + f, 'utf8');
  const partes = [];
  const re = /slug:\s*"([^"]+)"[\s\S]*?path:\s*\{([\s\S]*?)\n\s*\},?\n\s*\},?/g;
  let m;
  while ((m = re.exec(src))) {
    const d = Array.from(m[2].matchAll(/"([^"]+)"/g)).map((x) => x[1]);
    partes.push({ m: m[1], d });
  }
  return partes;
}
const front = lee('bodyFront.ts'), back = lee('bodyBack.ts');
// caja: se calcula con los extremos de las coordenadas de todos los paths
function caja(partes) {
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  partes.forEach((p) => p.d.forEach((d) => {
    // solo los comandos absolutos M/L/C/Q... con pares; sirve para acotar
    const abs = d.match(/[MLCSQTA][^mlcsqtahvzMLCSQTAHVZ]*/g) || [];
    abs.forEach((seg) => { const nums = (seg.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number); for (let i = 0; i + 1 < nums.length; i += 2) { minx = Math.min(minx, nums[i]); maxx = Math.max(maxx, nums[i]); miny = Math.min(miny, nums[i + 1]); maxy = Math.max(maxy, nums[i + 1]); } });
  }));
  return [minx, miny, maxx, maxy].map((n) => Math.round(n));
}
console.log('front:', front.length, 'partes,', front.reduce((n, p) => n + p.d.length, 0), 'paths · caja', caja(front));
console.log('back: ', back.length, 'partes,', back.reduce((n, p) => n + p.d.length, 0), 'paths · caja', caja(back));
console.log('front slugs:', front.map((p) => p.m + '(' + p.d.length + ')').join(' '));
console.log('back slugs: ', back.map((p) => p.m + '(' + p.d.length + ')').join(' '));
const out = { fuente: 'react-native-body-highlighter (MIT) — https://github.com/HichamELBSI/react-native-body-highlighter', front, back };
fs.writeFileSync('data/cuerpo.json', JSON.stringify(out));
console.log('data/cuerpo.json', (fs.statSync('data/cuerpo.json').size / 1024).toFixed(1), 'KB');
