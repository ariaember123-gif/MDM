/* ============================================================
   MY DAILY MASSAGE — app.js
   Handles: Particle canvas · Form validation · Submission
   ============================================================ */

/* ── AMBIENT PARTICLE SYSTEM ─────────────────────── */
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  const COLORS = [
    'rgba(212, 175, 90, 0.6)',
    'rgba(184, 150, 46, 0.4)',
    'rgba(139, 105, 20, 0.5)',
    'rgba(255, 255, 255, 0.25)',
  ];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.reset = function () {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 1.4 + 0.3;
      this.vx = (Math.random() - 0.5) * 0.25;
      this.vy = (Math.random() - 0.5) * 0.25;
      this.alpha = Math.random() * 0.8 + 0.1;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.twinkleSpeed = Math.random() * 0.015 + 0.005;
      this.twinkleDir   = 1;
    };
    this.reset();
  }

  function initParticlePool() {
    particles = [];
    const count = Math.min(Math.floor((W * H) / 7000), 100);
    for (let i = 0; i < count; i++) particles.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Subtle radial gradient background atmosphere
    const grad = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W * 0.7);
    grad.addColorStop(0,   'rgba(139,105,20,0.04)');
    grad.addColorStop(0.5, 'rgba(26,26,26,0)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    particles.forEach(p => {
      // Twinkle
      p.alpha += p.twinkleSpeed * p.twinkleDir;
      if (p.alpha >= 1 || p.alpha <= 0.05) p.twinkleDir *= -1;

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Star sparkle for large particles
      if (p.r > 1.2) {
        ctx.globalAlpha = p.alpha * 0.4;
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = 0.5;
        const size = p.r * 3;
        ctx.beginPath();
        ctx.moveTo(p.x - size, p.y); ctx.lineTo(p.x + size, p.y);
        ctx.moveTo(p.x, p.y - size); ctx.lineTo(p.x, p.y + size);
        ctx.stroke();
      }

      ctx.restore();
    });

    requestAnimationFrame(draw);
  }

  resize();
  initParticlePool();
  draw();

  window.addEventListener('resize', () => {
    resize();
    initParticlePool();
  });
})();


/* ── PHONE FORMATTER ─────────────────────────────── */
(function initPhoneFormat() {
  const phoneInput = document.getElementById('phone');
  if (!phoneInput) return;

  phoneInput.addEventListener('input', function () {
    let val = this.value.replace(/\D/g, '').substring(0, 10);
    let formatted = '';
    if (val.length > 0) formatted = '(' + val.substring(0, 3);
    if (val.length >= 4) formatted += ') ' + val.substring(3, 6);
    if (val.length >= 7) formatted += '-' + val.substring(6, 10);
    this.value = formatted;
  });
})();


/* ── ZIP FORMATTER ───────────────────────────────── */
(function initZipFormat() {
  const zip = document.getElementById('zipCode');
  if (!zip) return;
  zip.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').substring(0, 5);
  });
})();


