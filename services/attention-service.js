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
      playNativeSound,
      acquireWakeLock,
      releaseWakeLock,
      setCountdownStatus,
      clearCountdownStatus,
      openMiniPlayer
    };
  }
})();
