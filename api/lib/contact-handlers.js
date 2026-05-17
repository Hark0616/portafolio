/**
 * Lógica de contacto: validación, FormSubmit (server-side), Resend (fallback).
 * Sin dependencias de Vercel para poder testear con Vitest.
 */

import { resolveContactRecipient } from './contact-config.js';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: object } | { ok: false, code: string, errors: string[] }}
 */
export function validateContactBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'INVALID_BODY', errors: ['El cuerpo debe ser un objeto JSON'] };
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
  const honey = typeof body._honey === 'string' ? body._honey.trim() : '';

  const errors = [];
  if (honey) errors.push('spam');
  if (!nombre) errors.push('nombre requerido');
  if (!email) errors.push('email requerido');
  else if (!EMAIL_REGEX.test(email)) errors.push('email inválido');
  if (!mensaje) errors.push('mensaje requerido');

  if (errors.length) {
    return { ok: false, code: 'VALIDATION', errors };
  }

  const _subject =
    typeof body._subject === 'string' && body._subject.trim()
      ? body._subject.trim()
      : 'Nueva evaluación técnica - ResetDev';

  return {
    ok: true,
    data: {
      nombre,
      email,
      mensaje,
      _subject,
      origen: typeof body.origen === 'string' ? body.origen : '',
      fecha: typeof body.fecha === 'string' ? body.fecha : '',
    },
  };
}

/**
 * @param {string} recipientEmail
 * @returns {string}
 */
export function buildFormSubmitUrl(recipientEmail) {
  const email = String(recipientEmail || '').trim();
  if (!email) throw new Error('FORMSUBMIT_RECIPIENT_EMAIL / CONTACT_TO_EMAIL vacío');
  return `https://formsubmit.co/${email}`;
}

/**
 * @param {string} recipientEmail
 * @returns {string}
 */
export function buildFormSubmitAjaxUrl(recipientEmail) {
  const email = String(recipientEmail || '').trim();
  if (!email) throw new Error('FORMSUBMIT_RECIPIENT_EMAIL / CONTACT_TO_EMAIL vacío');
  return `https://formsubmit.co/ajax/${encodeURIComponent(email)}`;
}

/**
 * @param {object} data
 * @returns {Record<string, string>}
 */
export function buildFormSubmitJson(data) {
  const payload = {
    nombre: data.nombre,
    email: data.email,
    mensaje: data.mensaje,
    _subject: data._subject,
    _template: 'table',
    _captcha: 'false',
    _replyto: data.email,
  };
  if (data.origen) payload.origen = data.origen;
  if (data.fecha) payload.fecha = data.fecha;
  return payload;
}

/**
 * @param {object} data — salida de validateContactBody.data
 * @returns {string} application/x-www-form-urlencoded
 */
export function buildFormSubmitBody(data) {
  const params = new URLSearchParams();
  params.set('nombre', data.nombre);
  params.set('email', data.email);
  params.set('mensaje', data.mensaje);
  if (data.origen) params.set('origen', data.origen);
  if (data.fecha) params.set('fecha', data.fecha);
  params.set('_subject', data._subject);
  params.set('_template', 'table');
  params.set('_captcha', 'false');
  params.set('_replyto', data.email);
  return params.toString();
}

/**
 * @param {string} from
 * @param {string} [fromName]
 * @returns {string}
 */
export function formatResendFrom(from, fromName = 'ResetDev') {
  const trimmed = String(from || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('<')) return trimmed;
  return `${fromName} <${trimmed}>`;
}

/**
 * @param {string} [body]
 * @returns {string}
 */
