/**
 * StayFolk — application shell.
 * Hash router, header/footer, delegated events and toasts.
 */

import { LANGS, setLang, getLang, langMeta, t, missingKeys } from './i18n.js';
import * as store from './store.js';
import * as V from './views.js';
import { icon, esc } from './views.js';
import { BRAND_MARK, avatar } from './media.js';
import { HOSTS, hostById } from './data.js';

const $header = document.getElementById('site-header');
const $footer = document.getElementById('site-footer');
const $main = document.getElementById('main');
const $toast = document.getElementById('toast-root');
const $modal = document.getElementById('modal-root');

/* --------------------------------------------------------------- chrome */

function headerHTML() {
  const user = store.currentUser();
  const lang = getLang();
  const theme = store.get().theme;
  const path = currentPath();

  const link = (href, label, key) =>
    `<a href="${href}" class="${path === key ? 'is-active' : ''}">${esc(label)}</a>`;

  return `
  <div class="container header-inner">
    <a class="brand" href="#/" aria-label="StayFolk">
      ${BRAND_MARK}<span>StayFolk</span>
    </a>

    <nav class="nav" aria-label="Main">
      ${link('#/explore', t('nav.explore'), 'explore')}
      ${link('#/cities', t('nav.cities'), 'cities')}
      ${link('#/how', t('nav.how'), 'how')}
      ${link('#/safety', t('nav.safety'), 'safety')}
      ${user ? link('#/dashboard', t('nav.dashboard'), 'dashboard') : ''}
      ${user ? link('#/messages', t('nav.messages'), 'messages') : ''}
      ${user && user.role === 'admin' ? link('#/admin', t('nav.admin'), 'admin') : ''}
    </nav>

    <div class="header-actions">
      <label class="lang-select" title="${esc(t('nav.language'))}">
        ${icon('globe')}
        <select id="lang-select" aria-label="${esc(t('nav.language'))}">
          ${LANGS.map((l) => `<option value="${l.code}" ${l.code === lang ? 'selected' : ''}>${esc(l.native)}</option>`).join('')}
        </select>
      </label>

      <button class="icon-btn hide-sm" data-action="toggle-theme" title="${esc(t('nav.theme'))}" aria-label="${esc(t('nav.theme'))}">
        ${icon(theme === 'dark' ? 'sun' : 'moon')}
      </button>

      ${user
        ? `<a class="icon-btn" href="#/dashboard" title="${esc(user.name)}" style="width:auto;padding:0 4px;border:0">
             <img class="avatar" src="${avatar(user.name, user.id)}" alt="${esc(user.name)}" />
           </a>`
        : `<a class="btn btn--ghost btn--sm btn--login" href="#/login">${esc(t('nav.login'))}</a>
           <a class="btn btn--primary btn--sm" href="#/signup">${esc(t('nav.signup'))}</a>`}

      <button class="icon-btn menu-toggle" data-action="toggle-menu" aria-label="${esc(t('nav.menu'))}" aria-expanded="false">
        ${icon('menu')}
      </button>
    </div>
  </div>

  <div class="mobile-nav" id="mobile-nav">
    <a href="#/explore">${esc(t('nav.explore'))}</a>
    <a href="#/cities">${esc(t('nav.cities'))}</a>
    <a href="#/how">${esc(t('nav.how'))}</a>
    <a href="#/safety">${esc(t('nav.safety'))}</a>
    ${user ? `<a href="#/dashboard">${esc(t('nav.dashboard'))}</a><a href="#/messages">${esc(t('nav.messages'))}</a>` : ''}
    ${user && user.role === 'admin' ? `<a href="#/admin">${esc(t('nav.admin'))}</a>` : ''}
    <div class="mobile-nav__actions">
      ${user
        ? `<button class="btn btn--outline btn--block" data-action="logout">${esc(t('nav.logout'))}</button>`
        : `<a class="btn btn--outline btn--block" href="#/login">${esc(t('nav.login'))}</a>
           <a class="btn btn--primary btn--block" href="#/signup">${esc(t('nav.signup'))}</a>`}
    </div>
  </div>`;
}

