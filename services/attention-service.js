// services/attention-service.js
(function () {
  let wakeLockActiveSources = new Set();
  let wakeLockSentinel = null;
  let activeCountdownSource = null;
  let lastTrayUpdate = 0;
  let trayUpdateTimeout = null;
  const originalTitle = 'ADHD Tools Hub';

  function isNative() {
    return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
  }

  async function invokeNative(cmd, args) {
    if (!isNative()) return null;
    try {
      const invoke = window.__TAURI__?.core?.invoke || window.__TAURI_INTERNALS__?.invoke;
      if (invoke) {
        return await invoke(cmd, args);
      }
    } catch (e) {
      console.warn('Native invoke failed:', e);
    }
    return null;
  }

  async function requestNotificationPermission() {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }
    try {
      const permission = await Notification.requestPermission();
      window.dispatchEvent(new CustomEvent('capabilitiesChanged'));
      return permission;
    } catch (e) {
      return 'default';
    }
  }

  function notify(title, body, options = {}) {
    const config = window.ConfigManager?.getConfig?.() || {};
    if (config.desktopNotifications === false) return;

    if (options.bringToFront) {
      bringToFront();
    }

    if (isNative()) {
      invokeNative('native_notify', { title, body, sound: options.sound || 'bell' });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'icons/home.svg',
        tag: options.tag || 'adhd-timer',
        renotify: true
      });
    }
  }

  function bringToFront() {
    if (isNative()) {
      invokeNative('native_bring_to_front', {});
    } else if (typeof window !== 'undefined' && window.focus) {
      try { window.focus(); } catch {}
    }
  }

  let alarmActive = false;
  let alarmAudioInterval = null;
  let alarmAudioCtx = null;
  let activeAlarmKeyHandler = null;

  function ensureAlarmStyles() {
    if (typeof document === 'undefined' || document.getElementById('alarm-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'alarm-modal-styles';
    style.textContent = `
      .alarm-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        animation: alarmFadeIn 0.2s ease-out;
      }
      @keyframes alarmFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .alarm-card {
        background: var(--surface, #ffffff);
        color: var(--on-surface, #1e1e1e);
        border-radius: 1.25rem;
        padding: 2.25rem 2rem;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        text-align: center;
        animation: alarmPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      @keyframes alarmPop {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .alarm-bell {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: rgba(255, 59, 48, 0.12);
        color: #ff3b30;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.2rem;
        margin: 0 auto 1.25rem;
        animation: alarmRing 1s infinite ease-in-out;
      }
      @keyframes alarmRing {
        0%, 100% { transform: rotate(0); }
        15% { transform: rotate(14deg); }
        30% { transform: rotate(-14deg); }
        45% { transform: rotate(10deg); }
        60% { transform: rotate(-10deg); }
        75% { transform: rotate(4deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function playWebAlarmTone() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!alarmAudioCtx) alarmAudioCtx = new AudioCtx();
      if (alarmAudioCtx.state === 'suspended') alarmAudioCtx.resume();
      const t = alarmAudioCtx.currentTime;

      // Tone 1: 880 Hz
      const osc1 = alarmAudioCtx.createOscillator();
      const gain1 = alarmAudioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, t);
      gain1.gain.setValueAtTime(0.35, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc1.connect(gain1).connect(alarmAudioCtx.destination);
      osc1.start(t);
      osc1.stop(t + 0.15);

      // Tone 2: 1320 Hz
      const osc2 = alarmAudioCtx.createOscillator();
      const gain2 = alarmAudioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1320, t + 0.15);
      gain2.gain.setValueAtTime(0.35, t + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.29);
      osc2.connect(gain2).connect(alarmAudioCtx.destination);
      osc2.start(t + 0.15);
      osc2.stop(t + 0.3);
    } catch (err) {
      console.warn('Alarm tone failed:', err);
    }
  }

  function startAlarmAudio() {
    if (isNative()) {
      invokeNative('native_start_alarm', {});
    }
    playWebAlarmTone();
    if (alarmAudioInterval) clearInterval(alarmAudioInterval);
    alarmAudioInterval = setInterval(playWebAlarmTone, 1100);
  }

  function stopAlarmAudio() {
    if (alarmAudioInterval) {
      clearInterval(alarmAudioInterval);
      alarmAudioInterval = null;
    }
    if (isNative()) {
      invokeNative('native_stop_alarm', {});
    }
  }

  function stopAlarm() {
    alarmActive = false;
    stopAlarmAudio();
    if (typeof document !== 'undefined') {
      const el = document.getElementById('alarm-overlay');
      if (el) el.remove();
      if (activeAlarmKeyHandler) {
        document.removeEventListener?.('keydown', activeAlarmKeyHandler);
        activeAlarmKeyHandler = null;
      }
    }
  }

  function showAlarmModal({ title, body, task, actionType = 'finish', onDone, onStart, onSnooze, onDismiss } = {}) {
    if (typeof document === 'undefined') return;
    ensureAlarmStyles();
    stopAlarm(); // remove any previous overlay

    alarmActive = true;
    startAlarmAudio();
    bringToFront();

    const t = (k, vars) => (window.I18n?.t ? window.I18n.t(k, vars) : k);
    const isStart = actionType === 'start';
    const modalTitle = title || t(isStart ? 'now.alarm.startTitle' : 'now.alarm.title');
    const taskTitle = (task?.name || task?.text || body || '').replace(/\[(FIX|FLEX)\]\s*/gi, '').trim();
    const message = taskTitle
      ? t(isStart ? 'now.alarm.startMessage' : 'now.alarm.finished', { name: taskTitle })
      : (body || '');

    const primaryIcon = isStart ? 'fa-play' : 'fa-check';
    const primaryLabel = isStart ? t('now.alarm.startBtn') : t('now.alarm.done');

    const overlay = document.createElement('div');
    overlay.id = 'alarm-overlay';
    overlay.className = 'alarm-overlay';

    overlay.innerHTML = `
      <div class="alarm-card" role="alertdialog" aria-modal="true">
        <div class="alarm-bell">
          <i class="fas fa-bell"></i>
        </div>
        <h2 style="font-size: 1.6rem; font-weight: 800; margin: 0 0 0.5rem; letter-spacing: -0.02em;"></h2>
        <p class="alarm-msg" style="font-size: 1.15rem; margin: 0 0 1.75rem; color: var(--text-muted); line-height: 1.4;"></p>
        <button type="button" id="alarm-done-btn" class="btn btn-primary btn-large" style="width: 100%; margin-bottom: 0.65rem; font-size: 1.1rem; padding: 0.9rem; font-weight: 700; border-radius: 0.75rem;">
          <i class="fas ${primaryIcon}"></i> <span class="alarm-done-label"></span>
        </button>
        <div style="display: flex; gap: 0.6rem;">
          <button type="button" id="alarm-snooze-btn" class="btn btn-outline" style="flex: 1; font-weight: 600; border-radius: 0.65rem; padding: 0.65rem;">
            <i class="fas fa-hourglass-half"></i> <span class="alarm-snooze-label"></span>
          </button>
          <button type="button" id="alarm-stop-btn" class="btn btn-secondary" style="flex: 1; font-weight: 600; border-radius: 0.65rem; padding: 0.65rem;">
            <i class="fas fa-bell-slash"></i> <span class="alarm-stop-label"></span>
          </button>
        </div>
      </div>
    `;

    overlay.querySelector('h2').textContent = modalTitle;
    overlay.querySelector('.alarm-msg').textContent = message;
    overlay.querySelector('.alarm-done-label').textContent = primaryLabel;
    overlay.querySelector('.alarm-snooze-label').textContent = t('now.alarm.snooze');
    overlay.querySelector('.alarm-stop-label').textContent = t('now.alarm.stop');

    const handlePrimary = () => {
      stopAlarm();
      if (isStart) {
        if (typeof onStart === 'function') onStart();
        else if (typeof onDone === 'function') onDone();
        window.switchTool?.('home');
      } else {
        if (typeof onDone === 'function') {
          onDone();
        } else if (task?.hash && window.TaskStore?.markComplete) {
          window.TaskStore.markComplete(task.hash);
          window.EventBus?.dispatchEvent(new Event('dataChanged'));
          window.dispatchEvent(new Event('scheduleNeedsRefresh'));
        }
      }
    };

    const handleSnooze = () => {
      stopAlarm();
      if (typeof onSnooze === 'function') {
        onSnooze(5);
      } else if (task?.hash && window.TaskStore?.updateTaskByHash) {
        window.TaskStore.updateTaskByHash(task.hash, {
          plannerDate: null,
          autoPinned: false,
          isFixed: false,
          snoozedUntil: new Date(Date.now() + 5 * 60000).toISOString(),
        });
        window.EventBus?.dispatchEvent(new Event('dataChanged'));
        window.dispatchEvent(new Event('scheduleNeedsRefresh'));
      }
    };

    const handleDismiss = () => {
      stopAlarm();
      if (typeof onDismiss === 'function') onDismiss();
    };

    overlay.querySelector('#alarm-done-btn')?.addEventListener('click', handlePrimary);
    overlay.querySelector('#alarm-snooze-btn')?.addEventListener('click', handleSnooze);
    overlay.querySelector('#alarm-stop-btn')?.addEventListener('click', handleDismiss);

    activeAlarmKeyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePrimary();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };
    document.addEventListener?.('keydown', activeAlarmKeyHandler);

    document.body.appendChild(overlay);
  }

  function triggerTaskAlarm({ task, title, body, actionType = 'finish', onDone, onStart, onSnooze, onDismiss } = {}) {
    const config = window.ConfigManager?.getConfig?.() || {};
    const style = config.notificationStyle || 'intrusive';

    if (style === 'subtle') {
      notify(title || 'Time’s up', body || '', { sound: 'none' });
      return;
    }
    if (style === 'standard') {
      notify(title || 'Time’s up', body || '', { sound: 'bell', bringToFront: false });
      return;
    }
    // Default 'intrusive'
    notify(title || 'Time’s up', body || '', { sound: 'alarm', bringToFront: true });
    showAlarmModal({ title, body, task, actionType, onDone, onStart, onSnooze, onDismiss });
  }

  function playNativeSound(type = 'bell') {
    if (isNative()) {
      invokeNative('native_play_sound', { sound: type });
      return true;
    }
    return false;
  }

  async function updateWakeLock() {
    const config = window.ConfigManager?.getConfig?.() || {};

    const shouldBeAwake = config.keepScreenAwake !== false && wakeLockActiveSources.size > 0 && document.visibilityState === 'visible';

    if (shouldBeAwake && !wakeLockSentinel && navigator.wakeLock) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
        });
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    } else if (!shouldBeAwake && wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
        wakeLockSentinel = null;
      } catch (err) {
        console.warn('Wake Lock release failed:', err);
      }
    }

    invokeNative('native_set_keep_awake', { active: wakeLockActiveSources.size > 0 });
  }

  function acquireWakeLock(sourceId) {
    wakeLockActiveSources.add(sourceId);
    updateWakeLock();
  }

  function releaseWakeLock(sourceId) {
    wakeLockActiveSources.delete(sourceId);
    updateWakeLock();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateWakeLock();
      }
    });
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function setCountdownStatus({ source, label, remainingSeconds, isRunning }) {
    activeCountdownSource = source;
    const config = window.ConfigManager?.getConfig?.() || {};

    if (isRunning && remainingSeconds != null) {
      if (config.titleBarCountdown !== false) {
        document.title = `${formatTime(remainingSeconds)} — ${label} · ADHD Tools`;
      } else {
        document.title = originalTitle;
      }
    } else {
      document.title = originalTitle;
    }

    const update = () => {
      invokeNative('native_update_tray', {
        label: label || '',
        remainingSeconds: remainingSeconds ?? -1,
        isRunning: Boolean(isRunning)
      });
      lastTrayUpdate = Date.now();
    };

    const now = Date.now();
    if (now - lastTrayUpdate >= 1000) {
      if (trayUpdateTimeout) {
        clearTimeout(trayUpdateTimeout);
        trayUpdateTimeout = null;
      }
      update();
    } else {
      if (!trayUpdateTimeout) {
        trayUpdateTimeout = setTimeout(() => {
          trayUpdateTimeout = null;
          update();
        }, 1000 - (now - lastTrayUpdate));
      }
    }
  }

  function clearCountdownStatus(source) {
    if (activeCountdownSource === source) {
      activeCountdownSource = null;
      document.title = originalTitle;
      if (trayUpdateTimeout) {
        clearTimeout(trayUpdateTimeout);
        trayUpdateTimeout = null;
      }
      invokeNative('native_update_tray', { label: '', remainingSeconds: -1, isRunning: false });
    }
  }

  async function openMiniPlayer(renderCallback) {
    if (isNative()) {
      invokeNative('native_toggle_mini_player', {});
    } else if (window.documentPictureInPicture?.requestWindow) {
      try {
        const pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 320,
          height: 180,
        });

        [...document.head.querySelectorAll('link[rel="stylesheet"]')].forEach((styleLink) => {
          pipWindow.document.head.appendChild(styleLink.cloneNode());
        });

        renderCallback(pipWindow.document.body, pipWindow);
      } catch (err) {
        console.warn('PiP failed:', err);
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('configUpdated', () => {
      updateWakeLock();
    });

    window.addEventListener('native:quick-capture', () => {
      window.AppSheets?.open('capture');
    });

    if (window.__TAURI__?.event?.listen) {
      window.__TAURI__.event.listen('native:quick-capture', () => {
        window.AppSheets?.open('capture');
      });
    }

    window.AttentionService = {
      isNative,
      invokeNative,
      requestNotificationPermission,
      notify,
      bringToFront,
      playNativeSound,
      acquireWakeLock,
      releaseWakeLock,
      setCountdownStatus,
      clearCountdownStatus,
      openMiniPlayer,
      startAlarm: showAlarmModal,
      stopAlarm,
      triggerTaskAlarm,
      isAlarmActive: () => alarmActive,
    };
  }
})();
