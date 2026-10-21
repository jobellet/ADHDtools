// Keeps the three apps in step: the web app (GitHub Pages), the desktop app (src-tauri/) and the
// Android app (android/). All three run the same web files; this test fails when a native command,
// the list of bundled files or the version number drifts in one of them. See android/AGENTS.md.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const WEB_DIRS = ['core', 'shell', 'services', 'features'];
const BRIDGE = 'android/app/src/main/java/com/adhdtools/app/NativeBridge.java';
const BRIDGE_JS = 'android/app/src/main/res/raw/android_bridge.js';

function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const rel = `${dir}/${name}`;
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const matches = (text, re) => new Set([...text.matchAll(re)].map(m => m[1]));
const sorted = set => [...set].sort();
const missingFrom = (wanted, have) => sorted(wanted).filter(name => !have.has(name));

// Commands the web app calls through window.__TAURI__.core.invoke (AttentionService.invokeNative).
const webJs = WEB_DIRS.flatMap(walk).filter(f => f.endsWith('.js')).map(read).join('\n');
const webCommands = matches(webJs, /\b(?:invokeNative|invoke)\(\s*['"](native_\w+)['"]/g);

// Desktop: commands registered with tauri::generate_handler![...].
const handler = read('src-tauri/src/lib.rs').match(/generate_handler!\[([\s\S]*?)\]/);
const desktopCommands = new Set(handler ? handler[1].split(',').map(s => s.trim()).filter(Boolean) : []);

// Android: `case "native_…":` in NativeBridge.java.
const bridgeJava = read(BRIDGE);
const androidCommands = matches(bridgeJava, /case\s+"(native_\w+)"\s*:/g);

describe('Web, desktop and Android apps stay aligned', () => {
  it('finds the commands (the patterns still match the code)', () => {
    assert.ok(webCommands.size >= 10, `web commands: ${sorted(webCommands)}`);
    assert.ok(desktopCommands.size >= 10, 'generate_handler! list not found in src-tauri/src/lib.rs');
    assert.ok(androidCommands.size >= 10, `no "case \\"native_…\\":" found in ${BRIDGE}`);
  });

  it('the desktop app answers every native command the web app calls', () => {
    assert.deepEqual(missingFrom(webCommands, desktopCommands), [],
      'add a #[tauri::command] and list it in generate_handler! (src-tauri/src/lib.rs)');
  });

  it('the Android app answers every native command the web app calls', () => {
    assert.deepEqual(missingFrom(webCommands, androidCommands), [], `add a case to ${BRIDGE}`);
  });

  it('desktop and Android have the same native commands', () => {
    assert.deepEqual(missingFrom(desktopCommands, androidCommands), [], `in src-tauri but not in ${BRIDGE}`);
    assert.deepEqual(missingFrom(androidCommands, desktopCommands), [], `in ${BRIDGE} but not in src-tauri`);
  });

  it('no native command is left without a caller in the web app', () => {
    assert.deepEqual(missingFrom(desktopCommands, webCommands), [], 'remove the unused command from both apps');
  });

  it('Android-only commands are used by the Android bridge script', () => {
    const bridgeJs = read(BRIDGE_JS);
    const unused = sorted(matches(bridgeJava, /case\s+"(android_\w+)"\s*:/g)).filter(cmd => !bridgeJs.includes(`'${cmd}'`));
    assert.deepEqual(unused, []);
  });

  it('every app bundles the same web files (scripts/web-assets.json)', () => {
    const assets = JSON.parse(read('scripts/web-assets.json'));
    assert.deepEqual(assets.filter(name => !existsSync(join(ROOT, name))), [], 'listed but missing');
    assert.match(read('scripts/prepare-desktop.cjs'), /require\('\.\/web-assets\.json'\)/, 'desktop must read the shared list');
    assert.match(read('android/app/build.gradle'), /scripts\/web-assets\.json/, 'Android must read the shared list');

    // Every local file index.html loads must be inside a bundled path, or the native apps break.
    const html = read('index.html');
    const local = [...html.matchAll(/\b(?:src|href)="([^"#?:]+)"/g)].map(m => m[1]).filter(p => !p.startsWith('//'));
    const top = new Set(assets);
    const outside = [...new Set(local)].filter(p => !top.has(p.replace(/^\.\//, '').split('/')[0]));
    assert.deepEqual(outside, [], 'add their folder to scripts/web-assets.json');
  });

  it('every app has the version from package.json', () => {
    const { version } = JSON.parse(read('package.json'));
    assert.equal(JSON.parse(read('src-tauri/tauri.conf.json')).version, '../package.json');
    assert.equal(read('src-tauri/Cargo.toml').match(/^version\s*=\s*"([^"]+)"/m)?.[1], version,
      'set the same version in src-tauri/Cargo.toml');
    assert.match(read('android/app/build.gradle'), /package\.json'\)\)\.version/);
  });
});
