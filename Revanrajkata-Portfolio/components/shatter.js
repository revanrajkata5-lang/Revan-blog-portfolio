// Scroll-shatter animation (from the Andy Photography project), adapted for the portfolio hero.
// IMAGES = { landscape: {src,w,h}, portrait: {src,w,h} }
export function initShatter(el, IMAGES) {
  let shards = [], raf = 0, timer = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (s) => { s = Math.sin(s * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function build() {
    const W = el.stage.clientWidth, H = el.stage.clientHeight;
    if (!W || !H) return;
    const portrait = H > W;                         // upright phones/tablets use the portrait photo
    const img = portrait ? IMAGES.portrait : IMAGES.landscape;
    const night = document.documentElement.dataset.theme === 'dark';      // night mode uses the cut-out photo (no white backdrop)
    el.world.style.setProperty('--img', 'url("' + (night && img.dark ? img.dark : img.src) + '")');
    const sc = Math.min(W / img.w, H / img.h);
    const bw = img.w * sc, bh = img.h * sc, ox = (W - bw) / 2, oy = H - bh; // anchored to the bottom edge
    const cols = portrait ? 7 : 12, rows = portrait ? 11 : 7, cw = W / cols, ch = H / rows;
    const zs = portrait ? 0.65 : 1;
    el.world.textContent = '';
    shards = [];
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw, y = r * ch;
      if (x + cw < ox || x > ox + bw || y + ch < oy || y > oy + bh) continue;
      const d = document.createElement('div');
      d.className = 'shard';
      d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + (cw + 1) + 'px;height:' + (ch + 1) + 'px;background-size:' + bw + 'px ' + bh + 'px;background-position:' + (ox - x) + 'px ' + (oy - y) + 'px';
      frag.appendChild(d);
      const i = r * cols + c, cx = x + cw / 2 - W / 2, cy = y + ch / 2 - H / 2;
      shards.push({
        d,
        x: cx * 1.1 + (rnd(i) - 0.5) * W * 0.5,
        y: cy * 1.1 + (rnd(i + 9) - 0.5) * H * 0.6 + H * 0.15,
        z: (rnd(i + 3) * 900 - 250) * zs,
        rx: (rnd(i + 5) - 0.5) * 540, ry: (rnd(i + 7) - 0.5) * 540, rz: (rnd(i + 11) - 0.5) * 200,
        delay: rnd(i + 13) * 0.25,
      });
    }
    el.world.appendChild(frag);
    update();
  }

  function update() {
    const max = el.journey.offsetHeight - el.stage.clientHeight;   // stage = 100lvh, so mobile address-bar changes can't make progress jump
    const f = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
    const p = clamp(f / 0.45, 0, 1);                // shatter finishes by ~45% of the scroll
    const k = 1;
    for (const s of shards) {
      const q = ease(clamp((p * 1.3 - s.delay) / 1.0, 0, 1)) * k;
      s.d.style.transform = 'translate3d(' + s.x * q + 'px,' + s.y * q + 'px,' + s.z * q + 'px) rotateX(' + s.rx * q + 'deg) rotateY(' + s.ry * q + 'deg) rotateZ(' + s.rz * q + 'deg)';
      s.d.style.opacity = Math.max(0, 1 - Math.max(0, q - 0.55) * 2.5);
    }
    // hero copy fades up and out as the photo breaks apart
    const fade = Math.max(0, 1 - p * 4);
    el.copy.style.opacity = fade;
    el.copy.style.transform = 'translateY(' + p * -60 + 'px)';
    el.copy.style.visibility = fade <= 0 ? 'hidden' : 'visible';
    el.copy.style.pointerEvents = fade > 0.6 ? 'auto' : 'none';
    el.hint.style.opacity = Math.max(0, 1 - p * 10);
    // profile card arrives while the shards fly away
    const c = ease(clamp((f - 0.3) / 0.3, 0, 1));
    el.card.style.opacity = c;
    el.card.style.transform = 'translate(-50%,-50%) translateY(' + (1 - c) * 50 + 'px) scale(' + (0.92 + 0.08 * c) + ')';
    el.card.style.visibility = c <= 0 ? 'hidden' : 'visible';
    el.card.style.pointerEvents = c > 0.9 ? 'auto' : 'none';
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; update(); });
  }
  const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(build, 150); });
  ro.observe(el.stage);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('themechange', build);
  build();

  return function destroy() {
    ro.disconnect();
    removeEventListener('scroll', onScroll);
    removeEventListener('themechange', build);
    clearTimeout(timer);
    cancelAnimationFrame(raf);
  };
}
