// Settings → App updates (features/settings/update-check.js): what the desktop and Android apps say
// after asking GitHub whether main has commits their build does not have. GitHub is faked here.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const BUILD = { commit: 'a'.repeat(40), date: '2026-10-31T07:00:00+01:00', app: 'desktop' };
const MAIN = { sha: 'b'.repeat(40), commit: { committer: { date: '2026-11-03T10:00:00Z' } } };

function load() {
  const store = new Map();
  const sandbox = {
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
    },
    window: {},
    document: { addEventListener: () => {} },
  };
  vm.runInNewContext(readFileSync(new URL('../features/settings/update-check.js', import.meta.url), 'utf8'), sandbox);
  return { UpdateCheck: sandbox.window.UpdateCheck, store };
}

// answers: { 'commits': body | status, 'compare': body | status }
function fakeGitHub(answers) {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    const answer = answers[url.includes('/compare/') ? 'compare' : 'commits'];
    const status = typeof answer === 'number' ? answer : 200;
    return { ok: status === 200, status, json: async () => answer };
  };
  return { fetchImpl, calls };
}

describe('Update check', () => {
  it('the build is the latest commit on main → up to date, one request', async () => {
    const { UpdateCheck, store } = load();
    const gh = fakeGitHub({ commits: [{ ...MAIN, sha: BUILD.commit }] });
    const result = await UpdateCheck.check({ build: BUILD, fetchImpl: gh.fetchImpl });
    assert.equal(result.status, 'current');
    assert.equal(gh.calls.length, 1);
    assert.match(gh.calls[0], /^https:\/\/api\.github\.com\/repos\/jobellet\/ADHDtools\/commits\?sha=main&per_page=1$/);
    assert.ok(JSON.parse(store.get('adhd-update-check')).lastCheck > 0, 'remembers when it checked');
  });

  it('main has new commits → update with their number and date', async () => {
    const { UpdateCheck } = load();
    const gh = fakeGitHub({ commits: [MAIN], compare: { status: 'behind', ahead_by: 4, behind_by: 0 } });
    const result = await UpdateCheck.check({ build: BUILD, fetchImpl: gh.fetchImpl });
    assert.equal(result.status, 'update');
    assert.equal(result.count, 4);
    assert.equal(result.date, MAIN.commit.committer.date);
    assert.ok(gh.calls[1].includes(`/compare/${BUILD.commit}...${MAIN.sha}`));
  });

  it('build has local commits that are not on main yet, but nothing missing → up to date', () => {
    const { UpdateCheck } = load();
    const result = UpdateCheck.summarize(BUILD, { sha: MAIN.sha, date: MAIN.commit.committer.date }, { status: 'ahead', ahead_by: 0, behind_by: 2 });
    assert.equal(result.status, 'current');
  });

  it('GitHub does not know the build commit → compares dates', async () => {
    const { UpdateCheck } = load();
    const newer = await UpdateCheck.check({ build: BUILD, fetchImpl: fakeGitHub({ commits: [MAIN], compare: 404 }).fetchImpl });
    assert.deepEqual({ ...newer }, { status: 'update', count: null, date: MAIN.commit.committer.date });
    const later = { ...BUILD, date: '2026-11-04T09:00:00Z' };
    const same = await UpdateCheck.check({ build: later, fetchImpl: fakeGitHub({ commits: [MAIN], compare: 404 }).fetchImpl });
    assert.equal(same.status, 'current');
  });

  it('GitHub errors (rate limit, offline) are thrown, so the screen can say it could not check', async () => {
    const { UpdateCheck } = load();
    await assert.rejects(UpdateCheck.check({ build: BUILD, fetchImpl: fakeGitHub({ commits: 403 }).fetchImpl }));
    await assert.rejects(UpdateCheck.check({ build: BUILD, fetchImpl: async () => { throw new TypeError('offline'); } }));
  });

  it('no build stamp (website) → nothing is asked', async () => {
    const { UpdateCheck } = load();
    const gh = fakeGitHub({ commits: [MAIN] });
    assert.equal((await UpdateCheck.check({ build: null, fetchImpl: gh.fetchImpl })).status, 'unavailable');
    assert.equal(gh.calls.length, 0);
  });
});
