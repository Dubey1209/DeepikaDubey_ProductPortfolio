(function () {
  var mount = document.getElementById('story-book-mount');
  if (!mount) return;

  var sourceChapters = document.querySelectorAll('.story-chapter');
  if (!sourceChapters.length) return;

  document.documentElement.classList.add('has-story-book');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AUTO_MS = 10000;
  var LAST_MS = 8000;
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];

  function fitSize() {
    var vh = window.innerHeight || 800;
    var vw = window.innerWidth || 1200;
    var avail = Math.min(vw, (mount && mount.clientWidth) || vw);
    var chrome = vw < 700 ? 168 : 172;
    var h = Math.round(Math.max(320, Math.min(480, vh - chrome)));
    var spread = vw >= 900 && avail >= 700;
    if (spread) {
      var maxBook = Math.min(avail - 24, 1080);
      var pageW = Math.floor(maxBook / 2);
      pageW = Math.max(300, Math.min(pageW, Math.round(h * 0.84)));
      return { width: pageW, height: h, spread: true, stageW: pageW * 2 };
    }
    var pad = vw < 700 ? 28 : 40;
    var w = Math.round(h * 0.72);
    if (w > avail - pad) {
      w = Math.max(240, avail - pad);
      h = Math.round(w / 0.72);
    }
    return { width: w, height: h, spread: false, stageW: w };
  }

  var size = fitSize();
  var CPL = size.width < 320 ? 38 : size.width < 400 ? 46 : 54;
  var PAGE_LINES = Math.max(5, Math.floor((size.height - 128) / 26));
  var TOC_PER_PAGE = Math.max(6, PAGE_LINES - 2);

  var flip = null;
  var autoTimer = null;
  var hovered = false;
  var turning = false;
  var pageMeta = [];
  var chapterStart = [];

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function lineCount(text) {
    var t = String(text || '').trim();
    if (!t) return 0;
    return Math.max(1, Math.ceil(t.length / CPL));
  }

  function sentences(text) {
    var parts = String(text || '').match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    return parts ? parts.map(function (p) { return p.trim(); }).filter(Boolean) : [text];
  }

  // The mascot from the home page, cut down to an arched window. Cells count
  // across her 3×3 sheets; `react` takes the face from the expressions sheet
  // instead of the gaze sheet.
  function cellAt(n) {
    return (n % 3) * 50 + '% ' + Math.floor(n / 3) * 50 + '%';
  }

  function cameo(cls, cell, react, face) {
    return '<span class="sb-cameo ' + cls + '" aria-hidden="true">' +
      '<span class="sb-cameo-window">' +
        '<i class="sb-cameo-art is-look' + (react ? ' is-react' : '') + '" style="background-position:' + cellAt(cell) + '"></i>' +
        '<i class="sb-cameo-art is-face is-react"' + (face != null ? ' style="background-position:' + cellAt(face) + '"' : '') + '></i>' +
      '</span>' +
    '</span>';
  }

  // Her sticker on each chapter's opening page. She arrives with a neutral
  // smile, then pulls the chapter's face; hovering or tapping her gets the
  // second face. [face, second face, scribble]. Faces: 0 eyes closed, 1 wink,
  // 2 grin, 3 gasp, 4 giggle, 5 shy, 6 starry, 7 thinking, 8 unimpressed.
  var MOODS = [
    [3, 6, 'wait, what?!'], [6, 2, 'best. day.'], [2, 4, 'hehe'], [4, 1, 'lol, true'],
    [1, 2, 'between us'], [7, 6, 'hmm… oh!'], [2, 6, 'yay!'], [5, 4, 'eep'],
    [4, 2, 'haha'], [7, 1, 'plot twist'], [8, 4, 'really?'], [0, 2, 'deep breath'],
    [6, 4, 'look at that'], [1, 6, 'more soon']
  ];

  // One small found object per text page, so no two neighbours look alike.
  var KEEPSAKES = ['sb-k-clip', 'sb-k-tape', 'sb-k-stamp', 'sb-k-fold'];
  var CLIP = '<svg class="sb-keep sb-k-clip" viewBox="0 0 24 64" aria-hidden="true"><path d="M8 20V8a4 4 0 0 1 8 0v40a8 8 0 0 1-16 0V14"/></svg>';
  var TAPES = ['is-tape-a', 'is-tape-b', 'is-tape-c', 'is-tape-d'];
  var SQUIGGLE = '<svg class="sb-squiggle" viewBox="0 0 120 14" aria-hidden="true"><path pathLength="1" d="M3 8c8-6 14 6 22 0s14-6 22 0 14 6 22 0 14-6 22 0 14 6 26-1"/></svg>';

  // Pencil doodles for the white space at the foot of a short page.
  var DOODLES = [
    // paper plane and its looping trail
    '<path d="M6 24 44 8 30 40l-8-11Z"/><path d="M22 29 44 8"/><path stroke-dasharray="2 4" d="M4 44c6-2 10-6 8-10s-8-2-6 3"/>',
    // lightbulb
    '<path d="M24 6c-8 0-13 6-13 13 0 5 3 8 6 11 1 1 2 3 2 5h10c0-2 1-4 2-5 3-3 6-6 6-11 0-7-5-13-13-13Z"/><path d="M19 39h10M20 43h8M24 2v-1M9 9l-2-2M39 9l2-2"/>',
    // a star with sparkle ticks
    '<path d="m24 6 5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1Z"/><path d="M42 4l2 4M6 40l-3 3M44 40l2 2"/>',
    // heart, drawn twice like a pen going round again
    '<path d="M24 41S6 30 6 18c0-6 5-10 10-10 4 0 7 2 8 5 1-3 4-5 8-5 5 0 10 4 10 10 0 12-18 23-18 23Z"/><path d="M24 38S9 29 9 18c0-4 3-7 7-7"/>',
    // spiral of thought
    '<path d="M24 24c0-3-4-3-4 0 0 5 8 5 8 0 0-8-12-8-12 0 0 11 16 11 16 0 0-14-20-14-20 0 0 17 24 17 24 0"/>',
  ];

  function linesIn(html) {
    var total = 0;
    html.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, function (m, inner) {
      total += Math.max(1, lineCount(inner.replace(/<[^>]+>/g, '')));
      return m;
    });
    return total;
  }

  function doodle(n) {
    return '<svg class="sb-doodle' + (n % 2 ? ' is-left' : '') + '" viewBox="0 0 48 48" aria-hidden="true">' + DOODLES[n % DOODLES.length] + '</svg>';
  }

  var ARROW = '<svg viewBox="0 0 40 30" aria-hidden="true"><path pathLength="1" d="M37 4C27 2 15 6 9 17c-1 2-2 5-2 8m0 0-4-6m4 6 5-4"/></svg>';

  function sheet(html, attrs) {
    attrs = attrs || {};
    var el = document.createElement('article');
    el.className = 'wb-sheet' + (attrs.cover ? ' sb-cover' : '') + (attrs.cls ? ' ' + attrs.cls : '');
    el.innerHTML = html;
    return el;
  }

  function packBlocks(blocks, startHtml, startLines) {
    var pages = [];
    var buf = startHtml || '';
    var used = startLines || 0;

    function flush() {
      if (buf) pages.push(buf);
      buf = '';
      used = 0;
    }

    function push(html, lines) {
      if (used && used + lines > PAGE_LINES) flush();
      buf += html;
      used += lines;
    }

    blocks.forEach(function (block) {
      if (block.lines <= PAGE_LINES - used || !used) {
        if (block.lines > PAGE_LINES && used) flush();
        if (block.lines > PAGE_LINES) {
          var bits = sentences(block.text);
          var chunk = '';
          var chunkLines = 0;
          bits.forEach(function (bit) {
            var add = lineCount(bit);
            if (chunkLines && chunkLines + add > PAGE_LINES) {
              push('<p class="wb-line">' + esc(chunk.trim()) + '</p>', chunkLines);
              flush();
              chunk = bit + ' ';
              chunkLines = add;
            } else {
              chunk += bit + ' ';
              chunkLines += add;
            }
          });
          if (chunk.trim()) push('<p class="wb-line">' + esc(chunk.trim()) + '</p>', Math.max(1, chunkLines));
          return;
        }
        push(block.html, block.lines);
        return;
      }
      flush();
      push(block.html, block.lines);
    });

    if (buf) pages.push(buf);
    return pages.length ? pages : [startHtml || ''];
  }

  function blocksFrom(copy) {
    var blocks = [];
    Array.prototype.forEach.call(copy.children, function (node) {
      if (node.matches('h2')) return;
      if (node.matches('.story-clock')) {
        blocks.push({
          html: '<p class="wb-kicker">' + esc(textOf(node)) + '</p>',
          lines: 1,
          text: textOf(node)
        });
        return;
      }
      if (node.matches('.story-clock-label')) {
        var label = textOf(node);
        blocks.push({ html: '<p class="wb-pull">' + esc(label) + '</p>', lines: lineCount(label), text: label });
        return;
      }
      if (node.matches('blockquote')) {
        var quote = textOf(node);
        blocks.push({ html: '<p class="wb-pull"><mark>' + esc(quote) + '</mark></p>', lines: lineCount(quote) + 1, text: quote });
        return;
      }
      if (node.matches('ul')) {
        Array.prototype.forEach.call(node.querySelectorAll('li'), function (li) {
          var t = textOf(li);
          blocks.push({ html: '<p class="wb-line"><span class="wb-run">Beat.</span> ' + esc(t) + '</p>', lines: lineCount(t), text: t });
        });
        return;
      }
      if (node.matches('aside')) {
        Array.prototype.forEach.call(node.querySelectorAll('p'), function (p) {
          var t = textOf(p);
          blocks.push({ html: '<p class="wb-line">' + esc(t) + '</p>', lines: lineCount(t), text: t });
        });
        return;
      }
      if (node.matches('p')) {
        var t = textOf(node);
        if (!t) return;
        blocks.push({ html: '<p class="wb-line">' + esc(t) + '</p>', lines: lineCount(t), text: t });
      }
    });
    return blocks;
  }

  var chapters = [];
  Array.prototype.forEach.call(sourceChapters, function (ch, i) {
    var copy = ch.querySelector('.story-chapter-copy') || ch;
    chapters.push({
      num: textOf(ch.querySelector('.story-num')) || String(i + 1).padStart(2, '0'),
      title: textOf(copy.querySelector('h2')),
      roman: ROMAN[i] || String(i + 1),
      blocks: blocksFrom(copy)
    });
  });

  var act = document.querySelector('.story-act');
  var actPage = null;
  if (act) {
    actPage = {
      kicker: textOf(act.querySelector('.atelier-label')),
      title: textOf(act.querySelector('h2')),
      lines: Array.prototype.map.call(act.querySelectorAll('p:not(.atelier-label)'), function (p) {
        return textOf(p);
      }).filter(Boolean)
    };
  }

  var actPacked = [];
  if (actPage) {
    actPacked = packBlocks(actPage.lines.map(function (line) {
      return { html: '<p class="wb-line">' + esc(line) + '</p>', lines: lineCount(line), text: line };
    }), '', 0);
  }

  var packed = chapters.map(function (ch) {
    return packBlocks(ch.blocks, '', 0);
  });
  var tocCount = Math.ceil(chapters.length / TOC_PER_PAGE);
  var folio = 1 + tocCount;
  var startPages = [];
  chapters.forEach(function (ch, i) {
    if (actPage && i === 9) folio += 1 + Math.max(1, actPacked.length);
    startPages[i] = folio;
    folio += 1 + Math.max(1, packed[i].length);
  });

  var sheets = [];
  var printed = 1;

  sheets.push(sheet(
    '<div class="wb-write">' +
      '<div class="sb-cover-inner">' +
        '<i class="sb-band" aria-hidden="true"></i>' +
        '<p class="sb-cover-vol" aria-hidden="true">vol. I</p>' +
        '<div class="sb-label">' +
          '<p class="sb-cover-kicker">The long version</p>' +
          '<h3 class="sb-cover-title"><span>Wanna know me</span><span>beyond resume?</span></h3>' +
          '<p class="sb-label-by">a journal by Deepika</p>' +
        '</div>' +
        '<div class="sb-cover-portrait">' +
          cameo('is-cover is-sticker', 4, false) +
          '<p class="sb-cover-note" aria-hidden="true"><span>psst,</span><span>that’s me</span>' + ARROW + '</p>' +
        '</div>' +
      '</div>' +
    '</div>',
    { cover: true }
  ));
  pageMeta.push({ kind: 'cover' });

  var tocButtons = chapters.map(function (ch, i) {
    return '<button type="button" class="wb-toc-row" data-chapter="' + i + '">' +
      '<span class="wb-toc-num">' + ch.num + '</span>' +
      '<span class="wb-toc-copy"><span class="wb-toc-title">' + esc(ch.title) + '</span></span>' +
      '<span class="wb-toc-dots" aria-hidden="true"></span>' +
      '<span class="wb-toc-page">' + startPages[i] + '</span>' +
    '</button>';
  });

  for (var t = 0; t < tocButtons.length; t += TOC_PER_PAGE) {
    var slice = tocButtons.slice(t, t + TOC_PER_PAGE).join('');
    var part = tocCount > 1 ? 'Contents ' + (Math.floor(t / TOC_PER_PAGE) + 1) : 'Contents';
    sheets.push(sheet(
      '<div class="wb-write">' +
        '<header class="wb-running"><span>The long version</span><span>' + part + '</span></header>' +
        '<p class="wb-kicker">Front matter</p>' +
        '<h3 class="wb-title">Contents</h3>' +
        (t === 0 ? '<p class="sb-toc-note" aria-hidden="true">start here' + ARROW + '</p>' : '') +
        '<div class="wb-toc">' + slice + '</div>' +
      '</div>' +
      '<footer class="wb-folio">' + printed++ + '</footer>',
      { cls: 'sb-toc-page' }
    ));
    pageMeta.push({ kind: 'index' });
  }

  chapters.forEach(function (ch, chIndex) {
    if (actPage && chIndex === 9) {
      sheets.push(sheet(
        '<div class="wb-write sb-open">' +
          '<p class="sb-open-kicker">' + esc(actPage.kicker || 'Act II') + '</p>' +
          '<p class="sb-open-roman">II</p>' +
          '<h3 class="sb-open-title">' + esc(actPage.title) + '</h3>' +
          SQUIGGLE +
        '</div>' +
        '<footer class="wb-folio">' + printed++ + '</footer>',
        { cls: 'sb-act-page' }
      ));
      pageMeta.push({ kind: 'act' });
      actPacked.forEach(function (body) {
        sheets.push(sheet(
          '<div class="wb-write">' +
            '<header class="wb-running"><span>The long version</span><span>Act II</span></header>' +
            body +
          '</div>' +
          '<footer class="wb-folio">' + printed++ + '</footer>'
        ));
        pageMeta.push({ kind: 'act' });
      });
    }

    chapterStart[chIndex] = sheets.length;
    var mood = MOODS[chIndex] || [2, 4, 'hi'];
    sheets.push(sheet(
      '<div class="wb-write sb-open">' +
        '<span class="sb-open-num" aria-hidden="true">' + ch.num + '</span>' +
        '<p class="sb-open-kicker sb-tape ' + TAPES[chIndex % TAPES.length] + '">Chapter ' + ch.roman + '</p>' +
        '<span class="sb-mood-wrap" data-face="' + mood[0] + '" data-alt="' + mood[1] + '">' +
          cameo('is-sticker is-mood' + (chIndex % 2 ? ' is-tilt-r' : ''), 4, false, mood[0]) +
          '<span class="sb-mood-note' + (chIndex % 2 ? ' is-left' : '') + '" aria-hidden="true">' + esc(mood[2]) + '</span>' +
        '</span>' +
        '<h3 class="sb-open-title">' + esc(ch.title) + '</h3>' +
        SQUIGGLE +
      '</div>' +
      '<footer class="wb-folio">' + printed++ + '</footer>',
      { cls: 'sb-opener' }
    ));
    pageMeta.push({ kind: 'opener', ch: chIndex });

    var lastPage = packed[chIndex].length - 1;
    packed[chIndex].forEach(function (body, pageIndex) {
      var open = '<p class="wb-line">';
      var first = body.charAt(open.length);
      if (pageIndex === 0 && body.indexOf(open) === 0 && /[A-Za-z]/.test(first)) {
        body = '<p class="wb-line"><span class="wb-drop">' + first + '</span>' + body.slice(open.length + 1);
      }
      if (pageIndex === lastPage && /<\/p>$/.test(body)) {
        body = body.slice(0, -4) + '<span class="sb-end-mark" aria-hidden="true"> ✦</span></p>';
      }
      // A chai ring on the odd page, the way a real journal gets used.
      var ring = printed % 9 === 4 ? ' has-ring' : '';
      var room = PAGE_LINES - 1 - linesIn(body) >= 3;
      var keep = KEEPSAKES[printed % KEEPSAKES.length];
      var keepHtml = keep === 'sb-k-clip' ? CLIP :
        keep === 'sb-k-stamp' ? '<span class="sb-keep sb-k-stamp" aria-hidden="true"><b>' + ch.roman + '</b><i>chapter</i></span>' :
        '<span class="sb-keep ' + keep + '" aria-hidden="true"></span>';
      sheets.push(sheet(
        keepHtml +
        '<div class="wb-write">' +
          '<header class="wb-running"><span>Chapter ' + ch.roman + '</span><span>' + esc(ch.title) + '</span></header>' +
          body +
        '</div>' +
        (room && !ring ? doodle(printed) : '') +
        '<footer class="wb-folio">' + printed++ + '</footer>',
        { cls: 'sb-text' + ring + (keep === 'sb-k-stamp' ? '' : ' has-keep-top') }
      ));
      pageMeta.push({ kind: 'chapter', ch: chIndex });
    });
  });

  sheets.push(sheet(
    '<div class="wb-write sb-open">' +
      '<p class="sb-open-kicker sb-tape is-tape-a">The end</p>' +
      '<span class="sb-mood-wrap" data-face="6" data-alt="1">' +
        cameo('is-sticker is-mood', 4, false, 6) +
        '<span class="sb-mood-note" aria-hidden="true">thank you!</span>' +
      '</span>' +
      '<h3 class="sb-open-title">Watch me. I\'m just getting started.</h3>' +
      SQUIGGLE +
      '<button type="button" class="wb-cta" data-chapter="cover">Back to the cover</button>' +
    '</div>' +
    '<footer class="wb-folio">fin</footer>',
    { cls: 'sb-opener sb-end-page' }
  ));
  pageMeta.push({ kind: 'end' });

  if (sheets.length % 2) {
    sheets.push(sheet(
      '<div class="wb-write sb-open">' +
        '<p class="sb-endpaper-note">thanks for reading, truly.</p>' +
      '</div>',
      { cls: 'sb-endpaper' }
    ));
    pageMeta.push({ kind: 'end' });
  }

  mount.innerHTML =
    '<div class="work-book story-book" id="story-book">' +
      '<div class="work-book-stage" id="story-book-stage"></div>' +
      '<div class="work-book-bar">' +
        '<button type="button" class="work-book-nav" data-book="prev" aria-label="Previous page">Prev</button>' +
        '<p class="work-book-status" aria-live="polite">Cover</p>' +
        '<button type="button" class="work-book-nav" data-book="next" aria-label="Next page">Next</button>' +
      '</div>' +
    '</div>';

  var book = mount.querySelector('.work-book');
  var stage = mount.querySelector('.work-book-stage');
  var status = mount.querySelector('.work-book-status');

  function applyShell() {
    book.classList.toggle('is-spread', size.spread);
    book.style.setProperty('--sb-w', size.stageW + 'px');
    book.style.setProperty('--sb-h', size.height + 'px');
    stage.style.width = size.stageW + 'px';
    stage.style.height = size.height + 'px';
  }

  applyShell();
  sheets.forEach(function (el) { stage.appendChild(el); });

  // The cover portrait is alive: she looks toward the pointer, blinks now
  // and then, smiles when the book first comes into view and winks when the
  // pointer reaches her. Gaze cells: row 0 looks up, column 0 to the left.
  (function bindCameo() {
    var fig = stage.querySelector('.sb-cameo.is-cover');
    if (!fig) return;
    var look = fig.querySelector('.is-look');
    var face = fig.querySelector('.is-face');
    var cell = 4;
    var faceTimer = 0;
    var faceOn = false;

    function showFace(n, ms) {
      window.clearTimeout(faceTimer);
      face.style.backgroundPosition = cellAt(n);
      fig.classList.add('is-face-on');
      faceOn = true;
      faceTimer = window.setTimeout(function () {
        fig.classList.remove('is-face-on');
        faceOn = false;
      }, ms);
    }

    (function blinkSoon() {
      window.setTimeout(function () {
        if (cell === 4 && !faceOn && !document.hidden) showFace(0, 150);
        blinkSoon();
      }, 2600 + Math.random() * 3400);
    })();

    document.addEventListener('pointermove', function (e) {
      var r = fig.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height * 0.42);
      var col = dx < -r.width * 0.8 ? 0 : dx > r.width * 0.8 ? 2 : 1;
      var row = dy < -r.height * 0.75 ? 0 : dy > r.height * 0.75 ? 2 : 1;
      var next = row * 3 + col;
      if (next === cell) return;
      cell = next;
      look.style.backgroundPosition = cellAt(next);
    }, { passive: true });

    fig.addEventListener('pointerenter', function () {
      showFace(1, 1100);
    });

    if ('IntersectionObserver' in window) {
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        seen.disconnect();
        window.setTimeout(function () { showFace(2, 1600); }, 700);
      }, { threshold: 0.6 });
      seen.observe(fig);
    }
  })();

  function moodFace(wrap, which) {
    var fig = wrap.querySelector('.sb-cameo');
    var face = wrap.querySelector('.is-face');
    if (!fig || !face) return;
    face.style.backgroundPosition = cellAt(Number(wrap.getAttribute(which)));
    fig.classList.add('is-face-on');
  }

  function wakeMoods() {
    if (!flip) return;
    var i = flip.getCurrentPageIndex();
    sheets.forEach(function (el, idx) {
      var wrap = el.querySelector('.sb-mood-wrap');
      if (!wrap) return;
      var shown = idx === i || (size.spread && idx === i + 1);
      if (!shown) {
        window.clearTimeout(wrap._t);
        wrap.classList.remove('is-live');
        var fig = wrap.querySelector('.sb-cameo');
        if (fig) fig.classList.remove('is-face-on');
        return;
      }
      if (wrap.classList.contains('is-live')) return;
      wrap.classList.add('is-live');
      wrap._t = window.setTimeout(function () { moodFace(wrap, 'data-face'); }, reduce ? 0 : 700);
    });
  }

  book.addEventListener('pointerover', function (e) {
    var wrap = e.target.closest && e.target.closest('.sb-mood-wrap.is-live');
    if (wrap && !wrap.contains(e.relatedTarget)) {
      window.clearTimeout(wrap._t);
      moodFace(wrap, 'data-alt');
      wrap.classList.add('is-boop');
    }
  });

  book.addEventListener('pointerout', function (e) {
    var wrap = e.target.closest && e.target.closest('.sb-mood-wrap.is-live');
    if (wrap && !wrap.contains(e.relatedTarget)) {
      moodFace(wrap, 'data-face');
      wrap.classList.remove('is-boop');
    }
  });

  function paintStatus() {
    if (!flip) return;
    wakeMoods();
    var meta = pageMeta[flip.getCurrentPageIndex()] || {};
    if (meta.kind === 'cover') status.textContent = 'Cover';
    else if (meta.kind === 'index') status.textContent = 'Contents';
    else if (meta.kind === 'act') status.textContent = 'Act II';
    else if (meta.kind === 'end') status.textContent = 'The end';
    else if (meta.kind === 'opener') status.textContent = 'Chapter ' + chapters[meta.ch].num;
    else {
      var ch = chapters[meta.ch];
      status.textContent = 'Chapter ' + ch.num + ' · ' + ch.title;
    }
  }

  function stopAuto() {
    if (autoTimer) {
      window.clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function isLastPage() {
    if (!flip) return false;
    var i = flip.getCurrentPageIndex();
    var n = flip.getPageCount();
    if (size.spread) return i >= n - 2;
    return i >= n - 1;
  }

  function bookInView() {
    var r = book.getBoundingClientRect();
    return r.bottom >= 90 && r.top <= window.innerHeight - 90;
  }

  function goToCover() {
    if (!flip || flip.getCurrentPageIndex() === 0) {
      armAuto();
      return;
    }
    stopAuto();
    if (reduce) {
      flip.turnToPage(0);
      paintStatus();
      armAuto();
      return;
    }
    flip.flip(0, 'bottom');
    window.setTimeout(function () {
      if (!flip) return;
      if (flip.getCurrentPageIndex() !== 0) {
        flip.turnToPage(0);
        paintStatus();
      }
      armAuto();
    }, 1600);
  }

  function armAuto() {
    stopAuto();
    var last = isLastPage();
    autoTimer = window.setTimeout(function () {
      if (!flip || turning || document.hidden || !bookInView()) {
        if (!document.hidden) armAuto();
        return;
      }
      if (isLastPage()) {
        goToCover();
        return;
      }
      if (hovered) {
        armAuto();
        return;
      }
      if (reduce) {
        flip.turnToNextPage();
        paintStatus();
        armAuto();
        return;
      }
      flip.flipNext('top');
    }, last ? LAST_MS : AUTO_MS);
  }

  function step(dir) {
    if (!flip || turning) return;
    var i = flip.getCurrentPageIndex();
    var n = flip.getPageCount();
    if (dir === 'next' && (i >= n - 1 || isLastPage())) return;
    if (dir === 'prev' && i <= 0) return;
    stopAuto();
    if (reduce) {
      if (dir === 'next') flip.turnToNextPage();
      else flip.turnToPrevPage();
      paintStatus();
      armAuto();
      return;
    }
    if (dir === 'next') flip.flipNext('top');
    else flip.flipPrev('top');
    window.setTimeout(function () {
      if (!flip || turning) return;
      if (flip.getCurrentPageIndex() !== i) return;
      if (dir === 'next') flip.turnToNextPage();
      else flip.turnToPrevPage();
      paintStatus();
    }, 1700);
  }

  function goToPage(index) {
    if (!flip) return;
    var max = flip.getPageCount() - 1;
    var target = Math.max(0, Math.min(index, max));
    if (target === flip.getCurrentPageIndex()) return;
    stopAuto();
    if (reduce) flip.turnToPage(target);
    else flip.flip(target, 'bottom');
    armAuto();
  }

  function goToChapter(index) {
    if (index === 'cover' || index === 'index') {
      goToPage(index === 'cover' ? 0 : 1);
      return;
    }
    var start = chapterStart[Number(index)];
    if (typeof start === 'number') goToPage(start);
  }

  function bindFlip() {
    if (!flip) return;
    flip.on('flip', function () {
      turning = false;
      paintStatus();
      armAuto();
    });
    flip.on('changeState', function (e) {
      var state = e && e.data;
      turning = state === 'flipping' || state === 'user_fold';
      if (turning) stopAuto();
      if (state === 'read') armAuto();
    });
    flip.on('init', function () {
      paintStatus();
      armAuto();
    });
  }

  function createFlip(startPage) {
    var Ctor = window.St && window.St.PageFlip;
    if (!Ctor) return false;
    if (flip) {
      try { startPage = flip.getCurrentPageIndex(); } catch (err) {}
      // destroy() removes the stage element itself, which used to leave the
      // book blank after a resize: move the pages to a fresh stage first.
      var fresh = document.createElement('div');
      fresh.className = 'work-book-stage';
      fresh.id = 'story-book-stage';
      stage.parentNode.insertBefore(fresh, stage);
      sheets.forEach(function (el) {
        el.removeAttribute('style');
        el.classList.remove('stf__item', '--left', '--right', '--simple', '--hard', '--soft');
        fresh.appendChild(el);
      });
      try { flip.destroy(); } catch (err2) {}
      if (stage.parentNode) stage.parentNode.removeChild(stage);
      stage = fresh;
      flip = null;
      applyShell();
    }
    turning = false;
    sheets.forEach(function (el) {
      if (el.parentNode !== stage) stage.appendChild(el);
    });
    flip = new Ctor(stage, {
      width: size.width,
      height: size.height,
      size: 'fixed',
      minWidth: size.width,
      maxWidth: size.width,
      minHeight: size.height,
      maxHeight: size.height,
      drawShadow: true,
      flippingTime: reduce ? 1 : 1400,
      usePortrait: true,
      startZIndex: 2,
      autoSize: false,
      maxShadowOpacity: size.spread ? 0.6 : 0.35,
      showCover: false,
      mobileScrollSupport: true,
      swipeDistance: 24,
      clickEventForward: true,
      useMouseEvents: true,
      showPageCorners: !!size.spread,
      disableFlipByClick: false,
      startPage: startPage || 0
    });
    flip.loadFromHTML(stage.querySelectorAll('.wb-sheet'));
    bindFlip();
    if (startPage) {
      try { flip.turnToPage(startPage); } catch (err3) {}
    }
    return true;
  }

  function boot(tries) {
    if (!(window.St && window.St.PageFlip)) {
      if ((tries || 0) < 40) window.setTimeout(function () { boot((tries || 0) + 1); }, 50);
      return;
    }
    createFlip(0);
  }

  book.querySelectorAll('[data-book]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      step(btn.getAttribute('data-book') === 'next' ? 'next' : 'prev');
    });
  });

  book.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-book]');
    if (nav && flip) {
      e.preventDefault();
      e.stopPropagation();
      step(nav.getAttribute('data-book') === 'next' ? 'next' : 'prev');
      return;
    }
    var toc = e.target.closest('[data-chapter]');
    if (toc) goToChapter(toc.getAttribute('data-chapter'));
  });

  document.addEventListener('keydown', function (e) {
    if (!flip || !book.offsetParent) return;
    var r = book.getBoundingClientRect();
    if (r.bottom < 80 || r.top > window.innerHeight - 80) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step('next');
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step('prev');
    }
  });

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    book.addEventListener('mouseenter', function () {
      hovered = true;
      if (!isLastPage()) stopAuto();
    });
    book.addEventListener('mouseleave', function () {
      hovered = false;
      armAuto();
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopAuto();
    else armAuto();
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0] && entries[0].isIntersecting) armAuto();
      else stopAuto();
    }, { threshold: 0.28 });
    io.observe(book);
  }

  var resizeTimer = null;
  var lastVW = window.innerWidth;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      // Phones fire resize whenever the address bar slides in or out; only a
      // real change of width (rotation, window resize) rebuilds the book.
      if (window.innerWidth === lastVW) return;
      lastVW = window.innerWidth;
      var next = fitSize();
      var modeChanged = next.spread !== size.spread;
      var sizeChanged = Math.abs(next.width - size.width) > 12 || Math.abs(next.height - size.height) > 40;
      if (!modeChanged && !sizeChanged) return;
      var page = flip ? flip.getCurrentPageIndex() : 0;
      size = next;
      applyShell();
      createFlip(page);
      paintStatus();
      armAuto();
    }, 220);
  });

  boot(0);
})();
