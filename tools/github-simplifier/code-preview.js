(() => {
  const API_BASE = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
  const MAX_FILE_BYTES = 180000;
  const MAX_ALL_CODE_BYTES = 8000000;
  const LANGUAGE_MAP = {
    js: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript", tsx: "typescript", jsx: "javascript",
    html: "html", htm: "html", css: "css", scss: "css", less: "css", json: "json",
    py: "python", cs: "csharp", java: "java", kt: "kotlin", rs: "rust", go: "go", cpp: "cpp", c: "c",
    h: "cpp", hpp: "cpp", php: "php", rb: "ruby", swift: "swift", xml: "xml", svg: "xml", md: "markdown",
    yaml: "yaml", yml: "yaml", toml: "toml", ini: "ini", cfg: "ini", txt: "text", sh: "shell", bat: "bat", ps1: "powershell"
  };

  let mounted = false;
  let repository = null;
  let tree = [];
  const fileCache = new Map();
  let filteredFiles = [];

  const observer = new MutationObserver(() => {
    if (mounted) return;
    const analysis = document.querySelector(".analysis-result");
    if (!analysis) return;
    mounted = true;
    observer.disconnect();
    mount(analysis);
  });

  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();

  async function mount(analysis) {
    const ownerLine = analysis.querySelector(".analysis-owner")?.textContent || "";
    const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
    if (!match) return;

    repository = { owner: match[1], repo: match[2], branch: match[3] };

    const panel = document.createElement("section");
    panel.className = "code-workspace-panel";
    panel.innerHTML = `
      <div class="code-workspace-head">
        <div>
          <span class="analysis-label">Code preview · A+B</span>
          <h3>Explore the complete codebase</h3>
          <p class="code-workspace-sub">Browse every source file from the repository with lightweight syntax highlighting. Files load on demand.</p>
        </div>
        <div class="code-workspace-actions">
          <button type="button" class="code-action code-load-all">Load all code</button>
          <button type="button" class="code-action code-collapse">Collapse</button>
        </div>
      </div>
      <div class="code-workspace-toolbar">
        <input class="code-search" type="search" placeholder="Search files…" aria-label="Search files">
        <span class="code-count"></span>
      </div>
      <div class="code-workspace">
        <aside class="code-sidebar" aria-label="Repository files">
          <div class="code-sidebar-empty">Loading repository files…</div>
        </aside>
        <section class="code-editor" aria-live="polite">
          <div class="code-editor-head">
            <div class="code-editor-title">Select a file</div>
            <div class="code-editor-meta"></div>
          </div>
          <div class="code-editor-body"><div class="code-empty-state">Choose a file from the repository tree.</div></div>
        </section>
      </div>
      <p class="code-workspace-note">Syntax highlighting is visual assistance only; the preview never executes repository code in the BBFRAXY page.</p>
    `;

    analysis.insertAdjacentElement("afterend", panel);
    installStyles();

    const search = panel.querySelector(".code-search");
    const sidebar = panel.querySelector(".code-sidebar");
    const count = panel.querySelector(".code-count");
    const loadAll = panel.querySelector(".code-load-all");
    const collapse = panel.querySelector(".code-collapse");

    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      filteredFiles = query ? tree.filter((item) => item.type === "blob" && item.path.toLowerCase().includes(query)) : tree.filter((item) => item.type === "blob");
      renderSidebar(sidebar, count);
    });

    collapse.addEventListener("click", () => {
      panel.querySelectorAll("details.code-folder").forEach((node) => { node.open = false; });
    });

    loadAll.addEventListener("click", () => loadAllFiles(panel, loadAll));

    try {
      const response = await fetch(`${API_BASE}/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/tree`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Repository tree could not be loaded (${response.status}).`);
      const payload = await response.json();
      tree = Array.isArray(payload.tree) ? payload.tree.filter((item) => item.type === "blob" && !isGenerated(item.path)) : [];
      filteredFiles = tree.slice();
      renderSidebar(sidebar, count);
    } catch (error) {
      sidebar.innerHTML = `<div class="code-sidebar-empty">${escapeHtml(error.message || "Repository files could not be loaded.")}</div>`;
    }
  }

  function renderSidebar(sidebar, count) {
    sidebar.replaceChildren();
    const groups = buildFileGroups(filteredFiles);
    let visible = 0;

    for (const [folder, files] of groups) {
      const details = document.createElement("details");
      details.className = "code-folder";
      details.open = folder === ".";

      const summary = document.createElement("summary");
      summary.className = "code-folder-row";
      summary.innerHTML = `<span class="code-folder-chevron">›</span><span class="code-folder-name">${escapeHtml(folder)}</span><span class="code-folder-count">${files.length}</span>`;
      details.append(summary);

      const body = document.createElement("div");
      body.className = "code-folder-files";
      files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));

      for (const item of files) {
        visible += 1;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "code-file-row";
        button.innerHTML = `<span class="code-file-icon">◇</span><span class="code-file-name">${escapeHtml(item.name || item.path.split("/").pop())}</span><span class="code-file-lang">${escapeHtml(languageLabel(item.path))}</span>`;
        button.title = item.path;
        button.addEventListener("click", () => openFile(item));
        body.append(button);
      }

      details.append(body);
      sidebar.append(details);
    }

    if (!visible) sidebar.innerHTML = `<div class="code-sidebar-empty">No files match this search.</div>`;
    count.textContent = `${visible} file${visible === 1 ? "" : "s"}`;
  }

  function buildFileGroups(files) {
    const groups = new Map();
    for (const item of files) {
      const parts = item.path.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(item);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
  }

  async function openFile(item) {
    const title = document.querySelector(".code-editor-title");
    const meta = document.querySelector(".code-editor-meta");
    const body = document.querySelector(".code-editor-body");
    if (!title || !meta || !body) return;

    title.textContent = item.path;
    meta.textContent = `${languageLabel(item.path)} · ${formatBytes(item.size || 0)}`;
    body.innerHTML = `<div class="code-empty-state">Loading ${escapeHtml(item.path)}…</div>`;

    if (item.size > MAX_FILE_BYTES) {
      body.innerHTML = `<div class="code-empty-state">This file is too large for browser preview. Open it directly on GitHub instead.</div>`;
      return;
    }

    try {
      const text = await fetchFileText(item);
      body.innerHTML = `<div class="code-line-wrap">${highlightWithLineNumbers(text, languageFor(item.path))}</div>`;
      body.querySelectorAll(".code-copy").forEach((button) => button.addEventListener("click", () => copyText(text, button)));
    } catch (error) {
      body.innerHTML = `<div class="code-empty-state">${escapeHtml(error.message || "File preview failed.")}</div>`;
    }
  }

  async function loadAllFiles(panel, button) {
    button.disabled = true;
    button.textContent = "Loading…";
    const files = tree.slice();
    let totalBytes = 0;
    let loaded = 0;

    try {
      for (const item of files) {
        if (item.size > MAX_FILE_BYTES) continue;
        totalBytes += item.size || 0;
        if (totalBytes > MAX_ALL_CODE_BYTES) break;
        try {
          await fetchFileText(item);
          loaded += 1;
          button.textContent = `Loaded ${loaded}/${files.length}`;
        } catch {
          // Keep loading the rest; individual files can still be opened on demand.
        }
      }
      button.textContent = `Loaded ${loaded}`;
    } finally {
      button.disabled = false;
      window.setTimeout(() => { button.textContent = "Load all code"; }, 1800);
    }
  }

  async function fetchFileText(item) {
    if (fileCache.has(item.path)) return fileCache.get(item.path);
    const url = `${API_BASE}/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/file/${item.path.split("/").map(encodeURIComponent).join("/")}?branch=${encodeURIComponent(repository.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Preview failed (${response.status}).`);
    const text = typeof payload.text === "string" ? payload.text : "";
    fileCache.set(item.path, text);
    return text;
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = original; }, 1200);
    } catch {
      button.textContent = "Copy failed";
    }
  }

  function highlightWithLineNumbers(text, language) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    return lines.map((line, index) => {
      const highlighted = highlightLine(line, language);
      return `<div class="code-line"><span class="code-ln">${index + 1}</span><span class="code-src">${highlighted || " "}</span></div>`;
    }).join("") + `<div class="code-copybar"><button type="button" class="code-copy">Copy file</button></div>`;
  }

  function highlightLine(line, language) {
    const escaped = escapeHtml(line);
    if (language === "json") return colorize(escaped, [/(\"(?:[^\"\\]|\\.)*\")(?=\s*:)/g, "string", /(\"(?:[^\"\\]|\\.)*\")/g, "string", /\b(?:true|false|null)\b/g, "keyword", /-?\b\d+(?:\.\d+)?\b/g, "number"]);
    if (language === "html" || language === "xml") return colorize(escaped, [/&lt;\/?[A-Za-z][^&]*?&gt;/g, "tag", /&lt;!--.*?--&gt;/g, "comment"]);
    if (language === "css") return colorize(escaped, [/\/\/.*$/g, "comment", /\/\*[\s\S]*?\*\//g, "comment", /#[0-9a-fA-F]{3,8}\b/g, "number", /\b(?:margin|padding|display|position|color|background|font-size|width|height)\b/g, "property"]);
    if (language === "markdown") return colorize(escaped, [/^\s{0,3}#{1,6}.*$/g, "heading", /\*\*[^*]+\*\*|__[^_]+__/g, "strong", /`[^`]+`/g, "string"]);
    if (language === "ini") return colorize(escaped, [/^\s*[#;].*$/g, "comment", /^\s*\[[^\]]+\]/g, "section", /^\s*[A-Za-z0-9_.-]+(?=\s*=)/g, "property"]);
    return colorize(escaped, [/\/\/.*$/g, "comment", /#.*$/g, "comment", /\/\*.*?\*\//g, "comment", /\b(?:const|let|var|function|return|if|else|for|while|class|public|private|protected|using|namespace|new|this|async|await|import|from|export|extends|static|void|int|float|string|bool|true|false|null|undefined|def|try|catch|throw|switch|case|break|continue)\b/g, "keyword", /\b\d+(?:\.\d+)?\b/g, "number", /'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"|`(?:[^`\\]|\\.)*`/g, "string"]);
  }

  function colorize(text, rules) {
    let output = text;
    const placeholders = [];
    for (let index = 0; index < rules.length; index += 2) {
      const regex = rules[index];
      const className = rules[index + 1];
      output = output.replace(regex, (match) => {
        const token = `\u0000${placeholders.length}\u0000`;
        placeholders.push(`<span class="tok-${className}">${match}</span>`);
        return token;
      });
    }
    placeholders.forEach((html, index) => { output = output.replaceAll(`\u0000${index}\u0000`, html); });
    return output;
  }

  function languageFor(path) {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return LANGUAGE_MAP[ext] || "text";
  }

  function languageLabel(path) {
    const language = languageFor(path);
    return language === "text" ? "Text" : language.charAt(0).toUpperCase() + language.slice(1);
  }

  function isGenerated(path) {
    const lower = path.toLowerCase();
    return lower.split("/").some((part) => ["node_modules", ".git", "dist", "build", "bin", "obj"].includes(part));
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (document.getElementById("bbfraxy-code-preview-styles")) return;
    const style = document.createElement("style");
    style.id = "bbfraxy-code-preview-styles";
    style.textContent = `
      .code-workspace-panel{width:min(100%,900px);margin:0 auto;border:1px solid var(--border);border-radius:var(--radius);background:linear-gradient(180deg,rgba(255,255,255,.04),transparent 52%),var(--surface);box-shadow:0 16px 50px var(--shadow);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);padding:22px;}
      .code-workspace-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}.code-workspace-head h3{margin:0;color:var(--text);font-size:1.08rem}.code-workspace-sub{margin:5px 0 0;color:var(--faint);font-size:.72rem;line-height:1.5}.code-workspace-actions{display:flex;gap:8px;flex:0 0 auto}.code-action{border:1px solid var(--border);border-radius:10px;padding:8px 11px;color:var(--muted);background:rgba(255,255,255,.035);font:inherit;font-size:.7rem;cursor:pointer}.code-action:hover:not(:disabled){border-color:var(--border-strong);color:var(--text)}.code-action:disabled{opacity:.6;cursor:wait}
      .code-workspace-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:10px}.code-search{min-width:0;flex:1;height:38px;border:1px solid var(--border);border-radius:10px;padding:0 11px;color:var(--text);background:rgba(255,255,255,.03);font:inherit;font-size:.75rem;outline:none}.code-search:focus{border-color:var(--border-strong);box-shadow:0 0 20px var(--glow)}.code-count{color:var(--faint);font-size:.68rem;white-space:nowrap}
      .code-workspace{display:grid;grid-template-columns:minmax(210px,.45fr) minmax(0,1.55fr);min-height:520px;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;background:#05080a}.code-sidebar{border-right:1px solid rgba(255,255,255,.07);overflow:auto;padding:7px}.code-editor{min-width:0;display:flex;flex-direction:column}.code-editor-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:42px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02)}.code-editor-title{min-width:0;overflow:hidden;color:var(--text);font-size:.72rem;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.code-editor-meta{color:var(--faint);font-size:.64rem;white-space:nowrap}.code-editor-body{min-width:0;flex:1;overflow:auto}.code-folder{margin:2px 0}.code-folder summary{list-style:none}.code-folder summary::-webkit-details-marker{display:none}.code-folder-row{display:flex;align-items:center;gap:6px;width:100%;min-height:30px;padding:0 7px;border-radius:7px;color:var(--muted);cursor:pointer;font-size:.68rem}.code-folder-row:hover{background:rgba(255,255,255,.035);color:var(--text)}.code-folder-chevron{width:10px;color:var(--faint)}.code-folder[open]>.code-folder-row .code-folder-chevron{transform:rotate(90deg)}.code-folder-count{margin-left:auto;color:var(--faint);font-size:.6rem}.code-folder-files{display:grid;gap:2px;margin-left:12px;padding-left:8px;border-left:1px solid rgba(255,255,255,.06)}.code-file-row{display:grid;grid-template-columns:12px minmax(0,1fr) auto;align-items:center;gap:5px;min-height:30px;width:100%;border:0;border-radius:7px;padding:0 7px;color:var(--muted);background:transparent;text-align:left;font:inherit;cursor:pointer}.code-file-row:hover{background:rgba(95,231,255,.04);color:var(--text)}.code-file-icon{color:var(--accent);font-size:.7rem}.code-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.67rem}.code-file-lang{color:var(--faint);font-size:.55rem}.code-sidebar-empty,.code-empty-state{padding:28px 16px;color:var(--faint);text-align:center;font-size:.72rem}.code-line-wrap{min-width:max-content;padding:10px 0 30px;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#d8e4e8}.code-line{display:grid;grid-template-columns:46px auto;min-height:20px}.code-ln{padding:0 12px 0 8px;color:#56636a;text-align:right;user-select:none;border-right:1px solid rgba(255,255,255,.045)}.code-src{padding:0 14px;white-space:pre}.tok-keyword{color:#77dfff}.tok-string{color:#a7e3a2}.tok-number{color:#d8a8ff}.tok-comment{color:#6c7b82;font-style:italic}.tok-tag{color:#78d7ff}.tok-property{color:#e4d694}.tok-heading{color:#8eeaff;font-weight:700}.tok-strong{color:#f0f7f8;font-weight:700}.tok-section{color:#ffcf84}.code-copybar{position:sticky;right:0;bottom:0;display:flex;justify-content:flex-end;padding:8px 12px;background:linear-gradient(180deg,transparent,#05080a 35%)}.code-copy{border:1px solid var(--border);border-radius:8px;padding:6px 9px;color:var(--muted);background:rgba(255,255,255,.04);font:inherit;font-size:.62rem;cursor:pointer}.code-copy:hover{color:var(--text);border-color:var(--border-strong)}.code-workspace-note{margin:10px 2px 0;color:var(--faint);font-size:.65rem;line-height:1.5}
      @media (max-width:760px){.code-workspace-head{align-items:flex-start;flex-direction:column}.code-workspace-actions{width:100%}.code-action{flex:1}.code-workspace{grid-template-columns:1fr;min-height:0}.code-sidebar{max-height:240px;border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}.code-editor{min-height:420px}.code-workspace-toolbar{align-items:stretch;flex-direction:column}.code-count{align-self:flex-start}}
    `;
    document.head.append(style);
  }
})();
