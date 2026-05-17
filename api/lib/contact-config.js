/**
 * Buzón de contacto por defecto (público en el sitio).
 * En Vercel puedes sobreescribir con CONTACT_TO_EMAIL / FORMSUBMIT_RECIPIENT_EMAIL.
 */
export const DEFAULT_CONTACT_TO_EMAIL = 'reset.dev.solutions@gmail.com';

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
export function resolveContactRecipient(env = {}) {
  const fromEnv = (env.FORMSUBMIT_RECIPIENT_EMAIL || env.CONTACT_TO_EMAIL || '').trim();
  return fromEnv || DEFAULT_CONTACT_TO_EMAIL;
}
