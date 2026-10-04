'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import ShatterText from './ShatterText';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { fbDb, firebaseReady } from '../lib/firebase';
import { useSite } from '../lib/site';

const LINES = ["Let's work", 'together.'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const arrow = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg>;
const send = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>;

export default function Contact({ variant = 'section' }) {
  const page = variant === 'page';
  const CONTACT = useSite().profile;
  const heading = useRef(null);
  const [v, setV] = useState({ name: '', email: '', message: '' });
  const [err, setErr] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [copied, setCopied] = useState(false);

  const rows = [
    { label: 'Email', value: CONTACT.email, href: 'mailto:' + CONTACT.email, copy: true },
    { label: 'GitHub', value: CONTACT.github.replace('https://', ''), href: CONTACT.github, ext: true },
    CONTACT.linkedin && { label: 'LinkedIn', value: CONTACT.linkedin.replace(/^https?:\/\/(www\.)?/, ''), href: CONTACT.linkedin, ext: true },
    CONTACT.phone && { label: 'Phone', value: CONTACT.phone, href: 'tel:' + CONTACT.phone.replace(/[^+\d]/g, '') },
  ].filter(Boolean);

  const set = (k) => (e) => { setV((s) => ({ ...s, [k]: e.target.value })); if (err[k]) setErr((s) => ({ ...s, [k]: '' })); };

  async function onSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!v.name.trim()) next.name = 'Enter your name.';
    if (!EMAIL_RE.test(v.email.trim())) next.email = 'Enter a valid email address, like name@example.com.';
    if (!v.message.trim()) next.message = 'Write a short message.';
    setErr(next);
    const first = Object.keys(next)[0];
    if (first) { document.getElementById((page ? 'p-' : 's-') + first)?.focus(); return; }

    setStatus('sending');
    heading.current?.burst(1);                       // the heading shatters, then re-forms
    const mail = 'mailto:' + CONTACT.email + '?subject=' + encodeURIComponent('Portfolio message from ' + v.name.trim());
    try {
      if (!firebaseReady()) throw new Error('not configured');
      await addDoc(collection(fbDb(), 'messages'), {
        name: v.name.trim(), email: v.email.trim(), message: v.message.trim(), createdAt: serverTimestamp(), read: false,
      });
      setV({ name: '', email: '', message: '' });
      setStatus('sent');
    } catch {
      setStatus('error');
      window.location.href = mail + '&body=' + encodeURIComponent(v.message.trim() + '\n\n' + v.name.trim() + '\n' + v.email.trim());
    }
  }

  async function copyEmail() {
    try { await navigator.clipboard.writeText(CONTACT.email); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }

  const id = (k) => (page ? 'p-' : 's-') + k;
  const field = (k, label, props = {}) => (
    <div className="fld">
      <div className="fld-box">
      {k === 'message'
        ? <textarea id={id(k)} rows={4} placeholder=" " value={v[k]} onChange={set(k)} aria-invalid={!!err[k]} aria-describedby={err[k] ? id(k) + '-e' : undefined} {...props} />
        : <input id={id(k)} placeholder=" " value={v[k]} onChange={set(k)} aria-invalid={!!err[k]} aria-describedby={err[k] ? id(k) + '-e' : undefined} {...props} />}
      <label htmlFor={id(k)}>{label}</label>
      <i className="ln" aria-hidden="true" />
      </div>
      {err[k] && <p className="fld-err" id={id(k) + '-e'}>{err[k]}</p>}
    </div>
  );

  return (
    <section className={'ct' + (page ? ' page' : '')} id="contact" aria-label="Contact">
      <div className="ct-in">
        <p className="ct-status"><i /> {CONTACT.status}</p>
        <ShatterText ref={heading} lines={LINES} mode={page ? 'intro' : 'scroll'} maxSize={page ? 190 : 110} />

        <div className="ct-grid">
          <div className="ct-side">
            <p className="ct-lead">Got a project, an internship opening, or a question? Send a message and I&rsquo;ll reply by email.</p>
            <ul className="ct-rows">
              {rows.map((r) => (
                <li key={r.label}>
                  <a href={r.href} {...(r.ext ? { target: '_blank', rel: 'noopener' } : {})}>
                    <span className="ct-k">{r.label}</span>
                    <span className="ct-v">{r.value}</span>
                    <span className="ct-go">{arrow}</span>
                  </a>
                  {r.copy && <button type="button" className="ct-copy" onClick={copyEmail}>{copied ? 'Copied' : 'Copy'}</button>}
                </li>
              ))}
            </ul>
            {!page && <Link className="ct-more" href="/contact">Open the full contact page</Link>}
          </div>

          <form className="ct-form" onSubmit={onSubmit} noValidate>
            {field('name', 'Your name', { autoComplete: 'name' })}
            {field('email', 'Your email', { type: 'email', autoComplete: 'email', inputMode: 'email' })}
            {field('message', 'Message')}
            <div className="ct-act">
              <button className="b light ct-send" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending' : 'Send message'} {send}
              </button>
            </div>
            <p className="ct-note" role="status" aria-live="polite">
              {status === 'sent' && 'Thanks, your message has been sent. I’ll reply by email.'}
              {status === 'error' && (<>Couldn’t send it from here, so your email app is opening instead. <button type="button" className="ct-copy inline" onClick={copyEmail}>{copied ? 'Copied' : 'Copy my email'}</button> if nothing opens.</>)}
            </p>
          </form>
        </div>

        <p className="foot">
          &copy; 2026 {CONTACT.name}
          {page && <> &nbsp;&middot;&nbsp; <Link href="/">Back to portfolio</Link></>}
        </p>
      </div>
    </section>
  );
}
