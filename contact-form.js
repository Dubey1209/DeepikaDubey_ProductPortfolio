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
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: 'Portfolio message from ' + fields.name,
        _replyto: fields.email,
        _template: 'table',
        _captcha: 'false',
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

      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending...';

      const fields = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        company: document.getElementById('company').value || 'Not provided',
        message: document.getElementById('message').value,
      };

      // Only bots tick the hidden box: they get a success message, nothing is sent.
      const trap = form.querySelector('[name="botcheck"]');
      const sending = trap && trap.checked
        ? Promise.resolve()
        : sendWithFormSubmit(fields).catch(function () {
          return sendWithEmailJs(fields);
        });

      sending
        .then(function () {
          formStatus.innerHTML =
            '<div class="success-message">Message sent. I will get back to you soon.</div>';
          form.reset();
        })
        .catch(function () {
          formStatus.innerHTML =
            '<div class="error-message">Oops! Something went wrong. Please try again or email me directly at <a href="mailto:dubeydeepika1209@gmail.com">dubeydeepika1209@gmail.com</a></div>';
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactForm);
  } else {
    initContactForm();
  }
})();
