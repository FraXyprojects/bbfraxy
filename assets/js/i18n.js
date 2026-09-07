/* BBFRAXY i18n loader.
 *
 * Translation dictionaries live in:
 *   /assets/i18n/cs.json
 *   /assets/i18n/en.json
 *
 * Elements can opt into translation with:
 *   data-i18n="nav.games"
 * or attributes with:
 *   data-i18n-attr="aria-label:nav.openMenu;placeholder:some.key"
 */
(() => {
  const STORAGE_KEY = "bbfraxy-locale";
  const SUPPORTED_LOCALES = ["cs", "en"];
  const DEFAULT_LOCALE = "cs";
  const DICTIONARY_BASE = "/assets/i18n";

  let dictionaryCache = {};
  let loadPromise = null;

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

  const loadDictionary = async (locale) => {
    const safeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    if (dictionaryCache[safeLocale]) return dictionaryCache[safeLocale];

    const response = await fetch(`${DICTIONARY_BASE}/${safeLocale}.json`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to load translation dictionary: ${safeLocale}`);
    }

    const dictionary = await response.json();
    dictionaryCache[safeLocale] = dictionary;
    return dictionary;
  };

  const translate = (key, locale = getLocale()) => {
    const dictionary = dictionaryCache[locale] || dictionaryCache[DEFAULT_LOCALE];
    return resolve(dictionary, key) ?? key;
  };

  const apply = (locale = getLocale()) => {
    const safeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    const dictionary = dictionaryCache[safeLocale];
    if (!dictionary) return safeLocale;

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

  const loadAndApply = async (locale = getLocale()) => {
    const safeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    await loadDictionary(safeLocale);
    return apply(safeLocale);
  };

  const setLocale = async (locale) => {
    if (!SUPPORTED_LOCALES.includes(locale)) return getLocale();

    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Local storage can be unavailable in privacy-restricted contexts.
    }

    return loadAndApply(locale);
  };

  window.BBFRAXY_I18N = {
    supportedLocales: [...SUPPORTED_LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    getLocale,
    translate,
    apply,
    setLocale,
    loadDictionary,
    loadAndApply,
  };

  loadPromise = loadAndApply(getLocale())
    .catch((error) => {
      console.error("BBFRAXY i18n initialization failed:", error);
      return DEFAULT_LOCALE;
    })
    .finally(() => {
      window.dispatchEvent(new CustomEvent("bbfraxy:i18n-ready"));
    });

  window.BBFRAXY_I18N.ready = loadPromise;
})();
