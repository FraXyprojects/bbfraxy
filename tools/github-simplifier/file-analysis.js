const FILE_ANALYSIS_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
const FILE_ANALYSIS_MAX_BYTES = 120000;

(() => {
  let activeKey = null;
  let currentPanel = null;
  let generation = 0;

  const observer = new MutationObserver(() => sync());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  sync();

  function sync() {
    const analysis = document.querySelector(".analysis-result");
    if (!analysis) {
      cleanup();
      return;
    }

    const ownerLine = analysis.querySelector(".analysis-owner")?.textContent || "";
    const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
    if (!match) return;

    const repository = { owner: match[1], repo: match[2], branch: match[3] };
    const key = `${repository.owner}/${repository.repo}@${repository.branch}`;
    if (key === activeKey && currentPanel?.isConnected) return;

    activeKey = key;
    cleanup();
    mount(analysis, repository, key);
  }

  function cleanup() {
    generation += 1;
    currentPanel?.remove();
    currentPanel = null;
  }

  async function mount(analysis, repository, key) {
    const importantFiles = [...analysis.querySelectorAll(".important-file")]
      .map((node) => node.dataset.path)
      .filter(Boolean)
      .slice(0, 10);

    const panel = document.createElement("article");
    panel.className = "analysis-panel file-analysis-panel";
    panel.dataset.repository = key;
    panel.innerHTML = `
      <div class="analysis-panel-heading">
        <div>
          <span class="analysis-label">File analysis</span>
          <h3>What do the important files actually do?</h3>
        </div>
        <span class="analysis-count">${importantFiles.length} files</span>
      </div>
      <div class="file-analysis-grid" id="file-analysis-grid">
        ${importantFiles.map((path) => loadingCard(path)).join("") || `<p class="file-analysis-note">No high-priority files were detected yet.</p>`}
      </div>
      <p class="file-analysis-note">Descriptions are generated from the file path and source content. They are interpretive summaries, not guarantees of behavior.</p>
    `;

    const keyPanel = analysis.querySelector(".important-panel");
    if (keyPanel) keyPanel.insertAdjacentElement("afterend", panel);
    else analysis.insertAdjacentElement("afterend", panel);
    currentPanel = panel;

    const run = ++generation;
    const cards = panel.querySelectorAll(".file-insight");
    await Promise.all([...cards].map(async (card) => {
      const path = card.dataset.path;
      try {
        const item = findTreeItem(analysis, path);
        if (!item || item.size > FILE_ANALYSIS_MAX_BYTES) {
          renderCard(card, path, null, "The file was identified as important, but its source is too large for inline analysis.");
          return;
        }
        const text = await fetchText(repository, path);
        if (run !== generation || key !== activeKey || !panel.isConnected) return;
        renderCard(card, path, analyzeFile(path, text));
      } catch (error) {
        if (run !== generation || key !== activeKey || !panel.isConnected) return;
        renderCard(card, path, null, error instanceof Error ? error.message : "The file could not be analyzed.");
      }
    }));
  }

  function loadingCard(path) {
    return `<article class="file-insight" data-path="${escapeAttribute(path)}">
      <div class="file-insight-head">
        <span class="file-insight-icon" aria-hidden="true">◇</span>
        <div class="file-insight-main">
          <div class="file-insight-path">${escapeHtml(path)}</div>
          <div class="file-insight-role">Loading source analysis…</div>
        </div>
      </div>
      <p class="file-insight-description"><span class="file-analysis-loading">Reading file…</span></p>
    </article>`;
  }

  function renderCard(card, path, analysis, fallback) {
    const description = analysis?.description || fallback || "No description available.";
    const role = analysis?.role || classifyRole(path);
    const signals = analysis?.signals || [];
    const edit = window.classifyEditability?.(path) || classifyFallbackEditability(path);
    card.innerHTML = `
      <div class="file-insight-head">
        <span class="file-insight-icon" aria-hidden="true">◇</span>
        <div class="file-insight-main">
          <div class="file-insight-path">${escapeHtml(path)}</div>
          <div class="file-insight-role">${escapeHtml(role)}</div>
        </div>
        <span class="file-insight-status ${edit.className}">${escapeHtml(edit.badge)}</span>
      </div>
      <p class="file-insight-description">${escapeHtml(description)}</p>
      ${signals.length ? `<div class="file-insight-signals">${signals.slice(0, 5).map((signal) => `<span class="file-insight-signal">${escapeHtml(signal)}</span>`).join("")}</div>` : ""}
    `;
  }

  function findTreeItem(analysis, path) {
    const treeRows = [...analysis.querySelectorAll(".file-row")];
    return treeRows.map((row) => row.dataset?.path).includes(path) ? null : null;
  }

  async function fetchText(repository, path) {
    const url = `${FILE_ANALYSIS_API}/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/file/${path.split("/").map(encodeURIComponent).join("/")}?branch=${encodeURIComponent(repository.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `File analysis failed (${response.status}).`);
    return typeof payload.text === "string" ? payload.text : "";
  }

  function analyzeFile(path, text) {
    const lowerPath = path.toLowerCase();
    const base = lowerPath.split("/").pop() || lowerPath;
    const normalized = String(text || "").replace(/\r\n?/g, "\n");
    const signals = [];

    if (/^readme(?:\.|$)/i.test(base)) {
      const summary = extractReadmeSummary(normalized);
      return {
        role: "Project documentation",
        description: summary || "This file explains the project, its purpose, setup and/or usage.",
        signals: ["documentation", "project overview", ...(normalized.match(/^#+\s+.+$/gm) || []).slice(0, 2).map((line) => line.replace(/^#+\s+/, ""))],
      };
    }

    if (base === "package.json") {
      let data = null;
      try { data = JSON.parse(normalized); } catch {}
      if (data) {
        if (data.name) signals.push(`package: ${data.name}`);
        if (data.scripts && Object.keys(data.scripts).length) signals.push(`${Object.keys(data.scripts).length} scripts`);
        if (data.dependencies && Object.keys(data.dependencies).length) signals.push(`${Object.keys(data.dependencies).length} dependencies`);
        if (data.devDependencies && Object.keys(data.devDependencies).length) signals.push(`${Object.keys(data.devDependencies).length} dev dependencies`);
        return {
          role: "Project manifest",
          description: data.description || "Defines the Node.js package metadata, scripts and dependency set used by the project.",
          signals,
        };
      }
    }

    if (/\.html?$/.test(base)) {
      const title = normalized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      const description = normalized.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim();
      const scripts = [...normalized.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
      const styles = [...normalized.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)].map((m) => m[1]);
      if (/index\.html$/.test(base)) signals.push("entry page");
      if (scripts.length) signals.push(`${scripts.length} script reference${scripts.length === 1 ? "" : "s"}`);
      if (styles.length) signals.push(`${styles.length} stylesheet reference${styles.length === 1 ? "" : "s"}`);
      return {
        role: "Web page / entry document",
        description: title ? `Renders the “${stripMarkup(title)}” page and wires its visible structure to ${scripts.length ? `${scripts.length} script` : "client-side behavior"}${styles.length ? ` plus ${styles.length} stylesheet${styles.length === 1 ? "" : "s"}` : ""}.` : "Defines the HTML structure for a user-facing web page and its local assets.",
        signals: [title ? `title: ${stripMarkup(title)}` : null, description ? "meta description" : null, ...signals].filter(Boolean),
      };
    }

    if (/\.(css|scss|less)$/.test(base)) {
      const selectorCount = (normalized.match(/[^{}]+\{/g) || []).length;
      const mediaCount = (normalized.match(/@media\b/g) || []).length;
      const varCount = (normalized.match(/--[A-Za-z0-9_-]+\s*:/g) || []).length;
      if (selectorCount) signals.push(`${selectorCount} style blocks`);
      if (mediaCount) signals.push(`${mediaCount} responsive media query${mediaCount === 1 ? "" : "ies"}`);
      if (varCount) signals.push(`${varCount} CSS variables`);
      return {
        role: "Stylesheet / visual presentation",
        description: `Controls visual presentation such as layout, spacing, colors and component styling${mediaCount ? " with responsive behavior" : ""}.`,
        signals,
      };
    }

    if (/\.(json|yaml|yml|toml|ini|cfg)$/.test(base)) {
      const keys = extractTopLevelKeys(normalized, base);
      const configLike = /(^|\/)(config|configs|configuration|settings)(\/|$)/i.test(path) || /^(config|settings)/i.test(base) || /\.(ini|cfg)$/.test(base);
      return {
        role: configLike ? "Configuration / settings" : "Structured data or metadata",
        description: configLike ? "Defines structured options or settings that can often be changed without modifying the main application logic. Exact effects depend on how the project reads these values." : "Stores structured project data or metadata in a machine-readable format.",
        signals: keys.slice(0, 5).map((key) => `key: ${key}`),
      };
    }

    if (/\.(cs|csx)$/.test(base)) {
      const classes = countMatches(normalized, /\bclass\s+[A-Za-z_][A-Za-z0-9_]*/g);
      const methods = countMatches(normalized, /\b(?:public|private|protected|internal|static|async|override|virtual)\s+[A-Za-z0-9_<>,?\[\]]+\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/g);
      const b = normalized.includes("BepInEx") ? "BepInEx" : null;
      const harmony = normalized.includes("Harmony") ? "Harmony" : null;
      if (classes) signals.push(`${classes} class${classes === 1 ? "" : "es"}`);
      if (methods) signals.push(`${methods} method signature${methods === 1 ? "" : "s"}`);
      if (b) signals.push(b);
      if (harmony) signals.push(harmony);
      return {
        role: /Valheim|BepInEx|Harmony/i.test(normalized) ? "C# mod/plugin source" : "C# source code",
        description: /BepInEx/i.test(normalized) ? "Contains C# runtime logic for a BepInEx-based plugin/mod, including the code that hooks into the game or manages mod behavior." : "Contains C# application or library logic used by the project.",
        signals,
      };
    }

    if (/\.(js|mjs|cjs|ts|tsx|jsx)$/.test(base)) {
      const imports = countMatches(normalized, /\bimport\b|\brequire\s*\(/g);
      const exports = countMatches(normalized, /\bexport\b/g);
      const functions = countMatches(normalized, /\bfunction\s+[A-Za-z_][A-Za-z0-9_]*\s*\(|=>\s*\{/g);
      const classes = countMatches(normalized, /\bclass\s+[A-Za-z_][A-Za-z0-9_]*/g);
      if (imports) signals.push(`${imports} import/reference${imports === 1 ? "" : "s"}`);
      if (exports) signals.push(`${exports} export${exports === 1 ? "" : "s"}`);
      if (functions) signals.push(`${functions} function block${functions === 1 ? "" : "s"}`);
      if (classes) signals.push(`${classes} class${classes === 1 ? "" : "es"}`);
      const role = /(^|\/)(main|app|index)\.(js|mjs|cjs|ts|tsx|jsx)$/.test(lowerPath) ? "Application entry / controller" : "JavaScript / TypeScript source";
      const verbs = [];
      if (/addEventListener|querySelector|createElement/.test(normalized)) verbs.push("manages UI interactions");
      if (/fetch\s*\(|XMLHttpRequest|axios/.test(normalized)) verbs.push("performs network requests");
      if (/localStorage|sessionStorage/.test(normalized)) verbs.push("persists client state");
      if (/router|navigate\(|history\.pushState|location\./.test(normalized)) verbs.push("handles navigation");
      if (/BepInEx|Harmony/.test(normalized)) verbs.push("contains game/mod hooks");
      return {
        role,
        description: verbs.length ? `Contains code that ${joinHuman(verbs)}.` : "Contains executable project logic and supporting functions. Its exact responsibility is inferred from its imports, structure and referenced APIs.",
        signals,
      };
    }

    const comment = extractLeadingComment(normalized);
    return {
      role: classifyRole(path),
      description: comment || "This file is part of the project implementation. Its role is inferred from its path and source structure.",
      signals,
    };
  }

  function extractReadmeSummary(text) {
    const blocks = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    return stripMarkdown(blocks.find((part) => !/^#{1,6}\s/.test(part) && part.length > 30)?.split("\n").slice(0, 3).join(" ") || "").slice(0, 260);
  }

  function extractTopLevelKeys(text, base) {
    if (/\.json$/.test(base)) {
      try { return Object.keys(JSON.parse(text || "{}")); } catch { return []; }
    }
    return [...text.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*:/gm)].map((match) => match[1]).slice(0, 8);
  }

  function extractLeadingComment(text) {
    const block = text.match(/^\s*(?:\/\/|#|;|<!--)\s*(.{15,180})/m);
    return block?.[1]?.trim() || "";
  }

  function classifyRole(path) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    if (/(^|\/)test(s)?(\/|$)/.test(lower)) return "Test / validation code";
    if (/(config|settings|configuration)/.test(base)) return "Configuration / settings";
    if (/index\.html?$/.test(base)) return "Web entry document";
    if (/\.(css|scss|less)$/.test(base)) return "Stylesheet";
    if (/\.(md|txt)$/.test(base)) return "Documentation";
    if (/\.(cs|js|ts|py|java|rs|go|cpp|c)$/.test(base)) return "Source code";
    return "Project file";
  }

  function classifyFallbackEditability(path) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    if (/\.(cfg|ini)$/.test(base) || /config|settings/.test(lower)) return { badge: "Likely safe", className: "edit-safe" };
    if (/\.(json|yaml|yml|toml)$/.test(base)) return { badge: "Likely safe", className: "edit-safe" };
    if (/\.(dll|exe|so|dylib|jar|class|wasm)$/.test(base)) return { badge: "Core", className: "edit-core" };
    if (/\.(js|ts|cs|py|java|html|css|tsx|jsx)$/.test(base)) return { badge: "Caution", className: "edit-caution" };
    return { badge: "Unknown", className: "edit-unknown" };
  }

  function countMatches(text, regex) {
    return [...String(text || "").matchAll(regex)].length;
  }

  function stripMarkdown(value) {
    return String(value || "").replace(/[`*_>#]/g, "").replace(/\s+/g, " ").trim();
  }

  function stripMarkup(value) {
    return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  function joinHuman(values) {
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
