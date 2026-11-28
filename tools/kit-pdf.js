/* Media kit PDF — a landscape, multi-page package built from content.js.
 *
 * Each page is one section of the media kit over a photograph, in the same
 * spirit as the site's banners. Text, links and photo choices all come from
 * content/content.js (mediakit.*, including mediakit.pdf for the photographs),
 * so editing the kit there changes the PDF on the next build.
 *
 * Called from tools/build.js. Any failure is caught there: the PDF is a
 * convenience and must never stop the site from deploying.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGE_W = 1056;   // 11in at 96dpi
const PAGE_H = 816;    // 8.5in

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* The same inline marks the site understands: [label](url), **bold**, *italic*. */
function inl(text) {
  let s = esc(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => '<a href="' + url + '">' + label + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

function paras(text) {
  return String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => '<p>' + inl(p) + '</p>').join('\n');
}

const CSS = `
@page { size: 11in 8.5in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #16150f; }
body {
  font-family: "Newsreader", Georgia, "Times New Roman", serif;
  color: #D8D1BF; font-size: 13px; line-height: 1.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.pg { position: relative; width: ${PAGE_W}px; height: ${PAGE_H}px; overflow: hidden;
  page-break-after: always; break-after: page; background: #16150f; }
.pg:last-child { page-break-after: auto; break-after: auto; }
.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scrim { position: absolute; inset: 0; }
.in { position: absolute; inset: 0; padding: 56px; }
a { color: #ECE6D4; text-decoration: none; border-bottom: 1px solid rgba(236,230,212,.45); }
.lab { font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase; color: #BCB4A2; }
.disp { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; color: #F0EADB; }
.panel { background: rgba(22,21,15,.66); border: 1px solid rgba(216,209,191,.14); border-radius: 4px; padding: 30px 34px; }
.pg::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 90px; pointer-events: none;
  background: linear-gradient(0deg, rgba(16,15,12,.6), rgba(16,15,12,0)); }
.pageno, .credit { z-index: 2; }
.credit { position: absolute; right: 28px; bottom: 18px; font-size: 9.5px; letter-spacing: .12em;
  text-transform: uppercase; color: rgba(216,209,191,.7); }
.pageno { position: absolute; left: 56px; bottom: 18px; font-size: 9.5px; letter-spacing: .18em;
  text-transform: uppercase; color: rgba(216,209,191,.55); }
.pageno a { border: 0; color: inherit; }

/* cover */
.cover .scrim { background: linear-gradient(90deg, rgba(16,15,12,.82) 0%, rgba(16,15,12,.45) 45%, rgba(16,15,12,.05) 100%),
  linear-gradient(0deg, rgba(16,15,12,.7) 0%, rgba(16,15,12,0) 40%); }
.cover h1 { font-size: 92px; line-height: 1; margin: 14px 0 22px; }
.cover .lede { font-size: 20px; max-width: 420px; color: #D8D1BF; line-height: 1.4; }
.cover .offer { margin-top: 14px; max-width: 470px; font-size: 15px; line-height: 1.45; font-style: italic; color: #E2DBC8; }
.cover .reachme { margin-top: 20px; display: flex; gap: 26px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; }
.cover .sup { position: absolute; left: 56px; bottom: 52px; display: flex; align-items: center; gap: 22px; }
.cover .sup img { height: 62px; width: auto; }
.cover .sup img.wide { height: 40px; }
.cover .sup .nm { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #D8D1BF; }
.cover .stack { position: absolute; left: 56px; bottom: 140px; }

/* biography */
.bio .scrim { background: rgba(16,15,12,.35); }
.bio .panel { position: absolute; left: 56px; top: 56px; width: 616px; height: 704px; padding: 32px 38px; }
.bio .panel p { margin-bottom: 10px; font-size: 12.5px; line-height: 1.48; color: #E2DBC8; }
.bio .panel .lab { margin-bottom: 14px; }
.bio .side { position: absolute; left: 702px; top: 56px; width: 298px; }
.bio .crab { width: 298px; height: 298px; object-fit: cover; object-position: center 40%; border-radius: 4px;
  border: 1px solid rgba(216,209,191,.2); display: block; }
.bio .panel.short { position: static; width: auto; height: auto; margin-top: 18px; padding: 24px 26px; }
.bio .short p { font-size: 12.6px; line-height: 1.5; color: #E2DBC8; }
.bio .short .lab { margin-bottom: 12px; }

/* highlights */
.hl .scrim { background: #16150f; }
.hl::after { display: none; }
.hl .head { position: absolute; left: 56px; right: 56px; top: 40px; display: flex; justify-content: space-between; align-items: baseline; }
.hl .grid { position: absolute; left: 56px; right: 56px; top: 80px; bottom: 56px; display: grid;
  grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; }
.hl .tile { position: relative; overflow: hidden; border-radius: 4px; background: #23211a; }
.hl .tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.hl .tile .g { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(16,15,12,.92) 0%, rgba(16,15,12,.55) 38%, rgba(16,15,12,0) 68%); }
.hl .tile .t { position: absolute; left: 24px; right: 24px; bottom: 20px; }
.hl .tile .v { font-size: 34px; line-height: 1.05; }
.hl .tile .l { margin-top: 8px; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #D8D1BF; }
.hl .tile .n { margin-top: 5px; font-size: 12px; color: #BCB4A2; }
.hl .tile .cr { text-shadow: 0 0 6px rgba(16,15,12,1), 0 1px 10px rgba(16,15,12,.9); font-weight: 500; position: absolute; right: 12px; top: 10px; font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; color: rgba(236,230,212,.7); }

/* list pages */
.rows { margin-top: 14px; }
.row { display: grid; grid-template-columns: 190px 1fr; gap: 22px; padding: 11px 0; border-top: 1px solid rgba(216,209,191,.16); align-items: baseline; }
.row:last-child { border-bottom: 1px solid rgba(216,209,191,.16); }
.row .k { font-size: 15px; color: #F0EADB; }
.row .d { font-size: 13px; color: #CFC8B5; line-height: 1.45; }
.sec + .sec { margin-top: 26px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 14px; }
.stat { border-top: 1px solid rgba(216,209,191,.25); padding-top: 12px; }
.stat .sv { font-size: 52px; line-height: 1; }
.stat .sl { margin-top: 8px; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #D8D1BF; }
.stat .sn { margin-top: 4px; font-size: 12px; color: #BCB4A2; }

.outreach .scrim { background: linear-gradient(270deg, rgba(16,15,12,.05) 0%, rgba(16,15,12,.3) 100%); }
.outreach .panel { position: absolute; left: 56px; top: 56px; width: 500px; }
.reach .scrim { background: rgba(16,15,12,.62); }
.reach .panel { position: absolute; left: 56px; right: 56px; }
.deliver .scrim { background: linear-gradient(90deg, rgba(16,15,12,.72) 0%, rgba(16,15,12,.25) 100%); }
.deliver .col { position: absolute; left: 56px; top: 44px; width: 600px; display: flex; flex-direction: column; gap: 16px; }
.deliver .panel { padding: 24px 30px; }
.deliver .row { padding: 8px 0; }
.row.svc { grid-template-columns: 96px 150px 1fr; align-items: center; }
.row.svc .d { font-size: 12.4px; line-height: 1.42; }
.thumb { position: relative; display: block; width: 150px; height: 92px; overflow: hidden; border-radius: 3px; }
.thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.thumb span { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 8px 5px; font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase;
  color: #F0EADB; background: linear-gradient(0deg, rgba(16,15,12,.85), rgba(16,15,12,0)); }
.deliver .sec + .sec { margin-top: 18px; }
.deliver .note { margin-top: 10px; }
.next .scrim { background: linear-gradient(90deg, rgba(16,15,12,.78) 0%, rgba(16,15,12,.35) 100%); }
.next .panel { position: absolute; left: 56px; right: 56px; top: 150px; padding: 34px 38px; }
.ncols { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; margin-top: 20px; }
.nrow { display: grid; grid-template-columns: 96px 1fr; gap: 16px; padding: 14px 0; border-top: 1px solid rgba(216,209,191,.2); }
.nw { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #BCA38F; padding-top: 4px; }
.nt { font-family: "Instrument Serif", Georgia, serif; font-size: 24px; line-height: 1.22; color: #F0EADB; }
.audience .scrim { background: rgba(16,15,12,.55); }
.audience .panel { position: absolute; left: 56px; right: 56px; top: 56px; }
.stats.four { grid-template-columns: repeat(4, 1fr); margin-bottom: 30px; }
.stat .sv { font-size: 46px; }
.cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 34px; }
.lab.sm { margin-bottom: 12px; font-size: 9.5px; }
.bar { margin-bottom: 11px; }
.bl { display: flex; justify-content: space-between; font-size: 12.5px; color: #E2DBC8; margin-bottom: 4px; }
.bl b { font-weight: 400; color: #F0EADB; }
.bt { height: 5px; background: rgba(216,209,191,.16); border-radius: 3px; overflow: hidden; }
.bt i { display: block; height: 100%; background: #BCA38F; border-radius: 3px; }
.note { margin-top: 14px; font-size: 13px; color: #CFC8B5; }

/* contact */
.dd { position: absolute; overflow: visible; }
.ci { position: absolute; background: #F0EADB; z-index: 3; }
.contact .panel { z-index: 2; }
.ci img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ci.polaroid { padding: 8px 8px 30px; box-shadow: 0 5px 14px rgba(0,0,0,.5); }
.ci.circle { border-radius: 50%; padding: 7px; box-shadow: 0 5px 14px rgba(0,0,0,.5); }
.ci.circle img { border-radius: 50%; }
.ci.sticker { border-radius: 16px; padding: 7px; box-shadow: 0 5px 14px rgba(0,0,0,.5); }
.ci.sticker img { border-radius: 10px; }
.ci.star { background: #F0EADB; clip-path: polygon(50% 0%,61.2% 34.5%,97.6% 34.5%,68.2% 55.9%,79.4% 90.5%,50% 69.1%,20.6% 90.5%,31.8% 55.9%,2.4% 34.5%,38.8% 34.5%); }
.ci.crabby { background: #F0EADB; clip-path: url(#crab); }
.ci .in { position: absolute; inset: 2.6%; clip-path: inherit; }
.ci.star .in { clip-path: polygon(50% 0%,61.2% 34.5%,97.6% 34.5%,68.2% 55.9%,79.4% 90.5%,50% 69.1%,20.6% 90.5%,31.8% 55.9%,2.4% 34.5%,38.8% 34.5%); inset: 3.5%; }
.ci.crabby .in { clip-path: url(#crab); inset: 3%; }
.tape { position: absolute; top: -9px; width: 62px; height: 20px; background: rgba(217,178,95,.78); }
.contact .scrim { background: rgba(16,15,12,.10); }
.contact .panel { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); width: 800px; text-align: center; padding: 14px 26px 12px; background: rgba(16,15,12,.80); }
.contact h2 { font-size: 34px; line-height: 1.05; margin: 6px 0 0; white-space: nowrap; }
.contact .reach2 { margin-top: 8px; display: flex; justify-content: center; align-items: baseline; gap: 26px; }
.contact .rates { margin-top: 4px; }
.contact .blurb { color: #D8D1BF; font-size: 15px; }
.contact .mail { display: inline-block; margin: 0; font-size: 20px; font-family: "Instrument Serif", Georgia, serif; }
.contact .meta { margin-top: 0; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #BCB4A2; line-height: 1.9; }
.contact .meta a { margin: 0 6px; }
`;

/* The closing page's scrapbook: one dimmed photograph across the whole page,
   with the rest pasted on top as polaroids, circles, stickers, a star and a
   crab. Positions are page pixels (1056 x 816) and live in content.js
   (mediakit.pdf.collage), so a photograph can be moved or re-shaped there. */
const STAR = 'polygon(50% 0%,61.2% 34.5%,97.6% 34.5%,68.2% 55.9%,79.4% 90.5%,50% 69.1%,20.6% 90.5%,31.8% 55.9%,2.4% 34.5%,38.8% 34.5%)';

/* A crab silhouette, drawn as shapes in 0..1 box units: round body, eyes on
   stalks, two arms ending in open claws, three legs a side. */
function crabClipSvg() {
  const claw = (cx, cy, r, mouth) => {            // a circle with a wedge bitten out
    const pts = []; const a0 = mouth - 0.62, a1 = mouth + 0.62;
    pts.push([cx, cy]);
    for (let a = a1; a <= a0 + Math.PI * 2; a += 0.12) pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * 1.15]);
    return '<polygon points="' + pts.map(q => q[0].toFixed(3) + ',' + q[1].toFixed(3)).join(' ') + '"/>';
  };
  const bar = (x1, y1, x2, y2, t) => {            // a straight limb of thickness t
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * t / 2, ny = dx / L * t / 2;
    return '<polygon points="' + [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]].map(q => q[0].toFixed(3) + ',' + q[1].toFixed(3)).join(' ') + '"/>';
  };
  let g = '<ellipse cx=".5" cy=".6" rx=".31" ry=".27"/>';
  g += '<circle cx=".41" cy=".27" r=".06"/><circle cx=".59" cy=".27" r=".06"/>' + bar(.41, .27, .43, .45, .045) + bar(.59, .27, .57, .45, .045);
  g += bar(.24, .5, .12, .3, .075) + bar(.76, .5, .88, .3, .075);
  g += claw(.11, .2, .105, -2.1) + claw(.89, .2, .105, -1.04);
  [[.22, .66, .04, .66], [.2, .74, .05, .8], [.25, .82, .12, .95]].forEach(l => { g += bar(l[0], l[1], l[2], l[3], .045); g += bar(1 - l[0], l[1], 1 - l[2], l[3], .045); });
  return '<svg width="0" height="0" style="position:absolute"><defs><clipPath id="crab" clipPathUnits="objectBoundingBox">' + g + '</clipPath></defs></svg>';
}

