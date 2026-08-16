const WEB_PREVIEW_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";

(() => {
  const form = document.querySelector(".simplifier-form");
  const card = document.querySelector(".simplifier-card");
  if (!form || !card) return;

  let active = null;
  let buildId = 0;

  form.addEventListener("submit", () => {
    const started = performance.now();
    const poll = () => {
      const analysis = document.querySelector(".analysis-result");
      const ownerLine = analysis?.querySelector(".analysis-owner")?.textContent || "";
      const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
      if (analysis && match) {
        setupPreview(analysis, { owner: match[1], repo: match[2], branch: match[3] });
        return;
      }
      if (performance.now() - started < 8000) window.setTimeout(poll, 120);
    };
    window.setTimeout(poll, 120);
  });

  function setupPreview(analysis, repo) {
    if (analysis.querySelector(".live-web-preview")) return;
    const type = analysis.querySelector(".analysis-summary strong")?.textContent || "";
    if (!/web application|web|html|javascript|typescript/i.test(type)) return;

    const files = collectTreePaths(analysis);
    if (!files.some((item) => item.path.toLowerCase() === "index.html")) return;

    active = { analysis, repo, files };
    injectStyles();

    const panel = document.createElement("article");
    panel.className = "analysis-panel live-web-preview";
    panel.innerHTML = `
      <div class="live-preview-heading">
        <div>
          <span class="analysis-label">Live web preview</span>
          <h3>Run the repository in an isolated browser</h3>
          <p class="live-preview-sub">Used files are detected from the entry page. Disable them or enable optional files to experiment with the result.</p>
        </div>
        <span class="analysis-count" id="live-preview-status">Ready</span>
      </div>
      <div class="live-preview-layout">
        <section class="live-preview-stage">
          <div class="live-preview-toolbar">
            <span>Sandboxed preview</span>
            <div class="live-preview-actions">
              <button type="button" class="preview-action" data-preview-action="refresh">Refresh</button>
              <button type="button" class="preview-action" data-preview-action="newtab">New tab</button>
            </div>
          </div>
          <div class="live-preview-frame-wrap">
            <iframe class="live-preview-frame" title="Isolated GitHub web preview" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>
          </div>
        </section>
        <aside class="live-preview-files">
          <div class="live-preview-files-head">
            <div>
              <span class="analysis-label">Preview files</span>
              <strong id="live-preview-file-count">0 active</strong>
            </div>
            <button type="button" class="preview-action preview-action-muted" data-preview-action="reset">Reset</button>
          </div>
          <div class="live-preview-file-list" id="live-preview-file-list"></div>
        </aside>
      </div>
      <p class="live-preview-note">The preview runs in a sandboxed iframe. It cannot access the parent page. Disabling a required file may intentionally break the preview; enabling an optional file injects it into the page.</p>
    `;

    const anchor = analysis.querySelector(".project-preview-panel") || analysis.querySelector(".structure-panel");
    anchor ? anchor.insertAdjacentElement("afterend", panel) : analysis.append(panel);

    renderFileControls();
    wireActions();
    refreshPreview();
  }

  function collectTreePaths(analysis) {
    return [...analysis.querySelectorAll(".tree-row.file-row")].map((row) => {
      const name = row.querySelector(".tree-name")?.textContent?.trim() || "";
      const folderNames = [...row.closestAll?.(".tree-folder") || []];
      const ancestorFolders = [];
      let cursor = row.parentElement;
      while (cursor) {
        if (cursor.classList?.contains("tree-folder")) {
          const folder = cursor.querySelector(":scope > .folder-row .tree-name")?.textContent?.trim();
          if (folder) ancestorFolders.unshift(folder);
        }
        cursor = cursor.parentElement;
      }
      const path = [...ancestorFolders, name].filter(Boolean).join("/");
      return { path, type: "blob" };
    }).filter((item) => item.path);
  }

  function supportedFiles() {
    return (active?.files || []).filter((item) => /\.(html?|css|js|mjs|cjs|png|jpe?g|webp|gif|svg|ico)$/i.test(item.path));
  }

  function discoverUsed() {
    const used = new Set(["index.html"]);
    for (const item of supportedFiles()) {
      const lower = item.path.toLowerCase();
      if (/styles\.css$/.test(lower)) used.add(item.path);
      if (/main\.js$/.test(lower)) used.add(item.path);
      if (/^assets\/.*\.(png|jpe?g|webp|gif|svg|ico)$/.test(lower) && /avatar|favicon/.test(lower)) used.add(item.path);
    }
    return used;
  }

  function stateFor(item) {
    let stored = {};
    try {
      stored = JSON.parse(sessionStorage.getItem(storageKey()) || "{}");
    } catch {}
    const used = discoverUsed().has(item.path);
    return stored[item.path] || { enabled: used, mode: used ? "used" : "optional" };
  }

  function storageKey() {
    return `bbfraxy.preview.${active?.repo.owner}/${active?.repo.repo}`;
  }

  function saveState(path, state) {
    let stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(storageKey()) || "{}"); } catch {}
    stored[path] = state;
    try { sessionStorage.setItem(storageKey(), JSON.stringify(stored)); } catch {}
  }

  function resetState() {
    try { sessionStorage.removeItem(storageKey()); } catch {}
  }

  function renderFileControls() {
    const list = active?.analysis.querySelector("#live-preview-file-list");
    if (!list || !active) return;
    list.replaceChildren();

    const files = [...supportedFiles()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    for (const item of files) {
      const state = stateFor(item);
      const row = document.createElement("label");
      row.className = `live-preview-file ${state.enabled ? "is-enabled" : ""}`;
      row.innerHTML = `
        <input type="checkbox" ${state.enabled ? "checked" : ""}>
        <span class="live-preview-file-main">
          <span class="live-preview-file-path" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</span>
          <span class="live-preview-file-role">${state.mode === "used" ? "Used by entry page" : "Optional · can be injected"}</span>
        </span>
        <span class="live-preview-file-badge">${state.mode === "used" ? "Used" : "Optional"}</span>
      `;
      row.querySelector("input")?.addEventListener("change", (event) => {
        saveState(item.path, { enabled: event.currentTarget.checked, mode: state.mode });
        row.classList.toggle("is-enabled", event.currentTarget.checked);
        refreshPreview();
      });
      list.append(row);
    }
    updateCount();
  }

  function wireActions() {
    active?.analysis.querySelectorAll("[data-preview-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.previewAction;
        if (action === "refresh") refreshPreview();
        if (action === "newtab") openNewTab();
        if (action === "reset") {
          resetState();
          renderFileControls();
          refreshPreview();
        }
      });
    });
  }

  async function refreshPreview() {
    if (!active) return;
    const currentBuild = ++buildId;
    const frame = active.analysis.querySelector(".live-preview-frame");
    const status = active.analysis.querySelector("#live-preview-status");
    if (!frame || !status) return;

    status.textContent = "Building…";
    frame.srcdoc = loadingDocument();

    try {
      const bundle = await buildBundle();
      if (currentBuild !== buildId) return;
      frame.srcdoc = assemble(bundle);
      status.textContent = `${bundle.length} files active`;
      updateCount();
    } catch (error) {
      if (currentBuild !== buildId) return;
      status.textContent = "Preview failed";
      frame.srcdoc = errorDocument(error instanceof Error ? error.message : "Preview could not be built.");
    }
  }

  async function buildBundle() {
    const enabled = supportedFiles().filter((item) => stateFor(item).enabled);
    if (!enabled.some((item) => item.path.toLowerCase() === "index.html")) {
      throw new Error("index.html is not enabled. Re-enable it to build the web preview.");
    }

    const bundle = [];
    for (const item of enabled) {
      const payload = await fetchFile(item.path);
      bundle.push({
        path: item.path,
        text: payload.text || "",
        binaryDataUrl: payload.data_url || payload.dataUrl || null,
        mode: stateFor(item).mode,
      });
    }
    return bundle;
  }

  async function fetchFile(path) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const url = `${WEB_PREVIEW_API}/repo/${encodeURIComponent(active.repo.owner)}/${encodeURIComponent(active.repo.repo)}/file/${encoded}?branch=${encodeURIComponent(active.repo.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Could not load ${path} (${response.status}).`);
    return payload;
  }

  function assemble(bundle) {
    const map = new Map(bundle.map((file) => [normalize(file.path), file]));
    const html = map.get("index.html");
    if (!html) throw new Error("index.html could not be loaded.");

    const parser = new DOMParser();
    const doc = parser.parseFromString(html.text, "text/html");

    doc.querySelectorAll("link[rel=stylesheet][href]").forEach((link) => {
      const ref = normalize(resolveRelative("index.html", link.getAttribute("href")));
      const file = map.get(ref);
      if (!file || !/\.css$/i.test(file.path)) return;
      const style = doc.createElement("style");
      style.dataset.previewFile = file.path;
      style.textContent = rewriteCss(file.text, file.path, map);
      link.replaceWith(style);
    });

    doc.querySelectorAll("script[src]").forEach((script) => {
      const ref = normalize(resolveRelative("index.html", script.getAttribute("src")));
      const file = map.get(ref);
      if (!file || !/\.(js|mjs|cjs)$/i.test(file.path)) return;
      const inline = doc.createElement("script");
      inline.dataset.previewFile = file.path;
      inline.textContent = file.text;
      script.replaceWith(inline);
    });

    doc.querySelectorAll("img[src],source[src],video[src],audio[src]").forEach((element) => {
      const ref = normalize(resolveRelative("index.html", element.getAttribute("src")));
      const file = map.get(ref);
      if (!file) return;
      if (file.binaryDataUrl) element.setAttribute("src", file.binaryDataUrl);
      else if (file.text) element.setAttribute("src", `data:${contentType(file.path)};charset=utf-8,${encodeURIComponent(file.text)}`);
    });

    doc.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (/^(\/|\.\/|\.\.\/)/.test(href)) {
        link.addEventListener("click", (event) => event.preventDefault());
        link.setAttribute("href", "#preview-navigation-disabled");
      }
    });

    for (const file of bundle) {
      if (file.path.toLowerCase() === "index.html" || file.mode !== "optional") continue;
      if (/\.css$/i.test(file.path)) {
        const style = doc.createElement("style");
        style.dataset.injectedPreviewFile = file.path;
        style.textContent = rewriteCss(file.text, file.path, map);
        doc.head.append(style);
      } else if (/\.(js|mjs|cjs)$/i.test(file.path)) {
        const script = doc.createElement("script");
        script.dataset.injectedPreviewFile = file.path;
        script.textContent = file.text;
        doc.body.append(script);
      }
    }

    return `<!doctype html>${doc.documentElement.outerHTML}`;
  }

  function rewriteCss(css, cssPath, map) {
    return String(css || "").replace(/url\(([^)]+)\)/gi, (full, raw) => {
      const value = String(raw).trim().replace(/^["']|["']$/g, "");
      if (/^(data:|https?:|#|blob:|\/\/)/i.test(value)) return full;
      const file = map.get(normalize(resolveRelative(cssPath, value)));
      if (!file) return full;
      if (file.binaryDataUrl) return `url("${file.binaryDataUrl}")`;
      return `url("data:${contentType(file.path)};charset=utf-8,${encodeURIComponent(file.text || "")}")`;
    });
  }

  function resolveRelative(from, ref) {
    if (!ref || /^(https?:|data:|blob:|#|\/\/)/i.test(ref)) return ref;
    const base = from.split("/");
    base.pop();
    for (const part of String(ref).split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") base.pop();
      else base.push(part);
    }
    return base.join("/");
  }

  function normalize(path) {
    return String(path || "").replace(/^\.\//, "").replace(/^\//, "");
  }

  function contentType(path) {
    const ext = String(path).split(".").pop()?.toLowerCase();
    return ({
      html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", cjs: "text/javascript",
      svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", ico: "image/x-icon",
    })[ext] || "text/plain";
  }

  function updateCount() {
    const count = active?.analysis.querySelector("#live-preview-file-count");
    if (!count || !active) return;
    const files = supportedFiles();
    const enabled = files.filter((item) => stateFor(item).enabled).length;
    count.textContent = `${enabled} active · ${files.length} available`;
  }

  async function openNewTab() {
    await refreshPreview();
    const frame = active?.analysis.querySelector(".live-preview-frame");
    if (!frame?.srcdoc) return;
    const blob = new Blob([frame.srcdoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function loadingDocument() {
    return '<style>html,body{height:100%;margin:0;background:#050607;color:#d8e4e8;font:14px system-ui;display:grid;place-items:center}body:after{content:"Building preview…";opacity:.65}</style>';
  }

  function errorDocument(message) {
    return `<style>html,body{height:100%;margin:0;background:#050607;color:#ffbcbc;font:14px system-ui;padding:24px;box-sizing:border-box}pre{white-space:pre-wrap}</style><pre>${escapeHtml(message)}</pre>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function injectStyles() {
    if (document.querySelector("#live-web-preview-styles")) return;
    const style = document.createElement("style");
    style.id = "live-web-preview-styles";
    style.textContent = `
      .live-web-preview{display:grid;gap:14px}
      .live-preview-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .live-preview-heading h3{margin:0;color:var(--text);font-size:1.05rem}
      .live-preview-sub{margin:6px 0 0;color:var(--muted);font-size:.76rem;line-height:1.55}
      .live-preview-sub strong{color:var(--text)}
      .live-preview-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px}
      .live-preview-stage,.live-preview-files{min-width:0;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:rgba(255,255,255,.02)}
      .live-preview-toolbar,.live-preview-files-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.07);color:var(--faint);font-size:.66rem}
      .live-preview-actions{display:flex;gap:6px}.preview-action{min-height:30px;border:1px solid var(--border);border-radius:8px;padding:0 9px;color:var(--muted);background:rgba(255,255,255,.025);font:inherit;font-size:.66rem;cursor:pointer}.preview-action:hover{border-color:var(--border-strong);color:var(--text)}
      .live-preview-frame-wrap{min-height:560px;background:#050607}.live-preview-frame{display:block;width:100%;height:560px;border:0;background:#fff}
      .live-preview-file-list{max-height:560px;overflow:auto;padding:8px}.live-preview-file{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid transparent;border-radius:8px;cursor:pointer}.live-preview-file:hover{background:rgba(95,231,255,.035);border-color:var(--border)}.live-preview-file input{accent-color:var(--accent)}
      .live-preview-file-main{min-width:0;display:grid;gap:3px;flex:1}.live-preview-file-path{overflow:hidden;color:var(--text);font-size:.66rem;text-overflow:ellipsis;white-space:nowrap}.live-preview-file-role{color:var(--faint);font-size:.56rem}.live-preview-file-badge{flex:0 0 auto;border:1px solid var(--border);border-radius:999px;padding:3px 6px;color:var(--faint);font-size:.54rem}.live-preview-file.is-enabled .live-preview-file-badge{border-color:rgba(95,231,255,.22);color:var(--accent-strong);background:rgba(95,231,255,.04)}
      .live-preview-note{margin:0;color:var(--faint);font-size:.68rem;line-height:1.55}
      @media(max-width:900px){.live-preview-layout{grid-template-columns:1fr}.live-preview-file-list{max-height:320px}}
      @media(max-width:620px){.live-preview-heading{flex-direction:column}.live-preview-frame-wrap,.live-preview-frame{height:420px;min-height:420px}}
    `;
    document.head.append(style);
  }
})();