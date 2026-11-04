// Settings → App updates, in the desktop and Android apps only.
// Those apps bundle a copy of the web files and never update themselves. Their build writes
// build-info.json = { commit, date, app } next to index.html (scripts/prepare-desktop.cjs,
// android/app/build.gradle). "Check for updates" compares that commit with the latest commit on
// main on GitHub. GitHub is asked only after a click, or once a day when the user turned that on
// (first check a minute after opening, never while loading). On the website the file is absent
// (and never fetched): the panel stays hidden, the site is always up to date.
(function () {
  const API = 'https://api.github.com/repos/jobellet/ADHDtools';
  const STORAGE_KEY = 'adhd-update-check'; // { daily: boolean, lastCheck: ms }
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DAILY_FIRST_DELAY_MS = 60 * 1000;
  const DAILY_POLL_MS = 60 * 60 * 1000;
  // Commands to run in the ADHDtools folder on the computer (docs/using-the-app.md, docs/android.md).
  const COMMANDS = {
    desktop: ['git pull', 'npm run desktop:install'],
    android: ['git pull', 'npm run android:install'],
  };

  let buildInfo = null;
  const t = (key, vars) => window.I18n?.t?.(key, vars) ?? key;

  function isNative() {
    return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
  }

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function writeState(patch) {
    const next = { ...readState(), ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* storage full or blocked: the check still works */ }
    return next;
  }

  async function loadBuildInfo() {
    if (!isNative()) return null;
    try {
      const res = await fetch('build-info.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const info = await res.json();
      return info && /^[0-9a-f]{7,40}$/.test(info.commit) ? info : null;
    } catch {
      return null;
    }
  }

  // What to tell the user. latest = { sha, date } of main on GitHub; compare = GitHub's answer for
  // build...latest, or null when GitHub does not know the build's commit (built from a local commit).
  function summarize(build, latest, compare) {
    if (latest.sha === build.commit) return { status: 'current' };
    if (compare) {
      const missing = Number(compare.ahead_by) || 0; // commits on main the build does not have
      return missing > 0 ? { status: 'update', count: missing, date: latest.date } : { status: 'current' };
    }
    if (Date.parse(latest.date) > Date.parse(build.date)) return { status: 'update', count: null, date: latest.date };
    return { status: 'current' };
  }

  async function getJSON(url, fetchImpl) {
    const res = await fetchImpl(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    return res.json();
  }

  // Asks GitHub (1 request when up to date, 2 otherwise). Throws when offline or rate-limited.
  async function check({ build = buildInfo, fetchImpl = (...args) => window.fetch(...args) } = {}) {
    if (!build) return { status: 'unavailable' };
    const list = await getJSON(`${API}/commits?sha=main&per_page=1`, fetchImpl);
    const head = Array.isArray(list) ? list[0] : null;
    if (!head?.sha) throw new Error('GitHub sent no commit');
    const latest = { sha: head.sha, date: head.commit?.committer?.date };
    const compare = latest.sha === build.commit
      ? null
      : await getJSON(`${API}/compare/${build.commit}...${latest.sha}?per_page=1`, fetchImpl);
    writeState({ lastCheck: Date.now() });
    return summarize(build, latest, compare);
  }

  function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(window.I18n?.getLang?.() || undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function appKind() {
    return buildInfo?.app === 'android' || window.__ADHD_ANDROID__ ? 'android' : 'desktop';
  }

  function renderBuildLine() {
    const line = document.getElementById('update-build-line');
    if (line && buildInfo) {
      line.textContent = t('settings.updates.thisVersion', { date: formatDate(buildInfo.date), commit: buildInfo.commit.slice(0, 7) });
    }
  }

  function render(result) {
    const box = document.getElementById('update-check-result');
    if (!box) return;
    box.replaceChildren();
    box.dataset.status = result.status;
    const message = document.createElement('p');
    message.className = 'update-check-message';
    box.append(message);
    if (result.status === 'current') {
      message.textContent = t('settings.updates.current');
      return;
    }
    if (result.status !== 'update') {
      message.textContent = t('settings.updates.error');
      return;
    }
    const date = formatDate(result.date);
    if (result.count === 1) message.textContent = t('settings.updates.availableOne', { date });
    else if (result.count) message.textContent = t('settings.updates.available', { count: result.count, date });
    else message.textContent = t('settings.updates.availableNoCount', { date });

    const kind = appKind();
    const how = document.createElement('p');
    how.textContent = t(`settings.updates.how.${kind}`);
    const commands = document.createElement('pre');
    commands.className = 'update-check-commands';
    const code = document.createElement('code');
    code.textContent = COMMANDS[kind].join('\n');
    commands.append(code);
    box.append(how, commands);
  }

  async function runCheck({ fromUser }) {
    const button = document.getElementById('update-check-btn');
    if (button) {
      button.disabled = true;
      button.textContent = t('settings.updates.checking');
    }
    let result;
    try {
      result = await check();
    } catch {
      result = { status: 'error' };
    }
    if (button) {
      button.disabled = false;
      button.textContent = t('settings.updates.check');
    }
    // A daily check stays quiet unless there is something to do.
    if (fromUser || result.status === 'update') render(result);
    if (!fromUser && result.status === 'update') window.DataManager?.showNotification?.(t('settings.updates.toast'), 'info');
    return result;
  }

  function maybeDailyCheck() {
    const state = readState();
    if (state.daily && Date.now() - (Number(state.lastCheck) || 0) >= DAY_MS) runCheck({ fromUser: false });
  }

  async function init() {
    const panel = document.getElementById('settings-updates-panel');
    if (!panel) return;
    buildInfo = await loadBuildInfo();
    if (!buildInfo) return;
    panel.hidden = false;
    renderBuildLine();
    window.addEventListener('languageChanged', renderBuildLine);

    document.getElementById('update-check-btn')?.addEventListener('click', () => runCheck({ fromUser: true }));
    const daily = document.getElementById('update-check-daily');
    if (daily) {
      daily.checked = Boolean(readState().daily);
      daily.addEventListener('change', () => {
        writeState({ daily: daily.checked });
        if (daily.checked) maybeDailyCheck();
      });
    }
    setTimeout(() => {
      maybeDailyCheck();
      setInterval(maybeDailyCheck, DAILY_POLL_MS);
    }, DAILY_FIRST_DELAY_MS);
  }

  window.UpdateCheck = { summarize, check, getBuildInfo: () => buildInfo };

  document.addEventListener('DOMContentLoaded', init);
})();
