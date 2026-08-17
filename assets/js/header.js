(() => {
  const root = document.documentElement;
  const currentPath = normalizePath(window.location.pathname);

  const navItems = [
    { key: "games", label: "Games", href: "/games/" },
    { key: "tools", label: "Tools", href: "/tools/" },
    { key: "projects", label: "Projects", href: "/projects/" },
    { key: "downloads", label: "Downloads", href: "/downloads/" },
  ];

  const header = document.querySelector(".site-header");
  if (!header) {
    return;
  }

  const activeKey = getActiveSection(currentPath);

  header.innerHTML = `
    <nav class="navbar" aria-label="Primary navigation">
      <a class="brand" href="/" aria-label="BBFRAXY home">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span>BBFRAXY</span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open navigation">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-menu" id="site-menu">
        <div class="nav-links" aria-label="Site sections">
          ${navItems.map((item) => `<a href="${item.href}" data-i18n="nav.${item.key}"${item.key === activeKey ? ' aria-current="page"' : ""}>${item.label}</a>`).join("")}
        </div>
        <div class="nav-actions">
          <button class="icon-button theme-toggle" type="button" aria-label="Switch theme" aria-pressed="false">
            <span class="theme-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </nav>
  `;

  const menuToggle = header.querySelector(".menu-toggle");
  const navMenu = header.querySelector("#site-menu");
  const themeToggle = header.querySelector(".theme-toggle");

  if (themeToggle) {
    syncThemeToggle(themeToggle);
    themeToggle.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = nextTheme;
      try {
        localStorage.setItem("bbfraxy-theme", nextTheme);
      } catch {
        // Ignore storage errors; the theme still changes for this page view.
      }
      syncThemeToggle(themeToggle);
    });
  }

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
      navMenu.classList.toggle("is-open", !isOpen);
      root.classList.toggle("nav-open", !isOpen);
    });

    navMenu.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        closeNavigation(menuToggle, navMenu);
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNavigation(menuToggle, navMenu);
      }
    });
  }

  function syncThemeToggle(button) {
    const isLight = root.dataset.theme === "light";
    button.setAttribute("aria-pressed", String(isLight));
    button.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
  }

  function closeNavigation(button, menu) {
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation");
    menu.classList.remove("is-open");
    root.classList.remove("nav-open");
  }

  function getActiveSection(path) {
    if (path === "/games" || path.startsWith("/games/")) return "games";
    if (path === "/tools" || path.startsWith("/tools/")) return "tools";
    if (path === "/projects" || path.startsWith("/projects/")) return "projects";
    if (path === "/downloads" || path.startsWith("/downloads/")) return "downloads";
    return null;
  }

  function normalizePath(path) {
    const normalized = path.replace(/\/+$/, "");
    return normalized || "/";
  }
})();
