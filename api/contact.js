import { validateContactBody, tryFormSubmitThenResend } from './lib/contact-handlers.js';

/**
 * Lee y parsea el cuerpo JSON de un IncomingMessage (Vercel Node).
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED' }));
  }

  let json;
  try {
    json = await parseJsonBody(req);
  } catch {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, code: 'INVALID_JSON' }));
  }

  const validated = validateContactBody(json);
  if (!validated.ok) {
    res.statusCode = 400;
    return res.end(
      JSON.stringify({
        ok: false,
        code: validated.code,
        errors: validated.errors,
      })
    );
  }

  const result = await tryFormSubmitThenResend(process.env, validated.data, {
    fetch: globalThis.fetch,
  });

  if (result.ok) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, channel: result.channel }));
  }

  if (result.code === 'CONFIG') {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, code: result.code }));
  }

  res.statusCode = 502;
  return res.end(JSON.stringify({ ok: false, code: result.code || 'BOTH_FAILED' }));
}
