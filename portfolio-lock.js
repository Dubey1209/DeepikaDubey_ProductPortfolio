class PortfolioLock {
  constructor() {
    this.sessionKey = 'portfolio_unlocked';
    this.init();
  }

  init() {
    if (sessionStorage.getItem(this.sessionKey) === 'true') {
      this.unlockInstant();
      return;
    }
    document.body.classList.add('portfolio-is-locked');
    this.bindForm();
    this.focusNameInput();
  }

  focusNameInput() {
    const input = document.getElementById('visitor-name');
    if (!input) return;
    requestAnimationFrame(() => {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
    });
  }

  bindForm() {
    const form = document.getElementById('unlock-form');
    if (!form) return;

    const input = document.getElementById('visitor-name');
    const sub = document.getElementById('lock-subtitle');
    const plate = document.getElementById('lock-plate-name');
    const idle = sub?.textContent || '';
    const porch = this.bindPorch(input);
    this.porch = porch;
    plate?.classList.add('is-empty');
    let had = false;
    input?.addEventListener('input', () => {
      const first = input.value.trim().split(/\s+/)[0].slice(0, 18);
      form.classList.toggle('has-name', !!first);
      document.getElementById('portfolio-lock')?.style.setProperty('--glow', Math.min(first.length / 6, 1).toFixed(2));
      if (sub) sub.textContent = first ? `Hi, ${first}! Lovely to meet you.` : idle;
      if (plate) {
        plate.textContent = first || 'guest';
        plate.classList.toggle('is-empty', !first);
        if (first && !had) {
          porch.say('Ooh, spelling the passcode…', 2200);
          plate.parentElement.classList.remove('is-stamp');
          void plate.offsetWidth;
          plate.parentElement.classList.add('is-stamp');
        }
      }
      porch.walk(first.length);
      if (!!first !== had) porch.hold(first ? 2 : null);
      had = !!first;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(e);
    });
  }

  // Every visit reads a little differently: the greeting follows the clock,
  // the welcome line and the knock are picked at random.
  // She looks out of the door's window: eyes follow the pointer (or the
  // form while it has focus), she blinks, grins once a name is in, gasps at
  // an empty knock and winks as the door opens. Cells are 3x3; row 0 looks
  // up, column 0 to the left.
  bindPorch(input) {
    const quiet = { hold() {}, flash() {}, walk() {}, say() {} };
    const porch = document.querySelector('.lock-porch');
    const win = porch?.querySelector('.lock-window');
    const look = win?.querySelector('.is-look');
    const react = win?.querySelector('.is-react');
    if (!porch || !look || !react) return quiet;

    const cell = (n) => `${(n % 3) * 50}% ${Math.floor(n / 3) * 50}%`;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let held = null;
    let flashUntil = 0;
    let gazeCell = 4;

    const show = (n) => {
      if (n == null || !document.documentElement.classList.contains('has-reactions')) {
        win.classList.remove('is-face-on');
        return;
      }
      react.style.backgroundPosition = cell(n);
      win.classList.add('is-face-on');
    };
    const gaze = (n) => {
      if (n === gazeCell) return;
      gazeCell = n;
      look.style.backgroundPosition = cell(n);
    };
    const toward = (x, y) => {
      const r = win.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const col = dx < -70 ? 0 : dx > 70 ? 2 : 1;
      const row = dy < -70 ? 0 : dy > 70 ? 2 : 1;
      gaze(row * 3 + col);
    };

    document.addEventListener('pointermove', (e) => {
      if (document.activeElement !== input) toward(e.clientX, e.clientY);
    }, { passive: true });
    input?.addEventListener('focus', () => {
      const r = input.getBoundingClientRect();
      toward(r.left + Math.min(r.width, 160), r.top + r.height / 2);
    });

    if (!reduce) {
      const blink = () => {
        if (Date.now() > flashUntil && document.body.classList.contains('portfolio-is-locked')) {
          show(0);
          setTimeout(() => { if (Date.now() > flashUntil) show(held); }, 140);
        }
        setTimeout(blink, 2600 + Math.random() * 2600);
      };
      setTimeout(blink, 1800);
    }

    // Footprints walk up to the mat, one per letter typed.
    const stepsBox = porch.querySelector('.lock-steps');
    const steps = [];
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('i');
      s.style.setProperty('--i', i);
      stepsBox?.appendChild(s);
      steps.push(s);
    }
    const walk = (n) => steps.forEach((s, i) => s.classList.toggle('is-on', i < n));

    const flash = (n, ms) => {
      flashUntil = Date.now() + ms;
      show(n);
      setTimeout(() => { if (Date.now() >= flashUntil) show(held); }, ms);
    };

    // Speech bubble by the window: the same inked cloud the site's mascot
    // talks in, with two small puffs trailing toward her.
    const bubble = porch.querySelector('.lock-say');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'lock-say-art');
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const shade = document.createElementNS(NS, i ? 'circle' : 'path');
      const line = document.createElementNS(NS, i ? 'circle' : 'path');
      shade.setAttribute('class', 'atelier-mascot-cloud-shade');
      line.setAttribute('class', 'atelier-mascot-cloud-line');
      svg.append(shade, line);
      parts.push([shade, line]);
    }
    const words = document.createElement('span');
    words.className = 'lock-say-text';
    bubble?.append(svg, words);

    const cloudPath = (w, h) => {
      const a = w / 2, b = h / 2, n = 3.2, steps = 200;
      const pts = [], lens = [0];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2 + 2.2;
        const c = Math.cos(t), s = Math.sin(t);
        pts.push([a + a * Math.sign(c) * Math.abs(c) ** (2 / n), b + b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
        if (i) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      }
      const count = Math.max(8, Math.round(lens[steps] / 24));
      const step = lens[steps] / count;
      const marks = [];
      for (let k = 0, j = 0; k < count; k++) {
        const at = k * step;
        while (j < steps && lens[j + 1] < at) j++;
        const f = (at - lens[j]) / (lens[j + 1] - lens[j] || 1);
        marks.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
      }
      let d = `M${marks[0][0].toFixed(1)} ${marks[0][1].toFixed(1)}`;
      for (let m = 1; m <= count; m++) {
        const p = marks[m % count], q = marks[m - 1];
        const r = Math.hypot(p[0] - q[0], p[1] - q[1]) * (0.56 + (m % 3) * 0.04);
        d += `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      }
      return `${d}Z`;
    };
    const drawCloud = () => {
      const w = bubble.offsetWidth, h = bubble.offsetHeight;
      const centred = getComputedStyle(bubble).getPropertyValue('--tail').trim() === 'centre';
      const x = centred ? w * 0.5 : w * 0.8;
      const spots = [[x, h + 10, 4], [x + (centred ? 0 : 7), h + 19, 2.5]];
      parts[0].forEach((p) => p.setAttribute('d', cloudPath(w, h)));
      parts.slice(1).forEach((pair, i) => pair.forEach((c) => {
        c.setAttribute('cx', spots[i][0].toFixed(1));
        c.setAttribute('cy', spots[i][1].toFixed(1));
        c.setAttribute('r', String(spots[i][2]));
      }));
    };

    let sayTimer = 0;
    const say = (text, ms = 3200) => {
      if (!bubble) return;
      clearTimeout(sayTimer);
      words.textContent = text;
      bubble.classList.remove('is-in');
      drawCloud();
      void bubble.offsetWidth;
      bubble.classList.add('is-in');
      sayTimer = setTimeout(() => bubble.classList.remove('is-in'), ms);
    };

    // Stars, each on its own twinkle; the dark theme shows them.
    const sky = porch.querySelector('.lock-sky');
    for (let i = 0; i < 34; i++) {
      const s = document.createElement('b');
      const big = i < 5;
      s.className = big ? 'lock-star is-big' : 'lock-star';
      s.style.cssText = `left:${(Math.random() * 96 + 2).toFixed(1)}%;top:${(Math.random() * 88 + 4).toFixed(1)}%;` +
        `--s:${big ? 1 : (0.5 + Math.random() * 0.8).toFixed(2)};--d:${(1.6 + Math.random() * 3).toFixed(2)}s;--w:-${(Math.random() * 4).toFixed(2)}s`;
      sky?.appendChild(s);
    }

    // Tap the moon for morning, the sun for night: the old one sinks behind
    // the house, the new theme washes out from where you tapped and the
    // other one rises.
    const setDark = (dark) => {
      document.body.classList.toggle('dark-theme', dark);
      const icon = document.getElementById('theme-toggle-icon');
      if (icon) icon.textContent = dark ? '🌙' : '☀️';
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* private mode */ }
    };
    let flipping = false;
    porch.querySelectorAll('.lock-sun, .lock-moon').forEach((orb) => {
      orb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (flipping) return;
        flipping = true;
        const dark = !document.body.classList.contains('dark-theme');
        const root = document.documentElement;
        root.style.setProperty('--vt-x', `${e.clientX}px`);
        root.style.setProperty('--vt-y', `${e.clientY}px`);
        porch.classList.add('is-setting');
        flash(dark ? 0 : 2, 1600);
        setTimeout(() => {
          const go = () => {
            setDark(dark);
            porch.classList.remove('is-setting');
            porch.classList.add('is-rising');
          };
          if (document.startViewTransition && !reduce) {
            root.classList.add('is-sky-flip');
            document.startViewTransition(go).finished.finally(() => root.classList.remove('is-sky-flip'));
          } else {
            go();
          }
          say(dark ? 'Lights out. Shh, the stars are shy.' : 'Who turned on the sun?!', 2400);
          setTimeout(() => {
            porch.classList.remove('is-rising');
            flipping = false;
          }, 1100);
        }, reduce ? 0 : 420);
      });
    });

    // A knock opens the door a crack; she peeks out, teases and shuts it
    // again, because the only thing that opens it is a name.
    const quips = [
      'Who’s there? Wait, that’s my line.',
      'Knock: 10/10. Name: missing.',
      'I open for names. And snacks.',
      'Shh, I’m in my pyjamas. Name first!',
      'Knocking? In this economy? Type your name.',
      'Door’s shy. Tell it your name.',
      'Ouch, my door! Name please.'
    ];
    let quipAt = Math.floor(Math.random() * quips.length);
    let knocking = false;
    porch.addEventListener('click', () => {
      if (knocking || porch.closest('.is-opening')) return;
      knocking = true;
      porch.classList.add('has-knocked');
      porch.classList.remove('is-knocking');
      void porch.offsetWidth;
      porch.classList.add('is-knocking');
      flash(3, 700);
      setTimeout(() => {
        porch.classList.add('is-ajar');
        const name = input?.value.trim().split(/\s+/)[0];
        flash(4, 1400);
        say(name ? `${name}! Psst, hit “Come in”. I’m ready.` : quips[quipAt++ % quips.length]);
      }, 650);
      setTimeout(() => {
        porch.classList.remove('is-ajar');
        knocking = false;
        input?.focus({ preventScroll: true });
      }, 3600);
    });

    return {
      walk,
      say,
      hold(n) {
        held = n;
        porch.classList.toggle('is-lit', n != null);
        if (Date.now() > flashUntil) show(n);
      },
      flash
    };
  }

  async handleSubmit(e) {
    const form = e.currentTarget;
    const nameInput = document.getElementById('visitor-name');
    const name = nameInput?.value.trim() || '';
    if (!name) {
      this.porch?.flash(3, 900);
      this.porch?.say('Empty name? Bold. Still locked.');
      nameInput?.focus();
      return;
    }

    const btn = form.querySelector('.unlock-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnLoader = btn?.querySelector('.btn-loader');
    if (!btn || !btnText || !btnLoader) return;

    this.porch?.flash(1, 3000);
    this.porch?.walk(8);
    this.porch?.say(`Welcome in, ${name.split(/\s+/)[0]}! Shoes optional.`, 2000);
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';

    try {
      await this.sendVisitorData(name);
      sessionStorage.setItem(this.sessionKey, 'true');
      await this.playUnlock(name);
    } catch {
      this.notify('Something went wrong. Please try again.', 'error');
      btn.disabled = false;
      btnText.style.display = 'inline';
      btnLoader.style.display = 'none';
    }
  }

  async sendVisitorData(name) {
    try {
      const res = await fetch('https://formcarry.com/s/stV_oddEgaZ', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name,
          message: `Portfolio visitor: ${name} - ${new Date().toLocaleString()}`,
          subject: 'New Portfolio Visitor',
        }),
      });
      if (!res.ok) throw new Error('submit failed');
    } catch {
      /* visitor tracking is optional */
    }
  }

  playUnlock(name) {
    // Where the mascot is on the page she welcomes them by name, so the toast
    // would only say it twice.
    const thanks = document.querySelector('.atelier-mascot') ? '' : `Thanks, ${name}. It's open.`;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.unlockInstant(name);
      this.notify(thanks, 'success');
      return Promise.resolve();
    }

    const lock = document.getElementById('portfolio-lock');
    const card = document.getElementById('lock-card');
    const shell = document.getElementById('site-shell');

    if (!lock || !card || !shell) {
      this.unlockInstant(name);
      this.notify(thanks, 'success');
      return Promise.resolve();
    }

    lock.classList.add('is-opening');
    card.classList.add('is-opening');

    return new Promise((resolve) => {
      setTimeout(() => {
        shell.style.display = 'block';
        shell.classList.add('is-revealing');
        document.dispatchEvent(new CustomEvent('portfolio-unlocked', { detail: { name } }));
      }, 180);

      setTimeout(() => {
        document.body.classList.remove('portfolio-is-locked');
        lock.style.display = 'none';
        lock.classList.remove('is-opening');
        card.classList.remove('is-opening');
        shell.classList.remove('is-revealing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.notify(thanks, 'success');
        resolve();
      }, 920);
    });
  }

  // `name` only when the visitor has just typed it in; a returning session
  // unlocks without one, and the mascot greets it the ordinary way.
  unlockInstant(name) {
    document.body.classList.remove('portfolio-is-locked');
    const lock = document.getElementById('portfolio-lock');
    const shell = document.getElementById('site-shell');
    if (lock) lock.style.display = 'none';
    if (shell) shell.style.display = 'block';
    document.dispatchEvent(new CustomEvent('portfolio-unlocked', { detail: { name: name || '' } }));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  notify(message, type) {
    document.querySelector('.lock-notification')?.remove();
    if (!message) return;
    const el = document.createElement('div');
    el.className = `lock-notification lock-notification--${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 400);
    }, 2800);
  }
}

// Deferred, so the document is parsed by now; starting here rather than on
// DOMContentLoaded means the lock (or the site) doesn't wait for the
// animation libraries further down to download.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PortfolioLock());
} else {
  new PortfolioLock();
}
