// features/thoughts/thoughts.js - Quick Thoughts daily stream, speech input, Drive sync & AI summaries
(function () {
  const STORAGE_KEY = 'adhd-thoughts';

  const t = (key, vars, fallback) => (window.I18n ? window.I18n.t(key, vars, fallback) : (fallback || key));

  function getTodayDateStr() {
    if (window.UnifiedScheduler?.localDateString) {
      return window.UnifiedScheduler.localDateString(new Date());
    }
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getLocalTimeStr(date = new Date()) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function getAllThoughts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to read quick thoughts:', err);
    }
    return {};
  }

  function saveAllThoughts(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('thoughtsChanged', { detail: { data } }));
      window.EventBus?.dispatchEvent(new CustomEvent('dataChanged', { detail: { source: 'thoughts' } }));
      window.DriveSync?.notifyLocalChange?.();
    } catch (err) {
      console.error('Failed to save quick thoughts:', err);
    }
  }

  function getThoughtsForDate(dateStr) {
    const all = getAllThoughts();
    const list = all[dateStr];
    return Array.isArray(list) ? list : [];
  }

  function addThought(text, { dateStr = getTodayDateStr(), time = getLocalTimeStr(), source = 'text' } = {}) {
    if (!text || !text.trim()) return null;
    const cleanText = text.trim();
    const all = getAllThoughts();
    if (!Array.isArray(all[dateStr])) {
      all[dateStr] = [];
    }

    const thought = {
      id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: cleanText,
      time: time || getLocalTimeStr(),
      createdAt: Date.now(),
      source,
    };

    all[dateStr].push(thought);
    all[dateStr].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    saveAllThoughts(all);

    // Opportunistically sync text file to Google Drive in the background if connected
    if (window.DriveSync && window.GoogleAuth?.getClientId?.()) {
      syncToDrive(dateStr, { interactive: false }).catch(() => {});
    }

    return thought;
  }

  function deleteThought(id, dateStr) {
    const all = getAllThoughts();
    if (!Array.isArray(all[dateStr])) return false;
    const initialLen = all[dateStr].length;
    all[dateStr] = all[dateStr].filter(item => item.id !== id);
    if (all[dateStr].length !== initialLen) {
      saveAllThoughts(all);
      if (window.DriveSync && window.GoogleAuth?.getClientId?.()) {
        syncToDrive(dateStr, { interactive: false }).catch(() => {});
      }
      return true;
    }
    return false;
  }

  function formatDayAsText(dateStr) {
    const list = getThoughtsForDate(dateStr);
    const lines = [
      `=== ADHD Tools — Quick Thoughts (${dateStr}) ===`,
      `Date: ${dateStr}`,
      `Count: ${list.length}`,
      '',
    ];

    if (!list.length) {
      lines.push('(No thoughts recorded)');
    } else {
      list.forEach(item => {
        lines.push(`[${item.time || '00:00'}] ${item.text}`);
      });
    }

    lines.push('');
    return lines.join('\n');
  }

  async function syncToDrive(dateStr, { interactive = false } = {}) {
    if (!window.DriveSync?.saveTextFile) {
      throw new Error('Google Drive sync service not available.');
    }
    const textContent = formatDayAsText(dateStr);
    const filename = `ADHD-Thoughts-${dateStr}.txt`;
    return window.DriveSync.saveTextFile(filename, textContent, { interactive });
  }

  async function summarizeDay(dateStr) {
    const list = getThoughtsForDate(dateStr);
    if (!list.length) {
      throw new Error(t('thoughts.empty'));
    }
    if (!window.AIAssistant?.isEnabled?.()) {
      throw new Error(t('thoughts.aiNeedsConfig'));
    }

    const currentLang = window.I18n?.getLang?.() || 'en';
    const langNames = { fr: 'French', de: 'German', es: 'Spanish', en: 'English' };
    const langLabel = langNames[currentLang] || currentLang;

    const notesBlock = list.map(item => `[${item.time}] ${item.text}`).join('\n');
    const systemPrompt = `You are a supportive, insightful personal coach for someone with ADHD.
The user jots down raw, unedited thoughts during the day.
Your task is to summarize the day's thoughts in a punchy, easy-to-digest overview:
- 🌟 Main Focus & Energy (1-2 sentences on what captured their attention today)
- 📌 Key Themes & Observations (bullet points with bold highlights)
- 💡 Ideas & Insights noticed
- 🧘 Encouraging closing thought (kind, motivating, ADHD-friendly)
Respond in ${langLabel}. Use markdown formatting with bullet points and bold highlights.`;

    const userPrompt = `Date: ${dateStr}\n\nToday's quick thoughts:\n${notesBlock}\n\nPlease summarize my day.`;

    const summary = await window.AIAssistant.complete(userPrompt, { system: systemPrompt, temperature: 0.3 });
    return summary;
  }

  async function restructureDay(dateStr) {
    const list = getThoughtsForDate(dateStr);
    if (!list.length) {
      throw new Error(t('thoughts.empty'));
    }
    if (!window.AIAssistant?.isEnabled?.()) {
      throw new Error(t('thoughts.aiNeedsConfig'));
    }

    const currentLang = window.I18n?.getLang?.() || 'en';
    const langNames = { fr: 'French', de: 'German', es: 'Spanish', en: 'English' };
    const langLabel = langNames[currentLang] || currentLang;

    const notesBlock = list.map(item => `[${item.time}] ${item.text}`).join('\n');
    const systemPrompt = `You are an organizational assistant for someone with ADHD.
Analyze the user's unorganized stream of daily thoughts and restructure them into clear categories:
1. 🎯 Actionable Tasks / Next Steps
2. 💡 Ideas & Brainstorms
3. 📌 Notes & Reminders
4. 💭 Reflections & Observations

Extract specific actionable to-do tasks with recommended duration (minutes) and importance (1-10).
Respond with valid JSON only in this format:
{
  "overview": "Short 1-2 sentence overview in ${langLabel}",
  "sections": [
    {
      "title": "Category title in ${langLabel}",
      "items": ["Item 1", "Item 2"]
    }
  ],
  "tasks": [
    {
      "name": "Actionable task title in ${langLabel}",
      "estimatedMinutes": 15,
      "importance": 5
    }
  ]
}`;

    const userPrompt = `Date: ${dateStr}\n\nToday's thoughts:\n${notesBlock}\n\nRestructure these thoughts.`;

    try {
      const parsed = await window.AIAssistant.completeJSON(userPrompt, { system: systemPrompt, temperature: 0.2 });
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Fallback to text completion
      const text = await window.AIAssistant.complete(userPrompt, { system: systemPrompt, temperature: 0.3 });
      return { overview: text, sections: [], tasks: [] };
    }
    return { overview: '', sections: [], tasks: [] };
  }

  function convertThoughtToTask(thought) {
    if (!thought || !window.TaskStore) return null;
    const taskData = {
      name: thought.text,
      user: window.UserContext?.getActiveUser?.() || 'main',
      source: 'quick-thoughts',
      durationMinutes: Number(window.ConfigManager?.getConfig?.().defaultTaskMinutes) || 25,
      importance: 5,
      urgency: 5,
    };
    const created = window.TaskStore.addTask(taskData);
    window.EventBus?.dispatchEvent(new Event('dataChanged'));
    window.dispatchEvent(new Event('scheduleNeedsRefresh'));
    return created;
  }

  // ----- UI Component -----

  let currentDateStr = getTodayDateStr();
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  function renderUI() {
    const container = document.getElementById('thoughts');
    if (!container) return;

    const dateLabel = document.getElementById('thoughts-date-label');
    const datePicker = document.getElementById('thoughts-date-picker');
    const thoughtsCount = document.getElementById('thoughts-count-display');
    const thoughtsList = document.getElementById('thoughts-stream');

    if (dateLabel) {
      const today = getTodayDateStr();
      dateLabel.textContent = currentDateStr === today ? t('thoughts.today') : currentDateStr;
    }
    if (datePicker) {
      datePicker.value = currentDateStr;
    }

    const thoughts = getThoughtsForDate(currentDateStr);
    if (thoughtsCount) {
      thoughtsCount.textContent = t('thoughts.count', { n: thoughts.length });
    }

    if (!thoughtsList) return;
    thoughtsList.innerHTML = '';

    if (!thoughts.length) {
      const empty = document.createElement('div');
      empty.className = 'thoughts-empty-state';
      empty.innerHTML = `
        <div class="thoughts-empty-icon"><i class="fas fa-lightbulb"></i></div>
        <p class="thoughts-empty-text">${t('thoughts.empty')}</p>
      `;
      thoughtsList.appendChild(empty);
      return;
    }

    thoughts.forEach(thought => {
      const card = document.createElement('div');
      card.className = 'thought-card';
      card.dataset.id = thought.id;

      const left = document.createElement('div');
      left.className = 'thought-card-left';

      const timeBadge = document.createElement('span');
      timeBadge.className = 'thought-time-badge';
      timeBadge.textContent = thought.time || '00:00';

      const text = document.createElement('div');
      text.className = 'thought-text';
      text.textContent = thought.text;

      left.appendChild(timeBadge);
      left.appendChild(text);

      const actions = document.createElement('div');
      actions.className = 'thought-actions';

      // Turn into task button
      const taskBtn = document.createElement('button');
      taskBtn.className = 'thought-action-btn';
      taskBtn.title = t('thoughts.convertToTask');
      taskBtn.setAttribute('aria-label', t('thoughts.convertToTask'));
      taskBtn.innerHTML = '<i class="fas fa-tasks"></i>';
      taskBtn.addEventListener('click', () => {
        const created = convertThoughtToTask(thought);
        if (created) {
          taskBtn.innerHTML = '<i class="fas fa-check" style="color:#16a34a"></i>';
          showStatus(t('thoughts.taskCreated', { name: thought.text }), false);
          setTimeout(() => {
            taskBtn.innerHTML = '<i class="fas fa-tasks"></i>';
          }, 2500);
        }
      });

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'thought-action-btn delete-btn';
      delBtn.title = t('thoughts.deleteBtn');
      delBtn.setAttribute('aria-label', t('thoughts.deleteBtn'));
      delBtn.innerHTML = '<i class="fas fa-trash"></i>';
      delBtn.addEventListener('click', () => {
        deleteThought(thought.id, currentDateStr);
        renderUI();
      });

      actions.appendChild(taskBtn);
      actions.appendChild(delBtn);

      card.appendChild(left);
      card.appendChild(actions);
      thoughtsList.appendChild(card);
    });
  }

  function showStatus(text, isError = false) {
    const el = document.getElementById('thoughts-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', Boolean(isError));
    el.classList.toggle('success', !isError && Boolean(text));
  }

  function setupEventListeners() {
    const form = document.getElementById('thoughts-input-form');
    const input = document.getElementById('thoughts-text-input');
    const micBtn = document.getElementById('thoughts-mic-btn');
    const prevBtn = document.getElementById('thoughts-prev-day');
    const nextBtn = document.getElementById('thoughts-next-day');
    const datePicker = document.getElementById('thoughts-date-picker');
    const summarizeBtn = document.getElementById('thoughts-summarize-btn');
    const restructureBtn = document.getElementById('thoughts-restructure-btn');
    const syncDriveBtn = document.getElementById('thoughts-sync-drive-btn');
    const exportTxtBtn = document.getElementById('thoughts-export-txt-btn');
    const copyAllBtn = document.getElementById('thoughts-copy-all-btn');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input?.value || '';
        if (!text.trim()) return;
        addThought(text, { dateStr: currentDateStr });
        if (input) input.value = '';
        renderUI();
        showStatus('');
      });
    }

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          form?.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    }

    // Date navigation
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const d = new Date(currentDateStr + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        currentDateStr = d.toISOString().slice(0, 10);
        renderUI();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const d = new Date(currentDateStr + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        currentDateStr = d.toISOString().slice(0, 10);
        renderUI();
      });
    }

    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        if (e.target.value) {
          currentDateStr = e.target.value;
          renderUI();
        }
      });
    }

    // Speech / Microphone Toggle
    if (micBtn) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const isNative = () => Boolean(window.AttentionService?.isNative?.());
      let activeRecognition = null;
      let nativePollTimer = null;

      const getSpeechLang = () => {
        const lang = (window.I18n?.getLang?.() || document.documentElement.lang || 'en').toLowerCase();
        const map = { fr: 'fr-FR', de: 'de-DE', es: 'es-ES', en: 'en-US' };
        return map[lang] || `${lang}-${lang.toUpperCase()}`;
      };

      const resetMicBtn = () => {
        isRecording = false;
        if (nativePollTimer) {
          clearInterval(nativePollTimer);
          nativePollTimer = null;
        }
        activeRecognition = null;
        micBtn.classList.remove('listening');
        micBtn.innerHTML = '<i class="fas fa-microphone"></i> <span data-i18n="thoughts.speakBtn">' + t('thoughts.speakBtn') + '</span>';
      };

      micBtn.addEventListener('click', async () => {
        if (isRecording) {
          // Stop recording
          if (isNative()) {
            const res = await window.AttentionService.invokeNative('native_stop_speech', {});
            resetMicBtn();
            if (res?.transcript && input) {
              input.value = (input.value ? input.value + ' ' : '') + res.transcript;
              input.focus();
            }
          } else if (activeRecognition) {
            activeRecognition.stop();
          } else if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          resetMicBtn();
          return;
        }

        // Start recording
        isRecording = true;
        micBtn.classList.add('listening');
        micBtn.innerHTML = '<i class="fas fa-microphone fa-beat" style="color: #ef4444"></i> <span>' + t('thoughts.recording') + '</span>';
        showStatus(t('thoughts.recording'));

        // Strategy A: Native speech bridge (Android / Desktop app)
        if (isNative()) {
          await window.AttentionService.invokeNative('native_start_speech', { lang: getSpeechLang() });
          nativePollTimer = setInterval(async () => {
            const res = await window.AttentionService.invokeNative('native_poll_speech', {});
            if (!res) return;
            if (res.transcript && input) {
              input.value = res.transcript;
            }
            if (res.status === 'done') {
              resetMicBtn();
              if (res.transcript && input) {
                input.value = res.transcript;
                input.focus();
                showStatus('');
              }
            } else if (res.status === 'error') {
              resetMicBtn();
              showStatus(t('thoughts.voiceError', { error: res.error || 'unknown' }), true);
            }
          }, 250);
          return;
        }

        // Strategy B: Browser Web Speech API
        if (SpeechRecognition) {
          try {
            const recognition = new SpeechRecognition();
            activeRecognition = recognition;
            recognition.lang = getSpeechLang();
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onresult = (event) => {
              resetMicBtn();
              const transcript = event.results?.[0]?.[0]?.transcript;
              if (transcript && input) {
                input.value = (input.value ? input.value + ' ' : '') + transcript;
                input.focus();
                showStatus('');
              }
            };
            recognition.onerror = (e) => {
              resetMicBtn();
              const isDenied = e.error === 'not-allowed' || e.error === 'service-not-allowed';
              showStatus(isDenied ? t('thoughts.micDenied') : t('thoughts.voiceError', { error: e.error || 'unknown' }), true);
            };
            recognition.onend = resetMicBtn;
            recognition.start();
            return;
          } catch (err) {
            console.warn('Web Speech API failed, falling back to MediaRecorder:', err);
          }
        }

        // Strategy C: MediaRecorder + AI Whisper / Gemini Audio STT
        if (navigator.mediaDevices?.getUserMedia && window.AIAssistant?.transcribeAudio) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunks.push(e.data);
            };
            mediaRecorder.onstop = async () => {
              stream.getTracks().forEach(track => track.stop());
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              showStatus(t('thoughts.transcribing'));
              try {
                const transcript = await window.AIAssistant.transcribeAudio(audioBlob, {
                  language: window.I18n?.getLang?.() || 'en',
                });
                if (transcript && input) {
                  input.value = (input.value ? input.value + ' ' : '') + transcript;
                  input.focus();
                }
                showStatus('');
              } catch (err) {
                showStatus(t('thoughts.aiError', { error: err.message }), true);
              }
            };
            mediaRecorder.start();
            return;
          } catch (err) {
            resetMicBtn();
            showStatus(t('thoughts.micDenied'), true);
            return;
          }
        }

        resetMicBtn();
        showStatus(t('thoughts.voiceError', { error: 'Speech recognition not supported in this browser' }), true);
      });
    }

    // Summarize Day Button
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', async () => {
        const thoughts = getThoughtsForDate(currentDateStr);
        if (!thoughts.length) {
          showStatus(t('thoughts.empty'), true);
          return;
        }
        showStatus(t('thoughts.aiWorking'));
        try {
          const summary = await summarizeDay(currentDateStr);
          showAIResults(t('thoughts.summaryHeading'), summary);
          showStatus('');
        } catch (err) {
          showStatus(t('thoughts.aiError', { error: err.message }), true);
        }
      });
    }

    // Restructure Notes Button
    if (restructureBtn) {
      restructureBtn.addEventListener('click', async () => {
        const thoughts = getThoughtsForDate(currentDateStr);
        if (!thoughts.length) {
          showStatus(t('thoughts.empty'), true);
          return;
        }
        showStatus(t('thoughts.aiWorking'));
        try {
          const result = await restructureDay(currentDateStr);
          showAIRestructuredResults(result);
          showStatus('');
        } catch (err) {
          showStatus(t('thoughts.aiError', { error: err.message }), true);
        }
      });
    }

    // Sync to Google Drive Button
    if (syncDriveBtn) {
      syncDriveBtn.addEventListener('click', async () => {
        showStatus(t('thoughts.driveSyncing'));
        try {
          const res = await syncToDrive(currentDateStr, { interactive: true });
          const filename = `ADHD-Thoughts-${currentDateStr}.txt`;
          showStatus(t('thoughts.driveSynced', { file: filename }));
        } catch (err) {
          showStatus(t('thoughts.driveError', { error: err.message }), true);
        }
      });
    }

    // Export .txt Button (Local Download)
    if (exportTxtBtn) {
      exportTxtBtn.addEventListener('click', () => {
        const text = formatDayAsText(currentDateStr);
        const filename = `ADHD-Thoughts-${currentDateStr}.txt`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // Copy All Button
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', async () => {
        const text = formatDayAsText(currentDateStr);
        try {
          await navigator.clipboard.writeText(text);
          showStatus(t('thoughts.copied'));
          setTimeout(() => showStatus(''), 2500);
        } catch {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showStatus(t('thoughts.copied'));
          setTimeout(() => showStatus(''), 2500);
        }
      });
    }
  }

  function showAIResults(title, textContent) {
    let panel = document.getElementById('thoughts-ai-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'thoughts-ai-panel';
      panel.className = 'thoughts-ai-panel';
      const list = document.getElementById('thoughts-stream');
      list?.parentNode?.insertBefore(panel, list);
    }
    panel.innerHTML = `
      <div class="thoughts-ai-panel-header">
        <h4 class="thoughts-ai-panel-title"><i class="fas fa-brain"></i> ${title}</h4>
        <button type="button" class="close-btn" aria-label="Close" id="thoughts-ai-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="thoughts-ai-content">${escapeHTML(textContent)}</div>
    `;
    document.getElementById('thoughts-ai-close')?.addEventListener('click', () => {
      panel.remove();
    });
  }

  function showAIRestructuredResults(data) {
    let panel = document.getElementById('thoughts-ai-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'thoughts-ai-panel';
      panel.className = 'thoughts-ai-panel';
      const list = document.getElementById('thoughts-stream');
      list?.parentNode?.insertBefore(panel, list);
    }

    panel.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'thoughts-ai-panel-header';
    header.innerHTML = `
      <h4 class="thoughts-ai-panel-title"><i class="fas fa-magic"></i> ${t('thoughts.restructureHeading')}</h4>
      <button type="button" class="close-btn" aria-label="Close" id="thoughts-ai-close"><i class="fas fa-times"></i></button>
    `;
    panel.appendChild(header);

    if (data.overview) {
      const overview = document.createElement('div');
      overview.className = 'thoughts-ai-content';
      overview.textContent = data.overview;
      panel.appendChild(overview);
    }

    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'thoughts-ai-sections';

    // Render categorized sections
    if (Array.isArray(data.sections)) {
      data.sections.forEach(sec => {
        const card = document.createElement('div');
        card.className = 'thoughts-ai-section-card';
        const title = document.createElement('div');
        title.className = 'thoughts-ai-section-title';
        title.textContent = sec.title;
        card.appendChild(title);

        const ul = document.createElement('ul');
        ul.className = 'thoughts-ai-section-items';
        (sec.items || []).forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          ul.appendChild(li);
        });
        card.appendChild(ul);
        sectionsContainer.appendChild(card);
      });
    }

    // Render actionable tasks with one-click Add to Plan button
    if (Array.isArray(data.tasks) && data.tasks.length > 0) {
      const taskCard = document.createElement('div');
      taskCard.className = 'thoughts-ai-section-card';
      const taskTitle = document.createElement('div');
      taskTitle.className = 'thoughts-ai-section-title';
      taskTitle.innerHTML = '<i class="fas fa-clipboard-check"></i> ' + t('thoughts.addTaskAction');
      taskCard.appendChild(taskTitle);

      data.tasks.forEach(item => {
        const row = document.createElement('div');
        row.className = 'thoughts-ai-task-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'thoughts-ai-task-name';
        nameSpan.textContent = item.name + (item.estimatedMinutes ? ` (${item.estimatedMinutes} min)` : '');

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-secondary btn-compact';
        addBtn.textContent = t('thoughts.addTaskAction');
        addBtn.addEventListener('click', () => {
          if (window.TaskStore) {
            window.TaskStore.addTask({
              name: item.name,
              user: window.UserContext?.getActiveUser?.() || 'main',
              durationMinutes: item.estimatedMinutes || 25,
              importance: item.importance || 5,
              source: 'thoughts-ai',
            });
            window.EventBus?.dispatchEvent(new Event('dataChanged'));
            window.dispatchEvent(new Event('scheduleNeedsRefresh'));
            addBtn.className = 'btn btn-compact';
            addBtn.style.color = '#16a34a';
            addBtn.textContent = '✓ ' + t('thoughts.taskAdded');
            addBtn.disabled = true;
          }
        });

        row.appendChild(nameSpan);
        row.appendChild(addBtn);
        taskCard.appendChild(row);
      });

      sectionsContainer.appendChild(taskCard);
    }

    panel.appendChild(sectionsContainer);
    document.getElementById('thoughts-ai-close')?.addEventListener('click', () => {
      panel.remove();
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    renderUI();
  });

  window.addEventListener('thoughtsChanged', renderUI);
  window.addEventListener('languageChanged', renderUI);

  // Public API
  window.QuickThoughts = {
    STORAGE_KEY,
    getAllThoughts,
    getThoughtsForDate,
    addThought,
    deleteThought,
    formatDayAsText,
    syncToDrive,
    summarizeDay,
    restructureDay,
    convertThoughtToTask,
    renderUI,
  };
})();
