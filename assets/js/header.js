(() => {
  const normalizePath = (path) => path.replace(/\/+$/, "") || "/";
  const currentPath = normalizePath(window.location.pathname);
  const header = document.querySelector(".site-header");

  if (!header) return;

  const navItems = [
    { key: "games", label: "Games", href: "/games/" },
    { key: "tools", label: "Tools", href: "/tools/" },
    { key: "projects", label: "Projects", href: "/projects/" },
    { key: "downloads", label: "Downloads", href: "/downloads/" },
  ];

  let activeKey = null;
  if (currentPath === "/games" || currentPath.startsWith("/games/")) activeKey = "games";
  else if (currentPath === "/tools" || currentPath.startsWith("/tools/")) activeKey = "tools";
  else if (currentPath === "/projects" || currentPath.startsWith("/projects/")) activeKey = "projects";
  else if (currentPath === "/downloads" || currentPath.startsWith("/downloads/")) activeKey = "downloads";

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
          <button class="icon-button lang-toggle" type="button" aria-label="Switch language" data-i18n-attr="aria-label:nav.switchLanguage">
            <span class="lang-text" aria-hidden="true"></span>
          </button>
          <button class="icon-button theme-toggle" type="button" aria-label="Switch theme" aria-pressed="false" data-i18n-attr="aria-label:nav.switchTheme">
            <span class="theme-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </nav>
  `;

  const langToggle = header.querySelector(".lang-toggle");
  const langText = langToggle?.querySelector(".lang-text");

  const syncLangToggle = () => {
    if (langText && window.BBFRAXY_I18N) {
      langText.textContent = window.BBFRAXY_I18N.getLocale().toUpperCase();
    }
  };

  if (langToggle) {
    syncLangToggle();
    langToggle.addEventListener("click", () => {
      if (window.BBFRAXY_I18N) {
        const current = window.BBFRAXY_I18N.getLocale();
        const next = current === "cs" ? "en" : "cs";
        window.BBFRAXY_I18N.setLocale(next);
      }
    });

    window.addEventListener("bbfraxy:locale-change", syncLangToggle);
  }

  if (currentPath.startsWith("/games/")) {
    document.querySelectorAll(".eyebrow, .trivia-eyebrow").forEach((element) => element.remove());
  }
})();
