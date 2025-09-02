const fs = require('fs');
const path = require('path');
const http = require('http');
const archiver = require('archiver');
const qrcode = require('qrcode-terminal');

const EXT_DIR = path.join(__dirname, 'chrome-extension');
const ZIP_PATH = path.join(__dirname, 'chrome-extension.zip');

function zipExtension(callback) {
  const output = fs.createWriteStream(ZIP_PATH);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', callback);
  archive.on('error', err => { throw err; });

  archive.pipe(output);
  archive.directory(EXT_DIR, false);
  archive.finalize();
}

function startServer() {
  const port = 8123;
  const server = http.createServer((req, res) => {
    if (req.url === '/chrome-extension.zip') {
      fs.createReadStream(ZIP_PATH).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h1>ADHD Tools Extension</h1><p><a href="/chrome-extension.zip">Download Extension</a></p>`);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Serving extension at ${url}`);
    qrcode.generate(url, { small: true });
  });
}

zipExtension(startServer);
