/* ============================================================
   main.js — ResetDev Portfolio
   CP-32 · CP-33 · CP-A0 · CP-A1 · CP-93
============================================================ */

// ── 1. NAV: scroll → blur effect (CP-32)
const nav = document.getElementById('main-nav');

function updateNav() {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}

window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

// ── 2. NAV: active link on scroll (CP-33)
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((link) => {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === `#${id}`);
        });
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);

sections.forEach((s) => sectionObserver.observe(s));

// ── 3. ANIMATIONS: fade-up on scroll (CP-A0)
const fadeEls = document.querySelectorAll('.anim-fade-up');

const fadeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target); // animate once
      }
    });
  },
  { rootMargin: '0px 0px -80px 0px', threshold: 0.08 }
);

fadeEls.forEach((el) => fadeObserver.observe(el));

// Force hero visible immediately (it's already in view on load)
const heroContent = document.querySelector('#hero .anim-fade-up');
if (heroContent) {
  setTimeout(() => heroContent.classList.add('visible'), 120);
}

// ── 4. MOBILE NAV: hamburger toggle //
const hamburger = document.getElementById('nav-hamburger');
const navLinksList = document.querySelector('.nav-links');

hamburger?.addEventListener('click', () => {
  const isOpen = navLinksList.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', isOpen);

  // Animate hamburger → X
  const spans = hamburger.querySelectorAll('span');
  if (isOpen) {
    spans[0].style.transform = 'translateY(6px) rotate(45deg)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'translateY(-6px) rotate(-45deg)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  }
});

// Close mobile menu when a link is clicked
navLinksList?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinksList.classList.remove('open');
    const spans = hamburger.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  });
});

// ── 5. THEME TOGGLE: light/dark ──
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

if (localStorage.getItem('theme') === 'light') {
  body.classList.add('light-mode');
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    body.classList.toggle('light-mode');
    localStorage.setItem('theme', body.classList.contains('light-mode') ? 'light' : 'dark');
  });
}

// ── 6. FORM: validation + real submission for static hosting
const form = document.getElementById('contact-form');
const formSuccess = document.getElementById('form-success');
const formError = document.getElementById('form-error');
const btnSubmit = document.getElementById('btn-submit');

/**
 * CONFIGURACIÓN DEL FORMULARIO
 * El envío va a /api/contact (Vercel): FormSubmit desde servidor y Resend si falla.
 * Variables: ver .env.example y el dashboard de Vercel.
 */
const CONTACT_CONFIG = {
  recipientEmail: 'reset.dev.solutions@gmail.com',
  apiPath: '/api/contact',
  subject: 'Nueva evaluación técnica - ResetDev',
};

function setFieldError(field, hasError) {
  field.style.borderColor = hasError ? '#ff4d4d' : '';
  field.setAttribute('aria-invalid', hasError ? 'true' : 'false');
}

function validateContactForm() {
  const required = form.querySelectorAll('[required]');
  let valid = true;

  required.forEach((field) => {
    const empty = field.value.trim() === '';
    setFieldError(field, empty);
    if (empty) valid = false;
  });

  const email = form.querySelector('input[type="email"]');
  if (email && email.value.trim() !== '') {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    setFieldError(email, !emailValid);
    if (!emailValid) valid = false;
  }

  return valid;
}

function buildPayload() {
  const data = Object.fromEntries(new FormData(form).entries());

  return {
    ...data,
    _subject: CONTACT_CONFIG.subject,
    _template: 'table',
    _captcha: 'false',
    origen: window.location.href,
    fecha: new Date().toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  };
}

function buildMailto(payload) {
  const body = [
    `Nombre: ${payload.nombre || ''}`,
    `Correo: ${payload.email || ''}`,
    '',
    'Mensaje:',
    payload.mensaje || '',
    '',
    `Origen: ${payload.origen || window.location.href}`,
  ].join('\n');

  return `mailto:${CONTACT_CONFIG.recipientEmail}?subject=${encodeURIComponent(CONTACT_CONFIG.subject)}&body=${encodeURIComponent(body)}`;
}

async function sendContactApi(payload) {
  const response = await fetch(CONTACT_CONFIG.apiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('INVALID_JSON');
  }

  if (!response.ok || !data.ok) {
    const code = data?.code || response.status;
    throw new Error(String(code));
  }

  return data;
}

function setSubmitting(isSubmitting) {
  if (!btnSubmit) return;
  btnSubmit.disabled = isSubmitting;
  btnSubmit.style.opacity = isSubmitting ? '0.5' : '';
  btnSubmit.style.cursor = isSubmitting ? 'wait' : '';
  form.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
}

function showSuccess() {
  formError?.classList.add('hidden');
  // btnSubmit.style.display = 'none'; // Removed to allow multiple submissions
  formSuccess?.classList.remove('hidden');
  formSuccess?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.reset();
}

function showMailFallback(payload) {
  formSuccess?.classList.add('hidden');
  formError?.classList.remove('hidden');
  window.location.href = buildMailto(payload);
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  formSuccess?.classList.add('hidden');
  formError?.classList.add('hidden');

  if (!validateContactForm()) {
    btnSubmit.style.animation = 'none';
    btnSubmit.offsetHeight; // reflow
    btnSubmit.style.animation = 'shake 0.4s ease';
    return;
  }

  const payload = buildPayload();
  setSubmitting(true);

  try {
    await sendContactApi(payload);
    showSuccess();
  } catch {
    showMailFallback(payload);
  } finally {
    setSubmitting(false);
  }
});

// Re-validate fields on input
form?.querySelectorAll('[required]').forEach((field) => {
  field.addEventListener('input', () => {
    if (field.value.trim() !== '') {
      setFieldError(field, false);
    }
  });
});

// ── 7. SMOOTH SCROLL for anchor links (CP-A1)
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80; // nav height offset
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── 8. Add shake keyframe dynamically
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(6px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);
