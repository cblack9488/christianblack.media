/* Studio — the built-in edit mode for christianblack.media.
   Open any page with ?edit in the URL, or press Ctrl/Cmd + Shift + E.

   What it does:
     · drag photographs in from Finder onto any frame or gallery
     · drag items to reorder them
     · click anything to edit its text in the inspector
     · save straight back into the site folder (Chrome/Edge), or download a bundle

   Studio ships with the site but does nothing at all until you turn it on,
   so it is safe to deploy as-is. */

(function () {
  'use strict';

  var CB = window.CB;
  var S = (window.CB_STUDIO = { active: false });
  var el = CB.el;

  var DRAFT_KEY = 'cb-studio-draft';
  var dirty = false;
  var panel, inspectorHost, statusEl;

  /* ---------------- field specs ---------------- */

  var RATIOS = ['frame', 'portrait', 'landscape', 'cinema', 'video'];
  var SPECS = {
    site: [{ k: 'name' }, { k: 'mark', l: 'Rail monogram' }, { k: 'domain' }, { k: 'email' },
           { k: 'seoTitle', l: 'Google result \u2014 title' },
           { k: 'seoDescription', t: 'textarea', rows: 3, l: 'Google result \u2014 description' }],
    head: [{ k: 'kicker' }, { k: 'title' }, { k: 'lede', t: 'textarea' }],
    hero: [{ k: 'src', t: 'image', l: 'Photograph' }, { k: 'caption' }, { k: 'meta' }, { k: 'alt', l: 'Alt text' }],
    photo: [{ k: 'src', t: 'image', l: 'Photograph' }, { k: 'caption' }, { k: 'meta' },
            { k: 'ratio', t: 'select', l: 'Crop', options: RATIOS }, { k: 'alt', l: 'Alt text' }],
    climb: [{ k: 'name', l: 'Route' }, { k: 'grade' }, { k: 'detail', l: 'Where' }, { k: 'note' }],
    tick: [{ k: 'name', l: 'Route or trip' }, { k: 'grade', l: 'Grade / size' },
           { k: 'detail', l: 'Where' }, { k: 'note', l: 'Style (shown italic)' },
           { k: 'url', t: 'url', l: 'Read-article link' }],
    pageheader: [{ k: 'image', t: 'image', l: 'Backdrop photograph' },
                 { k: 'focus', l: 'Crop focus (e.g. center 55%)' },
                 { k: 'credit', l: 'Photo credit' }],
    aboutintro: [{ k: 'title' }, { k: 'lede', l: 'Subtitle in quotes' },
                 { k: 'portrait', t: 'image', l: 'Portrait beside the text' },
                 { k: 'intro', t: 'textarea', rows: 8, l: 'Opening paragraph' }],
    contactblk: [{ k: 'title' }, { k: 'blurb', t: 'textarea' },
                 { k: 'image', t: 'image', l: 'Photograph behind it' },
                 { k: 'credit', l: 'Photo credit' }],
    overlay: [{ k: 'heading' }, { k: 'image', t: 'image', l: 'Photograph' },
              { k: 'side', t: 'select', l: 'Text side', options: ['left', 'right'] },
              { k: 'credit', l: 'Photo credit' }, { k: 'text', t: 'textarea', rows: 12 }],
    support: [{ k: 'label', l: 'Caption' }, { k: 'logo', t: 'image', l: 'Sponsor logo' }],
    band: [{ k: 'label', l: 'Section heading' }, { k: 'blurb', l: 'Kicker under it' },
           { k: 'image', t: 'image', l: 'Backdrop photograph' },
           { k: 'focus', l: 'Crop focus (e.g. center 40%)' },
           { k: 'side', t: 'select', l: 'Text side', options: ['right', 'left'] },
           { k: 'credit', l: 'Photo credit' }],
    banner2: [{ k: 'image', t: 'image', l: 'Banner photograph' },
              { k: 'headline', l: 'Wording over it' },
              { k: 'focus', l: 'Crop focus (e.g. center 50%)' },
              { k: 'credit', l: 'Photo credit' }],
    video: [{ k: 'title' }, { k: 'meta', l: 'Caption' }, { k: 'url', t: 'url', l: 'YouTube link' }],
    stat: [{ k: 'value' }, { k: 'label' }],
    nextItem: [{ k: 'when' }, { k: 'what', t: 'textarea' }],
    section: [{ k: 'label', l: 'Section heading' }],
    set: [{ k: 'title' }, { k: 'meta' }, { k: 'blurb', t: 'textarea' }],
    featured: [{ k: 'title' }, { k: 'meta' }, { k: 'blurb', t: 'textarea' },
               { k: 'poster', t: 'image', l: 'Still' }, { k: 'url', t: 'url', l: 'YouTube or Vimeo link' }],
    film: [{ k: 'title' }, { k: 'meta' }, { k: 'blurb', t: 'textarea' },
           { k: 'poster', t: 'image', l: 'Still' }, { k: 'url', t: 'url', l: 'Link' }, { k: 'kind' }],
    entry: [{ k: 'title' }, { k: 'date', t: 'date' }, { k: 'dateLabel', l: 'Date shown (e.g. August 2025)' },
            { k: 'meta', l: 'Kicker' },
            { k: 'lede', t: 'textarea', l: 'Standfirst' },
            { k: 'cover', t: 'image', l: 'Article cover photo' },
            { k: 'thumb', t: 'image', l: 'Index card photo (optional)' },
            { k: 'pullquote', t: 'textarea' }, { k: 'body', t: 'body', rows: 18 }],
    link: [{ k: 'kind', t: 'select', options: ['Writing', 'Podcast', 'Film', 'Interview', 'Social'] },
           { k: 'publication' }, { k: 'title' }, { k: 'year' },
           { k: 'url', t: 'url', l: 'Link' }, { k: 'note', l: 'Note under the title' }]
  };

  var SPEC_FOR_BASE = {
    'photography.photos': 'photo',
    'film.videos': 'video',
    'athlete.reel': 'photo',
    'athlete.stats': 'stat',
    'athlete.next.items': 'nextItem',
    'film.films': 'film',
    'journal.entries': 'entry',
    'media.links': 'link'
  };

  /* ---------------- data plumbing ---------------- */

  function get(path) {
    return String(path).split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, CB.content);
  }
  function setPath(path, value) {
    var ks = String(path).split('.');
    var last = ks.pop();
    var o = ks.reduce(function (a, k) { return a[k]; }, CB.content);
    o[last] = value;
  }

  /* A [data-sort] / [data-dropzone] base maps to a real array in the content. */
  function collectionFor(base) {
    var m = base.match(/^athlete\.bands\.(\d+)$/);
    if (m) {
      var band = (CB.content.athlete.bands || [])[+m[1]];
      return band ? { arr: band.items, spec: 'tick' } : null;
    }
    m = base.match(/^athlete\.sections\.(.+)$/);
    if (m) {
      var sec = (CB.content.athlete.sections || []).filter(function (s) { return s.id === m[1]; })[0];
      return sec ? { arr: sec.items, spec: 'climb' } : null;
    }
    m = base.match(/^photography\.sets\.(.+)$/);
    if (m) {
      var set = (CB.content.photography.sets || []).filter(function (s) { return s.id === m[1]; })[0];
      return set ? { arr: set.photos, spec: 'photo' } : null;
    }
    var arr = get(base);
    return Array.isArray(arr) ? { arr: arr, spec: SPEC_FOR_BASE[base] || 'photo' } : null;
  }

  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }
  function uniqueId(prefix, taken) {
    var n = prefix || 'item', i = 2, id = n;
    while (taken.indexOf(id) > -1) id = n + '-' + i++;
    return id;
  }

  /* ---------------- images ---------------- */

  function addImage(file) {
    var base = slug(file.name.replace(/\.[^.]+$/, '')) || 'photo';
    var ext = (file.name.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
    var name = 'images/' + base + ext;
    var i = 2;
    while (CB.pendingImages[name]) { name = 'images/' + base + '-' + i++ + ext; }
    CB.pendingImages[name] = { url: URL.createObjectURL(file), file: file };
    return name;
  }

  function imageFiles(dt) {
    var out = [];
    var items = dt.files ? Array.prototype.slice.call(dt.files) : [];
    items.forEach(function (f) { if (/^image\//.test(f.type)) out.push(f); });
    return out;
  }

  /* ---------------- change / persist ---------------- */

  function changed() {
    dirty = true;
    saveDraft();
    status();
  }

  function rerender() {
    CB.render();
    decorate();
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(CB.content));
    } catch (e) { /* private window, quota, or storage disabled — drafts just won't persist */ }
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }

  function contentFileText() {
    return '/* christianblack.media — all site content lives here.\n' +
           '   Plain data. Edit by hand, or open any page with ?edit to use Studio.\n' +
           '   Studio rewrites this whole file when you export. */\n\n' +
           'window.CB_CONTENT = ' + JSON.stringify(CB.content, null, 2) + ';\n';
  }

  function pendingCount() { return Object.keys(CB.pendingImages).length; }

  function status(msg) {
    if (!statusEl) return;
    var bits = [];
    if (msg) bits.push(msg);
    else {
      bits.push(dirty ? 'Unsaved changes' : 'No changes yet');
      if (pendingCount()) bits.push(pendingCount() + ' new photo' + (pendingCount() === 1 ? '' : 's') + ' to write');
    }
    statusEl.textContent = bits.join(' · ');
  }

  /* ---------------- export ---------------- */

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function exportZip() {
    var files = [{ name: 'content/content.js', data: new TextEncoder().encode(contentFileText()) }];
    var names = Object.keys(CB.pendingImages);
    var next = function (i) {
      if (i >= names.length) {
        download(window.CB_ZIP.makeZip(files), 'christianblack-content.zip');
        status('Bundle downloaded — unzip it over your site folder');
        return;
      }
      names[i] && CB.pendingImages[names[i]].file.arrayBuffer().then(function (buf) {
        files.push({ name: names[i], data: new Uint8Array(buf) });
        next(i + 1);
      });
    };
    next(0);
  }

  var dirHandle = null;

  function saveToFolder() {
    if (!window.showDirectoryPicker) {
      status('This browser cannot write to a folder — use Download bundle');
      return;
    }
    var run = function () {
      return dirHandle.getDirectoryHandle('content', { create: true })
        .then(function (c) { return c.getFileHandle('content.js', { create: true }); })
        .then(function (fh) { return fh.createWritable(); })
        .then(function (w) { return w.write(contentFileText()).then(function () { return w.close(); }); })
        .then(function () {
          var names = Object.keys(CB.pendingImages);
          if (!names.length) return null;
          return dirHandle.getDirectoryHandle('images', { create: true }).then(function (imgDir) {
            return names.reduce(function (chain, n) {
              return chain.then(function () {
                return imgDir.getFileHandle(n.replace(/^images\//, ''), { create: true })
                  .then(function (fh) { return fh.createWritable(); })
                  .then(function (w) { return w.write(CB.pendingImages[n].file).then(function () { return w.close(); }); });
              });
            }, Promise.resolve());
          });
        })
        .then(function () {
          dirty = false;
          clearDraft();
          status('Saved to your site folder');
        })
        .catch(function (e) { status('Save failed — ' + e.message); });
    };

    if (dirHandle) return run();
    window.showDirectoryPicker({ mode: 'readwrite' }).then(function (h) {
      dirHandle = h;
      return run();
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      status('Could not open folder — ' + e.message);
    });
  }

  /* ---------------- inspector ---------------- */

  /* ---------------- the body editor ---------------- */

  /* Each button either prefixes the block the cursor sits in, or wraps the
     selected words. Nothing here needs to be memorised — the marks are the
     same ones you can type by hand if you prefer. */
  var MARKS = [
    { label: 'H1', title: 'Section heading',     block: '## ' },
    { label: 'H2', title: 'Sub-heading',         block: '### ' },
    { label: '\u201C', title: 'Pull quote',       block: '> ' },
    { label: 'Note', title: 'Quiet aside',       wrap: ['[note: ', ']'], whole: true },
    { label: 'B', title: 'Bold',                 wrap: ['**', '**'] },
    { label: 'I', title: 'Italic',               wrap: ['*', '*'] },
    { label: 'Link', title: 'Link',              wrap: ['[', '](https://)'] },
    { label: 'Photo', title: 'Photograph',       insert: '[photo: images/your-photo.jpg | caption]' }
  ];

  function applyMark(ta, mark) {
    var v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;

    if (mark.insert) {
      /* a photograph is its own block, so give it blank lines either side */
      var before = v.slice(0, a).replace(/\s*$/, '');
      var after = v.slice(b).replace(/^\s*/, '');
      ta.value = before + '\n\n' + mark.insert + '\n\n' + after;
      ta.selectionStart = ta.selectionEnd = before.length + 2 + mark.insert.length;
      return;
    }

    if (mark.block) {
      /* find the block the cursor is in: bounded by blank lines */
      var start = v.lastIndexOf('\n\n', Math.max(0, a - 1));
      start = start < 0 ? 0 : start + 2;
      var end = v.indexOf('\n\n', b);
      if (end < 0) end = v.length;
      var chunk = v.slice(start, end);
      var stripped = chunk.replace(/^\s*(?:#{2,3}\s|>\s)/, '');
      /* clicking the same mark again takes it off */
      var next = chunk === mark.block + stripped ? stripped : mark.block + stripped;
      ta.value = v.slice(0, start) + next + v.slice(end);
      ta.selectionStart = ta.selectionEnd = start + next.length;
      return;
    }

    /* With nothing selected, take the word under the cursor — the same thing
       a word processor does when you hit bold mid-word. */
    if (a === b && !mark.whole) {
      var ws = a, we = a;
      while (ws > 0 && /\S/.test(v.charAt(ws - 1))) ws--;
      while (we < v.length && /\S/.test(v.charAt(we))) we++;
      if (we > ws) { a = ws; b = we; }
    }
    var sel = v.slice(a, b) || (mark.whole ? '' : 'text');
    if (mark.whole && !sel) {
      var s2 = v.lastIndexOf('\n\n', Math.max(0, a - 1));
      s2 = s2 < 0 ? 0 : s2 + 2;
      var e2 = v.indexOf('\n\n', b);
      if (e2 < 0) e2 = v.length;
      sel = v.slice(s2, e2);
      a = s2; b = e2;
    }
    /* Keep whitespace outside the markers: "**bold** " not "**bold **". */
    var lead = (sel.match(/^\s*/) || [''])[0];
    var tail = (sel.match(/\s*$/) || [''])[0];
    var core = sel.slice(lead.length, sel.length - tail.length) || sel;
    if (!core.trim()) { lead = ''; tail = ''; core = sel; }

    var out = lead + mark.wrap[0] + core + mark.wrap[1] + tail;
    ta.value = v.slice(0, a) + out + v.slice(b);
    ta.selectionStart = a + lead.length + mark.wrap[0].length;
    ta.selectionEnd = ta.selectionStart + core.length;
  }

  function bodyField(obj, f, onChange) {
    var wrap = el('label', { class: 'st-field st-bodyfield' });
    wrap.appendChild(el('span', { text: f.l || 'Body' }));

    var bar = el('div', { class: 'st-toolbar' });
    var ta = el('textarea', { rows: f.rows || 18, class: 'st-body' });
    ta.value = obj[f.k] || '';

    var preview = el('div', { class: 'st-preview article' });
    var previewWrap = el('div', { class: 'st-previewwrap' });
    previewWrap.appendChild(el('span', { class: 'st-previewlabel', text: 'Preview' }));
    previewWrap.appendChild(preview);

    var timer = null;
    function paint() {
      preview.innerHTML = '';
      try { CB.renderBody(preview, ta.value, ''); }
      catch (err) { preview.textContent = 'Preview unavailable: ' + err.message; }
    }
    function touched() {
      obj[f.k] = ta.value;
      changed();
      clearTimeout(timer);
      timer = setTimeout(paint, 180);
    }

    MARKS.forEach(function (mk) {
      var b = el('button', { type: 'button', class: 'st-mark', text: mk.label, title: mk.title });
      b.addEventListener('click', function (e) {
        e.preventDefault();
        ta.focus();
        applyMark(ta, mk);
        touched();
      });
      bar.appendChild(b);
    });

    ta.addEventListener('input', touched);
    ta.addEventListener('change', function () { obj[f.k] = ta.value; onChange(); });

    wrap.appendChild(bar);
    wrap.appendChild(ta);
    wrap.appendChild(previewWrap);
    paint();
    return wrap;
  }

  function field(obj, f, onChange) {
    if (f.t === 'body') return bodyField(obj, f, onChange);
    var wrap = el('label', { class: 'st-field' });
    wrap.appendChild(el('span', { text: f.l || (f.k.charAt(0).toUpperCase() + f.k.slice(1)) }));
    var input;

    if (f.t === 'textarea') {
      input = el('textarea', { rows: f.rows || 4 });
      input.value = obj[f.k] || '';
    } else if (f.t === 'select') {
      input = el('select');
      var opts = f.options.slice();
      if (obj[f.k] && opts.indexOf(obj[f.k]) < 0) opts.unshift(obj[f.k]);
      opts.forEach(function (o) {
        var op = el('option', { value: o, text: o });
        if (o === obj[f.k]) op.selected = true;
        input.appendChild(op);
      });
    } else if (f.t === 'image') {
      input = el('input', { type: 'text', placeholder: 'images/…' });
      input.value = obj[f.k] || '';
      var pick = el('button', { type: 'button', class: 'st-mini', text: 'Choose photo…' });
      pick.addEventListener('click', function () {
        var fi = el('input', { type: 'file', accept: 'image/*' });
        fi.addEventListener('change', function () {
          if (!fi.files[0]) return;
          obj[f.k] = addImage(fi.files[0]);
          input.value = obj[f.k];
          onChange();
        });
        fi.click();
      });
      wrap.appendChild(input);
      wrap.appendChild(pick);
      input.addEventListener('change', function () { obj[f.k] = input.value; onChange(); });
      return wrap;
    } else {
      input = el('input', { type: f.t === 'date' ? 'date' : (f.t === 'url' ? 'url' : 'text') });
      input.value = obj[f.k] || '';
    }

    input.addEventListener('input', function () { obj[f.k] = input.value; changed(); });
    input.addEventListener('change', function () { obj[f.k] = input.value; onChange(); });
    wrap.appendChild(input);
    return wrap;
  }

  function inspect(obj, specName, title, opts) {
    opts = opts || {};
    inspectorHost.innerHTML = '';
    var box = el('div', { class: 'st-inspector' });
    var head = el('div', { class: 'st-inspector-head' });
    head.appendChild(el('span', { text: title }));
    var close = el('button', { type: 'button', class: 'st-mini', text: 'Done' });
    close.addEventListener('click', function () { inspectorHost.innerHTML = ''; rerender(); });
    head.appendChild(close);
    box.appendChild(head);

    var onChange = function () { changed(); rerender(); reopen(); };
    var reopen = function () { inspect(obj, specName, title, opts); };

    (SPECS[specName] || []).forEach(function (f) { box.appendChild(field(obj, f, onChange)); });

    if (opts.onDelete) {
      var del = el('button', { type: 'button', class: 'st-danger', text: 'Delete this' });
      del.addEventListener('click', function () {
        opts.onDelete();
        inspectorHost.innerHTML = '';
        changed();
        rerender();
      });
      box.appendChild(del);
    }
    inspectorHost.appendChild(box);
  }

  /* ---------------- decoration: drag, drop, click ---------------- */

  function markDrop(node, apply) {
    node.classList.add('st-drop');
    node.addEventListener('dragover', function (e) {
      if (!S.active) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      node.classList.add('st-over');
    });
    node.addEventListener('dragleave', function () { node.classList.remove('st-over'); });
    node.addEventListener('drop', function (e) {
      if (!S.active) return;
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove('st-over');
      var files = imageFiles(e.dataTransfer);
      if (!files.length) return;
      apply(files);
      changed();
      rerender();
    });
  }

  /* ---------------- editing one block in place ---------------- */

  /* Every block the renderer draws carries data-block with its index into
     the body text. Clicking one swaps it for a textarea holding just that
     block's source, so a typo is a click and a keystroke rather than a hunt
     through eighteen rows of textarea. */
  function editBlockInPlace(node, entry, index) {
    if (document.querySelector('.st-blockedit')) return;

    var blocks = String(entry.body || '').split(/\n\s*\n/);
    if (index < 0 || index >= blocks.length) return;

    var box = el('div', { class: 'st-blockedit' });
    var bar = el('div', { class: 'st-blockbar' });
    var save = el('button', { type: 'button', class: 'st-mini', text: 'Save' });
    var cancel = el('button', { type: 'button', class: 'st-mini', text: 'Cancel' });

    node.parentNode.insertBefore(box, node);
    node.style.display = 'none';

    function close() {
      box.remove();
      node.style.display = '';
    }
    function commit(text) {
      blocks[index] = text.trim();
      entry.body = blocks.filter(function (b) { return b.trim(); }).join('\n\n');
      close();
      changed();
      rerender();
    }
    cancel.addEventListener('click', close);

    var photo = blocks[index].trim().match(/^\[photo:([\s\S]*)\]$/);

    if (photo) {
      /* A photograph gets named fields rather than raw markup — a caption is
         the thing you actually came to change. */
      box.classList.add('st-blockedit--photo');
      var parts = photo[1].split('|').map(function (x) { return x.trim(); });
      var src = parts[0], capV = parts[1] || '', altV = parts[2] || '';

      var thumb = el('img', { class: 'st-photothumb', src: CB.resolveSrc(src), alt: '' });
      var fields = el('div', { class: 'st-photofields' });

      function textField(label, value, hint) {
        var l = el('label', { class: 'st-photofield' });
        l.appendChild(el('span', { text: label }));
        var i = el('input', { type: 'text' });
        i.value = value;
        l.appendChild(i);
        if (hint) l.appendChild(el('em', { text: hint }));
        fields.appendChild(l);
        return i;
      }
      var capI = textField('Caption', capV, 'Shown under the photograph');
      var altI = textField('Alt text', altV, 'Describes the photo for screen readers and image search');

      var replace = el('button', { type: 'button', class: 'st-mini', text: 'Replace photo\u2026' });
      replace.addEventListener('click', function () {
        var fi = el('input', { type: 'file', accept: 'image/*' });
        fi.addEventListener('change', function () {
          if (!fi.files[0]) return;
          src = addImage(fi.files[0]);
          thumb.src = CB.resolveSrc(src);
        });
        fi.click();
      });
      fields.appendChild(replace);

      var row = el('div', { class: 'st-photorow' });
      row.appendChild(thumb);
      row.appendChild(fields);
      box.appendChild(row);

      save.addEventListener('click', function () {
        var out = [src, capI.value.trim(), altI.value.trim()];
        while (out.length > 1 && !out[out.length - 1]) out.pop();
        commit('[photo: ' + out.join(' | ') + ']');
      });
      bar.appendChild(el('span', { class: 'st-blockhint', text: 'Leave alt text empty to reuse the caption.' }));
      bar.appendChild(cancel);
      bar.appendChild(save);
      box.appendChild(bar);
      capI.focus();
      return;
    }

    /* Text blocks get the same toolbar as the panel's body editor. */
    var tools = el('div', { class: 'st-toolbar' });
    var ta = el('textarea', { rows: Math.max(3, Math.ceil(blocks[index].length / 60)) });
    ta.value = blocks[index];

    MARKS.filter(function (m) { return m.label !== 'Photo'; }).forEach(function (mk) {
      var btn = el('button', { type: 'button', class: 'st-mark', text: mk.label, title: mk.title });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        ta.focus();
        applyMark(ta, mk);
      });
      tools.appendChild(btn);
    });

    box.appendChild(tools);
    box.appendChild(ta);
    bar.appendChild(el('span', { class: 'st-blockhint', text: '\u2318\u21A9 to save, Esc to cancel' }));
    bar.appendChild(cancel);
    bar.appendChild(save);
    box.appendChild(bar);
    ta.focus();

    save.addEventListener('click', function () { commit(ta.value); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save.click(); }
    });
  }

  function decorate() {
    if (!S.active) return;
    document.body.classList.add('st-on');

    /* click any paragraph, heading, quote or note in an article to fix it */
    var entry = CB.currentEntry;
    if (entry) {
      Array.prototype.forEach.call(document.querySelectorAll('.article [data-block]'), function (node) {
        if (node.__stBlock) return;
        node.__stBlock = true;
        node.classList.add('st-block');
        node.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;      /* let links stay links */
          e.preventDefault();
          e.stopPropagation();
          editBlockInPlace(node, entry, parseInt(node.getAttribute('data-block'), 10));
        });
      });
    }

    /* single-image drop targets: hero, posters, covers, reel frames */
    Array.prototype.forEach.call(document.querySelectorAll('[data-drop]'), function (node) {
      if (node.__stDone) return;
      node.__stDone = true;
      var path = node.getAttribute('data-drop');
      markDrop(node, function (files) {
        var name = addImage(files[0]);
        var target = get(path);
        if (target && typeof target === 'object') target.src = name;
        else setPath(path, name);
      });
    });

    /* gallery drop zones: append many */
    Array.prototype.forEach.call(document.querySelectorAll('[data-dropzone]'), function (node) {
      if (node.__stDropDone) return;
      node.__stDropDone = true;
      var c = collectionFor(node.getAttribute('data-dropzone'));
      if (!c) return;
      markDrop(node, function (files) {
        files.forEach(function (f) {
          c.arr.push({ src: addImage(f), caption: '', meta: '', ratio: 'frame' });
        });
      });
    });

    /* sortable collections + click to inspect */
    Array.prototype.forEach.call(document.querySelectorAll('[data-sort]'), function (node) {
      var base = node.getAttribute('data-sort');
      var c = collectionFor(base);
      if (!c) return;
      node.classList.add('st-sortable');

      Array.prototype.forEach.call(node.children, function (child) {
        var i = parseInt(child.getAttribute('data-i'), 10);
        if (isNaN(i)) return;
        if (child.__stItem) return;
        child.__stItem = true;
        child.classList.add('st-item');
        child.setAttribute('draggable', 'true');

        var tools = el('div', { class: 'st-tools' });
        tools.appendChild(el('span', { class: 'st-handle', text: '⠿', title: 'Drag to reorder' }));
        var editB = el('button', { type: 'button', class: 'st-mini', text: 'Edit' });
        editB.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          var idx = parseInt(child.getAttribute('data-i'), 10);
          inspect(c.arr[idx], c.spec, 'Item ' + (idx + 1), {
            onDelete: function () { c.arr.splice(idx, 1); }
          });
        });
        tools.appendChild(editB);
        child.appendChild(tools);

        child.addEventListener('dragstart', function (e) {
          if (!S.active) return;
          e.dataTransfer.setData('text/cb-sort', base + ':' + child.getAttribute('data-i'));
          e.dataTransfer.effectAllowed = 'move';
          child.classList.add('st-dragging');
        });
        child.addEventListener('dragend', function () { child.classList.remove('st-dragging'); });
        child.addEventListener('dragover', function (e) {
          if (!S.active) return;
          var types = Array.prototype.slice.call(e.dataTransfer.types || []);
          if (types.indexOf('text/cb-sort') < 0) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          child.classList.add('st-target');
        });
        child.addEventListener('dragleave', function () { child.classList.remove('st-target'); });
        child.addEventListener('drop', function (e) {
          if (!S.active) return;
          var raw = e.dataTransfer.getData('text/cb-sort');
          child.classList.remove('st-target');
          if (!raw) return;
          e.preventDefault();
          e.stopPropagation();
          var parts = raw.split(':');
          if (parts[0] !== base) return;
          var from = parseInt(parts[1], 10);
          var to = parseInt(child.getAttribute('data-i'), 10);
          if (isNaN(from) || isNaN(to) || from === to) return;
          var moved = c.arr.splice(from, 1)[0];
          c.arr.splice(to, 0, moved);
          changed();
          rerender();
        });
      });
    });

    status();
  }
  S.decorate = decorate;

  /* ---------------- per-page panel actions ---------------- */

  function addBtn(host, text, fn) {
    var b = el('button', { type: 'button', class: 'st-action', text: text });
    b.addEventListener('click', fn);
    host.appendChild(b);
    return b;
  }

  function pageActions(host) {
    var page = CB.page;
    var c = CB.content;

    addBtn(host, 'Page header', function () {
      inspect(c[page], 'head', 'Page header');
    });

    if (page === 'athlete') {
      c.athlete.bands.forEach(function (b, i) {
        addBtn(host, 'Section: ' + (b.label || 'Untitled'), function () {
          inspect(b, 'band', 'Photo section', {
            onDelete: function () { c.athlete.bands.splice(i, 1); }
          });
        }).classList.add('st-sub');
        addBtn(host, '\u2192 Add a tick to "' + (b.label || '') + '"', function () {
          b.items.push({ name: 'New route', grade: '', detail: '', note: '', url: '' });
          changed(); rerender();
        });
      });
      addBtn(host, 'New photo section', function () {
        c.athlete.bands.push({
          id: uniqueId('band', c.athlete.bands.map(function (x) { return x.id; })),
          label: 'New section', blurb: '', image: '', focus: 'center', side: 'right', credit: '',
          items: [{ name: 'New route', grade: '', detail: '', note: '', url: '' }]
        });
        changed(); rerender();
      });
      addBtn(host, 'Header backdrop', function () { inspect(c.athlete.header, 'pageheader', 'Header photo'); }).classList.add('st-sub');
      }

    if (page === 'photography') {
      addBtn(host, 'Banner photo + wording', function () {
        inspect(c.photography.banner, 'banner2', 'Coming-soon banner');
      }).classList.add('st-sub');
      addBtn(host, 'Add photographs\u2026', function () {
        pickImages(function (name) {
          c.photography.photos.push({ src: name, caption: '', meta: '' });
        }, true);
      });
    }

    if (page === 'journal') {
      addBtn(host, 'New entry', function () {
        var ids = c.journal.entries.map(function (e) { return e.id; });
        var today = new Date().toISOString().slice(0, 10);
        c.journal.entries.unshift({
          id: uniqueId('entry-' + today, ids), title: 'Untitled', date: today, meta: 'Notes',
          lede: '', cover: '', pullquote: '', body: ''
        });
        changed();
        location.search = '';
      });
      var params = new URLSearchParams(location.search);
      var open = params.get('entry');
      if (open) {
        var e = c.journal.entries.filter(function (x) { return x.id === open; })[0];
        if (e) addBtn(host, 'Edit this entry', function () {
          inspect(e, 'entry', 'Journal entry', {
            onDelete: function () {
              c.journal.entries.splice(c.journal.entries.indexOf(e), 1);
              location.href = CB.hrefFor('journal') + '?edit';
            }
          });
        });
      }
    }

    if (page === 'media') {
      addBtn(host, 'Featured film', function () { inspect(c.media.film, 'featured', 'Featured film'); });
      addBtn(host, 'New link', function () {
        var ids = c.media.links.map(function (l) { return l.id; });
        c.media.links.unshift({ id: uniqueId('link', ids), kind: 'Article', publication: '', title: '', year: '', url: '' });
        changed(); rerender();
      });
    }

    if (page === 'about') {
      addBtn(host, 'Backdrop photo', function () { inspect(c.about.header, 'pageheader', 'Backdrop'); });
      addBtn(host, 'Opening paragraph', function () { inspect(c.about, 'aboutintro', 'Opening'); });
      addBtn(host, 'Photo break', function () { inspect(c.about['break'], 'pageheader', 'Photo break'); }).classList.add('st-sub');
      addBtn(host, 'Outreach section', function () { inspect(c.about.outreach, 'overlay', 'Outreach'); });
      addBtn(host, 'Get in touch', function () { inspect(c.about.contact, 'contactblk', 'Contact'); }).classList.add('st-sub');
    }

    addBtn(host, 'Site details', function () { inspect(c.site, 'site', 'Site details'); }).classList.add('st-sub');
    addBtn(host, 'Supported by', function () { inspect(c.site.support, 'support', 'Support'); }).classList.add('st-sub');
  }

  function pickImages(apply, multiple) {
    var fi = el('input', { type: 'file', accept: 'image/*' });
    if (multiple) fi.setAttribute('multiple', 'multiple');
    fi.addEventListener('change', function () {
      Array.prototype.forEach.call(fi.files, function (f) { apply(addImage(f)); });
      changed();
      rerender();
    });
    fi.click();
  }

  /* ---------------- panel ---------------- */

  function buildPanel() {
    panel = el('aside', { class: 'st-panel', 'aria-label': 'Studio' });

    var head = el('div', { class: 'st-head' });
    head.appendChild(el('span', { class: 'st-title', text: 'Studio' }));
    var exit = el('button', { type: 'button', class: 'st-mini', text: 'Exit' });
    exit.addEventListener('click', function () { toggle(false); });
    head.appendChild(exit);
    panel.appendChild(head);

    statusEl = el('div', { class: 'st-status' });
    panel.appendChild(statusEl);

    panel.appendChild(el('p', { class: 'st-hint', text: 'Drag photographs from Finder onto any frame. Drag items by ⠿ to reorder. Click Edit to change text.' }));

    var actions = el('div', { class: 'st-actions' });
    pageActions(actions);
    panel.appendChild(actions);

    var saves = el('div', { class: 'st-saves' });
    var saveB = el('button', { type: 'button', class: 'st-primary', text: 'Save to site folder' });
    saveB.addEventListener('click', saveToFolder);
    saves.appendChild(saveB);
    if (!window.showDirectoryPicker) saveB.title = 'Needs Chrome or Edge — use Download bundle instead';

    var zipB = el('button', { type: 'button', class: 'st-action', text: 'Download bundle (.zip)' });
    zipB.addEventListener('click', exportZip);
    saves.appendChild(zipB);

    var copyB = el('button', { type: 'button', class: 'st-action', text: 'Copy content.js' });
    copyB.addEventListener('click', function () {
      navigator.clipboard.writeText(contentFileText())
        .then(function () { status('content.js copied to the clipboard'); })
        .catch(function () { status('Could not copy — use Download bundle'); });
    });
    saves.appendChild(copyB);

    var discardB = el('button', { type: 'button', class: 'st-danger', text: 'Discard draft' });
    discardB.addEventListener('click', function () {
      if (!window.confirm('Throw away every unsaved change since the last save?')) return;
      clearDraft();
      location.reload();
    });
    saves.appendChild(discardB);
    panel.appendChild(saves);

    inspectorHost = el('div', { class: 'st-inspector-host' });
    panel.appendChild(inspectorHost);

    document.body.appendChild(panel);
  }

  /* ---------------- toggle ---------------- */

  function toggle(on) {
    S.active = on;
    if (on) {
      var draft = loadDraft();
      if (draft && !S.restored) {
        S.restored = true;
        if (window.confirm('An unsaved Studio draft was found. Restore it?')) {
          CB.content = window.CB_CONTENT = draft;
          dirty = true;
        } else {
          clearDraft();
        }
      }
      CB.render();
      if (!panel) buildPanel();
      panel.hidden = false;
      decorate();
    } else {
      document.body.classList.remove('st-on');
      if (panel) panel.hidden = true;
      CB.render();
    }
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      toggle(!S.active);
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (S.active && dirty && pendingCount()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (/(^|[?&])edit(=|&|$)/.test(location.search)) toggle(true);
  });
})();
