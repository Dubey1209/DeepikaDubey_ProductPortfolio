// Dev-only: turns the generated 3x3 mascot drawings into the two sprite sheets
// the site serves. Like optimize-images.mjs, the output is committed and served
// as-is, so the site still has no build step.
//
//   node tools/build-mascot.mjs           measure, check, write mascots/*.webp
//   node tools/build-mascot.mjs --check   measure and check only
//   node tools/build-mascot.mjs --force   write even if the check fails
//
// The image model draws nine figures per sheet but does not place them on an
// exact grid, so each figure is found by its pixels and redrawn into an exact
// grid, anchored by the top of the hair and the centre of the body.
//
// Not by the bottom of the sweater, which was the first choice: the model draws
// the head the same size in every frame but shows more or less sweater from row
// to row (figures measured 293-315px tall at a near-constant 259px width), so
// bottom-aligning made the head pop ~19px up whenever the mascot blinked. Every
// frame is instead cut to the shortest figure's height, so both the head and
// the sweater's bottom edge stay put.
//
// The check compares figure widths across all 18 frames: a figure wider or
// narrower than the rest is a character that would visibly grow or shrink when
// the mascot switches frames, and needs redrawing.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { statSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');
const FORCE = process.argv.includes('--force');

// `columns` maps each output column to a source column, optionally mirrored.
//
// The directions sheet needs it because the image model will not draw a head
// turned to the left: across two attempts, with the prompt spelling out which
// way the nose should point, every one of the nine heads was turned to the
// image's right, so the mascot never looked left however far left the cursor
// went. Its right-turned column is used as drawn and mirrored for the left.
const SHEETS = [
  {
    src: 'tools/mascot-src/deepika-directions-raw.jpg',
    out: 'mascots/deepika-directions.webp',
    columns: [{ from: 2, flip: true }, { from: 1 }, { from: 2 }],
    // Source columns whose faces look straight out, for sizing the sheet.
    frontFacing: [1],
  },
  {
    src: 'tools/mascot-src/deepika-reactions-raw.jpg',
    out: 'mascots/deepika-reactions.webp',
    columns: [{ from: 0 }, { from: 1 }, { from: 2 }],
    frontFacing: [0, 1, 2],
  },
];

// A background pixel this close to the sampled background colour, and
// connected to the edge of the sheet, becomes transparent. Flood-filling from
// the edges rather than keying the colour everywhere keeps the eye whites.
//
// Kept tight. The background's JPEG noise never exceeds 9, but the cream
// sweater stripes sit at 20-35 and run out to the sleeves with no outline in
// between: at 30 the fill ran along them and left ~5,000 transparent pixels
// per frame, which read on the dark theme as the sweater torn into strips.
const BG_TOLERANCE = 12;
const RIM_RINGS = 2;
// How far inside the silhouette the hair's white edge highlight sits.
const EDGE_REACH = 8;
// Background pockets left inside curled strands: how far from the outside
// they may be, and how large, before they are treated as part of the drawing.
const POCKET_REACH = 24;
const POCKET_MAX = 2500;
const HAIR = [34, 26, 22];
const INK = [24, 18, 16];

// Same proportions as the About photo card (340 x 400), so the sheet can be
// shown with `background-size: 300% 300%` without stretching.
const CELL_W = 340;
const CELL_H = 400;
// 2x the display size, so a 2x screen draws the sheet pixel for pixel. At 1.5x
// the browser had to upscale on those screens, and the mascot looked soft.
const RESOLUTION = 2;

// How far a figure's size may differ from the median before it counts as a jump.
const TOLERANCE = 0.06;

// A pixel belongs to the figure if any channel differs from the background by
// more than this. High enough to ignore JPEG noise in the flat background.
const INK_THRESHOLD = 38;

