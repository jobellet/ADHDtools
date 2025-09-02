// Focus Mode Refactor: fixes optional goal, background & sound support, and prevents duplicate init
if (window.__focusModeLoaded) {
  console.warn('Focus mode script already loaded');
} else {
  window.__focusModeLoaded = true;

  document.addEventListener('DOMContentLoaded', () => {
    const enterBtn = document.getElementById('enter-focus-mode');
    const exitBtn = document.getElementById('exit-focus-mode');
    const durationInput = document.getElementById('focus-duration-setting');
    const backgroundSelect = document.getElementById('focus-background');
    const soundSelect = document.getElementById('focus-sound');
    const fullscreenBackgroundSelect = document.getElementById('focus-background-fullscreen');
    const fullscreenSoundSelect = document.getElementById('focus-sound-fullscreen');
    const goalInput = document.getElementById('focus-goal');
    const previewTimer = document.querySelector('#focus-preview .preview-timer');
    const previewGoal = document.querySelector('#focus-preview .preview-goal');
    const fullscreenContainer = document.getElementById('fullscreen-focus-mode');
    const fullscreenTimer = document.getElementById('focus-mode-timer');
    const fullscreenGoal = document.getElementById('focus-mode-goal');
    const focusProgressBar = document.getElementById('focus-mode-progress-bar'); // Added
    const textArea = document.getElementById('focus-text');
    const downloadBtn = document.getElementById('download-focus-text');

    let timerId = null;
    let remainingSeconds = 0;
    let totalFocusSessionSeconds = 0; // Added
    let audio = null;
    let endTime = null; // Timestamp when the focus session should end

    // Format seconds as MM:SS
    const formatTime = secs => {
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      return `${m}:${s}`;
    };

    // Background classes correspond to options: solid, gradient, nature, minimal
    function applyBackground(type) {
      document.body.classList.remove('bg-solid', 'bg-gradient', 'bg-nature', 'bg-minimal');
      document.body.classList.add(`bg-${type}`);
    }

    // Map sound option to audio file URL
    const soundUrls = {
      'white-noise': 'sounds/white-noise.mp3',
      'pink-noise': 'sounds/pink-noise.mp3',
      'rain': 'sounds/rain.mp3',
      'cafe': 'sounds/cafe.mp3',
      'forest': 'sounds/forest.mp3'
    };

    function startAudio(type) {
      if (audio) {
        audio.pause();
        audio = null;
      }
      if (type !== 'none' && soundUrls[type]) {
        audio = new Audio(soundUrls[type]);
        audio.loop = true;
        audio.play().catch(console.error);
      }
    }

    function startFocus() {
      if (timerId) {
        // End any existing session without alerts
        endFocus(false);
      }
      const duration = parseInt(durationInput.value, 10);
      if (isNaN(duration) || duration <= 0) {
        alert('Please enter a valid duration');
        return;
      }
      remainingSeconds = duration * 60;
      previewTimer.textContent = formatTime(remainingSeconds);
      const goal = goalInput.value.trim();
      previewGoal.textContent = goal || '';

      fullscreenGoal.textContent = goal || '';
      fullscreenTimer.textContent = formatTime(remainingSeconds);
      fullscreenContainer.classList.remove('hidden');
      if (textArea) textArea.value = '';

      totalFocusSessionSeconds = remainingSeconds; // Store total duration
      if (focusProgressBar) focusProgressBar.style.width = '0%'; // Reset progress bar

      endTime = Date.now() + remainingSeconds * 1000; // Calculate end time

      // Enter fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(console.error);
      }

      // Apply background and start sound
      applyBackground(backgroundSelect.value);
      startAudio(soundSelect.value);
      if (fullscreenBackgroundSelect) fullscreenBackgroundSelect.value = backgroundSelect.value;
      if (fullscreenSoundSelect) fullscreenSoundSelect.value = soundSelect.value;

      // Persist session data
      localStorage.setItem('focus-session', JSON.stringify({
        goal,
        duration,
        background: backgroundSelect.value,
        sound: soundSelect.value,
        start: Date.now(),
        endTime
      }));

      // Begin countdown
      timerId = setInterval(() => {
        const now = Date.now();
        remainingSeconds = Math.max(0, Math.ceil((endTime - now) / 1000));
        fullscreenTimer.textContent = formatTime(remainingSeconds);

        if (focusProgressBar && totalFocusSessionSeconds > 0) {
            const elapsedSeconds = totalFocusSessionSeconds - remainingSeconds;
            const progressPercentage = (elapsedSeconds / totalFocusSessionSeconds) * 100;
            focusProgressBar.style.width = Math.min(progressPercentage, 100) + '%';
        }

        if (remainingSeconds <= 0) {
          endFocus(true);
        }
      }, 1000);
    }

    function endFocus(completed = false) {
      clearInterval(timerId);
      timerId = null;
      endTime = null;

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }

      // Stop sound and reset background
      if (audio) {
        audio.pause();
        audio = null;
      }
      document.body.classList.remove('bg-solid', 'bg-gradient', 'bg-nature', 'bg-minimal');
      fullscreenContainer.classList.add('hidden');

      // Clear persisted session
      localStorage.removeItem('focus-session');
      if (focusProgressBar) focusProgressBar.style.width = '0%'; // Reset progress bar
      totalFocusSessionSeconds = 0; // Reset total duration
      // No popup at the end of the session
    }

    function resumeSession() {
      const data = localStorage.getItem('focus-session');
      if (!data) return;
      const { goal, duration, background, sound, start, endTime: savedEnd } = JSON.parse(data);
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const total = duration * 60;
      if (elapsed >= total) {
        localStorage.removeItem('focus-session');
        return;
      }

      durationInput.value = duration;
      backgroundSelect.value = background;
      soundSelect.value = sound;
      if (fullscreenBackgroundSelect) fullscreenBackgroundSelect.value = background;
      if (fullscreenSoundSelect) fullscreenSoundSelect.value = sound;
      goalInput.value = goal;
      startFocus();
      remainingSeconds = total - elapsed;
      endTime = Date.now() + remainingSeconds * 1000;
    }

    if (enterBtn) enterBtn.addEventListener('click', startFocus);
    if (exitBtn) exitBtn.addEventListener('click', () => endFocus(false));
    if (soundSelect) soundSelect.addEventListener('change', () => {
      if (fullscreenSoundSelect) fullscreenSoundSelect.value = soundSelect.value;
      if (timerId) {
        startAudio(soundSelect.value);
      }
    });
    if (backgroundSelect) backgroundSelect.addEventListener('change', () => {
      if (fullscreenBackgroundSelect) fullscreenBackgroundSelect.value = backgroundSelect.value;
      if (timerId) {
        applyBackground(backgroundSelect.value);
      }
    });
    if (fullscreenSoundSelect) fullscreenSoundSelect.addEventListener('change', () => {
      soundSelect.value = fullscreenSoundSelect.value;
      if (timerId) {
        startAudio(fullscreenSoundSelect.value);
      }
    });
    if (fullscreenBackgroundSelect) fullscreenBackgroundSelect.addEventListener('change', () => {
      backgroundSelect.value = fullscreenBackgroundSelect.value;
      if (timerId) {
        applyBackground(fullscreenBackgroundSelect.value);
      }
    });
    if (downloadBtn && textArea) {
      downloadBtn.addEventListener('click', () => {
        const blob = new Blob([textArea.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'focus-notes.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // Resume any in-progress session
    resumeSession();
  });
}