function footerHTML() {
  return `
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <a class="brand" href="#/" style="margin-bottom:12px">${BRAND_MARK}<span>StayFolk</span></a>
        <p class="small" style="max-width:34ch">${esc(t('footer.about'))}</p>
        <p class="tiny muted" style="margin-top:12px">${esc(t('footer.made'))}</p>
      </div>
      <div class="footer-col">
        <h5>${esc(t('footer.explore'))}</h5>
        <a href="#/explore">${esc(t('nav.explore'))}</a>
        <a href="#/cities">${esc(t('nav.cities'))}</a>
        <a href="#/how">${esc(t('nav.how'))}</a>
      </div>
      <div class="footer-col">
        <h5>${esc(t('footer.support'))}</h5>
        <a href="#/safety">${esc(t('nav.safety'))}</a>
        <a href="#/signup">${esc(t('cta.host'))}</a>
        <a href="mailto:hello@stayfolk.example">${esc(t('footer.contact'))}</a>
      </div>
      <div class="footer-col">
        <h5>${esc(t('footer.legal'))}</h5>
        <a href="#/safety">${esc(t('footer.terms'))}</a>
        <a href="#/safety">${esc(t('footer.privacy'))}</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>${esc(t('footer.rights'))}</span>
      <span>${esc(langMeta(getLang()).native)} · ${esc(t('common.demo'))}</span>
    </div>
  </div>`;
}

/* --------------------------------------------------------------- router */

function currentPath() {
  const raw = location.hash.replace(/^#\/?/, '');
  return raw.split('?')[0].split('/').filter(Boolean)[0] || '';
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart || '');
  return { segs, query };
}

let lastScrollKey = '';

function route() {
  const { segs, query } = parseRoute();
  const root = segs[0] || 'home';
  let html = '';
  let title = 'StayFolk';

  switch (root) {
    case 'home':
      html = V.homeView();
      title = 'StayFolk — ' + t('hero.eyebrow');
      break;
    case 'explore':
      html = V.exploreView({
        city: query.get('city') || '',
        guests: query.get('guests') || '',
        language: query.get('language') || '',
        verified: query.get('verified') === '1',
        women: query.get('women') === '1',
        sort: query.get('sort') || 'rating',
      });
      title = `${t('search.title')} — StayFolk`;
      break;
    case 'cities':
      html = V.citiesView();
      title = `${t('cities.title')} — StayFolk`;
      break;
    case 'city':
      html = V.cityView(segs[1]);
      title = `${t('cities.title')} — StayFolk`;
      break;
    case 'host': {
      const h = hostById(segs[1]);
      html = V.hostView(segs[1]);
      title = h ? `${h.name} — StayFolk` : 'StayFolk';
      break;
    }
    case 'how':
      html = V.howView();
      title = `${t('nav.how')} — StayFolk`;
      break;
    case 'safety':
      html = V.safetyView();
      title = `${t('nav.safety')} — StayFolk`;
      break;
    case 'login':
      html = V.authView('login');
      title = `${t('nav.login')} — StayFolk`;
      break;
    case 'signup':
      html = V.authView('signup');
      title = `${t('nav.signup')} — StayFolk`;
      break;
    case 'dashboard':
      html = V.dashboardView(segs[1] || 'requests');
      title = `${t('nav.dashboard')} — StayFolk`;
      break;
    case 'messages':
      html = V.messagesView(segs[1]);
      title = `${t('msg.title')} — StayFolk`;
      break;
    case 'admin':
      html = V.adminView(segs[1] || 'reports');
      title = `${t('nav.admin')} — StayFolk`;
      break;
    default:
      html = V.notFoundView();
  }

  document.title = title;
  $main.innerHTML = `<div class="view-enter">${html}</div>`;
  $header.innerHTML = headerHTML();
  $footer.innerHTML = footerHTML();

  const key = location.hash;
  if (key !== lastScrollKey) {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    lastScrollKey = key;
  }

  const body = document.getElementById('thread-body');
  if (body) body.scrollTop = body.scrollHeight;
}

