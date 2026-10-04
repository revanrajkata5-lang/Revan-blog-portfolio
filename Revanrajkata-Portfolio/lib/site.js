'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { fbDb, firebaseReady } from './firebase';

/* Built-in content. It is shown until Firebase answers, and forever if Firebase is not set up yet.
   The admin page's "Import current content" button copies all of this into Firestore. */
export const DEFAULTS = {
  profile: {
    name: 'REVANRAJ KATA',
    status: 'Open to opportunities',
    email: 'revanrajkata2628@gmail.com',
    github: 'https://github.com/revanrajkata5-lang',
    linkedin: '',
    phone: '',
    resumeUrl: '/Revanraj_Kata_Resume.pdf',
  },
  resume: {
    summary: 'Computer Science and Engineering (Data Science) student with hands-on experience building and deploying full-stack and frontend applications. Strong interest in software engineering, problem solving, and building practical real-world solutions.',
    stats: [
      { value: '6', label: 'Projects built' },
      { value: '95.2%', label: 'Intermediate · 2024' },
      { value: '92%', label: 'SSC · 2022' },
      { value: '2028', label: 'Expected graduation' },
    ],
    experience: [{
      role: 'Technical Team Manager & Developer Intern',
      org: 'Aplus Tech Services and IT Solutions · Hyderabad',
      when: 'Aug 2026 · 3-month internship',
      sub: 'Web Development, Technical Team',
      points: [
        'Worked on website and software development tasks as part of the company’s technical team.',
        'Contributed to frontend and full-stack development, implementation, debugging, and deployment of web applications.',
        'Supported technical project execution and coordinated development tasks within the team.',
      ],
    }],
    projects: [
      { name: 'VeriGig', kind: 'Full-Stack Gig Platform', stack: ['Next.js', 'FastAPI', 'Supabase'], text: 'Developing a platform connecting clients and freelancers for project-based work, including authentication, project workflows, applications, communication, and database-driven functionality.' },
      { name: 'December Delights', kind: 'Restaurant & E-Commerce Platform', stack: ['Next.js', 'FastAPI'], text: 'Built an advanced coffee shop and restaurant platform with e-commerce support and modern customer-facing functionality.' },
      { name: 'Mutton', kind: 'Community-Based Delivery Platform', stack: ['Next.js', 'FastAPI'], text: 'Developed a quick-commerce-style delivery application designed specifically for selected communities.' },
      { name: 'Medical Shop Management System', kind: 'Inventory, expiry & billing', stack: ['HTML', 'CSS', 'JavaScript'], text: 'Built a practical system for a family medical shop to manage inventory/restocking, medicine expiry tracking, and billing.' },
      { name: 'Aplus Tech Services', kind: 'Company Website', stack: ['HTML', 'CSS', 'JavaScript'], text: 'Developed the company website presenting business information, services, and company details.' },
      { name: 'Personal Portfolio', kind: 'Developer Portfolio', stack: ['Next.js', 'FastAPI'], text: 'Built a personal developer portfolio to showcase projects, technical skills, and professional work.' },
    ],
    education: [
      { title: 'Bachelor of Technology (B.Tech) in Computer Science and Engineering (Data Science)', org: 'Sri Indu College of Engineering and Technology', when: '3rd Year · Expected graduation 2028', score: '' },
      { title: 'Intermediate', org: 'Narayana Junior College, Hayathnagar', when: '2024', score: '95.2%' },
      { title: 'SSC', org: 'Maharshi Vidyalaya, Mahabubabad', when: '2022', score: '92%' },
    ],
  },
  groups: [
    { k: 'Programming', items: ['Python', 'JavaScript', 'SQL', 'C', { t: 'Java', tag: 'Basic' }] },
    { k: 'Frontend Development', items: ['React.js', 'Next.js', 'HTML', 'CSS', 'Responsive Web Design'] },
    { k: 'Backend Development', items: ['FastAPI'] },
    { k: 'Database', items: ['Supabase', 'MySQL'] },
    { k: 'Data Structures and Algorithms', wide: true, items: ['Arrays', 'Strings', 'Hashing', 'Linked Lists', 'Stacks', 'Queues', 'Trees', 'Graphs'] },
    { k: 'Developer Tools', full: true, items: ['Git', 'GitHub', 'Postman', 'Visual Studio Code'] },
  ],
  // repo = repo name under your GitHub, or a full URL. visit = show "Live site". linkOnly = hide "Source code".
  projects: [
    { name: 'December Delights', text: 'Fine coffee & cuisine website for December Delights.', tags: ['Website', 'Cafe'], repo: 'december-delights', live: 'https://www.decemberdelights.in/', visit: true, linkOnly: true },
    { name: 'A+ Tech Services', text: 'Marketing & IT solutions website for A+ Tech Services.', tags: ['Website', 'IT Services'], repo: 'aplustech-live', live: 'https://aplustech.onrender.com/', visit: true, linkOnly: true },
    { name: 'Manapalle Products', text: 'Login portal for Manapalle Products.', tags: ['Web App', 'Login'], repo: 'manapalle-products', live: 'https://mutton-gilt.vercel.app/login', visit: true, linkOnly: true },
    { name: 'Jewellery Shop', text: 'Elegant storefront website for a jewellery shop.', tags: ['HTML', 'CSS'], repo: 'jewelleryshop', live: 'https://jewelleryshop-wheat.vercel.app' },
    { name: 'Medical Shop', text: 'Web app for a medical shop.', tags: ['JavaScript', 'Web App'], repo: 'medicalshop', live: 'https://medicalshop-virid.vercel.app', visit: true },
    { name: 'Bulk Sender Pro', text: 'Bulk message sending tool built with Python.', tags: ['Python', 'Automation'], repo: 'bulksenderpro', live: 'https://bulksenderpro.vercel.app' },
    { name: 'Rise', text: 'Responsive, fast-loading website.', tags: ['HTML', 'CSS'], repo: 'rise', live: 'https://rise-eta-ashy.vercel.app' },
    { name: 'Krishna Dry Cleaning', text: 'Service website for a dry-cleaning business.', tags: ['JavaScript', 'Web App'], repo: 'KRISHNADRY-CLEANING' },
    { name: 'Billing', text: 'Simple billing application.', tags: ['HTML', 'CSS'], repo: 'billing' },
    { name: 'WhatsApp Sender', text: 'Tool for sending WhatsApp messages.', tags: ['Automation'], repo: 'whatsappsender' },
  ].map((p, i) => ({ id: p.repo, mediaUrl: '', mediaType: '', order: i + 1, ...p })),
};

