// Dev-only: lifts the drop earrings out of every direction frame so the
// mascot can swing them.
//
//   node tools/build-earrings.mjs           write the two sheets, print boxes
//   node tools/build-earrings.mjs --debug   also write previews to the temp dir
//
// Two transparent sheets, laid out like the directions sheet:
//   deepika-earcover.webp  the earrings painted out (each row of pixels under
//                          one filled in from its neighbours left and right;
//                          the bar is thin and upright, so that reads clean)
//   deepika-eardrops.webp  the earrings alone, edges kept soft by solving each
//                          pixel's coverage against the painted-out background
// mascot.js lays the cover over the frame and hangs the drops on top, each
// pivoting at its stud. The printed boxes go into EARRINGS in mascot.js.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'mascots/deepika-directions.webp');
const DEBUG = process.argv.includes('--debug');

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const CW = W / 3;
const CH = H / 3;
const at = (x, y) => (y * W + x) * 4;
const lum = (i) => (data[i] + data[i + 1] + data[i + 2]) / 3;
const isBright = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return data[i + 3] > 200 && Math.min(r, g, b) > 135 && Math.max(r, g, b) - Math.min(r, g, b) < 55;
};

// Two-pixel reach, so a bead joined to its bar by a dim pixel stays one blob.
const STEPS = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx || dy) STEPS.push([dx, dy]);

const cover = Buffer.alloc(W * H * 4);
const drops = Buffer.alloc(W * H * 4);
const boxes = [];

