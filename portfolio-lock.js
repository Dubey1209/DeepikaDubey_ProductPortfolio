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
    this.dressPorch(sub);
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
  dressPorch(sub) {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const h = new Date().getHours();
    const hello = document.getElementById('lock-hello');
    if (hello) {
      hello.textContent = h >= 5 && h < 12 ? 'Good morning' : h < 17 && h >= 12 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Up late too?';
    }
    if (sub) {
      sub.textContent = pick([
        'Come on in. I’ll show you around.',
        'Pull up a chair. I’ll show you around.',
        'So glad you found the place. Come in.',
        'Kick off your shoes. Stay a while.',
        'You made it. Come on in.'
      ]);
    }
    const knock = document.querySelector('.lock-knock');
    if (knock) knock.textContent = pick(['knock knock', 'tap tap', 'ding dong', 'anyone home?']);
  }

  // She looks out of the door's window: eyes follow the pointer (or the
  // form while it has focus), she blinks, grins once a name is in, gasps at
  // an empty knock and winks as the door opens. Cells are 3x3; row 0 looks
  // up, column 0 to the left.
  bindPorch(input) {
    const quiet = { hold() {}, flash() {}, walk() {} };
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
      if (n == null) {
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

      const knock = () => {
        if (input?.value.trim()) return;
        porch.classList.remove('is-knocking');
        void porch.offsetWidth;
        porch.classList.add('is-knocking');
      };
      setTimeout(knock, 1500);
      setTimeout(knock, 12000);
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

    porch.addEventListener('pointerenter', () => {
      if (Date.now() > flashUntil) flash(4, 900);
    });
    porch.addEventListener('click', () => {
      input?.focus();
      porch.classList.remove('is-knocking');
      void porch.offsetWidth;
      porch.classList.add('is-knocking');
      flash(5, 800);
    });

    return {
      walk,
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
      this.notify('Please enter your name.', 'error');
      nameInput?.focus();
      return;
    }

    const btn = form.querySelector('.unlock-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnLoader = btn?.querySelector('.btn-loader');
    if (!btn || !btnText || !btnLoader) return;

    this.porch?.flash(1, 3000);
    this.porch?.walk(8);
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

document.addEventListener('DOMContentLoaded', () => new PortfolioLock());
