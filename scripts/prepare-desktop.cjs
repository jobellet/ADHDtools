// Copies only the web app into dist-desktop/ so the desktop (Tauri) build does not bundle
// node_modules, Rust build output or tests. Called by tauri.conf.json (beforeBuildCommand).
// The file list is scripts/web-assets.json, shared with the Android build (android/app/build.gradle).
// It also writes build-info.json (the commit this copy comes from) for Settings → App updates
// (features/settings/update-check.js); Android writes the same file in android/app/build.gradle.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist-desktop');
const include = require('./web-assets.json');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of include) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, name), { recursive: true });
}
// Build stamp: { commit, date, app }. Without git (e.g. a zip download) there is no stamp and
// the update check stays hidden.
try {
  const [commit, date] = execFileSync('git', ['log', '-1', '--format=%H%n%cI'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  fs.writeFileSync(path.join(out, 'build-info.json'), `${JSON.stringify({ commit, date, app: 'desktop' })}\n`);
} catch {
  console.warn('git not found: no build-info.json, the update check will stay hidden');
}
const buildRs = path.join(root, 'src-tauri', 'build.rs');
if (fs.existsSync(buildRs)) {
  const now = new Date();
  fs.utimesSync(buildRs, now, now);
}
console.log(`Desktop web assets copied to ${path.relative(root, out)}/`);
