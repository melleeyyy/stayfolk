# StayFolk

**A hospitality exchange — travel like a local, host like a friend.**

StayFolk is a working Couchsurfing-style site: people create a profile, upload photos, find a host in another city, send a stay request, chat, and leave a review. It runs in two modes from the same codebase.

| Mode | What it is | Where |
|---|---|---|
| **Live** | Real accounts, photos, requests and messages shared between people on different devices | `node server/index.js` |
| **Demo** | Everything works but state stays in the browser — no sign-up server needed | GitHub Pages |

**Live demo (browser-only):** https://melleeyyy.github.io/stayfolk/
**Run it for real:** see [Getting started](#getting-started) — one command, no dependencies.

---

## What a person can actually do

1. **Sign up** with a name, email and password (scrypt-hashed, httpOnly cookie session).
2. **Build a profile** — cover photo, avatar, city, bio, languages spoken.
3. **Turn hosting on** — say what space you have, how many guests, whether it is women-only.
4. **Find a host** — filter by city, guests, spoken language, verified-only or women-only; sort by rating, response speed or newness.
5. **Send a request** with dates, number of guests and a personal message.
6. **Answer requests** from the host dashboard — accept or decline.
7. **Chat** — messages are stored on the server and both sides see them, with polling every few seconds.
8. **Leave a review** after a stay; reviews are permanent and two-sided.
9. **Report a profile** if something is wrong.

Plus a **Form C / FRRO checklist** for Indian hosts taking foreign guests — the reporting obligation most hospitality-exchange clones miss — with saved progress and a printable version.

**12 languages** (English default, Hindi, Malayalam, Tamil, French, Spanish, German, Portuguese, Russian, Arabic with full RTL, Korean, Japanese), light and dark themes, installable as a PWA, and usable on a phone.

## Getting started

```bash
git clone https://github.com/melleeyyy/stayfolk.git
cd stayfolk
node server/index.js
```

Open **http://localhost:8787**. That is the whole setup — there are no dependencies to install and no build step.

The first account you create becomes the moderator. Everything is stored in `server/data/`:

```
server/data/db.json      accounts, sessions, requests, threads, messages, reviews
server/data/uploads/     uploaded photos (JPEG, downscaled in the browser first)
```

Delete that folder to start fresh.

To let someone else join, run the server on a machine they can reach and share the address — on the same Wi-Fi that is `http://<your-lan-ip>:8787`.

## Deploying so real people can use it

The site and the API are one Node process, so any Node host works.

**Render (easiest):** push the repo, then *New → Blueprint* and pick `render.yaml`. The free plan sleeps after inactivity and has an **ephemeral disk** — accounts and photos are lost on restart. Uncomment the `disk:` block on a paid instance for permanent storage.

**Fly.io / Railway / a VPS:** the same, with a volume mounted at `/app/server/data`.

**Docker:**

```bash
docker build -t stayfolk .
docker run -p 8080:8080 -v stayfolk-data:/app/server/data stayfolk
```

Whatever you choose, mount `server/data` on a persistent volume — that folder *is* the database.

## Architecture

```
index.html                 app shell
manifest.webmanifest       PWA metadata, icons, shortcuts
sw.js                      service worker (offline app shell)
assets/css/app.css         design system + all components
assets/js/
  api.js                   fetch wrapper + server detection
  store.js                 the whole data layer, in two modes (remote / local)
  app.js                   router, chrome, delegated events, polling, PWA
  views.js                 every screen as a pure render function
  data.js                  24 seed hosts, 18 cities, reviews
  i18n.js                  English source strings + t()
  locales.js               11 translated locales
  locales-extra.js         strings added after v1, merged into the same tables
  media.js                 generated SVG covers and avatars
server/index.js            accounts, sessions, uploads, requests, messaging
test/e2e.js                static-mode smoke test (37 checks)
test/live.js               two real users against the real server (12 checks)
test/audit.js              layout audit: overflow, clipping, contrast, tap targets
```

**How the two modes work.** `server/index.js` injects `<meta name="stayfolk-server">` into the HTML it serves. If `store.js` finds that tag it talks to the API; if it does not (GitHub Pages) it runs the identical UI against localStorage. Views never know the difference — they read one synchronous state object, and mutations return promises.

**Security notes.** Passwords are scrypt-hashed with a per-user salt; sessions are random 24-byte tokens in httpOnly, SameSite=Lax cookies; the upload endpoint only accepts base64 JPEG/PNG/WebP under 6 MB and writes them outside the web root's source tree; the auth endpoints are rate-limited per IP; every message and thread is checked against the signed-in user before it is returned.

## Brand palette

| Token | Hex | Use |
|---|---|---|
| Blue | `#3A79F7` | Primary actions, links, focus rings |
| Green | `#5CC43C` | Verified states, accept actions, accents |
| Black | `#000000` | Ink sections, primary text, brand mark |
| White | `#FFFFFF` | Surfaces, text on ink |

## Tests

```bash
node test/e2e.js      # static demo: 37 checks
node test/live.js     # two people on the real server: 12 checks
node test/audit.js    # layout audit across 4 viewports
```

`test/live.js` boots the server and drives two isolated browser sessions: A signs up and turns hosting on, uploads a photo, B finds A in the directory, sends a request, A accepts, they exchange messages, and a signed-out visitor is refused.

## API

```
POST   /api/auth/signup            { name, email, password, city }
POST   /api/auth/login             { email, password }
POST   /api/auth/logout
GET    /api/bootstrap              everything the client needs for its first paint
PATCH  /api/me                     { name, city, bio, languages, hosting }
POST   /api/me/photo               { kind: avatar|cover, dataUrl }
DELETE /api/me/photo?kind=avatar
POST   /api/requests               { hostId, from, to, guests, message }
PATCH  /api/requests/:id           { status: accepted|declined }  (host only)
POST   /api/threads                { hostId, userId }
GET    /api/threads/:id/messages
POST   /api/threads/:id/messages   { text }
GET    /api/sync?since=ISO_DATE    new messages and requests for polling
POST   /api/reviews                { hostId, rating, text }
POST   /api/reports                { targetType, targetId, reason, detail }
GET    /api/health
```

## Notes for a real launch

- **Stays are free.** The moment money changes hands for accommodation the product becomes a rental marketplace, with a different legal, tax and licensing position.
- **Requests, not bookings.** Hosts keep the right to decline; that asymmetry is what makes the community feel human.
- **Reviews are permanent and two-sided.** Nobody can delete a review written about them.
- **ID documents are never stored** — only a pass/fail result, checked through a KYC provider.
- **India-specific:** a host taking a foreign guest must report the arrival to the local FRO/FRRO or police (Form C, normally within 24 hours). It is built into the product as a checklist.
- **Data protection:** personal data falls under the DPDP Act, 2023 — collect the minimum, state the purpose, and give a deletion path.

## Roadmap

1. **Now** — accounts, profiles, photos, requests, messaging, reviews, 12 languages, PWA.
2. **Next** — email notifications, image galleries, real-time messaging over WebSockets, moderation endpoints for reports and verification.
3. **Later** — events and hangouts, city ambassadors, mobile apps, trust scoring.

## License

MIT — see [LICENSE](LICENSE).
