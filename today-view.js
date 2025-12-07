(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const currentEl = document.getElementById('today-current-task');
    const nextList = document.getElementById('today-next-list');
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
      const currentSlot = sched.getCurrentTask(now);

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
          li.textContent = `${formatTime(slot.startTime)} – ${slot.task.name || slot.task.text || 'Task'}`;
          nextList.appendChild(li);
        });
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

    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        const sched = scheduler();
        const slot = sched?.getCurrentTask ? sched.getCurrentTask(new Date()) : null;
        if (!slot || !slot.task?.hash || !window.TaskStore?.updateTaskByHash) return;
        const newUrgency = Math.min(10, Number(slot.task.urgency || 5) + 2);
        const newStart = new Date(slot.endTime.getTime() + 60 * 60000);
        const plannerDate = `${newStart.toISOString().slice(0, 10)}T${newStart.toISOString().slice(11, 16)}`;
        window.TaskStore.updateTaskByHash(slot.task.hash, { plannerDate, urgency: newUrgency });
        window.EventBus?.dispatchEvent(new Event('dataChanged'));
        updateView();
      });
    }

    window.EventBus?.addEventListener('dataChanged', updateView);
    setInterval(updateView, 60000);
    updateView();
  });
})();
