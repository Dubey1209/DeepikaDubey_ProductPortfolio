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
      if (Math.random() < 0.12) setTimeout(blink, 520);
      scheduleBlink();
    }, 3600 + Math.random() * 4400);
  }

  // Lids close fast and open a little slower, as real ones do. Only the face
  // layer moves, so a blink touches nothing but the eyes.
  function blink() {
    if (!visible || reacting >= 0 || lookIndex !== CENTRE || body.key !== 'look:' + CENTRE) return;
    face.show('react', BLINK, 90);
    setTimeout(function () {
      if (reacting < 0) face.hide(190);
    }, 170);
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
  var ENTER = 0.5;
  var LEAVE = 0.24;
  // She settles on a direction only once the cursor has held it this long.
  var SETTLE_MS = 150;
  // Each step of a head turn. A turn moves one frame at a time, through the
  // frames in between, as a head does; jumping left-to-right in one cross-fade
  // showed two heads at once and read as a machine.
  var TURN_MS = 170;

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
    var c = lookIndex % 3;
    var r = Math.floor(lookIndex / 3);
    var turnX = Math.sign((wantLook % 3) - c);
    var turnY = Math.sign(Math.floor(wantLook / 3) - r);
    lookIndex = (r + turnY) * 3 + c + turnX;
    if (reacting < 0) {
      body.show('look', lookIndex, TURN_MS);
      // The head leads with a slight dip, and the body follows through.
      nudge(turnX * 0.32, turnY * 0.18 + 0.1);
    }
    clearTimeout(lookTimer);
    if (lookIndex !== wantLook) lookTimer = setTimeout(commitLook, TURN_MS - 20);
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

  // Standing still she still breathes and sways a touch, on slow incommensurate
  // waves so it never repeats like a loop; perfectly motionless between
  // gestures she read as a cut-out.
  function sway(t) {
    return {
      x: 0.11 * Math.sin(t / 2300) + 0.05 * Math.sin(t / 1370 + 1.3),
      y: 0.16 * Math.sin(t / 1900) + 0.04 * Math.sin(t / 830),
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
    // The sway never stops, so keep the picture on the pixel grid and only
    // rotate it for a real turn; otherwise she would be resampled and soft.
    var grid = window.devicePixelRatio || 1;
    setLean(Math.round(px * grid) / grid, Math.round(py * grid) / grid, Math.abs(tilt) < 0.3 ? 0 : tilt);
    requestAnimationFrame(stepSpring);
  }

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
    // Two small puffs trail down towards her head, like a thought: down-left
    // from a cloud beside her, down-right where the page opens it to her left.
    var right = getComputedStyle(el).getPropertyValue('--cloud-tail').trim() === 'right';
    var spots = right
      ? [[w * 0.83, h + 15, 5.5], [w * 0.83 + 11, h + 28, 3.4]]
      : [[w * 0.17, h + 15, 5.5], [w * 0.17 - 11, h + 28, 3.4]];
    puffs.forEach(function (puff, i) {
      Array.prototype.forEach.call(puff.childNodes, function (circle) {
        circle.setAttribute('cx', spots[i][0].toFixed(1));
        circle.setAttribute('cy', spots[i][1].toFixed(1));
        circle.setAttribute('r', String(spots[i][2]));
      });
    });
  }

  function say(text, hold) {
    clearTimeout(bubbleTimer);
    bubbleText.textContent = '';
    var words = text.split(' ');
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'atelier-mascot-word is-pre';
      span.style.setProperty('--i', String(i));
      span.textContent = word;
      bubbleText.appendChild(span);
      if (i < words.length - 1) bubbleText.appendChild(document.createTextNode(' '));
    });
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
        'earrings: the micro-interactions of fashion',
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
        [GRIN, 'careful, it’s my launch-day sweater'],
        [GRIN, 'cozy sweater, shipped on time'],
        [WINK, 'stripes: consistent, like a design system'],
        [GRIN, 'this sweater has great UX. very cosy'],
        'hehe, soft and warm, like good onboarding',
        [WINK, 'comfy clothes, sharp decisions'],
        [WINK, 'every stripe was user-tested'],
        [SHY, 'cosiness is a non-negotiable requirement'],
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
    return Math.min(4200, 1600 + text.length * 45);
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
    react(GRIN, 1100);
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
      react(line.face, hold);
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
      react(GIGGLE, 1300);
    }
  });

  var lastStarry = 0;

  document.addEventListener('pointerover', function (e) {
    var hovered = e.target.closest && e.target.closest('a, button');
    if (!hovered || el.contains(hovered) || guideKey(hovered)) return;
    if (now() - lastStarry < 8000 || Math.random() > 0.35) return;
    lastStarry = now();
    autoReact(STARRY, 900);
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

  // ---- at rest --------------------------------------------------------------
  //
  // Left alone she does not freeze. Once nobody has moved for a few seconds
  // she lives a little on her own: glances about, rolls her eyes up and
  // round, smiles to herself, thinks, hums; and after a long quiet, now and
  // then, says something. Any movement hands her gaze back to the visitor.

  var IDLE_AFTER = 6000;
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

  function blushFor(ms) {
    el.classList.add('is-blushing');
    setTimeout(function () { el.classList.remove('is-blushing'); }, ms);
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
      react(SHY, 2600);
      blushFor(2600);
      return 2900;
    }],
    // A soft smile to herself, eyes closing happily.
    [16, function () {
      react(GIGGLE, 1800);
      return 2100;
    }],
    // A warm grin, as if remembering something nice.
    [12, function () {
      react(GRIN, 1600);
      return 1900;
    }],
    // A moment of thought, chin on hand.
    [10, function () {
      react(THINKING, 2600);
      return 2900;
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
  ];

  function pickIdleAct() {
    var total = IDLE_ACTS.reduce(function (sum, act) { return sum + act[0]; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < IDLE_ACTS.length; i += 1) {
      r -= IDLE_ACTS[i][0];
      if (r <= 0) return IDLE_ACTS[i][1];
    }
    return IDLE_ACTS[0][1];
  }

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
      gazeTo(CENTRE);
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
  var SPARK = '<svg viewBox="0 0 24 24"><path d="M12 2.5c.7 5 2.4 7 7.5 7.9v1.2c-5.1.9-6.8 2.9-7.5 7.9h-1c-.7-5-2.4-7-7.5-7.9v-1.2c5.1-.9 6.8-2.9 7.5-7.9z"/></svg>';

  // Particles in the mascot's own box: hearts rise from her cheeks, sparkles
  // pop around her head. Positions are fractions of the box (see spotAt).
  function burst(kind) {
    if (reducedMotion) return;
    var wrap = document.createElement('span');
    wrap.className = 'atelier-mascot-burst is-' + kind;
    wrap.setAttribute('aria-hidden', 'true');
    var count = kind === 'heart' ? 7 : 6;
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
        var a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        p.style.setProperty('--x', (53.5 + Math.cos(a) * 30) + '%');
        p.style.setProperty('--y', (30 + Math.sin(a) * 20) + '%');
        p.style.setProperty('--s', (0.6 + Math.random() * 0.7).toFixed(2));
      }
      p.style.setProperty('--d', (i * 0.12 + Math.random() * 0.1).toFixed(2) + 's');
      p.style.setProperty('--r', (side * (8 + Math.random() * 18)).toFixed(0) + 'deg');
      p.innerHTML = kind === 'heart' ? HEART : SPARK;
      wrap.appendChild(p);
    }
    el.appendChild(wrap);
    setTimeout(function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, 3600);
  }

  // She raises a hand and waves hello. The sheets have no arm drawn up, so
  // the hand is its own little drawing in her palette, waving at the wrist.
  var HAND =
    '<svg viewBox="0 0 60 150" aria-hidden="true">' +
      '<g class="atelier-mascot-hand-skin">' +
        '<rect x="47" y="30" width="8" height="17" rx="4" transform="rotate(50 51 38)"/>' +
        '<rect x="13" y="13" width="8" height="21" rx="4" transform="rotate(-14 17 24)"/>' +
        '<rect x="21" y="7" width="8" height="24" rx="4" transform="rotate(-4 25 19)"/>' +
        '<rect x="30" y="7" width="8" height="24" rx="4" transform="rotate(5 34 19)"/>' +
        '<rect x="38" y="13" width="8" height="20" rx="4" transform="rotate(15 42 23)"/>' +
        '<rect x="14" y="26" width="31" height="29" rx="13"/>' +
      '</g>' +
      '<path class="atelier-mascot-hand-cuff" d="M14 56q0-5 5-5h21q5 0 5 5l4 94h-39z"/>' +
      '<path class="atelier-mascot-hand-stripe" d="M15 66h30M14 84h33M13 102h35M12 120h37"/>' +
    '</svg>';

  function wave() {
    if (reducedMotion) return;
    var hand = document.createElement('span');
    hand.className = 'atelier-mascot-hand';
    hand.setAttribute('aria-hidden', 'true');
    hand.innerHTML = HAND;
    el.appendChild(hand);
    setTimeout(function () {
      if (hand.parentNode) hand.parentNode.removeChild(hand);
    }, 3000);
  }

  function welcome(name) {
    pendingWelcome = '';
    var first = firstName(name);
    var beats = [
      { face: GRIN, text: first ? 'hi ' + first + '! so happy you’re here' : 'hi! so happy you’re here', fx: 'spark', wave: true },
      { face: SHY, text: 'this isn’t just a portfolio, you know…', fx: 'heart', blush: true },
      { face: STARRY, text: 'it’s a little gist of my life: the work, and the girl behind it' },
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
        el.classList.toggle('is-blushing', !!beat.blush);
        if (beat.fx) burst(beat.fx);
        if (beat.wave) wave();
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
      wave();
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
