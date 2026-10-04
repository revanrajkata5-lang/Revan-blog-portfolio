'use client';
import { useSite } from '../lib/site';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const I = (d) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
const ICONS = {
  home: I(<path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10" />),
  profile: I(<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.9-3.6 3.7-5.4 7.5-5.4s6.6 1.8 7.5 5.4" /></>),
  projects: I(<><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>),
  skills: I(<path d="M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5M13.5 5 10.5 19" />),
  blog: I(<path d="M5 4.5h10.5L19 8v11.5H5zM8.5 11h7M8.5 14.5h7M8.5 8h3.5" />),
  contact: I(<><rect x="3.5" y="5.5" width="17" height="13" rx="2.6" /><path d="M4.5 7.5 12 13l7.5-5.5" /></>),
  github: I(<path d="M12 3.2a8.8 8.8 0 0 0-2.8 17.15c.44.08.6-.19.6-.42v-1.5c-2.45.53-2.97-1.18-2.97-1.18-.4-1.02-.98-1.29-.98-1.29-.8-.55.06-.54.06-.54.88.06 1.35.91 1.35.91.78 1.35 2.05.96 2.55.73.08-.57.3-.96.55-1.18-1.96-.22-4.02-.98-4.02-4.36 0-.96.34-1.75.91-2.37-.09-.22-.4-1.12.09-2.33 0 0 .74-.24 2.42.9a8.4 8.4 0 0 1 4.4 0c1.68-1.14 2.42-.9 2.42-.9.49 1.21.18 2.11.09 2.33.57.62.91 1.41.91 2.37 0 3.39-2.06 4.14-4.03 4.36.31.27.6.81.6 1.64v2.43c0 .24.16.51.61.42A8.8 8.8 0 0 0 12 3.2z" />),
};

export default function Navbar() {
  const GH = useSite().profile.github;
  const pathname = usePathname();
  const onContact = pathname === '/contact';
  const onSkills = pathname === '/skills';
  const onBlog = pathname.startsWith('/blog');
  const sub = onContact || onSkills || onBlog;           // pages other than home
  const [active, setActive] = useState(onContact ? 'contact' : onSkills ? 'skills' : onBlog ? 'blog' : 'home');
  const pre = sub ? '/' : '';                  // from /contact or /skills, in-page anchors point back to the home page
  const ITEMS = [
    { id: 'home', label: 'Home', href: sub ? '/' : '#top' },
    { id: 'profile', label: 'Profile', href: pre + '#about' },
    { id: 'projects', label: 'Projects', href: pre + '#projects' },
    { id: 'skills', label: 'Skills', href: onSkills ? '/skills' : pre + '#skills' },
    { id: 'blog', label: 'Blog', href: '/blog' },
    { id: 'contact', label: 'Contact', href: '/contact' },
  ];

  useEffect(() => {
    if (sub) { setActive(onContact ? 'contact' : onBlog ? 'blog' : 'skills'); return; }
    let raf = 0;
    const calc = () => {
      raf = 0;
      const journey = document.querySelector('.journey'), work = document.querySelector('.work'), ct = document.querySelector('.ct');
      if (!journey || !work) return;
      const max = journey.offsetHeight - innerHeight;
      const f = max > 0 ? scrollY / max : 0;
      const wt = work.getBoundingClientRect().top;
      const ctTop = ct ? ct.getBoundingClientRect().top : Infinity;
      const sk = document.querySelector('.skh');
      const skTop = sk ? sk.getBoundingClientRect().top : Infinity;
      setActive(ctTop < innerHeight * 0.5 ? 'contact' : skTop < innerHeight * 0.5 ? 'skills' : wt < innerHeight * 0.55 ? 'projects' : f > 0.5 ? 'profile' : 'home');
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(calc); };
    calc();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, [sub, onContact, onBlog]);

  return (
    <>
      <a className="nb-chip" href={ITEMS[0].href} aria-label="REVANRAJ KATA — back to top">
        <img src="/logo.png" alt="" width="44" height="44" />
      </a>
      <header className="nb">
        <nav className="nb-bar" aria-label="Main">
          <a className="nb-brand" href={ITEMS[0].href} aria-label="REVANRAJ KATA — home">
            <img className="nb-logo" src="/logo.png" alt="" width="42" height="42" />
            <span className="nb-name">REVANRAJ<b> KATA</b></span>
          </a>
          <ul className="nb-links">
            {ITEMS.map((it) => (
              <li key={it.id}>
                <Link href={it.href} className={active === it.id ? 'on' : ''} aria-current={active === it.id ? 'page' : undefined}>
                  {active === it.id && <motion.span className="nb-pill" layoutId="nb-pill" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                  <span className="nb-ic">{ICONS[it.id]}</span>
                  <span className="nb-lb">{it.label}</span>
                </Link>
              </li>
            ))}
            <li className="nb-gh-dock">
              <a href={GH} target="_blank" rel="noopener">
                <span className="nb-ic">{ICONS.github}</span><span className="nb-lb">GitHub</span>
              </a>
            </li>
          </ul>
          <div className="nb-end">
            <ThemeToggle variant="bar" />
            <a className="nb-cta" href={GH} target="_blank" rel="noopener">
              <span className="nb-ic">{ICONS.github}</span> GitHub
            </a>
          </div>
        </nav>
      </header>
      <div className="nb-theme-float"><ThemeToggle variant="chip" /></div>
    </>
  );
}
