// Builds the iOS app (ios/) into dist-ios/ADHD-Tools.ipa. See docs/ios.md.
//   npm run ios:build     build the IPA (macOS + Xcode required)
// The IPA is unsigned on purpose: the sideload tool on the iPhone/iPad (SideStore, AltStore,
// Sideloadly) signs it there with the user's own free Apple ID, so no paid Apple Developer
// account is ever needed. CI runs this on a macos runner (free for this public repository).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist-ios');
const archivePath = path.join(outDir, 'build.xcarchive');
const outFile = path.join(outDir, 'ADHD-Tools.ipa');

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (process.platform !== 'darwin') {
  fail('The iOS app can only be built on macOS (Xcode). No Mac? Download the pre-built IPA from GitHub Releases instead — see docs/ios.md.');
}
try {
  execFileSync('xcodebuild', ['-version'], { stdio: 'pipe' });
} catch {
  fail('Xcode not found. Install it from the Mac App Store (free), then run `npm run ios:build` again.');
}

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

execFileSync(process.execPath, [path.join(__dirname, 'prepare-ios.cjs')], { stdio: 'inherit' });

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

execFileSync('xcodebuild', [
  '-project', path.join(root, 'ios', 'ADHDTools.xcodeproj'),
  '-scheme', 'ADHDTools',
  '-destination', 'generic/platform=iOS',
  '-archivePath', archivePath,
  'archive',
  'CODE_SIGNING_ALLOWED=NO',
  'CODE_SIGNING_REQUIRED=NO',
  'CODE_SIGN_IDENTITY=',
  'PROVISIONING_PROFILE_SPECIFIER=',
  `MARKETING_VERSION=${version}`,
], { stdio: 'inherit' });

const appPath = path.join(archivePath, 'Products', 'Applications', 'ADHDTools.app');
if (!fs.existsSync(appPath)) fail(`Archive built but ${path.relative(root, appPath)} is missing.`);

const payload = path.join(outDir, 'Payload');
fs.mkdirSync(payload, { recursive: true });
fs.cpSync(appPath, path.join(payload, 'ADHDTools.app'), { recursive: true });
execFileSync('zip', ['-qr', outFile, 'Payload'], { cwd: outDir, stdio: 'inherit' });

console.log(`\nIPA built: ${path.relative(root, outFile)}`);
console.log('Install it on your iPhone/iPad with SideStore, AltStore or Sideloadly (free Apple ID) — see docs/ios.md.');
