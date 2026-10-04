'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Heading drawn from thousands of small shards (same visual language as the hero photo).
// - mode "scroll": the shards condense into the text as the heading scrolls into view (reversible, like the hero)
// - mode "intro":  the shards condense once, on load
// - the cursor pushes shards away and they spring back; tapping the heading scatters them
// - ref.burst() scatters them and they reassemble (used when the form is sent)
const FAMILY = 'Georgia, "Times New Roman", serif';

const ShatterText = forwardRef(function ShatterText({ lines, mode = 'scroll', maxSize = 150 }, ref) {
  const wrap = useRef(null), cv = useRef(null), api = useRef({ burst() {} });
  useImperativeHandle(ref, () => ({ burst: (p) => api.current.burst(p) }), []);

  useEffect(() => {
    const wrapEl = wrap.current, canvas = cv.current, ctx = canvas.getContext('2d');
    const reduce = false;                       // animations always play (iOS "Reduce Motion" no longer freezes them)
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const R = 80, R2 = R * R, SPRING = 0.014;
    const readInk = () => getComputedStyle(document.documentElement).getPropertyValue('--ct-fg').trim() || '#f4f4f5';
    let ink = readInk();

    let W = 0, H = 0, PAD = 90, dpr = 1, P = [], raf = 0, vis = false, lastW = 0, rt = 0;
    let prog = reduce ? 1 : 0, moving = false, dirty = true, last = 0, t0 = 0;
    const ptr = { x: -9999, y: -9999 };

    function build() {
      W = wrapEl.clientWidth; if (!W) return;
      lastW = W; dpr = Math.min(devicePixelRatio || 1, 2);
      const probe = document.createElement('canvas').getContext('2d');
      probe.font = '700 100px ' + FAMILY;
      const wmax = Math.max(...lines.map((l) => probe.measureText(l).width));
      const fs = Math.min(maxSize, (W * 0.98 / wmax) * 100);
      const base = fs * 0.86;
      H = Math.ceil(base + (lines.length - 1) * fs + fs * 0.28);
      PAD = W < 560 ? 50 : 90;                       // extra room around the text so flying shards aren't clipped
      wrapEl.style.height = H + 'px';
      canvas.width = (W + PAD * 2) * dpr; canvas.height = (H + PAD * 2) * dpr;
      canvas.style.width = (W + PAD * 2) + 'px'; canvas.style.height = (H + PAD * 2) + 'px';
      canvas.style.left = canvas.style.top = -PAD + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);

      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const o = off.getContext('2d', { willReadFrequently: true });
      o.font = '700 ' + fs + 'px ' + FAMILY; o.fillStyle = '#000';
      lines.forEach((l, i) => o.fillText(l, 2, base + i * fs));
      const data = o.getImageData(0, 0, W, H).data;

      let g = W < 560 ? 3 : 4;
      do {
        P = [];
        for (let y = 0; y < H; y += g) for (let x = 0; x < W; x += g) {
          if (data[(y * W + x) * 4 + 3] > 140) {
            P.push({ tx: x + (Math.random() - 0.5) * g * 0.7, ty: y + (Math.random() - 0.5) * g * 0.7, sx: Math.random() * W, sy: Math.random() * H, s: g * (0.85 + Math.random() * 0.45), d: Math.random() * 0.35, ox: 0, oy: 0, vx: 0, vy: 0 });
          }
        }
        g += 1;
      } while (P.length > (W < 560 ? 4800 : 7500));
      dirty = true; kick();
    }

    function target(now) {
      if (reduce) return 1;
      if (mode === 'intro') { if (!t0) t0 = now; return clamp((now - t0 - 250) / 2200, 0, 1); }
      const r = wrapEl.getBoundingClientRect();
      return clamp((innerHeight * 0.95 - r.top) / (innerHeight * 0.55), 0, 1);
    }

    function frame(now) {
      raf = 0; if (!vis) return;
      const dt = Math.min(2.5, (now - (last || now)) / 16.667); last = now;
      const np = target(now), ptrOn = ptr.x > -9000;
      if (np === prog && !moving && !ptrOn && !dirty) { raf = requestAnimationFrame(frame); return; }
      prog = np; dirty = false; moving = false;
      const damp = Math.pow(0.9, dt);
      ctx.clearRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2); ctx.fillStyle = ink;
      for (const p of P) {
        const q = ease(clamp((prog * 1.35 - p.d), 0, 1));
        const x = p.sx + (p.tx - p.sx) * q + p.ox, y = p.sy + (p.ty - p.sy) * q + p.oy;
        if (ptrOn) {
          const dx = x - ptr.x, dy = y - ptr.y, d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) { const d = Math.sqrt(d2), f = (1 - d / R) * (1 - d / R) * 1.2 * dt; p.vx += dx / d * f; p.vy += dy / d * f; }
        }
        p.vx = (p.vx - p.ox * SPRING * dt) * damp; p.vy = (p.vy - p.oy * SPRING * dt) * damp;
        p.ox += p.vx * dt; p.oy += p.vy * dt;
        if (Math.abs(p.ox) + Math.abs(p.oy) + Math.abs(p.vx) + Math.abs(p.vy) > 0.06) moving = true;
        ctx.globalAlpha = q < 1 ? 0.15 + 0.85 * q : 1;
        ctx.fillRect(x, y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && vis) { last = 0; raf = requestAnimationFrame(frame); } }

    function burst(power = 1) {
      if (reduce) return;
      for (const p of P) { const a = Math.random() * 6.283, sp = (8 + Math.random() * 26) * power; p.vx += Math.cos(a) * sp; p.vy += Math.sin(a) * sp * 0.8; }
      moving = true; kick();
    }
    api.current.burst = burst;

    const onMove = (e) => {
      const r = wrapEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const inside = x > -R && x < r.width + R && y > -R && y < r.height + R;
      if (inside) { ptr.x = x; ptr.y = y; kick(); }
      else if (ptr.x > -9000) { ptr.x = ptr.y = -9999; dirty = true; }
    };
    const onUp = () => { if (ptr.x > -9000) { ptr.x = ptr.y = -9999; dirty = true; } };
    const onTap = () => burst(0.5);
    const onTheme = () => { ink = readInk(); dirty = true; kick(); };
    addEventListener('themechange', onTheme);

    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) kick(); }, { rootMargin: '100px' });
    io.observe(wrapEl);
    const ro = new ResizeObserver(() => { if (wrapEl.clientWidth === lastW) return; clearTimeout(rt); rt = setTimeout(build, 120); });
    ro.observe(wrapEl);
    if (!reduce) {
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('pointerup', onUp, { passive: true });
      addEventListener('pointercancel', onUp, { passive: true });
      wrapEl.addEventListener('pointerdown', onTap);
    }
    build();

    return () => {
      io.disconnect(); ro.disconnect(); clearTimeout(rt); cancelAnimationFrame(raf);
      removeEventListener('themechange', onTheme);
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
      wrapEl.removeEventListener('pointerdown', onTap);
    };
  }, [lines, mode, maxSize]);

  return (
    <h2 className="sh" ref={wrap}>
      <span className="sr">{lines.join(' ')}</span>
      <canvas ref={cv} aria-hidden="true" />
    </h2>
  );
});

export default ShatterText;