for (let cell = 0; cell < 9; cell++) {
  const ox = (cell % 3) * CW;
  const oy = Math.floor(cell / 3) * CH;
  const sides = [];
  for (const [fx0, fx1] of [[0.1, 0.42], [0.58, 0.9]]) {
    const x0 = ox + Math.round(CW * fx0), x1 = ox + Math.round(CW * fx1);
    const y0 = oy + Math.round(CH * 0.44), y1 = oy + Math.round(CH * 0.64);
    // Largest bright blob in the zone shaped like an upright drop: taller
    // than wide, so an eye white or a glint in the hair doesn't pass.
    const seen = new Set();
    let best = null;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = y * W + x;
        if (seen.has(k) || !isBright(k * 4)) continue;
        const stack = [k];
        seen.add(k);
        const px = [];
        let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
        while (stack.length) {
          const q = stack.pop();
          px.push(q);
          const qx = q % W, qy = (q - qx) / W;
          bx0 = Math.min(bx0, qx); bx1 = Math.max(bx1, qx);
          by0 = Math.min(by0, qy); by1 = Math.max(by1, qy);
          for (const [dx, dy] of STEPS) {
            const nx = qx + dx, ny = qy + dy;
            if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
            const n = ny * W + nx;
            if (seen.has(n) || !isBright(n * 4)) continue;
            seen.add(n);
            stack.push(n);
          }
        }
        const bw = bx1 - bx0, bh = by1 - by0;
        // A far ear may show only the bead: small and roundish, still fine.
        const drop = bh >= 10 && bh >= bw * 1.5 && bw <= 30;
        const bead = bh >= 8 && bw <= 12 && px.length >= 30;
        const ok = by0 > y0 && (drop || bead);
        if (DEBUG && px.length >= 12) console.log('cell', cell, fx0, ok ? 'ok' : 'no', bx0 - ox, by0 - oy, bw, bh, px.length);
        if (ok && (!best || px.length > best.px.length)) best = { px, x0: bx0, y0: by0, x1: bx1, y1: by1 };
      }
    }
    sides.push(best);
  }

  const cellBoxes = [];
  for (const s of sides) {
    if (!s) {
      cellBoxes.push(null);
      continue;
    }
    // Mask: the blob grown sideways and down past its dark ink outline, but
    // barely up, so the hook through the lobe stays painted in the frame.
    const PAD = 4;
    const mx0 = s.x0 - PAD - 4, mx1 = s.x1 + PAD + 4, my0 = s.y0 - 2, my1 = s.y1 + PAD + 2;
    const mw = mx1 - mx0 + 1, mh = my1 - my0 + 1;
    const core = new Uint8Array(mw * mh);
    for (const q of s.px) {
      const qx = q % W, qy = (q - qx) / W;
      core[(qy - my0) * mw + (qx - mx0)] = 1;
    }
    // Distance (chessboard) from the blob, capped.
    const dist = new Uint8Array(mw * mh).fill(99);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        if (!core[y * mw + x]) continue;
        for (let dy = -1; dy <= PAD; dy++) {
          for (let dx = -PAD; dx <= PAD; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue;
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            if (d < dist[ny * mw + nx]) dist[ny * mw + nx] = d;
          }
        }
      }
    }
    const inMask = (x, y) => x >= 0 && x < mw && dist[y * mw + x] <= PAD;
    let white = 0;
    for (const q of s.px) white = Math.max(white, lum(q * 4));
    const fill = new Float32Array(mw * mh * 3);
    const near = (x, y, step) => {
      // Mean of the three pixels just past the mask edge.
      const out = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        const i = at(mx0 + x + step * k, my0 + y);
        for (let c = 0; c < 3; c++) out[c] += data[i + c] / 3;
      }
      return out;
    };
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        if (!inMask(x, y)) continue;
        let l = x, r = x;
        while (inMask(l, y)) l--;
        while (inMask(r, y)) r++;
        const L = near(l, y, -1), R = near(r, y, 1);
        const t = (x - l) / (r - l);
        for (let c = 0; c < 3; c++) fill[(y * mw + x) * 3 + c] = L[c] * (1 - t) + R[c] * t;
      }
    }
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const d = dist[y * mw + x];
        if (d > PAD) continue;
        // A little vertical smoothing, so the fill doesn't band row by row.
        const bg = [0, 0, 0];
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= mh || dist[yy * mw + x] > PAD) continue;
          for (let c = 0; c < 3; c++) bg[c] += fill[(yy * mw + x) * 3 + c];
          n++;
        }
        for (let c = 0; c < 3; c++) bg[c] /= n;
        const i = at(mx0 + x, my0 + y);
        // Feather the cover's outermost ring into the frame.
        const edge = d === PAD ? 0.5 : 1;
        cover[i] = bg[0]; cover[i + 1] = bg[1]; cover[i + 2] = bg[2]; cover[i + 3] = Math.round(255 * edge);
        // How much of this pixel is earring: bright metal against the fill,
        // or, close in, its dark ink outline.
        const lb = (bg[0] + bg[1] + bg[2]) / 3;
        const l = lum(i);
        let a = (l - lb) / Math.max(1, white - lb);
        if (d <= 2 && lb - l > 10) a = Math.max(a, (lb - l - 10) / Math.max(1, lb - 18));
        a = Math.max(0, Math.min(1, a));
        if (a > 0.04) {
          for (let c = 0; c < 3; c++) {
            drops[i + c] = Math.max(0, Math.min(255, (data[i + c] - (1 - a) * bg[c]) / a));
          }
          drops[i + 3] = Math.round(a * 255);
        }
      }
    }
    const f = (v, d) => +(v / d).toFixed(4);
    // Box in the cell, then the pivot (top of the drop) within the box.
    cellBoxes.push([
      f(mx0 - ox, CW), f(my0 - oy, CH), f(mw, CW), f(mh, CH),
      f((s.x0 + s.x1) / 2 - mx0 + 0.5, mw), f(s.y0 - my0, mh),
    ]);
  }
  boxes.push(cellBoxes);
}

const write = (buf, name) =>
  sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(join(ROOT, 'mascots', name));
await write(cover, 'deepika-earcover.webp');
await write(drops, 'deepika-eardrops.webp');
console.log(JSON.stringify(boxes));

if (DEBUG) {
  const c = await sharp(cover, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  const covered = await sharp(SRC).composite([{ input: c }]).flatten({ background: '#f3eee6' }).png().toBuffer();
  await sharp(covered).resize(900).toFile(join(tmpdir(), 'ear-covered.png'));
  const d = await sharp(drops, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  await sharp(d).flatten({ background: '#3a2a22' }).resize(900).toFile(join(tmpdir(), 'ear-drops.png'));
  console.log('previews in', tmpdir());
}