function doodle(d) {
  const col = d.c || '#E7C27D';
  const star = '<polygon points="50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38" fill="' + (d.fill ? col : 'none') + '" stroke="' + col + '" stroke-width="6" stroke-linejoin="round"/>';
  const squig = '<path d="M5,30 Q20,5 35,30 T65,30 T95,30" fill="none" stroke="' + col + '" stroke-width="6" stroke-linecap="round"/>';
  const heart = '<path d="M50,88 C10,58 8,24 30,18 C42,15 50,24 50,30 C50,24 58,15 70,18 C92,24 90,58 50,88Z" fill="' + (d.fill ? col : 'none') + '" stroke="' + col + '" stroke-width="6" stroke-linejoin="round"/>';
  const spiral = '<path d="M50,50 m0,-4 a4,4 0 1,1 -4,4 a10,10 0 1,1 10,10 a18,18 0 1,1 -18,-18 a26,26 0 1,1 26,26" fill="none" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>';
  const body = { star, squig, heart, spiral }[d.k] || star;
  return '<svg class="dd" viewBox="0 0 100 100" style="left:' + d.x + 'px;top:' + d.y + 'px;width:' + d.s + 'px;height:' + d.s + 'px;transform:rotate(' + (d.r || 0) + 'deg)">' + body + '</svg>';
}

