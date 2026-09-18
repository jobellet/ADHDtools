import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function getLocalScriptSources(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((source) => !/^(?:https?:)?\/\//i.test(source));
}

describe('Application shell', () => {
  it('references only local scripts that are present in the repository', () => {
    const missingScripts = getLocalScriptSources(indexHtml)
      .filter((source) => !existsSync(new URL(`../${source}`, import.meta.url)));

    assert.deepEqual(missingScripts, []);
  });

  it('keeps local-first capture and optional integration entry points available', () => {
    for (const id of ['quick-capture-form', 'quick-capture-input', 'quick-capture-voice']) {
      assert.match(indexHtml, new RegExp(`id=["']${id}["']`));
    }

    for (const source of [
      'core/ai-provider.js',
      'google-auth.js',
      'drive-sync.js',
      'data-manager.js',
    ]) {
      assert.match(indexHtml, new RegExp(`src=["']${source}["']`));
    }
  });
});
