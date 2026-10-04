'use client';
import { useEffect, useState } from 'react';

const KEY = 'theme';
const BAR = { light: '#ffffff', dark: '#08080a' };

function syncMeta(theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.removeAttribute('media'); m.setAttribute('content', BAR[theme]); });
}

// Applies a theme to <html>, updates the browser UI colour, and tells canvas-based components to repaint.
function apply(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  syncMeta(theme);
  window.dispatchEvent(new Event('themechange'));
}

const sun = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </svg>
);
const moon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z" />
  </svg>
);

// variant "bar": sits inside the desktop navbar. variant "chip": floating button on phones.
export default function ThemeToggle({ variant = 'bar' }) {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    read();
    syncMeta(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');   // browser bar colour matches on load
    // follow the device setting until the visitor picks a theme themselves
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onSystem = (e) => { try { if (localStorage.getItem(KEY)) return; } catch { /* storage blocked */ } apply(e.matches ? 'dark' : 'light'); };
    addEventListener('themechange', read);
    mq.addEventListener('change', onSystem);
    return () => { removeEventListener('themechange', read); mq.removeEventListener('change', onSystem); };
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theme-anim');
    clearTimeout(window.__themeAnim);
    window.__themeAnim = setTimeout(() => root.classList.remove('theme-anim'), 600);
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
    apply(next);
  }

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={'nb-theme' + (variant === 'chip' ? ' chip' : '')}
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to night mode'}
      title={dark ? 'Light mode' : 'Night mode'}
    >
      <span className="nb-theme-ic">{dark ? sun : moon}</span>
    </button>
  );
}
