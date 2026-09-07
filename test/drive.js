/* Mini-controlador de Chrome por CDP: clics y tecleo reales, sin dependencias.
   Cada instancia = un "móvil" distinto (perfil propio, almacenamiento propio). */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Phone {
  constructor(name, port, opts) {
    this.name = name; this.port = port; this.opts = opts || {};
    this.log = []; this.id = 0; this.pending = new Map();
    this.dir = path.join(os.tmpdir(), 'llorones-' + name.replace(/[^a-z0-9]/gi, '') + '-' + port);
  }
  say(msg) { this.log.push(msg); console.log('   [' + this.name + '] ' + msg); }
  async start() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    this.proc = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--window-size=430,932', '--user-data-dir=' + this.dir,
      '--remote-debugging-port=' + this.port, 'about:blank',
    ], { stdio: 'ignore' });
    for (let i = 0; i < 60; i++) {
      try {
        const list = await (await fetch('http://127.0.0.1:' + this.port + '/json/list')).json();
        const page = list.find((t) => t.type === 'page');
        if (page) { await this._connect(page.webSocketDebuggerUrl); return; }
      } catch (e) { }
      await sleep(400);
    }
    throw new Error('Chrome no arrancó (' + this.name + ')');
  }
  _connect(url) {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = async () => {
        this.ws.onmessage = (ev) => {
          const m = JSON.parse(ev.data);
          if (m.id && this.pending.has(m.id)) { const { ok, ko } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? ko(new Error(m.error.message)) : ok(m.result); }
          if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') this.consoleErrors = (this.consoleErrors || []).concat([(m.params.args[0] || {}).value || 'error']);
          if (m.method === 'Runtime.exceptionThrown') this.consoleErrors = (this.consoleErrors || []).concat([m.params.exceptionDetails.text]);
        };
        await this.send('Page.enable'); await this.send('Runtime.enable');
        await this.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: this.opts.theme || 'dark' }] });
        await this.send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
        res();
      };
      this.ws.onerror = rej;
    });
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((ok, ko) => { this.pending.set(id, { ok, ko }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: '(function(){' + expr + '})()', returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(this.name + ' JS: ' + (r.exceptionDetails.exception || {}).description);
    return r.result.value;
  }
  async go(url) { await this.send('Page.navigate', { url }); await sleep(1200); }
  async text() { return this.eval("return document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText"); }
  async all() { return this.eval("return document.body.innerText"); }
  async find(text, sel) {
    return this.eval(`
      var t = ${JSON.stringify(text)}.toLowerCase();
      var els = Array.prototype.slice.call(document.querySelectorAll(${JSON.stringify(sel || 'button, a, summary, label, .row, .chip, .athlete-card')}));
      var vis = function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      var el = els.filter(function (e) { return vis(e) && (e.innerText || e.getAttribute('aria-label') || '').toLowerCase().indexOf(t) >= 0; })[0];
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), label: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 48) };`);
  }
  async at(sel) {
    return this.eval(`
      var el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      var rr = el.getBoundingClientRect();
      if (!(rr.width > 0 && rr.height > 0) || getComputedStyle(el).visibility === 'hidden') return null;
      el.scrollIntoView({ block: 'center' });
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), label: (el.innerText || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 48) };`);
  }
  async _mouse(p) {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0 });
      await sleep(30);
    }
    await sleep(350);
  }
  async click(text, sel) {
    const p = await this.find(text, sel);
    if (!p) throw new Error(this.name + ': no encuentro "' + text + '"');
    await this._mouse(p); return p.label;
  }
  async clickSel(sel) {
    const p = await this.at(sel);
    if (!p) throw new Error(this.name + ': no encuentro ' + sel);
    await this._mouse(p); return p.label;
  }
  async sheetTitle() { return this.eval("var t = document.querySelector('#sheet-title'); return t ? t.textContent.trim() : null"); }
  async setValue(sel, value) {
    await this.eval(`var el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); return el.value;`);
    await sleep(150);
  }
  async type(sel, value) {
    await this.clickSel(sel);
    await this.eval(`var el = document.querySelector(${JSON.stringify(sel)}); el.value = ''; return 1;`);
    await this.send('Input.insertText', { text: String(value) });
    await this.eval(`var el = document.querySelector(${JSON.stringify(sel)}); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); return el.value;`);
    await sleep(120);
  }
  async select(sel, value) {
    await this.eval(`var el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', {bubbles:true})); return el.value;`);
    await sleep(500);
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
  async stop() { try { this.ws.close(); } catch (e) { } try { this.proc.kill(); } catch (e) { } await sleep(300); try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch (e) { } }
}
module.exports = { Phone, sleep };
