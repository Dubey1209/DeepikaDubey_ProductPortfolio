(function () {
  var toggleBtn = document.getElementById('theme-toggle');

  function isDark() {
    return document.body.classList.contains('dark-theme');
  }

  // The icon shows what a press does (the sun switches to light), and
  // aria-pressed tells screen readers whether dark mode is on.
  function paintToggle(dark) {
    var icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.textContent = dark ? '☀️' : '🌙';
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
