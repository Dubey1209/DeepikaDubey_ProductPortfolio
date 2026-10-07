# Deepika Dubey — Product Portfolio

A hand-written static portfolio site. **No build step, no framework, no bundler.**
Deployment is literally "copy these files to a web server."

- **Live:** https://dubey1209.github.io/DeepikaDubey_ProductPortfolio/
- **Repo:** https://github.com/Dubey1209/DeepikaDubey_ProductPortfolio
- **Hosting:** GitHub Pages, served from the `main` branch.

## Running locally

Because the pages use relative asset paths and `fetch`, open them through a
local server rather than double-clicking the HTML file:

```bash
npm run serve          # http://localhost:4173
# or, with no dependencies at all:
python -m http.server 8000
```

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | The whole single-page portfolio: hero, about, case studies, design projects, technical projects, skills, certifications, education, experience, writing, fun facts, contact. |
| `my-story.html` | A separate narrative page rendered as a flip-book. |
| `404.html` | Served by GitHub Pages for unknown paths. Deliberately self-contained — it shares no stylesheet with the site, so the CSS refactor cannot break it. |

Both pages load the **same** five stylesheets in the **same order**. The nav and
footer markup is currently duplicated between them — keep them in sync by hand.

## Stylesheet load order

Order matters enormously here: later files deliberately override earlier ones.
Do not reorder these `<link>` tags.

| # | File | Owns |
| --- | --- | --- |
| 1 | `base.css` | Base reset, font stack, typography scale, form/link defaults — **plus** a superseded blue/white card design that `atelier.css` overrides, and a Bootstrap-style breakpoint ladder (575 / 767 / 991 / 1199) that disagrees with the one used elsewhere. |
| 2 | `atelier.css` | The current visual identity. Defines all design tokens in `:root` and re-skins nearly every component, mostly scoped under `html.atelier` to outrank `base.css`. Opens with what was a small patch layer: safe-area insets, `box-sizing`, overflow clipping, touch-target sizing. |
| 3 | `motion.css` | Animation and scroll-interaction styling. |

Phase 3 merged these down from five files. `styles.css` + `responsive.css`
became `base.css`, and `polish.css` + `atelier.css` became `atelier.css`; the
files were concatenated in the exact order the browser already loaded them, so
no rule moved relative to any other and the cascade is unchanged. Section
banners inside each file mark where the old ones ended.

The merge changed no rules at all, deliberately — pruning at the same time
would have produced an unreviewable diff, and if the result had changed
something there would have been no way to tell which half did it.

## Script load order

All scripts are `defer`red. Third-party libraries come from the jsDelivr CDN.

| File | Role |
| --- | --- |
| `portfolio-lock.js` | Loaded in `<head>` on `index.html` only. Gates the site behind a name prompt; unlock state is kept in `sessionStorage`. Reveals `#site-shell` and dispatches a `portfolio-unlocked` event. |
| `script.js` | Mobile nav drawer, dropdowns, smooth anchor scrolling, the experience accordion (whose content is hardcoded in this file), the work-detail modal, and the certificate stack. |
| `theme-toggle.js` | Toggles `.dark-theme` on `<body>`, persisted to `localStorage`. An inline script at the top of `<body>` applies the saved theme early to avoid a flash. |
| `motion.js` | GSAP + ScrollTrigger + Lenis scroll animations. |
| `contact-form.js` | Contact form via EmailJS. The SDK is lazy-loaded on first focus of the form rather than on page load. |
| `mascot.js` | `index.html` only. The cartoon in the About card: looks towards the cursor, reacts when clicked, blinks. See [About mascot](#about-mascot). |
| `story-book.js` | Flip-book behaviour on `my-story.html`, using page-flip. |

The visual and computed-style harnesses hide the mascot's drawings (they are in
`VOLATILE` in `tests/harness.mjs`), since the frame showing depends on where
the pointer was and on a random blink timer. The card around them is still
compared.

### External dependencies (CDN, runtime)

GSAP 3.12.7, ScrollTrigger 3.12.7, Lenis 1.1.20, page-flip 2.0.7, and
`@emailjs/browser` 4 (lazy-loaded).

## Cache busting

Every stylesheet and script is referenced with a **single shared** `?v=` token
(currently `20261009`; the mascot sheet URLs in `atelier.css` carry it too).
When you change any CSS, JS or mascot sheet, bump that token —
in both `index.html` and `my-story.html`.

