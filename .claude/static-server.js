const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const port = process.env.PORT || 8422;

const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  // Mirror GitHub Pages: the app lives under /ADHDtools there, so strip
  // that base path locally (assets on deep-linked pages resolve under it).
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/ADHDtools' || urlPath.startsWith('/ADHDtools/')) {
    urlPath = urlPath.slice('/ADHDtools'.length) || '/';
  }
  let filePath = path.join(root, urlPath);
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: the app router uses paths like /ADHDtools/settings
      // (GitHub Pages base path); serve index.html for extension-less paths.
      if (!path.extname(filePath)) {
        fs.readFile(path.join(root, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(indexData);
        });
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log(`Serving ${root} on port ${port}`));
