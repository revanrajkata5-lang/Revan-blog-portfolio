'use client';
import { useRef, useState, useEffect } from 'react';
import { useSite } from '../lib/site';
import { motion, MotionConfig, useScroll, useSpring, useTransform, useMotionValue, animate } from 'framer-motion';

const EASE = [0.2, 0.7, 0.2, 1];

// "95.2%" / "6" count up; anything longer (like "2028") is shown as plain text.
function statProps(v) {
  const m = String(v).match(/^(\d{1,3})(?:\.(\d+))?(%?)$/);
  return m ? { to: parseFloat(v), dec: m[2] ? m[2].length : 0, suf: m[3] } : null;
}

/* ---------- small building blocks ---------- */
const wordsParent = (delay) => ({ hidden: {}, shown: { transition: { staggerChildren: 0.1, delayChildren: delay } } });
const wordChild = { hidden: { y: '115%', rotate: 4 }, shown: { y: '0%', rotate: 0, transition: { duration: 1, ease: EASE } } };

function Words({ words, delay = 0 }) {
  return (
    <motion.span aria-label={words.map((w) => w.text).join(' ')} variants={wordsParent(delay)} initial="hidden" animate="shown">
      {words.map((w, i) => (
        <span className="mask" key={i} aria-hidden="true">
          <motion.span className={w.em ? 'em' : undefined} variants={wordChild}>{w.text}&nbsp;</motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/* Reveal-on-scroll that cannot get stuck: an IntersectionObserver AND a plain scroll/resize check run side by side,
   and whichever sees the element first wins. Anything already scrolled past is revealed too. */
function useReveal(amount = 0.15) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    let done = false, raf = 0, io;
    const stop = () => {
      removeEventListener('scroll', on); removeEventListener('resize', on); removeEventListener('load', on);
      cancelAnimationFrame(raf); if (io) io.disconnect();
    };
    const show = () => { if (done) return; done = true; stop(); setSeen(true); };
    const check = () => {
      raf = 0;
      if (done) return;
      const r = el.getBoundingClientRect(), vh = innerHeight || document.documentElement.clientHeight;
      const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      const need = Math.max(1, Math.min(r.height, vh * 0.9) * amount);
      if (r.bottom <= 0 || visible >= need) show();
    };
    function on() { if (!raf) raf = requestAnimationFrame(check); }
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    addEventListener('load', on);
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) show(); }, { threshold: [0, 0.1, 0.25] });
      io.observe(el);
    }
    check();
    const t = setTimeout(check, 400);   // layout can still be settling right after load
    return () => { clearTimeout(t); stop(); };
  }, [seen, amount]);
  return [ref, seen];
}

export function Reveal({ as = 'div', y = 40, delay = 0, amount, className, children, ...rest }) {
  const [ref, seen] = useReveal(amount);
  const M = motion[as];
  return (
    <M ref={ref} className={className} initial={{ opacity: 0, y }} animate={seen ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.9, ease: EASE, delay }} {...rest}>
      {children}
    </M>
  );
}

function Counter({ to, dec = 0, suf = '' }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (x) => x.toFixed(dec) + suf);
  const [ref, seen] = useReveal(0.3);
  useEffect(() => {
    if (!seen) return;
    const c = animate(v, to, { duration: 1.8, ease: EASE });
    return () => c.stop();
  }, [seen, to, v]);
  return (
    <b ref={ref}>
      <motion.span>{text}</motion.span>
    </b>
  );
}

// cursor-follow spotlight (CSS variables, no re-render)
function spot(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', e.clientX - r.left + 'px');
  e.currentTarget.style.setProperty('--my', e.clientY - r.top + 'px');
}

const chipsParent = { hidden: {}, shown: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } } };
const chipChild = { hidden: { opacity: 0, y: 16, scale: 0.9 }, shown: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 240, damping: 20 } } };

export function SkillCard({ g, i }) {
  const [ref, seen] = useReveal(0.12);
  return (
    <motion.article
      ref={ref}
      className={'sk-card' + (g.wide ? ' wide' : '') + (g.full ? ' full' : '')}
      onPointerMove={spot}
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 60, scale: 0.96 }}
      animate={seen ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 60, scale: 0.96 }}
      transition={{ duration: 0.9, ease: EASE, delay: (i % 3) * 0.08 }}
    >
      <span className="sk-glow" aria-hidden="true" />
      <header>
        <span className="sk-num">{String(i + 1).padStart(2, '0')}</span>
        <h3>{g.k}</h3>
      </header>
      <motion.ul variants={chipsParent} initial="hidden" animate={seen ? 'shown' : 'hidden'}>
        {g.items.map((it) => {
          const t = typeof it === 'string' ? it : it.t;
          return (
            <motion.li key={t} variants={chipChild} whileHover={{ y: -4 }}>
              {t}
              {it.tag && <em>{it.tag}</em>}
            </motion.li>
          );
        })}
      </motion.ul>
    </motion.article>
  );
}