async function load(src) {
  const { data, info } = await sharp(join(ROOT, src))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function backgroundOf(img) {
  const samples = [];
  for (const [cx, cy] of [[4, 4], [img.width - 12, 4], [4, img.height - 12], [img.width - 12, img.height - 12]]) {
    for (let y = cy; y < cy + 8; y += 1) {
      for (let x = cx; x < cx + 8; x += 1) {
        const i = (y * img.width + x) * 3;
        samples.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
      }
    }
  }
  const median = (k) => samples.map((s) => s[k]).sort((a, b) => a - b)[samples.length >> 1];
  return [median(0), median(1), median(2)];
}

// Rows with only a couple of ink pixels are JPEG noise or a stray hair.
const MIN_RUN = 3;

const inkTest = (img, bg) => (x, y) => {
  const i = (y * img.width + x) * 3;
  return (
    Math.abs(img.data[i] - bg[0]) > INK_THRESHOLD ||
    Math.abs(img.data[i + 1] - bg[1]) > INK_THRESHOLD ||
    Math.abs(img.data[i + 2] - bg[2]) > INK_THRESHOLD
  );
};

/**
 * The vertical extent of the three figures in one column, found from the gaps
 * between them.
 *
 * The model does not place figures on exact thirds: cutting the sheet at
 * height / 3 put the bottom of one row's sweater inside the next row's cell,
 * which measured those figures as 20px taller than they are and flagged a jump
 * that was not there.
 */
function rowBands(img, bg, col) {
  const isInk = inkTest(img, bg);
  const x0 = Math.round((col * img.width) / 3);
  const x1 = Math.round(((col + 1) * img.width) / 3);

  const bands = [];
  let start = -1;
  for (let y = 0; y <= img.height; y += 1) {
    let count = 0;
    if (y < img.height) {
      for (let x = x0; x < x1; x += 1) if (isInk(x, y)) count += 1;
    }
    if (count >= MIN_RUN && start < 0) start = y;
    if (count < MIN_RUN && start >= 0) {
      bands.push([start, y]);
      start = -1;
    }
  }

  const figures = bands
    .filter(([a, b]) => b - a > 60)
    .sort((p, q) => q[1] - q[0] - (p[1] - p[0]))
    .slice(0, 3)
    .sort((p, q) => p[0] - q[0]);
  if (figures.length !== 3) throw new Error(`expected 3 figures in column ${col}, found ${figures.length}`);
  return figures;
}

function measureCell(img, bg, col, row, band) {
  const x0 = Math.round((col * img.width) / 3);
  const x1 = Math.round(((col + 1) * img.width) / 3);
  const [y0, y1] = band;
  const isInk = inkTest(img, bg);

  let top = -1;
  let bottom = -1;
  let left = x1;
  let right = x0;

  for (let y = y0; y < y1; y += 1) {
    let count = 0;
    let rowLeft = x1;
    let rowRight = x0;
    for (let x = x0; x < x1; x += 1) {
      if (isInk(x, y)) {
        count += 1;
        if (x < rowLeft) rowLeft = x;
        if (x > rowRight) rowRight = x;
      }
    }
    if (count >= MIN_RUN) {
      if (top < 0) top = y;
      bottom = y;
      left = Math.min(left, rowLeft);
      right = Math.max(right, rowRight);
    }
  }

  if (top < 0) throw new Error(`no figure found in cell ${row},${col}`);

  // Anchor on the sweater's bottom edge: average the ink extent over the last
  // few rows and take its centre.
  let sum = 0;
  let rows = 0;
  for (let y = bottom - 6; y <= bottom - 2; y += 1) {
    let l = -1;
    let r = -1;
    for (let x = x0; x < x1; x += 1) {
      if (isInk(x, y)) {
        if (l < 0) l = x;
        r = x;
      }
    }
    if (l >= 0) {
      sum += (l + r) / 2;
      rows += 1;
    }
  }
  const anchorX = rows ? sum / rows : (left + right) / 2;

  // Face width, from skin pixels across the cheeks and ears. Overall width is
  // no use for comparing head sizes: it is mostly hair, which the model
  // spreads differently in every frame.
  const isSkin = (x, y) => {
    const i = (y * img.width + x) * 3;
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    return r > 190 && g > 140 && g < 222 && r - b > 62;
  };
  const height = bottom - top + 1;
  const spans = [];
  for (let y = Math.round(top + height * 0.2); y <= Math.round(top + height * 0.36); y += 1) {
    let l = -1;
    let r = -1;
    for (let x = x0; x < x1; x += 1) {
      if (isSkin(x, y)) {
        if (l < 0) l = x;
        r = x;
      }
    }
    if (l >= 0) spans.push(r - l + 1);
  }
  const faceW = spans.length ? [...spans].sort((a, b) => a - b)[spans.length >> 1] : 0;

  return { col, row, top, bottom, left, right, width: right - left + 1, height, anchorX, faceW };
}

/**
 * Marks enclosed pockets of background inside the hair as background.
 *
 * Where a loose strand curls away from the hair, the model leaves cream
 * between the strand and the hair. The edge flood fill cannot reach it, so it
 * stayed opaque and showed on the page as pale, broken blotches along the
 * hair's outline. A pocket counts only when it is near the silhouette, small,
 * and walled mostly by near-black hair: eye whites are far inside, and the
 * cream sweater stripes are walled by brown knit, not black.
 */
function removePockets(img, bg, isBg, dist, pixelLum) {
  const { width, height } = img;
  const n = width * height;

  const reach = new Uint8Array(n).fill(255);
  let frontier = [];
  for (let p = 0; p < n; p += 1) {
    if (isBg[p]) {
      reach[p] = 0;
      frontier.push(p);
    }
  }
  for (let step = 1; step <= POCKET_REACH && frontier.length; step += 1) {
    const next = [];
    for (const p of frontier) {
      const x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q >= 0 && q < n && reach[q] === 255) {
          reach[q] = step;
          next.push(q);
        }
      }
    }
    frontier = next;
  }

  const candidate = (p) => !isBg[p] && dist(p) <= BG_TOLERANCE + 12;
  const seen = new Uint8Array(n);
  let removed = 0;
  for (let s = 0; s < n; s += 1) {
    if (seen[s] || !candidate(s)) continue;
    const pixels = [];
    const stack = [s];
    seen[s] = 1;
    let near = false;
    let wall = 0;
    let dark = 0;
    while (stack.length) {
      const p = stack.pop();
      pixels.push(p);
      if (reach[p] !== 255) near = true;
      const x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q < 0 || q >= n) continue;
        if (candidate(q)) {
          if (!seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        } else if (!isBg[q]) {
          wall += 1;
          // Walls are anti-aliased, so look one pixel further for the ink.
          const beyond = q + (q - p);
          const ink = Math.min(pixelLum(q), beyond >= 0 && beyond < n ? pixelLum(beyond) : 255);
          if (ink < 60) dark += 1;
        }
      }
    }
    if (near && pixels.length <= POCKET_MAX && wall && dark / wall >= 0.6) {
      for (const p of pixels) isBg[p] = 1;
      removed += 1;
    }
  }
  return removed;
}

