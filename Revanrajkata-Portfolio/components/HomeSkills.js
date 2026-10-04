'use client';
import Link from 'next/link';
import { MotionConfig } from 'framer-motion';
import { SkillCard, Reveal } from './Skills';
import { useSite } from '../lib/site';

const ext = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>;
const arrow = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>;

// Skills block on the home page, between Projects and Contact. The full version lives at /skills.
export default function HomeSkills() {
  const { groups: GROUPS, profile } = useSite();
  const RESUME = profile.resumeUrl;
  return (
    <MotionConfig reducedMotion="never">
      <section className="skh" id="skills" aria-label="Skills">
        <div className="skh-in">
          <Reveal as="p" className="sk-eye" y={16}>Skills</Reveal>
          <div className="skh-head">
            <Reveal as="h2" className="sk-h skh-h">Stack I work with<em>.</em></Reveal>
            <Reveal as="p" className="skh-lead" delay={0.1}>
              Full-stack and frontend applications built with Python, JavaScript, Next.js, React.js, FastAPI and Supabase.
            </Reveal>
          </div>
          <div className="sk-grid">
            {GROUPS.map((g, i) => <SkillCard key={i + g.k} g={g} i={i} />)}
          </div>
          <Reveal className="skh-act" y={24}>
            <Link className="btn dark" href="/skills">Full skills &amp; experience {arrow}</Link>
            <a className="btn" href={RESUME} target="_blank" rel="noopener">Resume {ext}</a>
          </Reveal>
        </div>
      </section>
    </MotionConfig>
  );
}
