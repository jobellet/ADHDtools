(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const currentEl = document.getElementById('today-current-task');
    const nextList = document.getElementById('today-next-list');
    const blockedList = document.getElementById('today-blocked-list');
    const blockedContainer = document.getElementById('today-blocked');
    const startBtn = document.getElementById('today-start-focus');
    const doneBtn = document.getElementById('today-mark-done');
    const skipBtn = document.getElementById('today-skip');

    if (!currentEl || !nextList) return;

    const scheduler = () => window.UnifiedScheduler || window.TaskScheduler;

    function formatTime(dateObj) {
      return dateObj?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
    }

    function updateView() {
      const sched = scheduler();
      if (!sched?.getTodaySchedule) return;
      const now = new Date();
      const schedule = sched.getTodaySchedule(now);
      const taskMap = new Map((window.TaskStore?.getAllTasks?.() || []).map(t => [t.hash, t]));
      const currentSlot = sched.getCurrentTask(now);
      const blocked = (window.TaskStore?.getPendingTasks?.() || []).filter(task => {
        if (!task.dependency) return false;
        const dep = taskMap.get(task.dependency);
        return dep && !dep.completed;
      });

      if (currentSlot) {
        currentEl.textContent = `${currentSlot.task.name || currentSlot.task.text || 'Task'} (${formatTime(currentSlot.startTime)} - ${formatTime(currentSlot.endTime)})`;
        currentEl.dataset.hash = currentSlot.task.hash || '';
      } else {
        currentEl.textContent = 'No active task right now.';
        currentEl.dataset.hash = '';
      }

      nextList.innerHTML = '';
      schedule
        .filter(slot => slot.startTime > now)
        .slice(0, 3)
        .forEach(slot => {
          const li = document.createElement('li');
          const dep = slot.task?.dependency ? taskMap.get(slot.task.dependency) : null;
          const blockedBadge = dep && !dep.completed ? ` (Blocked by ${dep.name || dep.text || 'dependency'})` : '';
          li.textContent = `${formatTime(slot.startTime)} – ${slot.task.name || slot.task.text || 'Task'}${blockedBadge}`;
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
    }

    function startFocus(taskName) {
      const goalInput = document.getElementById('focus-goal');
      if (goalInput) goalInput.value = taskName;
      document.getElementById('enter-focus-mode')?.click();
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const sched = scheduler();
        const slot = sched?.getCurrentTask ? sched.getCurrentTask(new Date()) : null;
        if (!slot) return alert('No current task to focus on.');
        startFocus(slot.task.name || slot.task.text || 'Focus');
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
      const choice = prompt('Skip options: end (end of day), tomorrow, or custom date/time (YYYY-MM-DD HH:MM)', 'end');
      if (!choice) return;
      const now = new Date();
      let plannerDate = null;
      if (choice.toLowerCase().startsWith('end')) {
        const end = new Date();
        end.setHours(22, 0, 0, 0);
        plannerDate = `${end.toISOString().slice(0, 10)}T${end.toISOString().slice(11, 16)}`;
      } else if (choice.toLowerCase().startsWith('tomorrow')) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        tomorrow.setHours(slot.startTime.getHours(), slot.startTime.getMinutes(), 0, 0);
        plannerDate = `${tomorrow.toISOString().slice(0, 10)}T${tomorrow.toISOString().slice(11, 16)}`;
      } else {
        const parts = choice.trim().split(' ');
        if (parts.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) && /^\d{2}:\d{2}$/.test(parts[1])) {
          plannerDate = `${parts[0]}T${parts[1]}`;
        }
      }

      if (!plannerDate) return alert('Unable to parse new time for skip/reschedule.');

      const ledgerSkip = window.UrgencyHelpers?.incrementSkipCount?.(slot.task.hash) || 0;
      const bumpedUrgency = Math.min(10, (slot.task.urgency || 5) + 1 + Math.min(ledgerSkip, 2));
      const urgency = window.UrgencyHelpers?.computeSmoothedUrgency?.({ ...slot.task, urgency: bumpedUrgency }) || bumpedUrgency;
      window.TaskStore.updateTaskByHash(slot.task.hash, { plannerDate, urgency });
      window.EventBus?.dispatchEvent(new Event('dataChanged'));
      updateView();
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
    setInterval(updateView, 60000);
    updateView();
  });
})();
