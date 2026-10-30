// The hero title's punctuation comes alive once the intro has played:
//   "Hey."      -> the dot is a little ink ball: hover or tap and it hops,
//                  squashing, stretching and settling in smaller bounces.
//   "I’m"       -> the apostrophe hangs like a tag and swings when the
//                  pointer brushes past or the ball lands.
//   "Deepika."  -> the dot is magnetic jelly: it leans after the pointer,
//                  stretches with speed and wobbles home; tap and it pops.
// Everything is a small spring/gravity simulation, measured in ems of the
// title so it behaves the same at every size. Off for reduced motion.
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var home = document.querySelector('.home-section');
  var title = document.querySelector('.home-title');
  if (!home || !title) return;

  function whenLive(fn) {
    if (home.classList.contains('hero-live')) return fn();
    var mo = new MutationObserver(function () {
      if (!home.classList.contains('hero-live')) return;
      mo.disconnect();
      fn();
    });
    mo.observe(home, { attributes: true, attributeFilter: ['class'] });
  }

  var canvas = document.createElement('canvas').getContext('2d');

  // Where the glyph's ink actually sits inside its span, from the font's
  // own metrics: centre x, the baseline, and the ink's top and bottom.
  function measure(span) {
    var cs = getComputedStyle(span);
    canvas.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = canvas.measureText(span.textContent);
    var probe = document.createElement('i');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    span.appendChild(probe);
    var base = probe.offsetTop;
    span.removeChild(probe);
    return {
      fs: parseFloat(cs.fontSize),
      cx: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
      top: base - m.actualBoundingBoxAscent,
      bottom: base + m.actualBoundingBoxDescent,
    };
  }

  var bodies = [];
  var running = false;
  var last = 0;

  function loop(now) {
    var left = Math.min(0.06, (now - last) / 1000 || 0.016);
    last = now;
    var busy = false;
    while (left > 1e-4) {
      var dt = Math.min(1 / 120, left);
      left -= dt;
      busy = false;
      bodies.forEach(function (b) { if (b.step(dt)) busy = true; });
    }
    if (busy) requestAnimationFrame(loop);
    else running = false;
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function puff(host, x, y, dx, size, life) {
    var p = document.createElement('span');
    p.className = 'hd-puff';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.width = p.style.height = size + 'px';
    p.style.setProperty('--dx', dx + 'px');
    p.style.setProperty('--life', life + 'ms');
    host.appendChild(p);
    setTimeout(function () { p.remove(); }, life + 50);
  }

  // ---- "Hey." : a bouncing ink ball -------------------------------------
  function ball(span, onLand) {
    var g = measure(span);
    var host = span.parentElement;
    var oy = g.bottom;
    span.style.transformOrigin = g.cx + 'px ' + oy + 'px';

    var G = g.fs * 52;
    var y = 0, vy = 0;
    var s = 0, vs = 0;
    var launchAt = 0, launchV = 0;

    function hop(height, kick) {
      if (launchAt) return;
      if (y > 0.01) {
        if (!kick) return;
        var room = Math.max(0, g.fs * 2 - y);
        vy = Math.min(Math.max(vy, 0) + Math.sqrt(2 * G * g.fs * height) * 0.7, Math.sqrt(2 * G * room));
        vs += 6;
        wake();
        return;
      }
      vs -= 7;
      launchV = Math.sqrt(2 * G * g.fs * height);
      launchAt = performance.now() + 110;
      wake();
    }

    var body = {
      step: function (dt) {
        if (launchAt && performance.now() >= launchAt) {
          launchAt = 0;
          vy = launchV;
          vs += 9;
        }
        if (y > 0 || vy > 0) {
          vy -= G * dt;
          y += vy * dt;
          if (y <= 0) {
            var hit = -vy;
            y = 0;
            vy = hit > g.fs * 3 ? hit * 0.42 : 0;
            vs -= hit / g.fs * 0.55;
            if (hit > g.fs * 6) {
              var strength = Math.min(1, hit / (g.fs * 30));
              puff(host, g.cx - g.fs * 0.05, oy - g.fs * 0.05, -g.fs * (0.25 + strength * 0.25), g.fs * 0.05, 520);
              puff(host, g.cx + g.fs * 0.05, oy - g.fs * 0.05, g.fs * (0.25 + strength * 0.25), g.fs * 0.05, 520);
              if (strength > 0.5) puff(host, g.cx, oy - g.fs * 0.06, g.fs * 0.05, g.fs * 0.035, 420);
            }
            if (onLand) onLand(hit / g.fs);
          }
        }
        vs += (-260 * s - 15 * vs) * dt;
        s += vs * dt;
        var stretch = Math.min(0.5, Math.abs(vy) / g.fs * 0.012);
        var sy = Math.max(0.45, 1 + s + stretch);
        var sx = 1 / Math.sqrt(sy);
        span.style.transform = 'translate3d(0,' + (-y).toFixed(2) + 'px,0) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
        var still = !launchAt && y === 0 && vy === 0 && Math.abs(s) < 0.002 && Math.abs(vs) < 0.02;
        if (still) span.style.transform = '';
        return !still;
      },
      hop: hop,
    };
    bodies.push(body);

    span.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hop(0.75); });
    span.addEventListener('click', function () { hop(1.35, true); });
    return body;
  }

  // ---- "I’m" : a hanging, swinging apostrophe ---------------------------
  function tag(span) {
    var g = measure(span);
    span.style.transformOrigin = g.cx + 'px ' + (g.top + g.fs * 0.02) + 'px';
    var a = 0, va = 0;

    var body = {
      step: function (dt) {
        va += (-140 * a - 4.2 * va) * dt;
        a += va * dt;
        a = Math.max(-55, Math.min(55, a));
        span.style.transform = 'rotate(' + a.toFixed(2) + 'deg)';
        var still = Math.abs(a) < 0.05 && Math.abs(va) < 0.3;
        if (still) { a = 0; va = 0; span.style.transform = ''; }
        return !still;
      },
      push: function (w) {
        va += w;
        wake();
      },
    };
    bodies.push(body);

    var px = null, pt = 0;
    title.addEventListener('pointermove', function (e) {
      var now = performance.now();
      if (px !== null && now - pt < 80) {
        var r = span.getBoundingClientRect();
        var d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height * 0.3));
        var reach = g.fs * 0.9;
        if (d < reach) {
          var vx = (e.clientX - px) / Math.max(1, now - pt);
          body.push(vx * 55 * (1 - d / reach));
        }
      }
      px = e.clientX;
      pt = now;
    });
    title.addEventListener('pointerleave', function () { px = null; });
    span.addEventListener('click', function () { body.push(420); });
    return body;
  }

  // ---- "Deepika." : magnetic jelly dot ----------------------------------
  function jelly(span) {
    var g = measure(span);
    var host = span.parentElement;
    var cy = (g.top + g.bottom) / 2;
    span.style.transformOrigin = g.cx + 'px ' + cy + 'px';

    var x = 0, y = 0, vx = 0, vy = 0;
    var tx = 0, ty = 0;
    var pop = 0, vpop = 0;

    var body = {
      step: function (dt) {
        vx += (240 * (tx - x) - 13 * vx) * dt;
        vy += (240 * (ty - y) - 13 * vy) * dt;
        x += vx * dt;
        y += vy * dt;
        vpop += (-300 * pop - 11 * vpop) * dt;
        pop += vpop * dt;
        var speed = Math.hypot(vx, vy);
        var stretch = Math.min(0.6, speed / g.fs * 0.03);
        var ang = Math.atan2(vy, vx) * 180 / Math.PI;
        var k = 1 + pop;
        span.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) rotate(' + ang.toFixed(1) + 'deg) scale(' + ((1 + stretch) * k).toFixed(3) + ',' + (k / (1 + stretch)).toFixed(3) + ') rotate(' + (-ang).toFixed(1) + 'deg)';
        var still = tx === 0 && ty === 0 && Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && speed < 0.5 && Math.abs(pop) < 0.003 && Math.abs(vpop) < 0.03;
        if (still) { x = y = vx = vy = pop = vpop = 0; span.style.transform = ''; }
        return !still;
      },
    };
    bodies.push(body);

    var reach = g.fs * 1.1;
    var pull = g.fs * 0.32;
    function track(e) {
      var r = host.getBoundingClientRect();
      var hx = r.left + g.cx, hy = r.top + cy;
      var dx = e.clientX - hx, dy = e.clientY - hy;
      var d = Math.hypot(dx, dy);
      if (d < reach && e.pointerType === 'mouse') {
        var f = 1 - d / reach;
        var lead = Math.min(pull, d * 0.45) * (0.4 + f * 0.6);
        tx = d ? dx / d * lead : 0;
        ty = d ? dy / d * lead : 0;
      } else {
        tx = 0; ty = 0;
      }
      wake();
    }
    home.addEventListener('pointermove', track);
    home.addEventListener('pointerleave', function () { tx = 0; ty = 0; wake(); });

    body.pop = function (nudge) {
      vpop += 9;
      if (nudge) vx += g.fs * nudge;
      var ring = document.createElement('span');
      ring.className = 'hd-ring';
      ring.style.left = g.cx + 'px';
      ring.style.top = cy + 'px';
      ring.style.width = ring.style.height = g.fs * 0.2 + 'px';
      host.appendChild(ring);
      setTimeout(function () { ring.remove(); }, 750);
      wake();
    };
    span.addEventListener('click', function () { body.pop(); });
    return body;
  }

  whenLive(function () {
    var line1 = title.querySelectorAll('.hero-line-1 .fx-ch > span');
    var line2 = title.querySelectorAll('.hero-line-2 .fx-ch > span');
    if (!line1.length || !line2.length) return;

    var heyDot = line1[line1.length - 1];
    var apos = Array.prototype.filter.call(line2, function (s) { return /[’']/.test(s.textContent); })[0];
    var endDot = line2[line2.length - 1];

    // Let the title settle (fonts, the intro's last frame) before measuring.
    var go = function () {
      title.classList.add('hd-live');
      var swing = apos && /[’']/.test(apos.textContent) ? tag(apos) : null;
      var b = heyDot && heyDot.textContent === '.' ? ball(heyDot, function (impact) {
        if (swing && impact > 6) swing.push(-Math.min(380, impact * 22));
      }) : null;
      var j = endDot && endDot.textContent === '.' ? jelly(endDot) : null;
      [heyDot, apos, endDot].forEach(function (s) { if (s) s.classList.add('hd-glyph'); });

      // Opening beat on every load: the ball takes a big hop, its landing
      // knocks the apostrophe swinging, then the last dot pops and wobbles.
      if (b) setTimeout(function () { b.hop(1.5); }, 250);
      if (b) setTimeout(function () { b.hop(0.6); }, 1500);
      if (j) setTimeout(function () { j.pop(5); }, 2300);

      // After that, now and then one of the dots moves on its own.
      var visible = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(title);
      }
      var idle = function () {
        if (visible && !document.hidden) {
          if (j && (!b || Math.random() < 0.3)) j.pop(Math.random() < 0.5 ? 4 : -4);
          else if (b) b.hop(0.32 + Math.random() * 0.2);
        }
        setTimeout(idle, 6000 + Math.random() * 5000);
      };
      setTimeout(idle, 7000);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(go, 120); });
    else setTimeout(go, 300);
  });
})();