/* ── FORM VALIDATION & SUBMISSION ────────────────── */
(function initForm() {
  const form      = document.getElementById('leadForm');
  const submitBtn = document.getElementById('submitBtn');
  const success   = document.getElementById('successState');
  if (!form) return;

  function setError(id, msg) {
    const el = document.getElementById('err-' + id);
    if (el) el.textContent = msg;
    const field = document.getElementById(id === 'consent' ? 'consent' : id);
    if (field) field.classList.toggle('error', !!msg);
  }

  function clearErrors() {
    ['firstName','lastName','email','phone','zip','consent'].forEach(k => setError(k, ''));
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 0; // phone optional
  }

  function validate() {
    let ok = true;
    clearErrors();

    const fn = document.getElementById('firstName').value.trim();
    const ln = document.getElementById('lastName').value.trim();
    const em = document.getElementById('email').value.trim();
    const ph = document.getElementById('phone').value.trim();
    const zp = document.getElementById('zipCode').value.trim();
    const ck = document.getElementById('consent').checked;

    if (!fn) { setError('firstName', 'First name is required.'); ok = false; }
    if (!ln) { setError('lastName',  'Last name is required.'); ok = false; }
    if (!em)               { setError('email', 'Email address is required.'); ok = false; }
    else if (!validateEmail(em)) { setError('email', 'Please enter a valid email.'); ok = false; }
    if (ph && !validatePhone(ph)) { setError('phone', 'Please enter a valid 10-digit US number.'); ok = false; }
    if (zp && !/^\d{5}$/.test(zp)) { setError('zip', 'Enter a valid 5-digit ZIP code.'); ok = false; }
    if (!ck) { setError('consent', 'Please accept to continue.'); ok = false; }

    return ok;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validate()) return;

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const payload = {
      first_name:  document.getElementById('firstName').value.trim(),
      last_name:   document.getElementById('lastName').value.trim(),
      email:       document.getElementById('email').value.trim(),
      phone:       document.getElementById('phone').value.trim(),
      zip_code:    document.getElementById('zipCode').value.trim(),
      interest:    document.getElementById('interest').value,
      source:      'landing_page',
      created_at:  new Date().toISOString(),
      user_agent:  navigator.userAgent,
    };

    console.log('[MDM] Lead captured:', payload);

    try {
      /*
       * ── BACKEND INTEGRATION POINT ──────────────────────────
       * Replace the fetch URL with your Shopify/backend endpoint.
       * The payload above is ready to POST to your Node/PHP/Shopify
       * custom app that writes to the SQL database (see schema.sql).
       *
       * Example:
       *   const res = await fetch('https://your-shopify-app.com/api/leads', {
       *     method:  'POST',
       *     headers: { 'Content-Type': 'application/json' },
       *     body:    JSON.stringify(payload),
       *   });
       *   if (!res.ok) throw new Error('Server error');
       *
       * For Shopify Customers API you can also create a customer:
       *   POST /admin/api/2024-01/customers.json
       *
       * For now we simulate a 1.5s network delay:
       */
      await simulateRequest(payload);

      // Success!
      form.style.display      = 'none';
      success.classList.add('visible');
      success.style.display   = 'flex';

      // Push to dataLayer for GTM / GA4 if available
      if (window.dataLayer) {
        window.dataLayer.push({
          event:      'lead_capture',
          first_name:  payload.first_name,
          email:       payload.email,
          interest:    payload.interest,
        });
      }

    } catch (err) {
      console.error('[MDM] Submission error:', err);
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      alert('Something went wrong. Please try again or contact us directly.');
    }
  });

  // Real-time inline validation on blur
  ['firstName','lastName','email','phone','zipCode'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      // Light re-validate just that field
      validate();
    });
    el.addEventListener('input', () => {
      const errKey = id === 'zipCode' ? 'zip' : id;
      setError(errKey, '');
      el.classList.remove('error');
    });
  });

})();


/* ── SIMULATE NETWORK REQUEST (REPLACE IN PRODUCTION) ── */
function simulateRequest(payload) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 95% success rate simulation
      Math.random() > 0.05 ? resolve(payload) : reject(new Error('Simulated network error'));
    }, 1600);
  });
}


/* ── INPUT FOCUS GLOW EFFECT ─────────────────────── */
(function initFocusGlow() {
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('focus', () => {
      el.closest('.field-group')?.classList.add('focused');
    });
    el.addEventListener('blur', () => {
      el.closest('.field-group')?.classList.remove('focused');
    });
  });
})();


/* ── SCROLL ENTRANCE ANIMATIONS ─────────────────── */
(function initScrollAnimations() {
  const proofItems = document.querySelectorAll('.proof-item');
  if (!proofItems.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.animationDelay = `${i * 0.1}s`;
        entry.target.classList.add('animate-in');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  proofItems.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    obs.observe(el);
  });
})();
