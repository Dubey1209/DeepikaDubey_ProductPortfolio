/* Project sections as rows of compact cards drifting in opposite directions.
   Each section keeps its cards in the HTML (no-JS fallback, print, and the
   source of every label); this builds a reel beside them and hides the grid.
   A row eases to a stop under the pointer or keyboard focus and can be
   dragged or flicked.

   One family, three looks:
   - Case studies: brand cards. Real logo (data-logo) or initials, the brand's
     colour (data-hue), initials set large in the corner.
   - Design: Figma frames on a dotted canvas; hover selects the frame with
     handles and a size readout. Chips for the design file and prototype.
   - Projects: quiet editor cards. Window dots and the repo path, the hook
     as a code comment, the stack in mono, and Code / Live links.

   Titles open the card's "Read more" and the arrow or chips its links, by
   clicking the original card and link, so the reader (viewer.js) and the
   modal (script.js) behave exactly as they do from the grid. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // A quiet accent per stack, used for the cursor and the hover edge.
  var STACK = [
    [/kotlin/i, '#7f52ff'], [/python|streamlit/i, '#3572a5'], [/javascript|\bjs\b/i, '#c99a06'],
    [/html|css/i, '#e34c26'], [/mobile/i, '#1f8a70']
  ];
  var SPARE_HUES = ['#c45c26', '#3d5a80', '#b4436c', '#5b7a4a'];

  var SECTIONS = [
    { sel: '#case-studies', kind: 'brand', speed: 30, lanes: 2, dir: 1 },
    { sel: '#design-projects', kind: 'frame', speed: 24, lanes: 1, dir: -1 },
    { sel: '#technical-projects', kind: 'code', speed: 27, lanes: 2, dir: 1 }
  ];

  function text(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function initials(name) {
    var words = name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2);
  }

  function make(tag, cls, txt) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt) el.textContent = txt;
    return el;
  }

  function icon(id) {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  function linkTo(href, k, cls, label) {
    var a = make('a', cls);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.draggable = false;
    a.dataset.link = k;
    if (label) a.setAttribute('aria-label', label);
    return a;
  }

  function titleBlock(el, title) {
    var h = make('h3', 'cr-title');
    var more = make('button', 'cr-more', title);
    more.type = 'button';
    h.appendChild(more);
    el.appendChild(h);
  }

  function hookLine(el, card) {
    var hook = text(card.querySelector('.project-hook'));
    if (hook) el.appendChild(make('p', 'cr-hook', hook)).title = hook;
  }

  // ---- case studies: brand cards ------------------------------------------

  function brandCard(card, links) {
    var brand = text(card.querySelector('.project-category')).split('·')[0].trim();
    var title = text(card.querySelector('.case-study-title, .project-title'));
    var el = make('article', 'cr cr--brand');
    if (card.dataset.hue) el.style.setProperty('--h', card.dataset.hue);
    el.appendChild(make('span', 'cr-mark', initials(brand))).setAttribute('aria-hidden', 'true');

    var head = make('div', 'cr-head');
    var logo = make('span', 'cr-logo');
    logo.setAttribute('aria-hidden', 'true');
    if (card.dataset.logo) {
      var img = make('img');
      img.src = card.dataset.logo;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      logo.classList.add('has-img');
      logo.appendChild(img);
    } else {
      logo.textContent = initials(brand);
    }
    head.appendChild(logo);

    var who = make('div', 'cr-who');
    who.appendChild(make('span', 'cr-brand', brand));
    who.appendChild(make('span', 'cr-kind', text(card.querySelector('.project-tag'))));
    head.appendChild(who);

    if (links.length) {
      var go = linkTo(links[0].href, 0, 'cr-go', text(links[0]) + ': ' + title);
      go.innerHTML = ARROW;
      head.appendChild(go);
    }
    el.appendChild(head);
    titleBlock(el, title);
    hookLine(el, card);
    return el;
  }

  // ---- design: Figma frames -----------------------------------------------

  function frameCard(card, links) {
    var title = text(card.querySelector('.project-title'));
    var cat = text(card.querySelector('.project-category')).split('·');
    var el = make('article', 'cr cr--frame');

    var head = make('div', 'cr-frame-head');
    var name = make('span', 'cr-frame-name');
    name.appendChild(make('b', null, '#'));
    name.appendChild(document.createTextNode(' ' + title.split(/\s+[–-]\s+/)[0]));
    head.appendChild(name);
    head.appendChild(make('span', 'cr-frame-kind', (cat[1] || cat[0] || '').trim()));
    el.appendChild(head);

    titleBlock(el, title);
    hookLine(el, card);

    var chips = make('div', 'cr-chips');
    links.forEach(function (a, k) {
      var proto = /\/proto\//.test(a.href);
      var chip = linkTo(a.href, k, 'cr-chip', text(a) + ': ' + title);
      chip.innerHTML = (proto ? icon('i-doc') : '<img src="logos/figma.svg" alt="" draggable="false">') +
        '<span>' + (proto ? 'Prototype' : 'Design file') + '</span>';
      chips.appendChild(chip);
    });
    el.appendChild(chips);

    // Selection chrome, drawn only on hover.
    var sel = make('span', 'cr-select');
    sel.setAttribute('aria-hidden', 'true');
    sel.innerHTML = '<i></i><i></i><i></i><i></i><em></em>';
    el.appendChild(sel);
    return el;
  }

  // ---- projects: editor windows -------------------------------------------

  function codeCard(card, links, i) {
    var title = text(card.querySelector('.project-title'));
    var cat = text(card.querySelector('.project-category'));
    var tag = text(card.querySelector('.project-tag'));
    var hook = text(card.querySelector('.project-hook'));
    var el = make('article', 'cr cr--code');
    var hue = card.dataset.hue;
    for (var s = 0; s < STACK.length && !hue; s++) {
      if (STACK[s][0].test(cat)) hue = STACK[s][1];
    }
    el.style.setProperty('--h', hue || SPARE_HUES[i % SPARE_HUES.length]);

    var repo = '';
    links.some(function (a) {
      var m = /github\.com\/[^/]+\/([^/?#]+)/.exec(a.href);
      if (m) repo = m[1];
      return !!m;
    });

    var bar = make('div', 'cr-bar');
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="cr-dots"><i></i><i></i><i></i></span>';
    var path = make('span', 'cr-path', '~/' + (repo || title.split(/\s+[–-]\s+/)[0]));
    path.appendChild(make('i', 'cr-caret'));
    bar.appendChild(path);
    if (tag) bar.appendChild(make('span', 'cr-flag', tag));
    el.appendChild(bar);

    titleBlock(el, title);
    if (hook) el.appendChild(make('p', 'cr-comment', '// ' + hook)).title = hook;

    var foot = make('div', 'cr-foot');
    foot.appendChild(make('span', 'cr-stack', cat.split(/\s*[,+]\s*/).filter(Boolean).slice(0, 3)
      .map(function (t) { return t.toLowerCase(); }).join(' \u00b7 ')));
    var chips = make('span', 'cr-links');
    links.forEach(function (a, k) {
      var gh = /github\.com/.test(a.href);
      var chip = linkTo(a.href, k, 'cr-link' + (gh ? '' : ' is-live'), text(a) + ': ' + title);
      chip.innerHTML = gh ? '<span>Code</span>' + ARROW : '<i class="cr-live" aria-hidden="true"></i><span>Live</span>';
      chips.appendChild(chip);
    });
    foot.appendChild(chips);
    el.appendChild(foot);
    return el;
  }

  var BUILDERS = { brand: brandCard, frame: frameCard, code: codeCard };

  // ---- one section --------------------------------------------------------

  function setup(cfg) {
    var section = document.querySelector(cfg.sel);
    var row = section && section.querySelector('.projects-cards-row');
    if (!row) return;
    var cards = Array.prototype.slice.call(row.querySelectorAll('.project-card'));
    if (!cards.length) return;

    var built = cards.map(function (card, i) {
      var links = Array.prototype.slice.call(card.querySelectorAll('.project-buttons a[href^="http"]'));
      var el = BUILDERS[cfg.kind](card, links, i);
      el.dataset.i = i;
      return el;
    });

    var reel = make('div', 'case-reel case-reel--' + cfg.kind);
    var lanes = Math.min(cfg.lanes, Math.ceil(built.length / 3));
    var per = Math.ceil(built.length / lanes);
    row.parentNode.insertBefore(reel, row);
    section.classList.add('has-reel');

    // Titles and links act through the original card, so they work the same
    // from the copies too.
    reel.addEventListener('click', function (e) {
      var art = e.target.closest('.cr');
      if (!art || e.defaultPrevented) return;
      var card = cards[+art.dataset.i];
      var a = e.target.closest('a[data-link]');
      if (a) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var src = card.querySelectorAll('.project-buttons a[href^="http"]')[+a.dataset.link];
        if (!src) return;
        e.preventDefault();
        src.click();
      } else if (e.target.closest('.cr-more')) {
        card.click();
      }
    });

    if (cfg.kind === 'frame') {
      var size = function (e) {
        var art = e.target.closest && e.target.closest('.cr--frame');
        var em = art && art.querySelector('.cr-select em');
        if (em) em.dataset.size = art.offsetWidth + ' \u00d7 ' + art.offsetHeight;
      };
      reel.addEventListener('pointerover', size);
      reel.addEventListener('focusin', size);
    }

    for (var l = 0; l < lanes; l++) {
      var group = built.slice(l * per, (l + 1) * per);
      var lane = make('div', 'case-reel-row');
      var track = make('div', 'case-reel-track');
      group.forEach(function (el) { track.appendChild(el); });
      lane.appendChild(track);
      reel.appendChild(lane);
      if (!reduced) drift(lane, track, group, cfg.speed * cfg.dir * (l % 2 ? -1 : 1));
    }
  }

  // Copies fill the loop so it never shows a gap. They stay clickable but
  // are hidden from screen readers and the tab order.
  function addCopies(track, group, count) {
    for (var k = 0; k < count; k++) {
      group.forEach(function (el) {
        var copy = el.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.querySelectorAll('a, button').forEach(function (c) { c.tabIndex = -1; });
        track.appendChild(copy);
      });
    }
  }

  function drift(lane, track, group, BASE) {
    var setW = 0;
    var x = 0;
    var speed = BASE;
    var target = BASE;
    var drag = null;
    var moved = 0;
    var visible = true;
    var copies = 0;

    function measure() {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      setW = group.reduce(function (w, el) { return w + el.offsetWidth + gap; }, 0);
      if (!setW) return;
      var need = Math.ceil(Math.max(window.innerWidth, screen.width) / setW) + 2;
      if (need > copies) {
        addCopies(track, group, need - copies);
        copies = need;
      }
      if (!x) x = -setW;
    }
    measure();
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(measure, 120);
    });

    lane.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse' || !e.target.closest('.cr')) return;
      target = 0;
      lane.classList.add('is-hover');
    });
    lane.addEventListener('pointerleave', function () {
      target = BASE;
      lane.classList.remove('is-hover');
    });
    lane.addEventListener('focusin', function () { target = 0; });
    lane.addEventListener('focusout', function () { target = BASE; });

    lane.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      drag = { last: e.clientX, t: performance.now(), v: 0 };
      moved = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.last;
      var now = performance.now();
      moved += Math.abs(dx);
      if (moved > 6 && !lane.classList.contains('is-dragging')) {
        lane.classList.add('is-dragging');
        if (lane.setPointerCapture) lane.setPointerCapture(e.pointerId);
      }
      x += dx;
      drag.v = dx / Math.max(1, now - drag.t) * 1000;
      drag.last = e.clientX;
      drag.t = now;
    });
    function release() {
      if (!drag) return;
      if (lane.classList.contains('is-dragging')) speed = -drag.v;
      lane.classList.remove('is-dragging');
      drag = null;
    }
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    // A drag never counts as a click.
    lane.addEventListener('click', function (e) {
      if (moved > 6) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }).observe(lane);
    }

    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // The section has no width while the lock screen hides the page.
      if (!setW) measure();
      if (visible && setW && !document.hidden) {
        if (!drag) {
          var fast = Math.abs(speed) > Math.abs(BASE) * 1.5;
          speed += (target - speed) * Math.min(1, dt * (fast ? 2.2 : 3.5));
          x -= speed * dt;
        }
        while (x <= -setW * 2) x += setW;
        while (x > -setW) x -= setW;
        track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  SECTIONS.forEach(setup);
})();
