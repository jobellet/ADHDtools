// features/now/quick-capture.js - the "assistant" layer around the Now view:
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

    const t = (key, vars) => (window.I18n ? window.I18n.t(key, vars) : key);

    // ----- Quick capture -----

    function describeParsed(parsed) {
      const parts = [];
      if (parsed.plannerDate) parts.push(t('capture.scheduled', { date: parsed.plannerDate.replace('T', ' ') }));
      else if (parsed.deadline) parts.push(t('capture.due', { date: parsed.deadline.replace('T', ' ') }));
      if (parsed.durationMinutes) parts.push(t('unit.min', { n: parsed.durationMinutes }));
      if (parsed.importance) parts.push(t('capture.importance', { n: parsed.importance }));
      if (parsed.isFixed) parts.push(t('capture.fixed'));
      const how = t(parsed.source === 'ai' ? 'capture.byAI' : 'capture.offline');
      return parts.length ? `${parts.join(' · ')} (${how})` : `(${how})`;
    }

    function showCaptureStatus(text, isError) {
      if (!captureStatus) return;
      captureStatus.textContent = text;
      captureStatus.classList.toggle('error', Boolean(isError));
    }

    async function captureTask(text) {
      if (!text.trim() || !window.TaskParser || !window.TaskStore) return;
      showCaptureStatus(t('capture.adding'));
      const parsed = await window.TaskParser.parseSmart(text);
      if (!parsed || !parsed.name) {
        showCaptureStatus(t('capture.notUnderstood'), true);
        return;
      }
      const raw = {
        name: parsed.isFixed && !/\[FIX\]/i.test(parsed.name) ? `[FIX] ${parsed.name}` : parsed.name,
        user: window.UserContext?.getActiveUser?.() || 'main',
        deadline: parsed.deadline || null,
        plannerDate: parsed.plannerDate || null,
        isFixed: parsed.isFixed || false,
        isEvent: parsed.isEvent || false,
        recurrence: parsed.recurrence || null,
        dependency: parsed.dependency || null,
        location: parsed.location || null,
        travelMode: parsed.travelMode || null,
        source: 'quick-capture',
      };
      if (parsed.durationMinutes) raw.durationMinutes = parsed.durationMinutes;
      if (parsed.importance) raw.importance = parsed.importance;
      if (parsed.urgency) raw.urgency = parsed.urgency;

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
            moved = ` ${t('capture.moved', { time: parsed.plannerDate.slice(11, 16), name: clashes[0].name, newTime: hhmm })}`;
          } else {
            raw.plannerDate = null;
            moved = ` ${t('capture.dayFull')}`;
          }
        }
      }

      const task = window.TaskStore.addTask(raw);
      const shownName = task.name.replace(/\[(FIX|FLEX)\]\s*/gi, '').trim() || task.name;
      showCaptureStatus(`${t('capture.added', { name: shownName, details: describeParsed({ ...parsed, plannerDate: raw.plannerDate }) })}${moved}`);

      if (parsed.needsBreakdown) {
        const breakBtn = document.createElement('button');
        breakBtn.className = 'btn btn-outline btn-compact';
        breakBtn.style.marginLeft = '10px';
        breakBtn.innerHTML = '<i class="fas fa-project-diagram"></i> <span></span>';
        breakBtn.querySelector('span').textContent = t('capture.breakdown');
        breakBtn.title = t('plan.splitTitle');
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
      const isNative = () => Boolean(window.AttentionService?.isNative?.());
      if (!SpeechRecognition && !isNative()) {
        captureVoiceBtn.style.display = 'none';
      } else {
        let nativePollTimer = null;
        let activeRecognition = null;

        const getCaptureSpeechLang = () => {
          const lang = (window.I18n?.getLang?.() || document.documentElement.lang || 'en').toLowerCase();
          const map = { fr: 'fr-FR', de: 'de-DE', es: 'es-ES', en: 'en-US' };
          return map[lang] || `${lang}-${lang.toUpperCase()}`;
        };

        const resetVoiceBtn = () => {
          if (nativePollTimer) {
            clearInterval(nativePollTimer);
            nativePollTimer = null;
          }
          activeRecognition = null;
          captureVoiceBtn.classList.remove('listening');
          captureVoiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
          if (captureInput) captureInput.placeholder = t('capture.placeholder');
        };

        captureVoiceBtn.addEventListener('click', async () => {
          if (captureVoiceBtn.classList.contains('listening')) {
            if (isNative()) {
              const res = await window.AttentionService.invokeNative('native_stop_speech', {});
              resetVoiceBtn();
              if (res?.transcript && captureInput) {
                captureInput.value = res.transcript;
                captureInput.focus();
                showCaptureStatus(t('capture.transcribed'));
              } else {
                showCaptureStatus('');
              }
            } else if (activeRecognition) {
              activeRecognition.stop();
            }
            return;
          }

          captureVoiceBtn.classList.add('listening');
          captureVoiceBtn.innerHTML = '<i class="fas fa-microphone fa-beat" style="color: #ff3b30"></i>';
          showCaptureStatus(t('capture.listening'));
          if (captureInput) captureInput.placeholder = t('capture.listening');

          if (isNative()) {
            await window.AttentionService.invokeNative('native_start_speech', {
              lang: getCaptureSpeechLang()
            });
            nativePollTimer = setInterval(async () => {
              const res = await window.AttentionService.invokeNative('native_poll_speech', {});
              if (!res) return;
              if (res.transcript && captureInput) {
                captureInput.value = res.transcript;
              }
              if (res.status === 'done') {
                resetVoiceBtn();
                if (res.transcript && captureInput) {
                  captureInput.value = res.transcript;
                  captureInput.focus();
                  showCaptureStatus(t('capture.transcribed'));
                } else {
                  showCaptureStatus('');
                }
              } else if (res.status === 'error') {
                resetVoiceBtn();
                const isDenied = res.error === 'mic-denied' || res.error === 'speech-denied' || res.error === 'not-allowed';
                const msg = isDenied
                  ? t('capture.micDenied')
                  : t('capture.voiceError', { error: res.error || 'unknown' });
                showCaptureStatus(msg, true);
              }
            }, 250);
            return;
          }

          const recognition = new SpeechRecognition();
          activeRecognition = recognition;
          recognition.lang = getCaptureSpeechLang();
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;

          recognition.onresult = (event) => {
            resetVoiceBtn();
            const transcript = event.results?.[0]?.[0]?.transcript;
            if (transcript && captureInput) {
              captureInput.value = transcript;
              captureInput.focus();
              showCaptureStatus(t('capture.transcribed'));
            }
          };
          recognition.onerror = (e) => {
            resetVoiceBtn();
            const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
              ? t('capture.micDenied')
              : t('capture.voiceError', { error: e.error || 'unknown' });
            showCaptureStatus(msg, true);
          };
          recognition.onend = resetVoiceBtn;
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
      heading.innerHTML = '<i class="fas fa-chart-line"></i> <span></span>';
      heading.querySelector('span').textContent = t('progress.heading');
      progressCard.appendChild(heading);

      const stats = document.createElement('div');
      stats.className = 'daily-progress-stats';
      [
        { value: done.length, label: t('progress.tasksDone') },
        { value: points.toFixed(1), label: t('progress.points') },
        { value: Math.round(minutes), label: t('progress.minutes') },
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
        coachBtn.innerHTML = '<i class="fas fa-comment-dots"></i> <span></span>';
        coachBtn.querySelector('span').textContent = t('progress.coach');
        const coachOut = document.createElement('p');
        coachOut.className = 'daily-progress-coach';
        coachBtn.addEventListener('click', async () => {
          coachBtn.disabled = true;
          coachOut.textContent = t('progress.thinking');
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
    window.addEventListener('languageChanged', renderProgress);

    window.addEventListener('native:quick-capture', () => {
      setTimeout(() => {
        if (captureInput) {
          captureInput.focus();
          captureInput.select();
        }
      }, 50);
    });

    renderProgress();
  });
})();