/** RGBA copy of the sheet with the edge-connected background made transparent. */
function cutOut(img, bg) {
  const { width, height, data } = img;
  const dist = (p) =>
    Math.max(
      Math.abs(data[p * 3] - bg[0]),
      Math.abs(data[p * 3 + 1] - bg[1]),
      Math.abs(data[p * 3 + 2] - bg[2])
    );

  const pixelLum = (p) => 0.299 * data[p * 3] + 0.587 * data[p * 3 + 1] + 0.114 * data[p * 3 + 2];
  const isBg = new Uint8Array(width * height);
  const stack = [];
  const seed = (p) => {
    if (!isBg[p] && dist(p) <= BG_TOLERANCE) {
      isBg[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    if (x > 0) seed(p - 1);
    if (x < width - 1) seed(p + 1);
    if (p >= width) seed(p - width);
    if (p < width * (height - 1)) seed(p + width);
  }

  const pockets = removePockets(img, bg, isBg, dist, pixelLum);
  console.log(`  removed ${pockets} enclosed background pocket(s)`);

  // The model draws a thin white highlight along the outside of the hair,
  // between two black outlines. On the cream it was drawn on, it is invisible;
  // with the background removed it shows on the dark theme as bright slivers
  // down both sides of the hair. Read as pockets of background at first, which
  // two rounds of pocket removal did not touch: the pixels are whiter than the
  // background (249,247,232 against 252,233,209), not the same colour.
  //
  // So near-white pixels a few pixels inside the silhouette are painted hair
  // colour, which merges the two outlines and the highlight into one dark edge.
  // Neutral white only: the cream stripes, which also reach the silhouette at
  // the sleeves, are far warmer (236,210,189), and eye whites and highlights
  // are well inside it.
  const reach = new Uint8Array(width * height).fill(255);
  let frontier = [];
  for (let p = 0; p < width * height; p += 1) {
    if (isBg[p]) {
      reach[p] = 0;
      frontier.push(p);
    }
  }
  for (let step = 1; step <= EDGE_REACH && frontier.length; step += 1) {
    const next = [];
    for (const p of frontier) {
      const x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q >= 0 && q < width * height && reach[q] === 255) {
          reach[q] = step;
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  const highlight = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    if (isBg[p] || reach[p] === 255) continue;
    const r = data[p * 3];
    const b = data[p * 3 + 2];
    // Down to dark grey, to take the anti-aliased pixels where the highlight
    // meets the outlines: a cut at white, then at mid-grey (120), each left a
    // dotted grey trace along the hair. Brown knit and skin are excluded by
    // their warmth, not their brightness.
    if (pixelLum(p) > 45 && r - b < 30) highlight[p] = 1;
  }

  // Pixels along the outline are part ink, part cream. Left as they are they
  // draw a pale halo that shows badly on the dark theme. Every outline here is
  // near-black, so each rim pixel is unmixed: its colour becomes the ink and
  // its opacity how far it is from cream towards that ink.
  const touches = (mask, p) => {
    const x = p % width;
    return (
      (x > 0 && mask[p - 1]) ||
      (x < width - 1 && mask[p + 1]) ||
      (p >= width && mask[p - width]) ||
      (p < width * (height - 1) && mask[p + width])
    );
  };
  const rim = new Uint8Array(width * height);
  for (let ring = 0; ring < RIM_RINGS; ring += 1) {
    const reference = ring === 0 ? isBg : rim.slice();
    for (let p = 0; p < width * height; p += 1) {
      if (!isBg[p] && !rim[p] && touches(reference, p)) rim[p] = 1;
    }
  }

  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const bgLum = lum(bg[0], bg[1], bg[2]);
  const inkLum = lum(INK[0], INK[1], INK[2]);

  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    const r = data[p * 3];
    const g = data[p * 3 + 1];
    const b = data[p * 3 + 2];
    if (isBg[p]) continue;
    if (highlight[p]) {
      rgba.set([HAIR[0], HAIR[1], HAIR[2], 255], p * 4);
      continue;
    }
    if (rim[p]) {
      const a = Math.max(0, Math.min(1, (bgLum - lum(r, g, b)) / (bgLum - inkLum)));
      rgba.set([INK[0], INK[1], INK[2], Math.round(a * 255)], p * 4);
      continue;
    }
    rgba.set([r, g, b, 255], p * 4);
  }
  return rgba;
}

/**
 * The silhouette as a signed distance field, one byte per source pixel:
 * 128 is the edge, and each source pixel inside (outside) adds (subtracts)
 * SDF_STEP. Upscaling this and cutting it at 128 gives a smooth outline at
 * any size; upscaling the alpha itself reproduces the source pixel grid as a
 * staircase along the hair, which no blur-and-recontrast fully removed.
 */
const SDF_STEP = 16;

function signedDistance(rgba, width, height) {
  const n = width * height;
  const inside = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) inside[p] = rgba[p * 4 + 3] >= 128 ? 1 : 0;

  // Two-pass chamfer distance to the nearest pixel of the other kind.
  const dist = (want) => {
    const d = new Float32Array(n).fill(1e6);
    for (let p = 0; p < n; p += 1) if (inside[p] !== want) d[p] = 0;
    const A = 1;
    const B = Math.SQRT2;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x;
        if (!d[p]) continue;
        let v = d[p];
        if (x > 0) v = Math.min(v, d[p - 1] + A);
        if (y > 0) {
          v = Math.min(v, d[p - width] + A);
          if (x > 0) v = Math.min(v, d[p - width - 1] + B);
          if (x < width - 1) v = Math.min(v, d[p - width + 1] + B);
        }
        d[p] = v;
      }
    }
    for (let y = height - 1; y >= 0; y -= 1) {
      for (let x = width - 1; x >= 0; x -= 1) {
        const p = y * width + x;
        if (!d[p]) continue;
        let v = d[p];
        if (x < width - 1) v = Math.min(v, d[p + 1] + A);
        if (y < height - 1) {
          v = Math.min(v, d[p + width] + A);
          if (x < width - 1) v = Math.min(v, d[p + width + 1] + B);
          if (x > 0) v = Math.min(v, d[p + width - 1] + B);
        }
        d[p] = v;
      }
    }
    return d;
  };

  const toOutside = dist(1);
  const toInside = dist(0);
  const sdf = Buffer.alloc(n);
  for (let p = 0; p < n; p += 1) {
    const s = inside[p] ? toOutside[p] - 0.5 : -(toInside[p] - 0.5);
    sdf[p] = Math.max(0, Math.min(255, Math.round(128 + s * SDF_STEP)));
  }
  return sdf;
}

