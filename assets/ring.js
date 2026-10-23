// Turns the ring of app cards (_includes/ring.html). Drag it, flick it, use
// the two buttons, or tab to a card: it always comes to rest with one card
// facing you. A card is a link; a drag that started on it does not open it.

(function () {
  const view = document.querySelector('[data-ring]');
  if (!view) return;

  const stage = view.closest('.stage');
  const track = view.querySelector('[data-ring-track]');
  const cards = [...view.querySelectorAll('[data-ring-card]')];
  const count = stage.querySelector('[data-ring-count]');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const last = cards.length - 1;

  const DRAG_DISTANCE = 6; // px before a press becomes a drag
  const FADE_FROM = 50; // degrees off centre where a card starts to fade
  const GONE_AT = 85; // and where it is gone

  let step = 0;
  let cardWidth = 0;
  let rot = 0;
  let target = 0;
  let frame = 0;

  function measure() {
    const style = getComputedStyle(stage);
    step = parseFloat(style.getPropertyValue('--step'));
    cardWidth = cards[0].offsetWidth;
  }

  function indexAt(angle) {
    return Math.max(0, Math.min(last, Math.round(angle / step)));
  }

  function render() {
    track.style.setProperty('--rot', `${rot}deg`);
    for (const [i, card] of cards.entries()) {
      const off = Math.abs(rot - i * step);
      const fade = 1 - (off - FADE_FROM) / (GONE_AT - FADE_FROM);
      card.style.opacity = String(Math.max(0, Math.min(1, fade)));
      card.style.visibility = off >= GONE_AT ? 'hidden' : 'visible';
    }
    count.textContent = String(indexAt(rot) + 1);
  }

  function settle() {
    cancelAnimationFrame(frame);
    if (still) {
      rot = target;
      render();
      return;
    }
    const tick = () => {
      rot += (target - rot) * 0.14;
      if (Math.abs(target - rot) < 0.02) rot = target;
      render();
      if (rot !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  function goTo(index) {
    target = Math.max(0, Math.min(last, index)) * step;
    settle();
  }

  // Dragging. Pixels become degrees so that one card width is one step.

  let drag = null;

  view.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    cancelAnimationFrame(frame);
    drag = { x: event.clientX, rot, moved: false, trail: [{ x: event.clientX, t: performance.now() }], id: event.pointerId };
  });

  view.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < DRAG_DISTANCE) return;
    if (!drag.moved) {
      drag.moved = true;
      view.setPointerCapture(event.pointerId);
      view.classList.add('is-dragging');
    }
    let next = drag.rot - (dx / cardWidth) * step;
    // Past either end the ring gives a little, then stops.
    const max = last * step;
    if (next < 0) next = next / 3;
    if (next > max) next = max + (next - max) / 3;
    rot = next;
    drag.trail.push({ x: event.clientX, t: performance.now() });
    drag.trail = drag.trail.filter((p) => p.t > performance.now() - 120);
    render();
  });

  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    view.classList.remove('is-dragging');
    if (drag.moved) {
      const first = drag.trail[0];
      const span = Math.max((performance.now() - first.t) / 1000, 0.016);
      const speed = (event.clientX - first.x) / span; // px/s
      const thrown = rot - ((speed * 0.18) / cardWidth) * step;
      goTo(indexAt(thrown));
      view.dataset.dragged = 'true';
    }
    drag = null;
  }

  view.addEventListener('pointerup', release);
  view.addEventListener('pointercancel', release);

  // A drag must not end as a click on the card under the pointer.
  view.addEventListener(
    'click',
    (event) => {
      if (view.dataset.dragged) {
        event.preventDefault();
        delete view.dataset.dragged;
      }
    },
    true,
  );

  // A side-swipe on a trackpad turns the ring; an up-down scroll stays a scroll.
  let wheelTimer;
  view.addEventListener(
    'wheel',
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      cancelAnimationFrame(frame);
      rot = Math.max(0, Math.min(last * step, rot + (event.deltaX / cardWidth) * step));
      render();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => goTo(indexAt(rot)), 120);
    },
    { passive: false },
  );

  for (const button of stage.querySelectorAll('[data-ring-step]')) {
    button.addEventListener('click', () => goTo(indexAt(target) + Number(button.dataset.ringStep)));
  }

  for (const [i, card] of cards.entries()) {
    card.addEventListener('focusin', () => goTo(i));
  }

  view.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') goTo(indexAt(target) + 1);
    else if (event.key === 'ArrowLeft') goTo(indexAt(target) - 1);
    else return;
    event.preventDefault();
    cards[indexAt(target)].querySelector('a').focus({ preventScroll: true });
  });

  window.addEventListener('resize', () => {
    const index = indexAt(target);
    measure();
    target = rot = index * step;
    render();
  });

  measure();
  // Start on the middle app, so there are cards to both sides.
  target = rot = Math.floor(last / 2) * step;
  render();
})();
