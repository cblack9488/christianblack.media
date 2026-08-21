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
    site: [{ k: 'name' }, { k: 'mark', l: 'Rail monogram' }, { k: 'domain' }, { k: 'email' }, { k: 'year', l: 'Rail year' }],
    head: [{ k: 'kicker' }, { k: 'title' }, { k: 'lede', t: 'textarea' }],
    hero: [{ k: 'src', t: 'image', l: 'Photograph' }, { k: 'caption' }, { k: 'meta' }, { k: 'alt', l: 'Alt text' }],
    photo: [{ k: 'src', t: 'image', l: 'Photograph' }, { k: 'caption' }, { k: 'meta' },
            { k: 'ratio', t: 'select', l: 'Crop', options: RATIOS }, { k: 'alt', l: 'Alt text' }],
    climb: [{ k: 'name', l: 'Route' }, { k: 'grade' }, { k: 'detail', l: 'Where' }, { k: 'note' }],
    stat: [{ k: 'value' }, { k: 'label' }],
    nextItem: [{ k: 'when' }, { k: 'what', t: 'textarea' }],
    section: [{ k: 'label', l: 'Section heading' }],
    set: [{ k: 'title' }, { k: 'meta' }, { k: 'blurb', t: 'textarea' }],
    featured: [{ k: 'title' }, { k: 'meta' }, { k: 'blurb', t: 'textarea' },
               { k: 'poster', t: 'image', l: 'Still' }, { k: 'url', t: 'url', l: 'YouTube or Vimeo link' }],
    film: [{ k: 'title' }, { k: 'meta' }, { k: 'blurb', t: 'textarea' },
           { k: 'poster', t: 'image', l: 'Still' }, { k: 'url', t: 'url', l: 'Link' }, { k: 'kind' }],
    entry: [{ k: 'title' }, { k: 'date', t: 'date' }, { k: 'meta', l: 'Kicker' },
            { k: 'lede', t: 'textarea', l: 'Standfirst' }, { k: 'cover', t: 'image' },
            { k: 'pullquote', t: 'textarea' }, { k: 'body', t: 'textarea', rows: 16 }],
    link: [{ k: 'kind', t: 'select', options: ['Article', 'Writing', 'Podcast', 'Interview', 'Film', 'Social'] },
           { k: 'publication' }, { k: 'title' }, { k: 'year' }, { k: 'url', t: 'url' }]
  };

  var SPEC_FOR_BASE = {
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
    var m = base.match(/^athlete\.sections\.(.+)$/);
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

  function field(obj, f, onChange) {
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

  function decorate() {
    if (!S.active) return;
    document.body.classList.add('st-on');

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
      addBtn(host, 'Hero photograph', function () { inspect(c.athlete.hero, 'hero', 'Hero'); });
      addBtn(host, 'Add a stat', function () {
        c.athlete.stats.push({ value: 'New', label: 'Label' }); changed(); rerender();
      });
      addBtn(host, 'Add a reel photo', function () { pickImages(function (name) {
        c.athlete.reel.push({ src: name, caption: '', meta: '', ratio: 'frame' });
      }); });
      addBtn(host, 'Add a highlight section', function () {
        var ids = c.athlete.sections.map(function (s) { return s.id; });
        c.athlete.sections.push({ id: uniqueId('section', ids), label: 'New section', items: [{ name: 'New route', grade: '', detail: '', note: '' }] });
        changed(); rerender();
      });
      c.athlete.sections.forEach(function (sec) {
        addBtn(host, 'Section: ' + sec.label, function () {
          inspect(sec, 'section', 'Section', {
            onDelete: function () { c.athlete.sections.splice(c.athlete.sections.indexOf(sec), 1); }
          });
        }).classList.add('st-sub');
      });
      addBtn(host, 'Add a highlight row', function () {
        var sec = c.athlete.sections[0];
        if (sec) { sec.items.push({ name: 'New route', grade: '', detail: '', note: '' }); changed(); rerender(); }
      });
      addBtn(host, "Add a what's-next line", function () {
        c.athlete.next.items.push({ when: 'Season', what: 'Objective' }); changed(); rerender();
      });
    }

    if (page === 'photography') {
      addBtn(host, 'New photo set', function () {
        var ids = c.photography.sets.map(function (s) { return s.id; });
        c.photography.sets.push({ id: uniqueId('set', ids), title: 'New set', meta: '', blurb: '', photos: [] });
        changed(); rerender();
      });
      c.photography.sets.forEach(function (set) {
        addBtn(host, 'Set: ' + (set.title || 'Untitled'), function () {
          inspect(set, 'set', 'Photo set', {
            onDelete: function () { c.photography.sets.splice(c.photography.sets.indexOf(set), 1); }
          });
        }).classList.add('st-sub');
      });
      addBtn(host, 'Add photos to the open set…', function () {
        pickImages(function (name) {
          var open = c.photography.sets[0];
          var grid = document.querySelector('[data-dropzone]');
          if (grid) {
            var col = collectionFor(grid.getAttribute('data-dropzone'));
            if (col) return col.arr.push({ src: name, caption: '', meta: '', ratio: 'frame' });
          }
          if (open) open.photos.push({ src: name, caption: '', meta: '', ratio: 'frame' });
        }, true);
      });
    }

    if (page === 'film') {
      addBtn(host, 'Featured film', function () { inspect(c.film.featured, 'featured', 'Featured film'); });
      addBtn(host, 'New film', function () {
        var ids = c.film.films.map(function (f) { return f.id; });
        c.film.films.push({ id: uniqueId('film', ids), title: 'New film', meta: '', blurb: '', poster: '', url: '', kind: 'Film' });
        changed(); rerender();
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
              location.href = 'journal.html?edit';
            }
          });
        });
      }
    }

    if (page === 'media') {
      addBtn(host, 'New link', function () {
        var ids = c.media.links.map(function (l) { return l.id; });
        c.media.links.unshift({ id: uniqueId('link', ids), kind: 'Article', publication: '', title: '', year: '', url: '' });
        changed(); rerender();
      });
    }

    addBtn(host, 'Site details', function () { inspect(c.site, 'site', 'Site details'); }).classList.add('st-sub');
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
