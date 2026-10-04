import './globals.css';

export const metadata = {
  title: 'REVANRAJ KATA — Developer & Data Science Student',
  description: 'Developer and Data Science student who ships fast, clean, user-focused web applications.',
};

// Runs before first paint so the page never flashes the wrong theme.
const THEME_SCRIPT = "(function(){var d=document.documentElement,t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.dataset.theme=t;d.style.colorScheme=t;if(t==='dark'){var l=document.createElement('link');l.rel='preload';l.as='image';l.href=innerHeight>innerWidth?'/hero-mobile-dark.png':'/hero-desktop-dark.png';document.head.appendChild(l)}})();";

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preload" as="image" href="/name-desktop.png" media="(orientation: landscape)" />
        <link rel="preload" as="image" href="/name-mobile.png" media="(orientation: portrait)" />
        <link rel="preload" as="image" href="/hero-desktop.png" media="(orientation: landscape)" />
        <link rel="preload" as="image" href="/hero-mobile.png" media="(orientation: portrait)" />
      </head>
      <body>{children}</body>
    </html>
  );
}
