/* BBFRAXY i18n foundation.
 *
 * This module is intentionally passive for now: it does not change the visible
 * language until a language switcher is connected to it.
 *
 * Future usage:
 *   BBFRAXY_I18N.setLocale("en");
 *   BBFRAXY_I18N.setLocale("cs");
 *
 * Mark translatable elements with:
 *   data-i18n="nav.games"
 * or attributes with:
 *   data-i18n-attr="aria-label:nav.openMenu"
 */
(() => {
  const STORAGE_KEY = "bbfraxy-locale";
  const SUPPORTED_LOCALES = ["cs", "en"];
  const DEFAULT_LOCALE = "cs";

  const translations = {
    cs: {
      nav: {
        games: "Games",
        tools: "Tools",
        projects: "Projects",
        downloads: "Downloads",
        switchTheme: "Přepnout motiv",
        switchLanguage: "Změnit jazyk",
        openMenu: "Otevřít navigaci",
        closeMenu: "Zavřít navigaci",
      },
      common: {
        home: "Domů",
        github: "GitHub",
        privacy: "Soukromí",
      },
      tools: {
        title: "Nástroje",
        githubSimplifier: "GitHub Simplifier",
      },
    },
    en: {
      nav: {
        games: "Games",
        tools: "Tools",
        projects: "Projects",
        downloads: "Downloads",
        switchTheme: "Switch theme",
        switchLanguage: "Change language",
        openMenu: "Open navigation",
        closeMenu: "Close navigation",
      },
      common: {
        home: "Home",
        github: "GitHub",
        privacy: "Privacy",
      },
      tools: {
        title: "Tools",
        githubSimplifier: "GitHub Simplifier",
      },
    },
  };

  const getStoredLocale = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED_LOCALES.includes(stored) ? stored : null;
    } catch {
      return null;
    }
  };

  const getLocale = () => getStoredLocale() || DEFAULT_LOCALE;

  const resolve = (object, path) => {
    return path.split(".").reduce((value, key) => {
      if (!value || typeof value !== "object") return undefined;
      return value[key];
    }, object);
  };

  const translate = (key, locale = getLocale()) => {
    return resolve(translations[locale] || translations[DEFAULT_LOCALE], key) ?? key;
  };

  const apply = (locale = getLocale()) => {
    const safeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    const dictionary = translations[safeLocale];

    document.documentElement.dataset.locale = safeLocale;
    document.documentElement.lang = safeLocale;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = resolve(dictionary, element.dataset.i18n || "");
      if (value !== undefined) element.textContent = value;
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
      const declarations = element.dataset.i18nAttr || "";
      declarations.split(";").forEach((declaration) => {
        const [attribute, key] = declaration.split(":").map((part) => part.trim());
        if (!attribute || !key) return;
        const value = resolve(dictionary, key);
        if (value !== undefined) element.setAttribute(attribute, value);
      });
    });

    window.dispatchEvent(new CustomEvent("bbfraxy:locale-change", {
      detail: { locale: safeLocale },
    }));

    return safeLocale;
  };

  const setLocale = (locale) => {
    if (!SUPPORTED_LOCALES.includes(locale)) return getLocale();

    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Local storage can be unavailable in privacy-restricted contexts.
    }

    return apply(locale);
  };

  window.BBFRAXY_I18N = {
    supportedLocales: [...SUPPORTED_LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    getLocale,
    translate,
    apply,
    setLocale,
  };

  // Passive initialization only. Existing pages keep their current wording
  // until translatable elements and the language switcher are introduced.
  apply(getLocale());
})();
