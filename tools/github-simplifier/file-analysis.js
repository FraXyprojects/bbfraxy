const FILE_SUMMARY_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
const MAX_SUMMARY_BYTES = 90000;
const MAX_BINARY_BYTES = 300000;
const CONCURRENCY = 2;
const MAX_DEEP_SUMMARIES = 12;

(() => {
  let activeKey = null;
  let generation = 0;
  const cache = new Map();
  let queued = false;

  document.addEventListener("github-simplifier:analysis-rendered", (event) => {
    const analysis = event.detail?.analysis || document.querySelector(".analysis-result");
    if (analysis) schedule(analysis);
  });

  // Fallback for cached/legacy renders. Runs once, not continuously.
  window.setTimeout(() => {
    const analysis = document.querySelector(".analysis-result");
    if (analysis) schedule(analysis);
  }, 0);

  function schedule(analysis) {
    if (queued) return;
    queued = true;
    window.setTimeout(() => {
      queued = false;
      mountForAnalysis(analysis);
    }, 0);
  }

  function mountForAnalysis(analysis) {
    if (!analysis?.isConnected) return;
    const repository = parseRepository(analysis);
    if (!repository) return;

    const key = `${repository.owner}/${repository.repo}@${repository.branch}`;
    if (key !== activeKey) {
      activeKey = key;
      generation += 1;
      removeLegacyPanel();
      installStyles();
    }

    const run = generation;
    attachMapSummaries(analysis, repository, key, run);
    attachPreviewSummary(analysis, repository, key, run);
  }

  function parseRepository(analysis) {
    const ownerLine = analysis.querySelector(".analysis-owner")?.textContent || "";
    const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
    return match ? { owner: match[1], repo: match[2], branch: match[3] } : null;
  }

  function removeLegacyPanel() {
    document.querySelectorAll(".file-analysis-panel").forEach((node) => node.remove());
  }

  async function attachMapSummaries(analysis, repository, key, run) {
    const rows = [...analysis.querySelectorAll("button.file-row")];
    if (!rows.length) return;

    // Every file gets an immediate path-based summary, so Analyze never waits for file I/O.
    const jobs = [];
    rows.forEach((row) => {
      const path = row.dataset.path || getFilePath(row);
      const name = row.querySelector(":scope > .tree-name");
      if (!path || !name) return;

      let summary = row.querySelector(":scope .file-map-summary");
      if (!summary) {
        summary = document.createElement("span");
        summary.className = "file-map-summary";
        name.append(summary);
      }

      const heuristic = summarizeFromPath(path);
      summary.textContent = heuristic.description;
      summary.title = heuristic.description;
      row.dataset.summaryRole = heuristic.role;

      if (isBinaryPath(path) || Number(row.dataset.size || 0) > MAX_SUMMARY_BYTES) return;
      if (!shouldDeepAnalyze(path)) return;
      if (jobs.length >= MAX_DEEP_SUMMARIES) return;
      jobs.push({ row, path, summary });
    });

    await runLimited(jobs, CONCURRENCY, async ({ row, path, summary }) => {
      if (run !== generation || key !== activeKey || !row.isConnected) return;
      try {
        const text = await fetchText(repository, path, key);
        if (run !== generation || key !== activeKey || !row.isConnected) return;
        const insight = summarize(path, text);
        summary.textContent = insight.description;
        summary.title = insight.description;
        row.dataset.summaryRole = insight.role;
      } catch {
        // Keep the fast path summary. A failed detail request must never block the analyzer.
      }
    });
  }

  async function attachPreviewSummary(analysis, repository, key, run) {
    const panel = analysis.querySelector("#file-preview-panel");
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

    if (isBinaryPath(title)) {
      box.dataset.loaded = "1";
      box.innerHTML = `<span class="analysis-label">File type</span><p class="file-summary-detail-text">${escapeHtml(binaryDescription(title))}</p>`;
      return;
    }

    if (run !== generation || key !== activeKey) return;
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

  function getFilePath(row) {
    const ownName = row.querySelector(":scope > .tree-name")?.textContent?.trim() || "";
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

  function isBinaryPath(path) {
    return /\.(png|jpe?g|gif|webp|bmp|ico|svg|mp3|wav|ogg|mp4|webm|mov|avi|zip|7z|rar|gz|tar|dll|exe|so|dylib|jar|class|wasm|pdf|woff2?|ttf|otf)$/i.test(path);
  }

  function binaryDescription(path) {
    const ext = path.split(".").pop()?.toUpperCase() || "binary";
    return `${ext} asset — source-code analysis is not applicable. The file is treated as a project asset rather than text.`;
  }

  function shouldDeepAnalyze(path) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    return /readme|package\.json|(^|\/)(index|main|app|program)\.(html?|js|mjs|cjs|ts|tsx|jsx|cs)$/i.test(path)
      || /(^|\/)(config|configs|configuration|settings)(\/|$)/i.test(path)
      || /\.(json|yaml|yml|toml|ini|cfg|cs|csx|js|mjs|cjs|ts|tsx|jsx|html?|css|scss|less)$/i.test(base);
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

  function summarizeFromPath(path) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    if (isBinaryPath(path)) return { role: "Project asset", description: binaryDescription(path) };
    if (/^readme(?:\.|$)/i.test(base)) return { role: "Project documentation", description: "Project documentation and usage overview." };
    if (base === "package.json") return { role: "Project manifest", description: "Project metadata, scripts and dependencies." };
    if (/\.html?$/.test(base)) return { role: "Web page / entry document", description: "Defines a user-facing web page and its linked assets." };
    if (/\.(css|scss|less)$/.test(base)) return { role: "Stylesheet", description: "Controls layout, styling and visual presentation." };
    if (/\.(json|yaml|yml|toml|ini|cfg)$/.test(base)) return { role: "Configuration / structured data", description: "Stores settings, metadata or structured project data." };
    if (/\.(cs|csx)$/.test(base)) return { role: "C# source code", description: "Contains C# application, library or plugin logic." };
    if (/\.(js|mjs|cjs|ts|tsx|jsx)$/.test(base)) return { role: "JavaScript / TypeScript source", description: "Contains executable application logic or UI behavior." };
    if (/\.(py)$/.test(base)) return { role: "Python source code", description: "Contains Python application, utility or automation logic." };
    if (/\.(java|kt)$/.test(base)) return { role: "JVM source code", description: "Contains Java/Kotlin application or library logic." };
    if (/\.(csproj|sln|gradle|pom|cargo\.toml)$/.test(base)) return { role: "Build / project configuration", description: "Defines project structure or build configuration." };
    return { role: "Project file", description: "Part of the project implementation; open the file for a deeper summary." };
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
      return { role: "Project documentation", description, detailed: description, signals: ["documentation", ...headings(source).slice(0, 3)], editNote };
    }

    if (base === "package.json") {
      try {
        const data = JSON.parse(source);
        if (data.name) signals.push(`package: ${data.name}`);
        if (data.scripts) signals.push(`${Object.keys(data.scripts).length} scripts`);
        if (data.dependencies) signals.push(`${Object.keys(data.dependencies).length} dependencies`);
        const description = data.description || "Defines project metadata, dependencies and development scripts.";
        return { role: "Project manifest", description, detailed: data.main ? `${description} Declared main entry: ${data.main}.` : description, signals, editNote };
      } catch {}
    }

    if (/\.html?$/.test(base)) {
      const title = stripMarkup(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
      const scripts = [...source.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
      const styles = [...source.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)].map((m) => m[1]);
      if (/^index\.html?$/.test(base)) signals.push("entry page");
      if (scripts.length) signals.push(`${scripts.length} script reference${scripts.length === 1 ? "" : "s"}`);
      if (styles.length) signals.push(`${styles.length} stylesheet reference${styles.length === 1 ? "" : "s"}`);
      return { role: "Web page / entry document", description: title ? `Renders the “${title}” page.` : "Defines a user-facing HTML page and its local assets.", detailed: `Defines the page structure${styles.length ? ` and links ${styles.length} stylesheet${styles.length === 1 ? "" : "s"}` : ""}${scripts.length ? ` while loading ${scripts.length} client-side script${scripts.length === 1 ? "" : "s"}` : ""}.`, signals: [title ? `title: ${title}` : null, ...signals].filter(Boolean), editNote };
    }

    if (/\.(css|scss|less)$/.test(base)) {
      const media = (source.match(/@media\b/g) || []).length;
      const variables = (source.match(/--[A-Za-z0-9_-]+\s*:/g) || []).length;
      if (media) signals.push(`${media} responsive media quer${media === 1 ? "y" : "ies"}`);
      if (variables) signals.push(`${variables} CSS variables`);
      return { role: "Stylesheet / visual presentation", description: "Controls layout, spacing, colors and component presentation.", detailed: `Controls the project's visual presentation${media ? " including responsive behavior" : ""}.`, signals, editNote };
    }

    if (/\.(json|yaml|yml|toml|ini|cfg)$/.test(base)) {
      const keys = extractTopLevelKeys(source, base);
      const configLike = /(^|\/)(config|configs|configuration|settings)(\/|$)/i.test(path) || /^(config|settings)/i.test(base) || /\.(ini|cfg)$/.test(base);
      signals.push(...keys.slice(0, 5).map((key) => `key: ${key}`));
      const role = configLike ? "Configuration / settings" : "Structured data / metadata";
      const description = configLike ? "Defines structured options or settings used by the project." : "Stores machine-readable project data or metadata.";
      return { role, description, detailed: `${description}${keys.length ? ` Key fields include ${keys.slice(0, 6).join(", ")}.` : ""}`, signals, editNote };
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
      return { role, description, detailed: `${description}${classes ? ` Defines ${classes} class${classes === 1 ? "" : "es"}.` : ""}${methods ? ` Contains about ${methods} method signature${methods === 1 ? "" : "s"}.` : ""}`, signals, editNote };
    }

    if (/\.(js|mjs|cjs|ts|tsx|jsx)$/.test(base)) {
      const imports = count(source, /\bimport\b|\brequire\s*\(/g);
      const exports = count(source, /\bexport\b/g);
      const functions = count(source, /\bfunction\s+[A-Za-z_][A-Za-z0-9_]*\s*\(|=>\s*\{/g);
      if (imports) signals.push(`${imports} import/reference${imports === 1 ? "" : "s"}`);
      if (exports) signals.push(`${exports} export${exports === 1 ? "" : "s"}`);
      if (functions) signals.push(`${functions} function block${functions === 1 ? "" : "s"}`);
      const behaviors = [];
      if (/addEventListener|querySelector|createElement/.test(source)) behaviors.push("manages UI interactions");
      if (/fetch\s*\(|XMLHttpRequest|axios/.test(source)) behaviors.push("performs network requests");
      if (/localStorage|sessionStorage/.test(source)) behaviors.push("persists client state");
      if (/router|navigate\(|history\.pushState|location\./.test(source)) behaviors.push("handles navigation");
      const role = /(^|\/)(main|app|index)\.(js|mjs|cjs|ts|tsx|jsx)$/.test(lower) ? "Application entry / controller" : "JavaScript / TypeScript source";
      const description = behaviors.length ? `Contains code that ${humanJoin(behaviors)}.` : "Contains executable project logic and supporting functions.";
      return { role, description, detailed: description, signals, editNote };
    }

    return summarizeFromPath(path);
  }

  async function runLimited(items, limit, worker) {
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index]);
      }
    });
    await Promise.all(runners);
  }

  function extractReadmeSummary(text) {
    const blocks = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    return stripMarkdown(blocks.find((part) => !/^#{1,6}\s/.test(part) && part.length > 30)?.split("\n").slice(0, 3).join(" ") || "").slice(0, 280);
  }

  function extractTopLevelKeys(text, base) {
    if (/\.json$/i.test(base)) {
      try { return Object.keys(JSON.parse(text || "{}")); } catch { return []; }
    }
    return [...text.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*:/gm)].map((match) => match[1]).slice(0, 8);
  }

  function headings(text) {
    return [...text.matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => stripMarkdown(match[1])).slice(0, 5);
  }

  function count(text, regex) {
    return [...text.matchAll(regex)].length;
  }

  function humanJoin(values) {
    if (values.length <= 1) return values[0] || "performs project logic";
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
  }

  function stripMarkup(value) {
    return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  function stripMarkdown(value) {
    return stripMarkup(String(value || "").replace(/[`*_>#-]/g, " ").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")).replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function installStyles() {
    if (document.querySelector("#file-analysis-inline-styles")) return;
    const style = document.createElement("style");
    style.id = "file-analysis-inline-styles";
    style.textContent = `
      .tree-file-info { display:grid!important; grid-template-columns:minmax(0,1fr); gap:2px; align-items:start; }
      .file-map-summary { display:block; overflow:hidden; color:var(--faint); font-size:.62rem; line-height:1.3; font-weight:400; white-space:nowrap; text-overflow:ellipsis; }
      .tree-file-row-expanded { min-height:46px!important; align-items:center!important; }
      .file-summary-detail { margin-bottom:14px; border:1px solid var(--border); border-radius:calc(var(--radius) - 3px); padding:14px 16px; background:rgba(255,255,255,.025); }
      .file-summary-detail-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
      .file-summary-detail-head strong { display:block; color:var(--accent-strong); font-size:.86rem; margin-top:2px; }
      .file-summary-detail-text { margin:8px 0 0; color:var(--muted); font-size:.78rem; line-height:1.6; }
      .file-summary-detail-note { margin:8px 0 0; padding-top:8px; border-top:1px solid var(--border); color:var(--faint); font-size:.66rem; line-height:1.5; }
      .file-summary-signals { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:5px; }
      .file-summary-signals span { border:1px solid var(--border); border-radius:999px; padding:3px 7px; color:var(--faint); font-size:.58rem; white-space:nowrap; }
    `;
    document.head.append(style);
  }
})();
