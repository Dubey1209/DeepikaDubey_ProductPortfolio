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
  isMenuOpen = false;
  if (!navLinks) return;
  navLinks.classList.remove('open');
  document.body.style.overflow = '';

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
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});

const experienceOrder = ['zyra', 'tnumber', 'thatha', 'sdc-si'];

const experienceData = {
  zyra: {
    title: 'Junior Technical Product Manager',
    company: 'Zyra',
    type: 'Technology & Software',
    period: 'Jun 2026 - Present',
    periodShort: 'Now',
    highlight: 'Shipping features end-to-end',
    tags: ['Technical PM', 'Rapid Prototyping', 'Team Lead'],
    summary:
      'Currently leading the software team and working closely with PMs and engineers to ship new features - making product decisions with the CEO, writing code when needed, and building rapid prototypes to move fast.',
    description: `
      <ul>
        <li><strong>Lead software delivery</strong> across the team, keeping builds focused, fast, and aligned with product priorities.</li>
        <li><strong>Collaborate daily with PMs and engineers</strong> to turn product goals into clear specs, unblock development, and ship new features from idea to release.</li>
        <li><strong>Work with the CEO on product decisions</strong>, bringing user context, technical feasibility, and trade-off analysis to shape what we build next.</li>
        <li><strong>Write code when required</strong> - jump into the codebase to fix blockers, validate implementations, and keep momentum high on critical releases.</li>
        <li><strong>Build rapid prototypes</strong> to test ideas early, gather feedback faster, and de-risk feature bets before full engineering investment.</li>
        <li><strong>Drive end-to-end feature shipping</strong>, coordinating discovery, scoping, development, and launch so new capabilities reach users reliably and on time.</li>
      </ul>
    `,
  },
  tnumber: {
    title: 'Associate Product Management Intern',
    company: 'Tnumber',
    type: 'Communication Platform',
    period: 'Jan 2026 - Apr 2026',
    periodShort: '2026',
    highlight: '30% fewer support tickets',
    tags: ['Product Execution', 'JIRA', 'QA'],
    summary:
      'Led end-to-end execution of product features across web dashboards and mobile apps, coordinating with engineers to deliver usability improvements.',
    description: `
      <ul>
        <li><strong>Product Led end-to-end execution</strong> of product features across web dashboards and mobile applications, coordinating with engineers to deliver usability improvements that resulted in 30% reduction in support tickets.</li>
        <li><strong>Restructured product backlog</strong> by detailing Jira tickets with subtasks and prioritizing high-impact bugs, streamlining sprint execution and achieving 35% faster bug resolution.</li>
        <li><strong>Implemented onboarding improvements</strong> by simplifying UI flows based on user feedback, collaborating with design team to improve product intuitiveness, leading to 15% improvement in onboarding completion rate.</li>
        <li><strong>Analyzed product analytics</strong> and user feedback to track adoption and usage trends, identifying areas for feature iteration and informing product decisions that drove 15% increase in feature adoption.</li>
        <li><strong>Conducted product QA</strong> across platforms, identified 60+ bugs, and raised GitHub issues, collaborating with engineering teams to ensure stable feature releases.</li>
      </ul>
    `,
  },
  thatha: {
    title: 'Product Lead Intern',
    company: 'THATha',
    type: 'Early-stage SaaS Startup',
    period: 'Jul 2025 - Nov 2025',
    periodShort: '2025',
    highlight: '20% user engagement lift',
    tags: ['Roadmapping', 'Usability Testing', 'SaaS'],
    summary:
      'Owned roadmap planning and backlog prioritization for a multi-tenant SaaS product, aligning delivery with customer success goals.',
    description: `
      <ul>
        <li><strong>Owned roadmap planning</strong> and backlog prioritization for a multi-tenant SaaS product, aligning delivery with customer success goals, resulting in 20% increase in user engagement.</li>
        <li><strong>Translated stakeholder requirements</strong> into technical specifications, streamlining website flow and clarifying feature sections to accelerate engineering execution by 15%.</li>
        <li><strong>Led usability testing</strong> and funnel analysis with 15-20 participants to identify friction points in user journey and simplify the interface.</li>
        <li><strong>Refined website flow</strong> and feature presentation, improving user experience and enhancing overall engagement from new users, leading to a 17% increase in conversion rates.</li>
        <li><strong>Collaborated with design and development teams</strong> to implement 10 website features for an early-stage SaaS product, iterating quickly based on user feedback.</li>
        <li><strong>Conducted lightweight usability testing</strong>, guiding users through the product and observing navigation of key flows to identify usability issues.</li>
        <li><strong>Prioritized features</strong> to improve usability and customer onboarding for pilot customers, shaping the product experience based on early user feedback.</li>
      </ul>
    `,
  },
  'sdc-si': {
    title: 'Android Developer',
    company: 'SDC SI',
    type: 'Mobile Product Development',
    period: 'Aug 2023 - Nov 2023',
    periodShort: '2023',
    highlight: '10% faster app response',
    tags: ['Kotlin', 'REST APIs', 'Android UI'],
    summary:
      'Developed Android UI screens using XML layouts and integrated backend REST APIs for smooth data retrieval and interaction.',
    description: `
      <ul>
        <li><strong>Developed Android UI screens</strong> using XML layouts, integrating backend REST APIs to ensure smooth data retrieval and interaction, leading to 10% improvement in app responsiveness.</li>
        <li><strong>Optimized onboarding flow</strong> and feature accessibility based on product usage data, improving API integrations and UI responsiveness, resulting in a 10% increase in feature adoption and Day-1 retention.</li>
        <li><strong>Addressed delays in data fetching</strong> from backend APIs by optimizing network calls and data rendering within the UI, achieving 15% reduction in data loading times.</li>
      </ul>
    `,
  },
};

