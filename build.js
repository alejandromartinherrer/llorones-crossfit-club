// Build: src/index.html + src/app.css + src/app.js + data/*.json  ->  dist/index.html (GitHub Pages) y dist/artifact.html
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('src/index.html');
const css = read('src/app.css');
let js = read('src/app.js');
const heroes = JSON.parse(read('data/heroes.json'));
const girls = JSON.parse(read('data/girls.json'));
const LS = String.fromCharCode(8232), PS = String.fromCharCode(8233);
const safe = (o) => JSON.stringify(o).split('</script').join('<\/script').split(LS).join('\u2028').split(PS).join('\u2029');
js = js.replace('/*__HEROES__*/[]', () => safe(heroes)).replace('/*__GIRLS__*/[]', () => safe(girls));
const out = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), out);
// versión para Artifact (sin doctype/html/head/body: el publicador la envuelve)
const inner = out.replace(/^[\s\S]*?<head>/, '').replace(/<\/head>\s*<body>/, '').replace(/<\/body>\s*<\/html>\s*$/, '').replace(/<meta charset="utf-8">\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
fs.writeFileSync(path.join(root, 'dist/artifact.html'), inner);
console.log('dist/index.html', (out.length / 1024).toFixed(0) + ' KB', '· heroes', heroes.length, '· girls', girls.length);
