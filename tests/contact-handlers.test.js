import { describe, it, expect, vi } from 'vitest';
import {
  validateContactBody,
  buildFormSubmitUrl,
  buildFormSubmitBody,
  escapeHtml,
  buildResendHtml,
  sendViaFormSubmit,
  sendViaResend,
  tryFormSubmitThenResend,
  EMAIL_REGEX,
} from '../api/lib/contact-handlers.js';

describe('EMAIL_REGEX', () => {
  it('acepta correo simple', () => {
    expect(EMAIL_REGEX.test('a@b.co')).toBe(true);
  });
  it('rechaza sin @', () => {
    expect(EMAIL_REGEX.test('abc')).toBe(false);
  });
});

describe('validateContactBody', () => {
  it('rechaza cuerpo no objeto', () => {
    const r = validateContactBody(null);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_BODY');
  });

  it('rechaza campos vacíos', () => {
    const r = validateContactBody({ nombre: '', email: 'x@y.com', mensaje: 'hola' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('VALIDATION');
  });

  it('rechaza email inválido', () => {
    const r = validateContactBody({ nombre: 'Juan', email: 'bad', mensaje: 'hola' });
    expect(r.ok).toBe(false);
  });

  it('rechaza honeypot relleno', () => {
    const r = validateContactBody({
      nombre: 'Juan',
      email: 'j@j.com',
      mensaje: 'hola',
      _honey: 'bot',
    });
    expect(r.ok).toBe(false);
  });

  it('acepta payload válido y normaliza', () => {
    const r = validateContactBody({
      nombre: '  Ana  ',
      email: ' ana@test.com ',
      mensaje: ' Texto ',
      origen: 'https://resetdev.com/',
      fecha: '14 may 2026',
      _subject: 'Asunto custom',
    });
    expect(r.ok).toBe(true);
    expect(r.data.nombre).toBe('Ana');
    expect(r.data.email).toBe('ana@test.com');
    expect(r.data.mensaje).toBe('Texto');
    expect(r.data._subject).toBe('Asunto custom');
  });

  it('usa asunto por defecto', () => {
    const r = validateContactBody({
      nombre: 'Ana',
      email: 'a@b.com',
      mensaje: 'x',
    });
    expect(r.ok).toBe(true);
    expect(r.data._subject).toContain('ResetDev');
  });
});

describe('buildFormSubmitUrl', () => {
  it('construye URL con email', () => {
    expect(buildFormSubmitUrl('user@gmail.com')).toBe('https://formsubmit.co/user@gmail.com');
  });

  it('lanza si email vacío', () => {
    expect(() => buildFormSubmitUrl('')).toThrow();
  });
});

describe('buildFormSubmitBody', () => {
  it('genera urlencoded con campos esperados', () => {
    const data = {
      nombre: 'Luis',
      email: 'l@e.com',
      mensaje: 'Hola mundo',
      _subject: 'Subj',
      origen: 'https://x.com',
      fecha: 'hoy',
    };
    const q = buildFormSubmitBody(data);
    expect(q).toContain('nombre=Luis');
    expect(q).toContain(encodeURIComponent('l@e.com'));
    expect(q).toContain('_captcha=false');
    expect(q).toContain('_template=table');
  });
});

describe('escapeHtml', () => {
  it('escapa caracteres HTML', () => {
    expect(escapeHtml('<script>')).not.toContain('<');
  });
});

describe('buildResendHtml', () => {
  it('incluye campos y saltos en mensaje', () => {
    const html = buildResendHtml({
      nombre: 'N',
      email: 'e@e.com',
      mensaje: 'a\nb',
      origen: 'o',
      fecha: 'f',
    });
    expect(html).toContain('N');
    expect(html).toContain('<br>');
  });
});

describe('sendViaFormSubmit', () => {
  it('devuelve ok si respuesta 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, ok: true });
    const r = await sendViaFormSubmit('https://formsubmit.co/x', 'a=1', fetchImpl);
    expect(r.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://formsubmit.co/x',
      expect.objectContaining({ method: 'POST', body: 'a=1' })
    );
  });

  it('devuelve ok false si 521', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 521, ok: false });
    const r = await sendViaFormSubmit('https://formsubmit.co/x', 'a=1', fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(521);
  });

  it('captura error de red', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'));
    const r = await sendViaFormSubmit('https://x', 'a=1', fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network');
  });

  it('marca timeout en AbortError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const r = await sendViaFormSubmit('https://x', 'a=1', fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('timeout');
  });
});

