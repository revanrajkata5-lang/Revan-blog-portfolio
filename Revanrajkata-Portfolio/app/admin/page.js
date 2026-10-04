'use client';
import './admin.css';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, getDocs, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { fbAuth, fbDb, fbStorage, firebaseReady, ADMIN_EMAIL } from '../../lib/firebase';
import { DEFAULTS, loadSite, refreshSite } from '../../lib/site';
import { loadPosts, today, fmtDate } from '../../lib/blog';

/* ---------- helpers ---------- */
const K = () => Math.random().toString(36).slice(2, 9);
const withK = (a) => (a || []).map((x) => ({ ...x, _k: x._k || K() }));
const strip = (a) => a.map(({ _k, ...r }) => r);
const lines = { enc: (a) => (a || []).join('\n'), dec: (s) => s.split('\n').map((x) => x.trim()).filter(Boolean) };
const csv = { enc: (a) => (a || []).join(', '), dec: (s) => s.split(',').map((x) => x.trim()).filter(Boolean) };
// skills: one per line, "Java | Basic" adds a small tag next to the skill
const skills = {
  enc: (a) => (a || []).map((x) => (typeof x === 'string' ? x : x.tag ? `${x.t} | ${x.tag}` : x.t)).join('\n'),
  dec: (s) => s.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const [t, tag] = x.split('|').map((y) => y.trim()); return tag ? { t, tag } : t; }),
};
const videoLength = (file) => new Promise((res, rej) => {
  const v = document.createElement('video'); v.preload = 'metadata';
  v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(v.duration); };
  v.onerror = () => rej(new Error('Could not read this video.'));
  v.src = URL.createObjectURL(file);
});
// Free uploads via Cloudinary (no card needed). Used automatically when its two env vars are set; otherwise Firebase Storage.
const CLD = { name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, preset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET };
const useCloud = !!(CLD.name && CLD.preset);
const cloudUpload = (file, onPct) => new Promise((res, rej) => {
  const x = new XMLHttpRequest(); x.open('POST', `https://api.cloudinary.com/v1_1/${CLD.name}/auto/upload`);
  x.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
  x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 && j.secure_url ? res(j.secure_url) : rej(new Error(j.error?.message || 'Upload failed')); };
  x.onerror = () => rej(new Error('Network error'));
  const f = new FormData(); f.append('file', file); f.append('upload_preset', CLD.preset); x.send(f);
});
const NO_STORAGE = 'Firebase Storage is not available on the free Spark plan. Set up Cloudinary (see setup notes) or paste a link instead.';
const safeName = (n) => n.replace(/[^\w.-]/g, '_');

/* ---------- small UI pieces ---------- */
const F = ({ label, children }) => <label className="f"><span>{label}</span>{children}</label>;

// Textarea that edits an array. Keeps its own raw text so typing newlines / commas feels normal.
function TextList({ value, onChange, codec = lines, rows = 4 }) {
  const [t, setT] = useState(codec.enc(value));
  return <textarea rows={rows} value={t} onChange={(e) => { setT(e.target.value); onChange(codec.dec(e.target.value)); }} />;
}

