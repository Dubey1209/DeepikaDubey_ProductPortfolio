// About-section mascot: looks towards the cursor, reacts to what the visitor
// does, blinks and breathes on her own, and now and then a breeze lifts her
// hair.
//
// Plain-JS take on the page-mascot idea (github.com/nilbuild/page-mascot),
// which is a React component; this site has no React and no build step. The
// two sheets are 3x3 grids built by tools/build-mascot.mjs:
//
//   directions  row = up / level / down, column = left / centre / right
//   reactions   0 blink   1 wink      2 grin
//               3 gasp    4 giggle    5 shy
//               6 starry  7 thinking  8 sleepy
//
// What triggers each reaction:
//   pointer arrives on her      grin (at most every 15s)
//   pointer rests on her face   shy
//   pointer scrubs over her     giggle (tickled)
//   click / Enter / Space       wink, grin, gasp, giggle, starry or shy
//   four quick clicks           thinking ("what are you doing?")
//   any link or button hovered  sometimes starry
//
// Every reaction frame faces straight out, so the ones she starts herself
// (blinks, starry) wait until she is looking straight out too. Otherwise a
// cursor resting off to one side would see her head snap to the front and
// back. For the same reason there is no idle or sleepy reaction: left alone,
// she keeps looking wherever the cursor was left.
//
// Reactions change only the face. The figure never scales or jumps, which
// read as the whole character shrinking and growing.
//
// The markup works without this script: CSS shows the centre direction frame.

(function () {
  'use strict';

  var el = document.querySelector('.atelier-mascot');
  if (!el) return;

  var look = el.querySelector('.atelier-mascot-look');
  var react = el.querySelector('.atelier-mascot-react');
  if (!look || !react) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BLINK = 0;
  var WINK = 1;
  var GRIN = 2;
  var GASP = 3;
  var GIGGLE = 4;
  var SHY = 5;
  var STARRY = 6;
  var THINKING = 7;
  var POKES = [WINK, GRIN, GASP, GIGGLE, STARRY, SHY];
  var CENTRE = 4;

  var current = -1;
  var lookIndex = CENTRE;
  var reactTimer = 0;
  var blinkTimer = 0;
  var breezeTimer = 0;
  var lastPoke = -1;
  var visible = true;
  var pointer = null;
  var frameQueued = false;

  function now() {
    return Date.now();
  }

  function position(layer, index) {
    var col = index % 3;
    var row = Math.floor(index / 3);
    layer.style.backgroundPosition = col * 50 + '% ' + row * 50 + '%';
  }

  function isReacting() {
    return el.classList.contains('is-reacting');
  }

  function showReaction(index, ms) {
    current = index;
    position(react, index);
    el.classList.add('is-reacting');
    clearTimeout(reactTimer);
    if (ms) {
      reactTimer = setTimeout(endReaction, ms);
    }
  }

  // Reactions she starts herself never cut off one the visitor caused, and
  // never turn her head away from where she is looking.
  function autoReaction(index, ms) {
    if (visible && !isReacting() && lookIndex === CENTRE) showReaction(index, ms);
  }

  function endReaction() {
    clearTimeout(reactTimer);
    el.classList.remove('is-reacting');
    current = -1;
  }

  // ---- gaze ---------------------------------------------------------------

  var faceSince = 0;

  function lookAt(x, y) {
    var rect = el.getBoundingClientRect();
    var dx = x - (rect.left + rect.width / 2);
    // Aim at the face, which sits in the upper part of the figure.
    var dy = y - (rect.top + rect.height * 0.38);
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Close to the face she looks straight out rather than flicking between
    // frames as the cursor crosses the centre.
    var col = 1;
    var row = 1;
    var nx = dist ? dx / dist : 0;
    var ny = dist ? dy / dist : 0;
    var nearFace = dist <= rect.width * 0.3;
    if (!nearFace) {
      col = nx < -0.38 ? 0 : nx > 0.38 ? 2 : 1;
      row = ny < -0.38 ? 0 : ny > 0.38 ? 2 : 1;
    }
    lookIndex = row * 3 + col;
    position(look, lookIndex);

    // The nine frames are steps; this is the continuous part. It grows with
    // distance so a cursor resting near her face barely moves her.
    var pull = Math.min(1, dist / (rect.width * 1.6));
    el.style.setProperty('--mascot-x', (nx * pull).toFixed(3));
    el.style.setProperty('--mascot-y', (ny * pull).toFixed(3));

    if (!nearFace) {
      faceSince = 0;
    } else if (!faceSince) {
      faceSince = now();
    } else if (now() - faceSince > 900 && !isReacting()) {
      showReaction(SHY, 1800);
      faceSince = now() + 4000;
    }
  }

  function onFrame() {
    frameQueued = false;
    if (pointer && visible) lookAt(pointer.x, pointer.y);
  }

  // ---- blinking -------------------------------------------------------------

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (reducedMotion) return;
    blinkTimer = setTimeout(function () {
      // Long enough to outlast the layers' cross-fade, so the eyes fully close.
      autoReaction(BLINK, 180);
      // Now and then a double blink, which reads as more alive than a metronome.
      if (Math.random() < 0.25) {
        setTimeout(function () {
          autoReaction(BLINK, 160);
        }, 400);
      }
      scheduleBlink();
    }, 2600 + Math.random() * 3400);
  }

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

  // ---- visitor input --------------------------------------------------------

  var clicks = [];

  function poke() {
    var t = now();
    clicks = clicks.filter(function (c) {
      return t - c < 2500;
    });
    clicks.push(t);

    if (clicks.length >= 4) {
      clicks = [];
      showReaction(THINKING, 1500);
      return;
    }

    var pick;
    do {
      pick = POKES[Math.floor(Math.random() * POKES.length)];
    } while (pick === lastPoke);
    lastPoke = pick;
    showReaction(pick, 1400);
  }

  var lastGreet = 0;

  el.addEventListener('pointerenter', function () {
    if (now() - lastGreet < 15000 || isReacting()) return;
    lastGreet = now();
    showReaction(GRIN, 1100);
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
      showReaction(GIGGLE, 1300);
    }
  });

  var lastStarry = 0;

  document.addEventListener('pointerover', function (e) {
    var target = e.target.closest && e.target.closest('a, button');
    if (!target || el.contains(target)) return;
    if (now() - lastStarry < 8000 || Math.random() > 0.35) return;
    lastStarry = now();
    autoReaction(STARRY, 900);
  });

  function queueLook() {
    if (!frameQueued) {
      frameQueued = true;
      requestAnimationFrame(onFrame);
    }
  }

  window.addEventListener(
    'pointermove',
    function (e) {
      pointer = { x: e.clientX, y: e.clientY };
      queueLook();
    },
    { passive: true }
  );

  // Scrolling moves her under a cursor that is standing still, so she has to
  // re-aim then too, or she keeps staring where the cursor used to be.
  window.addEventListener('scroll', queueLook, { passive: true });

  el.addEventListener('click', poke);
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      poke();
    }
  });

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
