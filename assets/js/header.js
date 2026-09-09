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

  const flagSvg = {
    cs: '<svg viewBox="0 0 30 20" width="24" height="16" aria-hidden="true" focusable="false"><rect width="30" height="20" rx="2" fill="#fff"/><path d="M0 10h30v10H0z" fill="#d7141a"/><path d="M0 0v20l10.8-10z" fill="#11457e"/></svg>',
    en: '<svg viewBox="0 0 30 20" width="24" height="16" aria-hidden="true" focusable="false"><rect width="30" height="20" rx="2" fill="#fff"/><path d="M0 0h30v2H0zm0 4h30v2H0zm0 4h30v2H0zm0 4h30v2H0zm0 4h30v2H0z" fill="#b22234"/><path d="M0 0h13v10H0z" fill="#3c3b6e"/><path d="M1.2 1.4h1.1v1H1.2zm3.2 0h1.1v1H4.4zm3.2 0h1.1v1H7.6zm3.2 0h1.1v1H10.8zM2.8 3.2h1.1v1H2.8zm3.2 0h1.1v1H6zm3.2 0h1.1v1H9.2zM1.2 5h1.1v1H1.2zm3.2 0h1.1v1H4.4zm3.2 0h1.1v1H7.6zm3.2 0h1.1v1H10.8zM2.8 6.8h1.1v1H2.8zm3.2 0h1.1v1H6zm3.2 0h1.1v1H9.2zM1.2 8.6h1.1v1H1.2zm3.2 0h1.1v1H4.4zm3.2 0h1.1v1H7.6zm3.2 0h1.1v1H10.8z" fill="#fff"/></svg>'
  };

  header.innerHTML = `
    <nav class="navbar" aria-label="Primary navigation">
      <a class="brand" href="/" aria-label="BBFRAXY home">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span>BBFRAXY</span>
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Toggle navigation" title="Toggle navigation" data-i18n-attr="aria-label:nav.toggleMenu;title:nav.toggleMenu">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-menu" id="site-menu">
        <div class="nav-links" aria-label="Site sections">
          ${navItems.map((item) => `<a href="${item.href}" data-i18n="nav.${item.key}"${item.key === activeKey ? ' aria-current="page"' : ""}>${item.label}</a>`).join("")}
        </div>
        <div class="nav-actions">
          <button class="icon-button lang-toggle" type="button" aria-label="Switch language" title="Switch language" data-i18n-attr="aria-label:nav.switchLanguage;title:nav.switchLanguage">
            <span class="lang-flag" aria-hidden="true"></span>
          </button>
          <button class="icon-button theme-toggle" type="button" aria-label="Switch theme" title="Switch theme" aria-pressed="false" data-i18n-attr="aria-label:nav.switchTheme;title:nav.switchTheme">
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
      const stored = localStorage.getItem("bbfraxy-locale");
      return stored === "en" ? "en" : "cs";
    } catch {
      return "cs";
    }
  };

  const syncLangToggle = () => {
    const locale = window.BBFRAXY_I18N?.getLocale?.() || getLocaleFromStorage();
    if (langFlag) langFlag.innerHTML = flagSvg[locale] || flagSvg.cs;
  };

  const loadI18n = () => {
    if (window.BBFRAXY_I18N?.ready) {
      return window.BBFRAXY_I18N.ready.then(() => window.BBFRAXY_I18N);
    }

    if (window.BBFRAXY_I18N) {
      return Promise.resolve(window.BBFRAXY_I18N);
    }

    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => {
        const src = script.getAttribute("src") || "";
        return src.endsWith("/assets/js/i18n.js") || src.endsWith("assets/js/i18n.js");
      });

      const resolveWhenReady = () => {
        if (window.BBFRAXY_I18N?.ready) {
          window.BBFRAXY_I18N.ready.then(() => resolve(window.BBFRAXY_I18N), reject);
        } else if (window.BBFRAXY_I18N) {
          resolve(window.BBFRAXY_I18N);
        } else {
          reject(new Error("BBFRAXY i18n failed to initialize"));
        }
      };

      if (existing) {
        window.addEventListener("bbfraxy:i18n-ready", resolveWhenReady, { once: true });
        window.setTimeout(resolveWhenReady, 0);
        return;
      }

      const script = document.createElement("script");
      script.src = "/assets/js/i18n.js";
      script.onload = resolveWhenReady;
      script.onerror = () => reject(new Error("Failed to load BBFRAXY i18n"));
      document.head.appendChild(script);
    });
  };

  syncLangToggle();
  loadI18n()
    .then(() => syncLangToggle())
    .catch((error) => console.error("BBFRAXY i18n initialization failed:", error));

  langToggle?.addEventListener("click", async () => {
    try {
      const i18n = await loadI18n();
      const current = i18n.getLocale();
      const next = current === "cs" ? "en" : "cs";
      await i18n.setLocale(next);
      syncLangToggle();
    } catch (error) {
      console.error("BBFRAXY language switch failed:", error);
    }
  });

  window.addEventListener("bbfraxy:locale-change", syncLangToggle);

  if (currentPath.startsWith("/games/")) {
    document.querySelectorAll(".eyebrow, .trivia-eyebrow").forEach((element) => element.remove());
  }
})();
