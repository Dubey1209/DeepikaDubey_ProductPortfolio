(function () {
  const PUBLIC_KEY = 'tKGsj-T6YjYbG5zcA';
  const SERVICE_ID = 'service_7lkipnf';
  const TEMPLATE_ID = 'template_z1gyvmn';

  function initContactForm() {
    const form = document.getElementById('contactForm');
    const formStatus = document.getElementById('form-status');
    if (!form || !formStatus) return;

    if (typeof emailjs === 'undefined') {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        formStatus.innerHTML =
          '<div class="error-message">Email service is not available. Please write to <a href="mailto:dubeydeepika1209@gmail.com">dubeydeepika1209@gmail.com</a></div>';
        formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    emailjs.init({ publicKey: PUBLIC_KEY });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!submitBtn) return;

      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending...';

      const templateParams = {
        from_name: document.getElementById('name').value,
        from_email: document.getElementById('email').value,
        company: document.getElementById('company').value || 'Not provided',
        message: document.getElementById('message').value,
        reply_to: document.getElementById('email').value,
      };

      emailjs
        .send(SERVICE_ID, TEMPLATE_ID, templateParams)
        .then(function () {
          formStatus.innerHTML =
            '<div class="success-message">Message sent successfully! I\'ll get back to you soon. 😊</div>';
          form.reset();
        })
        .catch(function (error) {
          formStatus.innerHTML =
            '<div class="error-message">Oops! Something went wrong. Please try again or email me directly at <a href="mailto:dubeydeepika1209@gmail.com">dubeydeepika1209@gmail.com</a></div>';
          console.error('Failed to send message:', error);
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
