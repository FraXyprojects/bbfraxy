const FILE_ANALYSIS_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";

(() => {
  let activeKey = null;
  let currentPanel = null;
  let generation = 0;

  const observer = new MutationObserver(sync);
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

    cleanup();
    activeKey = key;
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
      <div class="file-analysis-grid">
        ${importantFiles.map(loadingCard).join("") || `<p class="file-analysis-note">No high-priority files were detected yet.</p>`}
      </div>
      <p class="file-analysis-note">Descriptions are generated from the repository path and source content. They are interpretive summaries, not guarantees of behavior.</p>
    `;

    const keyPanel = analysis.querySelector(".important-panel");
    if (keyPanel) keyPanel.insertAdjacentElement("afterend", panel);
    else analysis.insertAdjacentElement("afterend", panel);
    currentPanel = panel;

    const run = ++generation;
    const cards = [...panel.querySelectorAll(".file-insight")];

    await Promise.all(cards.map(async (card) => {
      const path = card.dataset.path;
      try {
        const text = await fetchText(repository, path);
        if (run !== generation || key !== activeKey || !panel.isConnected) return;
        renderCard(card, path, analyzeFile(path, text));
      } catch (error) {
        if (run !== generation || key !== activeKey || !panel.isConnected) return;
        const message = error instanceof Error ? error.message : "The file could not be analyzed.";
        renderCard(card, path, null, message);
      }
    }));
  }

  function loadingCard(path) {
    return `<article class="file-insight" data-path="${escapeHtml(path)}">
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
    const edit = classifyEditability(path);
    const description = analysis?.description || fallback || "No description available.";
    const role = analysis?.role || classifyRole(path);
    const signals = analysis?.signals || [];
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
      ${signals.length ? `<div class="file-insight-signals">${signals.slice(0, 6).map((signal) => `<span class="file-insight-signal">${escapeHtml(signal)}</span>`).join("")}</div>` : ""}
    `;
  }

  async function fetchText(repository, path) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const url = `${FILE_ANALYSIS_API}/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/file/${encodedPath}?branch=${encodeURIComponent(repository.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `File analysis failed (${response.status}).`);
    return typeof payload.text === "string" ? payload.text : "";
  }

  function analyzeFile(path, text) {
    const lowerPath = path.toLowerCase();
    const base = lowerPath.split("/").pop() || lowerPath;
    const source = String(text || "").replace(/\r\n?/g, "\n");
    const signals = [];

    if (/^readme(?:\.|$)/i.test(base)) {
      const summary = extractReadmeSummary(source);
      return {
        role: "Project documentation",
        description: summary || "Explains the project, its purpose, setup and/or usage.",
        signals: ["documentation", "project overview"].concat(extractHeadings(source).slice(0, 3)),
      };
    }

    if (base === "package.json") {
      try {
        const data = JSON.parse(source);
        if (data.name) signals.push(`package: ${data.name}`);
        if (data.scripts) signals.push(`${Object.keys(data.scripts).length} scripts`);
        if (data.dependencies) signals.push(`${Object.keys(data.dependencies).length} dependencies`);
        if (data.devDependencies) signals.push(`${Object.keys(data.devDependencies).length} dev dependencies`);
        return {
          role: "Project manifest",
          description: data.description || "Defines project metadata, dependency requirements and development scripts.",
          signals,
        };
      } catch {
        // Fall through to generic analysis.
      }
    }

    if (/\.html?$/.test(base)) {
      const title = stripMarkup(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
      const scripts = [...source.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
      const styles = [...source.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)].map((match) => match[1]);
      if (/^index\.html?$/.test(base)) signals.push("entry page");
      if (scripts.length) signals.push(`${scripts.length} script reference${scripts.length === 1 ? "" : "s"}`);
      if (styles.length) signals.push(`${styles.length} stylesheet reference${styles.length === 1 ? "" : "s"}`);
      return {
        role: "Web page / entry document",
        description: title ? `Renders the “${title}” page and wires its markup to ${scripts.length ? `${scripts.length} local script${scripts.length === 1 ? "" : "s"}` : "client-side behavior"}${styles.length ? ` plus ${styles.length} stylesheet${styles.length === 1 ? "" : "s"}` : ""}.` : "Defines the HTML structure for a user-facing page and its local assets.",
        signals: [title ? `title: ${title}` : null].concat(signals).filter(Boolean),
      };
    }

    if (/\.(css|scss|less)$/.test(base)) {
      const blocks = (source.match(/[^{}]+\{/g) || []).length;
      const media = (source.match(/@media\b/g) || []).length;
      const variables = (source.match(/--[A-Za-z0-9_-]+\s*:/g) || []).length;
      if (blocks) signals.push(`${blocks} style blocks`);
      if (media) signals.push(`${media} responsive media quer${media === 1 ? "y" : "ies"}`);
      if (variables) signals.push(`${variables} CSS variables`);
      return {
        role: "Stylesheet / visual presentation",
        description: `Controls visual presentation such as layout, spacing, colors and component styling${media ? " with responsive behavior" : ""}.`,
        signals,
      };
    }

    if (/\.(json|yaml|yml|toml|ini|cfg)$/.test(base)) {
      const keys = topLevelKeys(source, base);
      const configLike = /(^|\/)(config|configs|configuration|settings)(\/|$)/i.test(path) || /^(config|settings)/i.test(base) || /\.(ini|cfg)$/.test(base);
      return {
        role: configLike ? "Configuration / settings" : "Structured data / metadata",
        description: configLike ? "Contains project settings or options that can often be changed without rewriting the main logic. The exact effect depends on how the application consumes these values." : "Stores structured project data or metadata in a machine-readable format.",
        signals: keys.slice(0, 6).map((key) => `key: ${key}`),
      };
    }

    if (/\.(cs|csx)$/.test(base)) {
      const classes = count(source, /\bclass\s+[A-Za-z_][A-Za-z0-9_]*/g);
      const methods = count(source, /\b(?:public|private|protected|internal|static|async|override|virtual)\s+[A-Za-z0-9_<>,?\[\]]+\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/g);
      if (classes) signals.push(`${classes} class${classes === 1 ? "" : "es"}`);
      if (methods) signals.push(`${methods} method signature${methods === 1 ? "" : "s"}`);
      if (source.includes("BepInEx")) signals.push("BepInEx");
      if (source.includes("Harmony")) signals.push("Harmony");
      return {
        role: /BepInEx|Harmony/i.test(source) ? "C# mod/plugin source" : "C# source code",
        description: /BepInEx/i.test(source) ? "Contains runtime logic for a BepInEx-based plugin/mod, including hooks into the game and/or mod behavior." : "Contains C# application or library logic used by the project.",
        signals,
      };
    }

    if (/\.(js|mjs|cjs|ts|tsx|jsx)$/.test(base)) {
      const imports = count(source, /\bimport\b|\brequire\s*\(/g);
      const exports = count(source, /\bexport\b/g);
      const functions = count(source, /\bfunction\s+[A-Za-z_][A-Za-z0-9_]*\s*\(|=>\s*\{/g);
      const classes = count(source, /\bclass\s+[A-Za-z_][A-Za-z0-9_]*/g);
      if (imports) signals.push(`${imports} import/reference${imports === 1 ? "" : "s"}`);
      if (exports) signals.push(`${exports} export${exports === 1 ? "" : "s"}`);
      if (functions) signals.push(`${functions} function block${functions === 1 ? "" : "s"}`);
      if (classes) signals.push(`${classes} class${classes === 1 ? "" : "es"}`);

      const behaviors = [];
      if (/addEventListener|querySelector|createElement/.test(source)) behaviors.push("manages UI interactions");
      if (/fetch\s*\(|XMLHttpRequest|axios/.test(source)) behaviors.push("performs network requests");
      if (/localStorage|sessionStorage/.test(source)) behaviors.push("persists client state");
      if (/history\.pushState|location\.|navigate\(/.test(source)) behaviors.push("handles navigation");
      if (/BepInEx|Harmony/.test(source)) behaviors.push("contains game/mod hooks");

      return {
        role: /(^|\/)(main|app|index)\.(js|mjs|cjs|ts|tsx|jsx)$/.test(lowerPath) ? "Application entry / controller" : "JavaScript / TypeScript source",
        description: behaviors.length ? `Contains code that ${humanList(behaviors)}.` : "Contains executable project logic and supporting functions. Its responsibility is inferred from its structure and referenced APIs.",
        signals,
      };
    }

    const leadingComment = source.match(/^\s*(?:\/\/|#|;|<!--)\s*(.{15,180})/m)?.[1]?.trim();
    return {
      role: classifyRole(path),
      description: leadingComment || "This file is part of the project implementation. Its role is inferred from its path and source structure.",
      signals,
    };
  }

  function extractReadmeSummary(source) {
    const blocks = source.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    const body = blocks.find((block) => !/^#{1,6}\s/.test(block) && block.length > 30);
    return stripMarkdown((body || "").split("\n").slice(0, 3).join(" ")).slice(0, 280);
  }

  function extractHeadings(source) {
    return [...source.matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => stripMarkdown(match[1])).filter(Boolean);
  }

  function topLevelKeys(source, base) {
    if (/\.json$/.test(base)) {
      try { return Object.keys(JSON.parse(source || "{}")); } catch { return []; }
    }
    return [...source.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*:/gm)].map((match) => match[1]);
  }

  function classifyRole(path) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    if (/(^|\/)tests?(\/|$)/.test(lower)) return "Test / validation code";
    if (/(config|settings|configuration)/.test(base)) return "Configuration / settings";
    if (/index\.html?$/.test(base)) return "Web entry document";
    if (/\.(css|scss|less)$/.test(base)) return "Stylesheet";
    if (/\.(md|txt)$/.test(base)) return "Documentation";
    if (/\.(cs|js|ts|py|java|rs|go|cpp|c|h|hpp)$/.test(base)) return "Source code";
    return "Project file";
  }

  function classifyEditability(path) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    if (/(^|\/)(node_modules|dist|build|bin|obj|\.git)(\/|$)/.test(lower) || /\.(dll|exe|so|dylib|jar|class|wasm)$/.test(base)) return { badge: "Core", className: "edit-core" };
    if (/\.(cfg|ini)$/.test(base) || /(^|\/)(config|configs|configuration|settings)(\/|$)/.test(lower)) return { badge: "Likely safe", className: "edit-safe" };
    if (/\.(json|yaml|yml|toml)$/.test(base)) return { badge: "Likely safe", className: "edit-safe" };
    if (/\.(html|css|scss|less|js|ts|tsx|jsx|cs|py|java|rs|go|cpp|c)$/.test(base)) return { badge: "Caution", className: "edit-caution" };
    return { badge: "Unknown", className: "edit-unknown" };
  }

  function count(source, regex) {
    return [...source.matchAll(regex)].length;
  }

  function humanList(values) {
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
  }

  function stripMarkdown(value) {
    return String(value || "").replace(/[`*_>#]/g, "").replace(/\s+/g, " ").trim();
  }

  function stripMarkup(value) {
    return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
})();
