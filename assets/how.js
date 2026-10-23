// The recordings on an app page play while they are on screen and stop when
// they leave it; with reduced motion they wait for a tap instead. The drawing
// of a note being written types itself out once, when it comes into view.

(function () {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = [...document.querySelectorAll('[data-how-video]')];

  if (still) {
    for (const v of videos) v.controls = true;
  } else {
    const watch = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (isIntersecting) target.play().catch(() => (target.controls = true));
          else target.pause();
        }
      },
      { threshold: 0.4 },
    );
    for (const v of videos) watch.observe(v);
  }

  for (const note of document.querySelectorAll('[data-type]')) {
    if (still) continue;
    const text = note.textContent;
    note.style.minHeight = `${note.offsetHeight}px`;
    note.textContent = '';
    const seen = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      seen.disconnect();
      let i = 0;
      const tick = () => {
        i += 1;
        note.textContent = text.slice(0, i);
        if (i < text.length) setTimeout(tick, text[i - 1] === '\n' ? 260 : 45);
      };
      tick();
    });
    seen.observe(note);
  }
})();
