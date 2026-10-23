// The app icons in the hero are things, not pictures: they fall in when the
// page opens, land on the wordmark, and can be picked up and thrown. A tap
// without a throw opens the app's page.
//
// Circles stand in for the rounded squares. That is close enough to look right
// and keeps every collision a single distance check.

(function () {
  const box = document.querySelector('[data-toy]');
  if (!box) return;

  const floorEl = box.querySelector('[data-toy-floor]');
  const els = [...box.querySelectorAll('[data-toy-body]')];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const GRAVITY = 2600; // px/s²
  const BOUNCE = 0.42;
  const FRICTION = 0.985;
  const TAP_DISTANCE = 6; // px a finger may wander and still count as a tap
  const MAX_SPEED = 3200; // px/s, so a flick stays on screen

  let width = 0;
  let floor = 0;
  let bodies = [];
  let running = false;
  let last = 0;

  function measure() {
    width = box.clientWidth;
    floor = floorEl.offsetTop;
  }

  function place() {
    measure();
    const size = els[0].offsetWidth;
    const gap = Math.min(size * 1.25, (width - size) / Math.max(els.length - 1, 1));
    const start = (width - (gap * (els.length - 1) + size)) / 2;

    bodies = els.map((el, i) => ({
      el,
      r: size / 2,
      x: start + i * gap + size / 2,
      // Stacked above the box, so they arrive one after another.
      y: still ? floor - size / 2 : -size * (1 + i * 0.9),
      vx: still ? 0 : (Math.random() - 0.5) * 240,
      vy: 0,
      turn: still ? 0 : (Math.random() - 0.5) * 30,
      held: false,
    }));
    draw();
  }

  function draw() {
    for (const b of bodies) {
      b.el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.turn}deg)`;
    }
  }

  function step(dt) {
    let moving = false;

    for (const b of bodies) {
      if (b.held) {
        moving = true;
        continue;
      }
      b.vy += GRAVITY * dt;
      b.vx *= FRICTION;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.turn += b.vx * dt * 0.25;

      if (b.y + b.r > floor) {
        b.y = floor - b.r;
        b.vy = -b.vy * BOUNCE;
        b.vx *= 0.9;
        if (Math.abs(b.vy) < 40) b.vy = 0;
      }
      // The sky has a lid: what is thrown up comes back down in view.
      if (b.y - b.r < 0 && b.vy < 0) {
        b.y = b.r;
        b.vy = -b.vy * BOUNCE;
      }
      if (b.x - b.r < 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * BOUNCE;
      }
      if (b.x + b.r > width) {
        b.x = width - b.r;
        b.vx = -Math.abs(b.vx) * BOUNCE;
      }
      if (Math.abs(b.vx) > 4 || Math.abs(b.vy) > 4 || b.y + b.r < floor - 1) moving = true;
    }

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
    }

    return moving;
  }

  function collide(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    const overlap = a.r + b.r - dist;
    if (overlap <= 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    // A held icon is a hand: it pushes, and nothing pushes it.
    const share = a.held ? 0 : b.held ? 1 : 0.5;
    a.x -= nx * overlap * share;
    a.y -= ny * overlap * share;
    b.x += nx * overlap * (1 - share);
    b.y += ny * overlap * (1 - share);

    const along = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (along > 0) return;
    const push = -(1 + BOUNCE) * along * 0.5;
    if (!a.held) {
      a.vx -= push * nx;
      a.vy -= push * ny;
    }
    if (!b.held) {
      b.vx += push * nx;
      b.vy += push * ny;
    }
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const moving = step(dt);
    draw();
    if (moving) requestAnimationFrame(loop);
    else running = false;
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  // Picking up and throwing.

  box.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('[data-toy-body]');
    if (!el) return;
    const b = bodies.find((body) => body.el === el);
    event.preventDefault();
    el.setPointerCapture(event.pointerId);

    const rect = box.getBoundingClientRect();
    const grab = { x: event.clientX - rect.left - b.x, y: event.clientY - rect.top - b.y };
    const from = { x: event.clientX, y: event.clientY, t: performance.now() };
    let trail = [{ x: event.clientX, y: event.clientY, t: from.t }];
    b.held = true;
    b.vx = 0;
    b.vy = 0;
    el.classList.add('is-held');
    wake();

    function move(e) {
      b.x = Math.max(b.r, Math.min(width - b.r, e.clientX - rect.left - grab.x));
      b.y = Math.min(floor - b.r, e.clientY - rect.top - grab.y);
      trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      trail = trail.filter((p) => p.t > performance.now() - 100);
    }

    function up(e) {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('is-held');
      b.held = false;

      const travelled = Math.hypot(e.clientX - from.x, e.clientY - from.y);
      if (e.type === 'pointerup' && travelled < TAP_DISTANCE) {
        window.location.href = el.href;
        return;
      }

      const first = trail[0];
      const span = Math.max((performance.now() - first.t) / 1000, 0.016);
      const vx = (e.clientX - first.x) / span;
      const vy = (e.clientY - first.y) / span;
      const scale = Math.min(1, MAX_SPEED / (Math.hypot(vx, vy) || 1));
      b.vx = vx * scale;
      b.vy = vy * scale;
      wake();
    }

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });

  // The icons are links for a tap, but a click after a drag must not follow.
  box.addEventListener('click', (event) => {
    if (event.target.closest('[data-toy-body]')) event.preventDefault();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measure();
      for (const b of bodies) {
        b.x = Math.max(b.r, Math.min(width - b.r, b.x));
        b.y = Math.min(floor - b.r, b.y);
      }
      draw();
      wake();
    }, 100);
  });

  // The icons drop when the box scrolls into view, not before: the fall is the
  // point. Wait for the font too, since the floor is the top of the wordmark.
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    place();
    box.classList.add('is-ready');
    if (still) return;
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        seen.disconnect();
        wake();
      },
      { threshold: 0.35 },
    );
    seen.observe(box);
  });
})();
