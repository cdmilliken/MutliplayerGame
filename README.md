# Split Decision

An anonymous multiplayer party game for 3–12 friends. Five rounds of picking the less popular of two options. Secret votes, server timers, shared scores, room codes, and rematches. Phone and laptop browsers work without accounts or installation.

To playtest alone, choose **Play solo · 4 bots** in the browser or Godot client. It starts immediately with four independently voting bots, runs all five rounds, and supports instant rematches. Bot picks are committed before the human choice, remain secret until reveal, and use the same server scoring and timers. Internet access is required.

## Godot

Import [`godot/project.godot`](godot/project.godot) in Godot 4.5+ and press F5. Godot and web players share rooms. The configured backend is the public deployment. See [`godot/README.md`](godot/README.md). The website also serves `public/split-decision-godot.zip` for downloading the importable project.

## Web development

Node 22.13+ required. On Windows use `npm.cmd` where PowerShell blocks `npm.ps1`.

1. `npm ci`
2. `npm run build`
3. Apply the local database migration once:
   `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_high_mimic.sql`
4. `npm start` serves the built game at http://127.0.0.1:8787. For editing with hot reload use `npm run dev` instead.

The Sites workflow provisions hosted D1 and applies tracked migrations. `.openai/hosting.json` records the site identity and the DB binding. Use the Sites workflow to publish updates.

## Checks

- `node --test tests/game.test.mjs`: full game, privacy, room capacity, host permissions, ties, missed picks, and rematches.
- `node node_modules/typescript/bin/tsc --noEmit`: type checking.
- With the local built server running, `node tests/api-smoke.mjs`: simultaneous joins and votes over real HTTP. Set `GAME_URL` to test another deployment.
- `godot --headless --path godot --editor --import --quit`: import validation.
- `godot --headless --path godot --quit-after 10`: scene startup.
- With the local server running, `godot --headless --path godot --script res://tests/smoke.gd`: native UI, room creation, response rendering, and polling.

## Architecture

`app/game.mjs` owns authoritative transitions and sanitized views. `app/api/room/route.ts` validates anonymous player tokens and applies room changes to D1 using compare-and-swap revisions. Concurrent requests retry rather than lose votes. Responses hide other players’ picks until reveal and never return player tokens. Clients poll every second. The server validates round numbers and deadlines, scores once, and advances rounds without host input. CORS supports Godot web exports as well as native clients.

Each browser tab has its own session token; refreshing reconnects. Godot saves its token locally. Rooms expire six hours after creation. Rooms require three players to start and accept new players only in the lobby. Returning home does not remove a participant from a running match; missed votes earn zero and never prevent rounds from advancing. An internet connection and the shared backend are required in both clients.

The Godot client and shared API were tested in Godot 4.7.2. Browser HTTP behavior, game rules, production build, and TypeScript were verified; visual browser QA was unavailable in this environment.
