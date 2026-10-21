// Builds the Android app (android/) into dist-android/ADHD-Tools.apk. See docs/android.md.
//   npm run android:build     build the APK
//   npm run android:install   build, then install it on a phone connected by USB (adb)
// The APK is signed with your own key in ~/.config/adhd-tools-android/ (created on the first build).
// Keep that folder: Android installs an update over the old app (and keeps your data) only when
// the same key signed it.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const keyDir = path.join(os.homedir(), '.config', 'adhd-tools-android');
const signingFile = path.join(keyDir, 'signing.properties');
const outFile = path.join(root, 'dist-android', 'ADHD-Tools.apk');

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
    '/opt/homebrew/share/android-commandlinetools',
    '/usr/local/share/android-commandlinetools',
  ].filter(Boolean);
  const sdk = candidates.find(dir => fs.existsSync(path.join(dir, 'platforms')));
  if (!sdk) {
    fail('Android SDK not found. On a Mac:\n'
      + '  brew install --cask android-commandlinetools\n'
      + '  sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"\n'
      + 'or set ANDROID_HOME to your SDK folder.');
  }
  return sdk;
}

function ensureSigningKey() {
  if (fs.existsSync(signingFile)) return;
  fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
  const storeFile = path.join(keyDir, 'release.jks');
  const password = crypto.randomBytes(18).toString('base64url');
  execFileSync('keytool', [
    '-genkeypair', '-keystore', storeFile, '-alias', 'adhdtools', '-keyalg', 'RSA', '-keysize', '2048',
    '-validity', '10000', '-storepass', password, '-keypass', password, '-dname', 'CN=ADHD Tools',
  ], { stdio: 'inherit' });
  const lines = [
    `storeFile=${storeFile.replace(/\\/g, '/')}`,
    `storePassword=${password}`,
    'keyAlias=adhdtools',
    `keyPassword=${password}`,
  ];
  fs.writeFileSync(signingFile, `${lines.join('\n')}\n`, { mode: 0o600 });
  console.log(`\nCreated your signing key in ${keyDir}\nBack up this folder: every update must be signed with it.\n`);
}

const sdk = findSdk();
fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
ensureSigningKey();

const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
try {
  execFileSync(gradlew, ['assembleRelease'], { cwd: androidDir, stdio: 'inherit' });
} catch {
  fail('The Android build failed: see the messages above.');
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.copyFileSync(path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), outFile);
console.log(`\nAndroid app: ${path.relative(root, outFile)}`);

if (process.argv.includes('--install')) {
  const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  execFileSync(fs.existsSync(adb) ? adb : 'adb', ['install', '-r', outFile], { stdio: 'inherit' });
}