describe('sendViaResend', () => {
  it('envía JSON a api.resend.com', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    });
    const r = await sendViaResend(
      {
        apiKey: 're_test',
        from: 'onboarding@resend.dev',
        to: 'a@b.com',
        subject: 'S',
        html: '<p>x</p>',
      },
      fetchImpl
    );
    expect(r.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['a@b.com']);
  });

  it('devuelve ok false si Resend 422', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"message":"invalid"}',
    });
    const r = await sendViaResend(
      { apiKey: 'k', from: 'f', to: 't', subject: 's', html: 'h' },
      fetchImpl
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(422);
  });
});

describe('tryFormSubmitThenResend', () => {
  const baseData = {
    nombre: 'U',
    email: 'u@u.com',
    mensaje: 'msg',
    _subject: 'Sub',
    origen: '',
    fecha: '',
  };

  it('devuelve formsubmit si primer fetch OK', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, ok: true });
    const env = { FORMSUBMIT_RECIPIENT_EMAIL: 'dest@mail.com' };
    const r = await tryFormSubmitThenResend(env, baseData, { fetch: fetchImpl, formSubmitTimeoutMs: 5000 });
    expect(r.ok).toBe(true);
    expect(r.channel).toBe('formsubmit');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('usa Resend si FormSubmit falla', async () => {
    let call = 0;
    const fetchImpl = vi.fn().mockImplementation((url) => {
      call += 1;
      if (url.includes('formsubmit.co')) {
        return Promise.resolve({ status: 521, ok: false });
      }
      if (url.includes('resend.com')) {
        return Promise.resolve({ ok: true, status: 200, text: async () => '{}' });
      }
      return Promise.reject(new Error('unexpected'));
    });
    const env = {
      FORMSUBMIT_RECIPIENT_EMAIL: 'dest@mail.com',
      RESEND_API_KEY: 're_xxx',
      RESEND_FROM_EMAIL: 'onboarding@resend.dev',
      CONTACT_TO_EMAIL: 'inbox@mail.com',
    };
    const r = await tryFormSubmitThenResend(env, baseData, { fetch: fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.channel).toBe('resend');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('devuelve BOTH_FAILED si ambos fallan', async () => {
    const fetchImpl = vi.fn().mockImplementation((url) => {
      if (url.includes('formsubmit.co')) {
        return Promise.resolve({ status: 503, ok: false });
      }
      return Promise.resolve({ ok: false, status: 500, text: async () => 'err' });
    });
    const env = {
      FORMSUBMIT_RECIPIENT_EMAIL: 'd@m.com',
      RESEND_API_KEY: 're_xxx',
      RESEND_FROM_EMAIL: 'from@resend.dev',
      CONTACT_TO_EMAIL: 'to@m.com',
    };
    const r = await tryFormSubmitThenResend(env, baseData, { fetch: fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('BOTH_FAILED');
  });

  it('sin Resend configurado, falla tras FormSubmit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 521, ok: false });
    const env = { FORMSUBMIT_RECIPIENT_EMAIL: 'd@m.com' };
    const r = await tryFormSubmitThenResend(env, baseData, { fetch: fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.resend?.skipped).toBe(true);
  });

  it('CONFIG si falta email destino FormSubmit', async () => {
    const fetchImpl = vi.fn();
    const r = await tryFormSubmitThenResend({}, baseData, { fetch: fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('CONFIG');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
