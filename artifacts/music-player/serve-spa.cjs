const http = require('http');
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, 'dist/public');
const port = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  try {
    let urlPath = new URL(req.url, 'http://localhost').pathname;

    // Try to serve the exact file first
    let filePath = path.join(baseDir, urlPath === '/' ? 'index.html' : urlPath);

    let content;
    try {
      content = fs.readFileSync(filePath);
    } catch {
      // SPA fallback: for non-file routes, serve index.html
      filePath = path.join(baseDir, 'index.html');
      content = fs.readFileSync(filePath);
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`SPA server listening on http://127.0.0.1:${port}`);
  fs.writeFileSync('/tmp/musika-server-ready', 'ready');
});
