// Copies the nav and the site footer from index.html into my-story.html, so
// the two pages cannot drift apart. index.html is the source; on my-story.html
// in-page links ("#about") become "index.html#about".
//
//   node tools/sync-shared.mjs          rewrite my-story.html
//   node tools/sync-shared.mjs --check  exit 1 if my-story.html is out of date
//
// There is still no build step: the pages stay plain HTML that works without
// JavaScript, and this only runs when someone edits the nav or footer.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'index.html');
const TARGET = join(ROOT, 'my-story.html');

const BLOCKS = [
  { name: 'nav', re: /<nav class="navbar"[\s\S]*?<\/nav>/ },
  { name: 'footer', re: /<footer class="footer-section atelier-footer">[\s\S]*?<\/footer>/ },
];

function forStoryPage(html) {
  return html
    .replace('<a href="#home">Back to top</a>', '<a href="#main-content">Back to top</a>')
    .replace(/href="#(?!main-content")([^"]*)"/g, 'href="index.html#$1"')
    .replace('Deepika Dubey, back to top', 'Deepika Dubey, home');
}

const source = readFileSync(SOURCE, 'utf8');
let target = readFileSync(TARGET, 'utf8');
const stale = [];

for (const { name, re } of BLOCKS) {
  const from = source.match(re);
  const to = target.match(re);
  if (!from || !to) {
    console.error(`Could not find the ${name} in ${from ? 'my-story.html' : 'index.html'}.`);
    process.exit(2);
  }
  const wanted = forStoryPage(from[0]);
  if (to[0] !== wanted) {
    stale.push(name);
    target = target.replace(to[0], () => wanted);
  }
}

if (!stale.length) {
  console.log('my-story.html nav and footer match index.html.');
} else if (process.argv.includes('--check')) {
  console.error(`my-story.html is out of date: ${stale.join(', ')}. Run node tools/sync-shared.mjs`);
  process.exit(1);
} else {
  writeFileSync(TARGET, target);
  console.log(`Updated my-story.html: ${stale.join(', ')}.`);
}