function go(path) {
  location.hash = path.startsWith('#') ? path : `#${path}`;
}

/* ---------------------------------------------------------------- toasts */

export function toast(message, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind === 'error' ? 'toast--error' : ''}`;
  el.innerHTML = `${icon(kind === 'error' ? 'x' : 'check')}<span>${esc(message)}</span>`;
  $toast.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'all .25s';
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

/* -------------------------------------------------------------- language */

function applyLanguage() {
  const meta = langMeta(getLang());
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.dir;
}

/* --------------------------------------------------------------- modals */

function openModal(html) {
  $modal.innerHTML = html;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $modal.innerHTML = '';
  document.body.style.overflow = '';
}

/* --------------------------------------------------------------- events */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'close-modal') {
    if (el.classList.contains('modal-backdrop') && e.target !== el) return;
    closeModal();
    return;
  }

  switch (action) {
    case 'toggle-theme': {
      const next = store.get().theme === 'dark' ? 'light' : 'dark';
      store.setTheme(next);
      document.documentElement.dataset.theme = next;
      $header.innerHTML = headerHTML();
      break;
    }
    case 'toggle-menu': {
      const nav = document.getElementById('mobile-nav');
      const open = nav.classList.toggle('is-open');
      el.setAttribute('aria-expanded', String(open));
      break;
    }
    case 'logout': {
      store.logout();
      toast(t('nav.logout'));
      go('/');
      break;
    }
    case 'open-request': {
      if (!store.currentUser()) {
        toast(t('req.login'), 'error');
        go('/login');
        return;
      }
      openModal(V.requestModal(el.dataset.id));
      break;
    }
    case 'report': {
      openModal(V.reportModal(el.dataset.id, el.dataset.name || ''));
      break;
    }
    case 'copy-link': {
      const url = location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => toast(t('common.copy'))).catch(() => toast(url));
      } else {
        toast(url);
      }
      break;
    }
    case 'clear-filters': {
      go('/explore');
      break;
    }
    case 'respond': {
      store.respondRequest(el.dataset.id, el.dataset.status);
      toast(el.dataset.status === 'accepted' ? t('dash.accepted') : t('dash.declined'));
      route();
      break;
    }
    case 'message-guest': {
      const user = store.currentUser();
      const req = store.get().requests.find((r) => r.id === el.dataset.id);
      if (!user || !req) return;
      const thread = store.openThread({
        hostId: req.hostId,
        userId: req.userId,
        guestName: req.guestName,
      });
      go(`/messages/${thread.id}`);
      break;
    }
    case 'verify-me': {
      const entry = store.requestVerification();
      toast(entry ? t('dash.verify') : t('dash.pending'));
      route();
      break;
    }
    case 'resolve-report': {
      store.resolveReport(el.dataset.id, 'resolved');
      toast(t('admin.approve'));
      route();
      break;
    }
    case 'ban-user': {
      store.resolveReport(el.dataset.id, 'banned');
      toast(t('admin.ban'));
      route();
      break;
    }
    case 'verify-approve': {
      store.resolveVerification(el.dataset.id, 'approved');
      toast(t('admin.approve'));
      route();
      break;
    }
    case 'verify-reject': {
      store.resolveVerification(el.dataset.id, 'rejected');
      toast(t('admin.reject'));
      route();
      break;
    }
    default:
      break;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'lang-select') {
    const code = e.target.value;
    store.setLang(code);
    setLang(code);
    applyLanguage();
    toast(langMeta(code).native);
    route();
    return;
  }
  const filters = e.target.closest('#filters-form');
  if (filters) applyFilters(filters);
});

function applyFilters(form) {
  const fd = new FormData(form);
  const params = new URLSearchParams();
  const city = String(fd.get('city') || '').trim();
  if (city) params.set('city', city);
  if (fd.get('guests')) params.set('guests', fd.get('guests'));
  if (fd.get('language')) params.set('language', fd.get('language'));
  if (fd.get('verified')) params.set('verified', '1');
  if (fd.get('women')) params.set('women', '1');
  if (fd.get('sort') && fd.get('sort') !== 'rating') params.set('sort', fd.get('sort'));
  const qs = params.toString();
  const next = `/explore${qs ? '?' + qs : ''}`;
  if (location.hash === `#${next}`) return;
  go(next);
}

