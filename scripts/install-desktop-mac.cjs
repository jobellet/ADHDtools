// macOS: builds the desktop app and installs "ADHD Tools.app" into /Applications
// (or ~/Applications if /Applications is not writable), then opens it.
// Afterwards: double-click it in Launchpad/Finder, or drag it to the Dock.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.platform !== 'darwin') {
  console.error('This installer is for macOS. Use `npm run desktop:build` on other systems.');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit' }).status === 0;

if (!run('npm', ['run', 'desktop:build'])) process.exit(1);

const built = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'macos', 'ADHD Tools.app');
if (!fs.existsSync(built)) {
  console.error(`Build finished but ${built} was not found.`);
  process.exit(1);
}

let dir = '/Applications';
try { fs.accessSync(dir, fs.constants.W_OK); } catch {
  dir = path.join(os.homedir(), 'Applications');
  fs.mkdirSync(dir, { recursive: true });
}
const target = path.join(dir, 'ADHD Tools.app');
// Stop any running instance so the updated binary launches instead of focusing the old process
spawnSync('killall', ['adhdtools'], { stdio: 'ignore' });
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(built, target, { recursive: true });
spawnSync('xattr', ['-dr', 'com.apple.quarantine', target]);
// Ad-hoc sign the app bundle so macOS Privacy & Security (Microphone / Speech Recognition) tracks it properly
spawnSync('codesign', ['--force', '--deep', '--sign', '-', target]);
console.log(`\nInstalled: ${target}\nOpen it from Launchpad or Finder; drag it to the Dock to keep it there.`);
spawnSync('open', [target]);