function ListEditor({ title, hint, items, setItems, blank, fields, nameOf }) {
  const upd = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const mv = (i, d) => { const a = [...items], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setItems(a); };
  return (
    <div className="blk">
      <h3>{title}</h3>{hint && <p className="hint">{hint}</p>}
      {items.map((x, i) => (
        <div className="item" key={x._k}>
          <div className="rowh">
            <b>{nameOf(x, i)}</b>
            <button className="btn sm" onClick={() => mv(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button className="btn sm" onClick={() => mv(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
            <button className="btn sm del" onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</button>
          </div>
          {fields.map((f) => (
            <F key={f.k} label={f.label}>
              {f.t === 'area' ? <textarea rows={3} value={x[f.k] || ''} onChange={(e) => upd(i, f.k, e.target.value)} />
                : f.t === 'lines' ? <TextList value={x[f.k]} onChange={(v) => upd(i, f.k, v)} />
                : f.t === 'csv' ? <TextList rows={2} codec={csv} value={x[f.k]} onChange={(v) => upd(i, f.k, v)} />
                : f.t === 'skills' ? <TextList codec={skills} value={x.items} onChange={(v) => upd(i, 'items', v)} />
                : f.t === 'size' ? (
                  <select value={x.full ? 'full' : x.wide ? 'wide' : ''} onChange={(e) => setItems(items.map((y, j) => (j === i ? { ...y, wide: e.target.value === 'wide', full: e.target.value === 'full' } : y)))}>
                    <option value="">Normal</option><option value="wide">Wide</option><option value="full">Full width</option>
                  </select>)
                : <input type="text" value={x[f.k] || ''} onChange={(e) => upd(i, f.k, e.target.value)} />}
            </F>
          ))}
        </div>
      ))}
      <button className="btn" onClick={() => setItems([...items, { ...blank, _k: K() }])}>+ Add</button>
    </div>
  );
}

/* ---------- login ---------- */
function Login({ note }) {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await signInWithEmailAndPassword(fbAuth(), email.trim(), pw); }
    catch { setErr('Wrong email or password.'); }
    setBusy(false);
  }
  async function reset() {
    if (!email.trim()) return setErr('Type your email first, then press “Forgot password”.');
    try { await sendPasswordResetEmail(fbAuth(), email.trim()); setErr('Reset link sent. Check your inbox.'); } catch { setErr('Could not send the reset email.'); }
  }
  return (
    <form className="login" onSubmit={go}>
      <h2>Admin login</h2>
      {note && <p className="err">{note}</p>}
      <F label="Email"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></F>
      <F label="Password"><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></F>
      {err && <p className="err">{err}</p>}
      <div className="actions"><button className="btn pri" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><button type="button" className="btn" onClick={reset}>Forgot password</button></div>
    </form>
  );
}

/* ---------- messages ---------- */
function Messages({ msgs, say }) {
  const when = (m) => m.createdAt?.toDate?.().toLocaleString() || 'just now';
  const toggle = (m) => updateDoc(doc(fbDb(), 'messages', m.id), { read: !m.read });
  const del = async (m) => { if (confirm('Delete this message?')) { await deleteDoc(doc(fbDb(), 'messages', m.id)); say('Message deleted'); } };
  return (
    <>
      <h2>Messages</h2>
      {!msgs.length && <p className="hint">No messages yet. Anything sent from your Contact form shows up here.</p>}
      {msgs.map((m) => (
        <div className={'msg' + (m.read ? '' : ' new')} key={m.id}>
          <b>{m.name}</b> · <a href={'mailto:' + m.email}>{m.email}</a><br /><small>{when(m)}{m.read ? '' : ' · NEW'}</small>
          <p>{m.message}</p>
          <div className="actions">
            <a className="btn sm pri" href={'mailto:' + m.email + '?subject=' + encodeURIComponent('Re: your message')}>Reply</a>
            <button className="btn sm" onClick={() => toggle(m)}>{m.read ? 'Mark unread' : 'Mark read'}</button>
            <button className="btn sm del" onClick={() => del(m)}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ---------- projects ---------- */
const guessType = (u) => (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u) ? 'video' : u ? 'image' : '');
const saveProject = (p) => { const { id, ...d } = p; return setDoc(doc(fbDb(), 'projects', id), d, { merge: true }); };

function ProjectCard({ p, idx, count, patch, move, remove, say }) {
  const [pct, setPct] = useState(null), [busy, setBusy] = useState(false);

  async function pick(file) {
    if (!file) return;
    const vid = file.type.startsWith('video/'), img = file.type.startsWith('image/');
    if (!vid && !img) return say('Choose an image (logo) or a video clip.');
    if (img && file.size > 3e6) return say('Logo is over 3 MB. Please use a smaller image.');
    if (vid) {
      if (file.size > 15e6) return say('Video is over 15 MB. A 10-second clip should be much smaller; try compressing it.');
      try { const d = await videoLength(file); if (d > 10.5) return say(`That clip is ${d.toFixed(1)}s. Please trim it to 10 seconds or less.`); }
      catch (e) { return say(e.message); }
    }
    if (useCloud) {
      setPct(0);
      try {
        const url = await cloudUpload(file, setPct);
        if (p.mediaPath) deleteObject(ref(fbStorage(), p.mediaPath)).catch(() => {});
        const d = { mediaUrl: url, mediaType: vid ? 'video' : 'image', mediaPath: '' };
        patch(p.id, d); await saveProject({ ...p, ...d }); refreshSite(); say('Uploaded and saved');
      } catch (e) { say('Upload failed: ' + e.message); }
      setPct(null); return;
    }
    const path = `projects/${p.id}/${Date.now()}-${safeName(file.name)}`;
    const task = uploadBytesResumable(ref(fbStorage(), path), file);
    setPct(0);
    task.on('state_changed', (s) => setPct(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      (e) => { setPct(null); say(NO_STORAGE); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        if (p.mediaPath) deleteObject(ref(fbStorage(), p.mediaPath)).catch(() => {});
        const d = { mediaUrl: url, mediaType: vid ? 'video' : 'image', mediaPath: path };
        patch(p.id, d); await saveProject({ ...p, ...d }); refreshSite(); setPct(null); say('Uploaded and saved');
      });
  }
  async function dropMedia() {
    if (p.mediaPath) deleteObject(ref(fbStorage(), p.mediaPath)).catch(() => {});
    const d = { mediaUrl: '', mediaType: '', mediaPath: '' };
    patch(p.id, d); await saveProject({ ...p, ...d }); refreshSite(); say('Media removed');
  }
  async function save() {
    setBusy(true);
    try { await saveProject({ ...p, tags: p.tags || [] }); refreshSite(); say('Saved'); } catch (e) { say('Save failed: ' + e.message); }
    setBusy(false);
  }
  const set = (k) => (e) => patch(p.id, { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="item">
      <div className="rowh">
        <b>{String(idx + 1).padStart(2, '0')} · {p.name || 'Untitled'}</b>
        <button className="btn sm" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
        <button className="btn sm" onClick={() => move(idx, 1)} disabled={idx === count - 1}>↓</button>
        <button className="btn sm del" onClick={() => remove(p)}>Delete</button>
      </div>
      <div className="media">
        <div className="prev">
          {p.mediaUrl ? (p.mediaType === 'video' ? <video src={p.mediaUrl} muted loop autoPlay playsInline /> : <img src={p.mediaUrl} alt="" />) : 'No logo / clip'}
        </div>
        <div>
          <F label="Upload logo (image) or a clip up to 10 seconds"><input type="file" accept="image/*,video/*" onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} /></F>
          {pct !== null && <div className="bar"><i style={{ width: pct + '%' }} /></div>}
          <F label="…or paste an image / video link"><input type="url" placeholder="https://…" value={p.mediaPath ? '' : p.mediaUrl || ''} onChange={(e) => patch(p.id, { mediaUrl: e.target.value, mediaType: guessType(e.target.value), mediaPath: '' })} /></F>
          {p.mediaUrl && <button className="btn sm del" onClick={dropMedia}>Remove logo / clip</button>}
        </div>
      </div>
      <F label="Project name"><input type="text" value={p.name || ''} onChange={set('name')} /></F>
      <F label="Description"><textarea rows={3} value={p.text || ''} onChange={set('text')} /></F>
      <F label="Tags (comma separated)"><TextList rows={1} codec={csv} value={p.tags} onChange={(v) => patch(p.id, { tags: v })} /></F>
      <div className="grid2">
        <F label="Live site URL"><input type="url" placeholder="https://…" value={p.live || ''} onChange={set('live')} /></F>
        <F label="GitHub repo name (or full URL)"><input type="text" value={p.repo || ''} onChange={set('repo')} /></F>
      </div>
      <label className="chk"><input type="checkbox" checked={!!p.visit} onChange={set('visit')} /> Show “Live site” button</label>
      <label className="chk"><input type="checkbox" checked={!p.linkOnly} onChange={(e) => patch(p.id, { linkOnly: !e.target.checked })} /> Show “Source code” button</label>
      <div className="actions"><button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save project'}</button></div>
    </div>
  );
}

function Projects({ say }) {
  const [list, setList] = useState(null);
  const load = async () => { const s = await getDocs(query(collection(fbDb(), 'projects'), orderBy('order'))); setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))); };
  useEffect(() => { load().catch((e) => say('Could not load projects: ' + e.message)); }, []);
  const patch = (id, d) => setList((l) => l.map((p) => (p.id === id ? { ...p, ...d } : p)));

  async function add() {
    const order = list.length ? Math.max(...list.map((p) => p.order || 0)) + 1 : 1;
    const d = { name: 'New project', text: '', tags: [], live: '', repo: '', visit: false, linkOnly: false, mediaUrl: '', mediaType: '', order };
    const r = await addDoc(collection(fbDb(), 'projects'), d);
    setList([...list, { id: r.id, ...d }]); refreshSite(); say('Project added. Fill it in and press Save.');
  }
  async function remove(p) {
    if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    if (p.mediaPath) deleteObject(ref(fbStorage(), p.mediaPath)).catch(() => {});
    await deleteDoc(doc(fbDb(), 'projects', p.id)); setList(list.filter((x) => x.id !== p.id)); refreshSite(); say('Project deleted');
  }
  async function move(i, d) {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const a = [...list]; [a[i], a[j]] = [a[j], a[i]];
    const b = writeBatch(fbDb()); a.forEach((p, n) => { p.order = n + 1; b.update(doc(fbDb(), 'projects', p.id), { order: n + 1 }); });
    await b.commit(); setList(a); refreshSite();
  }
  if (!list) return <p className="hint">Loading…</p>;
  return (
    <>
      <h2>Projects <button className="btn pri" onClick={add} style={{ marginLeft: '.6rem' }}>+ Add project</button></h2>
      <p className="hint">Order here is the order on your site. Use ↑ ↓ to rearrange. Each project has its own Save button.</p>
      {list.map((p, i) => <ProjectCard key={p.id} p={p} idx={i} count={list.length} patch={patch} move={move} remove={remove} say={say} />)}
      {!list.length && <p className="hint">No projects yet.</p>}
    </>
  );
}

/* ---------- skills ---------- */
function SkillsTab({ site, say }) {
  const [g, setG] = useState(() => withK(site.groups.map((x) => ({ ...x }))));
  const save = async () => { await setDoc(doc(fbDb(), 'site', 'skills'), { groups: strip(g) }); refreshSite(); say('Skills saved'); };
  return (
    <>
      <h2>Skills</h2>
      <ListEditor title="Skill groups" hint="One skill per line. Write “Java | Basic” to show a small tag next to a skill." items={g} setItems={setG}
        blank={{ k: 'New group', items: [] }} nameOf={(x) => x.k || 'Group'}
        fields={[{ k: 'k', label: 'Group title' }, { k: 'items', t: 'skills', label: 'Skills' }, { k: 'size', t: 'size', label: 'Card size on the page' }]} />
      <button className="btn pri" onClick={save}>Save skills</button>
    </>
  );
}

/* ---------- resume ---------- */
function ResumeTab({ site, say }) {
  const r = site.resume;
  const [summary, setSummary] = useState(r.summary);
  const [stats, setStats] = useState(withK(r.stats)), [exp, setExp] = useState(withK(r.experience));
  const [edu, setEdu] = useState(withK(r.education)), [pro, setPro] = useState(withK(r.projects));
  async function save() {
    await setDoc(doc(fbDb(), 'site', 'resume'), { summary, stats: strip(stats), experience: strip(exp), education: strip(edu), projects: strip(pro) });
    refreshSite(); say('Resume saved');
  }
  return (
    <>
      <h2>Resume page</h2>
      <p className="hint">This is the content of your /skills page. To change the downloadable PDF, go to the Profile tab.</p>
      <div className="blk"><h3>Summary</h3><textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
      <ListEditor title="Stats" hint="Numbers like 6, 95.2% or 92% count up. Longer values like 2028 show as text." items={stats} setItems={setStats} blank={{ value: '', label: '' }} nameOf={(x) => `${x.value} ${x.label}`}
        fields={[{ k: 'value', label: 'Value' }, { k: 'label', label: 'Label' }]} />
      <ListEditor title="Experience" items={exp} setItems={setExp} blank={{ role: '', org: '', when: '', sub: '', points: [] }} nameOf={(x) => x.role || 'Experience'}
        fields={[{ k: 'role', label: 'Role' }, { k: 'org', label: 'Company / place' }, { k: 'when', label: 'When' }, { k: 'sub', label: 'Subtitle' }, { k: 'points', t: 'lines', label: 'Bullet points (one per line)' }]} />
      <ListEditor title="Projects on the resume page" items={pro} setItems={setPro} blank={{ name: '', kind: '', stack: [], text: '' }} nameOf={(x) => x.name || 'Project'}
        fields={[{ k: 'name', label: 'Name' }, { k: 'kind', label: 'Type' }, { k: 'stack', t: 'csv', label: 'Tech (comma separated)' }, { k: 'text', t: 'area', label: 'Description' }]} />
      <ListEditor title="Education" items={edu} setItems={setEdu} blank={{ title: '', org: '', when: '', score: '' }} nameOf={(x) => x.title || 'Education'}
        fields={[{ k: 'title', label: 'Degree / course' }, { k: 'org', label: 'Institution' }, { k: 'when', label: 'When' }, { k: 'score', label: 'Score (optional)' }]} />
      <button className="btn pri" onClick={save}>Save resume</button>
    </>
  );
}

/* ---------- profile ---------- */
function ProfileTab({ site, say }) {
  const [p, setP] = useState(site.profile), [pct, setPct] = useState(null);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const save = async (d = p) => { await setDoc(doc(fbDb(), 'site', 'profile'), d, { merge: true }); refreshSite(); say('Profile saved'); };
  function upload(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') return say('Please choose a PDF file.');
    const path = `resume/Revanraj_Kata_Resume-${Date.now()}.pdf`;
    const task = uploadBytesResumable(ref(fbStorage(), path), file); setPct(0);
    task.on('state_changed', (s) => setPct(Math.round((s.bytesTransferred / s.totalBytes) * 100)), (e) => { setPct(null); say(NO_STORAGE); },
      async () => { const url = await getDownloadURL(task.snapshot.ref); const d = { ...p, resumeUrl: url, resumePath: path }; setP(d); await save(d); setPct(null); });
  }
  return (
    <>
      <h2>Profile</h2>
      <div className="card">
        <div className="grid2">
          <F label="Display name (footer)"><input type="text" value={p.name} onChange={set('name')} /></F>
          <F label="Status badge (e.g. Open to opportunities)"><input type="text" value={p.status} onChange={set('status')} /></F>
          <F label="Email"><input type="email" value={p.email} onChange={set('email')} /></F>
          <F label="Phone (empty = hidden)"><input type="text" value={p.phone} onChange={set('phone')} /></F>
          <F label="GitHub URL"><input type="url" value={p.github} onChange={set('github')} /></F>
          <F label="LinkedIn URL (empty = hidden)"><input type="url" value={p.linkedin} onChange={set('linkedin')} /></F>
        </div>
        <button className="btn pri" onClick={() => save()}>Save profile</button>
      </div>
      <div className="card">
        <h3>Resume PDF</h3>
        <p className="hint">Currently: <a href={p.resumeUrl} target="_blank" rel="noopener">{p.resumeUrl}</a></p>
        <F label="Paste a link to your PDF (then press Save profile above)"><input type="url" value={p.resumeUrl || ''} onChange={set('resumeUrl')} /></F>
        {!useCloud && <input type="file" accept="application/pdf" onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }} />}
        {pct !== null && <div className="bar"><i style={{ width: pct + '%' }} /></div>}
      </div>
    </>
  );
}

/* ---------- blog ---------- */
const BLANK_POST = () => ({ title: '', tag: '', date: today(), content: '', coverUrl: '', coverType: '', published: false });

function PostEditor({ post, onDone, say }) {
  const [p, setP] = useState(post), [pct, setPct] = useState(null), [prev, setPrev] = useState(false), [busy, setBusy] = useState(false);
  const ta = useRef(null);
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));

  // wrap the selected text (or insert at the cursor) with markdown
  function fmt(before, after = '', ph = '') {
    const el = ta.current, c = p.content || '';
    const a = el ? el.selectionStart : c.length, b = el ? el.selectionEnd : c.length;
    const mid = c.slice(a, b) || ph;
    setP((x) => ({ ...x, content: c.slice(0, a) + before + mid + after + c.slice(b) }));
  }
  async function upload(file, as) {
    if (!file) return;
    const vid = file.type.startsWith('video/'), img = file.type.startsWith('image/');
    if (!img && !(vid && as === 'cover')) return say(as === 'cover' ? 'Choose an image or a video.' : 'Choose an image.');
    if (file.size > (vid ? 15e6 : 5e6)) return say(vid ? 'Video is over 15 MB.' : 'Image is over 5 MB.');
    if (!useCloud) return say('Uploads need Cloudinary set up (see SETUP.md). Or paste a link instead.');
    setPct(0);
    try {
      const url = await cloudUpload(file, setPct);
      if (as === 'cover') setP((x) => ({ ...x, coverUrl: url, coverType: vid ? 'video' : 'image' }));
      else fmt(`\n\n![${file.name.replace(/\.\w+$/, '')}](${url})\n\n`);
      say('Uploaded');
    } catch (e) { say('Upload failed: ' + e.message); }
    setPct(null);
  }
  async function save(published) {
    if (!p.title.trim()) return say('Add a title first.');
    setBusy(true);
    try {
      const data = { title: p.title.trim(), tag: (p.tag || '').trim(), date: p.date || today(), content: p.content || '', coverUrl: p.coverUrl || '', coverType: p.coverType || '', published, updatedAt: serverTimestamp() };
      let id = p.id;
      if (id) await setDoc(doc(fbDb(), 'posts', id), data, { merge: true });
      else { data.createdAt = serverTimestamp(); id = (await addDoc(collection(fbDb(), 'posts'), data)).id; }
      setP((x) => ({ ...x, id, published }));
      say(published ? 'Published. It is live on your site.' : 'Saved as draft (not visible on the site).');
    } catch (e) { say('Save failed: ' + e.message); }
    setBusy(false);
  }
  async function del() {
    if (!p.id || !confirm('Delete this post permanently?')) return;
    await deleteDoc(doc(fbDb(), 'posts', p.id)); say('Post deleted'); onDone();
  }
  return (
    <>
      <div className="rowh"><button className="btn sm" onClick={onDone}>← All posts</button><b>{p.id ? 'Edit post' : 'New post'}{p.published ? ' · Published' : ' · Draft'}</b></div>
      <div className="card">
        <F label="Title"><input type="text" value={p.title} onChange={set('title')} placeholder="What did you do / learn today?" /></F>
        <div className="grid2">
          <F label="Tag (e.g. Daily Work, Learning)"><input type="text" value={p.tag} onChange={set('tag')} /></F>
          <F label="Date"><input type="date" value={p.date} onChange={set('date')} style={{ width: '100%', padding: '.55rem .75rem', borderRadius: 10, border: '1px solid var(--line)', background: '#0b0b0d' }} /></F>
        </div>
        <div className="media">
          <div className="prev">{p.coverUrl ? (p.coverType === 'video' ? <video src={p.coverUrl} muted loop autoPlay playsInline /> : <img src={p.coverUrl} alt="" />) : 'No cover (optional)'}</div>
          <div>
            <F label="Cover image or video"><input type="file" accept="image/*,video/*" onChange={(e) => { upload(e.target.files[0], 'cover'); e.target.value = ''; }} /></F>
            <F label="…or paste a link"><input type="url" value={p.coverUrl} onChange={(e) => setP((x) => ({ ...x, coverUrl: e.target.value, coverType: guessType(e.target.value) }))} /></F>
            {p.coverUrl && <button className="btn sm del" onClick={() => setP((x) => ({ ...x, coverUrl: '', coverType: '' }))}>Remove cover</button>}
          </div>
        </div>
        {pct !== null && <div className="bar"><i style={{ width: pct + '%' }} /></div>}
        <div className="rowh" style={{ marginTop: '.8rem', flexWrap: 'wrap' }}>
          <b>Write (Markdown)</b>
          <button className="btn sm" onClick={() => fmt('\n## ', '', 'Heading')}>H</button>
          <button className="btn sm" onClick={() => fmt('**', '**', 'bold')}><b>B</b></button>
          <button className="btn sm" onClick={() => fmt('*', '*', 'italic')}><i>I</i></button>
          <button className="btn sm" onClick={() => fmt('[', '](https://)', 'link text')}>Link</button>
          <button className="btn sm" onClick={() => fmt('\n- ', '', 'item')}>• List</button>
          <button className="btn sm" onClick={() => fmt('\n```\n', '\n```\n', 'code')}>{'</>'}</button>
          <label className="btn sm" style={{ cursor: 'pointer' }}>+ Image<input type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files[0], 'inline'); e.target.value = ''; }} /></label>
          <button className={'btn sm' + (prev ? ' pri' : '')} onClick={() => setPrev(!prev)}>{prev ? 'Edit' : 'Preview'}</button>
        </div>
        {prev
          ? <div className="prose" style={{ minHeight: '16rem', padding: '.5rem 0' }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{p.content || '*Nothing to preview yet.*'}</ReactMarkdown></div>
          : <textarea ref={ta} rows={18} value={p.content} onChange={set('content')} placeholder="Write your post here…" style={{ minHeight: '16rem' }} />}
        <div className="actions">
          {!p.published ? (<><button className="btn" onClick={() => save(false)} disabled={busy}>Save draft</button><button className="btn pri" onClick={() => save(true)} disabled={busy}>Publish</button></>)
            : (<><button className="btn pri" onClick={() => save(true)} disabled={busy}>Update post</button><button className="btn" onClick={() => save(false)} disabled={busy}>Unpublish</button></>)}
          {p.id && <a className="btn" href={'/blog/' + p.id} target="_blank" rel="noopener">View ↗</a>}
          {p.id && <button className="btn del" onClick={del}>Delete</button>}
        </div>
      </div>
    </>
  );
}

