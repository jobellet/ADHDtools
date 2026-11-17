// Copies the web app into ios/web/ so the iOS app (ios/ADHDTools.xcodeproj) bundles the same
// files as GitHub Pages, the desktop app and the Android app. The list is scripts/web-assets.json.
// Called by scripts/build-ios.cjs (and `npm run ios:prepare`); ios/web/ is gitignored.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'ios', 'web');
const include = require('./web-assets.json');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of include) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, name), { recursive: true });
}
console.log(`iOS web assets copied to ${path.relative(root, out)}/`);
