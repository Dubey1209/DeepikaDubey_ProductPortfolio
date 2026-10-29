// Mobile Navigation
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const drawerOverlay = document.querySelector('.drawer-overlay');
const drawerCloseBtn = document.querySelector('.drawer-close-btn');
const dropdownToggles = document.querySelectorAll('.dropdown > a');
let isMenuOpen = false;

function toggleMenu() {
  isMenuOpen = !isMenuOpen;
  navLinks.classList.toggle('open', isMenuOpen);
  document.body.style.overflow = isMenuOpen ? 'hidden' : '';
  document.body.classList.toggle('menu-open', isMenuOpen);
  if (window.atelierLenis) window.atelierLenis[isMenuOpen ? 'stop' : 'start']();

  if (drawerOverlay) {
    drawerOverlay.classList.toggle('visible', isMenuOpen);
  }

  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', isMenuOpen);
  }

  if (!isMenuOpen) {
    document.querySelectorAll('.dropdown-content').forEach((dropdown) => {
      dropdown.classList.remove('show');
    });
    dropdownToggles.forEach((toggle) => {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }
}

function closeMenu() {
  const wasOpen = isMenuOpen;
  isMenuOpen = false;
  if (!navLinks) return;
  navLinks.classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('menu-open');
  if (wasOpen && window.atelierLenis) window.atelierLenis.start();

  if (drawerOverlay) {
    drawerOverlay.classList.remove('visible');
  }

  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'false');
  }
}

function toggleDropdown(e) {
  if (window.innerWidth <= 800) {
    e.preventDefault();
    const dropdown = this.nextElementSibling;
    if (!dropdown) return;
    const isOpen = !dropdown.classList.contains('show');

    document.querySelectorAll('.dropdown-content').forEach((item) => {
      item.classList.remove('show');
    });

    if (isOpen) {
      dropdown.classList.add('show');
      this.setAttribute('aria-expanded', 'true');

      const handleClickOutside = (event) => {
        if (!event.target.closest('.dropdown')) {
          dropdown.classList.remove('show');
          this.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', handleClickOutside);
        }
      };

      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    } else {
      this.setAttribute('aria-expanded', 'false');
    }
  }
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }

  navLinks.querySelectorAll('a:not(.dropdown > a)').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 800) {
        closeMenu();
      }
    });
  });

  dropdownToggles.forEach((toggle) => {
    toggle.addEventListener('click', toggleDropdown);
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDropdown.call(toggle, e);
      } else if (e.key === 'Escape') {
        const dropdown = toggle.nextElementSibling;
        if (dropdown) dropdown.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isMenuOpen) {
    closeMenu();
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth > 800) {
      closeMenu();
      document.querySelectorAll('.dropdown-content').forEach((dropdown) => {
        dropdown.classList.remove('show');
      });
    }
  }, 250);
});

// One scroller: while Lenis runs, a native smooth scroll fights its own
// interpolation and stutters. Lenis ignores scroll-margin, so it is passed
// in as the offset.
function atelierScrollTo(target) {
  const lenis = window.atelierLenis;
  if (target === 0) {
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (lenis) {
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    lenis.scrollTo(target, { offset: -margin });
  } else {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-loaded');

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#' || targetId.length <= 1) return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      atelierScrollTo(target);
    });
  });

  // The back-to-top button appears only once there is somewhere to go back
  // to, and steps aside while the menu drawer is open.
  const topBtn = document.querySelector('.scroll-top-btn');
  if (topBtn) {
    topBtn.addEventListener('click', () => atelierScrollTo(0));
    let topTicking = false;
    const syncTopBtn = () => {
      topTicking = false;
      topBtn.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.9);
    };
    window.addEventListener('scroll', () => {
      if (topTicking) return;
      topTicking = true;
      requestAnimationFrame(syncTopBtn);
    }, { passive: true });
    syncTopBtn();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initExperienceShowcase();
});

