document.addEventListener("DOMContentLoaded", () => {
    const toolCards = document.querySelectorAll(".tool-card");
    const toolSections = document.querySelectorAll(".tool-section");
    const navLinks = document.querySelectorAll("nav a[data-tool]");
    const currentTimeDisplay = document.getElementById("current-time-display");

    // URL Routing Configuration
    const BASE_PATH = '/ADHDtools'; // Adjust if deployed elsewhere

    // Handle Redirect from 404.html (GitHub Pages SPA Hack)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    if (redirectPath) {
        // Reconstruct the original URL
        const newPath = BASE_PATH + redirectPath;
        // Update the URL in the browser without reloading
        window.history.replaceState(null, '', newPath);
    }

    const TOOL_SLUG_MAP = {
        'home': '',
        'pomodoro': 'pomodoro',
        'eisenhower': 'eisenhower',
        'planner': 'Day_Planner',
        'calendar': 'calendar',
        'tasks': 'tasks',
        'breakdown': 'breakdown',
        'habits': 'habits',
        'routine': 'routine',
        'focus': 'focus',
        'rewards': 'rewards',
        'settings': 'settings',
        'about': 'about'
    };

    // Reverse map for lookup
    const SLUG_TOOL_MAP = Object.entries(TOOL_SLUG_MAP).reduce((acc, [tool, slug]) => {
        acc[slug.toLowerCase()] = tool;
        return acc;
    }, {});

    function getSlugFromUrl() {
        const path = window.location.pathname;
        // Remove trailing slash
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        // Remove base path
        let slug = cleanPath;
        if (cleanPath.startsWith(BASE_PATH)) {
            slug = cleanPath.slice(BASE_PATH.length);
        }
        // Remove leading slash
        if (slug.startsWith('/')) {
            slug = slug.slice(1);
        }
        return slug;
    }

    function updateUrl(toolName) {
        const slug = TOOL_SLUG_MAP[toolName];
        if (slug === undefined) return;

        const newPath = slug ? `${BASE_PATH}/${slug}` : `${BASE_PATH}/`;
        if (window.location.pathname !== newPath) {
            history.pushState({ tool: toolName }, '', newPath);
        }
    }

    function switchTool(toolName, updateHistory = true) {
        // Fallback to home if tool not found
        if (!document.getElementById(toolName)) {
            toolName = 'home';
        }

        toolSections.forEach(section => {
            section.classList.remove("active");
        });
        const activeSection = document.getElementById(toolName);
        if (activeSection) {
            activeSection.classList.add("active");
        }

        navLinks.forEach(link => {
            link.classList.toggle("active", link.dataset.tool === toolName);
        });

        if (updateHistory) {
            updateUrl(toolName);
        }

        // Update document title
        const titleMap = {
            'home': 'Home',
            'pomodoro': 'Pomodoro Timer',
            'eisenhower': 'Eisenhower Matrix',
            'planner': 'Day Planner',
            'calendar': 'Calendar',
            'tasks': 'Task Manager',
            'breakdown': 'Task Breakdown',
            'habits': 'Habit Tracker',
            'routine': 'Routine Tool',
            'focus': 'Focus Mode',
            'rewards': 'Rewards',
            'settings': 'Settings',
            'about': 'About'
        };
        document.title = `${titleMap[toolName] || 'Tool'} - ADHD Tools Hub`;
    }

    // Handle browser back/forward
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.tool) {
            switchTool(event.state.tool, false);
        } else {
            // Try to parse URL if state is missing (e.g. external link)
            const slug = getSlugFromUrl();
            const tool = SLUG_TOOL_MAP[slug.toLowerCase()] || 'home';
            switchTool(tool, false);
        }
    });

    toolCards.forEach(card => {
        card.addEventListener("click", () => {
            const toolName = card.dataset.tool;
            switchTool(toolName);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const toolName = link.dataset.tool;
            switchTool(toolName);

            // Close the mobile nav menu after selection
            if (mainNavLinks.classList.contains("nav-open")) {
                mainNavLinks.classList.remove("nav-open");
                hamburger.setAttribute("aria-expanded", false);
            }
        });
    });

    // Toggle hamburger menu
    const hamburger = document.querySelector(".hamburger-menu");
    const mainNavLinks = document.getElementById("main-nav-links");

    hamburger.addEventListener("click", () => {
        const expanded = hamburger.getAttribute("aria-expanded") === "true" || false;
        hamburger.setAttribute("aria-expanded", !expanded);
        mainNavLinks.classList.toggle("nav-open");
        // Don't switch to home on menu toggle, just toggle menu
    });

    // Update time display every second
    function updateTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
    }

    setInterval(updateTime, 1000);
    updateTime();

    // Initial Load
    const initialSlug = getSlugFromUrl();
    const initialTool = SLUG_TOOL_MAP[initialSlug.toLowerCase()] || 'home';
    switchTool(initialTool, false); // Don't push state on initial load, just replace if needed or do nothing
    // Actually, if the URL is clean, we don't need to push. 
    // If we landed on /ADHDtools/pomodoro, we just want to render pomodoro.
    // If we landed on /ADHDtools/, we render home.

    // Expose switchTool globally for CrossTool
    window.switchTool = switchTool;
});
