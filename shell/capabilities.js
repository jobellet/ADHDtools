// shell/capabilities.js - adapt the UI to how this user set the app up.
// Each integration is optional (Google Calendar, .ics import, AI provider,
// voice). Controls for things the user does not use are tucked away, so the
// screen only shows what helps; "Show all options" in Settings brings them back.
//
// Markup hooks:
//   data-cap="ai speech"   -> shown only when one of these is available
//   data-cap-hide="gcal"   -> hidden when this is set up (e.g. .ics import once
//                             Google Calendar is connected)
(function () {
  function readFlag(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function detect() {
    const cfg = window.ConfigManager?.getConfig?.() || {};
    return {
      gcal: readFlag('gcalConnected') === 'true',
      ics: Boolean(readFlag('adhd-calendar-ics-url')),
      ai: Boolean(window.AIAssistant?.isEnabled?.()),
      speech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      showAll: Boolean(cfg.showAllOptions),
    };
  }

  function apply() {
    const caps = detect();
    const body = document.body;
    if (!body) return caps;
    ['gcal', 'ics', 'ai', 'speech'].forEach(name => body.classList.toggle(`cap-${name}`, caps[name]));
    body.classList.toggle('show-all-options', caps.showAll);
    window.dispatchEvent(new CustomEvent('capabilitiesApplied', { detail: caps }));
    return caps;
  }

  window.AppCapabilities = { get: detect, refresh: apply };

  document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('configUpdated', apply);
  window.addEventListener('aiSettingsChanged', apply);
  window.addEventListener('capabilitiesChanged', apply);
  window.addEventListener('storage', apply);
})();
