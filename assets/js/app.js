/* christianblack.media — renderer.
   Reads window.CB_CONTENT (content/content.js) and draws whichever page
   the document declares in <body data-page>. No framework, no build step. */

(function () {
  'use strict';

  var CB = (window.CB = window.CB || {});

  CB.PAGES = [
    { id: 'athlete', label: 'Athlete', href: 'index.html' },
    { id: 'photography', label: 'Photography', href: 'photography.html' },
    { id: 'film', label: 'Film', href: 'film.html' },
    { id: 'journal', label: 'Journal', href: 'journal.html' },
    { id: 'media', label: 'Media', href: 'media.html' }
  ];

  CB.content = window.CB_CONTENT || {};
  CB.page = document.body.getAttribute('data-page');

  /* ---------- tiny helpers ---------- */

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'class') n.className = v;
        else n.setAttribute(k, v);
      });
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  CB.el = el;

  function frag(kids) {
    var f = document.createDocumentFragment();
    (kids || []).forEach(function (c) { if (c) f.appendChild(c); });
    return f;
  }

  /* Images dropped in Studio live in memory until export; resolve those first. */
  CB.pendingImages = CB.pendingImages || {};
  CB.resolveSrc = function (src) {
    if (!src) return '';
    var p = CB.pendingImages[src];
    return p ? p.url : src;
  };

  CB.fmtDate = function (iso) {
    if (!iso) return '';
    var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    if (isNaN(d)) return iso;
    var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
             'August', 'September', 'October', 'November', 'December'];
    return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  };

  /* ---------- shared pieces ---------- */

  function rail() {
    var site = CB.content.site || {};
    var nav = el('nav', { class: 'rail', 'aria-label': 'Pages' });
    nav.appendChild(el('a', { class: 'mark', href: 'index.html', text: site.mark || 'CB' }));
    var ul = el('ul');
    CB.PAGES.forEach(function (p) {
      var a = el('a', { href: p.href, text: p.label });
      if (p.id === CB.page) a.setAttribute('aria-current', 'page');
      a.appendChild(el('span', { class: 'tick' }));
      ul.appendChild(el('li', null, [a]));
    });
    nav.appendChild(ul);
    nav.appendChild(el('span', { class: 'year', text: site.year || '' }));
    return nav;
  }

  function footer() {
    var site = CB.content.site || {};
    var f = el('footer', { class: 'site-footer' });
    f.appendChild(el('span', { text: site.domain || '' }));
    var right = el('span');
    if (site.email) {
      right.appendChild(el('span', { text: 'Available for commissions — ' }));
      right.appendChild(el('a', { href: 'mailto:' + site.email, text: site.email }));
    } else {
      right.appendChild(el('span', { text: site.footerNote || '' }));
    }
    f.appendChild(right);
    return f;
  }

  function label(index, text) {
    var l = el('div', { class: 'label' });
    if (index) l.appendChild(el('span', { class: 'idx', text: index }));
    l.appendChild(el('span', { text: text || '' }));
    return l;
  }
  CB.labelEl = label;

  function pageHead(data, index, aside) {
    var h = el('header', { class: 'page-head' });
    var left = el('div');
    left.appendChild(label(index, data.kicker));
    left.appendChild(el('h1', { text: data.title || '', 'data-edit': 'title' }));
    if (data.lede) left.appendChild(el('p', { class: 'lede', text: data.lede, 'data-edit': 'lede' }));
    h.appendChild(left);
    h.appendChild(el('div', { class: 'aside' }, aside ? [aside] : []));
    return h;
  }

  function frameEl(item, opts) {
    opts = opts || {};
    var fig = el('figure', { class: 'frame' + (opts.onClick ? ' clickable' : ''), 'data-ratio': item.ratio || 'frame' });
    var box = el('div', { class: 'box' });
    var src = CB.resolveSrc(item.src || item.poster || item.cover || item.image);
    if (src) {
      box.appendChild(el('img', { src: src, alt: item.alt || item.caption || '', loading: opts.eager ? 'eager' : 'lazy' }));
    } else {
      box.appendChild(el('div', { class: 'empty', text: opts.placeholder || 'Photograph' }));
    }
    if (opts.onClick) box.addEventListener('click', opts.onClick);
    fig.appendChild(box);
    if (item.caption || item.meta) {
      var cap = el('figcaption');
      cap.appendChild(el('span', { class: 'cap', text: item.caption || '' }));
      cap.appendChild(el('span', { class: 'meta', text: item.meta || '' }));
      fig.appendChild(cap);
    }
    return fig;
  }
  CB.frameEl = frameEl;

  function section(labelText, index, nodes) {
    var s = el('section', { class: 'section' });
    if (labelText) s.appendChild(label(index, labelText));
    (nodes || []).forEach(function (n) { if (n) s.appendChild(n); });
    return s;
  }

  /* ---------- Athlete ---------- */

  function renderAthlete(root) {
    var d = CB.content.athlete || {};
    var aside = null;
    if (d.support && (d.support.partners || []).length) {
      aside = el('div');
      aside.appendChild(el('div', { class: 'meta', text: d.support.label || 'Supported by' }));
      var ul = el('ul', { class: 'partners' });
      d.support.partners.forEach(function (p) { ul.appendChild(el('li', { text: p })); });
      aside.appendChild(ul);
    }
    root.appendChild(pageHead(d, '01', aside));

    if (d.hero) {
      var hero = frameEl(d.hero, { eager: true, placeholder: 'Hero photograph' });
      hero.className = 'frame hero';
      hero.setAttribute('data-ratio', 'cinema');
      hero.setAttribute('data-drop', 'athlete.hero');
      root.appendChild(hero);
    }

    if ((d.stats || []).length) {
      var stats = el('div', { class: 'stats' });
      d.stats.forEach(function (s) {
        stats.appendChild(el('div', { class: 'stat' }, [
          el('span', { class: 'v', text: s.value }),
          el('span', { class: 'l', text: s.label })
        ]));
      });
      root.appendChild(stats);
    }

    if ((d.reel || []).length) {
      var reel = el('div', { class: 'reel', 'data-sort': 'athlete.reel' });
      d.reel.forEach(function (p, i) {
        var f = frameEl(p);
        f.setAttribute('data-i', i);
        f.setAttribute('data-drop', 'athlete.reel.' + i);
        reel.appendChild(f);
      });
      root.appendChild(section('A season in frames', null, [reel]));
    }

    (d.sections || []).forEach(function (sec, si) {
      var ul = el('ul', { class: 'entries', 'data-sort': 'athlete.sections.' + sec.id });
      (sec.items || []).forEach(function (it, i) {
        var right = el('span');
        right.appendChild(el('span', { class: 'detail', text: it.detail || '' }));
        if (it.note) right.appendChild(el('span', { class: 'note', text: it.note }));
        ul.appendChild(el('li', { 'data-i': i }, [
          el('span', { class: 'name', text: it.name }),
          el('span', { class: 'grade', text: it.grade || '' }),
          right
        ]));
      });
      var photo = null;
      if (sec.image) {
        photo = frameEl({ src: sec.image, caption: sec.caption, meta: sec.imageMeta, ratio: sec.ratio || 'cinema' });
        photo.classList.add('section-photo');
        photo.setAttribute('data-drop', 'athlete.sections.' + si + '.image');
      }
      root.appendChild(section(sec.label, null, [ul, photo]));
    });

    if (d.next && (d.next.items || []).length) {
      var wrap = el('div', { class: 'next' });
      var dl = el('dl');
      d.next.items.forEach(function (n) {
        dl.appendChild(el('dt', { text: n.when }));
        dl.appendChild(el('dd', { text: n.what }));
      });
      wrap.appendChild(dl);
      if (d.next.image !== undefined) {
        var f = frameEl({ src: d.next.image, ratio: 'frame' }, { placeholder: 'Photograph' });
        f.setAttribute('data-drop', 'athlete.next.image');
        wrap.appendChild(f);
      }
      root.appendChild(section(d.next.label || "What's next", null, [wrap]));
    }
  }

  /* ---------- Photography ---------- */

  function renderPhotography(root) {
    var d = CB.content.photography || {};
    root.appendChild(pageHead(d, '02'));

    var sets = d.sets || [];
    var state = { i: 0 };
    var switcher = el('div', { class: 'set-switch', role: 'tablist' });
    var body = el('div');

    function draw() {
      switcher.innerHTML = '';
      sets.forEach(function (s, i) {
        var b = el('button', { type: 'button', role: 'tab', text: s.title || 'Untitled set' });
        b.setAttribute('aria-selected', i === state.i ? 'true' : 'false');
        b.addEventListener('click', function () { state.i = i; draw(); });
        switcher.appendChild(b);
      });

      body.innerHTML = '';
      var set = sets[state.i];
      if (!set) {
        body.appendChild(el('p', { class: 'lede', text: 'No sets yet. Open Studio to add one.' }));
        return;
      }
      var head = el('div', { class: 'set-head' });
      var left = el('div');
      left.appendChild(el('h2', { text: set.title || '' }));
      if (set.blurb) left.appendChild(el('p', { class: 'blurb', text: set.blurb }));
      head.appendChild(left);
      head.appendChild(el('div', { class: 'meta', text: set.meta || '' }));
      body.appendChild(head);

      var grid = el('div', { class: 'gallery', 'data-sort': 'photography.sets.' + set.id, 'data-dropzone': 'photography.sets.' + set.id });
      (set.photos || []).forEach(function (p, i) {
        var f = frameEl(p, { onClick: function () { openLightbox(set.photos, i); } });
        f.setAttribute('data-i', i);
        grid.appendChild(f);
      });
      body.appendChild(grid);
      if (window.CB_STUDIO && window.CB_STUDIO.active) window.CB_STUDIO.decorate();
    }

    root.appendChild(switcher);
    root.appendChild(body);
    CB.redrawPhotography = draw;
    draw();
  }

  /* ---------- Lightbox ---------- */

  var lb;
  function openLightbox(photos, i) {
    if (!lb) {
      lb = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true' });
      lb.appendChild(el('button', { class: 'close', type: 'button', text: 'Close', 'aria-label': 'Close' }));
      var fig = el('figure');
      fig.appendChild(el('img', { alt: '' }));
      var cap = el('figcaption');
      cap.appendChild(el('span', { class: 'cap' }));
      cap.appendChild(el('span', { class: 'meta' }));
      fig.appendChild(cap);
      lb.appendChild(fig);
      var nav = el('div', { class: 'nav' });
      nav.appendChild(el('button', { type: 'button', class: 'prev', text: '← Previous' }));
      nav.appendChild(el('button', { type: 'button', class: 'next', text: 'Next →' }));
      lb.appendChild(nav);
      document.body.appendChild(lb);
      lb.querySelector('.close').addEventListener('click', close);
      lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
      lb.querySelector('.prev').addEventListener('click', function () { step(-1); });
      lb.querySelector('.next').addEventListener('click', function () { step(1); });
      document.addEventListener('keydown', function (e) {
        if (!lb.classList.contains('on')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
      });
    }
    lb._photos = photos; lb._i = i;
    paint();
    lb.classList.add('on');
  }
  function paint() {
    var p = lb._photos[lb._i] || {};
    lb.querySelector('img').src = CB.resolveSrc(p.src);
    lb.querySelector('img').alt = p.alt || p.caption || '';
    lb.querySelector('.cap').textContent = p.caption || '';
    lb.querySelector('figcaption .meta').textContent = p.meta || '';
  }
  function step(n) {
    var len = lb._photos.length;
    lb._i = (lb._i + n + len) % len;
    paint();
  }
  function close() { lb.classList.remove('on'); }

  /* ---------- Film ---------- */

  CB.embedUrl = function (url) {
    if (!url) return '';
    var m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    if (m) return 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&rel=0';
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1';
    return url;
  };

  function renderFilm(root) {
    var d = CB.content.film || {};
    root.appendChild(pageHead(d, '03'));

    var f = d.featured;
    if (f) {
      var fig = frameEl({ src: f.poster, ratio: 'video', alt: f.title }, { eager: true, placeholder: 'Film still' });
      fig.className = 'frame player';
      fig.setAttribute('data-ratio', 'video');
      fig.setAttribute('data-drop', 'film.featured.poster');
      var box = fig.querySelector('.box');
      if (f.poster) box.appendChild(el('div', { class: 'scrim' }));
      var cap = el('button', { class: 'play-capsule', type: 'button', text: f.url ? 'Play' : 'No link yet' });
      if (f.url) {
        cap.addEventListener('click', function () {
          box.innerHTML = '';
          box.appendChild(el('iframe', {
            src: CB.embedUrl(f.url), allow: 'autoplay; fullscreen; picture-in-picture',
            allowfullscreen: 'true', title: f.title || 'Film'
          }));
        });
      } else {
        cap.disabled = true;
      }
      box.appendChild(cap);
      root.appendChild(fig);

      var head = el('div', { class: 'set-head' });
      var left = el('div');
      left.appendChild(el('h2', { text: f.title || '' }));
      if (f.blurb) left.appendChild(el('p', { class: 'blurb', text: f.blurb }));
      head.appendChild(left);
      head.appendChild(el('div', { class: 'meta', text: f.meta || '' }));
      root.appendChild(head);
    }

    var grid = el('div', { class: 'films', 'data-sort': 'film.films' });
    (d.films || []).forEach(function (film, i) {
      var wrap = el('article', { class: 'film', 'data-i': i });
      var fr = frameEl({ src: film.poster, ratio: 'video', alt: film.title }, {
        placeholder: 'Film still',
        onClick: film.url ? function () { window.open(film.url, '_blank', 'noopener'); } : null
      });
      fr.setAttribute('data-drop', 'film.films.' + i + '.poster');
      wrap.appendChild(fr);
      wrap.appendChild(el('h3', { text: film.title || '' }));
      wrap.appendChild(el('div', { class: 'meta', text: film.meta || '' }));
      if (film.blurb) wrap.appendChild(el('p', { class: 'blurb', text: film.blurb }));
      grid.appendChild(wrap);
    });
    root.appendChild(section('Archive', null, [grid]));
  }

  /* ---------- Journal ---------- */

  function renderJournal(root) {
    var d = CB.content.journal || {};
    var params = new URLSearchParams(location.search);
    var slug = params.get('entry');
    var entries = (d.entries || []).slice();

    if (slug) {
      var e = entries.filter(function (x) { return x.id === slug; })[0];
      if (e) return renderEntry(root, e);
    }

    root.appendChild(pageHead(d, '04'));
    var ul = el('ul', { class: 'index', 'data-sort': 'journal.entries' });
    entries.forEach(function (e, i) {
      var a = el('a', { href: 'journal.html?entry=' + encodeURIComponent(e.id) });
      a.appendChild(el('span', { class: 'meta', text: CB.fmtDate(e.date) }));
      var mid = el('span');
      mid.appendChild(el('span', { class: 't', text: e.title || 'Untitled' }));
      if (e.lede) mid.appendChild(el('span', { class: 'l', html: '<br>' + escapeHtml(e.lede) }));
      a.appendChild(mid);
      a.appendChild(el('span', { class: 'meta', text: e.meta || '' }));
      ul.appendChild(el('li', { 'data-i': i }, [a]));
    });
    root.appendChild(ul);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderEntry(root, e) {
    var art = el('article', { class: 'entry' });
    art.appendChild(label(null, 'Journal'));
    art.appendChild(el('h1', { text: e.title || '' }));
    art.appendChild(el('div', { class: 'meta stamp', text: [CB.fmtDate(e.date), e.meta].filter(Boolean).join(' · ') }));
    root.appendChild(art);

    if (e.cover) {
      var f = frameEl({ src: e.cover, ratio: 'cinema' }, { eager: true, placeholder: 'Cover photograph' });
      f.style.margin = 'var(--space-8) 0';
      root.appendChild(f);
    }

    var prose = el('div', { class: 'cb-prose cb-prose--dropcap' });
    String(e.body || '').split(/\n\s*\n/).forEach(function (p) {
      if (p.trim()) prose.appendChild(el('p', { text: p.trim() }));
    });
    var body = el('div', { class: 'entry' }, [prose]);
    if (e.pullquote) {
      var pq = el('blockquote', { class: 'pullquote', text: e.pullquote });
      prose.insertBefore(pq, prose.children[Math.min(2, prose.children.length)] || null);
    }
    body.appendChild(el('a', { class: 'back', href: 'journal.html', text: '← All entries' }));
    root.appendChild(body);
  }

  /* ---------- Media ---------- */

  function renderMedia(root) {
    var d = CB.content.media || {};
    root.appendChild(pageHead(d, '05'));

    var links = d.links || [];
    var kinds = [];
    links.forEach(function (l) { if (l.kind && kinds.indexOf(l.kind) < 0) kinds.push(l.kind); });
    var active = 'All';

    var filters = el('div', { class: 'filters' });
    var list = el('ul', { class: 'links', 'data-sort': 'media.links' });

    function draw() {
      filters.innerHTML = '';
      ['All'].concat(kinds).forEach(function (k) {
        var b = el('button', { type: 'button', text: k });
        b.setAttribute('aria-pressed', k === active ? 'true' : 'false');
        b.addEventListener('click', function () { active = k; draw(); });
        filters.appendChild(b);
      });
      list.innerHTML = '';
      links.forEach(function (l, i) {
        if (active !== 'All' && l.kind !== active) return;
        var a = el('a', l.url ? { href: l.url, target: '_blank', rel: 'noopener' } : { href: '#', 'aria-disabled': 'true' });
        a.appendChild(el('span', { class: 'meta kind', text: l.kind || '' }));
        a.appendChild(el('span', { class: 'pub', text: l.publication || '' }));
        a.appendChild(el('span', { class: 't', text: l.title || '' }));
        a.appendChild(el('span', { class: 'meta yr', text: l.year || '' }));
        a.appendChild(el('span', { class: 'arrow', text: '↗' }));
        list.appendChild(el('li', { 'data-i': i }, [a]));
      });
      if (window.CB_STUDIO && window.CB_STUDIO.active) window.CB_STUDIO.decorate();
    }

    root.appendChild(filters);
    root.appendChild(list);
    CB.redrawMedia = draw;
    draw();
  }

  /* ---------- boot ---------- */

  CB.render = function () {
    var main = document.getElementById('page');
    main.innerHTML = '';
    ({
      athlete: renderAthlete,
      photography: renderPhotography,
      film: renderFilm,
      journal: renderJournal,
      media: renderMedia
    }[CB.page] || function () {})(main);

    var old = document.querySelector('.rail');
    if (old) old.remove();
    document.body.appendChild(rail());

    var oldF = document.querySelector('.site-footer');
    if (oldF) oldF.remove();
    main.parentNode.insertBefore(footer(), main.nextSibling);

    var t = (CB.content[CB.page] || {}).title;
    var name = (CB.content.site || {}).name || 'Christian Black';
    document.title = t ? name + ' — ' + t : name;

    if (window.CB_STUDIO && window.CB_STUDIO.active) window.CB_STUDIO.decorate();
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.CB_CONTENT) {
      document.getElementById('page').appendChild(
        el('p', { class: 'lede', text: 'content/content.js did not load. Check that the file sits next to the HTML pages.' })
      );
      return;
    }
    CB.render();
  });
})();
