import assert from 'node:assert/strict';
const base = process.env.GAME_URL || 'http://127.0.0.1:8787';
const ids = [crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
async function post(action, id, extra = {}) {
  const res = await fetch(`${base}/api/room`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ action, id, ...extra })});
  const data = await res.json(); assert.equal(res.status,200, JSON.stringify(data)); return data;
}
assert.equal((await fetch(base)).status,200);
let s = await post('create',ids[0],{name:'Alex'}); const code = s.code;
await Promise.all(ids.slice(1).map((id,i)=>post('join',id,{code,name:['Jules','Sam'][i]})));
s = await post('start',ids[0],{code}); assert.equal(s.players.length,3);
const picks = await Promise.all(ids.map((id,i)=>post('vote',id,{code,round:1,choice:i === 0 ? 0 : 1})));
const read = await fetch(`${base}/api/room?code=${code}&id=${ids[0]}`); s = await read.json();
assert.equal(s.phase,'reveal'); assert.equal(s.winner,0); assert.deepEqual(s.counts,[1,2]);
assert.equal(s.players.find(p=>p.me).score,1); assert.ok(s.players.every(p=>!('id' in p)));
const stranger = await fetch(`${base}/api/room?code=${code}&id=${crypto.randomUUID()}`); assert.equal(stranger.status,400);
console.log(`PASS: HTTP home, create, concurrent joins, host start, concurrent votes, reveal, scoring, token privacy, membership (${base})`);
