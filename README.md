# christianblack.media

A five-page static portfolio site. No build step, no dependencies, no server —
double-click `index.html` to view it, drag the folder onto Netlify to publish it.

```
index.html          Athlete
photography.html    Photography
film.html           Film
journal.html        Journal
media.html          Media
content/content.js  ← every word and image path on the site lives here
images/             your photographs
assets/css          design-system tokens + site styles
assets/js           renderer, Studio edit mode, zip export
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

Any static host. Netlify: drag this folder onto app.netlify.com/drop.
GitHub Pages: push the folder and enable Pages on the branch. S3: sync it.
Point `christianblack.media` at whichever you pick.

## Notes

- Pages render their content with JavaScript, which keeps everything editable
  from one file. If search ranking becomes a priority later, the same content
  file can be pre-rendered into the HTML at deploy time.
- Fonts are Instrument Serif and Newsreader from Google Fonts, per the design
  system. They fall back to Georgia offline.
- The seeded photographs came out of the LA Sportiva pitch PDF and are
  low-resolution. Replace them with full-size originals when you can.
- Example content is marked as such — the photo set, the film cards and the
  journal entry are there to show the shape. Delete them in Studio.

## Design system

Colours, type, spacing, motion and layout rules come from the Christian Black
Design System bundle. The tokens are copied verbatim into
`assets/css/tokens.css` and `assets/css/base.css`; site styles build on them
without redefining values. If you update the design system later, replacing
those two files is the whole migration.
