## 2024-05-18 - Riskuj Builder Accessibility and Destructive Actions
**Learning:** Destructive actions that delete parent structures (like a topic that holds multiple questions) must have confirmation dialogs to prevent catastrophic data loss from misclicks, and dynamic inputs in builder UIs need localized ARIA labels because placeholders are insufficient for screen readers.
**Action:** When implementing or reviewing builder UIs, always check if 'delete' actions affect child elements and require confirmation, and ensure all dynamic inputs have both placeholders and ARIA labels linked to the localization system.
## 2026-09-10 - Dynamic input aria-labels
**Learning:** Dynamically generated inputs and icon buttons that only rely on placeholders are not sufficiently accessible. These elements must have `aria-label` attributes configured, and the values for these labels must be fetched using the site's localization system (`window.BBFRAXY_I18N.translate()`).
**Action:** When building or reviewing dynamic UIs, always ensure all form inputs and icon buttons are provided with localized `aria-label`s, utilizing the translation mechanism and corresponding JSON dictionaries.
