## 2024-05-18 - Skip to Main Content Link
**Learning:** Adding a "skip to main content" link is a critical accessibility feature for keyboard users to bypass navigation.
**Action:** Always include a visually hidden skip link that becomes visible on focus in the initial boilerplate.
## 2024-05-18 - Avoid Dynamically Changing `aria-label` In Toggles
**Learning:** Dynamically changing strings in an `aria-label` attribute (e.g. "Open navigation" / "Close navigation") often breaks internationalization (i18n) systems, because the hardcoded logic will overwrite the translated string with a fallback language string.
**Action:** For toggles (like theme or menu toggles), always rely on a static, translated accessible name via `aria-label` or visually hidden text, and use stateful ARIA attributes such as `aria-expanded` or `aria-pressed` to communicate the state change to screen readers.
## 2026-09-15 - Skip to Content Target Accessibility
**Learning:** For a "skip to main content" link to function correctly and reliably across all screen readers and older browsers, the target container (e.g., `<main id="main">`) must explicitly specify `tabindex="-1"`. This allows it to programmatically catch focus even though it is not normally interactive.
**Action:** When implementing skip links, always apply `tabindex="-1"` to the link's target element in addition to the `id`.
