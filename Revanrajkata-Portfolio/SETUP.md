# Revanrajkata-Portfolio: setup & admin guide

## Run it
    npm install
    npm run dev          # http://localhost:3000
Admin page: http://localhost:3000/admin   (not linked anywhere on the site)

## Already configured for you
- `.env.local` holds your Firebase keys, admin email, and Cloudinary cloud name + upload preset.
  After editing it, stop the server (Ctrl+C), delete the `.next` folder, and run `npm run dev` again.

## One-time Firebase console steps
1. Authentication -> Sign-in method -> Email/Password -> enable. Users tab -> Add user:
   revanrajkata2628@gmail.com + a strong password.
2. Firestore Database -> Create database (production mode). Rules tab -> paste `firestore.rules` -> Publish.
3. First login at /admin: press "Import current content" once.
4. Deploying: add the variables from `.env.local` to your host (e.g. Vercel -> Environment Variables), and add
   your live domain in Authentication -> Settings -> Authorized domains.

## Cloudinary (free image/video uploads)
- Cloud name: prr6csqi. Preset `portfolio` must exist with Signing mode = Unsigned
  (Cloudinary -> Settings -> Upload -> Upload presets).
- Logos max 3 MB; videos max 10 seconds and 15 MB.
- Resume PDF: paste a link in Admin -> Profile, or replace `public/Revanraj_Kata_Resume.pdf`.

## Firebase Storage (optional, needs the Blaze plan)
Not needed while Cloudinary is configured. If you remove the Cloudinary values and upgrade to Blaze,
uploads go to Firebase Storage instead; paste `storage.rules` into Storage -> Rules.

## Blog
Admin -> Blog -> "+ Write a post". Markdown editor with a toolbar, cover image/video, inline images, Draft / Publish.
Public pages: /blog and /blog/<id>; the latest 3 posts also appear on the home page. Writing requires the admin login.
IMPORTANT: after updating, re-publish `firestore.rules` (it now has a `posts` section).

## Admin tabs
Messages, Blog, Projects (add/remove/reorder, logo or 10s clip, name, description, tags, links), Skills, Resume page, Profile (contact details, status, resume link).

## Files added/changed
app/admin/*, lib/firebase.js, lib/site.js, components/{Projects,Skills,HomeSkills,Contact,Hero,Navbar}.js,
firestore.rules, storage.rules, .env.local(.example)
