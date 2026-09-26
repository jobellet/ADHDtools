// Keeps the code layout and the AGENTS.md files in sync, so agents can trust
// the docs instead of reading every file. See AGENTS.md and tests/AGENTS.md.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRS = ['core', 'shell', 'services', 'features', 'styles'];
const read = p => readFileSync(join(ROOT, p), 'utf8');

function walk(dir) {
  return readdirSync(join(ROOT, dir)).filter(name => name !== 'node_modules' && name !== '.git').flatMap(name => {
    const rel = join(dir, name);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const sourceFiles = SOURCE_DIRS.flatMap(walk).filter(f => /\.(js|css)$/.test(f));
const agentFiles = ['AGENTS.md', ...SOURCE_DIRS.concat(['tests', 'docs']).flatMap(walk).filter(f => f.endsWith('AGENTS.md'))];
const indexHtml = read('index.html');

describe('Architecture', () => {
  it('every JS/CSS file is loaded by index.html or imported by another file', () => {
    const allJs = sourceFiles.filter(f => f.endsWith('.js')).map(f => [f, read(f)]);
    const unused = sourceFiles.filter(file => {
      if (indexHtml.includes(`"${file}"`)) return false;
      const name = file.split('/').pop();
      return !allJs.some(([other, text]) => other !== file
        && new RegExp(`(from|import\\()\\s*['"][./]*[^'"]*${name.replace('.', '\\.')}['"]`).test(text));
    });
    assert.deepEqual(unused, [], 'unreferenced files: delete them or load them');
  });

  it('every feature folder has an AGENTS.md', () => {
    const features = readdirSync(join(ROOT, 'features')).filter(d => statSync(join(ROOT, 'features', d)).isDirectory());
    assert.deepEqual(features.filter(d => !existsSync(join(ROOT, 'features', d, 'AGENTS.md'))), []);
  });

  it('every source file is described in the AGENTS.md of its folder', () => {
    const missing = sourceFiles.filter(file => {
      const doc = join(dirname(file), 'AGENTS.md');
      if (!existsSync(join(ROOT, doc))) return true;
      return !read(doc).includes(`\`${file.split('/').pop()}\``);
    });
    assert.deepEqual(missing, [], 'add a row for these files to their folder AGENTS.md');
  });

  it('file paths mentioned in AGENTS.md files exist', () => {
    const broken = [];
    for (const doc of agentFiles) {
      const text = read(doc);
      const refs = [
        ...[...text.matchAll(/`([^`\s]+\.(?:js|css|md|html|cjs|json|svg|yml))`/g)].map(m => m[1]),
        ...[...text.matchAll(/\]\(([^)#\s]+)\)/g)].map(m => m[1]).filter(l => !/^https?:/.test(l)),
      ].filter(ref => !/[*<…]/.test(ref));
      const below = walk(dirname(doc) === '.' ? '.' : dirname(doc)).filter(f => !f.includes('node_modules') && !f.startsWith('.git'));
      for (const ref of refs) {
        const candidates = [join(ROOT, ref), join(ROOT, dirname(doc), ref)];
        // A bare file name ("routine.js") may name a file in a subfolder of this doc's folder.
        const found = candidates.some(c => existsSync(c))
          || (!ref.includes('/') && below.some(f => f.endsWith(`/${ref}`) || f === ref));
        if (!found) broken.push(`${doc}: ${ref}`);
      }
    }
    assert.deepEqual(broken, []);
  });

  it('the globals table in AGENTS.md matches the code', () => {
    const rows = [...read('AGENTS.md').matchAll(/^\| `(\w+)` \| `([^`]+)` \|/gm)];
    assert.ok(rows.length >= 20, 'globals table not found');
    const wrong = rows.filter(([, name, file]) => !existsSync(join(ROOT, file))
      || !new RegExp(`window\\.${name}\\s*=`).test(read(file)));
    assert.deepEqual(wrong.map(([, n, f]) => `${n} in ${f}`), []);
  });

  it('feature strings load after shell/i18n.js and before feature code', () => {
    const scripts = [...indexHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
    const i18n = scripts.indexOf('shell/i18n.js');
    const strings = scripts.map((s, i) => [s, i]).filter(([s]) => s.endsWith('/strings.js'));
    const firstFeature = scripts.findIndex(s => s.startsWith('features/') && !s.endsWith('/strings.js'));
    assert.ok(i18n >= 0);
    for (const [file, i] of strings) {
      assert.ok(i > i18n && i < firstFeature, `${file} must load after shell/i18n.js and before feature scripts`);
    }
    const onDisk = walk('features').filter(f => f.endsWith('/strings.js'));
    assert.deepEqual(onDisk.filter(f => !scripts.includes(f)), [], 'strings.js not loaded');
  });

  it('relative imports point to existing files', () => {
    const broken = [];
    for (const file of sourceFiles.filter(f => f.endsWith('.js'))) {
      for (const m of read(file).matchAll(/(?:from|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const target = join(ROOT, dirname(file), m[1]);
        if (!existsSync(target)) broken.push(`${file} → ${m[1]}`);
      }
    }
    assert.deepEqual(broken, []);
  });

  it('source files stay in their layer folders', () => {
    const stray = readdirSync(ROOT).filter(f => /\.(js|css)$/.test(f));
    assert.deepEqual(stray, [], `put these in ${SOURCE_DIRS.join('/, ')}/ (see AGENTS.md)`);
  });
});
