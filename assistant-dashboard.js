// assistant-dashboard.js - the "assistant" layer of the Home/Today view:
// 1. Context banner: what should I be doing right now? (core/context-engine.js)
// 2. Quick capture: add or speak a task naturally (core/task-parser.js)
// 3. Daily progress: completed tasks + achievement points, with optional AI encouragement.
// All three work without any AI provider configured.

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('context-banner');
    const captureForm = document.getElementById('quick-capture-form');
    const captureInput = document.getElementById('quick-capture-input');
    const captureVoiceBtn = document.getElementById('quick-capture-voice');
    const captureStatus = document.getElementById('quick-capture-status');
    const progressCard = document.getElementById('daily-progress');
    if (!banner && !captureForm && !progressCard) return;

    let lastAutoSwitchedContext = null;

    // ----- Context banner -----

    function runContextAction(action) {
      if (!action) return;
      if (action.tool === 'focus' && action.taskSlot) {
        const goalInput = document.getElementById('focus-goal');
        const task = action.taskSlot.task;
        if (goalInput) goalInput.value = task.name || task.text || 'Focus';
        window.FocusTaskContext = {
          taskHash: task.hash,
          startedAt: Date.now(),
          durationMinutes: task.durationMinutes,
        };
        document.getElementById('enter-focus-mode')?.click();
        return;
      }
      window.switchTool?.(action.tool);
      if (action.routineId) {
        window.activateRoutine?.(action.routineId);
      }
      if (action.generate) {
        setTimeout(() => document.getElementById('generate-schedule-btn')?.click(), 100);
      }
    }

    function renderBanner() {
      if (!banner || !window.ContextEngine) return;
      const context = window.ContextEngine.getContext(new Date());

      let focusCard = document.getElementById('current-focus-card');
      const homeSection = document.getElementById('home');
      if (context && !window.ContextEngine.isDismissed(context.id)) {
        if (!focusCard) {
          focusCard = document.createElement('div');
          focusCard.id = 'current-focus-card';
          focusCard.className = 'current-focus-card';
          if (homeSection) {
            homeSection.insertBefore(focusCard, banner);
          }
        }

        focusCard.style.display = 'flex';
        focusCard.className = `current-focus-card context-${context.type}`;
        focusCard.style.padding = '1rem';
        focusCard.style.marginBottom = '1rem';
        focusCard.style.backgroundColor = 'var(--card-bg)';
        focusCard.style.border = '2px solid var(--primary-color)';
        focusCard.style.borderRadius = '8px';
        focusCard.style.alignItems = 'center';
        focusCard.style.justifyContent = 'space-between';

        focusCard.innerHTML = '';

        const contentDiv = document.createElement('div');
        contentDiv.style.display = 'flex';
        contentDiv.style.alignItems = 'center';
        contentDiv.style.gap = '1rem';

        const icon = document.createElement('i');
        icon.className = `fas ${context.icon || 'fa-compass'} context-banner-icon`;
        icon.style.fontSize = '2rem';
        icon.style.color = 'var(--primary-color)';
        contentDiv.appendChild(icon);

        const body = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `Current Focus: ${context.title}`;
        title.style.display = 'block';
        title.style.fontSize = '1.2rem';
        const message = document.createElement('p');
        message.textContent = context.message;
        message.style.margin = '0';
        body.append(title, message);
        contentDiv.appendChild(body);

        focusCard.appendChild(contentDiv);

        if (context.action) {
          const actBtn = document.createElement('button');
          actBtn.className = 'btn btn-primary';
          actBtn.textContent = context.action.label;
          actBtn.addEventListener('click', () => {
             const toolCard = document.querySelector(`.tool-card[data-tool='${context.action.tool}']`);
             if (toolCard) {
                 toolCard.click();
             } else {
                 runContextAction(context.action);
             }
          });
          focusCard.appendChild(actBtn);
        }
      } else if (focusCard) {
        focusCard.style.display = 'none';
      }

      if (banner) {
        banner.style.display = 'none';
      }

      // Optional hands-free mode: jump straight into an open routine window.
      const cfg = window.ConfigManager?.getConfig?.();
      if (context && cfg?.contextAutoSwitch && context.type === 'routine' && lastAutoSwitchedContext !== context.id) {
        lastAutoSwitchedContext = context.id;
        runContextAction(context.action);
      }
    }

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
      const task = window.TaskStore.addTask(raw);
      showCaptureStatus(`Added “${task.name}” — ${describeParsed(parsed)}`);

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
          }
        });
        captureStatus.appendChild(breakBtn);
      }

      window.EventBus?.dispatchEvent(new Event('dataChanged'));
      window.dispatchEvent(new Event('scheduleNeedsRefresh'));
      renderBanner();
      renderProgress();
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
      const today = new Date().toISOString().slice(0, 10);
      const all = window.TaskStore?.getAllTasks?.() || [];
      return all.filter(t => t.completed
        && (t.completedAt || '').startsWith(today)
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

    window.EventBus?.addEventListener('dataChanged', () => { renderBanner(); renderProgress(); });
    window.EventBus?.addEventListener('calendarEventsUpdated', () => { renderBanner(); renderProgress(); });
    window.addEventListener('activeUserChanged', () => { renderBanner(); renderProgress(); });
    window.addEventListener('aiSettingsChanged', renderProgress);
    setInterval(renderBanner, 60000);

    renderBanner();
    renderProgress();
  });
})();
