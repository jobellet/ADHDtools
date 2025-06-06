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
    const goalInput = document.getElementById('focus-goal');
    const previewTimer = document.querySelector('#focus-preview .preview-timer');
    const previewGoal = document.querySelector('#focus-preview .preview-goal');
    const fullscreenContainer = document.getElementById('fullscreen-focus-mode');
    const fullscreenTimer = document.getElementById('focus-mode-timer');
    const fullscreenGoal = document.getElementById('focus-mode-goal');
    const focusProgressBar = document.getElementById('focus-mode-progress-bar'); // Added

    let timerId = null;
    let remainingSeconds = 0;
    let totalFocusSessionSeconds = 0; // Added
    let audio = null;

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

      totalFocusSessionSeconds = remainingSeconds; // Store total duration
      if (focusProgressBar) focusProgressBar.style.width = '0%'; // Reset progress bar

      // Enter fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(console.error);
      }

      // Apply background and start sound
      applyBackground(backgroundSelect.value);
      startAudio(soundSelect.value);

      // Persist session data
      localStorage.setItem('focus-session', JSON.stringify({
        goal,
        duration,
        background: backgroundSelect.value,
        sound: soundSelect.value,
        start: Date.now()
      }));

      // Begin countdown
      timerId = setInterval(() => {
        remainingSeconds--;
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
      alert(completed ? 'Focus session completed!' : 'Focus session ended early.');
    }

    function resumeSession() {
      const data = localStorage.getItem('focus-session');
      if (!data) return;
      const { goal, duration, background, sound, start } = JSON.parse(data);
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const total = duration * 60;
      if (elapsed >= total) {
        localStorage.removeItem('focus-session');
        return;
      }

      durationInput.value = duration;
      backgroundSelect.value = background;
      soundSelect.value = sound;
      goalInput.value = goal;
      startFocus();
      remainingSeconds = total - elapsed;
    }

    if (enterBtn) enterBtn.addEventListener('click', startFocus);
    if (exitBtn) exitBtn.addEventListener('click', () => endFocus(false));

    // Resume any in-progress session
    resumeSession();
  });
}
