/* christianblack.media — renderer.
   Reads window.CB_CONTENT (content/content.js) and draws whichever page
   the document declares in <body data-page>. No framework, no build step. */

(function () {
  'use strict';

  var CB = (window.CB = window.CB || {});

  CB.PAGES = [
    { id: 'journal', label: 'Journal', href: 'index.html' },
    { id: 'athlete', label: 'Tick list', href: 'ticklist.html' },
    { id: 'photography', label: 'Photography', href: 'photography.html' },
    { id: 'film', label: 'Film', href: 'film.html' },
    { id: 'media', label: 'Media', href: 'media.html' },
    { id: 'about', label: 'About', href: 'about.html' }
  ];

  CB.hrefFor = function (id) {
    for (var i = 0; i < CB.PAGES.length; i++) if (CB.PAGES[i].id === id) return CB.PAGES[i].href;
    return 'index.html';
  };
  CB.numFor = function (id) {
    for (var i = 0; i < CB.PAGES.length; i++) if (CB.PAGES[i].id === id) return '0' + (i + 1);
    return '';
  };

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
    var markLink = el('a', { class: 'mark', href: CB.hrefFor('journal'), 'aria-label': site.name || 'Home' });
    if (site.markImage) {
      markLink.appendChild(el('img', { class: 'mark__img', src: CB.resolveSrc(site.markImage), alt: site.name || 'Home' }));
    } else {
      markLink.textContent = site.mark || 'CB';
    }
    nav.appendChild(markLink);
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

  var SOCIAL_PATHS = {
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
    youtube: '<rect x="2.2" y="5" width="19.6" height="14" rx="4"/><path d="M10.2 9.2 L15.4 12 L10.2 14.8 Z"/>'
  };

  function socialEl(list) {
    var wrap = el('div', { class: 'social' });
    (list || []).forEach(function (s) {
      var a = el('a', {
        class: 'social__link', href: s.url, target: '_blank', rel: 'noopener',
        'aria-label': s.kind + ' ' + (s.handle || ''), title: s.handle || s.kind
      });
      a.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" ' +
                    'stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    (SOCIAL_PATHS[s.kind] || '') + '</svg>';
      wrap.appendChild(a);
    });
    return wrap;
  }

  function footer() {
    var site = CB.content.site || {};
    var f = el('footer', { class: 'site-footer' });
    f.appendChild(el('span', { class: 'site-footer__left', text: site.domain || '' }));
    f.appendChild(socialEl(site.social));

    var right = el('span', { class: 'site-footer__right' });
    right.appendChild(el('a', { href: CB.hrefFor('about') + '#contact', text: 'Contact' }));
    right.appendChild(el('span', { text: ' ' + (site.contactNote || '') }));
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

  /* Paragraph text with optional inline [label](url) links. Built as real
     nodes rather than innerHTML so the copy is never parsed as markup. */
  function paraEl(text, cls) {
    var p = el('p', cls ? { class: cls } : null);
    var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    var last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) p.appendChild(document.createTextNode(text.slice(last, m.index)));
      p.appendChild(el('a', { href: m[2], target: '_blank', rel: 'noopener', text: m[1] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) p.appendChild(document.createTextNode(text.slice(last)));
    return p;
  }
  CB.paraEl = paraEl;

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


  /* A backdrop of one or two photographs, pinned behind the page.
     Layers drift slower than the content and cross-fade on scroll. */
  function parallaxBg(images, opts) {
    opts = opts || {};
    var bg = el('div', { class: 'fixedbg fixedbg--parallax' });
    var layers = [];
    (images || []).filter(Boolean).forEach(function (im, i) {
      var L = el('div', { class: 'fixedbg__layer' });
      var img = el('img', { src: CB.resolveSrc(im.src), alt: '', loading: i ? 'lazy' : 'eager' });
      if (im.focus) img.style.objectPosition = im.focus;
      L.appendChild(img);
      if (i > 0) L.style.opacity = '0';
      bg.appendChild(L);
      layers.push(L);
    });
    bg.appendChild(el('div', { class: 'fixedbg__scrim' + (opts.dim ? ' fixedbg__scrim--dim' : '') }));
    document.body.appendChild(bg);

    var queued = false;
    function paint() {
      queued = false;
      var vh = window.innerHeight || 1;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      /* cross-fade across the first couple of screens */
      if (layers.length > 1) {
        var p = Math.max(0, Math.min(1, (y - vh * 0.55) / (vh * 1.15)));
        layers[1].style.opacity = p.toFixed(3);
      }
      /* drift: background moves at a fraction of the page's speed */
      var drift = Math.min(y * 0.18, vh * 0.5);
      layers.forEach(function (L) { L.style.transform = 'translate3d(0,' + (-drift).toFixed(1) + 'px,0)'; });
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(paint);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
    return bg;
  }

  /* ---------- Tick list (athlete) ---------- */

  function tickEl(it, i) {
    var li = el('li', { class: 'tick', 'data-i': i });
    var head = el('div', { class: 'tick__head' });
    head.appendChild(el('span', { class: 'tick__name', text: it.name || '' }));
    if (it.grade) head.appendChild(el('span', { class: 'tick__grade', text: it.grade }));
    li.appendChild(head);
    if (it.detail) li.appendChild(el('span', { class: 'tick__detail', text: it.detail }));
    if (it.note) li.appendChild(el('em', { class: 'tick__note', text: it.note }));
    if (it.url) {
      li.appendChild(el('a', {
        class: 'tick__read', href: it.url, target: '_blank', rel: 'noopener',
        text: 'Read article \u2197'
      }));
    } else if (it.url === '') {
      li.appendChild(el('span', { class: 'tick__read tick__read--empty', text: 'Read article \u2197' }));
    }
    return li;
  }

  function bandEl(b, bi) {
    var sec = el('section', { class: 'band band--' + (b.side === 'left' ? 'left' : 'right'), id: b.id || null });

    var media = el('div', { class: 'band__media', 'data-drop': 'athlete.bands.' + bi + '.image' });
    var src = CB.resolveSrc(b.image);
    if (src) {
      var img = el('img', { class: 'band__img', src: src, alt: b.label || '', loading: bi === 0 ? 'eager' : 'lazy' });
      if (b.focus) img.style.objectPosition = b.focus;
      media.appendChild(img);
    } else {
      media.appendChild(el('div', { class: 'band__empty', text: 'Photograph' }));
    }
    media.appendChild(el('div', { class: 'band__scrim' }));
    sec.appendChild(media);
    sec.appendChild(el('div', { class: 'band__fade' }));

    var inner = el('div', { class: 'band__inner' });
    var col = el('div', { class: 'band__col' });
    col.appendChild(el('h2', { class: 'band__label', text: b.label || '' }));
    if (b.blurb) col.appendChild(el('div', { class: 'band__blurb', text: b.blurb }));
    var ul = el('ul', { class: 'ticks', 'data-sort': 'athlete.bands.' + bi });
    (b.items || []).forEach(function (it, i) { ul.appendChild(tickEl(it, i)); });
    col.appendChild(ul);
    if (b.credit) col.appendChild(el('div', { class: 'band__credit meta', text: b.credit }));
    inner.appendChild(col);
    sec.appendChild(inner);
    return sec;
  }

  function renderAthlete(root) {
    var d = CB.content.athlete || {};
    root.classList.add('page--bands');

    /* Backdrop that stays put while the page scrolls over it. */
    var h = d.header || {};
    if (h.image) {
      var bg = el('div', { class: 'fixedbg', 'data-drop': 'athlete.header.image' });
      var bgImg = el('img', { src: CB.resolveSrc(h.image), alt: '' });
      if (h.focus) bgImg.style.objectPosition = h.focus;
      bg.appendChild(bgImg);
      bg.appendChild(el('div', { class: 'fixedbg__scrim' }));
      document.body.appendChild(bg);
    }

    var hero = el('header', { class: 'hero-fixed' });
    var hin = el('div', { class: 'hero-fixed__inner' });
    hin.appendChild(CB.labelEl(CB.numFor(CB.page), d.kicker));
    hin.appendChild(el('h1', { text: d.title || '' }));
    if (d.lede) hin.appendChild(el('p', { class: 'hero-fixed__sub', text: d.lede }));

    var sup = d.support || {};
    if (sup.logo || (sup.partners || []).length) {
      var sb = el('div', { class: 'supported' });
      if (sup.logo) {
        sb.appendChild(el('img', {
          class: 'supported__logo', src: CB.resolveSrc(sup.logo),
          alt: (sup.partners || []).join(', ') || 'Sponsor'
        }));
      }
      sb.appendChild(el('div', { class: 'supported__label', text: sup.label || 'Supported by' }));
      hin.appendChild(sb);
    }
    if (h.credit) hero.appendChild(el('div', { class: 'hero-fixed__credit meta', text: h.credit }));
    hero.appendChild(hin);
    root.appendChild(hero);

    var over = el('div', { class: 'scroll-over' });
    (d.bands || []).forEach(function (b, i) { over.appendChild(bandEl(b, i)); });
    root.appendChild(over);

    startBandFade();
  }

  /* Each panel dissolves as it leaves the top of the screen. */
  var fadeBound = false;
  function startBandFade(selector) {
    var bands = [].slice.call(document.querySelectorAll(selector || '.band'));
    if (!bands.length) return;
    var queued = false;

    function paint() {
      queued = false;
      var vh = window.innerHeight || 1;
      bands.forEach(function (b) {
        var r = b.getBoundingClientRect();
        var p = 0;
        if (r.top < 0) p = Math.min(1, (-r.top) / Math.max(1, r.height * 0.7));
        else if (r.top > vh * 0.92) p = Math.min(1, (r.top - vh * 0.92) / (vh * 0.18));
        b.style.setProperty('--fade', p.toFixed(3));
      });
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(paint);
    }
    if (!fadeBound) {
      fadeBound = true;
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    }
    CB._repaintFade = onScroll;
    paint();
  }

  /* ---------- Photography ---------- */

  function renderPhotography(root) {
    var d = CB.content.photography || {};
    root.classList.add('page--gallery');

    var head = el('header', { class: 'gallery-head' });
    head.appendChild(label(CB.numFor(CB.page), d.kicker));
    if (d.lede) head.appendChild(el('p', { class: 'gallery-head__lede', text: d.lede }));
    root.appendChild(head);

    var photos = d.photos || [];
    var bn = d.banner || {};
    if (bn.image && !photos.length) {
      var banner = el('section', { class: 'banner', 'data-drop': 'photography.banner.image' });
      var bimg = el('img', { class: 'banner__img', src: CB.resolveSrc(bn.image), alt: '' });
      if (bn.focus) bimg.style.objectPosition = bn.focus;
      banner.appendChild(bimg);
      banner.appendChild(el('div', { class: 'banner__scrim' }));
      banner.appendChild(el('h1', { class: 'banner__word', text: bn.headline || 'Coming soon' }));
      root.appendChild(banner);
      return;
    }
    var grid = el('div', { class: 'grid', 'data-sort': 'photography.photos', 'data-dropzone': 'photography.photos' });
    photos.forEach(function (p, i) {
      var cell = el('figure', { class: 'cell', 'data-i': i });
      var box = el('div', { class: 'cell__box' });
      var src = CB.resolveSrc(p.src);
      if (src) {
        box.appendChild(el('img', { src: src, alt: p.caption || '', loading: i < 8 ? 'eager' : 'lazy' }));
      } else {
        box.appendChild(el('div', { class: 'empty', text: 'Photograph' }));
      }
      box.addEventListener('click', function () { openLightbox(photos, i); });
      cell.appendChild(box);
      if (p.caption || p.meta) {
        var cap = el('figcaption', { class: 'cell__cap' });
        cap.appendChild(el('span', { text: p.caption || '' }));
        cap.appendChild(el('span', { class: 'meta', text: p.meta || '' }));
        cell.appendChild(cap);
      }
      grid.appendChild(cell);
    });
    root.appendChild(grid);
    CB.redrawPhotography = function () { CB.render(); };
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

  CB.ytId = function (url) {
    var m = String(url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    return m ? m[1] : '';
  };
  CB.ytThumb = function (url) {
    var id = CB.ytId(url);
    return id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '';
  };

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
    root.classList.add('page--film');

    var head = el('header', { class: 'gallery-head' });
    head.appendChild(label(CB.numFor(CB.page), d.kicker));
    root.appendChild(head);

    var f = d.featured || {};
    var stage = el('div', { class: 'stage' });
    var box = el('div', { class: 'stage__box' });
    var poster = CB.resolveSrc(f.poster) || CB.ytThumb(f.url);
    if (poster) box.appendChild(el('img', { class: 'stage__poster', src: poster, alt: f.title || '' }));
    box.appendChild(el('div', { class: 'stage__scrim' }));

    var play = el('button', { class: 'play-capsule', type: 'button', text: f.url ? 'Play' : 'No link yet' });
    if (f.url) {
      play.addEventListener('click', function () {
        box.innerHTML = '';
        box.appendChild(el('iframe', {
          src: CB.embedUrl(f.url), allow: 'autoplay; fullscreen; picture-in-picture',
          allowfullscreen: 'true', title: f.title || 'Film'
        }));
      });
    } else {
      play.disabled = true;
    }
    box.appendChild(play);
    stage.appendChild(box);

    var cap = el('div', { class: 'stage__cap' });
    var left = el('div');
    left.appendChild(el('h1', { class: 'stage__title', text: f.title || '' }));
    if (f.blurb) left.appendChild(el('p', { class: 'stage__blurb', text: f.blurb }));
    cap.appendChild(left);
    cap.appendChild(el('div', { class: 'meta', text: f.meta || '' }));
    stage.appendChild(cap);
    root.appendChild(stage);

    var vids = d.videos || [];
    if (vids.length) {
      var strip = el('div', { class: 'strip-wrap' });
      strip.appendChild(label(null, 'More on the channel'));
      var rail = el('div', { class: 'strip', 'data-sort': 'film.videos' });
      vids.forEach(function (v, i) {
        var card = el(v.url ? 'a' : 'div', v.url
          ? { class: 'vid', href: v.url, target: '_blank', rel: 'noopener', 'data-i': i }
          : { class: 'vid vid--empty', 'data-i': i });
        var vb = el('div', { class: 'vid__box' });
        var th = CB.ytThumb(v.url);
        if (th) vb.appendChild(el('img', { src: th, alt: v.title || '', loading: 'lazy' }));
        else vb.appendChild(el('div', { class: 'empty', text: 'Video' }));
        card.appendChild(vb);
        card.appendChild(el('div', { class: 'vid__title', text: v.title || '' }));
        card.appendChild(el('div', { class: 'meta', text: v.meta || '' }));
        rail.appendChild(card);
      });
      strip.appendChild(rail);
      root.appendChild(strip);
    }
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

    root.classList.add('page--bands');
    var h = d.header || {};
    if ((h.images || []).length) parallaxBg(h.images);

    var hero = el('header', { class: 'hero-fixed' });
    var hin = el('div', { class: 'hero-fixed__inner' });
    hin.appendChild(label(CB.numFor(CB.page), d.kicker));
    hin.appendChild(el('h1', { text: d.title || '' }));
    if (d.lede) hin.appendChild(el('p', { class: 'hero-fixed__sub', text: d.lede }));
    hero.appendChild(hin);
    root.appendChild(hero);

    var list = el('div', { class: 'posts', 'data-sort': 'journal.entries' });
    entries.forEach(function (e, i) {
      var a = el('a', { class: 'post', href: CB.hrefFor('journal') + '?entry=' + encodeURIComponent(e.id), 'data-i': i });

      var thumb = el('div', { class: 'post__thumb' });
      var src = CB.resolveSrc(e.thumb || e.cover);
      if (src) thumb.appendChild(el('img', { src: src, alt: '', loading: i < 3 ? 'eager' : 'lazy' }));
      a.appendChild(thumb);

      var t = el('div', { class: 'post__text' });
      t.appendChild(el('div', { class: 'meta', text: [entryDate(e), e.meta].filter(Boolean).join(' \u00b7 ') }));
      t.appendChild(el('h2', { class: 'post__title', text: e.title || 'Untitled' }));
      var ex = e.lede || excerpt(e.body);
      if (ex) t.appendChild(el('p', { class: 'post__excerpt', text: ex }));
      t.appendChild(el('span', { class: 'post__more', text: 'Read \u2192' }));
      a.appendChild(t);

      a.appendChild(el('div', { class: 'band__fade' }));
      list.appendChild(a);
    });
    root.appendChild(list);
    startBandFade('.post');
  }

  function entryDate(e) {
    return e.dateLabel || CB.fmtDate(e.date);
  }

  function excerpt(body) {
    var first = String(body || '').split(/\n\s*\n/).filter(function (p) {
      return p.trim() && p.indexOf('[photo:') !== 0 && p.indexOf('##') !== 0;
    })[0] || '';
    first = first.trim();
    if (first.length <= 190) return first;
    var cut = first.slice(0, 190);
    return cut.slice(0, cut.lastIndexOf(' ')) + '\u2026';
  }

  /* Body format: blank-line separated paragraphs, plus two markers —
     "## Heading" for a subheading and "[photo: path | caption]" for a picture. */
  function renderBody(host, body) {
    var run = null;
    String(body || '').split(/\n\s*\n/).forEach(function (chunk) {
      var t = chunk.trim();
      if (!t) return;

      var pm = t.match(/^\[photo:\s*([^\]|]+?)\s*(?:\|\s*([^\]]*))?\]$/);
      if (pm) {
        run = null;
        var fig = frameEl({ src: pm[1].trim(), caption: (pm[2] || '').trim(), ratio: 'free' });
        fig.classList.add('entry__photo');
        host.appendChild(fig);
        return;
      }
      if (t.indexOf('## ') === 0) {
        run = null;
        host.appendChild(el('h2', { class: 'entry__h2', text: t.slice(3).trim() }));
        return;
      }
      if (!run) {
        run = el('div', { class: 'cb-prose entry__prose' });
        host.appendChild(run);
      }
      run.appendChild(paraEl(t));
    });
  }

  function renderEntry(root, e) {
    root.classList.add('page--article');

    /* the cover sits behind the whole article, dimmed, drifting slowly */
    if (e.cover) parallaxBg([{ src: e.cover, focus: 'center 40%' }], { dim: true });

    var hero = el('header', { class: 'article__hero' });
    var hin = el('div', { class: 'article__heroinner' });
    hin.appendChild(label(null, e.meta || 'Journal'));
    hin.appendChild(el('h1', { text: e.title || '' }));
    var stamp = entryDate(e);
    if (stamp) hin.appendChild(el('div', { class: 'meta article__stamp', text: stamp }));
    if ((e.credits || []).length) {
      var cr = el('div', { class: 'article__credits' });
      e.credits.forEach(function (c) { cr.appendChild(el('div', { text: c })); });
      hin.appendChild(cr);
    }
    hero.appendChild(hin);
    root.appendChild(hero);

    var art = el('article', { class: 'article' });
    if (e.pullquote) art.appendChild(el('blockquote', { class: 'pullquote', text: e.pullquote }));
    renderBody(art, e.body);
    art.appendChild(el('a', { class: 'back', href: CB.hrefFor('journal'), text: '\u2190 All words' }));
    root.appendChild(art);
  }

  /* ---------- Media ---------- */

  function renderMedia(root) {
    var d = CB.content.media || {};
    root.appendChild(pageHead(d, CB.numFor(CB.page)));

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

  /* ---------- About + contact ---------- */

  function renderAbout(root) {
    var d = CB.content.about || {};
    var site = CB.content.site || {};
    root.appendChild(pageHead(d, CB.numFor(CB.page)));

    var top = el('div', { class: 'about' });
    var prose = el('div', { class: 'cb-prose about__prose' });
    String(d.body || '').split(/\n\s*\n/).forEach(function (p) {
      if (p.trim()) prose.appendChild(paraEl(p.trim()));
    });
    top.appendChild(prose);
    var pf = frameEl({ src: d.portrait, ratio: 'portrait' }, { placeholder: 'Portrait', eager: true });
    pf.setAttribute('data-drop', 'about.portrait');
    top.appendChild(pf);
    root.appendChild(top);

    /* contact */
    var c = d.contact || {};
    var sec = el('section', { class: 'section contact', id: 'contact' });
    sec.appendChild(label(null, 'Contact'));
    sec.appendChild(el('h2', { class: 'contact__title', text: c.title || 'Get in touch' }));
    if (c.blurb) sec.appendChild(el('p', { class: 'contact__blurb', text: c.blurb }));

    var form = el('form', { class: 'contact__form', novalidate: 'novalidate' });
    function field(name, labelText, type, rows) {
      var w = el('label', { class: 'field' });
      w.appendChild(el('span', { text: labelText }));
      var i = rows ? el('textarea', { rows: rows, name: name, required: 'required' })
                   : el('input', { type: type || 'text', name: name, required: 'required' });
      w.appendChild(i);
      return w;
    }
    form.appendChild(field('name', 'Your name'));
    form.appendChild(field('email', 'Email', 'email'));
    form.appendChild(field('subject', 'Subject'));
    form.appendChild(field('message', 'Message', null, 7));

    var note = el('div', { class: 'contact__note' });
    var send = el('button', { class: 'contact__send', type: 'submit', text: 'Send' });
    form.appendChild(send);
    form.appendChild(note);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = new FormData(form);
      var name = (f.get('name') || '').trim();
      var email = (f.get('email') || '').trim();
      var subject = (f.get('subject') || '').trim();
      var message = (f.get('message') || '').trim();
      if (!name || !email || !message) {
        note.textContent = 'Please fill in your name, email and message.';
        return;
      }
      if (c.formEndpoint) {
        note.textContent = 'Sending…';
        fetch(c.formEndpoint, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: f
        }).then(function (r) {
          if (r.ok) { form.reset(); note.textContent = 'Thank you — your message is on its way.'; }
          else { note.textContent = 'That did not send. Email ' + (site.email || '') + ' instead.'; }
        }).catch(function () {
          note.textContent = 'That did not send. Email ' + (site.email || '') + ' instead.';
        });
        return;
      }
      /* No form service configured: hand off to the visitor's email client. */
      var to = site.email || '';
      var bodyText = message + '\n\n— ' + name + '\n' + email;
      window.location.href = 'mailto:' + to +
        '?subject=' + encodeURIComponent(subject || ('Enquiry from ' + name)) +
        '&body=' + encodeURIComponent(bodyText);
      note.textContent = 'Opening your email app…';
    });

    sec.appendChild(form);
    root.appendChild(sec);
  }

  /* ---------- boot ---------- */

  CB.render = function () {
    var main = document.getElementById('page');
    main.innerHTML = '';
    var oldBg = document.querySelector('.fixedbg');
    if (oldBg) oldBg.remove();
    ({
      athlete: renderAthlete,
      photography: renderPhotography,
      film: renderFilm,
      journal: renderJournal,
      media: renderMedia,
      about: renderAbout
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
