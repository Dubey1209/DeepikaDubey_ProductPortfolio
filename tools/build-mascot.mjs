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
  },
  {
    src: 'tools/mascot-src/deepika-reactions-raw.jpg',
    out: 'mascots/deepika-reactions.webp',
    columns: [{ from: 0 }, { from: 1 }, { from: 2 }],
  },
];

// A background pixel this close to the sampled background colour, and
// connected to the edge of the sheet, becomes transparent. Flood-filling from
// the edges rather than keying the colour everywhere matters: the cream stripes
// on the sweater are close to the background colour, but sit inside the black
// outline, so the fill never reaches them.
const BG_TOLERANCE = 30;
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
const RESOLUTION = 1.5;

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

  return { col, row, top, bottom, left, right, width: right - left + 1, height: bottom - top + 1, anchorX };
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
    // Down to mid-grey, to take the anti-aliased pixels where the highlight
    // meets the outlines; a pure-white cut left a dotted grey trace.
    if (pixelLum(p) > 120 && r - b < 38) highlight[p] = 1;
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
          `${bad ? '  <-- JUMPS' : ''}`
      );
    }
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
    const composites = [];

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const { from, flip } = s.columns[col];
        const c = s.cells.find((cell) => cell.row === row && cell.col === from);
        const w = Math.round(c.width * scale);

        let pipeline = sharp(rgba, { raw: { width: s.img.width, height: s.img.height, channels: 4 } })
          .extract({ left: c.left, top: c.top, width: c.width, height: commonH })
          .resize(w, h, { kernel: 'lanczos3' })
          // Upscaling the ~330px source softens the ink lines; a light
          // unsharp mask brings the edges back without ringing on flat fills.
          .sharpen({ sigma: 0.8, m1: 0.6, m2: 1.4 });
        if (flip) pipeline = pipeline.flop();
        const piece = await pipeline.png().toBuffer();

        // Hair top at the same height in every cell, the cut sweater flush
        // with the cell bottom, the body's centre on the cell's centre.
        const anchor = flip ? c.right - c.anchorX : c.anchorX - c.left;
        const left = Math.round(cellW / 2 - anchor * scale) + col * cellW;
        const top = (row + 1) * cellH - h;
        composites.push({ input: piece, left: Math.max(col * cellW, left), top });
      }
    }

    await sharp({
      create: { width: cellW * 3, height: cellH * 3, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(composites)
      // Above 1x, compression artefacts are smaller than a screen pixel, so a
      // lower quality than a 1x sheet would need still looks clean.
      .webp({ quality: 62, alphaQuality: 80, effort: 6 })
      .toFile(join(ROOT, s.out));

    const { size } = statSync(join(ROOT, s.out));
    console.log(`Wrote ${s.out}  (${cellW * 3} x ${cellH * 3}, scale ${scale.toFixed(3)}, ${Math.round(size / 1024)}KB)`);
  }
}

await main();
