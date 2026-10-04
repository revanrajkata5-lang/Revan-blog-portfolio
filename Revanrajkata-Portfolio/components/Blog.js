'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePosts, loadPost, iso, fmtDate, excerpt, readMins } from '../lib/blog';

const arrow = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Cover({ url, type, className }) {
  if (!url) return null;
  return type === 'video'
    ? <video className={className} src={url} muted loop autoPlay playsInline preload="metadata" aria-hidden="true" />
    : <img className={className} src={url} alt="" loading="lazy" />;
}

function PostCard({ p, i }) {
  return (
    <Link href={'/blog/' + p.id} className={'bc' + (p.coverUrl ? ' has' : '')}>
      <Cover url={p.coverUrl} type={p.coverType} className="bc-cover" />
      <div className="bc-top">{p.tag ? <span className="bc-tag">{p.tag}</span> : <span />}<span className="bc-n">{String(i + 1).padStart(2, '0')}</span></div>
      <div className="bc-bot">
        <h3>{p.title}</h3>
        {!p.coverUrl && <p>{excerpt(p.content)}</p>}
        <small>{fmtDate(p.date)} · {readMins(p.content)} min read</small>
      </div>
    </Link>
  );
}

// 365-day heatmap: one square per day, darker green = more posts that day.
export function WritingActivity({ posts }) {
  const scroller = useRef(null);
  const { days, weeks, labels, streak } = useMemo(() => {
    const counts = {};
    posts.forEach((p) => { if (p.date) counts[p.date] = (counts[p.date] || 0) + 1; });
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - 364); start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push({ key: iso(d), n: counts[iso(d)] || 0, month: d.getMonth(), text: d.toDateString() });
    const weeks = Math.ceil(days.length / 7), labels = [];
    let lastM = -1, lastW = -10;
    for (let w = 0; w < weeks; w++) { const m = days[w * 7].month; if (m !== lastM && w - lastW >= 3) { labels.push({ w, t: MONTHS[m] }); lastW = w; } lastM = m; }
    let streak = 0; const c = new Date(end);
    if (!counts[iso(c)]) c.setDate(c.getDate() - 1);   // today not written yet doesn't break the streak
    while (counts[iso(c)]) { streak++; c.setDate(c.getDate() - 1); }
    return { days, weeks, labels, streak };
  }, [posts]);
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, [weeks]);

  return (
    <section className="wa" aria-label="Writing activity">
      <div className="wa-head"><h2>Writing Activity</h2><span>{posts.length} article{posts.length === 1 ? '' : 's'} published{streak > 1 ? ` · ${streak}-day streak` : ''}</span></div>
      <div className="wa-card">
        <div className="wa-scroll" ref={scroller}>
          <div className="wa-m" style={{ '--w': weeks }}>{labels.map((l) => <b key={l.w} style={{ gridColumn: l.w + 1 }}>{l.t}</b>)}</div>
          <div className="wa-c">{days.map((d) => <i key={d.key} className={'l' + Math.min(d.n, 4)} title={`${d.text}: ${d.n} post${d.n === 1 ? '' : 's'}`} />)}</div>
        </div>
        <div className="wa-foot"><span>Less <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> More</span><span>365 days</span></div>
      </div>
    </section>
  );
}

export function BlogList() {
  const { posts, loading } = usePosts();
  const [tag, setTag] = useState('All');
  const tags = ['All', ...new Set(posts.map((p) => p.tag).filter(Boolean))];
  const shown = tag === 'All' ? posts : posts.filter((p) => p.tag === tag);
  return (
    <main className="bl">
      <div className="bl-in">
        <p className="sk-eye">Blog</p>
        <h1 className="sk-h">Writing<em>.</em></h1>
        <WritingActivity posts={posts} />
        <div className="wa-head" style={{ marginTop: '2.4rem' }}><h2>Articles</h2></div>
        {tags.length > 2 && <ul className="bl-tags">{tags.map((t) => <li key={t}><button className={t === tag ? 'on' : ''} onClick={() => setTag(t)}>{t}</button></li>)}</ul>}
        {loading ? <p className="bl-empty">Loading…</p> : !shown.length ? <p className="bl-empty">No posts yet. Check back soon.</p>
          : <div className="bl-grid">{shown.map((p, i) => <PostCard key={p.id} p={p} i={i} />)}</div>}
        <p className="sk-foot">© REVANRAJ KATA</p>
      </div>
    </main>
  );
}

export function BlogPost() {
  const { id } = useParams();
  const [post, setPost] = useState(undefined);
  useEffect(() => { loadPost(id).then((p) => setPost(p)).catch(() => setPost(null)); }, [id]);
  useEffect(() => { if (post) document.title = post.title + ' — REVANRAJ KATA'; }, [post]);
  return (
    <main className="bl">
      <article className="bl-in bp">
        <Link href="/blog" className="bp-back">← All articles</Link>
        {post === undefined && <p className="bl-empty">Loading…</p>}
        {post === null && <p className="bl-empty">This post doesn’t exist or isn’t published.</p>}
        {post && (
          <>
            {post.tag && <span className="bc-tag">{post.tag}</span>}
            <h1>{post.title}</h1>
            <p className="bp-meta">{fmtDate(post.date)} · {readMins(post.content)} min read</p>
            <Cover url={post.coverUrl} type={post.coverType} className="bp-cover" />
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noopener noreferrer" />, img: (p) => <img {...p} loading="lazy" alt={p.alt || ''} /> }}>{post.content}</ReactMarkdown>
            </div>
          </>
        )}
      </article>
    </main>
  );
}

// Home page strip: hidden until at least one post is published.
export function LatestWriting() {
  const { posts } = usePosts();
  if (!posts.length) return null;
  return (
    <section className="lw" id="blog" aria-label="Latest writing">
      <div className="lw-in">
        <div className="wa-head"><h2>Latest Writing</h2><Link href="/blog" className="lw-all">View all {arrow}</Link></div>
        <div className="bl-grid">{posts.slice(0, 3).map((p, i) => <PostCard key={p.id} p={p} i={i} />)}</div>
      </div>
    </section>
  );
}