function collageBlock(cfg) {
  if (!cfg || !cfg.items || !cfg.items.length) return '';
  const bg = cfg.bg && cfg.bg.image
    ? '<img class="bg" src="/' + esc(cfg.bg.image) + '" style="object-position:' + esc(cfg.bg.focus || 'center') + '" alt="">' : '';
  const pos = x => 'left:' + x.x + 'px;top:' + x.y + 'px;width:' + x.w + 'px;height:' + x.h + 'px;transform:rotate(' + (x.rot || 0) + 'deg);';
  const img = x => '<img src="/' + esc(x.image) + '" style="object-position:' + esc(x.focus || 'center') + '" alt="">';
  const tape = x => x.tape ? '<i class="tape" style="' + (x.tape === 'left' ? 'left:12px;transform:rotate(-14deg)' : 'right:12px;transform:rotate(12deg)') + '"></i>' : '';
  const items = cfg.items.map(x => {
    const sh = x.shape || 'polaroid';
    if (sh === 'star') return '<div class="ci star" style="' + pos(x) + '"><div class="in">' + img(x) + '</div></div>';
    if (sh === 'crab') return '<div class="ci crabby" style="' + pos(x) + '"><div class="in">' + img(x) + '</div></div>';
    return '<div class="ci ' + sh + '" style="' + pos(x) + '">' + img(x) + tape(x) + '</div>';
  }).join('');
  return crabClipSvg() + bg + '<div class="scrim"></div>' + (cfg.doodles || []).map(doodle).join('') + items;
}

