'use client';
import { useRef, useState, useEffect, useMemo, createRef, Fragment } from 'react';
import { useSite } from '../lib/site';
import { motion, MotionConfig, useScroll, useTransform, useSpring, useMotionValue, useReducedMotion, animate } from 'framer-motion';


const arrow = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>;
const EASE = [0.2, 0.7, 0.2, 1];

// Project logo (image) or short clip. Clips autoplay muted + looped, and only run while on screen.
function Media({ url, type, name }) {
  const el = useRef(null);
  useEffect(() => {
    const v = el.current;
    if (!v || type !== 'video' || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [url, type]);
  if (!url) return null;
  return type === 'video'
    ? <video ref={el} className="shot-media" src={url} muted loop autoPlay playsInline preload="metadata" aria-hidden="true" />
    : <img className="shot-media logo" src={url} alt="" loading="lazy" />;
}

function useMQ(q) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = matchMedia(q); setM(mq.matches);
    const f = () => setM(mq.matches); mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

// word-by-word mask reveal. The trigger sits on the (unclipped) wrapper and the words follow
// via variants; observing a word that starts hidden inside its own mask would never fire.
const wordsParent = (delay) => ({ hidden: {}, shown: { transition: { staggerChildren: 0.1, delayChildren: delay } } });
const wordChild = { hidden: { y: '115%', rotate: 4 }, shown: { y: '0%', rotate: 0, transition: { duration: 1, ease: EASE } } };

function Words({ children, className, delay = 0 }) {
  return (
    <motion.span className={className} aria-label={children.map((w) => w.text).join(' ')}
      variants={wordsParent(delay)} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.6 }}>
      {children.map((w, i) => (
        <span className="mask" key={i} aria-hidden="true">
          <motion.span className={w.em ? 'em' : undefined} variants={wordChild}>{w.text}&nbsp;</motion.span>
        </span>
      ))}
    </motion.span>
  );
}

function Counter({ to }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (x) => Math.round(x));
  return (
    <motion.b onViewportEnter={() => animate(v, to, { duration: 1.6, ease: EASE })}>
      <motion.span>{text}</motion.span>
    </motion.b>
  );
}

