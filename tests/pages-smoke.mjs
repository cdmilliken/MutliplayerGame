import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const prefix = '/example-repository/';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const path = resolve(root, url.pathname.slice(prefix.length) || 'index.html');
    if (!path.startsWith(root + sep) && path !== resolve(root, 'index.html')) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
try {
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const page = await fetch(base + '?room=ABCDE');
  assert.equal(page.status, 200);
  const html = await page.text();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/github-pages\/assets\/[^" ]+)"/g)].map(m => m[1]);
  assert.equal(assets.length, 2, 'Root index must reference the bundled JS and CSS');
  for (const asset of assets) {
    const res = await fetch(new URL(asset, base));
    assert.equal(res.status, 200, `Asset must load under a repository subpath: ${asset}`);
    const text = await res.text();
    if (asset.endsWith('.js')) {
      assert.ok(text.includes('Play solo'));
      assert.ok(text.includes('create_solo'));
      assert.ok(text.includes('split-decision-party-7k4m.fizzyflint15.chatgpt.site'));
    } else assert.ok(text.includes('.solo-button'));
  }
  assert.equal(await readFile(resolve(root, '.nojekyll'), 'utf8'), '');
  console.log('PASS: GitHub Pages root index, repository-relative JS/CSS, solo UI, backend URL and .nojekyll');
  if (process.env.GAME_URL) {
    const origin = 'https://example.github.io';
    const api = process.env.GAME_URL + '/api/room';
    const preflight = await fetch(api, { method:'OPTIONS', headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'} });
    assert.equal(preflight.status,204); assert.equal(preflight.headers.get('access-control-allow-origin'),'*');
    const res = await fetch(api, { method:'POST', headers:{Origin:origin,'Content-Type':'application/json'}, body:JSON.stringify({action:'create_solo',id:crypto.randomUUID(),name:'Pages QA'}) });
    assert.equal(res.status,200); assert.equal(res.headers.get('access-control-allow-origin'),'*');
    const room = await res.json(); assert.equal(room.mode,'solo'); assert.equal(room.phase,'picking');
    assert.equal(room.players.filter(p=>p.bot).length,4);
    console.log('PASS: live backend permits GitHub Pages origin and starts solo practice with four bots');
  }
} finally { await new Promise(done => server.close(done)); }
