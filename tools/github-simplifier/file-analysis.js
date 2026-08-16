const FILE_SUMMARY_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
const MAX_SUMMARY_BYTES = 90000;
const CONCURRENCY = 4;

(() => {
  let activeKey = null;
  let generation = 0;
  const cache = new Map();

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener("click", onDocumentClick, true);
  sync();

  function sync() {
    const analysis = document.querySelector(".analysis-result");
    if (!analysis) return;
    const repository = parseRepository(analysis);
    if (!repository) return;

    const key = `${repository.owner}/${repository.repo}@${repository.branch}`;
    if (key !== activeKey) {
      activeKey = key;
      generation += 1;
      removeLegacyPanel();
      installStyles();
    }

    window.setTimeout(() => attachMapSummaries(analysis, repository, key), 0);
    attachPreviewSummary(analysis, repository, key);
  }

  function parseRepository(analysis) {
    const ownerLine = analysis.querySelector(".analysis-owner")?.textContent || "";
    const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
    return match ? { owner: match[1], repo: match[2], branch: match[3] } : null;
  }

  function removeLegacyPanel() {
    document.querySelectorAll(".file-analysis-panel").forEach((node) => node.remove());
  }

  async function attachMapSummaries(analysis, repository, key) {
    const rows = [...analysis.querySelectorAll("button.file-row")];
    const jobs = [];

    for (const row of rows) {
      if (row.querySelector(".file-map-summary")) continue;
      const path = getFilePath(row);
      const name = row.querySelector(":scope > .tree-name");
      if (!path || !name) continue;

      const holder = name.cloneNode(true);
      holder.querySelectorAll(".file-map-summary").forEach((node) => node.remove());
      name.replaceWith(holder);

      holder.classList.add("tree-file-info");
      const summary = document.createElement("span");
      summary.className = "file-map-summary";
      summary.textContent = "Analyzing file…";
      holder.append(summary);
      row.classList.add("tree-file-row-expanded");
      jobs.push({ row, path, summary });
    }

    if (!jobs.length) return;
    const run = generation;

    await runLimited(jobs, CONCURRENCY, async ({ row, path, summary }) => {
      if (run !== generation || key !== activeKey || !row.isConnected) return;
      try {
        const item = findTreeItem(analysis, path);
        if (item && Number(item.size || 0) > MAX_SUMMARY_BYTES) {
          summary.textContent = "Large file — open for details";
          return;
        }
        const text = await fetchText(repository, path, key);
        if (run !== generation || key !== activeKey || !row.isConnected) return;
        const insight = summarize(path, text);
        summary.textContent = insight.description;
        summary.title = insight.description;
        row.dataset.summaryRole = insight.role;
      } catch {
        if (run === generation && key === activeKey && row.isConnected) summary.textContent = "Select the file for details";
      }
    });
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest("button.file-row, button.important-file")) return;
    window.setTimeout(sync, 0);
  }

  async function attachPreviewSummary(analysis, repository, key) {
    const panel = document.querySelector("#file-preview-panel");
    if (!panel || panel.hidden) return;

    const title = panel.querySelector("#preview-title")?.textContent?.trim();
    if (!title || title === "Select a file") return;

    let box = panel.querySelector(".file-summary-detail");
    if (!box) {
      box = document.createElement("div");
      box.className = "file-summary-detail";
      const code = panel.querySelector("#code-preview");
      if (code) code.insertAdjacentElement("beforebegin", box);
      else panel.querySelector(".analysis-panel-heading")?.insertAdjacentElement("afterend", box);
    }

    const requestKey = `${key}:${title}`;
    if (box.dataset.key === requestKey && box.dataset.loaded === "1") return;
    box.dataset.key = requestKey;
    box.dataset.loaded = "0";
    box.innerHTML = `<span class="analysis-label">What does this file do?</span><p class="file-summary-detail-text">Reading the source…</p>`;

    const item = findTreeItem(analysis, title);
    if (item && Number(item.size || 0) > MAX_SUMMARY_BYTES) {
      box.dataset.loaded = "1";
      box.innerHTML = `<span class="analysis-label">What does this file do?</span><p class="file-summary-detail-text">This file is too large for inline analysis. Open it on GitHub for the full source.</p>`;
      return;
    }

    const run = ++generation;
    try {
      const text = await fetchText(repository, title, key);
      if (run !== generation || key !== activeKey || !box.isConnected) return;
      const insight = summarize(title, text);
      box.dataset.loaded = "1";
      box.innerHTML = `
        <div class="file-summary-detail-head">
          <div><span class="analysis-label">What does this file do?</span><strong>${escapeHtml(insight.role)}</strong></div>
          ${insight.signals.length ? `<div class="file-summary-signals">${insight.signals.slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
        </div>
        <p class="file-summary-detail-text">${escapeHtml(insight.detailed || insight.description)}</p>
        ${insight.editNote ? `<p class="file-summary-detail-note">${escapeHtml(insight.editNote)}</p>` : ""}
      `;
    } catch (error) {
      if (run !== generation || key !== activeKey || !box.isConnected) return;
      box.dataset.loaded = "1";
      box.innerHTML = `<span class="analysis-label">What does this file do?</span><p class="file-summary-detail-text">${escapeHtml(error instanceof Error ? error.message : "The file could not be analyzed.")}</p>`;
    }
  }

  function findTreeItem(analysis, path) {
    const row = [...analysis.querySelectorAll("button.file-row")].find((node) => getFilePath(node) === path);
    return row ? { path, size: Number(row.dataset.size || 0) } : null;
  }

  function getFilePath(row) {
    const ownName = row.querySelector(":scope > .tree-name")?.childNodes?.[0]?.textContent?.trim() || "";
    if (!ownName) return "";
    const parts = [ownName];
    let folder = row.closest("details.tree-folder");
    while (folder) {
      const folderName = folder.querySelector(":scope > .folder-row .tree-name")?.textContent?.trim();
      if (folderName) parts.unshift(folderName);
      folder = folder.parentElement?.closest("details.tree-folder") || null;
    }
    return parts.join("/");
  }

  async function fetchText(repository, path, key) {
    const cacheKey = `${key}:${path}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const url = `${FILE_SUMMARY_API}/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/file/${path.split("/").map(encodeURIComponent).join("/")}?branch=${encodeURIComponent(repository.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `File analysis failed (${response.status}).`);
    const text = typeof payload.text === "string" ? payload.text : "";
    cache.set(cacheKey, text);
    return text;
  }

  function summarize(path, text) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    const source = String(text || "").replace(/\r\n?/g, "\n");
    const signals = [];
    const edit = typeof window.classifyEditability === "function" ? window.classifyEditability(path) : null;
    const editNote = edit ? `Edit safety: ${edit.badge}. ${edit.explanation}` : "";

    if (/^readme(?:\.|$)/i.test(base)) {
      const description = extractReadmeSummary(source) || "Project documentation describing purpose, setup and usage.";
      return { role: "Project documentation", description, detailed: description, signals: ["documentation", "project overview", ...headings(source)], editNote };
    }

    if (base === "package.json") {
      try {
        const data = JSON.parse(source);
        if (data.name) signals.push(`package: ${data.name}`);
        if (data.scripts) signals.push(`${Object.keys(data.scripts).length} scripts`);
        if (data.dependencies) signals.push(`${Object.keys(data.dependencies).length} dependencies`);
        if (data.devDependencies) signals.push(`${Object.keys(data.devDependencies).length} dev dependencies`);
        const description = data.description || "Defines project metadata, dependencies and development scripts.";
        return { role: "Project manifest", description, detailed: `${description}${data.main ? ` The declared main entry is ${data.main}.` : ""}`, signals, editNote };
      } catch {}
    }

    if (/\.html?$/.test(base)) {
      const title = stripMarkup(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
      const scripts = [...source.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
      const styles = [...source.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)].map((m) => m[1]);
      if (/^index\.html?$/.test(base)) signals.push("entry page");
      if (scripts.length) signals.push(`${scripts.length} script reference${scripts.length === 1 ? "" : "s"}`);
      if (styles.length) signals.push(`${styles.length} stylesheet reference${styles.length === 1 ? "" : "s"}`);
      return {
        role: "Web page / entry document",
        description: title ? `Renders the “${title}” page.` : "Defines a user-facing HTML page and its local assets.",
        detailed: `This file defines the page structure${styles.length ? ` and links ${styles.length} stylesheet${styles.length === 1 ? "" : "s"}` : ""}${scripts.length ? ` while loading ${scripts.length} client-side script${scripts.length === 1 ? "" : "s"} for behavior` : ""}.`,
        signals: [title ? `title: ${title}` : null, ...signals].filter(Boolean),
        editNote,
      };
    }

    if (/\.(css|scss|less)$/.test(base)) {
      const blocks = (source.match(/[^{}]+\{/g) || []).length;
      const media = (source.match(/@media\b/g) || []).length;
      const variables = (source.match(/--[A-Za-z0-9_-]+\s*:/g) || []).length;
      if (blocks) signals.push(`${blocks} style blocks`);
      if (media) signals.push(`${media} responsive media quer${media === 1 ? "y" : "ies"}`);
      if (variables) signals.push(`${variables} CSS variables`);
      return { role: "Stylesheet / visual presentation", description: "Controls layout, spacing, colors and component presentation.", detailed: `Controls the visual presentation of the project${media ? " and includes responsive behavior" : ""}${variables ? ` with ${variables} CSS variables` : ""}.`, signals, editNote };
    }

    if (/\.(json|yaml|yml|toml|ini|cfg)$/.test(base)) {
      const keys = extractTopLevelKeys(source, base);
      const configLike = /(^|\/)(config|configs|configuration|settings)(\/|$)/i.test(path) || /^(config|settings)/i.test(base) || /\.(ini|cfg)$/.test(base);
      signals.push(...keys.slice(0, 5).map((key) => `key: ${key}`));
      const role = configLike ? "Configuration / settings" : "Structured data / metadata";
      const description = configLike ? "Defines structured options or settings that can often be changed without editing the main program logic." : "Stores machine-readable project data or metadata.";
      return { role, description, detailed: `${description}${keys.length ? ` Detected top-level fields include ${keys.slice(0, 6).join(", ")}.` : ""}`, signals, editNote };
    }

    if (/\.(cs|csx)$/.test(base)) {
      const classes = count(source, /\bclass\s+[A-Za-z_][A-Za-z0-9_]*/g);
      const methods = count(source, /\b(?:public|private|protected|internal|static|async|override|virtual)\s+[A-Za-z0-9_<>,?\[\]]+\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/g);
      if (classes) signals.push(`${classes} class${classes === 1 ? "" : "es"}`);
      if (methods) signals.push(`${methods} method signature${methods === 1 ? "" : "s"}`);
      if (/BepInEx/i.test(source)) signals.push("BepInEx");
      if (/Harmony/i.test(source)) signals.push("Harmony");
      const role = /BepInEx|Harmony|Valheim/i.test(source) ? "C# mod/plugin source" : "C# source code";
      const description = /BepInEx/i.test(source) ? "Contains runtime logic for a BepInEx-based plugin or mod, including hooks and mod behavior." : "Contains C# application, library or plugin logic.";
      return { role, description, detailed: `${description}${classes ? ` The file defines ${classes} class${classes === 1 ? "" : "es"}.` : ""}${methods ? ` It contains about ${methods} method signature${methods === 1 ? "" : "s"}.` : ""}`, signals, editNote };
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
      if (/router|navigate\(|history\.pushState|location\./.test(source)) behaviors.push("handles navigation");
      if (/BepInEx|Harmony/.test(source)) behaviors.push("contains game/mod hooks");
      const role = /(^|\/)(main|app|index)\.(js|mjs|cjs|ts|tsx|jsx)$/.test(lower) ? "Application entry / controller" : "JavaScript / TypeScript source";
      const description = behaviors.length ? `Contains code that ${humanJoin(behaviors)}.` : "Contains executable project logic and supporting functions.";
      return { role, description, detailed: `${description}${imports ? ` It references ${imports} imported module${imports === 1 ? "" : "s"}.` : ""}${exports ? ` It exposes ${exports} export${exports === 1 ? "" : "s"}.` : ""}`, signals, editNote };
    }

    const comment = extractLeadingComment(source);
    return { role: roleFromPath(path), description: comment || "Part of the project implementation; its exact role is inferred from the path and source structure.", detailed: comment || "The Simplifier could not infer a more specific responsibility from the file yet.", signals, editNote };
  }

  function extractReadmeSummary(text) {
    const blocks = text.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
    const candidate = blocks.find((value) => !/^#{1,6}\s/.test(value) && value.length > 30) || "";
    return stripMarkdown(candidate.split("\n").slice(0, 3).join(" ")).slice(0, 250);
  }

  function extractTopLevelKeys(text, base) {
    if (/\.json$/i.test(base)) {
      try { return Object.keys(JSON.parse(text || "{}")); } catch { return []; }
    }
    return [...text.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*:/gm)].map((match) => match[1]);
  }

  function extractLeadingComment(text) {
    return text.match(/^\s*(?:\/\/|#|;|<!--)\s*(.{15,180})/m)?.[1]?.trim() || "";
  }

  function roleFromPath(path) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    if (/(^|\/)tests?(\/|$)/.test(lower)) return "Test / validation code";
    if (/(config|settings|configuration)/.test(base)) return "Configuration / settings";
    if (/index\.html?$/.test(base)) return "Web entry document";
    if (/\.(css|scss|less)$/.test(base)) return "Stylesheet";
    if (/\.(md|txt)$/.test(base)) return "Documentation / text";
    return "Project source file";
  }

  function headings(text) {
    return [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1].trim()).slice(0, 3);
  }

  function stripMarkdown(value) { return String(value || "").replace(/[`*_>#~-]/g, "").replace(/\s+/g, " ").trim(); }
  function stripMarkup(value) { return stripMarkdown(String(value || "").replace(/<[^>]+>/g, "")); }
  function humanJoin(items) { return items.length <= 1 ? (items[0] || "supports project behavior") : items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`; }
  function count(text, regex) { return [...text.matchAll(regex)].length; }

  async function runLimited(items, limit, worker) {
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) await worker(items[index++]);
    });
    await Promise.all(runners);
  }

  function installStyles() {
    if (document.getElementById("bbfraxy-file-summary-styles")) return;
    const style = document.createElement("style");
    style.id = "bbfraxy-file-summary-styles";
    style.textContent = `
      .tree-file-row-expanded{min-height:56px!important;align-items:flex-start!important;padding-top:7px!important;padding-bottom:7px!important}
      .tree-file-row-expanded .tree-file-info{display:grid;align-content:center;gap:2px;min-width:0;white-space:normal;line-height:1.25}
      .file-map-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--faint);font-size:.61rem;font-weight:400;line-height:1.35}
      .tree-file-row-expanded:hover .file-map-summary,.tree-file-row-expanded:focus-visible .file-map-summary{color:var(--muted)}
      .file-summary-detail{margin-bottom:14px;border:1px solid var(--border);border-radius:calc(var(--radius) - 3px);padding:14px 15px;background:rgba(95,231,255,.028)}
      .file-summary-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .file-summary-detail-head strong{display:block;color:var(--text);font-size:.88rem}
      .file-summary-detail-text{margin:8px 0 0;color:var(--muted);font-size:.78rem;line-height:1.65}
      .file-summary-detail-note{margin:9px 0 0;color:var(--faint);font-size:.67rem;line-height:1.5}
      .file-summary-signals{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}
      .file-summary-signals span{border:1px solid var(--border);border-radius:999px;padding:3px 7px;color:var(--faint);background:rgba(255,255,255,.02);font-size:.58rem;white-space:nowrap}
      @media(max-width:720px){.file-summary-detail-head{display:block}.file-summary-signals{justify-content:flex-start;margin-top:8px}}
    `;
    document.head.append(style);
  }

  function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
})();