// vertical line that draws itself as you scroll
function Timeline({ children }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const grow = useSpring(scrollYProgress, { stiffness: 110, damping: 28 });
  return (
    <div className="tl" ref={ref}>
      <span className="tl-rail" aria-hidden="true" />
      <motion.span className="tl-fill" aria-hidden="true" style={{ scaleY: grow }} />
      {children}
    </div>
  );
}

const dl = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>;
const ext = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>;

export default function Skills() {
  const { profile, resume, groups: GROUPS } = useSite();
  const RESUME = profile.resumeUrl;
  const MARQUEE = GROUPS.flatMap((g) => g.items.map((it) => String(typeof it === 'string' ? it : it.t).toUpperCase())).slice(0, 10).join(' · ') + ' · ';
  return (
    <MotionConfig reducedMotion="never">
      <main className="sk">
        <span className="sk-blob a" aria-hidden="true" />
        <span className="sk-blob b" aria-hidden="true" />

        <div className="sk-in">
          {/* ---------- header ---------- */}
          <motion.p className="sk-eye" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
            Skills &amp; Resume
          </motion.p>
          <h1 className="sk-title">
            <Words words={[{ text: 'Tools' }, { text: 'I' }, { text: 'build' }, { text: 'with.', em: true }]} delay={0.15} />
          </h1>
          <motion.p className="sk-lead" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.7 }}>
            {resume.summary}
          </motion.p>
          <motion.div className="sk-act" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.85 }}>
            <a className="btn dark" href={RESUME} download>Download resume {dl}</a>
            <a className="btn" href={RESUME} target="_blank" rel="noopener">View PDF {ext}</a>
          </motion.div>

          <ul className="sk-stats">
            {resume.stats.map((s, i) => {
              const c = statProps(s.value);
              return (
              <Reveal as="li" y={24} delay={i * 0.1} key={i + s.label}>
                {c ? <Counter key={s.value} {...c} /> : <b>{s.value}</b>}
                <span>{s.label}</span>
              </Reveal>
              );
            })}
          </ul>
        </div>

        {/* ---------- marquee ---------- */}
        <div className="sk-marq" aria-hidden="true">
          <div>{MARQUEE.repeat(4)}</div>
          <div>{MARQUEE.repeat(4)}</div>
        </div>

        <div className="sk-in">
          {/* ---------- skills ---------- */}
          <Reveal as="h2" className="sk-h">Skills<em>.</em></Reveal>
          <div className="sk-grid">
            {GROUPS.map((g, i) => <SkillCard key={i + g.k} g={g} i={i} />)}
          </div>

          {/* ---------- experience ---------- */}
          <section className="sk-sec">
            <Reveal as="h2" className="sk-h side">Experience<em>.</em></Reveal>
            <Timeline>
              {resume.experience.map((x, i) => (
                <Reveal className="tl-item" key={i + x.role}>
                  <span className="tl-when">{x.when}</span>
                  <h3>{x.role}</h3>
                  <p className="tl-org">{x.org}</p>
                  <p className="tl-sub">{x.sub}</p>
                  <ul>{(x.points || []).map((p, j) => <li key={j}>{p}</li>)}</ul>
                </Reveal>
              ))}
            </Timeline>
          </section>

          {/* ---------- projects ---------- */}
          <section className="sk-sec col">
            <Reveal as="h2" className="sk-h">Projects<em>.</em></Reveal>
            <ol className="sk-proj">
              {resume.projects.map((p, i) => (
                <Reveal as="li" key={i + p.name} onPointerMove={spot}>
                  <span className="sk-glow" aria-hidden="true" />
                  <span className="sk-pn">{String(i + 1).padStart(2, '0')}</span>
                  <div className="sk-pb">
                    <h3>{p.name}</h3>
                    <p className="sk-pk">{p.kind}</p>
                    <p className="sk-pt">{p.text}</p>
                  </div>
                  <ul className="sk-ptags">{(p.stack || []).map((s) => <li key={s}>{s}</li>)}</ul>
                </Reveal>
              ))}
            </ol>
          </section>

          {/* ---------- education ---------- */}
          <section className="sk-sec">
            <Reveal as="h2" className="sk-h side">Education<em>.</em></Reveal>
            <Timeline>
              {resume.education.map((x, i) => (
                <Reveal className="tl-item" key={i + x.title}>
                  <span className="tl-when">{x.when}</span>
                  <h3>{x.title}</h3>
                  <p className="tl-org">{x.org}</p>
                  {x.score && <p className="tl-score">{x.score}</p>}
                </Reveal>
              ))}
            </Timeline>
          </section>

          {/* ---------- resume CTA ---------- */}
          <Reveal className="sk-cta">
            <h3>Want the full picture?</h3>
            <p>Grab my resume as a PDF, or say hello.</p>
            <div className="sk-act center">
              <a className="btn dark" href={RESUME} download>Download resume {dl}</a>
              <a className="btn" href="/contact">Get in touch {ext}</a>
            </div>
          </Reveal>

          <p className="sk-foot">© REVANRAJ KATA</p>
        </div>
      </main>
    </MotionConfig>
  );
}