function Card({ p, gh, i, total, mobile, hover, calm, myRef, sentRef, nextSentRef, nextRef }) {
  // On phones the cards are position:sticky, and a stuck element reports a moving offset, which would
  // corrupt scroll measurements whenever the browser fires `resize` (address bar collapsing).
  // So on phones we measure a zero-height, non-sticky marker that sits where the card naturally starts.
  const own = mobile ? sentRef : myRef;
  const nxt = mobile ? nextSentRef : nextRef;
  const { scrollYProgress } = useScroll({ target: own, offset: ['start end', 'end start'] });
  const shotY = useTransform(scrollYProgress, [0, 1], calm ? ['0%', '0%'] : ['-9%', '9%']);
  const numY = useTransform(scrollYProgress, [0, 1], calm ? ['0%', '0%'] : ['35%', '-35%']);
  const drift = useTransform(scrollYProgress, [0, 1], mobile || calm ? [0, 0] : [i % 2 ? 70 : 0, i % 2 ? -40 : -20]);

  // mobile stack: when the NEXT card slides up, this one scales back and dims
  // The next card's element is attached after this card's effects run, so only start tracking it
  // once it exists (otherwise motion warns "Target ref is defined but not hydrated").
  const [seen, setSeen] = useState(null);
  useEffect(() => { setSeen(nxt || null); }, [nxt]);
  const { scrollYProgress: cover } = useScroll({ target: seen && seen === nxt ? nxt : own, offset: ['start end', 'start 0.2'] });
  const none = useMotionValue(0);
  const depth = nxt && seen === nxt ? cover : none;
  const stackScale = useTransform(depth, [0, 1], mobile ? [1, 0.9] : [1, 1]);
  const dim = useTransform(depth, [0, 1], mobile ? [0, 0.6] : [0, 0]);

  // 3D tilt on devices with a real pointer
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 160, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-9, 9]), { stiffness: 160, damping: 18 });
  const move = (e) => {
    if (!hover) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height);
    e.currentTarget.style.setProperty('--mx', e.clientX - r.left + 'px');
    e.currentTarget.style.setProperty('--my', e.clientY - r.top + 'px');
  };
  const leave = () => { mx.set(0.5); my.set(0.5); };

  // transform + opacity only: these run on the GPU compositor, so they stay smooth on phones
  const enter = {
    initial: { opacity: 0, y: mobile ? 60 : 80, scale: mobile ? 0.96 : 0.94 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: { once: true, amount: mobile ? 0.15 : 0.2 },
    transition: { duration: mobile ? 0.8 : 1, ease: EASE, delay: mobile ? 0 : (i % 2) * 0.12 },
  };

  return (
    <motion.div
      className="cell"
      ref={myRef}
      style={{ y: drift, scale: stackScale, transformOrigin: '50% 0%', '--i': i }}
    >
      <motion.article
        className={'pc' + (i % 2 ? ' light' : '')}
        {...enter}
        whileHover={hover ? { y: -6 } : undefined}
        whileTap={{ scale: 0.985 }}
        onMouseMove={move}
        onMouseLeave={leave}
      >
        <motion.div className="pc-in" style={hover ? { rotateX, rotateY, transformPerspective: 900 } : undefined}>
          <div className="shot" aria-hidden="true">
            <motion.div className="shot-in" style={{ y: shotY }}>
              <motion.span className="num" style={{ y: numY }}>{String(i + 1).padStart(2, '0')}</motion.span>
            </motion.div>
            <div className="chrome"><i /><i /><i /><span>{p.visit && p.live ? p.live.replace(/^https?:\/\//, '') : gh.replace(/^https?:\/\//, '') + (p.repo && !/^https?:/.test(p.repo) ? '/' + p.repo : '')}</span></div>
            {p.mediaUrl ? <Media url={p.mediaUrl} type={p.mediaType} /> : <span className="mono">{p.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</span>}
            <span className="count">{String(i + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          </div>
          <h3>{p.name}</h3>
          <p>{p.text}</p>
          <ul className="tags">{(p.tags || []).map((t) => <li key={t}>{t}</li>)}</ul>
          <div className="links">
            {p.visit && p.live && <a className="b light" href={p.live} target="_blank" rel="noopener">Live site {arrow}</a>}
            {!p.linkOnly && p.repo && <a className={'b ' + (p.visit && p.live ? 'line' : 'light')} href={/^https?:/.test(p.repo) ? p.repo : gh + '/' + p.repo} target="_blank" rel="noopener">Source code {!(p.visit && p.live) && arrow}</a>}
          </div>
        </motion.div>
        <motion.span className="dim" style={{ opacity: dim }} aria-hidden="true" />
      </motion.article>
    </motion.div>
  );
}

export default function Projects() {
  const { projects: PROJECTS, profile } = useSite();
  const GH = profile.github;
  const root = useRef(null);
  const mobile = useMQ('(max-width: 760px)');
  const hover = useMQ('(hover: hover) and (pointer: fine)');
  const rm = false;
  const refs = useMemo(() => PROJECTS.map(() => createRef()), [PROJECTS.length]);
  const sents = useMemo(() => PROJECTS.map(() => createRef()), [PROJECTS.length]);
  const { scrollYProgress } = useScroll({ target: root, offset: ['start start', 'end end'] });
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const barOpacity = useTransform(scrollYProgress, [0, 0.01, 0.985, 1], [0, 1, 1, 0]);

  // header drifts slower than the page; giant marquee slides with scroll
  const { scrollYProgress: head } = useScroll({ target: root, offset: ['start end', 'start start'] });
  const headY = useTransform(head, [0, 1], [90, 0]);
  const { scrollYProgress: mq } = useScroll({ target: root, offset: ['start end', 'end start'] });
  const mqX = useTransform(mq, [0, 1], ['4%', '-48%']);

  const live = PROJECTS.filter((p) => p.visit).length;
  const marquee = PROJECTS.map((p) => p.name).join('  •  ') + '  •  ';

  return (
    <MotionConfig reducedMotion="never">
      <main className="work" id="projects" ref={root}>
        <motion.div className="bar" style={{ scaleX: bar, opacity: barOpacity }} aria-hidden="true" />
        <div className="work-in">
          <motion.div style={{ y: headY }}>
            <motion.p className="eyebrow" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }}>Selected work</motion.p>
            <h2 className="work-title">
              <Words delay={0.1}>{[{ text: 'Things' }, { text: "I’ve" }, { text: 'built.', em: true }]}</Words>
            </h2>
            <motion.p className="work-lead" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}>
              Real products, from concept to deployment &mdash; shipped fast, clean, and user-focused.
            </motion.p>
            <motion.ul className="stats" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: 0.45 }}>
              <li><Counter key={PROJECTS.length} to={PROJECTS.length} /><span>Projects</span></li>
              <li><Counter key={live} to={live} /><span>Live on the web</span></li>
            </motion.ul>
          </motion.div>
        </div>

        <div className="marq" aria-hidden="true"><motion.div style={{ x: mqX }}>{marquee}{marquee}</motion.div></div>

        <div className="work-in">
          <div className="grid">
            {PROJECTS.map((p, i) => (
              <Fragment key={p.id || p.repo}>
                <span className="sent" ref={sents[i]} aria-hidden="true" />
                <Card p={p} gh={GH} i={i} total={PROJECTS.length} mobile={mobile} hover={hover} calm={rm} myRef={refs[i]} sentRef={sents[i]} nextRef={refs[i + 1]} nextSentRef={sents[i + 1]} />
              </Fragment>
            ))}
          </div>

          <motion.div
            className="cta"
            initial={{ opacity: 0, y: 60, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1, ease: EASE }}
          >
            <h3>Want to see more?</h3>
            <p>Every project is on GitHub.</p>
            <motion.a className="b light" href={GH} target="_blank" rel="noopener" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>View all on GitHub {arrow}</motion.a>
            <motion.a className="b line" href={profile.resumeUrl} target="_blank" rel="noopener" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} style={{ marginLeft: '.6rem' }}>Resume {arrow}</motion.a>
          </motion.div>
        </div>
      </main>
    </MotionConfig>
  );
}