If two changes ship on the same day, add a suffix (`-2`): the Phase 3 merge
did, because `atelier.css` changed content at a URL returning visitors already
had cached, so the token had to move even though the date had not.

It is one shared value on purpose. Per-asset tokens were used previously and
drifted out of sync (`motion.css` reached `fx45` while `motion.js` sat at
`fx33`), which can serve a returning visitor new CSS against old JavaScript.

## Images

Source images are the originals (`.jpeg` / `.png`); the site serves `.webp`
generated from them:

```bash
node tools/optimize-images.mjs --report   # inspect sources, write nothing
node tools/optimize-images.mjs            # regenerate the .webp files
```

Commit both the source and the generated `.webp`. Run the script after adding
or replacing any image.

Two deliberate choices here:

- **No `<picture>` fallback.** Wrapping the images would insert an element
  between `.home-photo` and its parent, and `motion.js` builds its
  `.home-photo-stage` wrapper via `photo.parentNode` — a `<picture>` tag would
  quietly break the hero animation. WebP support is universal enough to serve
  directly.
- **`og:image` and the favicon stay JPEG**, and absolute. Social scrapers do
  not resolve relative URLs, and several still do not decode WebP.

The certificate images intentionally have no `width`/`height` attributes: they
are `width: 100%; height: 100%; object-fit: cover` inside an absolutely
positioned sheet, so the attributes would have no effect on layout.

## About mascot