function bgBlock(cfg, scrimless) {
  if (!cfg || !cfg.image) return '';
  return '<img class="bg" src="/' + esc(cfg.image) + '" style="object-position:' + esc(cfg.focus || 'center') + '" alt="">' +
    (scrimless ? '' : '<div class="scrim"></div>');
}
function credit(cfg) {
  return cfg && cfg.credit ? '<div class="credit">' + esc(cfg.credit) + '</div>' : '';
}
function rowsHtml(list, nameKey, detailKey) {
  return '<div class="rows">' + (list || []).filter(x => x && String(x[nameKey] || '').trim()).map(x =>
    '<div class="row"><div class="k">' + inl(x[nameKey]) + '</div><div class="d">' + inl(x[detailKey] || '') + '</div></div>'
  ).join('') + '</div>';
}

function serviceRows(list) {
  return '<div class="rows">' + (list || []).filter(x => x && String(x.name || '').trim()).map(x => {
    const t = x.pdfThumb;
    const thumb = t && t.image
      ? '<a class="thumb" href="' + esc(t.url || '#') + '" style="border:0"><img src="/' + esc(t.image) + '" style="object-position:' + esc(t.focus || 'center') + '" alt="">' +
        (t.caption ? '<span>' + esc(t.caption) + '</span>' : '') + '</a>'
      : '<span></span>';
    return '<div class="row svc"><div class="k">' + inl(x.name) + '</div>' + thumb + '<div class="d">' + inl(x.detail || '') + '</div></div>';
  }).join('') + '</div>';
}

