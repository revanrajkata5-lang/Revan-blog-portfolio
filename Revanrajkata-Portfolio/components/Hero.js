'use client';
import { useEffect, useRef, useState } from 'react';
import { initShatter } from './shatter';
import { useSite } from '../lib/site';

const IMAGES = {
  landscape: { src: '/hero-desktop.png', dark: '/hero-desktop-dark.png', w: 1672, h: 940 },
  portrait: { src: '/hero-mobile.png', dark: '/hero-mobile-dark.png', w: 941, h: 1672 },
};
const NAME = 'REVANRAJ KATA';
// Typewriter loop (as in demo.mp4): type -> pause -> delete back to "I'm " -> type next -> ...
const WORDS = ['Revanraj..', 'Student :)', 'Developer...'];
const TYPE_MS = 110, DELETE_MS = 55, HOLD_MS = 1600, GAP_MS = 350;

function useTypeLoop(words) {
  const [text, setText] = useState(words[0]);
  useEffect(() => {
    let w = 0, n = 0, timer;
    const step = (typing) => {
      const word = words[w];
      if (typing) {
        n += 1; setText(word.slice(0, n));
        if (n >= word.length) { timer = setTimeout(() => step(false), HOLD_MS); return; }
        timer = setTimeout(() => step(true), TYPE_MS);
      } else {
        n -= 1; setText(word.slice(0, Math.max(n, 0)));
        if (n <= 0) { w = (w + 1) % words.length; timer = setTimeout(() => step(true), GAP_MS); return; }
        timer = setTimeout(() => step(false), DELETE_MS);
      }
    };
    // start from an empty word so the first phrase types in, like the video
    n = 0; setText('');
    const begin = () => { timer = setTimeout(() => step(true), 400); };
    // wait for the opening loader (if it is on screen) before typing starts
    if (document.querySelector('.pre')) addEventListener('preloader-done', begin, { once: true }); else begin();
    return () => { clearTimeout(timer); removeEventListener('preloader-done', begin); };
  }, [words]);
  return text;
}

export default function Hero() {
  const { profile } = useSite();
  const journey = useRef(null), stage = useRef(null), world = useRef(null);
  const copy = useRef(null), hint = useRef(null), card = useRef(null);
  const typed = useTypeLoop(WORDS);

  useEffect(() => initShatter({
    journey: journey.current, stage: stage.current, world: world.current,
    copy: copy.current, hint: hint.current, card: card.current,
  }, IMAGES), []);

  return (
    <>
      <div className="journey" id="top" ref={journey} aria-hidden="true"><span id="about" className="anchor" /></div>
      <div className="stage" aria-hidden="true"><div className="stage-in" ref={stage}><div className="world" ref={world} /></div></div>

      <header className="copy" ref={copy}>
        <div className="copy-in">
          <p className="status"><i /> {profile.status}</p>
          <h1 aria-label="I'm Revanraj, Student, Developer"><span className="im" aria-hidden="true">{"I'm "}</span><span className="tw" aria-hidden="true">{typed}<b className="caret" /></span></h1>
          <p className="intro">I&rsquo;m a Developer and Data Science student who loves building real products. From concept to deployment &mdash; I ship fast, clean, and user-focused web applications.</p>
          <div className="actions">
            <a className="btn dark" href="#about">View Full Profile <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg></a>
            <a className="btn ghost" href={profile.github} target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z" /></svg>
              GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="hint" ref={hint}>Scroll <i /></div>

      <section className="profile" id="profile" ref={card} aria-label="Profile">
        <div className="avatar" role="img" aria-label={NAME} />
        <h2>{NAME}</h2>
        <p className="role">Data Science Student</p>
        <dl>
          <div><dt>Internship</dt><dd><b>Intern &mdash; A+ Plus Tech Service</b><span>Since Aug 2026</span></dd></div>
          <div><dt>Education</dt><dd><b>B.Tech Data Science</b><span>Sri Indu College of Engg</span></dd></div>
          <div><dt>Projects</dt><dd><b>Full-Stack Web Apps</b><span>Next.js, HTML, CSS, FastAPI (Basic), Supabase</span></dd></div>
        </dl>
        <div className="actions">
          <a className="btn dark" href={profile.resumeUrl} target="_blank" rel="noopener">Resume</a>
          <a className="btn ghost" href="#projects">View Projects</a>
        </div>
      </section>
    </>
  );
}
