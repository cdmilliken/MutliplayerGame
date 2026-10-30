import { env } from 'cloudflare:workers';
import { newRoom, newSoloRoom, advance, act, view } from '../../game.mjs';
export const dynamic = 'force-dynamic';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
function identity(id: unknown) { if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Please refresh and try again.'); return id; }
function name(value: unknown) { if (typeof value !== 'string' || !value.trim() || value.trim().length > 18) throw new Error('Enter a name (1–18 characters).'); return value.trim(); }
async function handle(code: string, id: string, action?: string, data?: any) {
  if (!/^[A-Z]{5}$/.test(code)) return json({ error: 'Enter a five-letter room code.' }, 400);
  const db = env.DB!;
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await db.prepare('SELECT state, revision FROM rooms WHERE code = ? AND expires > ?').bind(code, Date.now()).first<{ state: string; revision: number }>();
    if (!row) return json({ error: 'Room not found or expired. Check the code or create a new room.' }, 404);
    let state = JSON.parse(row.state);
    state = action ? act(state, id, action, data) : advance(state);
    const result = view(state, id);
    const encoded = JSON.stringify(state);
    if (encoded === row.state) return json({ code, ...result });
    const update = await db.prepare('UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?').bind(encoded, code, row.revision).run();
    if (update.meta.changes) return json({ code, ...result });
  }
  return json({ error: 'Room is busy. Please try again.' }, 409);
}
export async function GET(req: Request) {
  try { const q = new URL(req.url).searchParams; return await handle((q.get('code') || '').toUpperCase(), identity(q.get('id'))); }
  catch (e) { return json({ error: e instanceof Error ? e.message : 'Could not reach the room.' }, 400); }
}
export async function POST(req: Request) {
  try {
    const raw = await req.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json({ error: 'Invalid request.' }, 400);
    const data = raw as Record<string, any>; const id = identity(data.id);
    if (data.action === 'create' || data.action === 'create_solo') {
      const playerName = name(data.name);
      for (let i = 0; i < 6; i++) {
        const bytes = crypto.getRandomValues(new Uint8Array(5)); const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const code = [...bytes].map(b => alphabet[b % alphabet.length]).join('');
        const state = data.action === 'create_solo' ? newSoloRoom(id, playerName) : newRoom(id, playerName);
        const r = await env.DB!.prepare('INSERT OR IGNORE INTO rooms (code, state, revision, expires) VALUES (?, ?, 0, ?)').bind(code, JSON.stringify(state), Date.now() + 21600000).run();
        if (r.meta.changes) return json({ code, ...view(state, id) });
      }
      return json({ error: 'Could not create a room. Try again.' }, 503);
    }
    if (data.action === 'join') data.name = name(data.name);
    return await handle(String(data.code || '').toUpperCase(), id, data.action, data);
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Something went wrong. Try again.' }, 400); }
}
