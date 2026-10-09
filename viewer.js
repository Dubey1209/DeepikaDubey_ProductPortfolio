// The project viewer. Every way of seeing a project used to leave the site:
// case studies for Drive, demos for their own domains, designs for Figma,
// code for GitHub, and visitors seldom found their way back. Now they open
// here, in a bottom sheet over the page:
//   case study  Drive's preview, filed like a case file
//   live site   inside a little browser, on a desktop or a phone screen
//   Figma       Figma's own embed, on a canvas
//   code        GitHub won't be framed, so the repo is drawn from its public
//               API: description, languages, stars and the README
// A project with several (live + code, design + prototype) gets tabs, and
// the next project in the row is a tap away. Back, Escape, the backdrop and
// a drag down on the header close it; Ctrl/Cmd-click still opens a new tab.
(function () {
  var reader = document.getElementById('case-reader');
  if (!reader || typeof reader.showModal !== 'function') return;

  var html = document.documentElement;
  var $ = function (sel) { return reader.querySelector(sel); };
  var sheet = $('.case-reader-sheet');
  var head = $('.case-reader-head');
  var heading = $('.case-reader-heading');
  var stamp = $('.case-reader-stamp');
  var viewsBar = $('.case-reader-views');
  var stage = $('.case-reader-stage');
  var screen = $('.case-reader-screen');
  var frame = $('.case-reader-frame');
  var repoBox = $('.case-reader-repo');
  var waitLine = $('.case-reader-wait-line');
  var slow = $('.case-reader-slow');
  var urlText = $('.case-reader-url-text');
  var outLabel = $('.case-reader-out-label');
  var outs = reader.querySelectorAll('.case-reader-out');
  var dots = $('.case-reader-dots');
  var steps = reader.querySelectorAll('[data-case-step]');
  var deviceBtns = reader.querySelectorAll('[data-device]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canAnimate = !reduce && typeof sheet.animate === 'function';

  // ---- what a link is -------------------------------------------------------

  var KINDS = {
    doc: { stamp: 'Case file', out: 'Open in Drive', wait: ['Unfolding the case study…', 'Pulling it from the filing cabinet…', 'Dusting off the research notes…', 'Lining up the metrics…', 'Straightening the sticky notes…'] },
    site: { stamp: 'Live', out: 'Open site', wait: ['Booting it up…', 'Waking the server, it was napping…', 'Fetching pixels…', 'Polishing the buttons…', 'Almost there, promise…'] },
    figma: { stamp: 'Figma', out: 'Open in Figma', wait: ['Unrolling the canvas…', 'Sharpening the pencils…', 'Nudging frames 1px left…', 'Naming layers properly (finally)…'] },
    repo: { stamp: 'Source', out: 'Open on GitHub', wait: ['Fetching the repo…', 'Counting the commits…', 'Reading the README…', 'Untangling the branches…'] },
  };

  function viewOf(href) {
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    var m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(href);
    if (m) return { kind: 'doc', label: 'Case study', href: href, src: 'https://drive.google.com/file/d/' + m[1] + '/preview' };
    if (/(^|\.)figma\.com$/.test(u.hostname)) {
      var proto = u.pathname.indexOf('/proto/') === 0;
      var embed = new URL(href);
      embed.hostname = 'embed.figma.com';
      embed.searchParams.set('embed-host', 'share');
      return { kind: 'figma', label: proto ? 'Prototype' : 'Design file', href: href, src: embed.href };
    }
    if (u.hostname === 'github.com') {
      var parts = u.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return { kind: 'repo', label: 'Code', href: href, repo: parts[0] + '/' + parts[1] };
    }
    var src = href;
    if (/\.streamlit\.app$/.test(u.hostname)) src = href + (u.search ? '&' : '?') + 'embed=true';
    return { kind: 'site', label: 'Live site', href: href, src: src, host: u.hostname + u.pathname.replace(/\/$/, '') };
  }

  var ORDER = { doc: 0, site: 1, figma: 2, repo: 3 };
  var items = [];
  Array.prototype.forEach.call(document.querySelectorAll('.project-card'), function (card) {
    var views = Array.prototype.map.call(card.querySelectorAll('.project-buttons a[href^="http"]'), function (a) {
      return viewOf(a.href);
    }).filter(Boolean);
    if (!views.length) return;
    // Design file before prototype, live before code.
    views.sort(function (a, b) { return ORDER[a.kind] - ORDER[b.kind]; });
    var text = function (sel) {
      var n = card.querySelector(sel);
      return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
    };
    items.push({
      row: card.parentElement,
      views: views,
      title: text('.case-study-title, .project-title'),
      hook: text('.project-hook'),
      cat: text('.project-category'),
    });
  });
  if (!items.length) return;

  // ---- state ----------------------------------------------------------------

  var item = null;
  var view = null;
  var group = [];
  var waitTimer = 0;
  var slowTimer = 0;
  var typeTimer = 0;
  var ticket = 0;
  var pushed = false;
  var closing = false;
  var lastFocus = null;
  var device = 'desk';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function short(it) { return it.cat.split('|')[0].trim() || it.title; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---- showing a project ----------------------------------------------------

  function showItem(it, v) {
    item = it;
    group = items.filter(function (x) { return x.row === it.row; });
    var at = group.indexOf(it);
    $('.case-reader-title').textContent = it.title;
    $('.case-reader-hook').textContent = it.hook;
    $('.case-reader-cat').textContent = it.cat.replace(/\s*\|\s*/, ' · ');
    $('.case-reader-count').textContent = pad(at + 1) + ' / ' + pad(group.length);
    dots.innerHTML = group.map(function (x, k) { return '<i' + (k === at ? ' class="is-on"' : '') + '></i>'; }).join('');
    var solo = group.length < 2;
    $('.case-reader-foot').classList.toggle('is-solo', solo);
    steps[0].querySelector('.case-reader-step-name').textContent = short(group[(at - 1 + group.length) % group.length]);
    steps[1].querySelector('.case-reader-step-name').textContent = short(group[(at + 1) % group.length]);

    viewsBar.innerHTML = it.views.length < 2 ? '' : it.views.map(function (x, k) {
      return '<button type="button" role="tab" class="case-reader-view is-' + x.kind + '" data-view="' + k + '" aria-selected="false">' +
        '<span class="case-reader-view-dot" aria-hidden="true"></span>' + esc(x.label) + '</button>';
    }).join('');
    viewsBar.hidden = it.views.length < 2;

    if (canAnimate && reader.open) {
      heading.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' });
    }
    showView(v || it.views[0]);
  }

  function showView(v) {
    view = v;
    var kind = KINDS[v.kind];
    var mine = ++ticket;
    reader.setAttribute('data-kind', v.kind);
    stamp.textContent = kind.stamp;
    replay(stamp, 'is-stamped');
    outLabel.textContent = kind.out;
    outs.forEach(function (a) { a.href = v.href; });
    Array.prototype.forEach.call(viewsBar.children, function (b) {
      b.setAttribute('aria-selected', String(item.views[+b.getAttribute('data-view')] === v));
    });

    screen.classList.remove('is-ready', 'is-loading');
    slow.hidden = true;
    clearInterval(waitTimer);
    clearTimeout(slowTimer);
    var w = 0;
    waitLine.textContent = kind.wait[0];
    waitTimer = setInterval(function () { waitLine.textContent = kind.wait[++w % kind.wait.length]; }, 1500);

    typeUrl(v.kind === 'site' ? v.host : v.kind === 'figma' ? 'figma.com · ' + item.title : '');
    applyDevice();

    if (v.kind === 'repo') {
      mount('');
      repoBox.hidden = false;
      repoBox.innerHTML = '';
      loadRepo(v, mine);
      return;
    }
    repoBox.hidden = true;
    replay(screen, 'is-loading');
    slowTimer = setTimeout(function () { if (mine === ticket) slow.hidden = false; }, 9000);
    mount(v.src);
  }

  function ready() {
    clearInterval(waitTimer);
    clearTimeout(slowTimer);
    slow.hidden = true;
    screen.classList.add('is-ready');
  }

  // Every page gets a fresh frame. Pointing the same frame somewhere new
  // adds to the tab's history, and then Back stepped through old frames
  // instead of closing the sheet.
  function mount(src) {
    var fresh = frame.cloneNode(false);
    fresh.hidden = !src;
    if (src) fresh.src = src;
    frame.parentNode.replaceChild(fresh, frame);
    frame = fresh;
    bindFrame(frame);
  }

  function bindFrame(f) {
    f.addEventListener('load', function () {
      if (f !== frame || !reader.open || closing || !f.getAttribute('src')) return;
      ready();
    });
    // The custom cursor can't follow into a frame, so it bows out there.
    f.addEventListener('mouseenter', function () { html.classList.add('fx-text'); });
    f.addEventListener('mouseleave', function () { html.classList.remove('fx-text'); });
  }
  bindFrame(frame);

  // The address types itself in, the way it would in a real browser.
  function typeUrl(text) {
    clearInterval(typeTimer);
    if (reduce || !text) {
      urlText.textContent = text;
      return;
    }
    var n = 0;
    urlText.textContent = '';
    typeTimer = setInterval(function () {
      urlText.textContent = text.slice(0, ++n);
      if (n >= text.length) clearInterval(typeTimer);
    }, 22);
  }

  function applyDevice() {
    var phone = device === 'phone' && view && view.kind === 'site';
    screen.classList.toggle('is-phone', phone);
    deviceBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-device') === device)); });
  }

  // ---- code: the repo, drawn from GitHub's API ------------------------------

  var LANG = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c',
    Python: '#3572A5', 'Jupyter Notebook': '#DA5B0B', Kotlin: '#A97BFF', Java: '#b07219',
    Dart: '#00B4AB', Swift: '#F05138', 'C++': '#f34b7d', C: '#555555', Shell: '#89e051',
  };
  var repoCache = {};

  function gh(path, accept) {
    return fetch('https://api.github.com/' + path, { headers: { Accept: accept || 'application/vnd.github+json' } })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return accept ? r.text() : r.json();
      });
  }

  function loadRepo(v, mine) {
    var key = v.repo;
    if (!repoCache[key]) {
      repoCache[key] = Promise.all([
        gh('repos/' + key),
        gh('repos/' + key + '/languages').catch(function () { return {}; }),
        gh('repos/' + key + '/readme', 'application/vnd.github.html').catch(function () { return ''; }),
      ]);
      repoCache[key].catch(function () { delete repoCache[key]; });
    }
    repoCache[key].then(function (res) {
      if (mine !== ticket) return;
      repoBox.innerHTML = repoCard(res[0], res[1]) + readme(res[2], key);
      repoBox.scrollTop = 0;
      ready();
    }, function () {
      if (mine !== ticket) return;
      repoBox.innerHTML = '<div class="case-reader-repo-miss"><p class="case-reader-repo-miss-big">GitHub needs a breather.</p>' +
        '<p>It only answers so many visitors an hour. The code is one click away though.</p>' +
        '<a class="case-reader-pill" href="' + esc(v.href) + '" target="_blank" rel="noopener">Open ' + esc(key) + ' ↗</a></div>';
      ready();
    });
  }

  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    var units = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(s / units[i][0]);
      if (n >= 1) return n + ' ' + units[i][1] + (n > 1 ? 's' : '') + ' ago';
    }
    return 'just now';
  }

  function repoCard(r, langs) {
    var total = Object.keys(langs).reduce(function (s, k) { return s + langs[k]; }, 0) || 1;
    var bar = Object.keys(langs).map(function (k) {
      return '<i style="flex:' + langs[k] + ';background:' + (LANG[k] || 'var(--muted)') + '"></i>';
    }).join('');
    var legend = Object.keys(langs).slice(0, 5).map(function (k) {
      return '<li><span style="background:' + (LANG[k] || 'var(--muted)') + '"></span>' + esc(k) +
        ' <em>' + (langs[k] * 100 / total).toFixed(1) + '%</em></li>';
    }).join('');
    var topics = (r.topics || []).slice(0, 6).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    return '<section class="case-reader-repo-card">' +
      '<p class="case-reader-repo-path"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.71 1.71.75.75 0 0 1-1.06 1.06A2.49 2.49 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.71A2.5 2.5 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.09a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>' +
      esc(r.owner && r.owner.login) + ' / <strong>' + esc(r.name) + '</strong></p>' +
      (r.description ? '<p class="case-reader-repo-desc">' + esc(r.description) + '</p>' : '') +
      (topics ? '<ul class="case-reader-repo-topics">' + topics + '</ul>' : '') +
      '<ul class="case-reader-repo-stats">' +
      '<li><b>' + (r.stargazers_count || 0) + '</b> stars</li>' +
      '<li><b>' + (r.forks_count || 0) + '</b> forks</li>' +
      '<li>updated <b>' + esc(ago(r.pushed_at || r.updated_at)) + '</b></li>' +
      (r.homepage ? '<li><a href="' + esc(r.homepage) + '" target="_blank" rel="noopener">' + esc(r.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')) + ' ↗</a></li>' : '') +
      '</ul>' +
      (bar ? '<div class="case-reader-repo-bar">' + bar + '</div><ul class="case-reader-repo-langs">' + legend + '</ul>' : '') +
      '</section>';
  }

  // GitHub renders the README; it is still someone else's HTML, so scripts,
  // frames, forms and inline handlers go, and relative links are pointed
  // back at the repo.
  function readme(src, key) {
    if (!src) return '<p class="case-reader-repo-empty">No README yet. The code speaks for itself.</p>';
    var doc = new DOMParser().parseFromString(src, 'text/html');
    doc.querySelectorAll('script, style, iframe, object, embed, form, link, meta, base, input, button').forEach(function (n) { n.remove(); });
    doc.body.querySelectorAll('*').forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (at) {
        if (/^on/i.test(at.name) || /^\s*javascript:/i.test(at.value)) n.removeAttribute(at.name);
      });
    });
    var raw = 'https://raw.githubusercontent.com/' + key + '/HEAD/';
    var blob = 'https://github.com/' + key + '/blob/HEAD/';
    doc.querySelectorAll('img[src]').forEach(function (img) {
      try { img.setAttribute('src', new URL(img.getAttribute('src'), raw).href); } catch (e) { img.remove(); }
      img.setAttribute('loading', 'lazy');
    });
    doc.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (h.charAt(0) === '#') return;
      try { a.setAttribute('href', new URL(h, blob).href); } catch (e) { a.removeAttribute('href'); }
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    return '<article class="case-reader-readme"><p class="case-reader-readme-label">README.md</p>' + doc.body.innerHTML + '</article>';
  }

  // ---- open and close ---------------------------------------------------------

  function carryCursor(host) {
    document.querySelectorAll('.fx-cursor').forEach(function (c) { host.appendChild(c); });
  }

  function open(it, v) {
    lastFocus = document.activeElement;
    showItem(it, v);
    if (reader.open) return;
    reader.showModal();
    carryCursor(reader);
    html.classList.add('is-dialog-open');
    if (window.atelierLenis) window.atelierLenis.stop();
    // Back closes the sheet rather than leaving the page.
    history.pushState({ caseReader: true }, '');
    pushed = true;
    if (canAnimate) {
      sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], {
        duration: 640, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)',
      });
    }
    $('.case-reader-close').focus({ preventScroll: true });
  }

  function close() {
    if (!reader.open || closing) return;
    closing = true;
    ticket++;
    clearInterval(waitTimer);
    clearTimeout(slowTimer);
    clearInterval(typeTimer);
    if (pushed) {
      pushed = false;
      history.back();
    }
    var done = false;
    var end = function () {
      if (done) return;
      done = true;
      closing = false;
      reader.close();
    };
    if (!canAnimate) return end();
    reader.classList.add('is-closing');
    var from = getComputedStyle(sheet).transform;
    sheet.getAnimations().forEach(function (a) { a.cancel(); });
    sheet.animate([
      { transform: from === 'none' ? 'none' : from },
      { transform: 'translateY(100%)' },
    ], { duration: 360, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' }).onfinish = end;
    setTimeout(end, 420);
  }

  reader.addEventListener('close', function () {
    reader.classList.remove('is-closing');
    sheet.getAnimations().forEach(function (a) { a.cancel(); });
    sheet.style.transform = '';
    mount('');
    repoBox.innerHTML = '';
    html.classList.remove('is-dialog-open', 'fx-text');
    carryCursor(document.body);
    if (window.atelierLenis) window.atelierLenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  });

  reader.addEventListener('cancel', function (e) {
    e.preventDefault();
    close();
  });

  function step(by) {
    var at = group.indexOf(item);
    showItem(group[(at + by + group.length) % group.length]);
  }

  reader.addEventListener('click', function (e) {
    if (e.target === reader || e.target.closest('[data-case-close]')) return close();
    var s = e.target.closest('[data-case-step]');
    if (s) return step(Number(s.getAttribute('data-case-step')));
    var tab = e.target.closest('[data-view]');
    if (tab) {
      var v = item.views[+tab.getAttribute('data-view')];
      if (v !== view) showView(v);
      return;
    }
    var dev = e.target.closest('[data-device]');
    if (dev) {
      device = dev.getAttribute('data-device');
      applyDevice();
      return;
    }
    if (e.target.closest('.case-reader-reload') && view && view.src) {
      screen.classList.remove('is-ready');
      replay(screen, 'is-loading');
      mount(view.src);
    }
  });

  reader.addEventListener('keydown', function (e) {
    if (e.target.closest('.case-reader-repo')) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  window.addEventListener('popstate', function () {
    if (!reader.open) return;
    pushed = false;
    close();
  });

  // Drag the header down to put it away, as on a phone.
  var drag = null;
  head.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.target.closest('a, button')) return;
    drag = { y: e.clientY, t: performance.now(), dy: 0 };
    head.setPointerCapture(e.pointerId);
    sheet.getAnimations().forEach(function (a) { a.cancel(); });
    reader.classList.add('is-dragging');
  });
  head.addEventListener('pointermove', function (e) {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    sheet.style.transform = 'translateY(' + drag.dy + 'px)';
  });
  function release() {
    if (!drag) return;
    var d = drag;
    drag = null;
    reader.classList.remove('is-dragging');
    var speed = d.dy / Math.max(1, performance.now() - d.t);
    if (d.dy > sheet.offsetHeight * 0.22 || (speed > 0.5 && d.dy > 40)) return close();
    sheet.style.transform = '';
    if (canAnimate && d.dy) {
      sheet.animate([{ transform: 'translateY(' + d.dy + 'px)' }, { transform: 'none' }], {
        duration: 320, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)',
      });
    }
  }
  head.addEventListener('pointerup', release);
  head.addEventListener('pointercancel', release);

  // Project links, on the cards and in the card's "Read more" modal.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="http"]');
    if (!a || !a.closest('.project-card .project-buttons, .work-modal-actions')) return;
    for (var i = 0; i < items.length; i++) {
      for (var k = 0; k < items[i].views.length; k++) {
        if (items[i].views[k].href === a.href) {
          e.preventDefault();
          var modal = a.closest('.work-modal');
          if (modal) modal.querySelector('[data-work-close]').click();
          open(items[i], items[i].views[k]);
          return;
        }
      }
    }
  });
})();