// The roles themselves are plain HTML in #atelier-exp (index.html); this only
// runs the accordion, one role open at a time.
function initExperienceShowcase() {
  var root = document.getElementById('atelier-exp');
  if (!root) return;

  root.querySelectorAll('.atelier-exp-item').forEach(function (item) {
    var btn = item.querySelector('.atelier-exp-row');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      var mark = e.target.closest('.atelier-exp-mark[data-href]');
      if (mark) {
        window.open(mark.getAttribute('data-href'), '_blank', 'noopener');
        return;
      }
      var wasOpen = item.classList.contains('is-open');
      root.querySelectorAll('.atelier-exp-item').forEach(function (other) {
        other.classList.remove('is-open');
        var otherBtn = other.querySelector('.atelier-exp-row');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

(function () {
  var modal = document.getElementById('work-modal');
  if (!modal) return;

  var titleEl = modal.querySelector('.work-modal-title');
  var tagsEl = modal.querySelector('.work-modal-tags');
  var hookEl = modal.querySelector('.work-modal-hook');
  var bodyEl = modal.querySelector('.work-modal-body');
  var actionsEl = modal.querySelector('.work-modal-actions');
  var lastFocus = null;

  function closeWorkModal() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');
    document.body.classList.remove('work-modal-open');
    if (window.atelierLenis) window.atelierLenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // Tab and Shift+Tab cycle inside the sheet while it is open.
  function trapFocus(e) {
    if (e.key !== 'Tab' || !modal.classList.contains('is-open')) return;
    var focusable = Array.prototype.filter.call(
      modal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null; }
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  }

  function openWorkModal(card) {
    lastFocus = document.activeElement;
    var title = card.querySelector('.case-study-title, .project-title');
    var meta = card.querySelector('.project-meta');
    var hook = card.querySelector('.project-hook');
    var more = card.querySelector('.project-more-content');
    var actions = card.querySelector('.project-buttons');

    titleEl.textContent = title ? title.textContent.trim() : '';
    tagsEl.innerHTML = meta ? meta.innerHTML : '';
    hookEl.textContent = hook ? hook.textContent.trim() : '';
    bodyEl.innerHTML = more ? more.innerHTML : '';
    actionsEl.innerHTML = actions ? actions.innerHTML : '';

    modal.removeAttribute('hidden');
    modal.classList.add('is-open');
    document.body.classList.add('work-modal-open');
    if (window.atelierLenis) window.atelierLenis.stop();
    var closeBtn = modal.querySelector('.work-modal-close');
    if (closeBtn) closeBtn.focus();
  }

  document
    .querySelectorAll('.case-studies-section .project-card, .projects-section .project-card')
    .forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        openWorkModal(card);
      });
    });

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-work-close]')) closeWorkModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeWorkModal();
    trapFocus(e);
  });
})();

