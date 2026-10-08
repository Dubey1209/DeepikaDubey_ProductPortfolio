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
//   cursor resting on the page  she keeps watching it and, now and then, has
//                               a little moment (a tilt, hearts, a smile)
//
// The cursor comes first: wherever it goes she looks, and a mood she was
// having to herself ends the moment it moves.
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
//   - She tilts only while moving, from the spring's velocity, and only by
//     a degree. Every move pivots at her neck and stays small; swung from
//     the bottom edge she rocked like a cut-out pinned at the base.
//
// The markup works without this script: CSS shows the centre direction frame.

// The reaction sheet (atelier.css, --mascot-react) loads once the page has,
// so it doesn't compete with the fonts and the direction sheet for first
// paint; .has-reactions switches it on everywhere (here and the lock door).
(function () {
  var root = document.documentElement;
  function ready() { root.classList.add('has-reactions'); }
  function load() {
    var match = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(root).getPropertyValue('--mascot-react'));
    if (!match) return ready();
    var img = new Image();
    img.onload = ready;
    img.onerror = ready;
    img.src = match[1];
    if (img.decode) img.decode().then(ready, function () {});
  }
  function soon() {
    if (window.requestIdleCallback) window.requestIdleCallback(load, { timeout: 1500 });
    else setTimeout(load, 300);
  }
  if (document.readyState === 'complete') soon();
  else window.addEventListener('load', soon, { once: true });
})();

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
  // Cell 6 (star eyes) read as blurry, oversized sparkles, so her "excited"
  // moments use the open grin instead.
  var STARRY = GRIN;
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
    // Until the reaction sheet has arrived, a reaction holds the centre frame
    // rather than fading to an empty layer.
    if (sheet === 'react' && !document.documentElement.classList.contains('has-reactions')) {
      sheet = 'look';
      index = CENTRE;
    }
    var position = (index % 3) * 50 + '% ' + Math.floor(index / 3) * 50 + '%';
    layer.classList.toggle('is-look', sheet === 'look');
    layer.classList.toggle('is-react', sheet === 'react');
    layer.style.backgroundPosition = position;
    // Face layers have one mask per reaction, laid out like the sheet.
    layer.style.webkitMaskPosition = position;
    layer.style.maskPosition = position;
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

  // A new frame never waits for the last fade: that queue is what made her
  // trail the cursor. The running fade is jumped to its end (it is short,
  // so the jump does not show) and the new one starts from there.
  Pair.prototype.settle = function () {
    var running = this.running;
    if (!running) return;
    this.running = null;
    this.next = null;
    running.forEach(function (a) {
      a.finish();
    });
  };

  Pair.prototype.show = function (sheet, index, ms) {
    var key = sheet + ':' + index;
    if (key === this.key && !this.running) return;
    this.settle();
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
    this.settle();
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

  // Expressions are eased in and out slowly enough to read as a feeling
  // passing over her face; at the old 180ms they flickered like a slideshow.
  // Blinks stay quick, as real ones are.
  var FACE_IN_MS = 360;
  var FACE_OUT_MS = 520;
  var TO_FRONT_MS = 400;

  // Whether the running reaction is one she started herself (idle, a passing
  // mood). Those give way the moment the visitor points somewhere else.
  var reactAuto = false;

  // Where her cheeks sit in each direction frame, relative to the centre one
  // (% of the box, measured off the sheet), so the blush turns with her.
  var FACE_OFFSET = [
    [-3.3, -3.6], [2.2, -3.8], [2.5, -3.6],
    [-4, 0.2], [0, 0], [3.1, 0.1],
    [-5, 2.4], [2.7, 1.8], [3.7, 2.4],
  ];

  function setFaceOffset(index) {
    var at = FACE_OFFSET[index] || FACE_OFFSET[CENTRE];
    el.style.setProperty('--face-dx', at[0] + '%');
    el.style.setProperty('--face-dy', at[1] + '%');
  }

  // The reaction faces are drawn looking straight out. With the cursor off
  // to one side, turning to the front for one would mean looking away from
  // it, so she keeps her eyes on it and shows the feeling another way: a
  // blush, a nod, a hop, a thought mark.
  function heldReaction(index, ms) {
    if (index === SHY) {
      blushFor(ms || 2400);
      moveBody('tilt');
    } else if (index === GRIN || index === WINK) {
      moveBody('nod');
    } else if (index === GIGGLE) {
      moveBody('squish');
    } else if (index === GASP) {
      moveBody('jump');
    } else if (index === THINKING || index === UNIMPRESSED) {
      moveBody('tilt');
      burst('ask');
    }
  }

  function cursorAside() {
    return !!pointer && wantLook !== CENTRE;
  }

  function react(index, ms, auto) {
    if (cursorAside()) {
      if (reacting >= 0) endReaction(TURN_MS);
      if (index !== BLINK) heldReaction(index, ms);
      return;
    }
    reacting = index;
    reactAuto = !!auto;
    clearTimeout(faceDelay);
    clearTimeout(reactTimer);
    if (ms) reactTimer = setTimeout(endReaction, ms);
    var faceIn = index === BLINK ? 110 : FACE_IN_MS;

    if (WHOLE.indexOf(index) >= 0) {
      face.hide(260);
      body.show('react', index, TO_FRONT_MS);
      return;
    }
    // The faces look straight out, so she turns to the front first. Coming
    // out of a whole-figure pose (thinking) is not a turn: the face comes in
    // with the body, or her plain face flashed between the two expressions.
    var turning = body.key.indexOf('look:') === 0 && body.key !== 'look:' + CENTRE;
    body.show('look', CENTRE, TO_FRONT_MS);
    if (turning) {
      faceDelay = setTimeout(function () {
        face.show('react', index, faceIn);
      }, TO_FRONT_MS * 0.7);
    } else {
      face.show('react', index, faceIn);
    }
  }

  function endReaction(ms) {
    clearTimeout(reactTimer);
    clearTimeout(faceDelay);
    reacting = -1;
    reactAuto = false;
    face.hide(ms || FACE_OUT_MS);
    // Back to wherever the cursor is now, not where it was when she started.
    lookIndex = wantLook;
    body.show('look', lookIndex, ms || FACE_OUT_MS);
    setFaceOffset(lookIndex);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (reducedMotion) return;
    blinkTimer = setTimeout(function () {
      blink();
      // Now and then a double blink, which reads as more alive than a metronome.
      if (Math.random() < 0.12) setTimeout(blink, 520);
      scheduleBlink();
    }, 3600 + Math.random() * 4400);
  }

  // A soft, unhurried blink: the lids come down, rest a beat and lift a
  // little slower than they fell. Facing front it is the drawn blink face;
  // turned any other way, the lids drawn for that frame
  // (tools/build-blinks.mjs) are laid over her eyes, so she can blink while
  // she keeps looking at the cursor.
  var lids = document.createElement('span');
  lids.className = 'atelier-mascot-layer atelier-mascot-lids';
  lids.setAttribute('aria-hidden', 'true');
  lids.style.zIndex = '3';
  lids.style.opacity = '0';
  el.insertBefore(lids, layerB.nextSibling);

  var LID_DOWN_MS = 180;
  var LID_REST_MS = 90;
  var LID_UP_MS = 340;

  function blink() {
    if (!visible || reacting >= 0 || body.running || body.key !== 'look:' + lookIndex) return;
    if (lookIndex === CENTRE) {
      face.show('react', BLINK, LID_DOWN_MS);
      setTimeout(function () {
        if (reacting < 0) face.hide(LID_UP_MS);
      }, LID_DOWN_MS + LID_REST_MS);
      return;
    }
    if (!document.documentElement.classList.contains('has-reactions') || typeof lids.animate !== 'function') return;
    lids.style.backgroundPosition = (lookIndex % 3) * 50 + '% ' + Math.floor(lookIndex / 3) * 50 + '%';
    // The lid is uncovered from the top down and covered again from the
    // bottom up, so it falls over the eye and lifts off it like a real one;
    // a plain fade showed an open and a closed eye at once halfway through.
    var band = LID_BAND[Math.floor(lookIndex / 3)];
    var open = band[0] + '%';
    var shut = band[1] + '%';
    var total = LID_DOWN_MS + LID_REST_MS + LID_UP_MS;
    lids.animate(
      [
        { opacity: 1, '--lid-y': open, easing: 'cubic-bezier(0.55, 0, 0.8, 0.4)' },
        { opacity: 1, '--lid-y': shut, offset: LID_DOWN_MS / total },
        { opacity: 1, '--lid-y': shut, offset: (LID_DOWN_MS + LID_REST_MS) / total, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' },
        { opacity: 1, '--lid-y': open },
      ],
      { duration: total }
    );
  }

  // The eyes' vertical band in each row of the sheet (% of the box), with the
  // lids' soft edges: looking up the eyes sit higher, looking down lower.
  var LID_BAND = [[27.5, 40.5], [33.5, 47.5], [39.5, 51]];

  // ---- gaze -----------------------------------------------------------------

  var col = 1;
  var row = 1;
  var nearFace = true;
  var faceSince = 0;
  var target = { x: 0, y: 0 };

  // Thresholds with hysteresis: a frame is entered past ENTER and kept until
  // the cursor comes back past LEAVE, so a cursor sitting on a boundary does
  // not flick between two frames.
  // ENTER is about 25 degrees off an axis, so each of the eight directions
  // owns a fair slice of the circle; at 30 degrees she kept staring straight
  // ahead at a cursor that was clearly up and to one side.
  var ENTER = 0.42;
  var LEAVE = 0.22;
  // She settles on a direction only once the cursor has held it this long.
  var SETTLE_MS = 30;
  // A head turn is one quick cross-fade straight to the frame the cursor is
  // in. Only a turn right across (left to right, up to down) passes through
  // the middle, in two fast steps, or both heads showed at once.
  var TURN_MS = 120;
  var STEP_MS = 80;

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
    // Where the cursor is comes first: a face she is pulling lets go the
    // moment it points somewhere else, and she turns straight to it.
    if (reacting >= 0 && index !== CENTRE && pointer) {
      if (reactAuto) {
        momentTimers.forEach(clearTimeout);
        momentTimers = [];
      }
      endReaction(TURN_MS);
      return;
    }
    clearTimeout(lookTimer);
    if (index !== lookIndex) lookTimer = setTimeout(commitLook, SETTLE_MS);
  }

  function commitLook() {
    if (wantLook === lookIndex) return;
    var c = lookIndex % 3;
    var r = Math.floor(lookIndex / 3);
    var dc = (wantLook % 3) - c;
    var dr = Math.floor(wantLook / 3) - r;
    var across = Math.abs(dc) > 1 || Math.abs(dr) > 1;
    var turnX = across ? Math.sign(dc) : dc;
    var turnY = across ? Math.sign(dr) : dr;
    lookIndex = (r + turnY) * 3 + c + turnX;
    if (reacting < 0) {
      body.show('look', lookIndex, across ? STEP_MS : TURN_MS);
      // The head leads with a slight dip, and the body follows through.
      nudge(Math.sign(turnX) * 0.32, Math.sign(turnY) * 0.18 + 0.1);
    }
    setFaceOffset(lookIndex);
    clearTimeout(lookTimer);
    if (lookIndex !== wantLook) lookTimer = setTimeout(commitLook, STEP_MS - 10);
  }

  function aim() {
    if (!pointer || !visible) return;
    var rect = el.getBoundingClientRect();
    var dx = pointer.x - (rect.left + rect.width / 2);
    // Aim at the face, which sits in the upper part of the figure.
    var dy = pointer.y - (rect.top + rect.height * 0.4);
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
      var reach = Math.max(dist, rect.width * 0.7);
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
    } else if (now() - faceSince > 1400 && reacting < 0) {
      react(SHY, 2600, true);
      faceSince = now() + 4000;
    }
  }

  // ---- lean spring ----------------------------------------------------------
  //
  // Critically damped: she eases into a lean and settles without the little
  // bounce back an under-damped spring gave, which read as a toy on a spring.

  var STIFFNESS = 38;
  var DAMPING = 13;
  var SHIFT_X = 5;
  var SHIFT_Y = 3;
  var TILT = 0.003;
  var MAX_TILT = 1;

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
    vel.x += x * 0.45;
    vel.y += y * 0.45;
    wakeSpring();
  }

  // Standing still she still breathes and sways a touch, on slow incommensurate
  // waves so it never repeats like a loop; perfectly motionless between
  // gestures she read as a cut-out.
  // Breathing is slow (a breath every ~4.5s) and mostly a rise and fall; the
  // side-to-side drift is slower still and barely there.
  function sway(t) {
    return {
      x: 0.05 * Math.sin(t / 3900) + 0.025 * Math.sin(t / 2700 + 1.3),
      y: 0.13 * Math.sin(t / 720) + 0.03 * Math.sin(t / 1900 + 0.7),
    };
  }

  function stepSpring(t) {
    var dt = lastT ? Math.min(0.034, (t - lastT) / 1000) : 0.016;
    lastT = t;
    var drift = sway(t);
    ['x', 'y'].forEach(function (k) {
      var force = STIFFNESS * (target[k] + drift[k] - pos[k]) - DAMPING * vel[k];
      vel[k] += force * dt;
      pos[k] += vel[k] * dt;
    });

    var px = pos.x * SHIFT_X;
    var py = pos.y * SHIFT_Y;
    var speed = vel.x * SHIFT_X;
    var tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, speed * TILT * 60));

    if (!visible) {
      var dpr = window.devicePixelRatio || 1;
      pos.x = target.x;
      pos.y = target.y;
      vel.x = 0;
      vel.y = 0;
      setLean(Math.round(target.x * SHIFT_X * dpr) / dpr, Math.round(target.y * SHIFT_Y * dpr) / dpr, 0);
      springOn = false;
      return;
    }
    // Moved by fractions of a pixel, smoothly. Snapping to the pixel grid
    // kept her sharp but made every breath a one-pixel jump, which read as
    // a machine ticking.
    var lean = Math.abs(tilt) < TILT_DEAD ? 0 : tilt - Math.sign(tilt) * TILT_DEAD;
    setLean(px, py, lean);
    requestAnimationFrame(stepSpring);
  }

  var TILT_DEAD = 0.15;

  // ---- speech bubble --------------------------------------------------------
  //
  // Words drift in one after another, softly, the way a thought forms, and
  // the note floats away when she is done.

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgNode(tag, cls) {
    var node = document.createElementNS(SVG_NS, tag);
    if (cls) node.setAttribute('class', cls);
    return node;
  }

  var bubble = document.createElement('span');
  bubble.className = 'atelier-mascot-bubble';
  bubble.setAttribute('aria-hidden', 'true');
  var cloud = document.createElement('span');
  cloud.className = 'atelier-mascot-cloud';
  var cloudSvg = svgNode('svg', 'atelier-mascot-cloud-art');
  var cloudShade = svgNode('path', 'atelier-mascot-cloud-shade');
  var cloudLine = svgNode('path', 'atelier-mascot-cloud-line');
  var puffs = [svgNode('g', 'atelier-mascot-puff is-near'), svgNode('g', 'atelier-mascot-puff is-far')];
  puffs.forEach(function (puff) {
    puff.appendChild(svgNode('circle', 'atelier-mascot-cloud-shade'));
    puff.appendChild(svgNode('circle', 'atelier-mascot-cloud-line'));
    cloudSvg.appendChild(puff);
  });
  cloudSvg.appendChild(cloudShade);
  cloudSvg.appendChild(cloudLine);
  var bubbleText = document.createElement('span');
  bubbleText.className = 'atelier-mascot-bubble-text';
  cloud.appendChild(cloudSvg);
  cloud.appendChild(bubbleText);
  bubble.appendChild(cloud);
  el.appendChild(bubble);
  var bubbleTimer = 0;

  // A cloud drawn around the line's box: points spaced evenly round a rounded
  // rectangle (a superellipse), joined by arcs that bulge outward. The bumps
  // vary a little, seeded by the text so the same line keeps the same cloud.
  function cloudPath(w, h, text) {
    var seed = 7;
    for (var c = 0; c < text.length; c += 1) seed = (seed * 31 + text.charCodeAt(c)) % 233280;
    function rand() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
    var a = w / 2, b = h / 2, n = 3.2, steps = 240;
    var pts = [], lens = [0];
    for (var i = 0; i <= steps; i += 1) {
      var t = (i / steps) * Math.PI * 2 + 2.2;
      var cos = Math.cos(t), sin = Math.sin(t);
      pts.push([
        a + a * (cos < 0 ? -1 : 1) * Math.pow(Math.abs(cos), 2 / n),
        b + b * (sin < 0 ? -1 : 1) * Math.pow(Math.abs(sin), 2 / n),
      ]);
      if (i) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    var total = lens[steps];
    var count = Math.max(7, Math.round(total / 36));
    var step = total / count;
    var marks = [];
    for (var k = 0, j = 0; k < count; k += 1) {
      var at = k * step + (k ? (rand() - 0.5) * step * 0.3 : 0);
      while (j < steps && lens[j + 1] < at) j += 1;
      var f = (at - lens[j]) / (lens[j + 1] - lens[j] || 1);
      marks.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]);
    }
    var d = 'M' + marks[0][0].toFixed(1) + ' ' + marks[0][1].toFixed(1);
    for (var m = 1; m <= count; m += 1) {
      var p = marks[m % count], q = marks[m - 1];
      var r = Math.hypot(p[0] - q[0], p[1] - q[1]) * (0.53 + rand() * 0.12);
      d += 'A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }
    return d + 'Z';
  }

  function drawCloud(text) {
    var w = cloud.offsetWidth, h = cloud.offsetHeight;
    var d = cloudPath(w, h, text);
    cloudShade.setAttribute('d', d);
    cloudLine.setAttribute('d', d);
    // Two small puffs trail from the cloud's edge towards the top of her
    // head, like a thought, wherever the page puts the cloud; when the cloud
    // already sits on her head there's no gap to bridge and they hide. Rects
    // are divided by the cloud's own scale so the pop-in doesn't skew them.
    var box = el.getBoundingClientRect(), at = cloud.getBoundingClientRect();
    var k = at.width / w || 1;
    var cx = w / 2, cy = h / 2;
    var leftOfHer = at.left + at.width / 2 < box.left + box.width / 2;
    var hx = box.left + box.width * (leftOfHer ? 0.42 : 0.58);
    var vx = (hx - at.left) / k - cx;
    var vy = ((box.top + box.height * 0.14) - at.top) / k - cy;
    var len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
    var edge = 1 / Math.pow(Math.pow(Math.abs(vx) / cx, 3.2) + Math.pow(Math.abs(vy) / cy, 3.2), 1 / 3.2);
    var room = Math.max(0, len - edge);
    var near = Math.min(12, room * 0.35), far = Math.min(25, room * 0.75);
    var show = room > 10;
    var spots = [
      [cx + vx * (edge + near), cy + vy * (edge + near), show ? 5.5 : 0],
      [cx + vx * (edge + far), cy + vy * (edge + far), show ? 3.4 : 0]
    ];
    puffs.forEach(function (puff, i) {
      Array.prototype.forEach.call(puff.childNodes, function (circle) {
        circle.setAttribute('cx', spots[i][0].toFixed(1));
        circle.setAttribute('cy', spots[i][1].toFixed(1));
        circle.setAttribute('r', String(spots[i][2]));
      });
    });
  }

  // A new line while one is showing: the old cloud shrinks away for a moment
  // and the new one pops in, rather than the words and the cloud's shape
  // jumping in a single frame.
  var swapTimer = 0;
  function say(text, hold) {
    clearTimeout(bubbleTimer);
    clearTimeout(swapTimer);
    if (bubble.classList.contains('is-in') && !reducedMotion) {
      bubble.classList.add('is-swap');
      swapTimer = setTimeout(function () {
        bubble.classList.remove('is-swap');
        fillBubble(text, hold);
      }, 150);
      return;
    }
    bubble.classList.remove('is-swap');
    fillBubble(text, hold);
  }

  // Small words ride with the word after them, and a short last word with the
  // one before, so a line never ends on "a" or "my" and never leaves one
  // word alone at the bottom. Glued words share a no-break space.
  var GLUE = ['a', 'an', 'the', 'i', 'i’m', 'i’ll', 'my', 'your', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'so', 'no', 'is', 'it’s', 'that’s', 'you’re'];
  // Glued runs stay under this many characters, so one never outgrows the
  // narrow phone bubble.
  var GLUE_MAX = 22;

  // Joins word onto the last run; if the run would get too long, only the
  // run's last word goes with it.
  function glueOn(out, word) {
    var prev = out[out.length - 1];
    if (prev.length + 1 + word.length <= GLUE_MAX) {
      out[out.length - 1] = prev + '\u00a0' + word;
      return true;
    }
    // A small word carried off with the tail would otherwise be left dangling.
    var parts = prev.split('\u00a0');
    var tail = [parts.pop()];
    while (parts.length && GLUE.indexOf(parts[parts.length - 1].toLowerCase()) >= 0) tail.unshift(parts.pop());
    var run = tail.concat(word).join('\u00a0');
    if (!parts.length || run.length > GLUE_MAX) return false;
    out[out.length - 1] = parts.join('\u00a0');
    out.push(run);
    return true;
  }

  function phrases(text) {
    var out = [];
    var words = text.split(' ');
    words.forEach(function (word, i) {
      var prev = out[out.length - 1];
      var last = prev ? prev.split('\u00a0').pop().toLowerCase() : '';
      var glue = prev && GLUE.indexOf(last) >= 0;
      // The last word keeps company with the one before it.
      var lastWord = prev && i === words.length - 1 && words.length > 2;
      if (!(glue || lastWord) || !glueOn(out, word)) out.push(word);
    });
    return out;
  }

  // Balanced lines are often narrower than the bubble's max width, which left
  // the cloud loose round them: shrink it to the widest line.
  function hugText() {
    bubble.style.width = '';
    var spans = bubbleText.children;
    var rows = {};
    Array.prototype.forEach.call(spans, function (s) {
      var row = rows[s.offsetTop] || (rows[s.offsetTop] = { l: Infinity, r: -Infinity });
      row.l = Math.min(row.l, s.offsetLeft);
      row.r = Math.max(row.r, s.offsetLeft + s.offsetWidth);
    });
    var keys = Object.keys(rows);
    var widest = keys.reduce(function (w, k) { return Math.max(w, rows[k].r - rows[k].l); }, 0);
    var cs = getComputedStyle(cloud);
    var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    bubble.style.width = Math.ceil(widest + pad + 2) + 'px';
    var after = {};
    Array.prototype.forEach.call(spans, function (s) { after[s.offsetTop] = true; });
    if (Object.keys(after).length !== keys.length) bubble.style.width = '';
  }

  function fillBubble(text, hold) {
    bubbleText.textContent = '';
    var words = phrases(text);
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'atelier-mascot-word is-pre';
      span.style.setProperty('--i', String(i));
      span.textContent = word;
      bubbleText.appendChild(span);
      if (i < words.length - 1) bubbleText.appendChild(document.createTextNode(' '));
    });
    hugText();
    drawCloud(text);
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
  // Where she is touched decides how she reacts, and each thought belongs to
  // the face she is making while she has it: a little cute, a little product
  // manager, and now and then something true about her. A line is a string,
  // shown with the spot's face, or [face, string]. If the poking keeps going
  // she starts teasing back.

  var SPOTS = {
    nose: {
      face: GASP,
      lines: [
        'ouch! my nose is a bit sharp, careful',
        'ow! sharp nose, soft heart',
        'boop! a nose is not a button',
        'eep! zero affordance there',
        'hey! that’s not a CTA',
        'ouch… filing this as a P0',
        'my nose: pointy by design',
        'boop detected. nose rebooting…',
        'hey, sharp noses are sensitive too',
        'ouch! that’s a sharp edge case',
        [GIGGLE, 'hehe, nose bumped. sneeze deploying…'],
        'careful, that’s a premium feature',
        'ow! noted: nose is a no-touch zone',
        [WINK, 'sharp nose, sharper roadmap'],
        'ouch! my nose has a strict no-poke policy',
        [WINK, 'I can smell a vanity metric from here'],
        'eep! that nose sniffs out scope creep',
        [GIGGLE, 'hehe, okay, one boop per user'],
        'ow! nose feedback received, loud and clear',
        [THINKING, 'hmm, was that a nose-first approach?'],
        'ouch, this nose doesn’t ship features, okay?',
        [WINK, 'my nose knows when a feature won’t fit'],
      ],
    },
    eye: {
      face: BLINK,
      lines: [
        'ow! I need those for user research',
        'blinking… please hold',
        'can’t see the roadmap now',
        'eyes closed, vision still clear',
        'ow! that’s my attention to detail',
        'hey! I was reading the data',
        'blink… okay, still here',
        'eye-tracking study: failed',
        'careful! these spot bugs for a living',
        'ouch, my eyes were on the user',
        'shh, I’m visualising the end state',
        'can’t look… too many open tabs',
        'ow! these eyes were reading the metrics',
        'blink. still keeping the user in view',
        'eyes shut, Figma still open in my head',
        'hey! I was watching a user session',
        'ouch, that was my good-design detector',
        'blink blink… rebooting the vision board',
        'okay, eyes off the dashboard for a sec',
        'careful, I squint at every pixel',
      ],
    },
    cheek: {
      face: SHY,
      lines: [
        'aww, you’re making me blush',
        'stop it… my NPS just went up',
        'blushing is a feature, not a bug',
        'hehe, these cheeks are on the roadmap',
        'cheeks: 100% pink, 0% filler',
        'oh… you’re sweet, you know that?',
        'blush rate up 200%. thanks to you',
        'shy mode: enabled',
        'aww, delight is a metric too',
        'stop… I’ll turn into a strawberry',
        'cheek poke: highest-rated interaction',
        'hehe, my cheeks have a fan club now',
        'aww, thanks for stopping by my portfolio',
        'okay, you just made my whole sprint',
        'you’re officially my favourite visitor',
        'stop, I’m blushing in production',
        'aww, small gesture, big impact',
        'hehe, that’s the cutest feedback so far',
        'my cheeks did not pass the calm test',
        'aww, you’re kind. I’ll remember that',
        'blush shipped. no rollback planned',
      ],
    },
    mouth: {
      face: GIGGLE,
      lines: [
        'mmf! hehe, I was mid-pitch',
        'pfft! okay, you have my attention',
        'hehe, that’s my demo voice',
        [WINK, 'lips sealed… it’s an unreleased feature'],
        [WINK, 'shh! roadmap secrets live here'],
        'mmf! you just muted the PM',
        [GRIN, 'this smile ships daily'],
        'my lips say yes, the backlog says no',
        'mmph! I had a hot take loading',
        'okay okay, I’ll keep it short… ish',
        [GRIN, 'every great idea starts with a smile'],
        [GRIN, 'smile: lightweight, fast, no bugs'],
        'mmf! I was about to ask “but why?”',
        [WINK, 'shh, I only say yes to what earns a place'],
        'hehe, my favourite word? “shipped”',
        [GRIN, 'this smile went from MVP to v2'],
        'pfft! I was mid “what does the user need?”',
        [WINK, 'lips: low on words, high on impact'],
        'mmf! okay, but first, the problem statement',
        [GRIN, 'I smile more when things actually ship'],
        'hehe, careful, I talk a lot about users',
      ],
    },
    forehead: {
      face: WINK,
      lines: [
        'boop! new idea unlocked',
        'knock knock… a feature request?',
        'tap tap, my brain says hi',
        [THINKING, 'loading big ideas… 87%'],
        'that’s where the frameworks live',
        'brain cache cleared. hi again!',
        [STARRY, 'boop! that was the eureka button'],
        'careful, the roadmap is in there',
        [THINKING, 'hmm, you just started a brainstorm'],
        'thoughts: prioritised. mostly.',
        'tap! idea queued for the next sprint',
        'yes, I’m thinking. always.',
        [THINKING, 'hmm, does this deserve to exist?'],
        'boop! that’s where “but why?” lives',
        [THINKING, 'thinking… build, measure, ship, repeat'],
        'tap! the user just walked into the room',
        'brain says: fewer features, better ones',
        [STARRY, 'ooh, that one might actually ship!'],
        'idea received. now, does it earn a place?',
        [THINKING, 'hmm, slides or a working MVP? MVP.'],
        'knock knock, it’s product intuition',
      ],
    },
    hair: {
      face: GRIN,
      lines: [
        'psst… I love oiling my hair',
        'hair oiling is my favourite self-care ritual',
        'I love my long hair, be gentle!',
        'fun fact: my hair is wavy by default',
        [THINKING, 'some days I want straight hair… the waves win'],
        [WINK, 'wavy hair, straight thinking'],
        [GASP, 'not the hair! it’s in production'],
        [GASP, 'hey! that took three iterations'],
        [GASP, 'careful, it’s a stable release'],
        'long hair, long roadmap, both well kept',
        'my waves have their own personality',
        [WINK, 'oiled, combed, shipped'],
        [WINK, 'straight hair is my side project'],
        'these waves don’t follow a template',
        [GASP, 'low-maintenance hair? never heard of it'],
        'every wave is a happy accident',
        'oiled hair, calm mind, clear priorities',
        [WINK, 'I tried straight hair once. waves filed a bug'],
        'long hair, don’t care… okay, I care a lot',
        [GASP, 'hey! no tangles, I just oiled it'],
        'my waves iterate every single morning',
        [SHY, 'aww, you like my hair? me too'],
        [THINKING, 'straight or wavy… let’s A/B test it'],
        'hair oiling night = my favourite ritual',
        [GASP, 'careful! that’s years of patient growth'],
        'these waves came free with the product',
      ],
    },
    ear: {
      face: STARRY,
      lines: [
        'oh, you noticed my earrings!',
        'I love accessories, tiny details matter',
        'earrings: fashion’s micro-interactions',
        [GRIN, 'yes, I’m listening. always am.'],
        [GRIN, 'all ears for user feedback'],
        'these earrings are my favourite feature',
        'small details, big delight',
        'accessories make any outfit ship-ready',
        [WINK, 'shh, I hear a feature request'],
        'a little sparkle never hurt anyone',
        [GRIN, 'ear tap! active listening: on'],
        'accessorising is my love language',
        'tiny earrings, big personality',
        [GRIN, 'the right accessory is like good microcopy'],
        'I never skip the earrings. or the details.',
        [WINK, 'earrings first, then the outfit'],
        'one small shine can lift the whole look',
        [GRIN, 'yes! I pick accessories like I pick features'],
        [SHY, 'aww, you noticed. most people miss them'],
        'details are where the delight hides',
      ],
    },
    chin: {
      face: GIGGLE,
      lines: [
        'hehe, ticklish there!',
        'hehe, you found an edge case',
        'that tickles! logging it as a bug',
        [WINK, 'chin up, ship on'],
        [THINKING, 'hmm, that’s my thinking spot'],
        [GRIN, 'chin poke! confidence +10'],
        'hehe, stop, I can’t keep a straight face',
        'tickle test: passed. very ticklish.',
        'hehe, that’s not in the spec',
        [THINKING, 'hmm, chin on hand, user in mind'],
        'hehe, ticklish chins are a known issue',
        [WINK, 'chin up, scope down'],
        'hehe! okay, you found the weak spot',
        [THINKING, 'stroking my chin… very product of me'],
        [GRIN, 'chin poke counted as positive feedback'],
        'hehe, that one went straight to my giggles',
      ],
    },
    neck: {
      face: GIGGLE,
      lines: [
        'eek! my neck is super ticklish',
        [GRIN, 'turtleneck season, forever'],
        [SHY, 'aww, that’s my cosiest spot'],
        'tickled! turtlenecks offer no protection',
        'hehe, you found my secret ticklish zone',
        [SHY, 'eep! warm and cosy in here'],
        [GRIN, 'turtlenecks are my comfort UI'],
        'hehe, that sent a giggle up my neck',
        [WINK, 'snug as a well-scoped project'],
        'hehe, careful, you’ll make me squeal',
        [SHY, 'turtleneck on, confidence on'],
        'eep! giggle overflow, please stand by',
        [GRIN, 'black turtleneck: the PM uniform, obviously'],
        [SHY, 'aww, this neck only likes gentle feedback'],
        'hehe, nope, that’s off the roadmap',
        [WINK, 'cosy outside, decisive inside'],
        'eek! warning: very ticklish zone ahead',
      ],
    },
    sweater: {
      face: GIGGLE,
      lines: [
        'hehe, that tickles!',
        [GRIN, 'careful, it’s my launch sweater'],
        [GRIN, 'cozy sweater, shipped on time'],
        [WINK, 'stripes: consistent, like a design system'],
        [GRIN, 'this sweater has great UX. very cosy'],
        'hehe, soft and warm, like good onboarding',
        [WINK, 'comfy clothes, sharp decisions'],
        [WINK, 'every stripe was user-tested'],
        [SHY, 'cosiness is non-negotiable'],
        [SHY, 'hehe, sweater hug accepted'],
        [GRIN, 'striped, snug and production ready'],
        [GRIN, 'warmest feature in my wardrobe'],
        'hehe, sweater weather is every weather',
        [WINK, 'stripes keep me aligned. like OKRs'],
        [SHY, 'aww, you want a hug? sweater says yes'],
        [GRIN, 'comfy enough for long roadmap reviews'],
        'hehe, careful, I’m a little ticklish here too',
        [WINK, 'cosy sweater, no-nonsense priorities'],
        [GRIN, 'this sweater has shipped many products'],
        [SHY, 'soft sweater, softer heart'],
      ],
    },
    hello: {
      face: GRIN,
      lines: [
        'hi! you found the easter egg',
        'hello, keyboard friend!',
        'hehe, hi there!',
        [STARRY, 'accessibility win! hello!'],
        'tab, tab, enter… hi!',
        [STARRY, 'a keyboard user! my favourite'],
        'hi! thanks for exploring',
        'hello! I’m Deepika, nice to meet you',
        [WINK, 'hi! the case studies are just below'],
        'hey there! I build, measure and ship',
        [STARRY, 'welcome! make yourself at home'],
        'hi! hiring for product? let’s talk',
      ],
    },
  };

  var TEASE = [
    {
      face: THINKING,
      lines: [
        'hmm… is this a usability test?',
        'so many clicks… A/B testing me?',
        'hmm, is this rage-clicking?',
        'are you measuring my response time?',
        'hmm, that’s a lot of engagement…',
        'okay, is this a stress test?',
        'hmm, logging this as a power-user flow',
        'are you QA? you’d be great at it',
      ],
    },
    {
      face: SHY,
      lines: [
        'okay, engagement is way up',
        'you really like me, huh?',
        'stop, I’m getting attached',
        'daily active user: you',
        'stop it, you’re too sweet',
        'okay, we’re friends now. it’s official',
        'aww, you keep coming back',
      ],
    },
    {
      face: STARRY,
      lines: [
        'fine, you win. let’s build something!',
        'retention: 100%. hi, friend!',
        'you’re my favourite power user!',
        'okay, you’re officially a superfan',
        'you made it to the secret level!',
        'achievement unlocked: best visitor',
        'okay, now go read my case studies',
      ],
    },
  ];

  // What she thinks about when the pointer rests on her without poking.
  var MUSINGS = {
    face: THINKING,
    lines: [
      'psst… you can poke me',
      'hmm… what would the user do?',
      'currently prioritising snacks',
      'thinking in user stories…',
      'is this the MVP or the dream?',
      'what problem are we really solving?',
      'hmm… should I oil my hair tonight?',
      'wavy or straight today… wavy wins',
      'one more user interview, then a break',
      'writing a PRD in my head…',
      'who is this for, and why now?',
      'less, but better',
      'hmm, what would delight them?',
      'if it doesn’t earn a place, it doesn’t ship',
      'is the user still in the room?',
      'built it, measured it… now, does it deserve to exist?',
      'hmm, which metric actually matters here?',
      'working MVP beats a pretty slide',
      'hmm… what can we cut and still delight?',
      'thinking about my next hair oil night',
      'are these earrings too much? never.',
      'roadmap, but make it realistic',
      'psst… the case studies are worth a read',
      'hmm, is that a problem or just a wish?',
      'say no to ten things, yes to one',
      'what did the last user interview tell us?',
      'quiet focus mode: on',
    ],
  };

  // Measured on the centre frame, as fractions of the box: eyes at y .36–.44,
  // the nose tip at (.555, .47), the mouth at y .51, the face centred on .535,
  // the ears and earrings at x .20–.315 and .72–.79 between y .36 and .53,
  // the turtleneck at x .40–.66 from y .58 to .70.
  function spotAt(e) {
    if (!e || typeof e.clientX !== 'number' || (e.clientX === 0 && e.clientY === 0)) return 'hello';
    var rect = el.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width;
    var y = (e.clientY - rect.top) / rect.height;
    var fx = x - 0.535;
    if (y > 0.545) {
      if (y < 0.58 && x > 0.36 && x < 0.72) return 'chin';
      if (y < 0.7 && x > 0.4 && x < 0.66) return 'neck';
      return 'sweater';
    }
    if (y > 0.36 && y < 0.53 && ((x > 0.2 && x < 0.315) || (x > 0.72 && x < 0.79))) return 'ear';
    if (y < 0.25 || Math.abs(fx) > 0.2) return 'hair';
    if (y < 0.345) return 'forehead';
    if (y < 0.445) return Math.abs(fx) < 0.05 ? 'nose' : 'eye';
    if (y < 0.495) return Math.abs(x - 0.555) < 0.045 ? 'nose' : 'cheek';
    return Math.abs(fx) < 0.09 ? 'mouth' : 'cheek';
  }

  // Each list is dealt like a shuffled deck: every line once before any comes
  // round again, and the deck is remembered across visits, so she does not
  // repeat herself to someone who comes back.
  var SAID_KEY = 'mascot-said';
  var said = {};
  try {
    said = JSON.parse(localStorage.getItem(SAID_KEY)) || {};
  } catch (err) {
    said = {};
  }
  var lastLine = '';

  function pickLine(key, step) {
    var text = function (line) {
      return typeof line === 'string' ? line : line[1];
    };
    var used = said[key] || [];
    var options = step.lines.filter(function (line) {
      return used.indexOf(text(line)) < 0 && text(line) !== lastLine;
    });
    if (!options.length) {
      used = [];
      options = step.lines.filter(function (line) {
        return text(line) !== lastLine;
      });
    }
    var line = options[Math.floor(Math.random() * options.length)];
    lastLine = text(line);
    used.push(lastLine);
    said[key] = used;
    try {
      localStorage.setItem(SAID_KEY, JSON.stringify(said));
    } catch (err) {
      // Private mode: she just forgets between visits.
    }
    return { face: typeof line === 'string' ? step.face : line[0], text: lastLine };
  }

  // Long enough to read at an easy pace, never so long she seems stuck.
  function holdFor(text) {
    return Math.min(4800, 2200 + text.length * 45);
  }

  // Little moments: a run of faces with a body move, a small effect and a
  // line, so a tap is never quite predictable. The sheets only hold nine
  // faces; it is the sequence, the move and the effect that make each one
  // its own expression. Dealt like the lines, every one before any repeats.
  // steps: [face, ms]; move: a class on her box (see .is-m-* in atelier.css).
  var UNIMPRESSED = 8;
  var MOMENTS = [
    { id: 'hum', steps: [[GIGGLE, 900], [BLINK, 900], [GIGGLE, 700]], move: 'dance', fx: 'note', line: 'la la la… don’t mind me' },
    { id: 'aha', steps: [[THINKING, 1000], [GASP, 260], [GRIN, 1300]], move: 'hop', fx: 'bulb', at: 1000, line: 'ooh! I just had an idea' },
    { id: 'sneeze', steps: [[GASP, 420], [GASP, 380], [BLINK, 260], [GIGGLE, 1100]], move: 'sneeze', at: 800, sayAt: 700, line: 'a-a-achoo! …excuse me' },
    { id: 'shy', steps: [[SHY, 2400]], move: 'tilt', fx: 'heart', blush: true, line: 'stop it, you’re making me blush' },
    { id: 'dizzy', steps: [[GASP, 500], [BLINK, 500], [GIGGLE, 1000]], move: 'dizzy', fx: 'spark', line: 'whee! the page is spinning' },
    { id: 'sleepy', steps: [[BLINK, 1700], [GASP, 500], [GRIN, 900]], move: 'doze', fx: 'zzz', sayAt: 1700, line: 'huh? no no, I’m awake!' },
    { id: 'confused', steps: [[THINKING, 1500], [UNIMPRESSED, 900]], move: 'tilt', fx: 'ask', line: 'wait… what were we doing?' },
    { id: 'proud', steps: [[GRIN, 1600]], move: 'bounce', fx: 'spark', line: 'nailed it, as usual' },
    { id: 'secret', steps: [[WINK, 900], [SHY, 1200]], move: 'lean', blush: true, line: 'psst… I like you already' },
    { id: 'judging', steps: [[UNIMPRESSED, 1500], [GIGGLE, 800]], move: 'shake', line: 'hmm. I’ll allow it' },
    { id: 'tickled', steps: [[GIGGLE, 700], [BLINK, 200], [GIGGLE, 900]], move: 'squish', line: 'hehe, that tickles!' },
    { id: 'nervous', steps: [[GASP, 700], [SHY, 1300]], move: 'shiver', fx: 'sweat', line: 'uh oh… was that a bug?' },
    { id: 'aww', steps: [[SHY, 900], [GRIN, 1200]], move: 'hop', fx: 'heart', blush: true, line: 'aww, you’re sweet' },
    { id: 'startled', steps: [[GASP, 900], [GIGGLE, 1000]], move: 'jump', fx: 'bang', line: 'eep! you scared me' },
    { id: 'agree', steps: [[GRIN, 1500]], move: 'nod', line: 'yep, yep, totally agree' },
    { id: 'cool', steps: [[WINK, 1500]], move: 'tilt', fx: 'spark', line: 'too cool for a bug report' },
    { id: 'yawn', steps: [[GASP, 1100], [BLINK, 900], [GRIN, 600]], move: 'stretch', fx: 'zzz', line: '*yawn*… long design review' },
    { id: 'cheer', steps: [[GRIN, 700], [GIGGLE, 700], [GRIN, 600]], move: 'bounce', fx: 'note', line: 'woohoo! you found me!' },
    { id: 'pout', steps: [[UNIMPRESSED, 1100], [SHY, 1000]], move: 'shake', line: 'hmph. fine. one more boop' },
    { id: 'calc', steps: [[THINKING, 1400], [GRIN, 900]], move: 'dance', fx: 'ask', line: 'calculating cuteness… 100%' },
    { id: 'peek', steps: [[BLINK, 900], [WINK, 1000]], move: 'lean', fx: 'heart', line: 'peekaboo!' },
    { id: 'wow', steps: [[GASP, 1100], [GRIN, 900]], move: 'jump', fx: 'spark', line: 'whoa, you have great taste' },
  ];

  var momentTimers = [];
  // A move already under way is allowed to finish: swapping it for another
  // mid-hop snapped her from the top of the jump straight back to the floor.
  var moveUntil = 0;
  var moveTimer = 0;
  function moveBody(name) {
    if (reducedMotion || !name || now() < moveUntil) return;
    Object.keys(MOVE_MS).forEach(function (m) { el.classList.remove('is-m-' + m); });
    void el.offsetWidth;
    el.classList.add('is-m-' + name);
    var ms = MOVE_MS[name] || 1500;
    moveUntil = now() + ms;
    clearTimeout(moveTimer);
    moveTimer = setTimeout(function () { el.classList.remove('is-m-' + name); }, ms + 50);
  }

  // Durations of the .is-m-* animations in atelier.css.
  var MOVE_MS = {
    hop: 1000, jump: 750, bounce: 1300, dance: 2300, tilt: 2300, lean: 2100, shake: 800,
    nod: 1100, squish: 1100, shiver: 900, dizzy: 1800, doze: 2500, sneeze: 1500, stretch: 2400,
  };

  function pickMoment() {
    var used = said.moment || [];
    var options = MOMENTS.filter(function (m) { return used.indexOf(m.id) < 0; });
    if (!options.length) {
      used = [];
      options = MOMENTS.filter(function (m) { return m.id !== lastMoment; });
    }
    var m = options[Math.floor(Math.random() * options.length)];
    lastMoment = m.id;
    used.push(m.id);
    said.moment = used;
    try {
      localStorage.setItem(SAID_KEY, JSON.stringify(said));
    } catch (err) {
      // Private mode: she just forgets between visits.
    }
    return m;
  }
  var lastMoment = '';

  // quiet: no speech bubble, for moments she has on her own at rest.
  // Each beat of a moment is held a little longer than written, so one face
  // has time to land before the next takes over.
  var TEMPO = 1.4;

  function playMoment(m, quiet) {
    momentTimers.forEach(clearTimeout);
    momentTimers = [];
    var steps = m.steps.map(function (s) {
      return [s[0], s[0] === BLINK ? s[1] : Math.round(s[1] * TEMPO)];
    });
    var total = steps.reduce(function (sum, s) { return sum + s[1]; }, 0);
    var at = 0;
    steps.forEach(function (s, i) {
      var last = i === steps.length - 1;
      momentTimers.push(setTimeout(function () {
        react(s[0], last ? s[1] : s[1] + 200, quiet);
      }, at));
      at += s[1];
    });
    moveBody(m.move);
    if (m.fx) momentTimers.push(setTimeout(function () { burst(m.fx); }, m.at || 120));
    if (m.blush) blushFor(total + 300);
    if (!quiet) {
      var hold = Math.max(holdFor(m.line), total - (m.sayAt || 0));
      momentTimers.push(setTimeout(function () { say(m.line, hold); }, m.sayAt || 180));
      lastLine = m.line;
    }
    return total;
  }

  var streak = 0;
  var lastPokeAt = 0;

  function poke(e) {
    var t = now();
    streak = t - lastPokeAt < 1600 ? streak + 1 : 1;
    lastPokeAt = t;

    var spot = spotAt(e);
    var teaseStep = Math.min(streak - 5, TEASE.length - 1);
    var key = streak >= 5 ? 'tease' + teaseStep : spot;
    var step = streak >= 5 ? TEASE[teaseStep] : SPOTS[spot];

    // A small flinch away from the finger.
    if (e && typeof e.clientX === 'number') {
      var rect = el.getBoundingClientRect();
      nudge(e.clientX < rect.left + rect.width / 2 ? 0.7 : -0.7, -0.35);
    }

    if (streak < 5 && Math.random() < 0.5) {
      playMoment(pickMoment());
      return;
    }
    momentTimers.forEach(clearTimeout);
    momentTimers = [];
    var line = pickLine(key, step);
    var hold = holdFor(line.text);
    react(line.face, hold);
    say(line.text, hold);
    if (streak >= 5 + TEASE.length - 1) streak = 0;
  }

  var lastGreet = 0;

  el.addEventListener('pointerenter', function () {
    if (now() - lastGreet < 15000 || reacting >= 0) return;
    lastGreet = now();
    react(GRIN, 1900, true);
  });

  // A pointer resting on her for a moment gets a passing thought, at most
  // every 20s, and never while she is already reacting.
  var museTimer = 0;
  var lastMuse = 0;

  function waitToMuse() {
    clearTimeout(museTimer);
    museTimer = setTimeout(function () {
      if (reacting >= 0 || now() - lastMuse < 20000 || now() - lastPokeAt < 4000) return;
      lastMuse = now();
      var line = pickLine('muse', MUSINGS);
      var hold = holdFor(line.text);
      react(line.face, hold, true);
      say(line.text, hold);
    }, 2200);
  }

  el.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') waitToMuse();
  });
  el.addEventListener('pointerdown', function () {
    clearTimeout(museTimer);
  });
  el.addEventListener('pointerleave', function () {
    clearTimeout(museTimer);
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
      react(GIGGLE, 1900, true);
    }
  });

  // ---- tour guide -----------------------------------------------------------
  //
  // While she is on screen, resting the mouse on a nav link, the theme switch
  // or a hero button gets a remark about where it leads. She keeps looking at
  // whatever is hovered (her gaze already follows the pointer), so only the
  // thought appears; no face swap turns her back to the front.

  var GUIDE = {
    home: ['that’s home. you’re already here!', 'P{ }: product, with a little code', 'logo click = teleport to the top'],
    about: ['the short version. I promise it’s short', 'psst… the real me is just below', 'about me? finally, a topic I know well'],
    work: ['ooh, the good stuff. go go go!', 'case studies! problem first, pixels later', 'this is where I show my receipts', 'real problems, real metrics, real shipping'],
    design: ['pretty pixels, but every one has a reason', 'design work! zoom in on the details', 'Figma files with feelings'],
    tech: ['yes, I write code too. engineer brain!', 'warning: actual working code ahead', 'where I break things, then fix them'],
    skills: ['skills: tested in production, not just listed', 'spoiler: saying no is one of them', 'fewer buzzwords, more shipping'],
    certs: ['certificates! proof I did the homework', 'framed in my heart, and on this page', 'yes, I read the whole syllabus'],
    education: ['where curiosity got a syllabus', 'engineering degree, product heart', 'the origin story, academically'],
    experience: ['real work, real users, real deadlines', 'where theory met deadlines', 'the part recruiters scroll to first'],
    writing: ['my brain, but in paragraphs', 'words! thoughts with good formatting', 'grab a coffee, I write with feeling'],
    fun: ['ooh, the fun part. I’m in there!', 'fun facts: 100% true, 0% boring', 'click it. you know you want to'],
    story: ['the long version… grab a snack', 'it starts with a very curious kid', 'my whole story? you’re sweet'],
    contact: ['yes! say hi, I reply', 'hiring for product? I can think and ship', 'slide into my inbox, professionally'],
    resume: ['one page. zero fluff. promise', 'my resume: the shippable version of me', 'download me, I’m lightweight'],
    toLight: ['lights on? okay, squint time', 'bright mode, for the brave', 'switching to daylight? good morning!'],
    toDark: ['dark mode? my eyes say thank you', 'lights off? cosy mode incoming', 'night shift? I’m ready'],
  };

  var GUIDE_HREFS = {
    '#home': 'home',
    '#about': 'about',
    '#case-studies': 'work',
    '#design-projects': 'design',
    '#technical-projects': 'tech',
    '#skills': 'skills',
    '#certifications': 'certs',
    '#education': 'education',
    '#experience': 'experience',
    '#writing': 'writing',
    '#fun-facts': 'fun',
    'my-story.html': 'story',
    '#contact': 'contact',
  };

  function guideKey(target) {
    if (target.id === 'theme-toggle') return document.body.classList.contains('dark-theme') ? 'toLight' : 'toDark';
    if (target.closest('.home-btns')) return 'resume';
    if (!target.closest('.navbar')) return '';
    return GUIDE_HREFS[target.getAttribute('href')] || '';
  }

  var guideTimer = 0;
  var guideTarget = null;
  var guideSaid = {};

  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;
    var target = e.target.closest && e.target.closest('a, button');
    if (!target || target === guideTarget) return;
    var key = guideKey(target);
    clearTimeout(guideTimer);
    guideTarget = key ? target : null;
    if (!key) return;
    // A short dwell, so sweeping across the nav does not set off every link.
    guideTimer = setTimeout(function () {
      if (!visible || reacting >= 0 || now() - (guideSaid[key] || 0) < 6000) return;
      guideSaid[key] = now();
      var line = pickLine('guide:' + key, { face: -1, lines: GUIDE[key] });
      say(line.text, holdFor(line.text));
    }, 280);
  });

  document.addEventListener('pointerout', function (e) {
    if (guideTarget && !guideTarget.contains(e.relatedTarget)) {
      clearTimeout(guideTimer);
      guideTarget = null;
    }
  });

  // The theme actually changing gets a face as well as a thought.
  var THEME_SWITCH = {
    dark: { face: SHY, lines: ['ooh, cosy mode', 'night shift: on', 'shh… the pixels are sleeping', [WINK, 'dark mode, but make it cute']] },
    light: { face: GASP, lines: ['aaah, bright!', [GRIN, 'good morning, sunshine!'], 'my eyes! okay, okay, I’m fine', [GRIN, 'daylight mode: fresh and crisp']] },
  };
  var wasDark = document.body.classList.contains('dark-theme');

  new MutationObserver(function () {
    var dark = document.body.classList.contains('dark-theme');
    if (dark === wasDark) return;
    wasDark = dark;
    if (!visible) return;
    clearTimeout(guideTimer);
    var line = pickLine(dark ? 'theme:dark' : 'theme:light', THEME_SWITCH[dark ? 'dark' : 'light']);
    var hold = holdFor(line.text);
    react(line.face, hold);
    say(line.text, hold);
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Copying text from the page, and coming back to the tab.
  var COPIED = { face: STARRY, lines: ['copying my lines? I’m flattered', [WINK, 'ctrl+c? excellent taste'], [GRIN, 'ooh, quote me on that'], [WINK, 'credit the author, okay?']] };
  var WELCOME_BACK = { face: GRIN, lines: ['oh, you’re back!', [SHY, 'missed you. kidding. a little'], [WINK, 'welcome back! I kept your seat warm'], 'hey! I knew you’d come back'] };

  document.addEventListener('copy', function () {
    if (!visible || reacting >= 0) return;
    var line = pickLine('copy', COPIED);
    var hold = holdFor(line.text);
    react(line.face, hold);
    say(line.text, hold);
  });

  var pageTitle = document.title;
  var leftAt = 0;

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      leftAt = now();
      pageTitle = document.title;
      document.title = 'psst… Deepika is waiting';
      return;
    }
    document.title = pageTitle;
    if (!visible || now() - leftAt < 4000) return;
        setTimeout(function () {
      if (reacting >= 0) return;
      var line = pickLine('back', WELCOME_BACK);
      var hold = holdFor(line.text);
      react(line.face, hold);
      say(line.text, hold);
    }, 500);
  });

  var aimQueued = false;
  var touchTimer = 0;

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
      // A finger lifts off the glass; there is no cursor left to watch.
      clearTimeout(touchTimer);
      if (e.pointerType === 'touch') touchTimer = setTimeout(function () { pointer = null; }, 2500);
    },
    { passive: true }
  );

  // Scrolling moves her under a cursor that is standing still, so she has to
  // re-aim then too, or she keeps staring where the cursor used to be.
  window.addEventListener('scroll', queueAim, { passive: true });

  // ---- at rest --------------------------------------------------------------
  //
  // Left alone she does not freeze. Once nobody has moved for a few seconds
  // she lives a little on her own: glances about, rolls her eyes up and
  // round, smiles to herself, thinks, hums; and after a long quiet, now and
  // then, says something. Any movement hands her gaze back to the visitor.

  var IDLE_AFTER = 4500;
  var lastActive = now();
  var idling = false;
  var idleTimer = 0;
  var idleSteps = [];
  var lastIdleLine = 0;

  var IDLE_LINES = {
    face: GIGGLE,
    lines: [
      '♪ hmm hm hmm… ♪',
      'still there? I’ll wait, no rush',
      [THINKING, 'what should I build next…'],
      'scroll down, the work is good, I promise',
      [WINK, 'taking a tiny break. same as you?'],
      [THINKING, 'hmm, did I ship that fix?'],
    ],
  };

  function clearIdleSteps() {
    idleSteps.forEach(clearTimeout);
    idleSteps = [];
  }

  function later(fn, ms) {
    idleSteps.push(setTimeout(fn, ms));
  }

  // Turns her head herself, as a cursor would, so the gaze and the lean stay
  // in step with the frames.
  function gazeTo(index) {
    if (reacting >= 0 || !idling) return;
    col = index % 3;
    row = Math.floor(index / 3);
    wantLook = index;
    commitLook();
  }

  var blushTimer = 0;
  function blushFor(ms) {
    el.classList.add('is-blushing');
    clearTimeout(blushTimer);
    blushTimer = setTimeout(function () { el.classList.remove('is-blushing'); }, ms);
  }

  var GLANCES = [3, 5, 0, 2, 1, 6, 8];

  // Slow on purpose: a person at rest does one small thing, then nothing for
  // a while. Weights favour the soft, sweet ones.
  var IDLE_ACTS = [
    // A look round the room, sometimes a second one, then back.
    [30, function () {
      var first = GLANCES[Math.floor(Math.random() * GLANCES.length)];
      gazeTo(first);
      var hold = 1700 + Math.random() * 1400;
      if (Math.random() < 0.3) {
        var second = GLANCES[Math.floor(Math.random() * GLANCES.length)];
        later(function () { gazeTo(second); }, hold);
        hold += 1400 + Math.random() * 1000;
      }
      later(function () { gazeTo(CENTRE); }, hold);
      return hold + 600;
    }],
    // A shy little smile and a blush, to nobody in particular.
    [20, function () {
      react(SHY, 2800, true);
      blushFor(2800);
      return 3300;
    }],
    // A soft smile to herself, eyes closing happily.
    [16, function () {
      react(GIGGLE, 2200, true);
      return 2700;
    }],
    // A warm grin, as if remembering something nice.
    [12, function () {
      react(GRIN, 2200, true);
      return 2700;
    }],
    // A moment of thought, chin on hand.
    [10, function () {
      react(THINKING, 3000, true);
      return 3400;
    }],
    // An eye roll, unhurried: up and round, a beat, back with a blink.
    [6, function () {
      var path = [3, 0, 1, 2];
      path.forEach(function (index, i) {
        later(function () { gazeTo(index); }, i * 260);
      });
      var back = path.length * 260 + 500;
      later(function () { gazeTo(CENTRE); }, back);
      later(blink, back + 600);
      return back + 1000;
    }],
    // A slow double blink.
    [6, function () {
      blink();
      later(blink, 600);
      return 1100;
    }],
    // Now and then one of her little moments, to herself: humming, dozing
    // off, a sneeze, a happy wiggle.
    [10, function () {
      var quietOnes = ['hum', 'sleepy', 'sneeze', 'shy', 'tickled', 'yawn', 'aha', 'peek'];
      var pick = quietOnes[Math.floor(Math.random() * quietOnes.length)];
      var m = MOMENTS.filter(function (x) { return x.id === pick; })[0];
      return playMoment(m, true) + 400;
    }],
  ];

  // With a mouse resting on the page she keeps her eyes on it: no glancing
  // round the room at someone who is right there. Half of what she does
  // keeps her head turned to the cursor (a little gesture, a thought mark,
  // hearts); the other half is a face, for which she turns to the front,
  // holds it, and turns back to the cursor.
  var WATCH_ACTS = [
    // Just resting her eyes on it: a slow blink, now and then a second.
    [22, function () {
      blink();
      if (Math.random() < 0.4) later(blink, 900);
      return 1800;
    }],
    // A curious tilt at whatever the cursor is resting on.
    [18, function () {
      moveBody('tilt');
      later(function () { burst('ask'); }, 500);
      return 2600;
    }],
    // A little nod and a hum.
    [14, function () {
      moveBody('nod');
      burst('note');
      return 2400;
    }],
    // Hearts, without looking away.
    [12, function () {
      moveBody('hop');
      burst('heart');
      return 2800;
    }],
    // A warm smile at the visitor.
    [20, function () {
      react(GRIN, 2400, true);
      return 2900;
    }],
    // A soft giggle to herself.
    [14, function () {
      react(GIGGLE, 2200, true);
      return 2700;
    }],
    // Shy, cheeks warming.
    [12, function () {
      react(SHY, 2800, true);
      blushFor(2800);
      return 3300;
    }],
    // A wink, held long enough to read.
    [10, function () {
      react(WINK, 1700, true);
      return 2200;
    }],
  ];

  function pickFrom(acts) {
    var total = acts.reduce(function (sum, act) { return sum + act[0]; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < acts.length; i += 1) {
      r -= acts[i][0];
      if (r <= 0) return acts[i][1];
    }
    return acts[0][1];
  }

  function pickIdleAct() {
    return pickFrom(pointer ? WATCH_ACTS : IDLE_ACTS);
  }

  // The mouse leaving the window: nothing to look at, so she is free to
  // look round on her own again.
  document.addEventListener('pointerout', function (e) {
    if (e.pointerType === 'mouse' && !e.relatedTarget) {
      pointer = null;
      col = 1;
      row = 1;
      requestLook(CENTRE);
    }
  });

  function scheduleIdle(ms) {
    clearTimeout(idleTimer);
    if (reducedMotion) return;
    idleTimer = setTimeout(idleTick, ms || 3500 + Math.random() * 3000);
  }

  function idleTick() {
    var quiet = now() - lastActive;
    if (!visible || reacting >= 0 || bubble.classList.contains('is-in') || quiet < IDLE_AFTER) {
      scheduleIdle();
      return;
    }
    idling = true;
    var busy;
    if (quiet > 30000 && now() - lastIdleLine > 45000 && Math.random() < 0.4) {
      lastIdleLine = now();
      if (!pointer) gazeTo(CENTRE);
      var line = pickLine('idle', IDLE_LINES);
      var hold = holdFor(line.text);
      react(line.face, hold);
      say(line.text, hold);
      busy = hold;
    } else {
      busy = pickIdleAct()();
    }
    scheduleIdle(busy + 4500 + Math.random() * 5000);
  }

  function wake() {
    lastActive = now();
    if (!idling) return;
    idling = false;
    clearIdleSteps();
    if (reacting >= 0 && reactAuto) {
      momentTimers.forEach(clearTimeout);
      momentTimers = [];
      endReaction();
    }
    if (pointer) queueAim();
    else requestLook(CENTRE);
  }

  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (type) {
    window.addEventListener(type, wake, { passive: true });
  });

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
    scheduleIdle();
    wakeSpring();
  }

  function stop() {
    clearTimeout(blinkTimer);
    clearTimeout(breezeTimer);
    clearTimeout(idleTimer);
    clearIdleSteps();
    idling = false;
  }

  // The first time she is seen in a visit, once the page has finished its
  // entrance (and the lock screen is gone), she says hello.
  var GREETINGS = {
    face: GRIN,
    lines: [
      'hi! this isn’t just a portfolio, it’s a little gist of my life',
      'hey, welcome in! pull up a chair, I’ll tell you my story',
      [WINK, 'hi! the work is all here, and a little bit of me too'],
      'hello! so glad you found your way here',
    ],
  };
  var GREETED_KEY = 'mascot-greeted';
  var greetTimer = 0;

  function markGreeted() {
    try {
      sessionStorage.setItem(GREETED_KEY, '1');
    } catch (err) {
      // No storage: greet on every visit, which is harmless.
    }
  }

  // ---- welcome --------------------------------------------------------------
  //
  // Someone who has just typed their name on the lock screen is met by name,
  // in three beats: starry-eyed that they came (sparkles), shy and blushing
  // (her cheeks warm, hearts drift up), then a giggle and a welcome in. Only
  // then: a returning session in the same tab gets the ordinary hello.

  var pendingWelcome = '';

  function firstName(name) {
    var first = String(name || '').trim().split(/\s+/)[0] || '';
    if (first.length > 16) first = first.slice(0, 15) + '…';
    return first.charAt(0).toUpperCase() + first.slice(1);
  }

  var blush = document.createElement('span');
  blush.className = 'atelier-mascot-blush';
  blush.setAttribute('aria-hidden', 'true');
  el.appendChild(blush);

  var HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.6 4.3 12.9a4.8 4.8 0 0 1 6.8-6.8l.9.9.9-.9a4.8 4.8 0 0 1 6.8 6.8z"/></svg>';
  // A glint, as light catches it: four long hairline rays, four short ones
  // between them, and a white-hot core.
  var SPARK =
    '<svg viewBox="0 0 24 24">' +
    '<path class="g-ray" d="M12 0C12.5 7.3 16.7 11.5 24 12 16.7 12.5 12.5 16.7 12 24 11.5 16.7 7.3 12.5 0 12 7.3 11.5 11.5 7.3 12 0z"/>' +
    '<path class="g-ray is-short" transform="rotate(45 12 12)" d="M12 5.5C12.3 9.6 14.4 11.7 18.5 12 14.4 12.3 12.3 14.4 12 18.5 11.7 14.4 9.6 12.3 5.5 12 9.6 11.7 11.7 9.6 12 5.5z"/>' +
    '<circle class="g-core" cx="12" cy="12" r="2.2"/>' +
    '</svg>';
  // Where the light sits in her pupils on the open-eyed faces (grin, gasp),
  // as fractions of the box, measured off the reaction sheet.
  var EYE_GLINTS = [[43.6, 39.4], [66, 39.6]];

  // Particles in the mascot's own box: hearts rise from her cheeks, sparkles
  // pop around her head. Positions are fractions of the box (see spotAt).
  // One-off marks drawn beside her head: [x %, y %, content], one per mark.
  var DROP = '<svg viewBox="0 0 24 24"><path d="M12 2.5C9 7.5 6.5 10.6 6.5 14a5.5 5.5 0 0 0 11 0c0-3.4-2.5-6.5-5.5-11.5z"/></svg>';
  var BULB = '<svg viewBox="0 0 24 24"><path class="b-glass" d="M12 2.8a6.6 6.6 0 0 0-3.9 11.9c.7.6 1.2 1.4 1.3 2.3h5.2c.1-.9.6-1.7 1.3-2.3A6.6 6.6 0 0 0 12 2.8z"/><path class="b-base" d="M9.6 18.4h4.8M10.2 20.6h3.6"/></svg>';
  var MARKS = {
    note: [[30, 22, '♪'], [74, 16, '♫'], [24, 10, '♫'], [80, 30, '♪']],
    ask: [[75, 14, '?'], [83, 24, '?']],
    bang: [[76, 13, '!'], [30, 15, '!']],
    zzz: [[68, 22, 'z'], [75, 13, 'z'], [83, 4, 'Z']],
    sweat: [[70, 30, DROP]],
    bulb: [[53.5, 3, BULB]],
  };

  function burst(kind) {
    if (reducedMotion) return;
    var wrap = document.createElement('span');
    wrap.className = 'atelier-mascot-burst is-' + kind;
    wrap.setAttribute('aria-hidden', 'true');
    if (MARKS[kind]) {
      MARKS[kind].forEach(function (mark, i) {
        var m = document.createElement('span');
        m.className = 'atelier-mascot-mark';
        m.style.setProperty('--x', mark[0] + '%');
        m.style.setProperty('--y', mark[1] + '%');
        m.style.setProperty('--d', (i * 0.28).toFixed(2) + 's');
        m.style.setProperty('--r', ((i % 2 ? 1 : -1) * (8 + Math.random() * 10)).toFixed(0) + 'deg');
        m.innerHTML = mark[2];
        wrap.appendChild(m);
      });
      el.appendChild(wrap);
      setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, 3200);
      return;
    }
    var count = kind === 'heart' ? 7 : 5;
    for (var i = 0; i < count; i += 1) {
      var p = document.createElement('span');
      var side = i % 2 ? 1 : -1;
      if (kind === 'heart') {
        p.style.setProperty('--x', (53.5 + side * (9 + Math.random() * 9)) + '%');
        p.style.setProperty('--y', (47 + Math.random() * 4) + '%');
        p.style.setProperty('--dx', (side * (14 + Math.random() * 26)) + 'px');
        p.style.setProperty('--rise', -(110 + Math.random() * 90) + 'px');
        p.style.setProperty('--s', (0.7 + Math.random() * 0.6).toFixed(2));
      } else {
        // Strung along an arc over her crown and down past her ears, clear
        // of the face: glints on the hair, not stars in her eyes.
        var a = Math.PI * (1.08 + (i / (count - 1)) * 0.84) + (Math.random() - 0.5) * 0.18;
        p.style.setProperty('--x', (53.5 + Math.cos(a) * (37 + Math.random() * 5)) + '%');
        p.style.setProperty('--y', (30 + Math.sin(a) * (27 + Math.random() * 4)) + '%');
        p.style.setProperty('--s', (i === 1 || i === 3 ? 0.95 : 0.55 + Math.random() * 0.25).toFixed(2));
      }
      p.style.setProperty('--d', (i * 0.16 + Math.random() * 0.12).toFixed(2) + 's');
      p.style.setProperty('--r', (side * (8 + Math.random() * 18)).toFixed(0) + 'deg');
      p.innerHTML = kind === 'heart' ? HEART : SPARK;
      wrap.appendChild(p);
    }
    // Light catching in her eyes, only on a front-facing open-eyed face, and
    // once that face has faded in.
    if (kind === 'spark' && (reacting === GRIN || reacting === GASP)) {
      EYE_GLINTS.forEach(function (at, j) {
        var g = document.createElement('span');
        g.className = 'is-eye';
        g.style.setProperty('--x', at[0] + '%');
        g.style.setProperty('--y', at[1] + '%');
        g.style.setProperty('--d', (0.75 + j * 0.08).toFixed(2) + 's');
        g.innerHTML = SPARK;
        wrap.appendChild(g);
      });
    }
    el.appendChild(wrap);
    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 3600);
  }

  function welcome(name) {
    pendingWelcome = '';
    var first = firstName(name);
    var beats = [
      { face: GRIN, text: first ? 'hi ' + first + '! so happy you’re here' : 'hi! so happy you’re here', fx: 'spark' },
      { face: SHY, text: 'this isn’t just a portfolio, you know…', fx: 'heart', blush: true },
      { face: WINK, text: 'it’s a little gist of my life: the work, and the girl behind it' },
      { face: GIGGLE, text: first ? 'make yourself at home, ' + first + ' ♡' : 'make yourself at home ♡' },
    ];
    var at = 0;
    beats.forEach(function (beat, i) {
      var hold = holdFor(beat.text);
      var last = i === beats.length - 1;
      setTimeout(function () {
        // Each beat outlasts its own words so the next one takes over from
        // it, rather than her flicking back to her normal face in between.
        react(beat.face, last ? hold : hold + 600);
        say(beat.text, hold);
        clearTimeout(blushTimer);
        el.classList.toggle('is-blushing', !!beat.blush);
        if (beat.fx) burst(beat.fx);
      }, at);
      at += hold + 280;
    });
    setTimeout(function () {
      el.classList.remove('is-blushing');
    }, at);
  }

  document.addEventListener('portfolio-unlocked', function (e) {
    var name = e && e.detail && e.detail.name;
    if (!name) return;
    markGreeted();
    clearTimeout(greetTimer);
    // After the lock screen has gone and the hero's entrance has played.
    greetTimer = setTimeout(function () {
      if (visible) welcome(name);
      else pendingWelcome = name;
    }, 1900);
  });

  function greetSoon() {
    if (pendingWelcome) {
      welcome(pendingWelcome);
      return;
    }
    try {
      if (sessionStorage.getItem(GREETED_KEY)) return;
    } catch (err) {
      // See markGreeted.
    }
    if (document.body.classList.contains('portfolio-is-locked')) {
      document.addEventListener('portfolio-unlocked', greetSoon, { once: true });
      return;
    }
    clearTimeout(greetTimer);
    greetTimer = setTimeout(function () {
      if (!visible || reacting >= 0 || now() - lastPokeAt < 4000) return;
      markGreeted();
      var line = pickLine('greet', GREETINGS);
      var hold = holdFor(line.text);
      react(line.face, hold);
      say(line.text, hold);
    }, 2200);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) {
        start();
        greetSoon();
      } else {
        clearTimeout(greetTimer);
        stop();
      }
    }).observe(el);
  } else {
    start();
  }
})();
