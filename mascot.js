// About-section mascot: looks towards the cursor, reacts to what the visitor
// does, blinks on her own, and now and then a breeze lifts her hair.
//
// Plain-JS take on the page-mascot idea (github.com/nilbuild/page-mascot),
// which is a React component; this site has no React and no build step. The
// two sheets are 3x3 grids built by tools/build-mascot.mjs:
//
//   directions  row = up / level / down, column = left / centre / right
//   reactions   0 blink   1 wink      2 grin
//               3 gasp    4 giggle    5 shy
//               6 starry  7 thinking  8 sleepy (unused)
//
// What triggers each reaction:
//   pointer arrives on her      grin (at most every 15s)
//   pointer rests on her face   shy
//   pointer scrubs over her     giggle (tickled)
//   click / Enter / Space       a friendly face; keep poking and she says so
//   any link or button hovered  sometimes starry
//
// Every reaction frame faces straight out, so the ones she starts herself
// (blinks, starry) wait until she is looking straight out too. Otherwise a
// cursor resting off to one side would see her head snap to the front and
// back. For the same reason there is no idle or sleepy reaction: left alone,
// she keeps looking wherever the cursor was left.
//
// Motion, and why it stays sharp:
//   - Every frame change is a cross-fade: the new frame fades in over the old
//     one, which stays fully opaque underneath until it is covered, so the
//     figure never dims halfway through.
//   - The lean towards the cursor is a spring, not a CSS transition. A
//     transition restarts on every pointermove and reads as stutter; a spring
//     carries its velocity through and settles with a little follow-through.
//   - She tilts only while moving, from the spring's velocity, and at rest
//     her offset is snapped to the device pixel grid. A raster that is left
//     rotated, scaled or at a fractional offset is resampled and looks soft.
//
// The markup works without this script: CSS shows the centre direction frame.