The About card shows a cartoon of Deepika instead of a photo. It follows the
idea of [page-mascot](https://koboyo.com/page-mascot), which is a React
component; this is a plain-JS version (`mascot.js`) so the site keeps no React
and no build step.

It is two 3×3 sprite sheets in `mascots/`:

- `deepika-directions.webp` — the head turned towards nine directions (rows up
  / level / down, columns left / centre / right). The frame follows the
  pointer, aimed at the face.
- `deepika-reactions.webp` — blink, wink, grin, gasp, giggle, shy, starry,
  thinking, sleepy (unused). Each is tied to something the visitor does (grin
  when the pointer arrives, shy when it rests on her face, giggle when it
  scrubs over her, a friendly face per click, sometimes starry when a link is
  hovered). The table at the top of `mascot.js` is the full list.

Poke her repeatedly (clicks under 1.4s apart) and from the third poke she says
something in a small speech bubble beside her head, escalating gently through
four steps ("ouch!" with a gasp, then shy, then a giggle, then thinking: "is
this a usability test?"). Each step has three lines and never repeats the last
one, so it does not read as canned.

Every reaction frame faces straight out. So the reactions she starts herself
(blinks, starry) only happen while she is already looking straight out, and
there are no idle reactions: an earlier version went to "thinking" after 7s
and "sleepy" after 20s, and both look down, so a visitor who left the cursor
somewhere saw her stop looking at it. Left alone, she keeps looking wherever
the cursor was left, and re-aims when the page scrolls under it.

Reactions change only the face: an earlier squash-and-stretch bounce on each
click read as the whole character shrinking and growing, and was removed. Every
8–17s a breeze moves her side hair: an SVG filter displaces the picture by
drifting noise, masked so the face and body stay still. All of the
self-started motion is off under `prefers-reduced-motion`.

How the motion is kept smooth:

- **Every frame change is a cross-fade over the old frame.** The two layers are
  interchangeable and can show either sheet; the new frame fades in on top
  while the old one stays fully opaque underneath, so the figure never dims
  mid-change. (Fading one out while the other fades in dipped to about 75%.)
- **Frame boundaries have hysteresis.** A side frame is entered past 0.42 of
  the way round and kept until the cursor comes back past 0.3, so a cursor
  resting on a boundary does not flick between two frames.
- **The lean is a spring, not a CSS transition.** A transition restarts on every
  `pointermove` and stutters; the spring keeps its velocity and settles with a
  hint of follow-through. `mascot.js` writes `--mascot-tx/-ty/-tilt` each frame.

How it is kept sharp:

- She tilts only while moving (from the spring's velocity), and at rest the
  offset is snapped to the device pixel grid. The earlier version stayed
  rotated towards the cursor and breathed with a continuous `scale`, both of
  which left the picture permanently resampled and soft.
- The sheets are built at 2x the display size, so a 2x screen draws them pixel
  for pixel.

There is no card: the sheets have a transparent background and the avatar sits
straight on the page. In dark theme a soft glow keeps the dark hair from
merging into the page. Without JavaScript, CSS shows the centre frame.

The drawings were generated from a photo, then assembled by
`tools/build-mascot.mjs` from the raw sheets in `tools/mascot-src/`:

```bash
node tools/build-mascot.mjs --check   # measure all 18 frames, write nothing
node tools/build-mascot.mjs           # write mascots/*.webp
```

The image model does not place figures on an exact grid, so the script finds
each figure by its pixels, aligns them by the top of the hair and the centre of
the body, cuts every frame at the same sweater height, and refuses to write if
any figure's width differs from the rest by more than 6% — that would be the
character visibly growing or shrinking as frames switch. Aligning by the
sweater's bottom edge instead looked natural but made the head pop ~19px up on
every blink, because the model draws more sweater in some rows than others.

Width alone does not catch a size jump, because it is mostly hair. The script
also measures face width from skin pixels, and scales each sheet so its
front-facing faces match the centre direction frame: the reactions sheet was
drawn ~3% smaller, so every reaction shrank her head and the end of it grew it
back.

Two cut-out details that each showed on the dark theme:

- The background is removed at a tolerance of 12. The background's JPEG noise
  peaks at 9, but the cream sweater stripes sit at 20–35 and run out to the
  sleeves with no outline, so at the original 30 the fill ran along them and
  tore the sweater into strips.
- The thin highlight the model draws along the outside of the hair is painted
  hair colour down to a luminance of 45. Cuts at white and at mid-grey each
  left a dotted grey trace that the sharpening step then brightened.

The silhouette is not upscaled as an alpha channel. The cut-out is decided per
source pixel, so at ~2.5x an upscaled alpha is a staircase along the hair, and
sharpening made it jagged; blurring and re-contrasting the alpha only softened
the steps. Instead the script builds a signed distance field of the cut-out,
upscales that, and cuts it at its midpoint with a one-pixel ramp, the way fonts
are rendered from distance fields. Only the colour channels are sharpened.

The model will not draw a head turned to the left, so the left column is the
right column mirrored. The script also removes the cream background (edge flood
fill, then un-mixing the outline's anti-aliased rim so no cream halo is left)
and paints over the white highlight the model draws along the hair edge.

To redraw the character, replace the two raw sheets and re-run the script;
`mascot.js` and the CSS do not change. `AboutPhoto.*` is no longer shown on the
site but is kept as the source photo.

## Third-party service configuration

Client-side identifiers are, by design, public — but they are abusable, so they
are listed here for awareness rather than treated as secrets:

- **EmailJS** (`contact-form.js`) — public key, service ID, and template ID.
- **Formcarry** (`portfolio-lock.js`) — visitor-notification endpoint.

Neither is a credential leak, but both can be submitted to by anyone. Enable
rate limiting / CAPTCHA in the respective dashboards.

## Accessibility notes

Worth preserving as the site evolves: `prefers-reduced-motion: reduce` is
honoured in all five stylesheets and in `portfolio-lock.js`; there is a skip
link, ARIA attributes on the nav and modals, and focus is restored after the
work modal closes.

## Visual regression harness

The stylesheet layer is being collapsed, and because later files deliberately
override earlier ones, reading the CSS is not enough to prove a change is
visually neutral. `tests/` screenshots the site and compares against committed
baselines.

```bash
npm install
npx playwright install chromium   # one-off, ~115 MB

npm run test:visual               # compare against tests/baseline/
npm run baseline                  # accept current rendering as the new truth
npm run test:visual -- --filter=index-desktop   # just one scenario
```

25 scenarios: both pages × 375/800/1440 px × light/dark, plus the lock screen,
the work modal, the nav dropdown, the mobile drawer, and `404.html`. A full run
takes roughly four minutes.

Page setup, the determinism helpers and the scenario list live in
`tests/harness.mjs`, shared with the computed-style harness below so the two
can never drift apart or disagree about what they are looking at.

The 404 scenarios emulate `prefers-color-scheme`, because that page themes
itself from the media query rather than the site's `.dark-theme` class.

`tests/baseline/` **is committed** — it is the reference. `tests/current/` and
`tests/diff/` are generated per run and git-ignored.

The baselines are full-page screenshots and total around 11 MB, so every
re-acceptance adds that much to git history permanently. Re-accept when a phase
genuinely changes the design, not to silence a diff you have not looked at.

### Workflow during a CSS phase

1. Change one component.
2. `npm run test:visual`.
3. Every scenario should still pass. If one changed, open the three PNGs of the
   same name in `baseline/`, `current/`, and `diff/`.
4. Only run `npm run baseline` once you have looked at a diff and decided it is
   intended.

### Why the harness is more complicated than "take a screenshot"

Each of these was a real source of false positives, and they are worth knowing
about before editing `tests/visual.mjs`:

- **GSAP is immune to CSS pausing.** It writes inline styles every ticker
  frame, so tweens are explicitly fast-forwarded and the ticker is put to
  sleep. Scrub-linked tweens are left alone, since they are a pure function of
  scroll position. This also stops Lenis, which `motion.js` drives from the
  GSAP ticker.
- **Pausing a CSS animation is not deterministic.** It freezes at whatever
  phase it reached, so animations are first seeked to a fixed far-future time.
- **Reveal animations need triggering.** Content below the fold sits at
  `opacity: 0` until scrolled to, so the harness steps through the whole
  document and back to the top.
- **`motion.js` has a 4500 ms fallback** that force-finalises the hero. Capture
  happens after it fires, otherwise the hero is a coin flip between two states.
- **Lazy images race the screenshot.** All images are forced eager and awaited
  through `decode()`. The About photo was the visible offender: present in one
  run, missing from the next.
- **Scroll must be exactly zero** and nothing may be focused. `fullPage` draws
  fixed elements wherever the viewport is, and a focused skip link becomes
  visible and shifts the whole document down.
- **`.home-rotate` is masked** because it cycles words forever. Masking uses
  `!important`, or the site's own `!important` rules win.
- **Differences are confirmed by a retry** before being reported, so a residual
  sub-pixel wobble in the hero cannot fail the suite while a genuine regression
  still does.
- **An action can restart the animation layer.** Opening the work modal means
  clicking a card, and that click scrolls the page, firing the reveals for
  whatever came into view. Motion is therefore frozen a second time after any
  scenario action.

### Known limitation: sensitivity on tall pages

Failure is triggered by a *proportion* of changed pixels (0.2%), which on the
full-page index capture (roughly 1584 × 11021) is about 35,000 pixels of
allowance. A small change — a line of coloured text, a tag, an icon — can
therefore pass unnoticed. The `.project-category` colour change in Phase 2 did
exactly that.

The proportional threshold exists to absorb a sub-pixel wobble in the hero
photo that has resisted every attempt to pin it down. Clipping helps where it
can be applied: `nav-dropdown-*` captures only the top 240 px, which excludes
the hero entirely and makes those scenarios genuinely tight.

**The computed-style harness below is the real answer to this**, and it is why
that harness exists. Treat a passing screenshot run as strong evidence about
layout and colour at component scale, and rely on `npm run computed` for
anything smaller.

## Computed-style regression harness

Where the screenshots ask "does this still look right", this asks "did anything
change at all" — and answers exactly, with no threshold.

```bash
npm run computed:save    # record tests/computed/ from the CSS as it stands
# ...delete some CSS...
npm run computed         # report every property that moved
```

It walks all ~1,200 elements of every scenario, reads ~120 computed properties
on each (plus a smaller set on `::before` and `::after`), and compares string
for string. A clean run means roughly 28,000 elements are provably untouched.

This is the primary oracle for Phase 3, for three reasons:

1. **No sensitivity floor.** The pixel threshold above cannot see a small
   change on a tall page. This sees every change equally, wherever it is.
2. **No blind spots.** A screenshot only shows what is painted. This also
   covers `cursor`, `pointer-events`, `overflow`, `transition-*`, elements
   hidden behind others, and elements outside a clipped capture.
3. **It names the cause.** A pixel diff says "4,000 pixels moved somewhere in
   an 11,000 px page". This says `.project-card line-height: 1.6 -> normal`.

`tests/computed/` is **git-ignored**, unlike the screenshot baselines. It is a
before/after reference for the edit in progress, not a historical record, and
committing it would add megabytes of churn per phase. Save, edit, compare.

Two deliberate differences from the screenshot harness:

- **Transitions are left alive.** The screenshots kill them, which would rewrite
  every `transition-*` to `none` and hide the removal of a rule that carries
  one. The cost is having to outwait the transitions that `settleAtTop` starts,
  which is why this harness takes about eight minutes rather than four.
- **Properties JavaScript owns inline are exempt** — the geometry GSAP tweens,
  and `filter`. An inline style beats every stylesheet, so CSS cannot affect
  those values and there is nothing to protect; the exemption is detected by
  asking whether the property is set inline rather than from a selector list,
  so it keeps working as the animations change. Everything else about those
  elements, including all colour and typography, is still compared exactly.

`prefers-reduced-motion` is deliberately **not** used to calm the page down:
all five stylesheets restyle the site under that media query, so it would
capture a design real visitors never see.

## Known bugs (found during the Phase 2 audit)

These are real, visible defects rather than tidiness issues. Line numbers are
as of the Phase 3 merge.

1. ~~**The token system was defeated by a hardcoded blue.**~~ **Fixed in Phase
   2.** `body.dark-theme .project-card.interactive-card .project-category {
   color: #7eb6ff !important }` had specificity 0-4-2, which beat every
   `atelier.css` rule for `.project-category`. It lived in `polish.css`, which
   loaded *before* `atelier.css`, but specificity outranks order, so the
   hardcoded blue won in dark mode. Now `var(--accent)`, at `atelier.css:255`.
2. ~~**The dropdown has no shadow at all.**~~ **Not a bug.** Measured in a
   browser, the desktop dropdown renders `6px 8px 0 var(--ink)` in both themes.
   The `box-shadow: none !important` in `base.css` sits inside `(max-width:
   800px)`, where the submenu is an inline list inside the drawer and a shadow
   would be wrong.
3. ~~**Dropdown hover leaks two properties.**~~ **Fixed.** Two `body.dark-theme
   .dropdown-content a:hover` rules in `base.css` forced `color: #ffffff
   !important`, so dark hover went pure white instead of `--ink`. Deleted; the
   `atelier.css` hover rule now also covers `:focus-visible`, which the deleted
   rules had been the only thing highlighting in dark mode.
4. ~~**The success toast has no dark variant.**~~ **Not a bug.** The hardcoded
   `#1a1713` and `#8b3a2a` backgrounds were always beaten by `html.atelier
   .lock-notification--success, --error { background: var(--card) !important }`,
   and both pages that load `atelier.css` carry `class="atelier"`. The dead
   rules are deleted.
5. ~~**Tapping "Work" in the mobile drawer also scrolls the page.**~~ **Fixed.**
   `toggleDropdown` calls `preventDefault`, but the smooth-scroll handler bound
   to every `a[href^="#"]` ran anyway. It now returns early when
   `e.defaultPrevented` is already set.
6. ~~**Drawer items can become unreachable.**~~ **Fixed.** The global
   `flex-wrap: wrap` on `.nav-links` wrapped drawer items into a second,
   clipped column once the submenu expanded. The `(max-width: 800px)` drawer
   rule sets `flex-wrap: nowrap`, and the drawer's existing `overflow-y: auto`
   scrolls instead.

The two that were "not a bug" were both read off the cascade without checking
the media query or the root class. Measure before recording a bug.

### A trap to remember when tokenising

`#1a1713` and `#f3eee4` are simultaneously light `--ink`/dark `--paper` and
light `--paper`/dark `--ink` — the two tokens are exact swaps of each other. A
hardcoded instance of either is therefore ambiguous, and substituting the wrong
token inverts the colour in dark mode. Two places depend on staying hardcoded
because they need *fixed* contrast against a `--spin` background:
`motion.css:1126` and `atelier.css:2770`.

## Dead-rule audit

```bash
node tools/css-audit.mjs            # summary per file
node tools/css-audit.mjs --list     # every unmatched selector
```

Loads both pages at three viewports, applies the state classes that JavaScript
would (`.fx-in`, `.dark-theme`, drawer open, modal open, and so on), and reports
selectors that match no element anywhere.

**The headline result is that almost nothing is dead this way: 14 selectors out
of 1,159, about 1%** — and they are nearly all resets for elements the markup
does not contain (`table`, `iframe`, `select`, `td`). So there is no easy win
here, and the Phase 3 pruning has to go after *overridden declarations*
instead, which is a much harder question and needs `npm run computed` to
answer.

Two traps this tool hit, worth knowing before trusting a similar result:

- **Runtime classes.** A page sitting still has no `.fx-in` on anything, so
  every reveal rule in `motion.css` looked dead — 51 selectors. Those classes
  are now applied before the audit runs.
- **Class names built by string concatenation.** `portfolio-lock.js` creates its
  toast with `lock-notification--${type}`, so the literal
  `lock-notification--success` appears nowhere and the rule looked dead while
  being perfectly live. The audit now also searches the scripts for prefixes a
  name could have been assembled from, and treats any hit as "still in use".

Both failure modes point the same way: a selector matching nothing *right now*
is weak evidence. The tool is deliberately biased toward leaving rules alone.

## Pruning workflow

Since the waste is overridden declarations rather than unmatched selectors,
finding it means measuring what each rule actually contributes.

```bash
node tools/rule-probe.mjs --sheet=base.css --json=probe.json
node tools/prune-rules.mjs --probe=probe.json --dry
node tools/prune-rules.mjs --probe=probe.json
npm run computed          # the real proof
npm run test:visual
```

`rule-probe.mjs` notes what each rule declares, blanks it through the CSSOM,
and re-reads the same properties on the elements it targets and their
descendants. Nothing moved means the rule was contributing nothing. Blanking is
equivalent to deleting — the declarations stop applying while every other
rule's specificity and order stay put — and the rule is restored either way, so
one page load probes a whole stylesheet.

It then does a second sweep that blanks the entire set of candidate deletions at
once and compares a fixed property list across every element, putting rules back
until the page is identical again. Per-rule verdicts cannot see two rules that
cover for each other, and this is what catches them; see below.

It exists because `npm run computed` takes six minutes, which is enough to
answer "did this batch break anything" but not "which of these 44 rules is the
problem". Bisecting with it would take hours; this answers per rule in
milliseconds, and the batch it produces is then confirmed once with the real
harness.

Verdicts:

| Verdict | Meaning |
| --- | --- |
| `live` | Removing it changes something. Keep. |
| `inert` | Matched and measured; every declaration is overridden. Safe to delete. |
| `unmatched` | Matches nothing in any probed state. Not pruned by default — the element may be built by JavaScript. |
| `unverifiable` | A `:hover`/`:focus`/`:active` rule, or one whose media query never applied at any probed width. Either would look inert whatever it contains. |

`prune-rules.mjs` deletes the `inert` rules, refusing to write if the braces
stop balancing or two ranges overlap.

### Eight things that had to be got right

Each of these produced a confidently wrong answer first, and each was caught by
`npm run computed` after the deletions were applied:

- **Probing at rest is not enough.** Without the drawer and modal states, every
  `.nav-links.open` rule looked unmatched — true of a still page and a terrible
  reason to delete them. The prober now uses the shared scenario list.
- **Transitions hide the effect of a deletion.** Blanking a transitioned
  property does not change the computed style; it starts animating towards the
  new value, so an immediate read returns the old one.
  `.theme-toggle-icon-wrapper { transform: translateX(0) }` — the only rule
  providing that transform — was reported inert in all 22 states for this
  reason. Ordinary properties are now measured with transitions suppressed,
  where a deletion takes effect at once. But suppressing transitions rewrites
  every `transition-*` to `none`, which hid changes to those properties and cost
  the transitions on links and on `body` in an earlier attempt. So there are two
  passes over every state, covering disjoint property sets: transitions off for
  everything else, transitions on for `transition-*`, which is sound because
  those properties are not themselves animated.
- **A dormant media query proves nothing.** Blanking a rule inside a query that
  does not currently match provably changes nothing, which says nothing about
  the widths where it does match. With only 375/800/1440 probed, a rule inside
  `(min-width: 992px) and (max-width: 1199px)` was dormant everywhere and read
  as inert. The prober now checks `matchMedia` before judging a rule, sweeps a
  width either side of every declared breakpoint, and reports a rule whose query
  never applied as unverifiable rather than dead. This alone moved 32 rules out
  of the delete list, 15 of them provably live.
- **Both themes, every state.** Probing the drawer, lock screen and modal in
  dark only meant any rule that a `body.dark-theme` rule happens to override was
  measured inert while being the only thing styling that element in light mode.
  That pruned the light drawer's position and its close button.
- **Redundant pairs cannot be judged one at a time.** `base.css` hides
  `.drawer-close-btn-li` on desktop in two separate rules, so each is inert on
  its own and removing both leaves the button visible. Leaving inert rules
  blanked so later rules are judged in context looks like the fix and is worse:
  verdicts combine across states while the blanking happens within one, so
  `.nav-links.open .drawer-close-btn-li` was judged inert with a rule blanked
  ahead of it that is live with the drawer shut and survived the prune — hiding
  the close button in the open drawer. Hence the batch validation pass, which
  tests the set that will actually be deleted instead of reasoning about it. It
  reinstated 5 of 144 candidates.
- **`querySelectorAll` cannot match a pseudo-element.** `.foo::before` returned
  nothing and two decorative rules were declared dead while painting on screen.
  The pseudo is stripped for matching and passed to `getComputedStyle`.
- **Lines are not a safe unit for deletion.** `base.css` had `@media
  (max-width: 768px) {body.dark-theme .nav-links {` — a media query opening on
  the same line as its first rule. Deleting by line took the `@media {` with it
  and the orphaned brace swallowed an image reset 3,000 lines away. Cuts are
  made by character offset.
- **Repeated selectors need consistent numbering.** The prober counts
  occurrences across the whole sheet; the pruner briefly counted them per media
  block, and four rules failed to match.

### When the two harnesses disagree

It happens, and the computed one wins. `index-desktop-light` has reported 0.34%
of pixels changed, and `index-desktop-dark` 0.21%, while all 25 computed
snapshots were byte-identical. The diff image was red over the hero and About photos only —
the GSAP wobble, whose inline-styled geometry the computed harness exempts by
design. Re-running the scenario against the previous commit failed the same
way, which settled it.

Worth knowing: **the wobble can exceed the 0.2% threshold**, so a screenshot
failure confined to those two photos is not evidence of anything on its own.
Check `npm run computed`, and confirm by re-running the single scenario with
`--filter=`, which is the quickest way to tell a flake from a regression.

The computed harness has its own flake of the same origin, now handled: GSAP
writes `transform-origin` inline next to the transforms it manages and on its
own schedule, so the cards behind the work modal reported one value in one run
and another in the next with the stylesheets untouched. It is exempted when held
inline, as `transform` and `filter` already were.

`tools/probe-one.mjs` is kept for when a verdict needs explaining: given a
state, a selector and a property, it lists every rule in every stylesheet that
sets that property on the element, and whether the selector and the media query
apply. Reading the cascade for `.drawer-close-btn-li` is how the redundant-pair
problem above was found.

## Refactor status

An architecture review identified the CSS layer as the main maintenance risk:
8,374 lines across five files with 838 `!important` declarations, three
competing breakpoint systems, and design tokens scoped to `html.atelier`
instead of `:root`. A phased refactor is underway.

Phase 3 first moved those lines into three files without touching a single rule,
then began pruning what the merge exposed. The CSS is now 7,624 lines and 772
`!important`s, every deletion measured rather than reasoned about.

`base.css` took the bulk of it: of its 417 measurable rules, 139 contributed
nothing to any of the 38 probed states and are gone — 632 lines, a fifth of the
file. 84 more are `:hover`/`:focus` rules that cannot be judged this way and 15
match nothing at all, so they stay.

One number is worth keeping in view. Of the 47 `body.dark-theme` rules in
`base.css`, 44 turned out to contribute nothing — but the three that remained
included `body.dark-theme .navbar, .footer-section, .section`, whose colour
every element that `atelier.css` does not explicitly recolour was inheriting.
Deleting the 44 alongside it would have changed 4,000 properties per dark
scenario, and no amount of reading the files had revealed which of the 47
mattered. That is the shape of this codebase, and why the phase is slow.

- [x] **Phase 0** — safety net: branch, `.gitignore`, this document, visual-regression baselines
- [x] **Phase 1** — quick wins: cache-bust sync, `og:url` fix, WebP images, SEO files
- [x] **Phase 2** — design tokens moved to `:root`, redundant dark rules removed
- [ ] **Phase 3** — collapse five stylesheets into three
  - [x] computed-style harness, the oracle the pruning needs
  - [x] merged 5 files into 3, cascade-identical, no rules changed
  - [x] pruned 44 superseded dark-theme rules from `base.css` (167 lines)
  - [x] pruned the rest of `base.css`: 139 rules, 632 lines
  - [ ] probe `atelier.css` and `motion.css`
  - [x] fix the known bugs: 3, 5 and 6 fixed; 2 and 4 turned out not to be bugs
- [ ] **Phase 4** — unify breakpoints
- [ ] **Phase 5** — extract content into a data layer
- [ ] **Phase 6** — decide the future of the lock screen

The **no-build-step property is intentional** and should survive the refactor.
The `package.json` in this repo exists solely for the visual-regression test
harness (see `tests/`) and is never required to deploy or serve the site.
