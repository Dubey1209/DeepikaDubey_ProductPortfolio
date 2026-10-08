// Dev-only: draws closed eyelids for every frame of the directions sheet, so
// the mascot can blink wherever she is looking, not only facing front.
//
//   node tools/build-blinks.mjs           write mascots/deepika-blinks.webp
//   node tools/build-blinks.mjs --debug   also write a preview to the temp dir
//
// The output is a transparent 3x3 sheet holding only the two lids of each
// frame (skin over the eye, a lash line across it), laid over the direction
// frame while she blinks. Each eye is found by its pixels: the iris and lashes
// are dark, the eye white is light, and only an eye has both touching; the
// brows are dark alone and the hair never meets white.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'mascots/deepika-directions.webp');
const OUT = join(ROOT, 'mascots/deepika-blinks.webp');
const DEBUG = process.argv.includes('--debug');

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const CW = W / 3;
const CH = info.height / 3;

const px = (x, y) => {
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};
const isDark = ([r, g, b, a]) => a > 200 && (r + g + b) / 3 < 100;
const isWhite = ([r, g, b, a]) => a > 200 && r > 225 && g > 220 && b > 210 && r - b < 30;

function findEyes(ox, oy) {
  const y0 = Math.round(CH * 0.2);
  const y1 = Math.round(CH * 0.56);
  const x0 = Math.round(CW * 0.12);
  const x1 = Math.round(CW * 0.88);
  const w = x1 - x0;
  const h = y1 - y0;
  const kind = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = px(ox + x0 + x, oy + y0 + y);
      kind[y * w + x] = isDark(p) ? 1 : isWhite(p) ? 2 : 0;
    }
  }
  const seen = new Uint8Array(w * h);
  const comps = [];
  for (let s = 0; s < w * h; s++) {
    if (!kind[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0, white = 0, edge = false;
    while (stack.length) {
      const k = stack.pop();
      const x = k % w;
      const y = (k - x) / w;
      area++;
      if (kind[k] === 2) white++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const n of [k - 1, k + 1, k - w, k + w]) {
        if (n < 0 || n >= w * h || seen[n] || !kind[n]) continue;
        if ((n === k - 1 && x === 0) || (n === k + 1 && x === w - 1)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (process.argv.includes('--trace') && area > 300) console.log('  comp', x0 + minX, y0 + minY, bw + 'x' + bh, 'area', area, 'white', white, edge ? 'edge' : '');
    if (!edge && area > 1400 && bw > 60 && bw < 130 && bh >= 36 && bh < 80) {
      comps.push({ x: x0 + minX, y: y0 + minY, w: bw, h: bh, area });
    }
  }
  comps.sort((a, b) => b.area - a.area);
  return comps.slice(0, 2).sort((a, b) => a.x - b.x);
}

// Average skin colour in a strip, ignoring anything that is not skin.
function skinAt(ox, oy, x, y, w, h) {
  [x, y, w, h] = [x, y, w, h].map(Math.round);
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const p = px(ox + xx, oy + yy);
      if (p[3] < 220 || isDark(p) || isWhite(p) || p[0] < 200 || p[0] - p[2] < 40) continue;
      r += p[0]; g += p[1]; b += p[2]; n++;
    }
  }
  if (!n) return '#f2c3a0';
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return '#' + hex(r) + hex(g) + hex(b);
}

const found = [];
for (let cell = 0; cell < 9; cell++) found[cell] = findEyes((cell % 3) * CW, Math.floor(cell / 3) * CH);
// Turned up and away, the far eye's lashes run into the hair and it cannot be
// told apart. The head turns the same way in the middle row of that column,
// so the far eye is placed where it sits relative to the near one there.
for (let cell = 0; cell < 9; cell++) {
  const eyes = found[cell];
  const ref = found[3 + (cell % 3)];
  if (eyes.length !== 1 || ref.length !== 2) continue;
  const near = eyes[0];
  const nearIsLeft = Math.abs(near.x - ref[0].x) < Math.abs(near.x - ref[1].x);
  const [a, b] = nearIsLeft ? ref : [ref[1], ref[0]];
  const far = { x: near.x + (b.x - a.x), y: near.y + (b.y - a.y), w: b.w, h: b.h };
  found[cell] = (nearIsLeft ? [near, far] : [far, near]);
}

const parts = [];
const report = [];
for (let cell = 0; cell < 9; cell++) {
  const ox = (cell % 3) * CW;
  const oy = Math.floor(cell / 3) * CH;
  const eyes = found[cell];
  report.push(cell + ': ' + eyes.map((e) => `${e.x},${e.y} ${e.w}x${e.h}`).join('  '));
  if (eyes.length !== 2) continue;
  eyes.forEach((e, i) => {
    const outerLeft = i === 0;
    const pad = 8;
    const cx = ox + e.x + e.w / 2;
    const cy = oy + e.y + e.h / 2;
    const rx = e.w * 0.6 + pad / 2;
    const ry = e.h * 0.62 + pad / 2;
    const above = skinAt(ox, oy, e.x + e.w * 0.25, Math.max(0, e.y - 16), e.w * 0.5, 10);
    const below = skinAt(ox, oy, e.x + e.w * 0.25, e.y + e.h + 4, e.w * 0.5, 10);
    const id = `g${cell}${i}`;
    // The lid line: a soft downward curve a little below the middle of the
    // eye, thicker at the outer corner, ending in a small lash flick.
    const lx0 = ox + e.x + 2;
    const lx1 = ox + e.x + e.w - 2;
    const ly = oy + e.y + e.h * 0.58;
    const sag = e.h * 0.22;
    const outerX = outerLeft ? lx0 : lx1;
    const flick = outerLeft ? -1 : 1;
    parts.push(
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${above}"/><stop offset="1" stop-color="${below}"/></linearGradient></defs>`,
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})" filter="url(#soft)"/>`,
      `<path d="M${lx0} ${ly}Q${(lx0 + lx1) / 2} ${ly + sag} ${lx1} ${ly}" fill="none" stroke="#2a1913" stroke-width="${(e.h * 0.09).toFixed(1)}" stroke-linecap="round"/>`,
      `<path d="M${outerX} ${ly}q${flick * e.w * 0.08} ${-e.h * 0.06} ${flick * e.w * 0.14} ${-e.h * 0.2}" fill="none" stroke="#2a1913" stroke-width="${(e.h * 0.06).toFixed(1)}" stroke-linecap="round"/>`
    );
  });
}
console.log(report.join('\n'));

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${info.height}">` +
  `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.6"/></filter>` +
  parts.join('') +
  `</svg>`;