document.addEventListener('DOMContentLoaded', () => {
  initExperienceShowcase();
});

function initExperienceShowcase() {
  var root = document.getElementById('atelier-exp');
  if (!root || !experienceOrder.length) return;

  root.innerHTML = experienceOrder
    .map(function (id, index) {
      var d = experienceData[id];
      var open = index === 0;
      var tags = (d.tags || [])
        .map(function (tag) {
          return '<li>' + tag + '</li>';
        })
        .join('');
      return (
        '<article class="atelier-exp-item' +
        (open ? ' is-open' : '') +
        '" data-exp="' +
        id +
        '">' +
        '<button type="button" class="atelier-exp-row" aria-expanded="' +
        open +
        '">' +
        '<span class="atelier-exp-year">' +
        d.periodShort +
        '</span>' +
        '<span class="atelier-exp-role">' +
        d.title +
        '</span>' +
        '<span class="atelier-exp-leader" aria-hidden="true"></span>' +
        '<span class="atelier-exp-co">' +
        d.company +
        '</span>' +
        '<span class="atelier-exp-toggle" aria-hidden="true"></span>' +
        '</button>' +
        '<div class="atelier-exp-paper" data-year="' +
        d.periodShort +
        '">' +
        '<p class="atelier-exp-period">' +
        d.period +
        ' · ' +
        d.type +
        '</p>' +
        '<p class="atelier-exp-hook">' +
        d.highlight +
        '</p>' +
        '<p class="atelier-exp-summary">' +
        d.summary +
        '</p>' +
        '<div class="atelier-exp-body">' +
        d.description +
        '</div>' +
        (tags ? '<ul class="atelier-exp-tags">' + tags + '</ul>' : '') +
        '</div>' +
        '</article>'
      );
    })
    .join('');

  root.querySelectorAll('.atelier-exp-item').forEach(function (item) {
    var btn = item.querySelector('.atelier-exp-row');
    if (!btn) return;
    btn.addEventListener('click', function () {
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
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');
    document.body.classList.remove('work-modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
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

