## 2024-05-18 - Client-Side Markdown Link Parser Protocol Whitelist
**Vulnerability:** Markdown parsing using RegEx `replace` without protocol verification allows client-side XSS via `[text](javascript:alert(1))` payloads. Also lacked quotation mark escaping allowing for attribute breakout attacks.
**Learning:** Vanilla JS implementations of markdown parsers that rely on chained regex `.replace()` are highly vulnerable unless strict protocol whitelisting and HTML entity escaping are enforced before URL injection.
**Prevention:** Always use an allowlist approach for URL protocols (e.g. `^https?:|^mailto:|^\/`) and verify quotation marks are escaped when crafting HTML tags manually via string manipulation.
