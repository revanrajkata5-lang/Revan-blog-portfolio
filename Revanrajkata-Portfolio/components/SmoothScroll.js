'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';

// Smooth scrolling everywhere:
//  - desktop wheel / trackpad: Lenis inertial smoothing
//  - iOS + Android touch: the browser's own momentum scrolling (the smoothest possible; Lenis never touches it)
//  - in-page links (#about, #projects ...): glide to the section with an eased animation
// Scroll-driven effects keep working because Lenis still moves the native scroll position.
export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, anchors: false, allowNestedScroll: true });
    window.__lenis = lenis;
    let raf = requestAnimationFrame(function tick(t) { lenis.raf(t); raf = requestAnimationFrame(tick); });

    if (document.querySelector('.pre')) lenis.stop();                  // opening loader owns the screen first
    const go = () => { lenis.start(); lenis.resize(); };
    const resize = () => lenis.resize();
    addEventListener('preloader-done', go);
    addEventListener('load', resize);
    addEventListener('orientationchange', resize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(document.body);

    // same-page anchor links: ease to the target (works on iOS and Android too)
    const onClick = (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      let u; try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.origin !== location.origin || u.pathname !== location.pathname || !u.hash) return;
      const id = decodeURIComponent(u.hash.slice(1));
      const el = id === 'top' ? null : document.getElementById(id);
      if (id !== 'top' && !el) return;
      e.preventDefault(); e.stopPropagation();
      lenis.scrollTo(el || 0, { duration: 1.35, easing: (t) => 1 - Math.pow(1 - t, 4) });
      try { history.replaceState(null, '', u.hash); } catch (err) { /* ignore */ }
    };
    document.addEventListener('click', onClick, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', onClick, true);
      removeEventListener('preloader-done', go); removeEventListener('load', resize); removeEventListener('orientationchange', resize);
      if (ro) ro.disconnect();
      if (window.__lenis === lenis) delete window.__lenis;
      lenis.destroy();
    };
  }, []);
  return null;
}