document.addEventListener('submit', (e) => {
  const form = e.target;

  if (form.id === 'hero-search') {
    e.preventDefault();
    const fd = new FormData(form);
    const params = new URLSearchParams();
    const city = String(fd.get('city') || '').trim();
    if (city) params.set('city', city);
    if (fd.get('guests')) params.set('guests', fd.get('guests'));
    go(`/explore${params.toString() ? '?' + params : ''}`);
    return;
  }

  if (form.id === 'filters-form') {
    e.preventDefault();
    applyFilters(form);
    return;
  }

  if (form.id === 'auth-form') {
    e.preventDefault();
    const fd = new FormData(form);
    const mode = form.dataset.mode;
    const errorEl = form.querySelector('#auth-error');
    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    };

    if (mode === 'login') {
      const user = store.login(fd.get('email'), fd.get('password'));
      if (!user) return showError(t('auth.invalid'));
      toast(t('auth.welcome', { name: user.name }));
      go(user.role === 'admin' ? '/admin' : '/dashboard');
    } else {
      const name = String(fd.get('name') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const password = String(fd.get('password') || '');
      if (!name || !email || password.length < 6) {
        return showError(`${t('auth.name')} · ${t('auth.email')} · ${t('auth.password')}`);
      }
      const res = store.signup({ name, email, password, city: fd.get('city') });
      if (res.error === 'exists') return showError(t('auth.invalid'));
      toast(t('auth.welcome', { name: res.user.name }));
      go('/dashboard');
    }
    return;
  }

  if (form.id === 'request-form') {
    e.preventDefault();
    const fd = new FormData(form);
    const hostId = form.dataset.host;
    const from = String(fd.get('from') || '');
    const to = String(fd.get('to') || '');
    if (!from || !to || to < from) {
      toast(t('search.when'), 'error');
      return;
    }
    store.createRequest({
      hostId,
      from,
      to,
      guests: fd.get('guests'),
      message: String(fd.get('message') || '').trim(),
    });
    const host = hostById(hostId);
    closeModal();
    toast(t('req.sent', { name: host ? host.name : '' }));
    route();
    return;
  }

  if (form.id === 'msg-form') {
    e.preventDefault();
    const input = form.querySelector('input[name="text"]');
    if (store.sendMessage(form.dataset.thread, input.value)) {
      input.value = '';
      route();
    }
    return;
  }

  if (form.id === 'report-form') {
    e.preventDefault();
    const fd = new FormData(form);
    store.addReport({
      targetType: 'host',
      targetId: form.dataset.id,
      targetName: form.dataset.name,
      reason: String(fd.get('reason') || ''),
      detail: String(fd.get('detail') || ''),
    });
    closeModal();
    toast(t('admin.reports'));
    route();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

window.addEventListener('hashchange', route);

/* ------------------------------------------------------------------ boot */

function boot() {
  const s = store.get();
  setLang(s.lang || 'en');
  applyLanguage();
  document.documentElement.dataset.theme = s.theme || 'light';

  if (!location.hash) location.hash = '#/';
  route();

  if (import.meta.env && import.meta.env.DEV) {
    const missing = missingKeys();
    if (Object.keys(missing).length) console.warn('Missing translations:', missing);
  }
}

boot();

// expose a tiny debug handle for the smoke test
window.__stayfolk = { store, route, HOSTS };