function BlogTab({ say }) {
  const [posts, setPosts] = useState(null), [edit, setEdit] = useState(null);
  const load = () => loadPosts(true).then(setPosts).catch((e) => { setPosts([]); say('Could not load posts: ' + e.message + ' (did you publish the new Firestore rules?)'); });
  useEffect(() => { load(); }, []);
  if (edit) return <PostEditor post={edit} say={say} onDone={() => { setEdit(null); load(); }} />;
  return (
    <>
      <h2>Blog <button className="btn pri" style={{ marginLeft: '.6rem' }} onClick={() => setEdit(BLANK_POST())}>+ Write a post</button></h2>
      <p className="hint">Posts are visible on /blog only after you press Publish. Drafts stay private. Each published day lights up your Writing Activity grid.</p>
      {!posts && <p className="hint">Loading…</p>}
      {posts && !posts.length && <p className="hint">No posts yet. Write your first one.</p>}
      {posts && posts.map((p) => (
        <div className="msg" key={p.id}>
          <b>{p.title}</b> <small>· {fmtDate(p.date)}{p.tag ? ' · ' + p.tag : ''} · {p.published ? 'Published' : 'Draft'}</small>
          <div className="actions">
            <button className="btn sm pri" onClick={() => setEdit(p)}>Edit</button>
            <a className="btn sm" href={'/blog/' + p.id} target="_blank" rel="noopener">View ↗</a>
          </div>
        </div>
      ))}
    </>
  );
}

