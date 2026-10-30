import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
const base = process.env.GAME_URL || 'http://127.0.0.1:8787';
const id = crypto.randomUUID();
async function post(action, extra = {}) {
  const res = await fetch(`${base}/api/room`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,id,...extra}) });
  const data = await res.json(); assert.equal(res.status,200,JSON.stringify(data)); return data;
}
let s = await post('create_solo',{name:'Solo QA'}); const code = s.code;
assert.equal(s.mode,'solo'); assert.equal(s.phase,'picking'); assert.equal(s.players.length,5);
assert.equal(s.players.filter(p=>p.bot).length,4); assert.equal(s.botPlans,undefined);
const until = Date.now()+180000;
async function pollUntil(predicate) {
  while (!predicate(s)) {
    assert.ok(Date.now()<until,'Solo match stalled'); await delay(600);
    const res=await fetch(`${base}/api/room?code=${code}&id=${id}`); s=await res.json(); assert.equal(res.status,200,JSON.stringify(s));
  }
}
for(let round=1;round<=5;round++) {
  await pollUntil(s=>s.phase==='picking' && s.round===round);
  s=await post('vote',{code,round,choice:round%2});
  await pollUntil(s=>s.phase==='reveal' && s.round===round);
  assert.equal(s.voted,5); assert.equal(s.counts.reduce((a,b)=>a+b,0),5);
  assert.ok(s.players.filter(p=>p.bot).every(p=>p.voted && [0,1].includes(p.choice)));
  console.log(`PASS: solo round ${round}, four bot votes, five total picks, scored reveal`);
}
await pollUntil(s=>s.phase==='finished');
s=await post('rematch',{code}); assert.equal(s.mode,'solo'); assert.equal(s.phase,'picking');
assert.equal(s.round,1); assert.equal(s.players.filter(p=>p.bot).length,4); assert.ok(s.players.every(p=>p.score===0));
console.log(`PASS: full solo match and immediate four-bot rematch (${base})`);
