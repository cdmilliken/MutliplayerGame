import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRoom, newSoloRoom, act, advance, view } from '../app/game.mjs';
function lobby(count = 3) {
  let s = newRoom('a', 'Alex', 0);
  for (let i = 1; i < count; i++) s = act(s, String.fromCharCode(97+i), `join`, { name: `Friend ${i}` }, 0);
  return s;
}
function started(count = 3) { return act(lobby(count), 'a', 'start', {}, 100); }
test('host, minimum players, room membership and capacity are enforced', () => {
  assert.throws(() => act(newRoom('a','Alex',0), 'a','start',{},0), /at least 3/);
  assert.throws(() => act(lobby(), 'b','start',{},0), /host/);
  assert.throws(() => view(lobby(),'outsider'), /Join/);
  assert.throws(() => act(lobby(12),'m','join',{name:'Extra'},0), /full/);
  assert.throws(() => act(started(),'d','join',{name:'Late'},101), /started/);
});
test('votes and player tokens stay secret until reveal', () => {
  const s = act(started(),'a','vote',{choice:0,round:1},101);
  const publicView = view(s,'b',102);
  assert.equal(publicView.choice,null);
  assert.equal(publicView.voted,1);
  assert.equal(publicView.players[0].choice,undefined);
  assert.equal(publicView.players[0].id,undefined);
  assert.equal(publicView.prompt.length,5);
  assert.equal(publicView.deck,undefined);
  assert.throws(() => act(s,'a','vote',{choice:1,round:1},103),/locked/);
  assert.throws(() => act(s,'b','vote',{choice:1,round:2},103),/new round/);
});
test('minority scores exactly once and all picks reveal early', () => {
  let s = started();
  for (const [id,choice] of [['a',0],['b',1],['c',1]]) s = act(s,id,'vote',{choice,round:1},101);
  assert.equal(s.phase,'reveal'); assert.equal(s.winner,0);
  assert.deepEqual(s.players.map(p=>p.score),[1,0,0]);
  advance(s,102); advance(s,103);
  assert.deepEqual(s.players.map(p=>p.score),[1,0,0]);
  assert.equal(view(s,'b',103).players[0].choice,0);
});
test('ties, missed picks, and empty winning side score zero', () => {
  let tie = started(4);
  for (const [i,id] of ['a','b','c','d'].entries()) tie = act(tie,id,'vote',{choice:i%2,round:1},101);
  assert.equal(tie.winner,null); assert.ok(tie.players.every(p=>p.score === 0));
  let missing = started(); missing = act(missing,'a','vote',{choice:0,round:1},101);
  advance(missing,20100); assert.equal(missing.phase,'reveal'); assert.equal(missing.winner,1);
  assert.ok(missing.players.every(p=>p.score === 0));
  let nobody = started(); advance(nobody,20100); assert.equal(nobody.winner,null);
});
test('five complete rounds finish and rematch resets room scores', () => {
  let s = started(); let now = 101;
  for (let round = 1; round <= 5; round++) {
    for (const [id,choice] of [['a',0],['b',1],['c',1]]) s = act(s,id,'vote',{choice,round},now);
    assert.equal(s.phase,'reveal'); now += 6500; advance(s,now);
    assert.equal(s.phase,round === 5 ? 'finished' : 'picking'); now++;
  }
  assert.equal(s.players[0].score,5);
  s = act(s,'b','rematch',{},now);
  assert.equal(s.phase,'lobby'); assert.equal(s.host,'b'); assert.equal(s.players.length,3);
  assert.ok(s.players.every(p=>p.score === 0)); assert.equal(s.round,0);
});
test('solo starts with four labeled bots and private committed decisions', () => {
  const s = newSoloRoom('a', 'Alex', 100);
  assert.equal(s.phase, 'picking'); assert.equal(s.round, 1);
  assert.equal(s.players.length, 5); assert.equal(s.players.filter(p => p.bot).length, 4);
  assert.equal(new Set(s.players.map(p => p.id)).size, 5);
  const snapshot = JSON.stringify(s.botPlans);
  const v = view(s, 'a', 101);
  assert.equal(v.mode, 'solo'); assert.equal(v.botPlans, undefined);
  assert.ok(v.players.filter(p => p.bot).every(p => p.choice === undefined));
  act(s, 'a', 'vote', { choice: 0, round: 1 }, 101);
  assert.equal(JSON.stringify(s.botPlans), snapshot);
  assert.equal(s.phase, 'picking');
  advance(s, 6100); assert.equal(s.phase, 'reveal');
  assert.equal(Object.keys(s.votes).length, 5);
  assert.throws(() => act(s, 'outsider', 'join', { name: 'Guest' }, 6101), /solo practice/);
});
test('solo plays five scored rounds and immediately rematches with four fresh bots', () => {
  let s = newSoloRoom('a', 'Alex', 100); let now = 101;
  let humanScore = 0;
  for (let round = 1; round <= 5; round++) {
    const minorityChoice = Object.values(s.botPlans).filter(p => p.choice === 0).length <= 2 ? 0 : 1;
    s = act(s, 'a', 'vote', { choice: minorityChoice, round }, now);
    assert.equal(s.phase, 'picking');
    advance(s, now + 6000); assert.equal(s.phase, 'reveal');
    const counts = [0, 0]; Object.values(s.votes).forEach(v => counts[v]++);
    assert.deepEqual(s.counts, counts);
    if (s.winner === minorityChoice) humanScore++;
    assert.equal(s.players[0].score, humanScore);
    const before = s.players.map(p => p.score); advance(s, now + 6001);
    assert.deepEqual(s.players.map(p => p.score), before);
    now += 12500; advance(s, now);
    assert.equal(s.phase, round === 5 ? 'finished' : 'picking'); now++;
  }
  s = act(s, 'a', 'rematch', {}, now);
  assert.equal(s.mode, 'solo'); assert.equal(s.phase, 'picking'); assert.equal(s.round, 1);
  assert.equal(s.players.filter(p => p.bot).length, 4);
  assert.ok(s.players.every(p => p.score === 0)); assert.equal(Object.keys(s.votes).length, 0);
});
test('solo bots vote without the human and a missed turn still advances', () => {
  const s = newSoloRoom('a', 'Alex', 100);
  advance(s, 6100); assert.equal(s.phase, 'picking');
  assert.equal(Object.keys(s.votes).length, 4); assert.equal(s.players[0].score, 0);
  advance(s, 20100); assert.equal(s.phase, 'reveal');
  assert.equal(s.players[0].score, 0); assert.equal(view(s, 'a', 20101).choice, null);
  advance(s, 26600); assert.equal(s.round, 2); assert.equal(s.phase, 'picking');
  assert.equal(Object.keys(s.votes).length, 0); assert.equal(Object.keys(s.botPlans).length, 4);
});
