# StayFolk

**A hospitality exchange — travel like a local, host like a friend.**

StayFolk is a fully working product demo of a Couchsurfing-style community: free stays with verified local hosts, a request → accept → chat → review loop, a host dashboard, and a moderation console. It runs as a static site on GitHub Pages with no backend required, and ships with a small reference API server for when you outgrow the browser.

**Live demo:** https://headquarterz.github.io/stayfolk/

---

## What is in here

| Area | What it does |
|---|---|
| **Home** | Hero search, how-it-works, featured hosts, city grid, trust pillars |
| **Explore** | Filter by city, guests, spoken language, verified-only, women-only; sort by rating, response speed or newness |
| **Host profile** | Bio, space details, house rules, languages, references, reviews, request modal, report flow |
| **Cities** | 18 city pages with their hosts |
| **Request flow** | Date range + guests + personal message → appears instantly in the host's dashboard |
| **Host dashboard** | Incoming requests with accept / decline, stats, hosting profile, ID verification request |
| **Guest dashboard** | "My trips" — every request you have sent and its status |
| **Messaging** | Threaded conversations opened from a request or a response |
| **Moderation console** | Report queue, ID-verification queue, member list, resolve / ban actions |
| **Safety centre** | Trust model, reporting, emergency guidance |
| **Auth** | Sign up, log in, session persistence — all local, no server needed |
| **12 languages** | English (default), Hindi, Malayalam, Tamil, French, Spanish, German, Portuguese, Russian, Arabic (full RTL), Korean, Japanese |
| **Themes** | Light and dark, remembered between visits |

## Tech

- **Vanilla ES modules** — no framework, no build step, no dependencies. The whole app is ~2,000 lines of readable JavaScript.
- **Hash router** (`#/host/h1`) so it deploys to GitHub Pages with no server rewrites.
- **localStorage store** mirroring the REST API shape, so swapping in the real backend is a matter of replacing one module.
- **Inline SVG imagery** — covers and avatars are generated data-URIs from the brand palette. Zero external image or font requests; the site works offline.
- **Node reference API** in `server/` — zero dependencies, scrypt password hashing, JSON persistence.

## Brand palette

The design system is built on exactly four colours, taken from the project brief:

| Token | Hex | Use |
|---|---|---|
| Blue | `#3A79F7` | Primary actions, links, focus rings |
| Green | `#5CC43C` | Verified states, accept actions, accents |
| Black | `#000000` | Ink sections, primary text, brand mark |
| White | `#FFFFFF` | Surfaces, text on ink |

## Run it locally

Any static server works:

```bash
# option 1 — the bundled API server also serves the static site
node server/index.js          # → http://localhost:8787

# option 2 — plain static
npx serve .                   # or: python3 -m http.server 8000
```

Then open the printed URL. No install step, no build.

## Demo accounts

The demo seeds three accounts (password `demo1234` for all):

| Role | Email | Lands on |
|---|---|---|
| Host | `host@stayfolk.demo` | Host dashboard with three incoming requests |
| Guest | `guest@stayfolk.demo` | My trips |
| Moderator | `admin@stayfolk.demo` | Moderation console with three open reports |

Or sign up — new accounts are stored in your browser only.

## Project structure

```
index.html                 app shell
assets/css/app.css         design system + all components
assets/js/
  app.js                   router, chrome, delegated events, toasts
  views.js                 every screen as a pure render function
  store.js                 localStorage state (users, requests, threads…)
  data.js                  24 hosts, 18 cities, reviews, seed data
  i18n.js                  English source strings + t()
  locales.js               11 translated locales
  media.js                 generated SVG covers and avatars
server/index.js            zero-dependency reference API
test/e2e.js                headless-Chromium smoke test (32 checks)
```

## Tests

```bash
node test/e2e.js
```

Drives the real site in headless Chromium: every route, all 12 locales, filters, login, request → accept → message, admin resolution, dark mode and mobile overflow. 32/32 passing.

## Deploying to GitHub Pages

The repo is already configured: **Settings → Pages → Deploy from branch → `main` / root**. Any push to `main` republishes the site at `https://<user>.github.io/stayfolk/`.

## API reference (optional backend)

```
POST   /api/auth/signup          { name, email, password, city }
POST   /api/auth/login           { email, password } → { token, user }
GET    /api/me                   Bearer token
GET    /api/hosts?city=&language=&verified=1&women=1
GET    /api/hosts/:id
POST   /api/requests             { hostId, from, to, guests, message }
GET    /api/requests             → { outgoing, incoming }
PATCH  /api/requests/:id         { status: accepted | declined }  (host only)
GET    /api/threads
GET    /api/threads/:id/messages
POST   /api/threads/:id/messages { text }
POST   /api/reports              { targetType, targetId, reason, detail }
GET    /api/health
```

## Notes for a real launch

This is a demo, but the product decisions behind it are deliberate:

- **Stays are free.** The moment money changes hands for accommodation the product becomes a rental marketplace, with a different legal, tax and licensing position.
- **Requests, not bookings.** Hosts keep the right to decline; that asymmetry is what makes the community feel human.
- **Reviews are permanent and two-sided.** Nobody can delete a review written about them.
- **ID documents are never stored** — only a pass/fail result, checked through a KYC provider.
- **India-specific:** when a foreign guest stays with an Indian host, the host must report the arrival to the local FRRO / police (Form C under the Registration of Foreigners Act, normally within 24 hours). Surface this in host onboarding.
- **Data protection:** personal data and ID checks fall under the DPDP Act, 2023 — collect the minimum, state the purpose, and give a deletion path.

## Roadmap

1. **Phase 1 (this build)** — static demo, complete UX, local state.
2. **Phase 2** — real API, Postgres, KYC integration, email notifications, image uploads.
3. **Phase 3** — PWA install, push notifications, events and hangouts, city ambassadors.
4. **Phase 4** — mobile apps, moderation tooling at scale, trust scoring.

## License

MIT — see [LICENSE](LICENSE).