// "First Division, with Distinction" in Education opens the degree
// certificate: the sheet grows out of the line and eases into place, and
// shrinks back into it on close. The pen rings the line on the certificate
// once it lands.
// Escape, a click outside, the close button and "put it back" all close it.
(function () {
  var thumb = document.querySelector('.atelier-edu-distinction');
  var dialog = document.getElementById('degree-viewer');
  if (!thumb || !dialog || typeof dialog.showModal !== 'function') return;
  var sheet = dialog.querySelector('.atelier-degree-sheet');
  var foot = dialog.querySelector('.atelier-degree-foot');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canAnimate = !reduce && typeof sheet.animate === 'function';
  var closing = false;

  // The line, as a transform of the sheet: centred on it, about its width.
  function fromThumb() {
    var a = thumb.getBoundingClientRect();
    var b = sheet.getBoundingClientRect();
    var dx = a.left + a.width / 2 - (b.left + b.width / 2);
    var dy = a.top + a.height / 2 - (b.top + b.height / 2);
    return 'translate(' + dx + 'px, ' + dy + 'px) rotate(-3deg) scale(' + Math.min(0.5, a.width / b.width) + ')';
  }

  // The custom cursor (motion.js) lives in <body>, under the dialog's top
  // layer, so it moves into the dialog while it is open.
  function carryCursor(host) {
    document.querySelectorAll('.fx-cursor').forEach(function (c) { host.appendChild(c); });
  }

  function open() {
    if (dialog.open) return;
    settle();
    dialog.showModal();
    carryCursor(dialog);
    document.documentElement.classList.add('is-dialog-open');
    if (window.atelierLenis) window.atelierLenis.stop();
    if (!canAnimate) {
      dialog.classList.add('is-shown');
      return;
    }
    sheet.animate([
      { transform: fromThumb(), opacity: 0 },
      { opacity: 1, offset: 0.35 },
      { transform: 'none', opacity: 1 },
    ], { duration: 620, easing: 'cubic-bezier(0.25, 0.9, 0.25, 1)' }).onfinish = function () {
      dialog.classList.add('is-shown');
    };
    foot.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], {
      duration: 400, delay: 420, easing: 'ease-out', fill: 'backwards',
    });
  }

  function finish() {
    closing = false;
    dialog.classList.remove('is-closing', 'is-shown');
    dialog.close();
  }

  function close() {
    if (!dialog.open || closing) return;
    if (!canAnimate) {
      finish();
      return;
    }
    closing = true;
    dialog.classList.add('is-closing');
    dialog.classList.remove('is-shown');
    var from = getComputedStyle(sheet).transform;
    settle();
    foot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    var done = false;
    var end = function () {
      if (done) return;
      done = true;
      finish();
      settle();
    };
    sheet.animate([
      { transform: from === 'none' ? 'none' : from, opacity: 1 },
      { opacity: 1, offset: 0.6 },
      { transform: fromThumb(), opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'forwards' }).onfinish = end;
    // onfinish has been seen not to fire when a close lands mid-opening.
    setTimeout(end, 480);
  }

  function settle() {
    sheet.getAnimations().forEach(function (a) { a.cancel(); });
    foot.getAnimations().forEach(function (a) { a.cancel(); });
  }

  thumb.addEventListener('click', open);

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog || e.target.closest('[data-degree-close]')) close();
  });

  dialog.addEventListener('cancel', function (e) {
    e.preventDefault();
    close();
  });

  dialog.addEventListener('close', function () {
    carryCursor(document.body);
    document.documentElement.classList.remove('is-dialog-open');
    if (window.atelierLenis) window.atelierLenis.start();
    thumb.focus({ preventScroll: true });
  });
})();

(function () {
  var pile = document.getElementById('cert-pile');
  var index = document.getElementById('cert-index');
  if (!pile || !index) return;

  var sheets = pile.querySelectorAll('.atelier-cert-sheet');
  var tabs = index.querySelectorAll('button');
  var issuerEl = document.getElementById('cert-issuer');
  var titleEl = document.getElementById('cert-title');
  var linkEl = document.getElementById('cert-link');

  function showCert(i) {
    sheets.forEach(function (sheet, n) {
      var on = n === i;
      sheet.classList.toggle('is-active', on);
      sheet.setAttribute('aria-pressed', on ? 'true' : 'false');
      sheet.tabIndex = on ? 0 : -1;
    });
    tabs.forEach(function (tab, n) {
      tab.classList.toggle('is-active', n === i);
      tab.setAttribute('aria-pressed', n === i ? 'true' : 'false');
    });
    var tab = tabs[i];
    if (tab && issuerEl) issuerEl.textContent = tab.getAttribute('data-issuer') || '';
    if (tab && titleEl) titleEl.textContent = tab.getAttribute('data-title') || '';
    if (linkEl) linkEl.href = sheets[i].getAttribute('data-href') || '#';
  }

  sheets.forEach(function (sheet, i) {
    sheet.addEventListener('click', function () {
      if (sheet.classList.contains('is-active')) {
        var href = sheet.getAttribute('data-href');
        if (href) window.open(href, '_blank', 'noopener');
        return;
      }
      showCert(i);
    });
  });
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      showCert(i);
    });
  });
})();

// Footer "Let's ship.": plays the dot chain (atelier.css, fxf-*) once the mark
// is in view, and again whenever it is hovered or tapped.
(function () {
  var mark = document.querySelector('.fx-footer-mark');
  if (!mark || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var busy = false;
  mark.classList.add('is-armed');

  function play() {
    if (busy) return;
    busy = true;
    mark.classList.remove('is-live');
    void mark.offsetWidth;
    mark.classList.add('is-live');
    setTimeout(function () { busy = false; }, 2200);
  }

  var io = new IntersectionObserver(function (entries) {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    setTimeout(play, 650);
  }, { threshold: 0.6 });
  io.observe(mark);

  mark.addEventListener('pointerenter', play);
})();