function bars(list, unit) {
  const max = Math.max.apply(null, list.map(r => r[1]));
  return list.map(r => '<div class="bar"><div class="bl"><span>' + esc(r[0]) + '</span><b>' + esc(unit === 'k' ? r[1] + 'K' : r[1] + '%') + '</b></div>' +
    '<div class="bt"><i style="width:' + Math.max(2, Math.round(r[1] / (unit === 'k' ? max : 100) * 100)) + '%"></i></div></div>').join('');
}

function buildHtml(C) {
  const SITE = C.site || {};
  const K = C.mediakit || {};
  const P = K.pdf || {};
  const domain = SITE.domain || 'christianblack.media';
  const siteUrl = 'https://' + domain + '/';
  const pages = [];
  const total = 9;
  const foot = n => '<div class="pageno">' + esc(K.title || SITE.name || 'Christian Black') + ' &nbsp;·&nbsp; Media kit &nbsp;·&nbsp; ' +
    '<a href="' + siteUrl + '">' + esc(domain) + '</a> &nbsp;·&nbsp; ' + n + ' / ' + total + '</div>';

  /* 1 — cover */
  const supLogo = (C.site.support && C.site.support.logo) ? '<img src="/' + esc(C.site.support.logo) + '" alt="">' : '';
  const extras = (K.supportExtra || []).map(x => x.logo
    ? (x.url ? '<a href="' + esc(x.url) + '" style="border:0">' : '') + '<img class="wide" src="/' + esc(x.logo) + '" alt="' + esc(x.name) + '">' + (x.url ? '</a>' : '')
    : '<span class="nm">' + (x.url ? '<a href="' + esc(x.url) + '">' + esc(x.name) + '</a>' : esc(x.name)) + '</span>').join('');
  pages.push('<section class="pg cover">' + bgBlock(P.cover) +
    '<div class="in"><div class="stack"><div class="lab">' + esc(K.kicker || 'Media kit') + '</div>' +
    '<h1 class="disp">' + esc(K.title || SITE.name || 'Christian Black') + '</h1>' +
    '<p class="lede">' + esc(K.lede || '') + '</p>' +
    (K.offer ? '<p class="offer">' + inl(K.offer) + '</p>' : '') +
    '<div class="reachme">' + (SITE.email ? '<a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>' : '') +
    '<a href="' + siteUrl + '">' + esc(domain) + '</a></div></div>' +
    '<div class="sup"><span class="lab">Supported by</span>' +
    (supLogo ? '<a href="' + esc(K.supportUrl || siteUrl) + '" style="border:0">' + supLogo + '</a>' : '') + extras + '</div></div>' +
    credit(P.cover) + '</section>');

  /* 2 — biography + crab pose + short bio */
  pages.push('<section class="pg bio">' + bgBlock(P.bio) +
    '<div class="panel"><div class="lab">Biography</div>' + paras(K.bio) + '</div>' +
    '<div class="side">' + (P.crab && P.crab.image
      ? '<img class="crab" src="/' + esc(P.crab.image) + '" style="object-position:' + esc(P.crab.focus || 'center') + '" alt="">' : '') +
    (K.shortBio ? '<div class="panel short"><div class="lab">Short bio</div><p>' + inl(K.shortBio) + '</p></div>' : '') +
    '</div>' + credit(P.bio) + foot(2) + '</section>');

  /* 3 — climbing highlights, one photograph each */
  const tiles = (K.highlights || []).slice(0, 4).map(h => {
    const ph = h.pdfImage || {};
    return '<div class="tile">' + (ph.image ? '<img src="/' + esc(ph.image) + '" style="object-position:' + esc(ph.focus || 'center') + '" alt="">' : '') +
      '<div class="g"></div>' + (ph.credit ? '<div class="cr">' + esc(ph.credit) + '</div>' : '') +
      '<div class="t"><div class="v disp">' + esc(h.value) + '</div><div class="l">' + inl(h.label) + '</div>' +
      (h.note ? '<div class="n">' + inl(h.note) + '</div>' : '') + '</div></div>';
  }).join('');
  pages.push('<section class="pg hl"><div class="scrim"></div>' +
    '<div class="head"><span class="lab">' + esc(K.highlightsLabel || 'Climbing highlights') + '</span>' +
    '<span class="lab"><a href="' + siteUrl + 'ticklist.html">Full climbing résumé ↗</a></span></div>' +
    '<div class="grid">' + tiles + '</div>' + foot(3) + '</section>');

  /* 4 — outreach and community */
  pages.push('<section class="pg outreach">' + bgBlock(P.outreach) +
    '<div class="panel"><div class="lab">Outreach and community</div>' + rowsHtml(K.outreach, 'name', 'detail') + '</div>' +
    credit(P.outreach) + foot(4) + '</section>');

  /* 5 — social reach + publications */
  const stats = (K.reach || []).map(s =>
    '<div class="stat"><div class="sv disp">' + esc(s.value) + '</div><div class="sl">' + inl(s.label) + '</div>' +
    (s.note ? '<div class="sn">' + inl(s.note) + '</div>' : '') + '</div>').join('');
  pages.push('<section class="pg reach">' + bgBlock(P.reach) +
    '<div class="panel" style="top:56px"><div class="lab">Social reach</div><div class="stats">' + stats + '</div></div>' +
    '<div class="panel" style="top:324px"><div class="lab">Publications</div>' + rowsHtml(K.publications, 'name', 'detail') + '</div>' +
    credit(P.reach) + foot(5) + '</section>');

  /* 6 — audience (Instagram insights) */
  const I = K.insights;
  if (I) {
    const hs = (I.headline || []).map(h => '<div class="stat"><div class="sv disp">' + esc(h.value) + '</div><div class="sl">' + esc(h.label) + '</div>' +
      (h.note ? '<div class="sn">' + esc(h.note) + '</div>' : '') + '</div>').join('');
    pages.push('<section class="pg audience">' + bgBlock(P.audience) +
      '<div class="panel"><div class="lab">Audience · ' + esc(I.source || 'Instagram') + ' ' + esc(I.handle || '') + ' · ' + esc(I.period || '') + '</div>' +
      '<div class="stats four">' + hs + '</div>' +
      '<div class="cols">' +
      '<div><div class="lab sm">Age</div>' + bars(I.age || []) + '</div>' +
      '<div><div class="lab sm">Top countries</div>' + bars(I.countries || []) + '</div>' +
      '<div><div class="lab sm">Gender</div>' + bars(I.gender || []) +
      '<div class="lab sm" style="margin-top:20px">Views by format</div>' + bars(I.formats || [], 'k') + '</div>' +
      '</div></div>' + credit(P.audience) + foot(6) + '</section>');
  }

  /* 7 — deliverables + partners */
  pages.push('<section class="pg deliver">' + bgBlock(P.deliver) +
    '<div class="col"><div class="panel"><div class="lab">Deliverables</div>' + rowsHtml(K.services, 'name', 'detail') +
    (K.servicesNote ? '<p class="note">' + inl(K.servicesNote) + '</p>' : '') + '</div>' +
    '<div class="panel"><div class="lab">Partners</div>' + rowsHtml(K.partners, 'name', 'detail') + '</div></div>' +
    credit(P.deliver) + foot(7) + '</section>');

  /* 8 — recent news and future projects */
  const newsList = list => (list || []).filter(x => x && String(x.text || '').trim()).map(x =>
    '<div class="nrow"><div class="nw">' + esc(x.when || '') + '</div><div class="nt">' + inl(x.text) + '</div></div>').join('');
  if ((K.news || []).length || (K.upcoming || []).length) {
    pages.push('<section class="pg next">' + bgBlock(P.next) +
      '<div class="panel"><div class="lab">' + esc(K.nextLabel || 'Recent news and future projects') + '</div>' +
      '<div class="ncols"><div><div class="lab sm">Recent news</div>' + newsList(K.news) + '</div>' +
      '<div><div class="lab sm">Upcoming projects</div>' + newsList(K.upcoming) + '</div></div></div>' +
      credit(P.next) + foot(8) + '</section>');
  }

  /* 7 — contact */
  const social = (SITE.social || []).filter(s => s && s.url).map(s =>
    '<a href="' + esc(s.url) + '">' + esc(s.handle || s.label || s.url.replace(/^https?:\/\/(www\.)?/, '')) + '</a>').join('');
  pages.push('<section class="pg contact">' + collageBlock(P.collage) + (P.collage && P.collage.items ? "" : bgBlock(P.contact)) +
    '<div class="panel"><div class="lab">Let’s work together!</div><h2 class="disp">Have fun, be safe, look cool, more crab!</h2>' +
    '<div class="reach2">' + (SITE.email ? '<a class="mail" href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a>' : '') +
    '<span class="meta"><a href="' + siteUrl + '">' + esc(domain) + '</a>' + (social ? social : '') + '</span></div>' +
    '<div class="meta rates">Rates and availability on request</div></div>' + credit(P.contact) + foot(9) + '</section>');

  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc((K.title || 'Christian Black') + ' — Media kit') + '</title>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap">' +
    '<style>' + CSS + '</style></head><body>' + pages.join('\n') + '</body></html>';
}

module.exports = async function buildKitPdf(opts) {
  const { ctx, PORT, ROOT, C } = opts;
  const html = buildHtml(C);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: PAGE_W, height: PAGE_H });
  const url = 'http://localhost:' + PORT + '/__media-kit-pdf.html';
  await page.route(url, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(url, { waitUntil: 'load' });
  /* Wait for the photographs, then give web fonts a short, bounded chance. */
  await page.evaluate(() => Promise.all(Array.from(document.images).map(i => i.complete ? 0 :
    new Promise(r => { i.onload = i.onerror = r; }))));
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 4000))]));
  fs.mkdirSync(path.join(ROOT, 'press'), { recursive: true });
  const out = path.join(ROOT, 'press/christian-black-media-kit.pdf');
  await page.pdf({ path: out, width: '11in', height: '8.5in', printBackground: true, preferCSSPageSize: true });
  await page.close();
  return out;
};
module.exports.buildHtml = buildHtml;
