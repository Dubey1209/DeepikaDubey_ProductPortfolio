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
//   click / Enter / Space       a face that suits where she was touched; keep
//                               going and she says something about it
//   any link or button hovered  sometimes starry
//
// One character, not a slideshow:
//   - An expression changes only her face. The reaction faces are drawn on
//     separate layers masked to a soft oval over the eyes, nose and mouth, and
//     the build aligns each one onto the centre direction frame's face. Her
//     hair, outline and sweater never change for an expression, so nothing
//     flickers around the edges and she reads as the same drawing.
//   - Turning her head does swap the whole drawing, so that is a true
//     cross-fade: the new frame fades in while the old one fades out on an
//     overlapping curve. Hiding the old frame only once the new one is opaque
//     made the outline jump at the end of every fade. A change that arrives
//     mid-fade waits for it to finish instead of cutting it short.
//   - She only turns once the cursor has settled on a new direction for a
//     moment, and the closer the cursor, the further it has to move before she
//     turns. Near her, small movements sweep through every angle, which used to
//     flip her head back and forth.
//   - The lean towards the cursor is a spring, not a CSS transition. Turning
//     her head and being poked each give it a small push, so she sways into a
//     turn and flinches from a poke instead of only changing frame.
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
  var CENTRE = 4;
  // Reactions whose drawing reaches outside the face (her hand), so they
  // replace the whole figure rather than only the face.
  var WHOLE = [THINKING];

  var visible = true;
  var pointer = null;
  var lookIndex = CENTRE;
  var reacting = -1;
  var reactTimer = 0;
  var faceDelay = 0;
  var blinkTimer = 0;
  var breezeTimer = 0;

  function now() {
    return Date.now();
  }

  // Decoded up front: a layer at opacity 0 is not painted, so the first time a
  // sheet was needed it could arrive a frame late and flash empty.
  var decoded = [layerA, layerB].map(function (layer) {
    var match = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(layer).backgroundImage);
    if (!match) return null;
    var img = new Image();
    img.src = match[1];
    if (img.decode) img.decode().catch(function () {});
    return img;
  });

  // ---- frames ---------------------------------------------------------------

  function makeLayer() {
    var layer = document.createElement('span');
    layer.className = 'atelier-mascot-layer atelier-mascot-face';
    layer.setAttribute('aria-hidden', 'true');
    el.insertBefore(layer, layerB.nextSibling);
    return layer;
  }

  function paint(layer, sheet, index) {
    layer.classList.toggle('is-look', sheet === 'look');
    layer.classList.toggle('is-react', sheet === 'react');
    layer.style.backgroundPosition = (index % 3) * 50 + '% ' + Math.floor(index / 3) * 50 + '%';
  }

  // A pair of layers that cross-fades between frames. `key` is the frame
  // showing, or '' when the pair is hidden.
  function Pair(a, b, z, key) {
    this.front = a;
    this.back = b;
    this.z = z;
    this.key = key;
    this.running = null;
    this.next = null;
    a.style.opacity = key ? '1' : '0';
    b.style.opacity = '0';
  }

  Pair.prototype.show = function (sheet, index, ms) {
    var key = sheet + ':' + index;
    if (this.running) {
      this.next = { key: key, sheet: sheet, index: index, ms: ms };
      return;
    }
    if (key === this.key) return;
    var incoming = this.back;
    var outgoing = this.key ? this.front : null;
    this.back = this.front;
    this.front = incoming;
    this.key = key;
    paint(incoming, sheet, index);
    incoming.style.zIndex = String(this.z + 1);
    this.back.style.zIndex = String(this.z);
    this.fade(incoming, outgoing, ms);
  };

  Pair.prototype.hide = function (ms) {
    if (this.running) {
      this.next = { key: '', ms: ms };
      return;
    }
    if (!this.key) return;
    this.key = '';
    this.fade(null, this.front, ms);
  };

  // The incoming frame rises over the first ~60% of the time and the outgoing
  // one falls over the last ~60%, so in the middle both are nearly opaque: no
  // dip in density, and no edge left to vanish at the end.
  Pair.prototype.fade = function (incoming, outgoing, ms) {
    if (incoming) incoming.style.opacity = '1';
    if (outgoing) outgoing.style.opacity = '0';
    if (reducedMotion || !ms || typeof el.animate !== 'function') return;

    var both = incoming && outgoing;
    var span = both ? ms * 0.62 : ms;
    var anims = [];
    if (incoming) {
      anims.push(
        incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: span,
          easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
        })
      );
    }
    if (outgoing) {
      anims.push(
        outgoing.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: span,
          delay: both ? ms - span : 0,
          easing: 'cubic-bezier(0.45, 0, 0.6, 1)',
          fill: 'backwards',
        })
      );
    }

    var self = this;
    this.running = anims;
    var done = function () {
      if (self.running !== anims) return;
      self.running = null;
      var next = self.next;
      self.next = null;
      if (!next) return;
      if (next.key) self.show(next.sheet, next.index, next.ms);
      else self.hide(next.ms);
    };
    Promise.all(
      anims.map(function (a) {
        return a.finished;
      })
    ).then(done, done);
  };

  var body = new Pair(layerA, layerB, 1, 'look:' + CENTRE);
  var face = new Pair(makeLayer(), makeLayer(), 3, '');
  paint(layerA, 'look', CENTRE);

  // ---- reactions ------------------------------------------------------------

  function react(index, ms) {
    reacting = index;
    clearTimeout(faceDelay);
    clearTimeout(reactTimer);
    if (ms) reactTimer = setTimeout(endReaction, ms);

    if (WHOLE.indexOf(index) >= 0) {
      face.hide(200);
      body.show('react', index, 300);
      return;
    }
    // The faces look straight out, so she turns to the front first.
    var turning = body.key !== 'look:' + CENTRE;
    body.show('look', CENTRE, 240);
    if (turning) {
      faceDelay = setTimeout(function () {
        face.show('react', index, 180);
      }, 160);
    } else {
      face.show('react', index, 180);
    }
  }

  function endReaction(ms) {
    clearTimeout(reactTimer);
    clearTimeout(faceDelay);
    reacting = -1;
    face.hide(ms || 280);
    body.show('look', lookIndex, 300);
  }

  // Reactions she starts herself never cut off one the visitor caused, and
  // never turn her head away from where she is looking.
  function autoReact(index, ms) {
    if (visible && reacting < 0 && lookIndex === CENTRE) react(index, ms);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (reducedMotion) return;
    blinkTimer = setTimeout(function () {
      blink();
      // Now and then a double blink, which reads as more alive than a metronome.
      if (Math.random() < 0.22) setTimeout(blink, 380);
      scheduleBlink();
    }, 2800 + Math.random() * 3600);
  }

  // Lids close fast and open a little slower, as real ones do. Only the face
  // layer moves, so a blink touches nothing but the eyes.
  function blink() {
    if (!visible || reacting >= 0 || lookIndex !== CENTRE || body.key !== 'look:' + CENTRE) return;
    face.show('react', BLINK, 70);
    setTimeout(function () {
      if (reacting < 0) face.hide(130);
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
  var ENTER = 0.45;
  var LEAVE = 0.28;
  // She settles on a direction only once the cursor has held it this long.
  var SETTLE_MS = 110;

  function axis(current, v) {
    if (current === 0) return v < -LEAVE ? 0 : v > ENTER ? 2 : 1;
    if (current === 2) return v > LEAVE ? 2 : v < -ENTER ? 0 : 1;
    return v < -ENTER ? 0 : v > ENTER ? 2 : 1;
  }

  var wantLook = CENTRE;
  var lookTimer = 0;

  function requestLook(index) {
    if (index === wantLook) return;
    wantLook = index;
    clearTimeout(lookTimer);
    if (index !== lookIndex) lookTimer = setTimeout(commitLook, SETTLE_MS);
  }

  function commitLook() {
    if (wantLook === lookIndex) return;
    var turnX = (wantLook % 3) - (lookIndex % 3);
    var turnY = Math.floor(wantLook / 3) - Math.floor(lookIndex / 3);
    lookIndex = wantLook;
    if (reacting >= 0) return;
    body.show('look', lookIndex, 300);
    nudge(turnX * 0.55, turnY * 0.3);
  }

  function aim() {
    if (!pointer || !visible) return;
    var rect = el.getBoundingClientRect();
    var dx = pointer.x - (rect.left + rect.width / 2);
    // Aim at the face, which sits in the upper part of the figure.
    var dy = pointer.y - (rect.top + rect.height * 0.42);
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
      // Direction scaled down inside a radius around her: far away only the
      // angle matters, close by it takes a real move to turn her head.
      var reach = Math.max(dist, rect.width * 0.95);
      col = axis(col, dx / reach);
      row = axis(row, dy / reach);
    }
    requestLook(row * 3 + col);

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

  // A push to the spring's velocity: the sway of a head turn, a flinch.
  function nudge(x, y) {
    if (reducedMotion) return;
    vel.x += x;
    vel.y += y;
    wakeSpring();
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
  // Words drift in one after another, softly, the way a thought forms, and
  // the note floats away when she is done.

  var bubble = document.createElement('span');
  bubble.className = 'atelier-mascot-bubble';
  bubble.setAttribute('aria-hidden', 'true');
  el.appendChild(bubble);
  var bubbleTimer = 0;

  function say(text, hold) {
    clearTimeout(bubbleTimer);
    bubble.textContent = '';
    var words = text.split(' ');
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'atelier-mascot-word is-pre';
      span.style.setProperty('--i', String(i));
      span.textContent = word;
      bubble.appendChild(span);
      if (i < words.length - 1) bubble.appendChild(document.createTextNode(' '));
    });
    bubble.classList.remove('is-out');
    bubble.classList.add('is-in');
    // Read layout so the words start from their hidden state, then release them.
    void bubble.offsetWidth;
    Array.prototype.forEach.call(bubble.querySelectorAll('.is-pre'), function (span) {
      span.classList.remove('is-pre');
    });
    bubbleTimer = setTimeout(function () {
      bubble.classList.add('is-out');
      bubble.classList.remove('is-in');
    }, hold);
  }

  // ---- being poked ----------------------------------------------------------
  //
  // Where she is touched decides how she reacts, and each line belongs to the
  // face she is making while she says it. The first poke gets only the face;
  // after that she talks, and if it keeps going she starts teasing back.

  var SPOTS = {
    nose: { face: GASP, lines: ['boop! …that was my nose', 'eep, my nose!', 'hey, not the nose!'] },
    eye: { face: BLINK, lines: ['ow, my eye!', 'careful, I need those', 'can’t see you now…'] },
    cheek: { face: SHY, lines: ['aww, you’re making me blush', 'oh… stop it', 'hehe, my cheek'] },
    mouth: { face: GIGGLE, lines: ['pfft, hehe', 'mmf! hi!', 'hehe, I was about to say something'] },
    forehead: { face: WINK, lines: ['boop received', 'knock knock, yes I’m home', 'tap tap, hi!'] },
    hair: { face: GASP, lines: ['not the hair!', 'I just fixed that!', 'hey, my hair!'] },
    chin: { face: GIGGLE, lines: ['hehe, ticklish there', 'that tickles!', 'hehe, stop it'] },
    sweater: { face: GIGGLE, lines: ['hehe, that tickles!', 'careful, comfy sweater', 'hehe, I’m ticklish'] },
    hello: { face: GRIN, lines: ['hi! you found me', 'hello there!', 'hehe, hi!'] },
  };

  var TEASE = [
    { face: THINKING, lines: ['hmm… is this a usability test?', 'you really like poking, huh?'] },
    { face: SHY, lines: ['okay, I think you like me', 'you’re kind of sweet, you know'] },
    { face: STARRY, lines: ['fine, you win. hi, friend!', 'okay okay, hello to you too!'] },
  ];

  // Measured on the centre frame, as fractions of the box: eyes at y .36–.44,
  // the nose tip at (.555, .47), the mouth at y .51, the face centred on .535.
  function spotAt(e) {
    if (!e || typeof e.clientX !== 'number' || (e.clientX === 0 && e.clientY === 0)) return 'hello';
    var rect = el.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width;
    var y = (e.clientY - rect.top) / rect.height;
    var fx = x - 0.535;
    if (y > 0.62) return 'sweater';
    if (y > 0.545) return x > 0.36 && x < 0.72 ? 'chin' : 'sweater';
    if (y < 0.25 || Math.abs(fx) > 0.2) return 'hair';
    if (y < 0.345) return 'forehead';
    if (y < 0.445) return Math.abs(fx) < 0.05 ? 'nose' : 'eye';
    if (y < 0.495) return Math.abs(x - 0.555) < 0.045 ? 'nose' : 'cheek';
    return Math.abs(fx) < 0.09 ? 'mouth' : 'cheek';
  }

  // The last few lines said, so a spot runs through all of its lines before
  // any comes round again.
  var recent = [];

  function pickLine(lines) {
    var options = lines.filter(function (line) {
      return recent.indexOf(line) < 0;
    });
    if (!options.length) options = lines;
    var line = options[Math.floor(Math.random() * options.length)];
    recent.push(line);
    if (recent.length > 2) recent.shift();
    return line;
  }

  var streak = 0;
  var lastPokeAt = 0;

  function poke(e) {
    var t = now();
    streak = t - lastPokeAt < 1600 ? streak + 1 : 1;
    lastPokeAt = t;

    var spot = spotAt(e);
    var step = streak >= 5 ? TEASE[Math.min(streak - 5, TEASE.length - 1)] : SPOTS[spot];

    // A small flinch away from the finger.
    if (e && typeof e.clientX === 'number') {
      var rect = el.getBoundingClientRect();
      nudge(e.clientX < rect.left + rect.width / 2 ? 0.7 : -0.7, -0.35);
    }

    if (streak === 1) {
      react(step.face, 1300);
      return;
    }
    var line = pickLine(step.lines);
    var hold = Math.min(3200, 1500 + line.length * 40);
    react(step.face, hold);
    say(line, hold);
    if (streak >= 5 + TEASE.length - 1) streak = 0;
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
      poke(null);
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
