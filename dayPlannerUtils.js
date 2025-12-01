export function formatTime(h, m) {
    const period = h >= 12 ? 'PM' : 'AM';
    let hh = h % 12; if (hh === 0) hh = 12;
    return `${hh}:${m.toString().padStart(2, '0')} ${period}`;
}

export function populateTimeOptions(select) {
    select.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 5) {
            const opt = document.createElement('option');
            opt.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            opt.textContent = formatTime(h, m);
            select.appendChild(opt);
        }
    }
}

export function populateTaskOptions(select) {
    select.innerHTML = '<option value="">-- New Event --</option>';
    const tasks = window.DataManager.getTasks().filter(t => !t.plannerDate);
    tasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.text;
        select.appendChild(opt);
    });
}

export function getDefaultTime() {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    // Round up to the next 15 minutes for easier scheduling
    const rounded = Math.ceil(minutes / 15) * 15;
    const h = Math.floor(rounded / 60) % 24;
    const m = rounded % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getCalendarEvents(currentDate) {
    const events = JSON.parse(localStorage.getItem('adhd-calendar-events')) || [];
    const dayStr = currentDate.toISOString().slice(0, 10);
    return events
        .filter(ev => ev.start && ev.start.startsWith(dayStr))
        .map(ev => ({
            title: ev.title || '',
            start: ev.start.slice(11, 16),
            end: ev.end ? ev.end.slice(11, 16) : null
        }));
}
