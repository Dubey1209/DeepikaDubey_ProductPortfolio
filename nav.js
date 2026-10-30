// Desktop navbar (styles in atelier.css, min-width 801px): a soft pill
// slides behind whichever link the pointer is on and rests on the section
// being read; the capsule firms up once the page has scrolled.
(function () {
  'use strict';

  var list = document.querySelector('.navbar .nav-links');
  if (!list) return;

  var desktop = window.matchMedia('(min-width: 801px)');
  var pill = document.createElement('li');
  pill.className = 'nav-pill';
  pill.setAttribute('aria-hidden', 'true');
  list.insertBefore(pill, list.firstChild);

  var tops = Array.prototype.filter.call(list.querySelectorAll(':scope > li > a'), function (a) {
    return !a.closest('.nav-cta');
  });
  var current = null;

  function visible(a) {
    return a.offsetParent !== null && a.getClientRects().length > 0;
  }

  function place(a) {
    if (!desktop.matches || !a || !visible(a)) {
      pill.classList.remove('is-on');
      return;
    }
    var box = list.getBoundingClientRect();
    var r = a.getBoundingClientRect();
    pill.style.setProperty('--x', (r.left - box.left) + 'px');
    pill.style.setProperty('--y', (r.top - box.top) + 'px');
    pill.style.setProperty('--w', r.width + 'px');
    pill.style.setProperty('--h', r.height + 'px');
    pill.classList.add('is-on');
  }

  // The visible top-level link for a section: its own link, or the
  // dropdown (Work, More) that holds it.
  function linkFor(id) {
    var hash = '#' + id;
    for (var i = 0; i < tops.length; i++) {
      var a = tops[i];
      if (!visible(a)) continue;
      if (a.getAttribute('href') === hash) return a;
      var menu = a.parentElement.querySelector('.dropdown-content');
      if (menu && menu.querySelector('a[href="' + hash + '"]')) return a;
    }
    var cta = list.querySelector('.nav-cta a[href="' + hash + '"]');
    return cta || null;
  }

  function setCurrent(a) {
    if (a === current) return;
    if (current) current.classList.remove('is-current');
    current = a;
    if (current) current.classList.add('is-current');
    if (!list.matches(':hover')) place(current && !current.closest('.nav-cta') ? current : null);
  }

  list.addEventListener('mouseover', function (e) {
    var a = e.target.closest('a');
    if (!a || tops.indexOf(a) < 0) return;
    place(a);
  });
  list.addEventListener('mouseleave', function () {
    place(current && !current.closest('.nav-cta') ? current : null);
  });
  list.addEventListener('focusin', function (e) {
    if (tops.indexOf(e.target) >= 0) place(e.target);
  });

  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));
  var shown = new Map();
  if ('IntersectionObserver' in window && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { shown.set(en.target, en.isIntersecting); });
      var active = null;
      for (var i = 0; i < sections.length; i++) {
        if (shown.get(sections[i])) { active = sections[i]; break; }
      }
      setCurrent(active && active.id !== 'home' ? linkFor(active.id) : null);
    }, { rootMargin: '-42% 0px -55% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  var scrolled = null;
  function onScroll() {
    var is = window.scrollY > 24;
    if (is === scrolled) return;
    scrolled = is;
    document.body.classList.toggle('nav-scrolled', is);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // On desktop the reading-progress line (motion.js) becomes the navbar's
  // bottom edge, so it hides and returns with the bar.
  function dockProgress() {
    var bar = document.querySelector('.scroll-progress');
    var nav = document.querySelector('.navbar');
    if (!bar || !nav) return;
    var home = desktop.matches ? nav : document.body;
    if (bar.parentElement !== home) home.appendChild(bar);
  }
  dockProgress();
  window.addEventListener('load', dockProgress);

  function refresh() {
    dockProgress();
    place(current && !current.closest('.nav-cta') ? current : null);
  }
  window.addEventListener('resize', refresh);
  if (desktop.addEventListener) desktop.addEventListener('change', refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
})();
