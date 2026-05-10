(function () {
  var sections = document.querySelectorAll('main .section:not(#home)');
  if (!sections.length) return;

  function revealInView() {
    sections.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
        el.classList.add('reveal-in');
      }
    });
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sections.forEach(function (el) {
      el.classList.add('reveal-in');
    });
    return;
  }

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('reveal-in');
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }
  );

  sections.forEach(function (el) {
    io.observe(el);
  });

  window.addEventListener('load', revealInView);
  window.addEventListener('pageshow', revealInView);
  setTimeout(revealInView, 80);
  /* Portfolio lock: when shell becomes visible, reveal sections already on screen */
  setTimeout(revealInView, 2600);
})();
