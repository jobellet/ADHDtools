// Copies only the web app into dist-desktop/ so the desktop (Tauri) build does not bundle
// node_modules, Rust build output or tests. Called by tauri.conf.json (beforeBuildCommand).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist-desktop');
const include = ['index.html', '404.html', 'core', 'features', 'services', 'shell', 'styles', 'icons', 'sounds'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of include) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, name), { recursive: true });
}
const buildRs = path.join(root, 'src-tauri', 'build.rs');
if (fs.existsSync(buildRs)) {
  const now = new Date();
  fs.utimesSync(buildRs, now, now);
}
console.log(`Desktop web assets copied to ${path.relative(root, out)}/`);
