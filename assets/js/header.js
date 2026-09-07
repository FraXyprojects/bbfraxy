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
            <span class="lang-flag" aria-hidden="true">🇨🇿</span>
          </button>
          <button class="icon-button theme-toggle" type="button" aria-label="Switch theme" aria-pressed="false" data-i18n-attr="aria-label:nav.switchTheme">
            <span class="theme-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </nav>
  `;

  const langToggle = header.querySelector(".lang-toggle");
  const langFlag = langToggle?.querySelector(".lang-flag");

  const getLocaleFromStorage = () => {
    try {
      return localStorage.getItem("bbfraxy-locale") === "en" ? "en" : "cs";
    } catch {
      return "cs";
    }
  };

  const syncLangToggle = () => {
    const locale = window.BBFRAXY_I18N?.getLocale?.() || getLocaleFromStorage();
    if (langFlag) langFlag.textContent = locale === "en" ? "🇺🇸" : "🇨🇿";
  };

  const ensureI18n = () => {
    if (window.BBFRAXY_I18N?.ready) return window.BBFRAXY_I18N.ready;

    return new Promise((resolve) => {
      const onReady = () => resolve(window.BBFRAXY_I18N);
      window.addEventListener("bbfraxy:i18n-ready", onReady, { once: true });

      const existing = Array.from(document.scripts).find((script) => {
        const src = script.getAttribute("src") || "";
        return src.endsWith("/assets/js/i18n.js") || src.endsWith("assets/js/i18n.js");
      });

      if (!existing) {
        const script = document.createElement("script");
        script.src = "/assets/js/i18n.js";
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  };

  syncLangToggle();
  ensureI18n().then(syncLangToggle);

  if (langToggle) {
    langToggle.addEventListener("click", async () => {
      const i18n = await ensureI18n();
      if (!i18n) return;

      const current = i18n.getLocale();
      const next = current === "cs" ? "en" : "cs";
      await i18n.setLocale(next);
    });

    window.addEventListener("bbfraxy:locale-change", syncLangToggle);
  }

  if (currentPath.startsWith("/games/")) {
    document.querySelectorAll(".eyebrow, .trivia-eyebrow").forEach((element) => element.remove());
  }
})();
