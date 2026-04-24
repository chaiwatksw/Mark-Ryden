/* ============================================================
   POLAR LOOP — app.js
   Initialization order is strict — do not reorder sections.
   ============================================================ */

// ── 1. Constants ──────────────────────────────────────────────
const FRAME_COUNT  = 192;
const FRAME_SPEED  = 2.0;   // product animation completes at ~50% scroll
const IMAGE_SCALE  = 0.85;  // padded cover mode sweet spot

// Must match CSS: 600vh on mobile (≤768px), 900vh on desktop
function getScrollHeightVH() {
  return window.innerWidth <= 768 ? 600 : 900;
}

// ── 2. State ──────────────────────────────────────────────────
const frames       = new Array(FRAME_COUNT).fill(null);
let   currentFrame = 0;
let   bgColor      = '#000000';
let   isReady      = false;

// ── 3. DOM references ─────────────────────────────────────────
const canvas          = document.getElementById('canvas');
const ctx             = canvas.getContext('2d');
const canvasWrap      = document.querySelector('.canvas-wrap');
const heroSection     = document.querySelector('.hero-standalone');
const darkOverlay     = document.getElementById('dark-overlay');
const marqueeWrap     = document.querySelector('.marquee-wrap');
const marqueeText     = document.querySelector('.marquee-text');
const scrollContainer = document.getElementById('scroll-container');
const loaderEl        = document.getElementById('loader');
const loaderBar       = document.getElementById('loader-bar');
const loaderPercent   = document.getElementById('loader-percent');

// ── 4. GSAP + ScrollTrigger ───────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

// ── 5. Lenis smooth scroll + GSAP ticker ─────────────────────
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ── 6. Canvas setup ───────────────────────────────────────────
function resizeCanvas() {
  // Cap DPR at 2 — phones with 3x DPR would triple canvas memory with no visible gain
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  if (frames[currentFrame]) drawFrame(currentFrame);
}

let _resizeTimer;
window.addEventListener('resize', () => {
  resizeCanvas();
  // Debounce section repositioning so it runs once after resize ends
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    positionSections();
    ScrollTrigger.refresh();
  }, 150);
});
resizeCanvas();