// The soft edge of a lid must not spill onto her hair or brows: outside the
// eye itself, it is cut away wherever the drawing is dark.
const raster = await sharp(Buffer.from(svg)).resize(W, info.height).ensureAlpha().raw().toBuffer();
const eyeBoxes = found.flatMap((eyes, cell) =>
  eyes.map((e) => ({ x0: (cell % 3) * CW + e.x, y0: Math.floor(cell / 3) * CH + e.y, x1: (cell % 3) * CW + e.x + e.w, y1: Math.floor(cell / 3) * CH + e.y + e.h }))
);
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!raster[i + 3]) continue;
    const inEye = eyeBoxes.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);
    if (inEye) continue;
    const p = px(x, y);
    if (p[3] < 200 || (p[0] + p[1] + p[2]) / 3 < 120) raster[i + 3] = 0;
  }
}
const lidsPng = await sharp(raster, { raw: { width: W, height: info.height, channels: 4 } }).png().toBuffer();
await sharp(lidsPng).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(OUT);

if (DEBUG) {
  const lids = lidsPng;
  const prev = join(tmpdir(), 'blinks-preview.png');
  const both = await sharp(SRC).composite([{ input: lids }]).flatten({ background: '#f3eee6' }).png().toBuffer();
  await sharp(both).resize(900).toFile(prev);
  console.log('preview', prev);
}
