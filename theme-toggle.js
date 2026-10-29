(function () {
  var toggleBtn = document.getElementById('theme-toggle');

  function isDark() {
    return document.body.classList.contains('dark-theme');
  }

  var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';

  // The icon shows what a press does (the sun switches to light), and
  // aria-pressed tells screen readers whether dark mode is on.
  function paintToggle(dark) {
    var icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.innerHTML = dark ? SUN : MOON;
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      toggleBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  }
  window.paintThemeToggle = paintToggle;

  function setTheme(dark) {
    document.body.classList.toggle('dark-theme', dark);
    paintToggle(dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch (e) {}
  }

  paintToggle(isDark());

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      setTheme(!isDark());
    });
  }
})();
