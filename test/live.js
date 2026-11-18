/**
 * StayFolk — live two-person test.
 * Boots the real server, then drives two independent browser sessions:
 * A signs up and turns hosting on, B finds A and sends a request, A accepts,
 * they exchange messages, and both see the other's replies after a reload.
 */
'use strict';

process.env.PORT = '8790';
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const DB_DIR = path.join(__dirname, '..', 'server', 'data');
fs.rmSync(DB_DIR, { recursive: true, force: true });

const server = require('../server/index.js');
const BASE = 'http://127.0.0.1:8790';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(600);

  const browser = await puppeteer.launch({
    executablePath: '/usr/local/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900 },
  });

  const newContext = () =>
    browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext();

  const ctxA = await newContext();
  const ctxB = await newContext();
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  const errors = [];
  for (const [name, page] of [['A', A], ['B', B]]) {
    page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  }

  // A hash-only goto does not reload the document, so the app would keep its
  // old state. Bump the query string to force a real server round trip.
  const hardNav = async (page, hash) => {
    await page.goto(`${BASE}/?n=${Date.now()}#${hash}`, { waitUntil: 'networkidle2' });
    await sleep(900);
  };

  const signUp = async (page, name, email, city) => {
    await page.goto(BASE + '/#/signup', { waitUntil: 'networkidle2' });
    await sleep(400);
    await page.type('#a-name', name);
    await page.type('#a-city', city);
    await page.type('#a-email', email);
    await page.type('#a-pass', 'secret123');
    await page.click('#auth-form button[type="submit"]');
    await sleep(900);
  };

  /* ---- 1. account A ---- */
  await signUp(A, 'Anjali Nair', 'anjali@example.com', 'Kochi');
  const aBody = await A.evaluate(() => document.querySelector('#main').innerText);
  check('A signs up and lands on the dashboard', aBody.includes('Anjali Nair'), aBody.slice(0, 40).replace(/\n/g, ' '));

  /* ---- 2. A completes a profile and turns hosting on ---- */
  await A.evaluate(() => { window.location.hash = '#/dashboard/profile'; });
  await sleep(500);
  await A.type('#p-bio', 'I live near Fort Kochi and cook a serious Kerala breakfast.');
  await A.select('#p-langs', 'English', 'Malayalam');
  await A.type('#p-space', 'Private room · Fort Kochi');
  await A.click('input[name="hosting"]');
  await sleep(200);
  await A.click('#profile-form button[type="submit"]');
  await sleep(900);
  const savedToast = await A.evaluate(() => {
    const t = [...document.querySelectorAll('.toast')];
    return t.length ? t[t.length - 1].innerText : '';
  });
  check('A saves a hosting profile', savedToast.includes('Profile saved'), savedToast);

  /* ---- 3. photo upload reaches the server ---- */
  const fileInput = await A.$('input[type="file"][data-photo="avatar"]');
  await fileInput.uploadFile(path.join(__dirname, 'upload-sample.png'));
  await sleep(1400);
  const avatarSrc = await A.evaluate(() => {
    const img = document.querySelector('.photo-preview--avatar img');
    return img ? img.getAttribute('src') : '';
  });
  check('photo uploads to /uploads', avatarSrc.startsWith('/uploads/'), avatarSrc);

  /* ---- 4. A appears in the directory ---- */
  await hardNav(B, '/explore?city=Kochi');
  const seesAnjali = await B.evaluate(() =>
    [...document.querySelectorAll('.host-card')].some((c) => c.innerText.includes('Anjali Nair')));
  check('A shows up in the host directory for B', seesAnjali);

  /* ---- 5. B signs up and sends a request ---- */
  await signUp(B, 'Sam Thomas', 'sam@example.com', 'Bengaluru');
  await hardNav(B, '/explore?city=Kochi');
  await B.evaluate(() => {
    const card = [...document.querySelectorAll('.host-card')].find((c) => c.innerText.includes('Anjali Nair'));
    card.click();
  });
  await sleep(600);
  await B.click('[data-action="open-request"]');
  await sleep(400);
  await B.type('#r-msg', 'Hello Anjali, I am in Kochi for a week and would love to cook with you.');
  await B.click('#request-form button[type="submit"]');
  await sleep(1200);
  const bToast = await B.evaluate(() => {
    const t = [...document.querySelectorAll('.toast')];
    return t.length ? t[t.length - 1].innerText : '';
  });
  check('B sends a request to A', bToast.includes('Request sent'), bToast);

  /* ---- 6. A sees the request (fresh load = server round trip) ---- */
  await hardNav(A, '/dashboard');
  const aDash = await A.evaluate(() => document.querySelector('#main').innerText);
  check('A receives the request on the server', aDash.includes('Sam Thomas'), aDash.slice(0, 60).replace(/\n/g, ' '));

  /* ---- 7. A accepts ---- */
  await A.click('[data-action="respond"][data-status="accepted"]');
  await sleep(1000);
  const acceptedBadge = await A.evaluate(() => document.querySelectorAll('.badge--accepted').length);
  check('A accepts the request', acceptedBadge > 0, `${acceptedBadge} accepted`);

  /* ---- 8. messaging both ways ---- */
  await A.click('[data-action="message-guest"]');
  await sleep(1000);
  await A.type('#msg-form input[name="text"]', 'Wonderful — come by at four, I will have tea ready.');
  await A.click('#msg-form button[type="submit"]');
  await sleep(1000);

  await hardNav(B, '/messages');
  const bThread = await B.evaluate(() => document.querySelector('#main').innerText);
  check('B sees A\'s message', bThread.includes('tea ready'), bThread.slice(0, 50).replace(/\n/g, ' '));

  await B.type('#msg-form input[name="text"]', 'Perfect, see you at four!');
  await B.click('#msg-form button[type="submit"]');
  await sleep(1000);

  await hardNav(A, '/messages');
  const aThread = await A.evaluate(() => document.querySelector('#main').innerText);
  check('A sees B\'s reply', aThread.includes('see you at four'), aThread.slice(0, 50).replace(/\n/g, ' '));

  /* ---- 9. sessions survive a reload ---- */
  await A.reload({ waitUntil: 'networkidle2' });
  await sleep(800);
  const stillIn = await A.evaluate(() => document.body.innerText.includes('Log out') || document.body.innerText.includes('Messages'));
  check('session persists across reload', stillIn);

  /* ---- 10. a stranger cannot read the conversation ---- */
  const ctxC = await newContext();
  const C = await ctxC.newPage();
  await C.goto(BASE + '/#/messages', { waitUntil: 'networkidle2' });
  await sleep(600);
  const cBody = await C.evaluate(() => document.querySelector('#main').innerText);
  check('signed-out visitor cannot read messages', cBody.includes('Welcome back') || cBody.includes('Log in'), cBody.slice(0, 40).replace(/\n/g, ' '));

  check('no console/page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} live checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('LIVE TEST CRASHED:', e);
  process.exit(1);
});
