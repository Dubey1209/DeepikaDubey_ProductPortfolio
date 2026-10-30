// Phone modes for three card stacks (styles in atelier.css, max-width 640px):
//   About     -> a deck of notes: swipe or tap the top one away.
//   Skills    -> tabs that play through the categories on their own.
//   Fun facts -> stories: tap right / left, hold to pause.
// Auto-play is a CSS fill animation; its animationend moves things along, so
// it pauses for free when off screen, held, or under reduced motion.
(function () {
  'use strict';

  var SWIPE = 48;

  function watch(target, flag) {
    if (!('IntersectionObserver' in window)) { flag.classList.add('is-live'); return; }
    new IntersectionObserver(function (entries) {
      flag.classList.toggle('is-live', entries[0].isIntersecting);
    }, { threshold: 0.45 }).observe(target);
  }

  // Horizontal drag helper that leaves vertical scrolling to the browser.
  function drag(el, on) {
    var x0 = 0, y0 = 0, dx = 0, active = false, sideways = false;
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      active = true; sideways = false; dx = 0;
      x0 = e.clientX; y0 = e.clientY;
      if (on.start) on.start(e);
    });
    el.addEventListener('pointermove', function (e) {
      if (!active) return;
      dx = e.clientX - x0;
      if (!sideways && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) sideways = true;
      if (sideways && on.move) on.move(dx);
    });
    function end(e, cancelled) {
      if (!active) return;
      active = false;
      if (on.end) on.end(cancelled ? 0 : dx, !cancelled && !sideways && Math.abs(dx) < 8, e);
    }
    el.addEventListener('pointerup', function (e) { end(e, false); });
    el.addEventListener('pointercancel', function (e) { end(e, true); });
    el.addEventListener('pointerleave', function (e) { if (active && e.pointerType === 'mouse') end(e, false); });
  }

  function deck(list) {
    var cards = Array.prototype.slice.call(list.children);
    if (cards.length < 2) return;
    list.classList.add('m-deck');

    var foot = document.createElement('div');
    foot.className = 'm-deck-foot';
    foot.setAttribute('aria-hidden', 'true');
    var dots = document.createElement('span');
    dots.className = 'm-deck-dots';
    cards.forEach(function () { dots.appendChild(document.createElement('span')).appendChild(document.createElement('i')); });
    var hint = document.createElement('span');
    hint.textContent = 'Swipe or tap the note';
    foot.appendChild(dots);
    foot.appendChild(hint);
    list.insertAdjacentElement('afterend', foot);

    var order = cards.map(function (_, i) { return i; });
    var busy = false;

    function paint() {
      order.forEach(function (ci, pos) { cards[ci].setAttribute('data-pos', Math.min(pos, 3)); });
      Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle('is-on', i === order[0]); });
    }

    function next(dir) {
      if (busy) return;
      busy = true;
      var top = cards[order[0]];
      top.classList.remove('is-dragging');
      top.style.setProperty('--fly', dir < 0 ? -1 : 1);
      top.classList.add('is-leaving');
      setTimeout(function () {
        order.push(order.shift());
        top.classList.remove('is-leaving');
        top.style.removeProperty('--dx');
        top.style.removeProperty('--rot');
        paint();
        busy = false;
      }, 380);
    }

    drag(list, {
      start: function () { foot.classList.add('is-held'); },
      move: function (dx) {
        var top = cards[order[0]];
        top.classList.add('is-dragging');
        top.style.setProperty('--dx', dx + 'px');
        top.style.setProperty('--rot', (dx / 18) + 'deg');
      },
      end: function (dx, tap) {
        foot.classList.remove('is-held');
        var top = cards[order[0]];
        if (tap || Math.abs(dx) > SWIPE) {
          foot.classList.add('is-manual');
          next(dx < 0 ? -1 : 1);
        } else {
          top.classList.remove('is-dragging');
          top.style.removeProperty('--dx');
          top.style.removeProperty('--rot');
        }
      },
    });

    foot.addEventListener('animationend', function () { next(1); });
    watch(list, foot);
    paint();
  }

  function tabs(grid) {
    var cards = Array.prototype.filter.call(grid.children, function (c) { return c.tagName === 'ARTICLE'; });
    if (cards.length < 2) return;
    grid.classList.add('m-tabs');

    var bar = document.createElement('div');
    bar.className = 'm-tabs-bar';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Skill categories');
    var buttons = cards.map(function (card, i) {
      var title = card.querySelector('h3');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.style.setProperty('--sk', card.style.getPropertyValue('--sk'));
      b.appendChild(document.createTextNode(title ? title.textContent.trim() : 'Skills ' + (i + 1)));
      b.appendChild(document.createElement('i'));
      b.addEventListener('click', function () { bar.classList.add('is-manual'); show(i); });
      bar.appendChild(b);
      return b;
    });
    grid.insertAdjacentElement('beforebegin', bar);

    var current = -1;
    function show(i) {
      i = (i + cards.length) % cards.length;
      if (i === current) return;
      var from = i > current ? 1 : -1;
      cards.forEach(function (c, k) {
        c.style.setProperty('--from', from);
        c.classList.toggle('is-on', k === i);
      });
      buttons.forEach(function (b, k) {
        b.classList.toggle('is-on', k === i);
        b.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      var b = buttons[i];
      bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: current < 0 ? 'auto' : 'smooth' });
      current = i;
    }

    drag(grid, {
      end: function (dx) {
        if (Math.abs(dx) > SWIPE) { bar.classList.add('is-manual'); show(current + (dx < 0 ? 1 : -1)); }
      },
    });

    bar.addEventListener('animationend', function () { show(current + 1); });
    watch(grid, bar);
    show(0);
  }

  function stories(wrap) {
    var cards = Array.prototype.slice.call(wrap.children);
    if (cards.length < 2) return;
    wrap.classList.add('m-stories');

    var bars = document.createElement('div');
    bars.className = 'm-story-bars';
    bars.setAttribute('aria-hidden', 'true');
    cards.forEach(function () { bars.appendChild(document.createElement('span')).appendChild(document.createElement('i')); });
    wrap.insertAdjacentElement('beforebegin', bars);

    var hint = document.createElement('p');
    hint.className = 'm-story-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Tap for the next one · hold to pause';
    wrap.insertAdjacentElement('afterend', hint);

    var current = 0;
    function show(i) {
      current = (i + cards.length) % cards.length;
      cards.forEach(function (c, k) { c.classList.toggle('is-on', k === current); });
      Array.prototype.forEach.call(bars.children, function (s, k) {
        s.classList.toggle('is-done', k < current);
        s.classList.remove('is-on');
      });
      // Re-adding on the next frame restarts the fill even on the same bar.
      requestAnimationFrame(function () { bars.children[current].classList.add('is-on'); });
    }

    var holdTimer = 0;
    function release() {
      clearTimeout(holdTimer);
      var wasHeld = wrap.classList.contains('is-held');
      wrap.classList.remove('is-held');
      bars.classList.remove('is-held');
      return wasHeld;
    }

    drag(wrap, {
      start: function () {
        holdTimer = setTimeout(function () {
          wrap.classList.add('is-held');
          bars.classList.add('is-held');
        }, 220);
      },
      move: function () { clearTimeout(holdTimer); },
      end: function (dx, tap, e) {
        var held = release();
        if (Math.abs(dx) > SWIPE) { show(current + (dx < 0 ? 1 : -1)); return; }
        if (!tap || held) return;
        var box = wrap.getBoundingClientRect();
        show(current + ((e.clientX - box.left) < box.width * 0.33 ? -1 : 1));
      },
    });

    bars.addEventListener('animationend', function () { show(current + 1); });
    watch(wrap, bars);
    show(0);
  }

  function init() {
    var notes = document.querySelector('.atelier-about-notes');
    var skills = document.querySelector('.atelier-skills-grid');
    var facts = document.querySelector('.atelier-notes');
    if (notes) deck(notes);
    if (skills) tabs(skills);
    if (facts) stories(facts);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
