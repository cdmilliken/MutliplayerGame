export const prompts = [
  ['Your next escape?', 'Mountains', 'Ocean', '△', '≈'],
  ['Pick a superpower.', 'Time travel', 'Read minds', '◷', '✦'],
  ['The better late-night snack?', 'Pizza', 'Ice cream', '◭', '♧'],
  ['You get one free ticket.', 'Space', 'Deep sea', '✧', '≈'],
  ['Your ideal sidekick?', 'Tiny dragon', 'Giant cat', '♨', 'ฅ'],
  ['Choose your chaos.', '100 duck-sized horses', '1 horse-sized duck', '♞', '◕'],
  ['One forever forecast.', 'Always summer', 'Always winter', '☀', '❄'],
  ['You can only keep one.', 'Music', 'Movies', '♫', '▣'],
  ['A mystery door appears.', 'Open it', 'Walk away', '◩', '➜'],
  ['Pick your home base.', 'Treehouse', 'Houseboat', '♧', '⚓'],
  ['The ultimate breakfast?', 'Sweet', 'Savory', '◉', '✳'],
  ['Your new schedule?', 'Night owl', 'Early bird', '☾', '☀'],
  ['One incredible talent.', 'Speak every language', 'Play every instrument', '✺', '♫'],
  ['Surprise trip. Where to?', 'Big city', 'Middle of nowhere', '▥', '△'],
  ['Pick a tiny inconvenience.', 'Always 5 minutes early', 'Always 5 minutes late', '−', '+'],
  ['Your dream dinner guest?', 'Past you', 'Future you', '↶', '↷'],
];
export function newRoom(id, name, now = Date.now()) {
  return { host: id, players: [{ id, name, score: 0 }], phase: 'lobby', round: 0, deadline: 0, votes: {}, deck: [...prompts].sort(() => Math.random() - .5).slice(0, 5), created: now };
}
function startRound(s, now) {
  s.round++; s.phase = 'picking'; s.votes = {}; s.deadline = now + 20000;
  // Commit bot decisions before the human picks. Neither choices nor times reach clients.
  s.botPlans = Object.fromEntries(s.players.filter(p => p.bot).map(p => [p.id, {
    choice: Math.random() < .5 ? 0 : 1, at: now + 2000 + Math.floor(Math.random() * 4000),
  }]));
}
export function newSoloRoom(id, name, now = Date.now()) {
  const s = newRoom(id, name, now);
  s.mode = 'solo';
  for (const [i, botName] of ['Pip', 'Nova', 'Mochi', 'Ziggy'].entries()) {
    s.players.push({ id: `bot-${i}`, name: botName, score: 0, bot: true });
  }
  startRound(s, now);
  return s;
}
export function advance(s, now = Date.now()) {
  if (s.phase === 'picking') {
    for (const p of s.players.filter(p => p.bot)) {
      const plan = s.botPlans?.[p.id];
      if (plan && plan.at <= Math.min(now, s.deadline) && s.votes[p.id] === undefined) s.votes[p.id] = plan.choice;
    }
  }
  if (s.phase === 'picking' && (now >= s.deadline || s.players.every(p => s.votes[p.id] !== undefined))) {
    const counts = [0, 0]; Object.values(s.votes).forEach(v => counts[v]++);
    s.winner = counts[0] === counts[1] ? null : counts[0] < counts[1] ? 0 : 1;
    for (const p of s.players) if (s.winner !== null && s.votes[p.id] === s.winner) p.score++;
    s.counts = counts; s.phase = 'reveal'; s.deadline = now + 6500;
  } else if (s.phase === 'reveal' && now >= s.deadline) {
    if (s.round === 5) { s.phase = 'finished'; s.deadline = 0; }
    else startRound(s, now);
  }
  return s;
}
export function act(s, id, action, data, now = Date.now()) {
  advance(s, now);
  const player = s.players.find(p => p.id === id);
  if (action === 'join') {
    if (player) return s;
    if (s.mode === 'solo') throw new Error('This is a solo practice game. Create a multiplayer room to play with friends.');
    if (s.phase !== 'lobby') throw new Error('This game has started. Ask your friends to play again after the final round.');
    if (s.players.length >= 12) throw new Error('This room is full (12 players).');
    s.players.push({ id, name: data.name, score: 0 }); return s;
  }
  if (!player) throw new Error('Join this room first.');
  if (action === 'start') {
    if (id !== s.host) throw new Error('Only the host can start.');
    if (s.phase !== 'lobby') throw new Error('The game has already started.');
    if (s.players.length < 3) throw new Error('Invite at least 3 players to start.');
    startRound(s, now);
  } else if (action === 'vote') {
    if (s.phase !== 'picking') throw new Error('This round is closed.');
    if (data.round !== s.round) throw new Error('A new round has started. Pick again.');
    if (data.choice !== 0 && data.choice !== 1) throw new Error('Choose a side.');
    if (s.votes[id] !== undefined) throw new Error('Your pick is already locked in.');
    s.votes[id] = data.choice; advance(s, now);
  } else if (action === 'rematch') {
    if (s.phase !== 'finished') throw new Error('Finish this game first.');
    s = s.mode === 'solo' ? newSoloRoom(id, player.name, now) : { ...newRoom(id, player.name, now), players: s.players.map(p => ({ ...p, score: 0 })) };
  } else throw new Error('Unknown action.');
  return s;
}
export function view(s, id, now = Date.now()) {
  if (!s.players.some(p => p.id === id)) throw new Error('Join this room first.');
  const reveal = s.phase === 'reveal' || s.phase === 'finished';
  return { mode: s.mode || 'multiplayer', phase: s.phase, round: s.round, deadline: s.deadline, serverNow: now, isHost: id === s.host, prompt: s.round ? s.deck[s.round - 1] : null,
    players: s.players.map(p => ({ name: p.name, score: p.score, bot: !!p.bot, me: p.id === id, host: p.id === s.host, voted: s.votes[p.id] !== undefined, ...(reveal ? { choice: s.votes[p.id] ?? null } : {}) })),
    choice: s.votes[id] ?? null, voted: Object.keys(s.votes).length, ...(reveal ? { winner: s.winner, counts: s.counts } : {}) };
}