// ── Canvas draw ───────────────────────────────────────────────
function sampleBgColor(img) {
  try {
    const off = document.createElement('canvas');
    off.width = off.height = 4;
    const oc = off.getContext('2d');
    oc.drawImage(img, 0, 0, 4, 4);
    const d = oc.getImageData(0, 0, 1, 1).data;
    bgColor = `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch (e) {
    bgColor = '#000000';
  }
}

function drawFrame(index) {
  const img = frames[index];
  if (!img || !img.complete) return;
  if (index % 20 === 0) sampleBgColor(img);
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ── 7. Frame Preloader ────────────────────────────────────────
let loadedCount = 0;

function framePath(i) {
  return `frames/frame_${String(i + 1).padStart(4, '0')}.webp`;
}

function updateLoader(n) {
  const pct = Math.round((n / FRAME_COUNT) * 100);
  loaderBar.style.width   = pct + '%';
  loaderPercent.textContent = pct + '%';
}

function loadFrame(i) {
  return new Promise((resolve) => {
    const img   = new Image();
    img.onload  = () => { frames[i] = img; loadedCount++; updateLoader(loadedCount); resolve(); };
    img.onerror = () => { frames[i] = null; loadedCount++; updateLoader(loadedCount); resolve(); };
    img.src = framePath(i);
  });
}

async function preloadFrames() {
  // Phase A — first 10 frames: fast first paint
  const phase1 = Array.from({ length: Math.min(10, FRAME_COUNT) }, (_, i) => loadFrame(i));
  await Promise.all(phase1);
  if (frames[0]) drawFrame(0);

  // Phase B — remaining frames in background
  const remaining = Array.from({ length: FRAME_COUNT - 10 }, (_, i) => loadFrame(i + 10));
  await Promise.all(remaining);

  // All loaded — hide loader and fire hero entrance
  loaderEl.classList.add('hidden');
  isReady = true;
  fireHeroEntrance();
}

// ── 8. Hero entrance animation ────────────────────────────────
function fireHeroEntrance() {
  const tl = gsap.timeline();
  tl.from('.hero-word', {
    y: 120,
    opacity: 0,
    stagger: 0.13,
    duration: 1.1,
    ease: 'power4.out',
  })
  .from('.hero-tagline', {
    y: 30,
    opacity: 0,
    duration: 0.9,
    ease: 'power3.out',
  }, '-=0.5')
  .from('.hero-label', {
    opacity: 0,
    duration: 0.7,
    ease: 'power2.out',
  }, '-=0.8')
  .from('.scroll-arrow', {
    opacity: 0,
    y: 10,
    duration: 0.6,
    ease: 'power2.out',
  }, '-=0.3')
  .from('.site-header', {
    opacity: 0,
    y: -20,
    duration: 0.6,
    ease: 'power2.out',
  }, '<');
}

// ── 9. Hero transition — circle-wipe ─────────────────────────
function initHeroTransition() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      // Hero fades out in first 7% of scroll
      heroSection.style.opacity = Math.max(0, 1 - p * 14.3).toString();
      // Canvas expands via circle clip-path 1%→7%
      const wipe   = Math.min(1, Math.max(0, (p - 0.01) / 0.06));
      const radius = wipe * 75;
      canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
    },
  });
}

// ── 10. Frame scroll binding ──────────────────────────────────
function initFrameScrollBinding() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const idx = Math.min(
        Math.floor(accelerated * FRAME_COUNT),
        FRAME_COUNT - 1
      );
      if (idx !== currentFrame) {
        currentFrame = idx;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    },
  });
}

// ── 11. Position sections absolutely at midpoint ──────────────
function positionSections() {
  const scrollH = getScrollHeightVH();
  document.querySelectorAll('.scroll-section').forEach((sec) => {
    const enter = parseFloat(sec.dataset.enter);
    const leave = parseFloat(sec.dataset.leave);
    const mid   = (enter + leave) / 2;
    sec.style.top       = `calc(${mid / 100} * ${scrollH}vh)`;
    sec.style.transform = 'translateY(-50%)';
    sec.style.position  = 'absolute';
  });
}

// ── 12. Section animation system ─────────────────────────────
function initSectionAnimations() {
  document.querySelectorAll('.scroll-section').forEach((sec) => {
    const type    = sec.dataset.animation;
    const persist = sec.dataset.persist === 'true';
    const enter   = parseFloat(sec.dataset.enter) / 100;
    const leave   = parseFloat(sec.dataset.leave) / 100;

    const children = sec.querySelectorAll(
      '.section-label, .section-heading, .section-body, .cta-heading, .cta-body, .cta-button, .stat'
    );

    // Wrapper itself should be visible; children animate
    gsap.set(sec, { opacity: 1 });
    gsap.set(children, { opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    switch (type) {
      case 'slide-left':
        tl.fromTo(children,
          { x: -80, opacity: 0 },
          { x: 0, opacity: 1, stagger: 0.14, duration: 0.9, ease: 'power3.out' }
        );
        break;

      case 'slide-right':
        tl.fromTo(children,
          { x: 80, opacity: 0 },
          { x: 0, opacity: 1, stagger: 0.14, duration: 0.9, ease: 'power3.out' }
        );
        break;

      case 'fade-up':
        tl.fromTo(children,
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.12, duration: 0.9, ease: 'power3.out' }
        );
        break;

      case 'stagger-up':
        tl.fromTo(children,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.15, duration: 0.8, ease: 'power3.out' }
        );
        break;

      case 'clip-reveal':
        gsap.set(children, { clipPath: 'inset(100% 0 0 0)', opacity: 1 });
        tl.fromTo(children,
          { clipPath: 'inset(100% 0 0 0)', opacity: 1 },
          { clipPath: 'inset(0% 0 0 0)', opacity: 1, stagger: 0.15, duration: 1.2, ease: 'power4.inOut' }
        );
        break;
    }

    let wasActive = false;

    ScrollTrigger.create({
      trigger: scrollContainer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: false,
      onUpdate: (self) => {
        const p      = self.progress;
        const active = p >= enter && p < leave;

        if (active && !wasActive) {
          sec.classList.add('active');
          tl.play();
        } else if (!active && wasActive && !persist) {
          sec.classList.remove('active');
          tl.pause(0);
          // Re-apply initial opacity for non-clip-reveal types
          if (type !== 'clip-reveal') {
            gsap.set(children, { opacity: 0 });
          } else {
            gsap.set(children, { clipPath: 'inset(100% 0 0 0)', opacity: 1 });
          }
        }

        wasActive = active || (persist && p >= enter);
      },
    });
  });
}

// ── 13. Counter animations ────────────────────────────────────
function initCounters() {
  document.querySelectorAll('.stat-number').forEach((el) => {
    const target   = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || '0');

    gsap.fromTo(
      el,
      { textContent: 0 },
      {
        textContent: target,
        duration: 2.2,
        ease: 'power1.out',
        snap: { textContent: decimals === 0 ? 1 : 0.1 },
        onUpdate() {
          el.textContent = parseFloat(el.textContent).toFixed(decimals);
        },
        scrollTrigger: {
          trigger: el.closest('.scroll-section'),
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      }
    );
  });
}

// ── 14. Marquee ───────────────────────────────────────────────
function initMarquee() {
  const ENTER      = 0.38;
  const LEAVE      = 0.72;
  const FADE_RANGE = 0.04;

  // Scroll-driven horizontal movement
  gsap.to(marqueeText, {
    xPercent: -30,
    ease: 'none',
    scrollTrigger: {
      trigger: scrollContainer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
    },
  });

  // Opacity gating based on scroll progress
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let op  = 0;

      if (p >= ENTER - FADE_RANGE && p < ENTER) {
        op = (p - (ENTER - FADE_RANGE)) / FADE_RANGE;
      } else if (p >= ENTER && p <= LEAVE) {
        op = 1;
      } else if (p > LEAVE && p <= LEAVE + FADE_RANGE) {
        op = 1 - (p - LEAVE) / FADE_RANGE;
      }

      marqueeWrap.style.opacity = op.toString();
    },
  });
}

// ── 15. Dark overlay ─────────────────────────────────────────
function initDarkOverlay(enter, leave) {
  const FADE_RANGE = 0.04;

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let op  = 0;

      if (p >= enter - FADE_RANGE && p < enter) {
        op = (p - (enter - FADE_RANGE)) / FADE_RANGE;
      } else if (p >= enter && p <= leave) {
        op = 0.9;
      } else if (p > leave && p <= leave + FADE_RANGE) {
        op = 0.9 * (1 - (p - leave) / FADE_RANGE);
      }

      darkOverlay.style.opacity = op.toString();
    },
  });
}

// ── 16. Hamburger / mobile nav ────────────────────────────────
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (!hamburger || !mobileNav) return;

  function openNav() {
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    mobileNav.classList.add('open');
    lenis.stop();
  }

  function closeNav() {
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.classList.remove('open');
    lenis.start();
  }

  hamburger.addEventListener('click', () => {
    mobileNav.classList.contains('open') ? closeNav() : openNav();
  });

  mobileNav.querySelectorAll('[data-close-nav]').forEach((link) => {
    link.addEventListener('click', closeNav);
  });
}

// ── Boot sequence ─────────────────────────────────────────────
function init() {
  initHeroTransition();
  initFrameScrollBinding();
  positionSections();
  initSectionAnimations();
  initCounters();
  initMarquee();
  initDarkOverlay(0.65, 0.82);
  initMobileNav();

  // Single ScrollTrigger.refresh() after all triggers registered
  ScrollTrigger.refresh();
}

// Start loading frames, then run init after DOM is ready
init();
preloadFrames();
