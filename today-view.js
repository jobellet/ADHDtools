(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const currentEl = document.getElementById('today-current-task');
    const nextList = document.getElementById('today-next-list');
    const blockedList = document.getElementById('today-blocked-list');
    const blockedContainer = document.getElementById('today-blocked');
    const familyContainer = document.getElementById('family-overview');
    const startBtn = document.getElementById('today-start-focus');
    const doneBtn = document.getElementById('today-mark-done');
    const skipBtn = document.getElementById('today-skip');

    if (!currentEl || !nextList) return;

    const scheduler = () => window.UnifiedScheduler || window.TaskScheduler;

    function formatTime(dateObj) {
      return dateObj?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
    }

    function updateView() {
      const activeUser = window.UserContext?.getActiveUser?.();
      const sched = scheduler();
      if (!sched?.getTodaySchedule) return;
      const now = new Date();
      const schedule = sched.getTodaySchedule(now);
      const allTasks = window.TaskStore?.getAllTasks?.() || [];
      const visibleTasks = activeUser ? allTasks.filter(t => t.user === activeUser) : allTasks;
      const taskMap = new Map(visibleTasks.map(t => [t.hash, t]));
      const currentSlot = sched.getCurrentTask(now);
      const pendingSource = window.TaskStore?.getPendingTasks?.() || [];
      const pendingTasks = activeUser ? pendingSource.filter(t => t.user === activeUser) : pendingSource;
      const blocked = pendingTasks.filter(task => {
        if (!task.dependency) return false;
        const dep = taskMap.get(task.dependency);
        return dep && !dep.completed;
      });

      const fallbackSorted = [...pendingTasks]
        .filter(t => !blocked.includes(t))
        .sort((a, b) => ((b.importance || 5) + (b.urgency || 5)) - ((a.importance || 5) + (a.urgency || 5)));

      if (currentSlot) {
        currentEl.textContent = `${currentSlot.task.name || currentSlot.task.text || 'Task'} (${formatTime(currentSlot.startTime)} - ${formatTime(currentSlot.endTime)})`;
        currentEl.dataset.hash = currentSlot.task.hash || '';
      } else if (schedule.length) {
        currentEl.textContent = 'No active task right now.';
        currentEl.dataset.hash = '';
      } else if (fallbackSorted.length) {
        const first = fallbackSorted[0];
        currentEl.textContent = `Next up: ${first.name || first.text}`;
        currentEl.dataset.hash = first.hash || '';
      } else {
        currentEl.textContent = 'No active task right now.';
        currentEl.dataset.hash = '';
      }

      nextList.innerHTML = '';
      const futureSlots = schedule.filter(slot => slot.startTime > now);
      const upcoming = futureSlots.length ? futureSlots : fallbackSorted.slice(0, 3).map(task => ({
        task,
        startTime: task.plannerDate ? new Date(task.plannerDate) : null,
      }));
      upcoming
        .slice(0, 3)
        .forEach(slot => {
          const li = document.createElement('li');
          const dep = slot.task?.dependency ? taskMap.get(slot.task.dependency) : null;
          const blockedBadge = dep && !dep.completed ? ` (Blocked by ${dep.name || dep.text || 'dependency'})` : '';
          const timeLabel = slot.startTime ? formatTime(slot.startTime) + ' – ' : '';
          li.textContent = `${timeLabel}${slot.task.name || slot.task.text || 'Task'}${blockedBadge}`;
          nextList.appendChild(li);
        });

      if (blockedContainer && blockedList) {
        blockedList.innerHTML = '';
        if (!blocked.length) {
          blockedContainer.style.display = 'none';
        } else {
          blockedContainer.style.display = 'block';
          blocked.forEach(task => {
            const li = document.createElement('li');
            const dep = window.TaskStore?.getTaskByHash?.(task.dependency);
            li.textContent = `${task.name} – blocked by ${dep?.name || 'another task'}`;
            blockedList.appendChild(li);
          });
        }
      }

      if (familyContainer) {
        familyContainer.innerHTML = '<h3>Family Overview</h3>';
        const users = window.UserContext?.getKnownUsers?.() || [];
        const pending = window.TaskStore?.getPendingTasks?.() || [];
        if (!users.length) {
          familyContainer.innerHTML += '<p class="muted">No other profiles yet.</p>';
        } else {
          users.forEach(user => {
            const userTasks = pending.filter(t => t.user === user);
            const nowIso = new Date().toISOString().slice(0, 10);
            const current = userTasks.find(t => t.plannerDate && t.plannerDate.startsWith(nowIso));
            const upcoming = userTasks
              .filter(t => !t.completed)
              .sort((a, b) => ((b.importance || 5) + (b.urgency || 5)) - ((a.importance || 5) + (a.urgency || 5)))[0];
            const card = document.createElement('div');
            card.className = 'family-card';
            card.innerHTML = `<strong>${user}</strong><br>Current: ${current?.name || 'None'}<br>Next: ${upcoming?.name || 'None'}`;
            familyContainer.appendChild(card);
          });
        }
      }
    }

    function startFocus(taskName, taskHash, durationMinutes) {
      const goalInput = document.getElementById('focus-goal');
      if (goalInput) goalInput.value = taskName;
      window.FocusTaskContext = { taskHash, startedAt: Date.now(), durationMinutes };
      document.getElementById('enter-focus-mode')?.click();
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const sched = scheduler();
        const slot = sched?.getCurrentTask ? sched.getCurrentTask(new Date()) : null;
        if (!slot) return alert('No current task to focus on.');
        startFocus(slot.task.name || slot.task.text || 'Focus', slot.task.hash, slot.task.durationMinutes);
      });
    }

    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        const hash = currentEl.dataset.hash;
        if (!hash || !window.TaskStore?.markComplete) return;
        window.TaskStore.markComplete(hash);
        window.EventBus?.dispatchEvent(new Event('dataChanged'));
        updateView();
      });
    }

    function applySkip(slot) {
      const choice = prompt('Skip options: "end" (end of day), "tomorrow", "custom" (YYYY-MM-DD HH:MM)', 'end');
      if (!choice) return;
      const now = new Date();
      let plannerDate = null;
      if (choice.toLowerCase().startsWith('end')) {
        const end = new Date();
        end.setHours(22, 0, 0, 0);
        plannerDate = `${end.toISOString().slice(0, 10)}T${end.toISOString().slice(11, 16)}`;
      } else if (choice.toLowerCase().startsWith('tomorrow')) {
        const base = slot.startTime || now;
        const tomorrow = new Date(base.getTime() + 24 * 60 * 60 * 1000);
        tomorrow.setHours(base.getHours(), base.getMinutes(), 0, 0);
        plannerDate = `${tomorrow.toISOString().slice(0, 10)}T${tomorrow.toISOString().slice(11, 16)}`;
      } else {
        const parts = choice.trim().split(' ');
        if (parts.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) && /^\d{2}:\d{2}$/.test(parts[1])) {
          plannerDate = `${parts[0]}T${parts[1]}`;
        }
      }

      if (!plannerDate) return alert('Unable to parse new time for skip/reschedule.');

      // Dependency safety: don't move before dependency deadline/planner
      if (slot.task.dependency) {
        const dep = window.TaskStore?.getTaskByHash?.(slot.task.dependency);
        if (dep && !dep.completed) {
          const depDate = dep.plannerDate ? new Date(dep.plannerDate) : dep.deadline ? new Date(dep.deadline) : null;
          if (depDate && depDate > new Date(plannerDate)) {
            const moveDep = confirm('This would schedule before its dependency. Move dependency earlier as well?');
            if (!moveDep) return;
            const depPlanner = `${plannerDate.slice(0, 10)}T${(depDate.toISOString().slice(11,16) || '08:00')}`;
            window.TaskStore.updateTaskByHash(dep.hash, { plannerDate: depPlanner, deadline: dep.deadline || depPlanner });
          }
        }
      }

      const ledgerSkip = window.UrgencyHelpers?.incrementSkipCount?.(slot.task.hash) || 0;
      const bumpedUrgency = Math.min(10, (slot.task.urgency || 5) + 1 + Math.min(ledgerSkip, 2));
      const urgency = window.UrgencyHelpers?.computeSmoothedUrgency?.({ ...slot.task, urgency: bumpedUrgency }) || bumpedUrgency;
      window.TaskStore.updateTaskByHash(slot.task.hash, { plannerDate, deadline: plannerDate, urgency });
      window.EventBus?.dispatchEvent(new Event('dataChanged'));
      updateView();
      window.dispatchEvent(new Event('scheduleNeedsRefresh'));
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        const sched = scheduler();
        const slot = sched?.getCurrentTask ? sched.getCurrentTask(new Date()) : null;
        if (!slot || !slot.task?.hash || !window.TaskStore?.updateTaskByHash) return;
        applySkip(slot);
      });
    }

    window.EventBus?.addEventListener('dataChanged', updateView);
    window.addEventListener('activeUserChanged', updateView);
    setInterval(updateView, 60000);
    updateView();
  });
})();