export function parseResendErrorBody(body) {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body);
    return parsed.message || parsed.error?.message || body;
  } catch {
    return String(body).slice(0, 500);
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const s = String(text ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {object} data
 * @returns {string}
 */
export function buildResendHtml(data) {
  const nl = (s) => escapeHtml(s).replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
  return [
    `<p><strong>Nombre:</strong> ${escapeHtml(data.nombre)}</p>`,
    `<p><strong>Correo:</strong> ${escapeHtml(data.email)}</p>`,
    `<p><strong>Mensaje:</strong></p><p>${nl(data.mensaje)}</p>`,
    data.origen ? `<p><strong>Origen:</strong> ${escapeHtml(data.origen)}</p>` : '',
    data.fecha ? `<p><strong>Fecha:</strong> ${escapeHtml(data.fecha)}</p>` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {string} submitUrl
 * @param {string} encodedBody
 * @param {typeof fetch} fetchImpl
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ ok: true, status: number } | { ok: false, status?: number, error?: string }>}
 */
/**
 * @param {string} recipient
 * @param {object} data
 * @param {typeof fetch} fetchImpl
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function sendViaFormSubmitAjax(recipient, data, fetchImpl, options = {}) {
  const { signal } = options;
  const url = buildFormSubmitAjaxUrl(recipient);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(buildFormSubmitJson(data)),
      signal,
    });
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status, mode: 'ajax' };
    }
    return { ok: false, status: res.status, mode: 'ajax' };
  } catch (e) {
    const err = e && typeof e === 'object' && 'name' in e && e.name === 'AbortError';
    return { ok: false, error: err ? 'timeout' : e?.message || String(e), mode: 'ajax' };
  }
}

export async function sendViaFormSubmit(submitUrl, encodedBody, fetchImpl, options = {}) {
  const { signal } = options;
  try {
    const res = await fetchImpl(submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: encodedBody,
      signal,
    });
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status };
    }
    return { ok: false, status: res.status };
  } catch (e) {
    const err = e && typeof e === 'object' && 'name' in e && e.name === 'AbortError';
    return { ok: false, error: err ? 'timeout' : e?.message || String(e) };
  }
}

/**
 * @param {{ apiKey: string, from: string, to: string, subject: string, html: string }} params
 * @param {typeof fetch} fetchImpl
 */
export async function sendViaResend(params, fetchImpl) {
  const { apiKey, from, to, subject, html, replyTo } = params;
  const payload = {
    from: formatResendFrom(from),
    to: [to],
    subject,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { ok: true, status: res.status };
    }
    const body = await res.text();
    return {
      ok: false,
      status: res.status,
      body,
      message: parseResendErrorBody(body),
    };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {object} validatedData — validateContactBody.data
 * @param {{ fetch?: typeof fetch, formSubmitTimeoutMs?: number }} [deps]
 * @returns {Promise<{ ok: true, channel: 'formsubmit' | 'resend' } | { ok: false, code: string, formSubmit?: object, resend?: object }>}
 */
export async function tryFormSubmitThenResend(env, validatedData, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const formSubmitTimeoutMs = deps.formSubmitTimeoutMs ?? 12_000;

  const recipient = resolveContactRecipient(env);
  if (!recipient) {
    return {
      ok: false,
      code: 'CONFIG',
      formSubmit: { ok: false, error: 'No hay buzón de destino configurado' },
    };
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  const to = (env.CONTACT_TO_EMAIL || recipient).trim();
  const subject = validatedData._subject || 'Contacto ResetDev';
  const html = buildResendHtml(validatedData);

  let resendResult = { ok: false, skipped: true, reason: 'RESEND no configurado' };

  if (apiKey && from) {
    resendResult = await sendViaResend(
      { apiKey, from, to, subject, html, replyTo: validatedData.email },
      fetchImpl
    );
    if (resendResult.ok) {
      return { ok: true, channel: 'resend' };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), formSubmitTimeoutMs);

  let formSubmitResult;
  try {
    formSubmitResult = await sendViaFormSubmitAjax(recipient, validatedData, fetchImpl, {
      signal: controller.signal,
    });
    if (!formSubmitResult.ok) {
      const submitUrl = buildFormSubmitUrl(recipient);
      const encodedBody = buildFormSubmitBody(validatedData);
      const classic = await sendViaFormSubmit(submitUrl, encodedBody, fetchImpl, {
        signal: controller.signal,
      });
      formSubmitResult = { ...classic, mode: 'form' };
    }
  } finally {
    clearTimeout(timer);
  }

  if (formSubmitResult.ok) {
    return { ok: true, channel: 'formsubmit' };
  }

  return {
    ok: false,
    code: 'BOTH_FAILED',
    formSubmit: formSubmitResult,
    resend: resendResult,
  };
}
