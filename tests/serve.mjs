// Minimal static file server for local preview and the visual harness.
// Intentionally dependency-free.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
};

export function startServer(port = 4173) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      // GitHub Pages serves the site under the repository name; 404.html
      // uses absolute paths with that prefix.
      let pathname = decodeURIComponent(url.pathname).replace(/^\/DeepikaDubey_ProductPortfolio(?=\/)/, '');
      if (pathname.endsWith('/')) pathname += 'index.html';

      // Contain path traversal: resolve then verify the result is inside ROOT.
      const filePath = normalize(join(ROOT, pathname));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      let body = await readFile(filePath);
      const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
      // Compress text the way GitHub Pages does, so Lighthouse runs against
      // this server see realistic transfer sizes.
      if (/text|javascript|json|xml|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
        body = gzipSync(body);
        headers['Content-Encoding'] = 'gzip';
        headers.Vary = 'Accept-Encoding';
      }
      res.writeHead(200, headers);
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
  });

  return new Promise((resolve, reject) => {
    // Without this, a port clash leaves the promise pending forever and node
    // exits with an unhelpful "unsettled top-level await".
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${port} is already in use -- is "npm run serve" running? ` +
              `Stop it, or set PORT to something else.`
          )
        );
        return;
      }
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

// Allow `npm run serve` to use this directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  await startServer(port);
  console.log(`Serving ${ROOT} at http://localhost:${port}`);
}
