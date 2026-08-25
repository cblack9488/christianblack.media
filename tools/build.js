#!/usr/bin/env node
/* christianblack.media — build step.

   The site renders itself with JavaScript, which is fine for people and
   useless for most crawlers: before this ran, a search engine saw about
   seventeen words per page. This script:

     1. writes one real page per journal entry under words/
     2. rewrites the managed <head> block on every page — title,
        description, canonical, Open Graph, Twitter card, JSON-LD
     3. loads every page in a headless browser and bakes the rendered
        DOM back into the HTML source
     4. emits sitemap.xml and robots.txt

   The runtime renderer still runs in the browser and replaces the baked
   markup with an identical tree, so nothing about the live behaviour or
   the Studio edit mode changes. Run: node tools/build.js
*/

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://christianblack.media';
const PORT = 8911;

/* ---------- content ---------- */

const win = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'content/content.js'), 'utf8'))(win);
const C = win.CB_CONTENT;
const SITE = C.site || {};
const NAME = SITE.name || 'Christian Black';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* First couple of sentences, trimmed to something a search result can show. */
function clamp(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '…').trim();
}

/* The body markup mini-language, reduced to plain prose for descriptions. */
function plainBody(body) {
  return String(body || '')
    .split(/\n\s*\n/)
    .filter(p => p.trim() && !p.trim().startsWith('[photo:') && !p.trim().startsWith('##'))
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/* ---------- the page list ---------- */

const PAGES = [
  { file: 'index.html', id: 'journal', title: C.journal.title, kicker: 'Journal',
    desc: C.journal.lede, image: (C.journal.header.images || [])[0] &&
      (C.journal.header.images || [])[0].src },
  { file: 'ticklist.html', id: 'athlete', title: C.athlete.title, kicker: 'Tick list',
    desc: C.athlete.lede, image: (C.athlete.header || {}).image },
  { file: 'photography.html', id: 'photography', title: C.photography.title, kicker: 'Photography',
    desc: C.photography.lede || 'Climbing, alpine and adventure photography by ' + NAME + '.',
    image: (C.photography.banner || {}).image },
  { file: 'media.html', id: 'media', title: C.media.title, kicker: 'Media',
    desc: C.media.lede, image: C.media.film && C.media.film.poster },
  { file: 'about.html', id: 'about', title: C.about.title, kicker: 'About',
    desc: clamp(C.about.intro, 180), image: (C.about.header || {}).image }
];

const ENTRIES = (C.journal.entries || []).filter(e => e && e.id);

const ENTRY_PAGES = ENTRIES.map(e => ({
  file: path.join('words', e.id + '.html'),
  id: 'journal',
  entry: e,
  title: e.title,
  kicker: e.meta || 'Journal',
  desc: e.comingSoon ? (e.lede || 'Coming soon.') : clamp(e.lede || plainBody(e.body), 180),
  image: e.cover || e.thumb,
  noindex: !!e.comingSoon,
  depth: 1
}));

const ALL = PAGES.concat(ENTRY_PAGES);
const urlFor = p => ORIGIN + '/' + p.file.replace(/\\/g, '/').replace(/^index\.html$/, '');

/* ---------- structured data ---------- */

const PERSON = {
  '@type': 'Person',
  '@id': ORIGIN + '/#christian-black',
  name: NAME,
  url: ORIGIN + '/',
  jobTitle: 'Climber, alpinist and paraglider pilot',
  email: SITE.email ? 'mailto:' + SITE.email : undefined,
  image: SITE.markImage ? ORIGIN + '/' + (C.about.portrait || SITE.markImage) : undefined,
  sameAs: (SITE.social || []).map(s => s.url).filter(Boolean)
};

function jsonLd(p) {
  const graph = [PERSON];
  if (p.file === 'index.html') {
    graph.push({
      '@type': 'WebSite', '@id': ORIGIN + '/#website', url: ORIGIN + '/',
      name: NAME, description: p.desc, publisher: { '@id': PERSON['@id'] }
    });
  }
  if (p.entry && !p.entry.comingSoon) {
    graph.push({
      '@type': 'Article',
      '@id': urlFor(p) + '#article',
      mainEntityOfPage: urlFor(p),
      headline: p.entry.title,
      description: p.desc,
      datePublished: p.entry.date || undefined,
      image: p.image ? ORIGIN + '/' + p.image : undefined,
      author: { '@id': PERSON['@id'] },
      publisher: { '@id': PERSON['@id'] },
      keywords: ['climbing', 'alpinism', 'paragliding', 'expedition', 'trip report'].join(', ')
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, (k, v) =>
    v === undefined ? undefined : v);
}

/* ---------- the managed <head> block ---------- */

function headBlock(p) {
  const url = urlFor(p);
  const title = p.entry ? p.title + ' — ' + NAME : NAME + ' — ' + p.title;
  const img = ORIGIN + '/' + (p.image || 'images/header.jpg');
  const lines = [
    '<!-- seo:start — generated by tools/build.js, do not hand-edit -->',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(p.desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    p.noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">',
    `<meta property="og:site_name" content="${esc(NAME)}">`,
    `<meta property="og:type" content="${p.entry ? 'article' : 'website'}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(p.desc)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(p.desc)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`
  ];
  if (p.entry && p.entry.date) {
    lines.push(`<meta property="article:published_time" content="${esc(p.entry.date)}">`);
    lines.push(`<meta property="article:author" content="${esc(NAME)}">`);
  }
  /* The crab mark as the browser-tab icon. Generated from images/cb-crab.png
     onto the site's dark ground, because the mark is drawn in near-white and
     would vanish on a light browser tab if left transparent. */
  lines.push('<link rel="icon" href="favicon.ico" sizes="any">');
  lines.push('<link rel="icon" type="image/png" sizes="32x32" href="images/favicon-32.png">');
  lines.push('<link rel="icon" type="image/png" sizes="192x192" href="images/favicon-192.png">');
  lines.push('<link rel="apple-touch-icon" href="images/favicon-180.png">');
  lines.push(`<script type="application/ld+json">${jsonLd(p)}</script>`);
  /* Cloudflare Web Analytics. Cookie-free, so no consent banner is needed.
     The token lives in content.js next to everything else that is editable;
     leave it empty and no script is emitted at all. */
  if (SITE.cloudflareToken) {
    lines.push('<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" ' +
      `data-cf-beacon='{"token": "${esc(SITE.cloudflareToken)}"}'></script>`);
  }
  lines.push('<!-- seo:end -->');
  return lines.filter(Boolean).join('\n');
}

/* Strip anything the block owns, wherever a previous build or the
   original hand-written head put it, then insert the fresh block. */
function applyHead(html, p) {
  html = html.replace(/\n?<!-- seo:start[\s\S]*?<!-- seo:end -->/g, '');
  /* Icon links are matched as whole tags rather than with [^>]*, because a
     data: URI can contain '>' and half-eating the tag leaves debris in the
     head that the browser then renders as text at the top of the page. */
  html = html.replace(/\n?[ \t]*<link\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, function (m) {
    return /rel\s*=\s*["'](icon|apple-touch-icon|shortcut icon)["']/i.test(m) ? '' : m;
  });
  /* Repair pages damaged by the earlier, broken pattern. */
  html = html.replace(/<rect width='32'[\s\S]*?<\/svg>">/g, '');
  html = html
    .replace(/\n?[ \t]*<title>[\s\S]*?<\/title>/gi, '')
    .replace(/\n?[ \t]*<meta\s+name="(description|robots|twitter:[a-z:]+)"[^>]*>/gi, '')
    .replace(/\n?[ \t]*<meta\s+property="(og:[a-z:]+|article:[a-z_]+)"[^>]*>/gi, '')
    .replace(/\n?[ \t]*<link\s+rel="canonical"[^>]*>/gi, '')

    .replace(/\n?[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '')
    .replace(/\n?[ \t]*<script[^>]*cloudflareinsights[^>]*><\/script>/gi, '');
  return html.replace('</head>', headBlock(p) + '\n</head>');
}

/* ---------- article page template ---------- */

/* Article pages live one directory down, so a <base> keeps every
   relative path in the content and the renderer working unchanged. */
function entryHtml(p) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="../">
<meta name="theme-color" content="#16150F">
<link rel="stylesheet" href="assets/css/site.css">
<link rel="stylesheet" href="assets/css/studio.css">
</head>
<body data-page="journal" data-entry="${esc(p.entry.id)}">
<main id="page" class="page"></main>
<noscript><p style="padding:4rem;max-width:44ch">This site renders its content with JavaScript. Enable it, or read the raw content in <code>content/content.js</code>.</p></noscript>
<script src="content/content.js"></script>
<script src="assets/js/zip.js"></script>
<script src="assets/js/app.js"></script>
<script src="assets/js/studio.js"></script>
</body>
</html>
`;
}

/* ---------- pass 1: clean sources ---------- */

function cleanBody(html) {
  return html
    .replace(/<main id="page"[^>]*>[\s\S]*?<\/main>/, '<main id="page" class="page"></main>')
    .replace(/\n?<!-- prerender:start[\s\S]*?<!-- prerender:end -->/g, '');
}

fs.mkdirSync(path.join(ROOT, 'words'), { recursive: true });

for (const p of ENTRY_PAGES) fs.writeFileSync(path.join(ROOT, p.file), entryHtml(p));

/* Drop article pages for entries that no longer exist. */
for (const f of fs.readdirSync(path.join(ROOT, 'words'))) {
  if (f.endsWith('.html') && !ENTRY_PAGES.some(p => path.basename(p.file) === f)) {
    fs.unlinkSync(path.join(ROOT, 'words', f));
  }
}

for (const p of ALL) {
  const abs = path.join(ROOT, p.file);
  fs.writeFileSync(abs, applyHead(cleanBody(fs.readFileSync(abs, 'utf8')), p));
}

/* ---------- pass 2: render, then bake ---------- */

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.xml': 'application/xml'
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(abs)] || 'application/octet-stream' });
  fs.createReadStream(abs).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));

  for (const p of ALL) {
    const url = 'http://localhost:' + PORT + '/' + p.file.replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rail a', { timeout: 15000 });
    await page.waitForTimeout(150);

    const baked = await page.evaluate(() => {
      /* Inline styles the scroll handlers wrote are transient state, not
         content — strip them so a rebuild produces a stable diff. */
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('.fixedbg__layer, .post, .band, [style*="--fade"]').forEach(n => {
        n.style.removeProperty('transform');
        n.style.removeProperty('opacity');
        n.style.removeProperty('--fade');
        if (!n.getAttribute('style')) n.removeAttribute('style');
      });
      const pick = sel => { const n = clone.querySelector(sel); return n ? n.outerHTML : ''; };
      /* Debris from a malformed <head> tag ends up as a bare text node at the
         top of <body>. Nothing legitimate on this site does that, so any
         stray text before the page container is a broken tag. */
      var strayHeadDebris = '';
      for (var n = document.body.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1 && (n.id === 'page' || n.tagName === 'MAIN')) break;
        if (n.nodeType === 3 && n.textContent.trim()) {
          strayHeadDebris = n.textContent.trim().slice(0, 60);
          break;
        }
      }
      return {
        stray: strayHeadDebris,
        main: (clone.querySelector('#page') || {}).innerHTML || '',
        bg: pick('.fixedbg'),
        footer: pick('.site-footer'),
        rail: pick('.rail'),
        words: (clone.querySelector('#page') || { innerText: '' }).textContent
          .trim().split(/\s+/).filter(Boolean).length
      };
    });

    /* A page that is deliberately a placeholder — the photography
       banner, a coming-soon entry — is thin on purpose. Everything else
       being thin means the renderer failed and the build should stop. */
    if (baked.stray) problems.push(p.file + ': stray text at top of body — "' + baked.stray + '"');
    const thinOnPurpose = p.noindex || p.id === 'photography';
    if (baked.words < 40 && !thinOnPurpose) {
      problems.push(p.file + ': only ' + baked.words + ' words rendered');
    }

    const abs = path.join(ROOT, p.file);
    let html = fs.readFileSync(abs, 'utf8');
    html = html.replace(/<main id="page"[^>]*>[\s\S]*?<\/main>/,
      '<main id="page" class="page">' + baked.main + '</main>\n' +
      '<!-- prerender:start — generated by tools/build.js; the renderer replaces this on load -->\n' +
      baked.footer + '\n' + baked.bg + '\n' + baked.rail + '\n' +
      '<!-- prerender:end -->');
    fs.writeFileSync(abs, html);
    process.stdout.write('  ' + p.file.padEnd(52) + baked.words + ' words\n');
  }

  await browser.close();
  server.close();

  /* ---------- pass 3: sitemap + robots ---------- */

  const today = new Date().toISOString().slice(0, 10);
  const urls = ALL.filter(p => !p.noindex).map(p => {
    const mod = p.entry && p.entry.date ? p.entry.date : today;
    const pri = p.file === 'index.html' ? '1.0' : p.entry ? '0.8' : '0.9';
    return `  <url>\n    <loc>${esc(urlFor(p))}</loc>\n    <lastmod>${mod}</lastmod>\n` +
           `    <changefreq>${p.entry ? 'yearly' : 'monthly'}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;
  });
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');

  fs.writeFileSync(path.join(ROOT, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: ' + ORIGIN + '/sitemap.xml\n');

  console.log('\n' + ALL.length + ' pages, ' + urls.length + ' in sitemap.');
  if (problems.length) {
    console.error('\nproblems:\n' + problems.map(x => '  ' + x).join('\n'));
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
