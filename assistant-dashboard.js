// assistant-dashboard.js - the "assistant" layer around the Now view:
// 1. Quick capture: add or speak a task naturally (core/task-parser.js), in
//    the "Add" sheet. A task given a time never lands on busy time (routine,
//    event, other task): it moves to the next free slot and says so.
// 2. Daily progress: completed tasks + achievement points, with optional AI encouragement.
// Both work without any AI provider configured.

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const captureForm = document.getElementById('quick-capture-form');
    const captureInput = document.getElementById('quick-capture-input');
    const captureVoiceBtn = document.getElementById('quick-capture-voice');
    const captureStatus = document.getElementById('quick-capture-status');
    const progressCard = document.getElementById('daily-progress');
    if (!captureForm && !progressCard) return;

    // ----- Quick capture -----

    function describeParsed(parsed) {
      const parts = [];
      if (parsed.plannerDate) parts.push(`scheduled ${parsed.plannerDate.replace('T', ' ')}`);
      else if (parsed.deadline) parts.push(`due ${parsed.deadline.replace('T', ' ')}`);
      if (parsed.durationMinutes) parts.push(`${parsed.durationMinutes} min`);
      if (parsed.importance) parts.push(`importance ${parsed.importance}`);
      if (parsed.isFixed) parts.push('fixed');
      const how = parsed.source === 'ai' ? 'understood by AI' : 'parsed offline';
      return parts.length ? `${parts.join(' · ')} (${how})` : `(${how})`;
    }

    function showCaptureStatus(text, isError) {
      if (!captureStatus) return;
      captureStatus.textContent = text;
      captureStatus.classList.toggle('error', Boolean(isError));
    }

    async function captureTask(text) {
      if (!text.trim() || !window.TaskParser || !window.TaskStore) return;
      showCaptureStatus('Adding…');
      const parsed = await window.TaskParser.parseSmart(text);
      if (!parsed || !parsed.name) {
        showCaptureStatus('Could not understand that — try "Call mom tomorrow at 5pm".', true);
        return;
      }
      const raw = {
        name: parsed.isFixed && !/\[FIX\]/i.test(parsed.name) ? `[FIX] ${parsed.name}` : parsed.name,
        user: window.UserContext?.getActiveUser?.() || 'main',
        deadline: parsed.deadline || null,
        plannerDate: parsed.plannerDate || null,
        isFixed: parsed.isFixed || false,
        source: 'quick-capture',
      };
      if (parsed.durationMinutes) raw.durationMinutes = parsed.durationMinutes;
      if (parsed.importance) raw.importance = parsed.importance;

      // No double booking: a timed task that hits a routine, an event or
      // another task moves to the next free slot of that day.
      let moved = '';
      const scheduler = window.UnifiedScheduler;
      if (raw.plannerDate && raw.plannerDate.length >= 16 && scheduler?.findConflicts) {
        const dateStr = raw.plannerDate.slice(0, 10);
        const [h, m] = raw.plannerDate.slice(11, 16).split(':').map(Number);
        const start = h * 60 + m;
        const duration = raw.durationMinutes || Number(window.ConfigManager?.getConfig?.().defaultTaskMinutes) || 25;
        const clashes = scheduler.findConflicts({ dateStr, startMinutes: start, durationMinutes: duration });
        if (clashes.length) {
          const free = scheduler.findNextFreeSlot({ dateStr, fromMinutes: start, durationMinutes: duration });
          if (Number.isFinite(free)) {
            const hhmm = `${String(Math.floor(free / 60)).padStart(2, '0')}:${String(free % 60).padStart(2, '0')}`;
            raw.plannerDate = `${dateStr}T${hhmm}`;
            moved = ` ${parsed.plannerDate.slice(11, 16)} was taken by “${clashes[0].name}”, so it is at ${hhmm}.`;
          } else {
            raw.plannerDate = null;
            moved = ` That day is full, so it waits in your task list.`;
          }
        }
      }

      const task = window.TaskStore.addTask(raw);
      const shownName = task.name.replace(/\[(FIX|FLEX)\]\s*/gi, '').trim() || task.name;
      showCaptureStatus(`Added “${shownName}” — ${describeParsed({ ...parsed, plannerDate: raw.plannerDate })}.${moved}`);

      if (parsed.needsBreakdown) {
        const breakBtn = document.createElement('button');
        breakBtn.className = 'btn btn-outline btn-compact';
        breakBtn.style.marginLeft = '10px';
        breakBtn.innerHTML = '<i class="fas fa-project-diagram"></i> Break it down';
        breakBtn.title = 'This task seems complex. Click here to break it down.';
        breakBtn.addEventListener('click', () => {
          if (window.EventBus) {
            window.EventBus.dispatchEvent(new CustomEvent('ef-receiveTaskFor-TaskBreakdown', {
              detail: { text: task.name, id: task.hash }
            }));
            window.switchTool?.('breakdown');
            window.AppSheets?.close();
          }
        });
        captureStatus.appendChild(breakBtn);
      }

      window.EventBus?.dispatchEvent(new Event('dataChanged'));
      window.dispatchEvent(new Event('scheduleNeedsRefresh'));
      renderProgress();
      window.dispatchEvent(new CustomEvent('taskCaptured', { detail: { task, needsBreakdown: Boolean(parsed.needsBreakdown), moved: Boolean(moved) } }));
    }

    if (captureForm) {
      captureForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = captureInput?.value || '';
        if (!text.trim()) return;
        if (captureInput) captureInput.value = '';
        await captureTask(text);
      });
    }

    if (captureVoiceBtn) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        captureVoiceBtn.style.display = 'none';
      } else {
        captureVoiceBtn.addEventListener('click', () => {
          const recognition = new SpeechRecognition();
          recognition.lang = document.documentElement.lang === 'fr' ? 'fr-FR' : 'en-US';
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          captureVoiceBtn.classList.add('listening');
          showCaptureStatus('Listening…');
          recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            if (captureInput) captureInput.value = transcript;
            await captureTask(transcript);
          };
          recognition.onerror = (e) => showCaptureStatus(`Voice input failed: ${e.error}`, true);
          recognition.onend = () => captureVoiceBtn.classList.remove('listening');
          recognition.start();
        });
      }
    }

    // ----- Daily progress -----

    function getCompletedToday() {
      const activeUser = window.UserContext?.getActiveUser?.();
      const today = window.UnifiedScheduler?.localDateString?.(new Date()) || new Date().toISOString().slice(0, 10);
      const all = window.TaskStore?.getAllTasks?.() || [];
      return all.filter(t => t.completed
        && t.completedAt
        && (window.UnifiedScheduler?.localDateString?.(new Date(t.completedAt)) || t.completedAt.slice(0, 10)) === today
        && (!activeUser || t.user === activeUser));
    }

    function renderProgress() {
      if (!progressCard) return;
      const done = getCompletedToday();
      const points = done.reduce((sum, t) => sum + (t.achievementScore || 0), 0);
      const minutes = done.reduce((sum, t) => sum + (Number(t.durationMinutes) || 0), 0);

      progressCard.innerHTML = '';
      const heading = document.createElement('h3');
      heading.innerHTML = '<i class="fas fa-chart-line"></i> Today’s progress';
      progressCard.appendChild(heading);

      const stats = document.createElement('div');
      stats.className = 'daily-progress-stats';
      [
        { value: done.length, label: done.length === 1 ? 'task done' : 'tasks done' },
        { value: points.toFixed(1), label: 'points earned' },
        { value: Math.round(minutes), label: 'focused minutes' },
      ].forEach(({ value, label }) => {
        const stat = document.createElement('div');
        stat.className = 'daily-progress-stat';
        stat.innerHTML = `<span class="stat-value">${value}</span><span class="stat-label">${label}</span>`;
        stats.appendChild(stat);
      });
      progressCard.appendChild(stats);

      if (window.AIAssistant?.isEnabled?.() && done.length) {
        const coachBtn = document.createElement('button');
        coachBtn.className = 'btn btn-outline btn-sm';
        coachBtn.innerHTML = '<i class="fas fa-comment-dots"></i> AI encouragement';
        const coachOut = document.createElement('p');
        coachOut.className = 'daily-progress-coach';
        coachBtn.addEventListener('click', async () => {
          coachBtn.disabled = true;
          coachOut.textContent = 'Thinking…';
          try {
            const names = done.slice(0, 10).map(t => t.name).join('; ');
            coachOut.textContent = await window.AIAssistant.complete(
              `The user has ADHD and completed these tasks today: ${names}. They earned ${points.toFixed(1)} achievement points over ${Math.round(minutes)} minutes. Write 1-2 warm, specific, non-patronizing sentences of encouragement.`,
              { maxTokens: 120 }
            );
          } catch (err) {
            coachOut.textContent = err.message;
          } finally {
            coachBtn.disabled = false;
          }
        });
        progressCard.append(coachBtn, coachOut);
      }
    }

    // ----- Wiring -----

    window.EventBus?.addEventListener('dataChanged', renderProgress);
    window.addEventListener('activeUserChanged', renderProgress);
    window.addEventListener('aiSettingsChanged', renderProgress);

    renderProgress();
  });
})();
