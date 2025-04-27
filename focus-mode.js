// Focus Mode Refactor: align selectors with HTML, fix start/exit, and persistence

document.addEventListener('DOMContentLoaded', () => {
  // Selectors match index.html IDs
  const enterBtn = document.getElementById('enter-focus-mode');
  const exitBtn = document.getElementById('exit-focus-mode');
  const durationInput = document.getElementById('focus-duration-setting');
  const goalInput = document.getElementById('focus-goal');
  const previewTimer = document.querySelector('#focus-preview .preview-timer');
  const previewGoal = document.querySelector('#focus-preview .preview-goal');
  const fullscreenContainer = document.getElementById('fullscreen-focus-mode');
  const fullscreenTimer = document.getElementById('focus-mode-timer');
  const fullscreenGoal = document.getElementById('focus-mode-goal');

  let timerId = null;
  let remainingSeconds = 0;

  // Helper: format MM:SS
  const formatTime = secs => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start focus session
  function startFocus() {
    const duration = parseInt(durationInput.value, 10);
    const goal = goalInput.value.trim();
    if (isNaN(duration) || duration <= 0) {
      alert('Please enter a valid duration');
      return;
    }
    if (!goal) {
      alert('Please enter a focus goal');
      return;
    }

    remainingSeconds = duration * 60;
    previewTimer.textContent = formatTime(remainingSeconds);
    previewGoal.textContent = goal;

    // Show fullscreen
    fullscreenGoal.textContent = goal;
    fullscreenTimer.textContent = formatTime(remainingSeconds);
    fullscreenContainer.classList.remove('hidden');

    // Enter full screen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(console.error);
    }

    // Persist session
    const session = { goal, duration, start: Date.now() };
    localStorage.setItem('focus-session', JSON.stringify(session));

    // Start countdown
    timerId = setInterval(() => {
      remainingSeconds--;
      fullscreenTimer.textContent = formatTime(remainingSeconds);
      if (remainingSeconds <= 0) {
        endFocus(true);
      }
    }, 1000);
  }

  // End focus session
  function endFocus(completed = false) {
    clearInterval(timerId);
    timerId = null;

    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }

    // Hide fullscreen
    fullscreenContainer.classList.add('hidden');

    // Cleanup
    localStorage.removeItem('focus-session');
    alert(completed ? 'Focus session complete!' : 'Focus session ended early.');
  }

  // Resume unfinished session
  function resumeSession() {
    const data = localStorage.getItem('focus-session');
    if (!data) return;
    const { goal, duration, start } = JSON.parse(data);
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const total = duration * 60;
    if (elapsed >= total) {
      localStorage.removeItem('focus-session');
      return;
    }
    remainingSeconds = total - elapsed;
    goalInput.value = goal;
    durationInput.value = duration;
    startFocus();
  }

  // Attach events
  if (enterBtn) enterBtn.addEventListener('click', startFocus);
  if (exitBtn) exitBtn.addEventListener('click', () => endFocus(false));

  // Attempt to resume on load
  resumeSession();
});
