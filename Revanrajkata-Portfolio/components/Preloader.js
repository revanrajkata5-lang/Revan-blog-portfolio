'use client';
import { useEffect, useRef, useState } from 'react';

// Opening screen: the signature is rebuilt from ink shards, holds, then shatters away to reveal the hero.
// Plays once per full page load (not on in-app navigation). Tap / click / Esc skips it.
// iOS-hardened: sized from its own box (not innerHeight), timed with performance.now(), never stuck
// (hard fail-safe timer), ignores toolbar-resize events, and locks page scroll while it is on screen.
let shown = false;

const SRC = { landscape: '/name-desktop.png', portrait: '/name-mobile.png' };
const ASSEMBLE_MS = 2300, MIN_MS = 3000, MAX_MS = 6500, EXIT_MS = 1100, MAX_PARTICLES = 6500;

export default function Preloader() {
  const [on, setOn] = useState(!shown);
  const root = useRef(null), bg = useRef(null), cv = useRef(null), bar = useRef(null);

  useEffect(() => {
    if (!on) return;
    const html = document.documentElement;
    const canvas = cv.current, node = root.current, ctx = canvas && canvas.getContext('2d');
    if (!canvas || !node || !ctx) { shown = true; setOn(false); window.dispatchEvent(new Event('preloader-done')); return; }

    html.classList.add('pre-lock');
    try { history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }
    scrollTo(0, 0);                                                   // always reveal the hero from the top

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const INK = getComputedStyle(html).getPropertyValue('--ink').trim() || '#0a0a0b';
    const imgs = {};
    let W = 0, H = 0, dpr = 1, P = [], raf = 0, start = 0, last = 0, exitAt = 0, exploded = false, finished = false, rt = 0, alive = true, builtKind = '';

    function load(kind) {
      return new Promise((res) => {
        if (imgs[kind]) return res(imgs[kind]);
        const im = new Image();
        im.decoding = 'sync';
        im.onload = () => res((imgs[kind] = im));
        im.onerror = () => res(null);
        im.src = SRC[kind];
        if (im.complete && im.naturalWidth) res((imgs[kind] = im));
      });
    }

    async function build() {
      W = node.clientWidth || innerWidth; H = node.clientHeight || innerHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      const kind = H > W ? 'portrait' : 'landscape';
      builtKind = kind;
      const im = await load(kind);
      if (!alive || finished) return;
      if (!im) { finish(); return; }
      try {
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const sc = Math.min(W / im.naturalWidth, H / im.naturalHeight);
        const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc, ox = (W - dw) / 2, oy = (H - dh) / 2;
        const off = document.createElement('canvas'); off.width = Math.round(W); off.height = Math.round(H);
        const o = off.getContext('2d', { willReadFrequently: true });
        o.fillStyle = '#fff'; o.fillRect(0, 0, off.width, off.height); o.drawImage(im, ox, oy, dw, dh);
        const OW = off.width, OH = off.height;
        const d = o.getImageData(0, 0, OW, OH).data;
        const lum = (x, y) => d[((Math.min(OH - 1, y) * OW) + Math.min(OW - 1, x)) * 4];

        let g = 2;
        for (let tries = 0; tries < 8; tries++) {
          P = [];
          for (let y = Math.floor(oy); y < oy + dh; y += g) for (let x = Math.floor(ox); x < ox + dw; x += g) {
            const m = (lum(x, y) + lum(x + g - 1, y) + lum(x, y + g - 1) + lum(x + g - 1, y + g - 1) + lum(x + (g >> 1), y + (g >> 1))) / 5;
            if (m < 170) P.push({ tx: x + (Math.random() - 0.5) * g * 0.6, ty: y + (Math.random() - 0.5) * g * 0.6, sx: Math.random() * W, sy: Math.random() * H, s: g * (0.95 + Math.random() * 0.4), dl: Math.random() * 0.35, ox: 0, oy: 0, vx: 0, vy: 0 });
          }
          if (P.length <= MAX_PARTICLES) break;
          g = Math.max(g + 1, Math.ceil(g * Math.sqrt(P.length / MAX_PARTICLES)));
        }
      } catch (err) { finish(); return; }                                // canvas blocked / out of memory: never get stuck
      exploded = false;
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function explode() {
      exploded = true;
      for (const p of P) {
        const dx = p.tx - W / 2, dy = p.ty - H / 2, dist = Math.hypot(dx, dy) || 1, sp = 3 + Math.random() * 13;
        p.vx = (dx / dist) * sp + (Math.random() - 0.5) * 5; p.vy = (dy / dist) * sp * 0.8 + (Math.random() - 0.5) * 5 - 2;
      }
    }

    function frame() {
      raf = 0; if (finished) return;
      const now = performance.now();                                      // one clock for everything (rAF timestamps differ on iOS)
      if (!start) start = now;
      const t = now - start;
      const dt = clamp((now - (last || now)) / 16.667, 0.5, 2.5); last = now;   // same speed on 30 / 60 / 120 Hz screens
      const prog = clamp(t / ASSEMBLE_MS, 0, 1);
      if (!exitAt && ((t >= MIN_MS && document.readyState === 'complete') || t >= MAX_MS)) exitAt = now;
      const e = exitAt ? clamp((now - exitAt) / EXIT_MS, 0, 1) : 0;
      if (exitAt && !exploded) explode();

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = INK;
      const damp = Math.pow(0.97, dt);
      for (const p of P) {
        const q = ease(clamp(prog * 1.35 - p.dl, 0, 1));
        let x = p.sx + (p.tx - p.sx) * q, y = p.sy + (p.ty - p.sy) * q;
        if (exploded) { p.ox += p.vx * dt; p.oy += p.vy * dt; p.vx *= damp; p.vy = p.vy * damp + 0.12 * dt; x += p.ox; y += p.oy; }
        ctx.globalAlpha = (q < 1 ? 0.18 + 0.82 * q : 1) * (1 - ease(clamp(e * 1.15, 0, 1)));
        ctx.fillRect(x, y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
      bar.current.style.transform = 'scaleX(' + prog + ')';
      bar.current.parentNode.style.opacity = 1 - clamp(e * 4, 0, 1);
      bg.current.style.opacity = exitAt ? 1 - ease(clamp((now - exitAt - 150) / (EXIT_MS - 150), 0, 1)) : 1;

      if (e >= 1) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }

    function skip() { if (!exitAt && start && performance.now() - start > 500) exitAt = performance.now(); }
    const stop = (ev) => ev.preventDefault();
    const onKey = (ev) => {
      if (['Escape', 'Enter', ' '].includes(ev.key)) skip();
      if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(ev.key)) ev.preventDefault();
    };
    // iOS fires `resize` whenever the toolbar collapses. Only rebuild for a real width / orientation change,
    // and never once the exit has started (rebuilding then would restart the burst).
    const onResize = () => {
      if (exitAt || finished) return;
      clearTimeout(rt);
      rt = setTimeout(() => {
        const w = node.clientWidth, h = node.clientHeight, kind = h > w ? 'portrait' : 'landscape';
        if (Math.abs(w - W) < 2 && kind === builtKind) return;
        build();
      }, 200);
    };

    function finish() {
      if (finished) return; finished = true;
      shown = true;
      html.classList.remove('pre-lock');
      setOn(false);
      window.dispatchEvent(new Event('preloader-done'));
    }

    node.addEventListener('pointerdown', skip);
    node.addEventListener('wheel', stop, { passive: false });
    node.addEventListener('touchmove', stop, { passive: false });
    addEventListener('keydown', onKey);
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onResize);
    const safety = setTimeout(finish, MAX_MS + EXIT_MS + 2500);           // hard fail-safe: the loader can never trap the page
    build();

    return () => {
      alive = false; cancelAnimationFrame(raf); clearTimeout(rt); clearTimeout(safety);
      html.classList.remove('pre-lock');
      removeEventListener('keydown', onKey); removeEventListener('resize', onResize); removeEventListener('orientationchange', onResize);
      node.removeEventListener('pointerdown', skip); node.removeEventListener('wheel', stop); node.removeEventListener('touchmove', stop);
    };
  }, [on]);

  if (!on) return null;
  return (
    <div className="pre" ref={root} data-lenis-prevent role="status" aria-label="Loading Revanraj Kata">
      <div className="pre-bg" ref={bg} />
      <canvas ref={cv} aria-hidden="true" />
      <div className="pre-bar" aria-hidden="true"><i ref={bar} /></div>
    </div>
  );
}