/* ---------- app shell ---------- */
export default function Admin() {
  const [user, setUser] = useState(undefined), [tab, setTab] = useState('messages');
  const [site, setSite] = useState(null), [msgs, setMsgs] = useState([]), [toast, setToast] = useState(''), [busy, setBusy] = useState(false);
  const ok = user && (user.email || '').toLowerCase() === ADMIN_EMAIL;
  const say = (m) => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(''), 4500); };

  useEffect(() => {
    if (!firebaseReady()) { setUser(null); return; }
    return onAuthStateChanged(fbAuth(), setUser);
  }, []);
  useEffect(() => {
    if (!ok) return;
    refreshSite(); loadSite().then(setSite).catch((e) => say('Could not load site data: ' + e.message));
    return onSnapshot(query(collection(fbDb(), 'messages'), orderBy('createdAt', 'desc')), (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => say('Messages: ' + e.message));
  }, [ok]);

  async function importDefaults() {
    if (!confirm('Copy the current built-in content (profile, resume, skills, 10 projects) into Firebase?')) return;
    setBusy(true);
    try {
      const db = fbDb(), b = writeBatch(db);
      b.set(doc(db, 'site', 'profile'), DEFAULTS.profile); b.set(doc(db, 'site', 'resume'), DEFAULTS.resume); b.set(doc(db, 'site', 'skills'), { groups: DEFAULTS.groups });
      DEFAULTS.projects.forEach(({ id, ...p }) => b.set(doc(db, 'projects', id), p));
      await b.commit(); refreshSite(); setSite(await loadSite()); setTab('projects'); say('Imported. You can now edit everything.');
    } catch (e) { say('Import failed: ' + e.message); }
    setBusy(false);
  }

  if (user === undefined) return <div className="adm"><p className="hint" style={{ padding: '2rem' }}>Loading…</p></div>;
  if (!firebaseReady()) return <div className="adm"><div className="login"><h2>Firebase not set up</h2><p className="hint">Copy <code>.env.local.example</code> to <code>.env.local</code>, fill in your Firebase keys, then restart <code>npm run dev</code>.</p></div></div>;
  if (!user) return <div className="adm"><Login /></div>;
  if (!ok) return <div className="adm"><div className="login"><h2>Not allowed</h2><p className="err">{user.email} is not the admin account.</p><button className="btn" onClick={() => signOut(fbAuth())}>Sign out</button></div></div>;

  const unread = msgs.filter((m) => !m.read).length;
  const tabs = [['messages', 'Messages'], ['blog', 'Blog'], ['projects', 'Projects'], ['skills', 'Skills'], ['resume', 'Resume'], ['profile', 'Profile']];
  return (
    <div className="adm">
      <div className="top">
        <h1>ADMIN</h1>
        <div className="tabs">{tabs.map(([id, l]) => <button key={id} className={'tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>{l}{id === 'messages' && unread > 0 && <span className="badge">{unread}</span>}</button>)}</div>
        <a className="btn sm" href="/" target="_blank" rel="noopener">View site ↗</a>
        <button className="btn sm" onClick={() => signOut(fbAuth())}>Sign out</button>
      </div>
      <main>
        {site && !site.seeded && (
          <div className="banner"><b>First time here?</b> Your site is still showing its built-in content. Copy it into Firebase once, then edit everything from this page.
            <div className="actions"><button className="btn pri" onClick={importDefaults} disabled={busy}>{busy ? 'Importing…' : 'Import current content'}</button></div></div>
        )}
        {tab === 'messages' && <Messages msgs={msgs} say={say} />}
        {tab === 'blog' && <BlogTab say={say} />}
        {site && site.seeded && tab === 'projects' && <Projects say={say} />}
        {site && site.seeded && tab === 'skills' && <SkillsTab site={site} say={say} />}
        {site && site.seeded && tab === 'resume' && <ResumeTab site={site} say={say} />}
        {site && site.seeded && tab === 'profile' && <ProfileTab site={site} say={say} />}
        {site && !site.seeded && tab !== 'messages' && tab !== 'blog' && <p className="hint">Import the current content first (button above).</p>}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
