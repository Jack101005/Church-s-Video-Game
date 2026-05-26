# Together We Rise — Online Co-op Bible Adventure

A real-time, room-based multiplayer co-op platformer. One person **hosts**, everyone else
**scans a QR code** (or enters a 4-letter code) to join from their own phone. Up to **6 players**.
Five cooperative, Bible-themed levels — nobody finishes a level until **everyone** reaches the flag.

Built with: Node + Express + Socket.IO (server) and a single HTML5 canvas game (client).

---

## How the multiplayer works (the short version)

This uses a **host-authoritative** model:

- The **host's browser runs the game physics** and, ~20 times a second, sends a small
  "snapshot" of where everyone is.
- **Joiners don't run physics.** They send their button presses (input) up to the host and
  draw whatever the latest snapshot says.
- The **server** (`server.js`) is just the meeting point: it creates rooms, tracks who's in
  each one, and relays messages between host and joiners.

Tradeoff to know: if the **host closes their tab, the room ends** for everyone. That's normal
and fine for a friend group. Just make sure the most stable connection hosts.

---

## Run it locally first (recommended before deploying)

You need **Node 18+**. Check with `node --version`.

```bash
# 1. install dependencies
npm install

# 2. start the server
npm start
```

You'll see: `Together We Rise server running on port 3000`

Now open **two browser tabs** to test the sync by yourself:

1. Tab 1 → `http://localhost:3000` → **Host a Game** → make a character → you'll get a room code.
2. Tab 2 → `http://localhost:3000` → **Join a Game** → type the code → make a character.
3. Back in Tab 1 (the host), click **Start Game**.
4. Drive your character in each tab — you should see both move in both tabs.

> **Camera note:** On `localhost` the selfie camera works. If you open the raw file with no
> server it won't. Everyone who skips the camera just gets a colored character with their
> initial — the game still works fine.

> **Same-wifi phones (optional):** others on your wifi can join at `http://<your-mac-ip>:3000`
> (find your IP in System Settings → Wi-Fi → Details). But for friends on *other* networks,
> you must deploy (below) so the link is public.

---

## Deploy to Railway (so the QR works from anywhere)

1. Push this folder to a **GitHub repo**.
2. Go to **railway.app** → **New Project** → **Deploy from GitHub repo** → pick the repo.
3. Railway auto-detects Node, runs `npm install`, then `npm start`. No config needed —
   the server already reads `process.env.PORT`, which Railway sets automatically.
4. Once deployed, open **Settings → Networking → Generate Domain** to get a public URL like
   `https://your-app.up.railway.app`.
5. Open that URL, **Host a Game**, and the QR code on screen now points to the public URL.
   Friends scan it from any phone, anywhere, and join.

> Railway's free usage may sleep an idle app. Open the URL once a minute before your session
> to "warm it up" so the first player isn't waiting.

> The public Railway URL is **https**, so the selfie camera works for everyone — no extra setup.

---

## Playing on Thursday — quick run of show

1. Host opens the Railway URL, makes their character, shares the QR (screen-share on your call,
   or just paste the link in the group chat).
2. Everyone joins, picks a color, takes a selfie (or skips).
3. Host hits **Start Game**.
4. Each level opens with a **verse card** — good moment to read it aloud and tie into your sharing.
5. Controls (each person, on their own phone): **◀ ▶** move, **▲** jump, **BOOST** to fling a
   nearby teammate up and across a gap. Get everyone to the flag together!

---

## Files

| File | What it is |
|------|-----------|
| `server.js` | Express + Socket.IO server: rooms, QR endpoint, input/snapshot relay. Heavily commented. |
| `public/index.html` | The whole game client (lobby, selfie, QR, physics, rendering, networking). |
| `package.json` | Dependencies and the `npm start` script. |
| `.nvmrc` / `.gitignore` | Node version pin and git ignore for clean deploys. |

## Tweaks you might want

- **Max players:** change the `>= 6` check in `server.js` (`joinRoom` handler) and the color list.
- **Levels / verses:** edit the `LEVELS` array near the top of the game script in `index.html`.
- **Boost strength / reach:** `BOOST_POWER` and the `TILE*2.2` radius in `index.html`.
- **Snapshot rate:** the `snapAcc < 50` line in `index.html` (50ms ≈ 20/sec).
