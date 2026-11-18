/**
 * StayFolk — browser store.
 * Everything the visitor does is kept in localStorage so the demo is fully
 * functional without a server. The shape mirrors the REST API in /server.
 */

import {
  DEMO_USERS, SEED_REQUESTS, SEED_THREADS, SEED_MESSAGES,
  SEED_REPORTS, SEED_VERIFICATIONS,
} from './data.js';

const KEY = 'stayfolk.v1';

const defaults = () => ({
  users: DEMO_USERS.map((u) => ({ ...u })),
  session: null,
  requests: SEED_REQUESTS.map((r) => ({ ...r })),
  threads: SEED_THREADS.map((r) => ({ ...r })),
  messages: SEED_MESSAGES.map((r) => ({ ...r })),
  reviews: [],
  reports: SEED_REPORTS.map((r) => ({ ...r })),
  verifications: SEED_VERIFICATIONS.map((r) => ({ ...r })),
  lang: 'en',
  theme: 'light',
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return { ...defaults(), ...parsed };
  } catch {
    return defaults();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — the demo keeps working in memory */
  }
}

function commit(patch = {}) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((fn) => fn(state));
  return state;
}

export const get = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reset() {
  state = defaults();
  persist();
  listeners.forEach((fn) => fn(state));
}

const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ------------------------------------------------------------------ auth */

export const currentUser = () => state.users.find((u) => u.id === state.session) || null;

export function login(email, password) {
  const user = state.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase().trim() && u.password === password
  );
  if (!user) return null;
  commit({ session: user.id });
  return user;
}

export function signup({ name, email, password, city }) {
  const exists = state.users.some((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (exists) return { error: 'exists' };
  const user = {
    id: uid('u'),
    name: String(name).trim(),
    email: String(email).trim(),
    password,
    role: 'guest',
    hostId: null,
    city: city || '—',
    verified: false,
  };
  commit({ users: [...state.users, user], session: user.id });
  return { user };
}

export function logout() {
  commit({ session: null });
}

/* -------------------------------------------------------------- requests */

export function createRequest({ hostId, from, to, guests, message }) {
  const user = currentUser();
  if (!user) return null;
  const req = {
    id: uid('r'),
    hostId,
    userId: user.id,
    guestName: user.name,
    from,
    to,
    guests: Number(guests) || 1,
    message,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  commit({ requests: [req, ...state.requests] });
  return req;
}

export function respondRequest(id, status) {
  commit({
    requests: state.requests.map((r) => (r.id === id ? { ...r, status } : r)),
  });
}

export const requestsForHost = (hostId) =>
  state.requests.filter((r) => r.hostId === hostId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export const requestsForUser = (userId) =>
  state.requests.filter((r) => r.userId === userId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

/* ------------------------------------------------------------- messaging */

export function openThread({ hostId, userId, guestName }) {
  const found = state.threads.find((t) => t.hostId === hostId && t.userId === userId);
  if (found) return found;
  const thread = { id: uid('t'), hostId, userId, guestName, updatedAt: new Date().toISOString() };
  commit({ threads: [thread, ...state.threads] });
  return thread;
}

export function sendMessage(threadId, text) {
  const user = currentUser();
  if (!user || !text.trim()) return null;
  const msg = { id: uid('m'), threadId, senderId: user.id, text: text.trim(), at: new Date().toISOString() };
  commit({
    messages: [...state.messages, msg],
    threads: state.threads.map((t) =>
      t.id === threadId ? { ...t, updatedAt: msg.at } : t
    ),
  });
  return msg;
}

export const messagesFor = (threadId) =>
  state.messages.filter((m) => m.threadId === threadId).sort((a, b) => (a.at < b.at ? -1 : 1));

export function threadsFor(user) {
  if (!user) return [];
  return state.threads
    .filter((t) => (user.hostId ? t.hostId === user.hostId : t.userId === user.id))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/* --------------------------------------------------------------- reviews */

export function addReview({ hostId, rating, text }) {
  const user = currentUser();
  if (!user) return null;
  const review = {
    id: uid('rev'),
    hostId,
    author: user.name,
    rating: Number(rating) || 5,
    date: new Date().toISOString().slice(0, 7),
    text,
  };
  commit({ reviews: [review, ...state.reviews] });
  return review;
}

/* --------------------------------------------------------------- reports */

export function addReport({ targetType, targetId, targetName, reason, detail }) {
  const report = {
    id: uid('rp'),
    targetType,
    targetId,
    targetName,
    reason,
    detail,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  commit({ reports: [report, ...state.reports] });
  return report;
}

export function resolveReport(id, status = 'resolved') {
  commit({ reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)) });
}

/* ---------------------------------------------------------- verification */

export function requestVerification() {
  const user = currentUser();
  if (!user) return null;
  if (state.verifications.some((v) => v.userId === user.id && v.status === 'pending')) return null;
  const entry = {
    id: uid('v'),
    userId: user.id,
    name: user.name,
    city: user.city,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  };
  commit({ verifications: [entry, ...state.verifications] });
  return entry;
}

export function resolveVerification(id, status) {
  const entry = state.verifications.find((v) => v.id === id);
  commit({
    verifications: state.verifications.map((v) => (v.id === id ? { ...v, status } : v)),
    users: entry && status === 'approved'
      ? state.users.map((u) => (u.id === entry.userId ? { ...u, verified: true } : u))
      : state.users,
  });
}

/* ------------------------------------------------------------ preferences */

export function setLang(code) {
  commit({ lang: code });
}
export function setTheme(theme) {
  commit({ theme });
}