const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];
const hex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

async function main() {
  const sheets = [];
  for (const sheet of SHEETS) {
    const img = await load(sheet.src);
    const bg = backgroundOf(img);
    const bands = [0, 1, 2].map((col) => rowBands(img, bg, col));
    const cells = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) cells.push(measureCell(img, bg, col, row, bands[col][row]));
    }
    sheets.push({ ...sheet, img, bg, cells });
  }

  // Both sheets are swapped between at runtime, so they are checked as one set.
  const all = sheets.flatMap((s) => s.cells.map((c) => ({ ...c, sheet: s.out })));
  const medH = median(all.map((c) => c.height));
  const medW = median(all.map((c) => c.width));

  console.log(`Median figure: ${medW} x ${medH}px. Width tolerance ${TOLERANCE * 100}%.`);
  console.log('Height is informational: it varies with how much sweater is drawn, and is cropped away.');
  let failures = 0;
  for (const s of sheets) {
    console.log(`\n${s.out}  (background ${hex(s.bg)})`);
    for (const c of s.cells) {
      const dh = (c.height - medH) / medH;
      const dw = (c.width - medW) / medW;
      const bad = Math.abs(dw) > TOLERANCE;
      if (bad) failures += 1;
      console.log(
        `  r${c.row}c${c.col}  ${String(c.width).padStart(4)} x ${String(c.height).padStart(4)}` +
          `  height ${(dh * 100).toFixed(1).padStart(5)}%  width ${(dw * 100).toFixed(1).padStart(5)}%` +
          `  face ${String(c.faceW).padStart(3)}` +
          `${bad ? '  <-- JUMPS' : ''}`
      );
    }
  }

  // The image model draws each sheet at its own size: the reactions faces came
  // out ~3.5% narrower than the front-facing directions faces, so every
  // reaction made the head visibly shrink and grow back. Each sheet gets one
  // correction, measured on front-facing faces only (a turned face is narrower
  // because it is turned, not because it is smaller).
  const front = (s) => s.cells.filter((c) => s.frontFacing.includes(c.col) && c.faceW);
  const refFace = median(front(sheets[0]).map((c) => c.faceW));
  for (const s of sheets) {
    const faces = front(s).map((c) => c.faceW);
    s.faceScale = refFace / median(faces);
    console.log(`${s.out}: front face ${median(faces)}px, scaled x${s.faceScale.toFixed(4)}`);
  }

  console.log(failures ? `\n${failures} frame(s) outside tolerance.` : '\nAll 18 frames consistent.');
  if (CHECK_ONLY) return;
  if (failures && !FORCE) {
    console.log('Not writing. Redraw the flagged frames, or pass --force.');
    process.exitCode = 1;
    return;
  }

  // One scale for every frame: scaling frames individually would hide a size
  // jump by turning it into a different one.
  const commonH = Math.min(...all.map((c) => c.height));
  const maxW = Math.max(...all.map((c) => c.width));
  const fit = Math.min((CELL_H * 0.94) / commonH, (CELL_W * 0.98) / maxW);
  // Written at twice the display size: on high-density screens the browser
  // would otherwise upscale a 1x sheet itself, softening every outline.
  const scale = fit * RESOLUTION;
  const cellW = CELL_W * RESOLUTION;
  const cellH = CELL_H * RESOLUTION;
  const h = Math.round(commonH * scale);

  for (const s of sheets) {
    const rgba = cutOut(s.img, s.bg);
    // Lightly blurred so single-pixel JPEG bumps along the cut become gentle
    // curves rather than nicks.
    const sdf = await sharp(signedDistance(rgba, s.img.width, s.img.height), {
      raw: { width: s.img.width, height: s.img.height, channels: 1 },
    })
      .blur(0.7)
      .extractChannel(0)
      .raw()
      .toBuffer();
    const composites = [];
    const sheetScale = scale * s.faceScale;
    // A sheet scaled up shows less sweater, so the hair top stays where every
    // other frame has it and the sweater still ends flush with the cell.
    const srcH = Math.min(commonH, Math.floor(commonH / s.faceScale));

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const { from, flip } = s.columns[col];
        const c = s.cells.find((cell) => cell.row === row && cell.col === from);
        const w = Math.round(c.width * sheetScale);
        const ph = Math.round(srcH * sheetScale);

        let resized = sharp(rgba, { raw: { width: s.img.width, height: s.img.height, channels: 4 } })
          .extract({ left: c.left, top: c.top, width: c.width, height: srcH })
          .resize(w, ph, { kernel: 'lanczos3' });
        if (flip) resized = resized.flop();
        const big = await resized.raw().toBuffer();

        // Colour and silhouette are finished separately.
        //
        // Upscaling the ~330px source ~2.5x softens the ink lines; an unsharp
        // mask brings them back. Stronger than this (m2 2.4) drew pale halos
        // beside the nose and mouth lines.
        //
        // The silhouette comes from the distance field instead of the alpha:
        // the cut-out is decided per source pixel, so an upscaled alpha is a
        // staircase of 2.5px steps, and sharpening made it visibly jagged.
        // Cutting the upscaled field at its midpoint, with a one-pixel ramp,
        // gives an outline that is smooth and still crisp.
        const rgb = await sharp(big, { raw: { width: w, height: ph, channels: 4 } })
          .removeAlpha()
          .sharpen({ sigma: 1.0, m1: 0.9, m2: 2.0 })
          .raw()
          .toBuffer();
        const ramp = (sheetScale * 255) / SDF_STEP;
        let field = sharp(sdf, { raw: { width: s.img.width, height: s.img.height, channels: 1 } })
          .extract({ left: c.left, top: c.top, width: c.width, height: srcH })
          .resize(w, ph, { kernel: 'cubic' });
        if (flip) field = field.flop();
        // extractChannel: sharp writes a one-channel raw image out as three.
        const alpha = await field
          .linear(ramp, 127.5 - 128 * ramp)
          .extractChannel(0)
          .raw()
          .toBuffer();
        let piece = await sharp(rgb, { raw: { width: w, height: ph, channels: 3 } })
          .joinChannel(alpha, { raw: { width: w, height: ph, channels: 1 } })
          .png()
          .toBuffer();
        // Hair top at the same height in every cell, the cut sweater flush
        // with the cell bottom, the body's centre on the cell's centre.
        const anchor = flip ? c.right - c.anchorX : c.anchorX - c.left;
        let left = Math.round(cellW / 2 - anchor * sheetScale);
        const top = cellH - h;

        // Anything past the cell's sides would bleed into the neighbouring
        // frame and flash at the mascot's edge whenever that frame showed.
        const cropL = Math.max(0, -left);
        const cropR = Math.max(0, left + w - cellW);
        const cropB = Math.max(0, top + ph - cellH);
        if (cropL || cropR || cropB) {
          piece = await sharp(piece)
            .extract({ left: cropL, top: 0, width: w - cropL - cropR, height: ph - cropB })
            .png()
            .toBuffer();
          left += cropL;
        }
        composites.push({ input: piece, left: col * cellW + left, top: row * cellH + top });
      }
    }

    await sharp({
      create: { width: cellW * 3, height: cellH * 3, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(composites)
      // Above 1x, compression artefacts are smaller than a screen pixel, so a
      // lower quality than a 1x sheet would need still looks clean.
      .webp({ quality: 74, alphaQuality: 80, effort: 6 })
      .toFile(join(ROOT, s.out));

    const { size } = statSync(join(ROOT, s.out));
    console.log(`Wrote ${s.out}  (${cellW * 3} x ${cellH * 3}, scale ${scale.toFixed(3)}, ${Math.round(size / 1024)}KB)`);
  }
}

await main();
