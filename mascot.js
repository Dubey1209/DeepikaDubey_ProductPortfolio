// About-section mascot: looks towards the cursor, reacts when poked, blinks on
// its own, and dozes off when left alone.
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
  var SLEEPY = 8;
  var POKES = [1, 2, 3, 4, 5, 6, 7];
  var DOZE_AFTER_MS = 20000;

  var reactTimer = 0;
  var blinkTimer = 0;
  var dozeTimer = 0;
  var lastPoke = -1;
  var visible = true;
  var pointer = null;
  var frameQueued = false;

  function position(layer, index) {
    var col = index % 3;
    var row = Math.floor(index / 3);
    layer.style.backgroundPosition = col * 50 + '% ' + row * 50 + '%';
  }

  var current = -1;

  function showReaction(index, ms) {
    current = index;
    position(react, index);
    el.classList.add('is-reacting');
    clearTimeout(reactTimer);
    if (ms) {
      reactTimer = setTimeout(function () {
        el.classList.remove('is-reacting');
      }, ms);
    }
  }

  function endReaction() {
    clearTimeout(reactTimer);
    el.classList.remove('is-reacting');
  }

  function lookAt(x, y) {
    var rect = el.getBoundingClientRect();
    var dx = x - (rect.left + rect.width / 2);
    // Aim at the face, which sits in the upper part of the card.
    var dy = y - (rect.top + rect.height * 0.38);
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Close to the face she looks straight out rather than flicking between
    // frames as the cursor crosses the centre.
    var col = 1;
    var row = 1;
    var nx = dist ? dx / dist : 0;
    var ny = dist ? dy / dist : 0;
    if (dist > rect.width * 0.3) {
      col = nx < -0.38 ? 0 : nx > 0.38 ? 2 : 1;
      row = ny < -0.38 ? 0 : ny > 0.38 ? 2 : 1;
    }
    position(look, row * 3 + col);

    // The nine frames are steps; this is the continuous part. It grows with
    // distance so a cursor resting near her face barely moves her.
    var pull = Math.min(1, dist / (rect.width * 1.6));
    el.style.setProperty('--mascot-x', (nx * pull).toFixed(3));
    el.style.setProperty('--mascot-y', (ny * pull).toFixed(3));
  }

  function onFrame() {
    frameQueued = false;
    if (pointer && visible) lookAt(pointer.x, pointer.y);
  }

  function scheduleDoze() {
    clearTimeout(dozeTimer);
    if (reducedMotion) return;
    dozeTimer = setTimeout(function () {
      if (visible) showReaction(SLEEPY, 0);
    }, DOZE_AFTER_MS);
  }

  function wake() {
    if (el.classList.contains('is-reacting') && current === SLEEPY) {
      endReaction();
    }
    scheduleDoze();
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (reducedMotion) return;
    blinkTimer = setTimeout(function () {
      if (visible && !el.classList.contains('is-reacting')) showReaction(BLINK, 140);
      scheduleBlink();
    }, 2800 + Math.random() * 3200);
  }

  function poke() {
    var pick;
    do {
      pick = POKES[Math.floor(Math.random() * POKES.length)];
    } while (pick === lastPoke);
    lastPoke = pick;
    showReaction(pick, 1100);
    scheduleDoze();
  }

  window.addEventListener(
    'pointermove',
    function (e) {
      pointer = { x: e.clientX, y: e.clientY };
      wake();
      if (!frameQueued) {
        frameQueued = true;
        requestAnimationFrame(onFrame);
      }
    },
    { passive: true }
  );

  el.addEventListener('click', poke);
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      poke();
    }
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) {
        scheduleBlink();
        scheduleDoze();
      } else {
        clearTimeout(blinkTimer);
        clearTimeout(dozeTimer);
      }
    }).observe(el);
  } else {
    scheduleBlink();
    scheduleDoze();
  }
})();
