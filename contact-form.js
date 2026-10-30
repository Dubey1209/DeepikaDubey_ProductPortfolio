(function () {
  // FormSubmit (https://formsubmit.co): free, no monthly limit, no account.
  // The first message sends an activation email to this inbox; after
  // activating, FormSubmit also gives a random alias that can replace the
  // address here so it is not visible in the page source.
  const FORMSUBMIT_TO = 'dubeydeepika1209@gmail.com';
  const FORMSUBMIT_URL = 'https://formsubmit.co/ajax/' + FORMSUBMIT_TO;

  // EmailJS, tried only when FormSubmit fails.
  const PUBLIC_KEY = 'tKGsj-T6YjYbG5zcA';
  const SERVICE_ID = 'service_7lkipnf';
  const TEMPLATE_ID = 'template_z1gyvmn';
  const EMAILJS_SRC = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

  let emailJsReady = null;
  let emailJsInited = false;

  function loadEmailJs() {
    if (typeof emailjs !== 'undefined') {
      return Promise.resolve();
    }
    if (emailJsReady) return emailJsReady;

    emailJsReady = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = EMAILJS_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return emailJsReady;
  }

  function sendWithFormSubmit(fields) {
    return fetch(FORMSUBMIT_URL, {
      method: 'POST',
      // Lets the send finish even if the visitor leaves mid-send.
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'Portfolio message from ' + fields.name,
        _replyto: fields.email,
        _template: 'table',
        _captcha: 'false',
        _honey: fields.honey,
        name: fields.name,
        email: fields.email,
        company: fields.company,
        message: fields.message,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (String(result.success) !== 'true') throw new Error(result.message || 'FormSubmit rejected the message');
      });
  }

  function sendWithEmailJs(fields) {
    return loadEmailJs().then(function () {
      if (!emailJsInited) {
        emailjs.init({ publicKey: PUBLIC_KEY });
        emailJsInited = true;
      }
      return emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        from_name: fields.name,
        from_email: fields.email,
        company: fields.company,
        message: fields.message,
        reply_to: fields.email,
      });
    });
  }

  function initContactForm() {
    const form = document.getElementById('contactForm');
    const formStatus = document.getElementById('form-status');
    if (!form || !formStatus) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!submitBtn) return;

      const label = submitBtn.querySelector('.form-btn-label') || submitBtn;
      const originalBtnText = label.textContent;
      submitBtn.disabled = true;
      submitBtn.classList.remove('is-sent');
      submitBtn.classList.add('is-sending');
      label.textContent = 'Sending…';

      const fields = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        company: document.getElementById('company').value || 'Not provided',
        message: document.getElementById('message').value,
        honey: form.querySelector('[name="_honey"]')?.value || '',
      };

      // People never see the _honey field; bots that fill it are shown the
      // thanks and nothing is sent. FormSubmit also drops any message with it filled.
      const sending = fields.honey
        ? Promise.resolve()
        : sendWithFormSubmit(fields).catch(function () {
          return sendWithEmailJs(fields);
        });

      // FormSubmit can take several seconds to answer, so a slow send says so
      // instead of leaving the button on "Sending..." with no explanation.
      const slow = setTimeout(function () {
        formStatus.innerHTML =
          '<div class="pending-message">Still sending, this can take a few seconds…</div>';
      }, 2500);

      sending
        .then(function () {
          clearTimeout(slow);
          formStatus.innerHTML =
            '<div class="success-message">Message sent. I will get back to you soon.</div>';
          form.reset();
          form.dispatchEvent(new Event('input'));
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-sending');
          // The plane flies off and the button says so for a moment.
          submitBtn.classList.add('is-sent');
          label.textContent = 'Sent!';
          setTimeout(function () {
            submitBtn.classList.remove('is-sent');
            label.textContent = originalBtnText;
          }, 2600);
          formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .catch(function () {
          clearTimeout(slow);
          formStatus.innerHTML =
            '<div class="error-message">Oops! Something went wrong. Please try again or email me directly at <a href="mailto:dubeydeepika1209@gmail.com">dubeydeepika1209@gmail.com</a></div>';
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-sending');
          label.textContent = originalBtnText;
          formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
  }

  // The small touches around the form: her local time, copying the email,
  // quick starts for the message, and a character count.
  function initContactExtras() {
    const clock = document.querySelector('[data-contact-clock]');
    if (clock && typeof Intl !== 'undefined') {
      const fmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      const tick = function () {
        clock.textContent = fmt.format(new Date()).toUpperCase() + ' in India';
      };
      tick();
      setInterval(tick, 30000);
    }

    document.querySelectorAll('.atelier-contact-clip').forEach(function (btn) {
      const text = btn.querySelector('span');
      let reset = 0;
      btn.addEventListener('click', function () {
        const value = btn.getAttribute('data-copy') || '';
        const done = function () {
          btn.classList.add('is-copied');
          if (text) text.textContent = 'Copied';
          btn.setAttribute('aria-label', 'Email address copied');
          clearTimeout(reset);
          reset = setTimeout(function () {
            btn.classList.remove('is-copied');
            if (text) text.textContent = 'Copy';
            btn.setAttribute('aria-label', 'Copy email address');
          }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(done, function () {});
        }
      });
    });

    const message = document.getElementById('message');
    const count = document.querySelector('[data-contact-count]');
    const form = document.getElementById('contactForm');
    if (message && count) {
      const max = +message.getAttribute('maxlength') || 2000;
      const update = function () {
        const n = message.value.length;
        count.textContent = n + ' / ' + max;
        count.classList.toggle('is-near', n > max * 0.9);
      };
      message.addEventListener('input', update);
      if (form) form.addEventListener('input', update);
      update();
    }

    document.querySelectorAll('.atelier-contact-starters [data-starter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (!message) return;
        const starter = chip.getAttribute('data-starter');
        // Never overwrite what someone has already written.
        message.value = message.value.trim() ? message.value.replace(/\s*$/, '\n\n') + starter : starter + ' ';
        message.dispatchEvent(new Event('input', { bubbles: true }));
        message.focus();
        message.setSelectionRange(message.value.length, message.value.length);
        chip.classList.add('is-picked');
        setTimeout(function () { chip.classList.remove('is-picked'); }, 700);
      });
    });
  }

  function init() {
    initContactForm();
    initContactExtras();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
