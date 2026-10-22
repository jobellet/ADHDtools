// Installs ADHD Tools desktop app onto the current machine (macOS or Windows), then opens it.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Ensure cargo is in PATH if installed in user's home directory
const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
if (fs.existsSync(cargoBin) && !process.env.PATH.includes(cargoBin)) {
  process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH}`;
}

const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: process.env }).status === 0;

if (process.platform === 'darwin') {
  // macOS install flow
  const macScript = path.join(__dirname, 'install-desktop-mac.cjs');
  require(macScript);
} else if (process.platform === 'win32') {
  console.log('\n--- Building ADHD Tools for Windows ---');
  if (!run('npm.cmd', ['run', 'desktop:build'])) {
    if (!run('npm', ['run', 'desktop:build'])) {
      console.error('Windows desktop build failed.');
      process.exit(1);
    }
  }

  const appDir = path.join(process.env.LOCALAPPDATA || os.homedir(), 'Programs', 'ADHD Tools');
  fs.mkdirSync(appDir, { recursive: true });

  // Locate built binary or installer
  const releaseDir = path.join(root, 'src-tauri', 'target', 'release');
  const exe = path.join(releaseDir, 'adhdtools.exe');
  const bundleNsis = path.join(releaseDir, 'bundle', 'nsis');
  const bundleMsi = path.join(releaseDir, 'bundle', 'msi');

  let installer = null;
  if (fs.existsSync(bundleNsis)) {
    const files = fs.readdirSync(bundleNsis).filter(f => f.endsWith('.exe'));
    if (files.length) installer = path.join(bundleNsis, files[0]);
  }
  if (!installer && fs.existsSync(bundleMsi)) {
    const files = fs.readdirSync(bundleMsi).filter(f => f.endsWith('.msi'));
    if (files.length) installer = path.join(bundleMsi, files[0]);
  }

  if (installer && installer.endsWith('.exe')) {
    console.log(`Running installer: ${installer}`);
    spawnSync(installer, ['/S'], { stdio: 'inherit' });
  } else {
    if (!fs.existsSync(exe)) {
      console.error(`Build completed but executable was not found at ${exe}`);
      process.exit(1);
    }
    const targetExe = path.join(appDir, 'ADHD Tools.exe');
    // Stop running instance
    spawnSync('taskkill', ['/F', '/IM', 'adhdtools.exe'], { stdio: 'ignore' });
    spawnSync('taskkill', ['/F', '/IM', 'ADHD Tools.exe'], { stdio: 'ignore' });
    fs.copyFileSync(exe, targetExe);

    // Create Start Menu shortcut via PowerShell
    const shortcutPath = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'ADHD Tools.lnk');
    const psCommand = `$w = New-Object -ComObject WScript.Shell; $s = $w.CreateShortcut('${shortcutPath.replace(/'/g, "''")}'); $s.TargetPath = '${targetExe.replace(/'/g, "''")}'; $s.Save();`;
    spawnSync('powershell', ['-NoProfile', '-Command', psCommand], { stdio: 'ignore' });
  }

  console.log(`\nADHD Tools installed successfully! Available in your Start Menu.\n`);
  const launchExe = path.join(appDir, 'ADHD Tools.exe');
  if (fs.existsSync(launchExe)) {
    spawnSync('cmd.exe', ['/c', 'start', '', launchExe], { stdio: 'ignore' });
  }
} else {
  console.log('Building desktop app for Linux...');
  if (!run('npm', ['run', 'desktop:build'])) process.exit(1);
  console.log('Build finished. See src-tauri/target/release/bundle/');
}
