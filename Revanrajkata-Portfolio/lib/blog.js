'use client';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { fbDb, firebaseReady } from './firebase';

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const fmtDate = (s) => { const [y, m, d] = (s || '').split('-'); return y ? `${d}/${m}/${y}` : ''; };
// markdown -> plain text, for card excerpts and reading time
export const plain = (md) => (md || '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~]+/g, ' ').replace(/\s+/g, ' ').trim();
export const excerpt = (md, n = 140) => { const t = plain(md); return t.length > n ? t.slice(0, n).trim() + '…' : t; };
export const readMins = (md) => Math.max(1, Math.round(plain(md).split(' ').length / 200));

const sortPosts = (a) => a.sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));

// all = true is for the admin (drafts included); the public site only ever asks for published posts.
export async function loadPosts(all = false) {
  if (!firebaseReady()) return [];
  const c = collection(fbDb(), 'posts');
  const s = await getDocs(all ? c : query(c, where('published', '==', true)));
  return sortPosts(s.docs.map((d) => ({ id: d.id, ...d.data() })));
}
export async function loadPost(id) {
  if (!firebaseReady()) return null;
  const s = await getDoc(doc(fbDb(), 'posts', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export function usePosts() {
  const [st, setSt] = useState({ posts: [], loading: true });
  useEffect(() => {
    let off = false;
    loadPosts().then((posts) => !off && setSt({ posts, loading: false })).catch(() => !off && setSt({ posts: [], loading: false }));
    return () => { off = true; };
  }, []);
  return st;
}