// Reads everything the public site needs. Anything missing falls back to DEFAULTS.
export async function loadSite() {
  if (!firebaseReady()) return DEFAULTS;
  const db = fbDb();
  const [p, r, s, pr] = await Promise.all([
    getDoc(doc(db, 'site', 'profile')),
    getDoc(doc(db, 'site', 'resume')),
    getDoc(doc(db, 'site', 'skills')),
    getDocs(query(collection(db, 'projects'), orderBy('order'))),
  ]);
  const seeded = p.exists();        // once imported, Firestore is the source of truth (even with 0 projects)
  const groups = s.exists() && Array.isArray(s.data().groups) ? s.data().groups : DEFAULTS.groups;
  return {
    seeded,
    profile: { ...DEFAULTS.profile, ...(p.data() || {}) },
    resume: { ...DEFAULTS.resume, ...(r.data() || {}) },
    groups,
    projects: seeded ? pr.docs.map((d) => ({ id: d.id, ...d.data() })) : DEFAULTS.projects,
  };
}

let cache = null;
export const refreshSite = () => { cache = null; };

// One shared fetch per page load; components render DEFAULTS first, then swap in live data.
export function useSite() {
  const [data, setData] = useState(DEFAULTS);
  useEffect(() => {
    let off = false;
    (cache || (cache = loadSite())).then((d) => !off && setData(d)).catch(() => { cache = null; });
    return () => { off = true; };
  }, []);
  return data;
}
