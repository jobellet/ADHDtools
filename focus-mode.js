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
    const previewContainer = document.getElementById('focus-preview');
    const fullscreenContainer = document.getElementById('fullscreen-focus-mode');
    const fullscreenTimer = document.getElementById('focus-mode-timer');
    const fullscreenGoal = document.getElementById('focus-mode-goal');
    const focusProgressBar = document.getElementById('focus-mode-progress-bar'); // Added
    const pauseBtn = document.getElementById('pause-focus-mode');
    const textArea = document.getElementById('focus-text');
    const downloadBtn = document.getElementById('download-focus-text');
    const previewSoundBtn = document.getElementById('focus-sound-preview');
    const fullscreenPreviewSoundBtn = document.getElementById('focus-sound-preview-fullscreen');

    const required = [enterBtn, exitBtn, durationInput, backgroundSelect, soundSelect, fullscreenContainer, fullscreenTimer];
    if (required.some(el => !el)) {
      console.warn('Focus mode elements missing; skipping initialization');
      return;
    }

    if (textArea) {
      const savedNotes = localStorage.getItem('focus-notes');
      if (savedNotes) textArea.value = savedNotes;
      textArea.addEventListener('input', () => {
        localStorage.setItem('focus-notes', textArea.value);
      });
    }

    let timerId = null;
    let remainingSeconds = 0;
    let totalFocusSessionSeconds = 0; // Added
    let audio = null;
    let previewAudio = null;
    let endTime = null; // Timestamp when the focus session should end

    // Format seconds as MM:SS
    const formatTime = secs => {
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      return `${m}:${s}`;
    };

    // Background classes correspond to options: solid, gradient, nature, minimal
    function applyBackground(type) {
      const classes = ['bg-solid', 'bg-gradient', 'bg-nature', 'bg-minimal'];
      [previewContainer, fullscreenContainer].forEach(el => {
        if (el) {
          el.classList.remove(...classes);
          el.classList.add(`bg-${type}`);
        }
      });
    }

    function updatePreview() {
      let duration = parseInt(durationInput.value, 10);
      if (!isNaN(duration) && duration > 240) {
        duration = 240;
        durationInput.value = 240;
      }
      previewTimer.textContent = isNaN(duration) ? '00:00' : formatTime(duration * 60);
      previewGoal.textContent = goalInput.value.trim();
      applyBackground(backgroundSelect.value);
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

    function previewAudioClip(type) {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }
      if (type !== 'none' && soundUrls[type]) {
        previewAudio = new Audio(soundUrls[type]);
        previewAudio.play().catch(console.error);
        setTimeout(() => {
          if (previewAudio) {
            previewAudio.pause();
            previewAudio = null;
          }
        }, 3000);
      }
    }

    function startFocus(preserveNotes = false) {
      if (timerId) {
        // End any existing session without alerts
        endFocus(false);
      }
      const duration = parseInt(durationInput.value, 10);
      if (isNaN(duration) || duration <= 0 || duration > 240) {
        alert('Please enter a valid duration (1-240 minutes)');
        return;
      }
      remainingSeconds = duration * 60;
      updatePreview();
      const goal = goalInput.value.trim();

      fullscreenGoal.textContent = goal || '';
      fullscreenTimer.textContent = formatTime(remainingSeconds);
      fullscreenContainer.classList.remove('hidden');
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }
      if (textArea) {
        if (preserveNotes) {
          const savedNotes = localStorage.getItem('focus-notes');
          textArea.value = savedNotes || '';
        } else {
          textArea.value = '';
          localStorage.removeItem('focus-notes');
        }
      }

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
      if (pauseBtn) pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';

      // Persist session data
      localStorage.setItem('focus-session', JSON.stringify({
        goal,
        duration,
        background: backgroundSelect.value,
        sound: soundSelect.value,
        start: Date.now(),
        endTime
      }));

      startCountdown();
    }

    function startCountdown() {
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

    function pauseFocus() {
      if (!timerId) return;
      clearInterval(timerId);
      timerId = null;
      remainingSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
    }

    function resumeFocusTimer() {
      if (timerId) return;
      endTime = Date.now() + remainingSeconds * 1000;
      startCountdown();
      pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
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
      if (previewContainer) previewContainer.classList.remove('bg-solid', 'bg-gradient', 'bg-nature', 'bg-minimal');
      if (fullscreenContainer) fullscreenContainer.classList.remove('bg-solid', 'bg-gradient', 'bg-nature', 'bg-minimal');
      fullscreenContainer.classList.add('hidden');

      // Clear persisted session
      localStorage.removeItem('focus-session');
      if (focusProgressBar) focusProgressBar.style.width = '0%'; // Reset progress bar
      totalFocusSessionSeconds = 0; // Reset total duration
      // No popup at the end of the session
      if (pauseBtn) pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';

      // Allow marking the focused task as complete and record duration learning
      if (completed && window.FocusTaskContext?.taskHash && window.TaskStore?.markComplete) {
        const ctx = window.FocusTaskContext;
        const elapsedMinutes = ctx.startedAt ? Math.max(1, Math.round((Date.now() - ctx.startedAt) / 60000)) : null;
        const durationMinutes = elapsedMinutes || ctx.durationMinutes;
        const task = window.TaskStore.getTaskByHash(ctx.taskHash);
        if (task) {
          if (durationMinutes && window.DurationLearning?.recordTaskDuration) {
            window.DurationLearning.recordTaskDuration(task.name, durationMinutes);
          }
          window.TaskStore.markComplete(ctx.taskHash);
          window.EventBus?.dispatchEvent(new Event('dataChanged'));
        }
      }
      window.FocusTaskContext = null;
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
      startFocus(true);
      remainingSeconds = total - elapsed;
      endTime = Date.now() + remainingSeconds * 1000;
    }

    if (enterBtn) enterBtn.addEventListener('click', startFocus);
    if (exitBtn) exitBtn.addEventListener('click', () => endFocus(false));
    if (pauseBtn) pauseBtn.addEventListener('click', () => {
      if (timerId) {
        pauseFocus();
      } else {
        resumeFocusTimer();
      }
    });
    if (soundSelect) soundSelect.addEventListener('change', () => {
      if (fullscreenSoundSelect) fullscreenSoundSelect.value = soundSelect.value;
      if (timerId) {
        startAudio(soundSelect.value);
      }
    });
    if (backgroundSelect) backgroundSelect.addEventListener('change', () => {
      if (fullscreenBackgroundSelect) fullscreenBackgroundSelect.value = backgroundSelect.value;
      updatePreview();
    });
    if (fullscreenSoundSelect) fullscreenSoundSelect.addEventListener('change', () => {
      soundSelect.value = fullscreenSoundSelect.value;
      if (timerId) {
        startAudio(fullscreenSoundSelect.value);
      }
    });
    if (fullscreenBackgroundSelect) fullscreenBackgroundSelect.addEventListener('change', () => {
      backgroundSelect.value = fullscreenBackgroundSelect.value;
      updatePreview();
    });
    if (durationInput) durationInput.addEventListener('input', updatePreview);
    if (goalInput) goalInput.addEventListener('input', updatePreview);
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

    if (previewSoundBtn) previewSoundBtn.addEventListener('click', () => {
      if (timerId) {
        startAudio(soundSelect.value);
      } else {
        previewAudioClip(soundSelect.value);
      }
    });
    if (fullscreenPreviewSoundBtn) fullscreenPreviewSoundBtn.addEventListener('click', () => {
      if (timerId) {
        startAudio(fullscreenSoundSelect.value);
      } else {
        previewAudioClip(fullscreenSoundSelect.value);
      }
    });

    // Resume any in-progress session
    updatePreview();
    resumeSession();
  });
}