(function () {
  'use strict';

  var el = document.querySelector('.atelier-mascot');
  if (!el) return;

  var layerA = el.querySelector('.atelier-mascot-look');
  var layerB = el.querySelector('.atelier-mascot-react');
  if (!layerA || !layerB) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BLINK = 0;
  var WINK = 1;
  var GRIN = 2;
  var GASP = 3;
  var GIGGLE = 4;
  var SHY = 5;
  var STARRY = 6;
  var THINKING = 7;
  var FRIENDLY = [WINK, GRIN, STARRY, SHY];
  var CENTRE = 4;

  var EASE = 'cubic-bezier(0.33, 0, 0.2, 1)';

  var visible = true;
  var pointer = null;
  var lookIndex = CENTRE;
  var reacting = -1;
  var reactTimer = 0;
  var blinkTimer = 0;
  var breezeTimer = 0;

  function now() {
    return Date.now();
  }

  // ---- frames ---------------------------------------------------------------
  //
  // Two layers, either of which can show either sheet. The visible one is
  // `front`; a new frame goes on the other, fades in on top, and only then is
  // the old one hidden.

  var front = layerA;
  var back = layerB;
  var shown = 'look:' + CENTRE;
  var fade = null;
  var covered = null;

  layerA.classList.add('is-look');
  layerB.classList.add('is-react');
  layerA.style.opacity = '1';
  layerB.style.opacity = '0';

  function paint(layer, sheet, index) {
    layer.classList.toggle('is-look', sheet === 'look');
    layer.classList.toggle('is-react', sheet === 'react');
    layer.style.backgroundPosition = (index % 3) * 50 + '% ' + Math.floor(index / 3) * 50 + '%';
  }

  function settleFade() {
    if (fade) {
      fade.onfinish = null;
      fade.cancel();
      fade = null;
    }
    if (covered) {
      covered.style.opacity = '0';
      covered = null;
    }
  }

  function show(sheet, index, ms) {
    var key = sheet + ':' + index;
    if (key === shown) return;
    shown = key;
    settleFade();

    var incoming = back;
    back = front;
    front = incoming;
    paint(incoming, sheet, index);
    incoming.style.zIndex = '2';
    back.style.zIndex = '1';
    incoming.style.opacity = '1';

    if (reducedMotion || !ms || typeof incoming.animate !== 'function') {
      back.style.opacity = '0';
      return;
    }
    covered = back;
    fade = incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: EASE });
    fade.onfinish = function () {
      fade = null;
      settleFade();
    };
  }

  // ---- reactions ------------------------------------------------------------

  function react(index, ms, fadeMs) {
    reacting = index;
    show('react', index, fadeMs || 150);
    clearTimeout(reactTimer);
    if (ms) reactTimer = setTimeout(endReaction, ms);
  }

  function endReaction(fadeMs) {
    clearTimeout(reactTimer);
    reacting = -1;
    show('look', lookIndex, fadeMs || 220);
  }

  // Reactions she starts herself never cut off one the visitor caused, and
  // never turn her head away from where she is looking.
  function autoReact(index, ms, fadeMs) {
    if (visible && reacting < 0 && lookIndex === CENTRE) react(index, ms, fadeMs);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (reducedMotion) return;
    blinkTimer = setTimeout(function () {
      blink();
      // Now and then a double blink, which reads as more alive than a metronome.
      if (Math.random() < 0.22) setTimeout(blink, 360);
      scheduleBlink();
    }, 2800 + Math.random() * 3600);
  }

  // Lids close fast and open a little slower, as real ones do.
  function blink() {
    if (!visible || reacting >= 0 || lookIndex !== CENTRE) return;
    reacting = BLINK;
    show('react', BLINK, 70);
    clearTimeout(reactTimer);
    reactTimer = setTimeout(function () {
      endReaction(120);
    }, 150);
  }

  // ---- gaze -----------------------------------------------------------------

  var col = 1;
  var row = 1;
  var nearFace = true;
  var faceSince = 0;
  var target = { x: 0, y: 0 };

  // Thresholds with hysteresis: a frame is entered past ENTER and kept until
  // the cursor comes back past LEAVE, so a cursor sitting on a boundary does
  // not flick between two frames.
  var ENTER = 0.42;
  var LEAVE = 0.3;

  function axis(current, v) {
    if (current === 0) return v < -LEAVE ? 0 : v > ENTER ? 2 : 1;
    if (current === 2) return v > LEAVE ? 2 : v < -ENTER ? 0 : 1;
    return v < -ENTER ? 0 : v > ENTER ? 2 : 1;
  }

  function aim() {
    if (!pointer || !visible) return;
    var rect = el.getBoundingClientRect();
    var dx = pointer.x - (rect.left + rect.width / 2);
    // Aim at the face, which sits in the upper part of the figure.
    var dy = pointer.y - (rect.top + rect.height * 0.38);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var nx = dist ? dx / dist : 0;
    var ny = dist ? dy / dist : 0;

    // Close to the face she looks straight out rather than flicking between
    // frames as the cursor crosses the centre.
    nearFace = dist < rect.width * (nearFace ? 0.34 : 0.28);
    if (nearFace) {
      col = 1;
      row = 1;
    } else {
      col = axis(col, nx);
      row = axis(row, ny);
    }

    var index = row * 3 + col;
    if (index !== lookIndex) {
      lookIndex = index;
      if (reacting < 0) show('look', index, 170);
    }

    // The nine frames are steps; the lean is the continuous part. It grows
    // with distance so a cursor resting near her face barely moves her.
    var pull = Math.min(1, dist / (rect.width * 1.6));
    target.x = nx * pull;
    target.y = ny * pull;
    wakeSpring();

    if (!nearFace) {
      faceSince = 0;
    } else if (!faceSince) {
      faceSince = now();
    } else if (now() - faceSince > 900 && reacting < 0) {
      react(SHY, 1800);
      faceSince = now() + 4000;
    }
  }

  // ---- lean spring ----------------------------------------------------------
  //
  // Slightly under-damped, so she arrives with a hint of follow-through rather
  // than stopping dead like a tween.

  var STIFFNESS = 70;
  var DAMPING = 13;
  var SHIFT_X = 7;
  var SHIFT_Y = 4;
  var TILT = 0.0045;
  var MAX_TILT = 2.2;

  var pos = { x: 0, y: 0 };
  var vel = { x: 0, y: 0 };
  var springOn = false;
  var lastT = 0;

  function setLean(x, y, tilt) {
    el.style.setProperty('--mascot-tx', x.toFixed(3) + 'px');
    el.style.setProperty('--mascot-ty', y.toFixed(3) + 'px');
    el.style.setProperty('--mascot-tilt', tilt.toFixed(3) + 'deg');
  }

  function wakeSpring() {
    if (reducedMotion || springOn) return;
    springOn = true;
    lastT = 0;
    requestAnimationFrame(stepSpring);
  }

  function stepSpring(t) {
    var dt = lastT ? Math.min(0.034, (t - lastT) / 1000) : 0.016;
    lastT = t;
    ['x', 'y'].forEach(function (k) {
      var force = STIFFNESS * (target[k] - pos[k]) - DAMPING * vel[k];
      vel[k] += force * dt;
      pos[k] += vel[k] * dt;
    });

    var px = pos.x * SHIFT_X;
    var py = pos.y * SHIFT_Y;
    var speed = vel.x * SHIFT_X;
    var tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, speed * TILT * 60));

    var resting =
      Math.abs(target.x - pos.x) < 0.002 &&
      Math.abs(target.y - pos.y) < 0.002 &&
      Math.abs(vel.x) < 0.004 &&
      Math.abs(vel.y) < 0.004;

    if (resting || !visible) {
      var dpr = window.devicePixelRatio || 1;
      pos.x = target.x;
      pos.y = target.y;
      vel.x = 0;
      vel.y = 0;
      setLean(Math.round(target.x * SHIFT_X * dpr) / dpr, Math.round(target.y * SHIFT_Y * dpr) / dpr, 0);
      springOn = false;
      return;
    }
    setLean(px, py, tilt);
    requestAnimationFrame(stepSpring);
  }

  // ---- speech bubble --------------------------------------------------------
  //
  // Poke her once or twice and she just makes a face. Keep going and she
  // says something, softly, and a little differently each time.

  var bubble = document.createElement('span');
  bubble.className = 'atelier-mascot-bubble';
  bubble.setAttribute('aria-hidden', 'true');
  el.appendChild(bubble);
  var bubbleTimer = 0;
  var lastLine = '';

  var LINES = [
    { face: GASP, lines: ['ouch!', 'oof!', 'ow, gently!'] },
    { face: SHY, lines: ['hey, that tickles', 'hehe, careful', 'that’s my nose!'] },
    { face: GIGGLE, lines: ['okay okay, I’m here', 'hi, yes, hello!', 'still here!'] },
    { face: THINKING, lines: ['you really like poking, huh?', 'is this a usability test?', 'noted. very important feedback.'] },
  ];

  function say(text) {
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.classList.remove('is-out');
    bubble.classList.add('is-in');
    bubbleTimer = setTimeout(function () {
      bubble.classList.add('is-out');
      bubble.classList.remove('is-in');
    }, 1700);
  }

  function pick(list, avoid) {
    var options = list.filter(function (x) {
      return x !== avoid;
    });
    return options[Math.floor(Math.random() * options.length)];
  }

  // ---- visitor input --------------------------------------------------------

  var streak = 0;
  var lastPokeAt = 0;
  var lastFace = -1;

  function poke() {
    var t = now();
    streak = t - lastPokeAt < 1400 ? streak + 1 : 1;
    lastPokeAt = t;

    if (streak <= 2) {
      lastFace = pick(FRIENDLY, lastFace);
      react(lastFace, 1300);
      return;
    }

    var step = LINES[Math.min(streak - 3, LINES.length - 1)];
    react(step.face, 1700);
    lastLine = pick(step.lines, lastLine);
    say(lastLine);
    if (streak >= 3 + LINES.length) streak = 0;
  }

  var lastGreet = 0;

  el.addEventListener('pointerenter', function () {
    if (now() - lastGreet < 15000 || reacting >= 0) return;
    lastGreet = now();
    react(GRIN, 1100);
  });

  // Tickle: the pointer reversing direction quickly several times over her.
  var reversals = [];
  var lastDir = 0;

  el.addEventListener('pointermove', function (e) {
    if (Math.abs(e.movementX) < 6) return;
    var dir = e.movementX > 0 ? 1 : -1;
    if (dir === lastDir) return;
    lastDir = dir;
    var t = now();
    reversals = reversals.filter(function (r) {
      return t - r < 900;
    });
    reversals.push(t);
    if (reversals.length >= 5) {
      reversals = [];
      react(GIGGLE, 1300);
    }
  });

  var lastStarry = 0;

  document.addEventListener('pointerover', function (e) {
    var hovered = e.target.closest && e.target.closest('a, button');
    if (!hovered || el.contains(hovered)) return;
    if (now() - lastStarry < 8000 || Math.random() > 0.35) return;
    lastStarry = now();
    autoReact(STARRY, 900);
  });

  var aimQueued = false;

  function queueAim() {
    if (aimQueued) return;
    aimQueued = true;
    requestAnimationFrame(function () {
      aimQueued = false;
      aim();
    });
  }

  window.addEventListener(
    'pointermove',
    function (e) {
      pointer = { x: e.clientX, y: e.clientY };
      queueAim();
    },
    { passive: true }
  );

  // Scrolling moves her under a cursor that is standing still, so she has to
  // re-aim then too, or she keeps staring where the cursor used to be.
  window.addEventListener('scroll', queueAim, { passive: true });

  el.addEventListener('click', poke);
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      poke();
    }
  });

  // ---- breeze ---------------------------------------------------------------
  //
  // An SVG filter displaces the picture by a noise field. The noise is
  // multiplied by a mask that is zero over the face, crown and body centre, so
  // only the long hair at the sides moves. The noise drifts back and forth and
  // its strength swells and fades, which reads as a gust.

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MASK =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
        '<defs>' +
        '<linearGradient id="h" x1="0" x2="1">' +
        '<stop offset="0" stop-color="#fff"/><stop offset=".24" stop-color="#fff"/>' +
        '<stop offset=".38" stop-color="#000"/><stop offset=".62" stop-color="#000"/>' +
        '<stop offset=".76" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>' +
        '</linearGradient>' +
        '<linearGradient id="v" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset=".28" stop-color="#000"/><stop offset=".5" stop-color="#fff"/>' +
        '</linearGradient>' +
        '<mask id="m"><rect width="100" height="100" fill="url(#v)"/></mask>' +
        '</defs>' +
        '<rect width="100" height="100" fill="#000"/>' +
        '<rect width="100" height="100" fill="url(#h)" mask="url(#m)"/>' +
        '</svg>'
    );

  var breeze = null;

  function buildBreeze() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML =
      '<filter id="mascot-breeze" x="-10%" y="-5%" width="120%" height="110%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.035" numOctaves="2" seed="7" result="noise"/>' +
      '<feOffset in="noise" dx="0" dy="0" result="flow"/>' +
      // Opaque noise, so the arithmetic below works on plain colour values.
      '<feColorMatrix in="flow" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="solid"/>' +
      '<feImage preserveAspectRatio="none" x="0" y="0" width="340" height="400" result="mask"/>' +
      // map = 0.5 + (noise - 0.5) * mask: neutral (no displacement) where mask is 0.
      '<feComposite in="solid" in2="mask" operator="arithmetic" k1="1" k2="0" k3="-0.5" k4="0.5" result="map"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>';
    document.body.appendChild(svg);
    var image = svg.querySelector('feImage');
    image.setAttribute('href', MASK);
    breeze = {
      offset: svg.querySelector('feOffset'),
      image: image,
      displace: svg.querySelector('feDisplacementMap'),
      running: false,
    };
  }

  function gust() {
    if (!breeze || breeze.running || !visible) return;
    var rect = el.getBoundingClientRect();
    breeze.image.setAttribute('width', rect.width);
    breeze.image.setAttribute('height', rect.height);
    breeze.running = true;
    el.classList.add('is-breezy');

    var DURATION = 2600;
    var start = performance.now();
    var strength = 7 + Math.random() * 5;
    var dir = Math.random() < 0.5 ? -1 : 1;

    function step(t) {
      var p = (t - start) / DURATION;
      if (p >= 1) {
        breeze.displace.setAttribute('scale', '0');
        el.classList.remove('is-breezy');
        breeze.running = false;
        return;
      }
      var swell = Math.pow(Math.sin(Math.PI * p), 2);
      var phase = (t - start) / 1000;
      breeze.displace.setAttribute('scale', (strength * swell).toFixed(2));
      breeze.offset.setAttribute('dx', (dir * 22 * Math.sin(phase * 4.2)).toFixed(1));
      breeze.offset.setAttribute('dy', (8 * Math.sin(phase * 2.7)).toFixed(1));
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function scheduleBreeze() {
    clearTimeout(breezeTimer);
    if (!breeze) return;
    breezeTimer = setTimeout(function () {
      gust();
      scheduleBreeze();
    }, 8000 + Math.random() * 9000);
  }

  // ---- start / pause --------------------------------------------------------

  if (!reducedMotion) buildBreeze();

  function start() {
    scheduleBlink();
    scheduleBreeze();
  }

  function stop() {
    clearTimeout(blinkTimer);
    clearTimeout(breezeTimer);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else stop();
    }).observe(el);
  } else {
    start();
  }
})();
