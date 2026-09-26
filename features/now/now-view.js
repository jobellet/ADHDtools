// features/now/now-view.js - the default "Now" screen and the day planner's helpers.
//
// Now view (#home): one thing at a time.
//   doing -> the current task / routine / event, a big countdown and 2-3 buttons
//   break -> a countdown to what starts next
//   free  -> nothing planned now; app.js opens the day planner by default
// Planner (#planner): a "now / next" strip on top and a deadlines panel to
// plan ahead and break big tasks into small steps.
//
// State comes from core/now-state.js on top of the unified scheduler, so
// routines (booked with their buffer), calendar events and tasks all appear here.

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const view = document.getElementById('now-view');
    if (!view) return;

    const el = {
      kicker: document.getElementById('now-kicker'),
      title: document.getElementById('now-title'),
      meta: document.getElementById('now-meta'),
      timer: document.getElementById('now-timer'),
      ring: document.getElementById('now-ring-fg'),
      timeLeft: document.getElementById('now-time-left'),
      timeLabel: document.getElementById('now-time-label'),
      steps: document.getElementById('now-steps'),
      actions: document.getElementById('now-actions'),
      skipChoices: document.getElementById('now-skip-choices'),
      nextList: document.getElementById('now-next-list'),
      planStrip: document.getElementById('plan-next-strip'),
      deadlines: document.getElementById('plan-deadlines'),
    };

    const RING_CIRCUMFERENCE = 2 * Math.PI * 90;
    const BIG_TASK_MINUTES = 45;
    let state = null;
    let renderedKey = '';
    let lastMode = null;

    const t = (key, vars) => (window.I18n ? window.I18n.t(key, vars) : key);
    const locale = () => document.documentElement.lang || undefined;
    const fmtClock = date => date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    const fmtDate = date => date.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
    const UNDO_MS = 15000;
    let lastDeleted = null; // { tasks, at } for the Undo bar
    const fmt = seconds => window.NowState.formatDuration(seconds);
    const isToolActive = id => document.getElementById(id)?.classList.contains('active');

    function kindOf(slot) {
      const source = slot?.task?.source;
      if (source === 'routine') return 'routine';
      if (source === 'calendar') return 'event';
      return 'task';
    }

    // [FIX] / [FLEX] tags steer the scheduler; they are noise on screen.
    function taskName(task) {
      const raw = task?.name || task?.text || 'Task';
      return raw.replace(/\[(FIX|FLEX)\]\s*/gi, '').trim() || raw;
    }

    function refreshAll() {
      window.EventBus?.dispatchEvent(new Event('dataChanged'));
      window.dispatchEvent(new Event('scheduleNeedsRefresh'));
    }

    function button(label, icon, className, onClick, title) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${className}`;
      btn.innerHTML = `<i class="fas ${icon}"></i> <span></span>`;
      btn.querySelector('span').textContent = label;
      if (title) btn.title = title;
      btn.addEventListener('click', onClick);
      return btn;
    }

    // ----- Actions -----

    // A flexible task is placed "from now" by the scheduler. Once it is the
    // current task we pin its start so the countdown is stable.
    function pinIfFlexible(slot) {
      const task = slot?.task;
      if (!task?.hash || kindOf(slot) !== 'task' || task.plannerDate || !window.TaskStore?.updateTaskByHash) return;
      const dateStr = window.UnifiedScheduler.localDateString(slot.startTime);
      window.TaskStore.updateTaskByHash(task.hash, {
        plannerDate: `${dateStr}T${fmtHHMM(slot.startTime)}`,
        autoPinned: true,
      });
    }

    function fmtHHMM(date) {
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function completeTask(slot) {
      if (!slot?.task?.hash || !window.TaskStore?.markComplete) return;
      window.TaskStore.markComplete(slot.task.hash);
      window.DataManager?.showNotification?.(t('now.toast.done', { name: taskName(slot.task) }));
      refreshAll();
    }

    function snoozeTask(slot, minutes) {
      window.TaskStore?.updateTaskByHash(slot.task.hash, {
        plannerDate: null,
        autoPinned: false,
        isFixed: false,
        snoozedUntil: new Date(Date.now() + minutes * 60000).toISOString(),
      });
      bumpUrgency(slot.task);
      refreshAll();
    }

    function moveToTomorrow(slot) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = window.UnifiedScheduler.localDateString(tomorrow);
      window.TaskStore?.updateTaskByHash(slot.task.hash, {
        plannerDate: `${dateStr}T${fmtHHMM(slot.startTime)}`,
        autoPinned: !slot.task.isFixed,
        snoozedUntil: null,
      });
      bumpUrgency(slot.task);
      refreshAll();
    }

    function bumpUrgency(task) {
      const skips = window.UrgencyHelpers?.incrementSkipCount?.(task.hash) || 0;
      const urgency = Math.min(10, (task.urgency || 5) + 1 + Math.min(skips, 2));
      window.TaskStore?.updateTaskByHash(task.hash, { urgency });
    }

    function sendToBreakdown(task) {
      window.EventBus?.dispatchEvent(new CustomEvent('ef-receiveTaskFor-TaskBreakdown', {
        detail: { text: taskName(task), id: task.hash, duration: task.durationMinutes },
      }));
      window.switchTool?.('breakdown');
    }

    function startFocus(slot) {
      const task = slot.task;
      const goalInput = document.getElementById('focus-goal');
      if (goalInput) goalInput.value = taskName(task);
      const minutesLeft = Math.max(1, Math.round((slot.endTime - Date.now()) / 60000));
      window.FocusTaskContext = { taskHash: task.hash, startedAt: Date.now(), durationMinutes: minutesLeft };
      document.getElementById('enter-focus-mode')?.click();
    }

    function skipRoutineToday(slot) {
      try {
        const runs = JSON.parse(localStorage.getItem('adhd-routine-runs') || '{}');
        runs[slot.task.routineId] = window.UnifiedScheduler.localDateString(new Date());
        localStorage.setItem('adhd-routine-runs', JSON.stringify(runs));
      } catch (err) {
        console.warn('Could not skip routine', err);
      }
      refreshAll();
    }

    // An event blocks its time like a task, but it is not work: the user may
    // want to push it back or to keep tasks running during it.
    function postponeEvent(slot, minutes) {
      const newStart = new Date(Date.now() + minutes * 60000);
      const moved = window.CalendarTool?.postponeEvent?.(slot.task.hash, newStart);
      if (moved) {
        window.DataManager?.showNotification?.(t('now.event.postponed', { name: taskName(slot.task), time: fmtClock(newStart) }));
      } else {
        window.DataManager?.showNotification?.(t('now.event.postponeFailed', { name: taskName(slot.task) }), 'error');
      }
      refreshAll();
    }

    function markEventNotATask(slot) {
      const changed = window.CalendarTool?.markEventPassive?.(slot.task.hash);
      if (changed) {
        window.DataManager?.showNotification?.(t('now.event.notATaskDone', { name: taskName(slot.task) }));
      } else {
        window.DataManager?.showNotification?.(t('now.event.notATaskFailed', { name: taskName(slot.task) }), 'error');
      }
      refreshAll();
    }

    function showEventChoices(slot) {
      const box = el.skipChoices;
      box.innerHTML = '';
      const label = document.createElement('p');
      label.textContent = t('now.event.prompt');
      box.appendChild(label);
      box.appendChild(button(t('now.event.later', { min: 15 }), 'fa-hourglass-half', 'btn-outline', () => postponeEvent(slot, 15)));
      box.appendChild(button(t('now.event.later', { min: 60 }), 'fa-hourglass-half', 'btn-outline', () => postponeEvent(slot, 60)));
      box.appendChild(button(t('now.event.notATask'), 'fa-calendar-day', 'btn-outline', () => markEventNotATask(slot), t('now.event.notATaskTitle')));
      box.appendChild(button(t('now.skip.cancel'), 'fa-times', 'btn-link', () => { box.hidden = true; }));
      box.hidden = false;
    }

    function showSkipChoices(slot) {
      const box = el.skipChoices;
      box.innerHTML = '';
      const label = document.createElement('p');
      label.textContent = t('now.skip.prompt');
      box.appendChild(label);
      box.appendChild(button(t('now.skip.later'), 'fa-hourglass-half', 'btn-outline', () => snoozeTask(slot, 60)));
      box.appendChild(button(t('now.skip.tomorrow'), 'fa-calendar-plus', 'btn-outline', () => moveToTomorrow(slot)));
      box.appendChild(button(t('now.skip.split'), 'fa-project-diagram', 'btn-outline', () => sendToBreakdown(slot.task)));
      box.appendChild(button(t('now.skip.cancel'), 'fa-times', 'btn-link', () => { box.hidden = true; }));
      box.hidden = false;
    }

    // ----- Rendering -----

    function setTimer(secondsLeft, totalSeconds, label, late = false) {
      el.timer.hidden = false;
      el.timer.classList.toggle('late', late);
      el.timeLeft.textContent = fmt(secondsLeft);
      el.timeLabel.textContent = label;
      const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
      el.ring.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
      el.ring.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - pct)}`;
    }

    function renderSteps(steps, activeIndex = -1) {
      el.steps.innerHTML = '';
      if (!steps?.length) {
        el.steps.hidden = true;
        return;
      }
      steps.forEach((step, i) => {
        const li = document.createElement('li');
        li.textContent = `${step.name} · ${t('unit.min', { n: step.duration })}`;
        if (i < activeIndex) li.classList.add('done');
        if (i === activeIndex) li.classList.add('active');
        el.steps.appendChild(li);
      });
      el.steps.hidden = false;
    }

    function renderDoing(slot) {
      const kind = kindOf(slot);
      const task = slot.task;
      view.dataset.kind = kind;
      el.kicker.textContent = t(kind === 'routine' ? 'now.kicker.routine' : kind === 'event' ? 'now.kicker.event' : 'now.kicker.now');
      el.title.textContent = taskName(task);
      el.meta.textContent = `${fmtClock(slot.startTime)} – ${fmtClock(slot.endTime)}`;
      el.actions.innerHTML = '';
      el.skipChoices.hidden = true;

      if (kind === 'routine') {
        const running = window.RoutinePlayer?.getState?.();
        const isThisRunning = running && running.routineId === task.routineId;
        el.meta.textContent += ` · ${t('now.stepsBuffer', { min: task.stepsMinutes })}`;
        renderSteps(task.steps, isThisRunning ? running.stepIndex : -1);
        if (isThisRunning) {
          el.actions.append(
            button(t('now.btn.showRoutine'), 'fa-expand', 'btn-primary btn-large', () => window.RoutinePlayer.show()),
            button(t('now.btn.stepDone'), 'fa-check', 'btn-secondary btn-large', () => window.manualAdvanceTask?.()),
          );
        } else {
          el.actions.append(
            button(t('now.btn.startRoutine'), 'fa-play', 'btn-primary btn-large', () => window.RoutinePlayer?.start(task.routineId)),
            button(t('now.btn.editSteps'), 'fa-pen', 'btn-outline', () => { window.switchTool?.('routine'); window.RoutinePlayer?.edit(task.routineId); }),
            button(t('now.btn.skipToday'), 'fa-forward', 'btn-outline', () => skipRoutineToday(slot)),
          );
        }
        return;
      }

      el.steps.hidden = true;
      if (kind === 'event') {
        el.actions.append(
          button(t('now.btn.seeDay'), 'fa-calendar-day', 'btn-outline btn-large', () => window.switchTool?.('planner')),
          button(t('now.btn.editEvent'), 'fa-pen', 'btn-outline btn-large', () => showEventChoices(slot)),
        );
        return;
      }

      const bits = [];
      if (task.deadline) bits.push(formatDue(task.deadline));
      if (task.importance >= 8) bits.push(t('now.important'));
      if (bits.length) el.meta.textContent += ` · ${bits.join(' · ')}`;
      el.actions.append(
        button(t('now.btn.done'), 'fa-check', 'btn-primary btn-large', () => completeTask(slot)),
        button(t('now.btn.focus'), 'fa-expand', 'btn-secondary btn-large', () => startFocus(slot), t('now.btn.focusTitle')),
        button(t('now.btn.notNow'), 'fa-forward', 'btn-outline btn-large', () => showSkipChoices(slot)),
      );
    }

    function renderBreak(next) {
      view.dataset.kind = kindOf(next);
      el.kicker.textContent = t('now.kicker.break');
      el.title.textContent = t('now.break.title', { name: taskName(next.task) });
      el.meta.textContent = t('now.break.meta', { time: fmtClock(next.startTime) });
      renderSteps(kindOf(next) === 'routine' ? next.task.steps : null);
      el.actions.innerHTML = '';
      el.skipChoices.hidden = true;
      if (kindOf(next) === 'routine') {
        el.actions.append(button(t('now.btn.startNow'), 'fa-play', 'btn-primary btn-large', () => window.RoutinePlayer?.start(next.task.routineId)));
      }
    }

    function renderFree(next) {
      view.dataset.kind = 'free';
      el.kicker.textContent = t('now.kicker.free');
      el.title.textContent = t('now.free.title');
      el.meta.textContent = next
        ? t('now.free.next', { name: taskName(next.task), time: fmtClock(next.startTime) })
        : t('now.free.clear');
      el.timer.hidden = true;
      el.steps.hidden = true;
      el.skipChoices.hidden = true;
      el.actions.innerHTML = '';
      el.actions.append(
        button(t('now.btn.planDay'), 'fa-calendar-day', 'btn-primary btn-large', () => window.switchTool?.('planner')),
        button(t('now.btn.addTask'), 'fa-plus', 'btn-outline btn-large', () => window.AppSheets?.open('capture')),
      );
    }

    function renderNextList() {
      el.nextList.innerHTML = '';
      const items = state?.upcoming || [];
      if (!items.length) {
        const li = document.createElement('li');
        li.className = 'now-next-empty';
        li.textContent = t('now.next.empty');
        el.nextList.appendChild(li);
        return;
      }
      items.forEach(slot => {
        const li = document.createElement('li');
        li.className = `now-next-item kind-${kindOf(slot)}`;
        const time = document.createElement('span');
        time.className = 'now-next-time';
        time.textContent = fmtClock(slot.startTime);
        const name = document.createElement('span');
        name.className = 'now-next-name';
        name.textContent = taskName(slot.task);
        const len = document.createElement('span');
        len.className = 'now-next-len';
        len.textContent = t('unit.min', { n: Math.round((slot.endTime - slot.startTime) / 60000) });
        li.append(time, name, len);
        el.nextList.appendChild(li);
      });
    }

    function renderPlanStrip() {
      const strip = el.planStrip;
      if (!strip) return;
      strip.innerHTML = '';
      const slot = state?.current || state?.next;
      if (!slot) {
        strip.hidden = true;
        return;
      }
      strip.hidden = false;
      strip.dataset.mode = state.mode;
      const text = document.createElement('span');
      text.className = 'plan-next-text';
      const label = t(state.current ? 'strip.now' : state.mode === 'break' ? 'strip.soon' : 'strip.next');
      text.innerHTML = `<strong></strong> <span class="plan-next-name"></span> <span class="plan-next-time"></span>`;
      text.querySelector('strong').textContent = label;
      text.querySelector('.plan-next-name').textContent = taskName(slot.task);
      text.querySelector('.plan-next-time').dataset.role = 'strip-time';
      strip.appendChild(text);
      if (state.mode !== 'free') {
        strip.appendChild(button(t('strip.open'), 'fa-stopwatch', 'btn-primary btn-sm', () => window.switchTool?.('home')));
      }
      tickStrip();
    }

    function tickStrip() {
      const timeEl = el.planStrip?.querySelector('[data-role="strip-time"]');
      if (!timeEl || !state) return;
      const now = new Date();
      if (state.current) timeEl.textContent = t('strip.left', { time: fmt((state.current.endTime - now) / 1000) });
      else if (state.next) timeEl.textContent = state.mode === 'break'
        ? t('strip.startsIn', { time: fmt((state.next.startTime - now) / 1000) })
        : t('strip.at', { time: fmtClock(state.next.startTime) });
    }

    // ----- Deadlines panel (plan ahead, break big tasks down) -----

    // "due tomorrow 17:00", "overdue since 19 Aug"… in the current language.
    function formatDue(deadline) {
      const due = new Date(deadline);
      if (Number.isNaN(due.getTime())) return t('due.on', { when: deadline });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDay = new Date(due);
      dueDay.setHours(0, 0, 0, 0);
      const days = Math.round((dueDay - today) / 86400000);
      const time = deadline.length > 10 ? ` ${fmtClock(due)}` : '';
      if (due < new Date()) return t('due.overdue', { date: fmtDate(due) });
      if (days === 0) return t('due.on', { when: `${t('due.today')}${time}` });
      if (days === 1) return t('due.on', { when: `${t('due.tomorrow')}${time}` });
      if (days < 7) return t('due.on', { when: `${due.toLocaleDateString(locale(), { weekday: 'long' })}${time}` });
      return t('due.on', { when: fmtDate(due) });
    }

    function deleteTasks(tasks) {
      if (!tasks.length || !window.TaskStore?.deleteTasks) return;
      const removed = window.TaskStore.deleteTasks(tasks.map(task => task.hash));
      lastDeleted = { tasks: removed, at: Date.now() };
      setTimeout(() => {
        if (lastDeleted && Date.now() - lastDeleted.at >= UNDO_MS) {
          lastDeleted = null;
          renderDeadlines();
        }
      }, UNDO_MS + 50);
      refreshAll();
    }

    function undoDelete() {
      if (!lastDeleted) return;
      window.TaskStore?.undeleteTasks?.(lastDeleted.tasks);
      lastDeleted = null;
      refreshAll();
    }

    function renderDeadlines() {
      const box = el.deadlines;
      if (!box) return;
      const now = new Date();
      const user = window.UserContext?.getActiveUser?.();
      // Calendar copies and all-day items are appointments, not work to plan.
      const isAppointment = task => window.TaskModel?.isPassiveOrAllDay?.(task);
      const pending = (window.TaskStore?.getPendingTasks?.() || [])
        .filter(task => (!user || task.user === user) && !isAppointment(task));
      const overdue = window.TaskStore?.getOverdueTasks?.(now, user) || [];
      const withDeadline = pending
        // A fixed appointment's time is not a deadline to plan for, unless it is overdue.
        .filter(task => task.deadline && (overdue.includes(task)
          || !(task.plannerDate && (task.isFixed || task.deadline.slice(0, 16) === task.plannerDate.slice(0, 16)))))
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      const big = pending
        .filter(task => !withDeadline.includes(task) && (task.needsBreakdown || Number(task.durationMinutes) > BIG_TASK_MINUTES));
      const all = [...withDeadline, ...big];
      const items = all.slice(0, 10);

      // Open on large screens; on phones it starts closed. The user's choice sticks.
      const wasOpen = box.querySelector('details')?.open;
      box.innerHTML = '';
      const details = document.createElement('details');
      details.open = wasOpen ?? window.matchMedia('(min-width: 769px)').matches;
      const summary = document.createElement('summary');
      summary.innerHTML = '<i class="fas fa-flag-checkered"></i> <span></span> <span class="count"></span>';
      summary.querySelector('span').textContent = t('plan.ahead');
      summary.querySelector('.count').textContent = String(all.length);
      details.appendChild(summary);
      box.appendChild(details);
      const hint = document.createElement('p');
      hint.className = 'plan-deadlines-hint';
      hint.textContent = t('plan.hint');
      details.appendChild(hint);

      if (lastDeleted && Date.now() - lastDeleted.at < UNDO_MS) {
        const bar = document.createElement('div');
        bar.className = 'plan-undo-bar';
        bar.setAttribute('role', 'status');
        const text = document.createElement('span');
        text.textContent = t('plan.deleted', { n: lastDeleted.tasks.length });
        bar.append(text, button(t('plan.undo'), 'fa-undo', 'btn-outline btn-sm', undoDelete));
        details.appendChild(bar);
      }

      if (overdue.length) {
        details.appendChild(button(t('plan.deleteOverdue', { n: overdue.length }), 'fa-trash-alt', 'btn-danger-outline btn-sm plan-delete-overdue', () => deleteTasks(overdue)));
      }

      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'plan-deadlines-empty';
        empty.textContent = t('plan.empty');
        details.appendChild(empty);
        return;
      }

      const list = document.createElement('ul');
      list.className = 'plan-deadline-list';
      items.forEach(task => {
        const li = document.createElement('li');
        li.className = `plan-deadline-item${overdue.includes(task) ? ' overdue' : ''}`;
        const info = document.createElement('div');
        info.className = 'plan-deadline-info';
        const name = document.createElement('span');
        name.className = 'plan-deadline-name';
        name.textContent = taskName(task);
        const meta = document.createElement('span');
        meta.className = 'plan-deadline-meta';
        const parts = [];
        if (task.deadline) parts.push(formatDue(task.deadline));
        parts.push(t('unit.min', { n: task.durationMinutes || '?' }));
        if (task.plannerDate && task.plannerDate.length >= 16) {
          const planned = new Date(task.plannerDate);
          parts.push(t('plan.planned', { date: `${fmtDate(planned)} ${fmtClock(planned)}` }));
        }
        meta.textContent = parts.join(' · ');
        info.append(name, meta);
        li.appendChild(info);
        const actions = document.createElement('div');
        actions.className = 'plan-deadline-actions';
        if (task.needsBreakdown || Number(task.durationMinutes) > 30) {
          actions.appendChild(button(t('plan.split'), 'fa-project-diagram', 'btn-outline btn-sm', () => sendToBreakdown(task), t('plan.splitTitle')));
        }
        const del = button('', 'fa-trash-alt', 'btn-icon-danger btn-sm', () => deleteTasks([task]), t('plan.delete'));
        del.setAttribute('aria-label', `${t('plan.delete')}: ${taskName(task)}`);
        actions.appendChild(del);
        li.appendChild(actions);
        list.appendChild(li);
      });
      details.appendChild(list);
      if (all.length > items.length) {
        const more = document.createElement('p');
        more.className = 'plan-deadlines-more';
        more.textContent = t('plan.more', { n: all.length - items.length });
        details.appendChild(more);
      }
    }

    // ----- Main loop -----

    function computeState() {
      if (!window.NowState?.getState) return;
      state = window.NowState.getState(new Date());
      if (!state) return;

      if (state.current) pinIfFlexible(state.current);
      maybeAutoStartRoutine();

      const key = [
        state.mode,
        state.current?.task?.hash, state.current?.startTime?.getTime(), state.current?.endTime?.getTime(),
        state.next?.task?.hash, state.next?.startTime?.getTime(),
        state.upcoming.map(s => `${s.task.hash}@${s.startTime.getTime()}`).join(','),
        window.RoutinePlayer?.runningRoutineId?.() || '',
      ].join('|');
      if (key !== renderedKey) {
        renderedKey = key;
        view.dataset.mode = state.mode;
        if (state.mode === 'doing') renderDoing(state.current);
        else if (state.mode === 'break') renderBreak(state.next);
        else renderFree(state.next);
        renderNextList();
        renderPlanStrip();
      }
      tick();

      if (state.mode !== lastMode) {
        lastMode = state.mode;
        window.AppRouter?.autoRoute?.(state);
      }
    }

    function maybeAutoStartRoutine() {
      const cfg = window.ConfigManager?.getConfig?.() || {};
      const slot = state?.current;
      if (!cfg.contextAutoSwitch || kindOf(slot) !== 'routine' || window.RoutinePlayer?.isRunning?.()) return;
      const key = `adhd-routine-autostarted:${slot.task.hash}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch { /* storage blocked: start anyway, once per page load */ }
      window.RoutinePlayer?.start(slot.task.routineId);
    }

    // Every second: countdowns only (no schedule work).
    function tick() {
      if (!state) return;
      const now = new Date();
      if (state.mode === 'doing' && state.current) {
        const running = window.RoutinePlayer?.getState?.();
        if (kindOf(state.current) === 'routine' && running && running.routineId === state.current.task.routineId) {
          el.title.textContent = running.stepName || taskName(state.current.task);
          el.kicker.textContent = t('now.kicker.step', { routine: running.name.toUpperCase(), n: Math.min(running.stepIndex + 1, running.stepCount), total: running.stepCount });
          setTimer(Math.abs(running.secondsLeft), running.stepSeconds, t(running.secondsLeft < 0 ? 'now.timer.over' : 'now.timer.stepLeft'), running.secondsLeft < 0);
        } else {
          const left = (state.current.endTime - now) / 1000;
          setTimer(left, (state.current.endTime - state.current.startTime) / 1000, t('now.timer.left'));
        }
        if (isToolActive('home')) document.title = `${fmt((state.current.endTime - now) / 1000)} · ${taskName(state.current.task)}`;
      } else if (state.mode === 'break' && state.next) {
        const until = (state.next.startTime - now) / 1000;
        setTimer(until, (Number(window.ConfigManager?.getConfig?.().breakWindowMinutes) || 15) * 60, t('now.timer.until'));
        if (isToolActive('home')) document.title = t('now.doc.break', { name: taskName(state.next.task), time: fmt(until) });
      }
      tickStrip();
      // Slot boundary passed: recompute right away instead of waiting.
      if ((state.current && now >= state.current.endTime) || (state.next && now >= state.next.startTime)) {
        computeState();
      }
    }

    let tickCount = 0;
    setInterval(() => {
      tickCount += 1;
      if (tickCount % 20 === 0) computeState();
      else tick();
    }, 1000);

    const recompute = () => {
      renderedKey = '';
      computeState();
      renderDeadlines();
    };
    window.EventBus?.addEventListener('dataChanged', recompute);
    window.EventBus?.addEventListener('calendarEventsUpdated', recompute);
    ['scheduleNeedsRefresh', 'routinesChanged', 'routinePlayerChanged', 'activeUserChanged', 'configUpdated', 'languageChanged'].forEach(name => {
      window.addEventListener(name, recompute);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) recompute();
    });
    window.addEventListener('toolChanged', tick);

    if (window.UnifiedScheduler) recompute();
    else window.addEventListener('schedulerReady', recompute, { once: true });
  });
})();
