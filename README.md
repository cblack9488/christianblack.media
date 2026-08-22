# christianblack.media

A five-page static portfolio site. Plain HTML, CSS and JavaScript — open
`index.html` in a browser and it works, with no server and no install.

```
index.html          Journal — "Words", the landing page
ticklist.html       Tick list
photography.html    Photography
media.html          Media
about.html          About
words/<slug>.html   one page per journal entry — generated, do not hand-edit
content/content.js  ← every word and image path on the site lives here
images/             your photographs
assets/css          design-system tokens + site styles
assets/js           renderer, Studio edit mode, zip export
tools/build.js      the pre-render + SEO build step
sitemap.xml         generated
robots.txt          generated
```

## Editing with Studio

Open any page and add `?edit` to the URL — `index.html?edit` — or press
**Ctrl/Cmd + Shift + E** on any page. A Studio panel opens on the left.

- **Add photographs** — drag image files from Finder straight onto any frame or
  onto a gallery. Dropping several files on a gallery adds them all.
- **Reorder** — hover an item, grab the `⠿` handle, drag it where you want it.
  Works on gallery photos, highlight rows, films, journal entries and media links.
- **Edit text** — hover an item and click **Edit**, or use the buttons in the
  panel for page headers, sets, the featured film and site details.
- **Add and delete** — the panel's buttons create new sets, entries, films and
  links; the inspector has a Delete for whatever you have open.

Studio is inert until you turn it on, so it is safe to deploy exactly as-is.
Visitors never see it.

## Saving your changes

Three ways out of Studio, in order of convenience:

1. **Save to site folder** — Chrome and Edge only. Pick this folder once and
   Studio writes `content/content.js` and any new photographs straight to disk.
2. **Download bundle (.zip)** — works everywhere. Unzip it over this folder,
   replacing `content/content.js` and adding new files to `images/`.
3. **Copy content.js** — puts the file on your clipboard to paste yourself.

Studio autosaves a draft to your browser as you type, so a refresh won't lose
your text. **Photographs are the exception**: a dropped photo lives in memory
until you save, so finish with a save before closing the tab. The panel tells
you how many are still unwritten.

## Editing by hand

`content/content.js` is plain data with one line of wrapper. Open it in any
editor and change it directly — the shapes are the same ones Studio writes.
Journal bodies use blank lines between paragraphs. Image paths are relative to
the site root (`images/whatever.jpg`).

## Publishing

Push to `main`. GitHub Pages serves the repo root at christianblack.media.

Every push runs the **Pre-render** workflow, which regenerates the article
pages, the baked-in HTML, the sitemap and the page metadata, then commits the
result back to `main`. That means **after each push, run `git pull` before you
make your next change** — otherwise your next push is rejected as out of date.

## The build step

The pages draw themselves with JavaScript, which is what keeps everything
editable from one file — and what most search crawlers cannot see. Before this
existed, a crawler read about seventeen words per page.

`tools/build.js` fixes that without changing how the site works:

1. writes a real page per journal entry under `words/`, so each piece has its
   own URL instead of `index.html?entry=…`
2. rewrites a managed block in each `<head>` — title, description, canonical
   link, Open Graph and Twitter cards, and JSON-LD structured data marking you
   as the author of each article
3. loads every page in a headless browser and bakes the rendered HTML back
   into the source file
4. writes `sitemap.xml` and `robots.txt`

The browser still renders the page the same way on load and replaces the baked
markup with an identical tree, so Studio and every interaction behave exactly
as before. The block is marked `<!-- seo:start -->` / `<!-- prerender:start -->`
in the HTML — anything inside those markers is overwritten on the next build.

The workflow runs it for you. To run it yourself:

```
npm install
npx playwright install chromium
npm run build
```

## Notes

- After the site has been live a few days, add christianblack.media in Google
  Search Console and submit `sitemap.xml`. That is the step that actually gets
  the articles crawled quickly rather than whenever Google gets round to it.
- Alt text falls back to the caption, credit or title of a photograph. For the
  photos that matter most to you, add an explicit `alt` in `content/content.js`
  describing what is actually in the frame — that is what image search reads.
- Fonts are Instrument Serif and Newsreader from Google Fonts, per the design
  system. They fall back to Georgia offline.
- Studio is inert until you turn it on, so it is safe to deploy as-is.

## Design system

Colours, type, spacing, motion and layout rules come from the Christian Black
Design System bundle. The tokens are copied verbatim into
`assets/css/tokens.css` and `assets/css/base.css`; site styles build on them
without redefining values. If you update the design system later, replacing
those two files is the whole migration.
