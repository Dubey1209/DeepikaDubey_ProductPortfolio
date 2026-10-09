// A soft, synthesised tap when something is clicked: a light "tick" for
// navigation and links, a bubbly "pop" for buttons and cards. No audio files;
// Web Audio builds each one in a few milliseconds. The mascot has her own
// rules and makes no sound here. localStorage 'tap-sound' = 'off' mutes it.
(function () {
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  var ctx = null;

  var TICK = 'nav a, .navbar a, .navbar button, .atelier-essay-cta, a';
  var POP = 'button, [role="button"], summary, label, .project-card, .atelier-skill-card, .atelier-essay, .unlock-btn';

  function muted() {
    try { return localStorage.getItem('tap-sound') === 'off'; } catch (e) { return false; }
  }

  function kindOf(target) {
    if (!target || !target.closest) return '';
    if (target.closest('.atelier-mascot, input[type="text"], input[type="email"], textarea, select, [disabled], [aria-disabled="true"]')) return '';
    if (target.closest('.navbar, nav')) return 'tick';
    var pop = target.closest(POP);
    var link = target.closest(TICK);
    // The nearer of the two decides: a link inside a card ticks, the card
    // (even one that is itself a link) pops.
    if (link && link !== pop && (!pop || pop.contains(link))) return 'tick';
    return pop ? 'pop' : '';
  }

  function play(kind) {
    if (muted()) return;
    if (!ctx) ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime + 0.005;
    // A touch of pitch drift, so ten clicks don't sound like one sample.
    var j = 0.96 + Math.random() * 0.08;
    var tick = kind === 'tick';
    var dur = tick ? 0.045 : 0.085;
    var peak = tick ? 0.045 : 0.07;

    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime((tick ? 1400 : 520) * j, t);
    osc.frequency.exponentialRampToValueAtTime((tick ? 1000 : 900) * j, t + dur * 0.6);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);

    // The pop gets a faint sparkle an octave and a fifth up.
    if (!tick) {
      var shine = ctx.createOscillator();
      var shineGain = ctx.createGain();
      shine.type = 'triangle';
      shine.frequency.setValueAtTime(1560 * j, t + 0.012);
      shineGain.gain.setValueAtTime(0.0001, t + 0.012);
      shineGain.gain.exponentialRampToValueAtTime(0.018, t + 0.018);
      shineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      shine.connect(shineGain).connect(ctx.destination);
      shine.start(t + 0.012);
      shine.stop(t + 0.09);
    }
  }

  // Mouse and pen sound on press, so it lands with the finger, not after it;
  // touch waits for the click so a scroll that starts on a card stays silent.
  var pressed = 0;
  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    var kind = kindOf(e.target);
    if (!kind) return;
    pressed = Date.now();
    play(kind);
  }, true);

  document.addEventListener('click', function (e) {
    if (Date.now() - pressed < 800) return;
    var kind = kindOf(e.target);
    if (kind) play(kind);
  }, true);
})();
