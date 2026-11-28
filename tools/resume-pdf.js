/* Climbing résumé PDF — a portrait, text-first document built from content.js.
 *
 * Everything on it comes from the site's own content, so adding a climb to the
 * tick list (athlete.bands) or a trip report to the journal adds it here on the
 * next build. Called from tools/build.js; a failure there never stops a deploy.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inl(text) {
  let s = esc(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => '<a href="' + url + '">' + label + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

const CSS = `
@page { size: 8.5in 11in; margin: 0.6in 0.7in 0.7in; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: #fff; }
body { font-family: "Newsreader", Georgia, "Times New Roman", serif; color: #26221B; font-size: 12.5px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: inherit; text-decoration: none; border-bottom: 1px solid rgba(38,34,27,.35); }
h1 { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; font-size: 46px; line-height: 1; }
.kick { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: #7A6552; margin-bottom: 8px; }
.contact { margin-top: 10px; font-size: 12px; color: #4A4238; }
.contact span + span::before { content: "·"; margin: 0 9px; color: #A8967F; }
.sum { margin-top: 16px; padding-top: 14px; border-top: 1.5px solid #26221B; max-width: 640px; font-size: 13.5px; line-height: 1.5; }
.sec { margin-top: 18px; }
.sec > .lab { break-after: avoid; }
.lab { font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: #7A6552; padding-bottom: 6px; border-bottom: 1px solid #CFC4B0; margin-bottom: 2px; }
.sec .blurb { font-size: 11.5px; font-style: italic; color: #6A5E4F; margin: 6px 0 2px; }
.r { display: grid; grid-template-columns: 46px 1fr auto; gap: 14px; padding: 5px 0; border-bottom: 1px solid #E2D9C7; break-inside: avoid; }
.r .y { color: #7A6552; font-variant-numeric: tabular-nums; }
.r .n { font-size: 13.5px; }
.r .s { font-size: 11.5px; color: #6A5E4F; }
.r .g { font-size: 12.5px; text-align: right; white-space: nowrap; color: #26221B; }
.o { display: grid; grid-template-columns: 250px 1fr; gap: 14px; padding: 5px 0; border-bottom: 1px solid #E2D9C7; break-inside: avoid; }
.o .n { font-size: 13.5px; } .o .d { font-size: 12px; color: #4A4238; }
`;

function buildHtml(C) {
  const SITE = C.site || {};
  const K = C.mediakit || {};
  const domain = SITE.domain || 'christianblack.media';
  const siteUrl = 'https://' + domain + '/';
  const abs = u => !u ? '' : (/^(https?:|mailto:)/.test(u) ? u : siteUrl + String(u).replace(/^\//, ''));

  const row = it => {
    const name = it.url ? '<a href="' + esc(abs(it.url)) + '">' + esc(it.name) + '</a>' : esc(it.name);
    const sub = [it.detail, it.note].filter(Boolean).join(' · ');
    return '<div class="r"><div class="y">' + esc(it.year || '') + '</div><div class="n">' + name +
      (sub ? '<div class="s">' + esc(sub) + '</div>' : '') + '</div><div class="g">' + esc(it.grade || '') + '</div></div>';
  };
  const byYear = (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0);

  const bandSection = b => {
    const items = (b.items || []).filter(i => i && String(i.name || '').trim()).slice().sort(byYear);
    if (!items.length) return '';
    return '<div class="sec"><div class="lab">' + esc(b.blurb || b.label || '') + '</div>' +
      items.map(row).join('') + '</div>';
  };

  const ticks = [].concat.apply([], (C.athlete.bands || []).map(b => b.items || []));
  const tickYear = t => { const m = ticks.find(i => i && i.name === t); return m && m.year ? String(m.year) : ''; };

  /* Trip reports from the journal, newest first. Entries without a date
     are placed by the year in their title when there is one. */
  const reports = ((C.journal || {}).entries || [])
    .filter(e => e && e.meta === 'Trip report')
    .map(e => ({
      year: e.date ? e.date.slice(0, 4) : ((e.title || '').match(/(20\d\d)/) || [])[1] || tickYear(e.title),
      name: e.title, url: 'words/' + e.id + '.html'
    })).sort(byYear);

  const plain = list => (list || []).filter(x => x && String(x.name || '').trim());
  const od = list => plain(list).map(x => '<div class="o"><div class="n">' + inl(x.name) + '</div><div class="d">' + inl(x.detail || '') + '</div></div>').join('');

  const social = (SITE.social || []).filter(s => s && s.url).map(s =>
    '<span><a href="' + esc(s.url) + '">' + esc(s.handle || s.url) + '</a></span>').join('');

  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Christian Black — Climbing résumé</title>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap">' +
    '<style>' + CSS + '</style></head><body>' +
    '<div class="kick">Climbing résumé</div><h1>' + esc(K.title || SITE.name || 'Christian Black') + '</h1>' +
    '<div class="contact">' + (SITE.email ? '<span><a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + '</a></span>' : '') +
    '<span><a href="' + siteUrl + '">' + esc(domain) + '</a></span>' + social + '</div>' +
    (K.shortBio ? '<p class="sum">' + inl(K.shortBio) + '</p>' : '') +
    (C.athlete.bands || []).map(bandSection).join('') +
    (reports.length ? '<div class="sec"><div class="lab">Trip reports</div>' + reports.map(row).join('') + '</div>' : '') +
    (plain(K.outreach).length ? '<div class="sec"><div class="lab">Rescue, teaching and outreach</div>' + od(K.outreach) + '</div>' : '') +
    (plain(K.publications).length ? '<div class="sec"><div class="lab">Publications</div>' + od(K.publications) + '</div>' : '') +
    '</body></html>';
}

module.exports = async function buildResumePdf(opts) {
  const { ctx, PORT, ROOT, C } = opts;
  const html = buildHtml(C);
  const page = await ctx.newPage();
  const url = 'http://localhost:' + PORT + '/__climbing-resume-pdf.html';
  await page.route(url, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 4000))]));
  fs.mkdirSync(path.join(ROOT, 'press'), { recursive: true });
  const out = path.join(ROOT, 'press/christian-black-climbing-resume.pdf');
  const domain = (C.site || {}).domain || 'christianblack.media';
  await page.pdf({
    path: out, format: 'Letter', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:8px Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#8A7A66;padding:0 0.7in;display:flex;justify-content:space-between"><span>Christian Black · Climbing résumé · ' + domain + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'
  });
  await page.close();
  return out;
};
module.exports.buildHtml = buildHtml;
