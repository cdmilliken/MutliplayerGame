# Split Decision for Godot

Open `project.godot` in **Godot 4.5 or newer (standard edition)** and press **F5**. Validated by importing, running, and creating a room in Godot 4.7.2. No addons, fonts, assets, or accounts are required. An internet connection is required.

This is a runnable Godot client of the live multiplayer game. Browser and Godot players use the **same rooms and server**. Create a room in either client, then enter its code in the other. Gather at least three players and let the host start.

For a solo test, choose **Play solo · 4 bots** on the home screen. A match starts immediately with Pip, Nova, Mochi, and Ziggy. They pick independently after a short delay, play all five rounds, and appear as BOT in the standings. **Run it back** starts another solo match immediately. Solo practice also needs an internet connection to the shared backend.

Rules are built into both clients: secretly pick one of two options in 20 seconds; the less popular side earns a point; ties and missed turns earn zero. Most points after five rounds wins. Rounds advance automatically, and tied leaders share the win.

## Files

- `project.godot`: importable project, rendering settings, and backend URL.
- `main.tscn`: main scene.
- `main.gd`: complete native UI, anonymous room API, polling, timers, results, and session recovery.

The scene is constructed in GDScript so the project has no external asset dependencies. Resize the window as needed. Godot uses the Compatibility renderer. To test multiple players on one computer, use browser tabs and the Godot client; Godot instances normally share the same saved player identity.

## Hosting your own server

The server source lives in the parent web project (`app/api/room/route.ts`, `app/game.mjs`, and `db/`). It uses Cloudflare D1 for shared room state, optimistic concurrency for simultaneous picks, and server-authoritative scores and time. The Godot project is a network client; importing it does not create an independent local server.

To use another deployment, edit `backend/url` in `project.godot` (or Project Settings with Advanced Settings enabled). Keep it HTTPS for public play. Android exports need the Internet permission enabled. Web exports need hosting plus this API's CORS support. Standard desktop runs need no export setup.

The native client's player token and room code are saved locally in `user://session.cfg`. Back to home forgets the room. Rooms expire six hours after creation. A failed connection retries automatically.
