import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

// shell/i18n.js and features/*/strings.js are classic browser scripts: run them in a sandbox.
function loadI18n(lang) {
  const sandbox = {
    window: { dispatchEvent() {} },
    document: { documentElement: {}, addEventListener() {}, querySelectorAll: () => [] },
    localStorage: { getItem: () => lang },
    CustomEvent: class {},
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../shell/i18n.js', import.meta.url), 'utf8'), sandbox);
  sandbox.I18n = sandbox.window.I18n;
  for (const feature of readdirSync(new URL('../features/', import.meta.url))) {
    const file = new URL(`../features/${feature}/strings.js`, import.meta.url);
    if (existsSync(file)) vm.runInContext(readFileSync(file, 'utf8'), sandbox);
  }
  return sandbox.window;
}

describe('Translations', () => {
  const { translations, I18n } = loadI18n('fr');

  test('every app string exists in fr, de and es', () => {
    const appKeys = Object.keys(translations.en).filter(k => /^[a-z]+\./.test(k));
    assert.ok(appKeys.length > 50);
    for (const lang of ['fr', 'de', 'es']) {
      const missing = appKeys.filter(k => !(k in translations[lang]));
      assert.deepStrictEqual(missing, [], `missing in ${lang}`);
    }
  });

  test('placeholders match between languages', () => {
    const names = s => (String(s).match(/\{\w+\}/g) || []).sort().join();
    for (const lang of ['fr', 'de', 'es']) {
      for (const [key, text] of Object.entries(translations.en)) {
        if (!/^[a-z]+\./.test(key)) continue;
        assert.strictEqual(names(translations[lang][key]), names(text), `${lang} ${key}`);
      }
    }
  });

  test('t() fills values and falls back to English', () => {
    assert.strictEqual(I18n.t('plan.deleted', { n: 2 }), '2 tâche(s) supprimée(s).');
    assert.strictEqual(I18n.getLang(), 'fr');
    assert.strictEqual(I18n.t('no.such.key', {}, 'fallback'), 'fallback');
  });
});
