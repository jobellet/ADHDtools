document.addEventListener("DOMContentLoaded", () => {
    const toolSections = document.querySelectorAll(".tool-section");
    const navLinks = document.querySelectorAll("nav a[data-tool], #main-nav-links a[data-tool]");
    const currentTimeDisplay = document.getElementById("current-time-display");
    const userSelect = document.getElementById("active-user-select");
    const addUserBtn = document.getElementById("add-user-btn");

    // URL Routing Configuration
    // Dynamically support both GitHub Pages (/ADHDtools) and local development (/)
    const BASE_PATH = window.location.pathname.startsWith('/ADHDtools') ? '/ADHDtools' : '';

    // Handle Redirect from 404.html (GitHub Pages SPA Hack): 404.html sends
    // deep links (e.g. /ADHDtools/pomodoro) to index.html?redirect=/pomodoro.
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    if (redirectPath) {
        window.history.replaceState(null, '', BASE_PATH + redirectPath);
    }

    const TOOLS = {
        home: { slug: '', icon: 'home.svg', title: 'Now' },
        pomodoro: { slug: 'pomodoro', icon: 'pomodoro.svg', title: 'Pomodoro Timer' },
        planner: { slug: 'Day_Planner', icon: 'planner.svg', title: 'Day Planner' },
        calendar: { slug: 'calendar', icon: 'calendar.svg', title: 'Calendar' },
        breakdown: { slug: 'breakdown', icon: 'task-breakdown.svg', title: 'Task Breakdown' },
        habits: { slug: 'habits', icon: 'habit-tracker.svg', title: 'Habit Tracker' },
        routine: { slug: 'routine', icon: 'routine.svg', title: 'Routines' },
        focus: { slug: 'focus', icon: 'focus-mode.svg', title: 'Focus Mode' },
        rewards: { slug: 'rewards', icon: 'rewards.svg', title: 'Rewards' },
        settings: { slug: 'settings', icon: 'settings.svg', title: 'Settings' },
        about: { slug: 'about', icon: 'about.svg', title: 'About' },
    };

    const SLUG_TOOL_MAP = Object.entries(TOOLS).reduce((acc, [tool, { slug }]) => {
        acc[slug.toLowerCase()] = tool;
        return acc;
    }, { now: 'home' });

    // Auto mode: when the app opens on its root URL it shows the Now view while
    // something is running (or about to start) and the day planner otherwise,
    // and keeps following the schedule until the user navigates by hand.
    let autoMode = false;
    let currentTool = null;

    function getSlugFromUrl() {
        let slug = window.location.pathname.replace(/\/$/, '');
        if (slug.startsWith(BASE_PATH)) slug = slug.slice(BASE_PATH.length);
        return slug.replace(/^\//, '');
    }

    function updateUrl(toolName) {
        const slug = TOOLS[toolName]?.slug;
        if (slug === undefined) return;
        const newPath = slug ? `${BASE_PATH}/${slug}` : `${BASE_PATH}/`;
        if (window.location.pathname !== newPath) {
            history.pushState({ tool: toolName }, '', newPath);
        }
    }

    function updateAppIcon(toolName) {
        const iconPath = `icons/${TOOLS[toolName]?.icon || 'home.svg'}`;
        const favicon = document.getElementById('favicon');
        const appleIcon = document.getElementById('apple-touch-icon');
        if (favicon) favicon.href = iconPath;
        if (appleIcon) appleIcon.href = iconPath;
    }

    // Page title in the current language (nav labels are already translated).
    function toolTitle(toolName) {
        const key = { home: 'tab-now', routine: 'tab-routines' }[toolName] || `nav-${toolName}`;
        const text = window.I18n?.t(key, {}, TOOLS[toolName].title) || TOOLS[toolName].title;
        return text.replace(/<[^>]*>/g, '').trim();
    }

    function switchTool(toolName, updateHistory = true) {
        if (!document.getElementById(toolName) || !TOOLS[toolName]) {
            toolName = 'home';
        }
        const changed = toolName !== currentTool;
        currentTool = toolName;

        toolSections.forEach(section => section.classList.toggle("active", section.id === toolName));
        navLinks.forEach(link => link.classList.toggle("active", link.dataset.tool === toolName));
        // "More" is highlighted when one of its tools is open.
        const moreBtn = document.querySelector('.hamburger-menu');
        if (moreBtn) moreBtn.classList.toggle('active', !['home', 'planner', 'routine'].includes(toolName));
        document.body.dataset.tool = toolName;

        updateAppIcon(toolName);
        if (updateHistory) updateUrl(toolName);
        document.title = `${toolTitle(toolName)} - ADHD Tools Hub`;
        closeSheets();

        if (changed) {
            window.dispatchEvent(new CustomEvent('toolChanged', { detail: { tool: toolName } }));
            if (toolName === 'planner') window.DayPlanner?.scrollToCurrent?.();
        }
    }

    // Called by the Now view whenever the schedule state changes.
    function autoRoute(state) {
        if (!autoMode || !window.NowState) return;
        if (currentTool !== 'home' && currentTool !== 'planner') return;
        const target = window.NowState.defaultToolFor(state);
        if (target !== currentTool) switchTool(target, false);
    }

    function navigate(toolName) {
        autoMode = false;
        switchTool(toolName);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Handle browser back/forward
    window.addEventListener('popstate', (event) => {
        autoMode = false;
        const tool = event.state?.tool || SLUG_TOOL_MAP[getSlugFromUrl().toLowerCase()] || 'home';
        switchTool(tool, false);
    });

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-tool], [data-go-tool]');
        if (!link) return;
        e.preventDefault();
        navigate(link.dataset.tool || link.dataset.goTool);
    });

    // ----- Sheets (More menu, Add task) -----
    const sheets = {
        more: { el: document.getElementById('more-menu'), backdrop: document.getElementById('more-menu-backdrop') },
        capture: { el: document.getElementById('capture-sheet'), backdrop: document.getElementById('capture-sheet-backdrop') },
    };
    const hamburger = document.querySelector(".hamburger-menu");

    function openSheet(name) {
        closeSheets();
        const sheet = sheets[name];
        if (!sheet?.el) return;
        sheet.el.classList.remove('hidden');
        sheet.backdrop?.classList.remove('hidden');
        if (name === 'more') hamburger?.setAttribute('aria-expanded', 'true');
        const focusTarget = sheet.el.querySelector('input[type="text"]') || sheet.el.querySelector('a, button');
        setTimeout(() => focusTarget?.focus(), 50);
    }

    function closeSheets() {
        Object.values(sheets).forEach(({ el, backdrop }) => {
            el?.classList.add('hidden');
            backdrop?.classList.add('hidden');
        });
        hamburger?.setAttribute('aria-expanded', 'false');
    }

    hamburger?.addEventListener('click', () => {
        if (sheets.more.el?.classList.contains('hidden')) openSheet('more');
        else closeSheets();
    });
    document.getElementById('nav-add-btn')?.addEventListener('click', () => openSheet('capture'));
    Object.values(sheets).forEach(({ el, backdrop }) => {
        backdrop?.addEventListener('click', closeSheets);
        el?.querySelectorAll('[data-close-sheet]').forEach(btn => btn.addEventListener('click', closeSheets));
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSheets();
    });

    // ----- User profiles -----
    function renderUserOptions() {
        if (!userSelect || !window.UserContext) return;
        const active = window.UserContext.getActiveUser();
        const users = window.UserContext.getKnownUsers();
        if (!users.includes(active)) users.push(active);
        userSelect.innerHTML = '';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user;
            option.selected = user === active;
            userSelect.appendChild(option);
        });
    }

    if (userSelect) {
        userSelect.addEventListener('change', (e) => window.UserContext?.setActiveUser(e.target.value));
        window.addEventListener('activeUserChanged', renderUserOptions);
    }

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            const name = prompt('New user name');
            if (name) {
                window.UserContext?.setActiveUser(name.trim());
                renderUserOptions();
            }
        });
    }

    // ----- Clock -----
    function updateTime() {
        if (!currentTimeDisplay) return;
        currentTimeDisplay.textContent = new Date().toLocaleTimeString(document.documentElement.lang || undefined, { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateTime, 10000);
    updateTime();

    renderUserOptions();

    // ----- Initial view -----
    const initialSlug = getSlugFromUrl();
    const initialTool = SLUG_TOOL_MAP[initialSlug.toLowerCase()] || 'home';
    if (initialTool === 'home' && !initialSlug) {
        autoMode = true;
        // The scheduler is an ES module and may load after this script.
        const decide = () => autoRoute(window.NowState?.getState?.());
        switchTool('home', false);
        if (window.UnifiedScheduler) decide();
        else window.addEventListener('schedulerReady', decide, { once: true });
    } else {
        switchTool(initialTool, false);
    }

    window.addEventListener('languageChanged', () => {
        updateTime();
        if (currentTool && currentTool !== 'home') document.title = `${toolTitle(currentTool)} - ADHD Tools Hub`;
    });

    window.switchTool = navigate;
    window.AppRouter = { autoRoute, isAuto: () => autoMode, current: () => currentTool };
    window.AppSheets = { open: openSheet, close: closeSheets };
});
