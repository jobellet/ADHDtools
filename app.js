document.addEventListener("DOMContentLoaded", () => {
    const toolCards = document.querySelectorAll(".tool-card");
    const toolSections = document.querySelectorAll(".tool-section");
    const navLinks = document.querySelectorAll("nav a[data-tool]");
    const currentTimeDisplay = document.getElementById("current-time-display");

    function switchTool(toolName) {
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
    }

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
        });
    });


    // Toggle hamburger menu
    const hamburger = document.querySelector(".hamburger-menu");
    const mainNavLinks = document.getElementById("main-nav-links");

    hamburger.addEventListener("click", () => {
        const expanded = hamburger.getAttribute("aria-expanded") === "true" || false;
        hamburger.setAttribute("aria-expanded", !expanded);
        mainNavLinks.classList.toggle("show");
        switchTool("home");
    });

    const backendBtn = document.getElementById("open-colab-backend");
    if (backendBtn) {
        backendBtn.addEventListener("click", () => {
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                try {
                    data[key] = JSON.parse(localStorage.getItem(key));
                } catch {
                    data[key] = localStorage.getItem(key);
                }
            }
            const encoded = encodeURIComponent(JSON.stringify(data));
            const url =
                "https://colab.research.google.com/github/jobellet/ADHDtools/blob/main/website_backend.ipynb" +
                `?filename=webdata.json&action=write&data=${encoded}`;
            window.open(url, "_blank");
        });
    }

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
});
