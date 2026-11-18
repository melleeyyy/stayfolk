/**
 * StayFolk — mailer.
 *
 * Three modes, chosen by environment variables so the site works with or
 * without email configured:
 *
 *   BREVO_API_KEY=...     → Brevo HTTP API (free: 300 emails/day)
 *   RESEND_API_KEY=...    → Resend HTTP API (free: 3,000 emails/month)
 *   (neither)             → console mode: the link is printed to the server log
 *
 * Both providers are called over HTTPS with fetch, so there is no SMTP client
 * to maintain and no dependency to install.
 */

'use strict';

const FROM = process.env.MAIL_FROM || 'StayFolk <onboarding@resend.dev>';
const FROM_EMAIL = (FROM.match(/<([^>]+)>/) || [null, FROM])[1];

function provider() {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.RESEND_API_KEY) return 'resend';
  return 'console';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** A plain, readable email that survives every client. */
function wrap(title, body, cta, link) {
  return `<!doctype html><html><body style="margin:0;background:#F7F8FA;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:700;color:#0A0B0D;margin-bottom:20px">StayFolk</div>
    <div style="background:#fff;border:1px solid #E5E8EE;border-radius:14px;padding:28px">
      <h1 style="font-size:19px;margin:0 0 12px;color:#0A0B0D">${escapeHtml(title)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4B5261;margin:0 0 22px">${escapeHtml(body)}</p>
      <a href="${link}" style="display:inline-block;background:#3A79F7;color:#fff;text-decoration:none;
         padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">${escapeHtml(cta)}</a>
      <p style="font-size:12px;color:#6B7280;margin:22px 0 0;word-break:break-all">${escapeHtml(link)}</p>
    </div>
    <p style="font-size:12px;color:#6B7280;text-align:center;margin-top:18px">
      If you did not ask for this, you can ignore the message.</p>
  </div></body></html>`;
}

async function post(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${url} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Send one email. Never throws into a request handler: a failed email must not
 * break a signup. Returns true when it was actually delivered.
 */
async function send({ to, subject, text, html }) {
  const mode = provider();

  if (mode === 'console') {
    console.log('\n──────── email (console mode) ────────');
    console.log(`To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    console.log('──────────────────────────────────────\n');
    return false;
  }

  try {
    if (mode === 'brevo') {
      await post(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json' },
        {
          sender: { name: 'StayFolk', email: FROM_EMAIL },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }
      );
    } else {
      await post(
        'https://api.resend.com/emails',
        { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        { from: FROM, to, subject, html, text }
      );
    }
    return true;
  } catch (err) {
    console.error('[stayfolk] email failed:', err.message);
    console.log(`[stayfolk] fallback link for ${to}: ${text}`);
    return false;
  }
}

const link = (base, path) => `${String(base || '').replace(/\/$/, '')}/#${path}`;

function sendVerification({ baseUrl, to, name, token }) {
  const url = link(baseUrl, `/verify?token=${encodeURIComponent(token)}`);
  return send({
    to,
    subject: 'Confirm your StayFolk email',
    text: `Hi ${name}, confirm your email to finish setting up StayFolk: ${url}\n\nThe link is valid for 24 hours.`,
    html: wrap('Confirm your email', `Hi ${name}, one click and your StayFolk account is ready. The link is valid for 24 hours.`, 'Confirm email', url),
  });
}

function sendPasswordReset({ baseUrl, to, name, token }) {
  const url = link(baseUrl, `/reset?token=${encodeURIComponent(token)}`);
  return send({
    to,
    subject: 'Reset your StayFolk password',
    text: `Hi ${name}, someone asked to reset your StayFolk password. If it was you: ${url}\n\nThe link is valid for one hour. If it was not you, ignore this email — your password has not changed.`,
    html: wrap('Reset your password', `Hi ${name}, use the button below to choose a new password. The link works for one hour. If you did not ask for this, ignore this email.`, 'Choose a new password', url),
  });
}

module.exports = { send, sendVerification, sendPasswordReset, provider };
