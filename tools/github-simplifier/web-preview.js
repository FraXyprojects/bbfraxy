const WEB_PREVIEW_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";

(() => {
  const form = document.querySelector(".simplifier-form");
  const card = document.querySelector(".simplifier-card");
  if (!form || !card) return;

  let activeAnalysis = null;
  let lastBuildId = 0;

  form.addEventListener("submit", () => waitForAnalysis());

  function waitForAnalysis() {
    const started = performance.now();
    const check = () => {
      const analysis = document.querySelector(".analysis-result");
      const owner = analysis?.querySelector(".analysis-owner")?.textContent || "";
      const match = owner.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
      if (analysis && match) {
        buildPreviewShell(analysis, { owner: match[1], repo: match[2], branch: match[3] });
        return;
      }
      if (performance.now() - started < 7000) window.setTimeout(check, 120);
    };
    window.setTimeout(check, 120);
  }

  async function buildPreviewShell(analysis, repo) {
    if (analysis.querySelector(".live-web-preview")) return;
    const projectType = analysis.querySelector(".analysis-summary strong")?.textContent || "";
    if (!/web application|web|html|javascript|typescript/i.test(projectType)) return;
    const tree = collectTree(analysis);
    if (!tree.some((item) => item.path.toLowerCase() === "index.html")) return;

    activeAnalysis = { analysis, repo, tree };

    const panel = document.createElement("article");
    panel.className = "analysis-panel live-web-preview";
    panel.innerHTML = `
      <div class="live-preview-heading">
        <div>
          <span class="analysis-label">Live web preview</span>
          <h3>Run the repository in an isolated browser</h3>
          <p class="live-preview-sub">Files marked <strong>Used</strong> are the files the preview expects. Disable them or add optional files to experiment with the result.</p>
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
      <p class="live-preview-note">The preview runs inside a sandboxed iframe. It cannot access the parent page. Removing a required file may intentionally break the preview; adding an optional CSS/JS file injects it into the page so you can experiment.</p>
    `;

    const previewPanel = analysis.querySelector(".project-preview-panel") || analysis.querySelector(".structure-panel");
    if (previewPanel) previewPanel.insertAdjacentElement("afterend", panel);
    else analysis.append(panel);

    addStyles();
    renderFileControls();
    wireActions();
    await refreshPreview();
  }

  function collectTree(analysis) {
    return [...analysis.querySelectorAll(".tree-row.file-row")].map((row) => ({
      path: row.querySelector(".tree-name")?.textContent || "",
      type: "blob",
    }));
  }

  function discoverUsedFiles(supported) {
    const used = new Set(["index.html"]);
    const indexLinks = supported.map((item) => item.path);
    for (const path of indexLinks) {
      const lower = path.toLowerCase();
      if (/styles\.css$/.test(lower)) used.add(path);
      if (/main\.js$/.test(lower)) used.add(path);
      if (/^assets\/.*\.(png|jpe?g|webp|gif|svg)$/.test(lower) && /avatar|favicon/.test(lower)) used.add(path);
    }
    return used;
  }

  function renderFileControls() {
    const container = activeAnalysis?.analysis.querySelector("#live-preview-file-list");
    if (!container || !activeAnalysis) return;

    const supported = activeAnalysis.tree.filter((item) => isPreviewCandidate(item.path));
    const defaults = discoverUsedFiles(supported);
    const stored = readSessionFileState();
    const state = new Map();

    for (const file of supported) {
      const defaultEnabled = defaults.has(file.path);
      state.set(file.path, stored.get(file.path) || { enabled: defaultEnabled, mode: defaultEnabled ? "used" : "optional" });
    }

    container.replaceChildren();
    for (const file of supported.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))) {
      const itemState = state.get(file.path) || { enabled: false, mode: "optional" };
      const row = document.createElement("label");
      row.className = `live-preview-file ${itemState.enabled ? "is-enabled" : ""}`;
      row.innerHTML = `
        <input type="checkbox" ${itemState.enabled ? "checked" : ""}>
        <span class="live-preview-file-main">
          <span class="live-preview-file-path">${escapeHtml(file.path)}</span>
          <span class="live-preview-file-role">${itemState.mode === "used" ? "Used by entry page" : "Optional · can be injected"}</span>
        </span>
        <span class="live-preview-file-badge">${itemState.mode === "used" ? "Used" : "Optional"}</span>
      `;
      row.querySelector("input")?.addEventListener("change", (event) => {
        const next = readSessionFileState();
        next.set(file.path, { enabled: event.currentTarget.checked, mode: itemState.mode });
        saveSessionFileState(next);
        row.classList.toggle("is-enabled", event.currentTarget.checked);
        refreshPreview();
      });
      container.append(row);
    }
    updateActiveCount(state);
  }

  function readSessionFileState() {
    try {
      const key = `bbfraxy.preview.${activeAnalysis?.repo.owner}/${activeAnalysis?.repo.repo}`;
      const raw = sessionStorage.getItem(key);
      return new Map(Object.entries(JSON.parse(raw || "{}")));
    } catch {
      return new Map();
    }
  }

  function saveSessionFileState(map) {
    try {
      const key = `bbfraxy.preview.${activeAnalysis?.repo.owner}/${activeAnalysis?.repo.repo}`;
      sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
    } catch {
      // Optional persistence.
    }
  }

  function wireActions() {
    activeAnalysis?.analysis.querySelectorAll("[data-preview-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.previewAction;
        if (action === "refresh") refreshPreview();
        if (action === "newtab") openPreviewInNewTab();
        if (action === "reset") {
          try {
            sessionStorage.removeItem(`bbfraxy.preview.${activeAnalysis.repo.owner}/${activeAnalysis.repo.repo}`);
          } catch {}
          renderFileControls();
          refreshPreview();
        }
      });
    });
  }

  async function refreshPreview() {
    if (!activeAnalysis) return;
    const buildId = ++lastBuildId;
    const frame = activeAnalysis.analysis.querySelector(".live-preview-frame");
    const status = activeAnalysis.analysis.querySelector("#live-preview-status");
    if (!frame) return;

    status.textContent = "Building…";
    frame.srcdoc = "<style>html,body{height:100%;margin:0;background:#050607;color:#d8e4e8;font:14px system-ui;display:grid;place-items:center}body:after{content:'Building preview…';opacity:.65}</style>";

    try {
      const files = await buildFileBundle();
      if (buildId !== lastBuildId) return;
      frame.srcdoc = assemblePreview(files);
      status.textContent = `${files.length} files active`;
      updateActiveCount();
    } catch (error) {
      if (buildId !== lastBuildId) return;
      status.textContent = "Preview failed";
      frame.srcdoc = `<style>html,body{height:100%;margin:0;background:#050607;color:#ffbcbc;font:14px system-ui;padding:24px;box-sizing:border-box}pre{white-space:pre-wrap}</style><pre>${escapeHtml(error instanceof Error ? error.message : "Preview could not be built.")}</pre>`;
    }
  }

  async function buildFileBundle() {
    const supported = activeAnalysis.tree.filter((item) => isPreviewCandidate(item.path));
    const defaults = discoverUsedFiles(supported);
    const stored = readSessionFileState();
    const state = new Map();

    for (const file of supported) {
      const defaultEnabled = defaults.has(file.path);
      state.set(file.path, stored.get(file.path) || { enabled: defaultEnabled, mode: defaultEnabled ? "used" : "optional" });
    }

    const enabled = supported.filter((item) => state.get(item.path)?.enabled);
    const files = [];

    for (const item of enabled) {
      const payload = await fetchFile(item.path);
      files.push({
        path: item.path,
        text: payload.text || "",
        contentType: getContentType(item.path),
        mode: state.get(item.path)?.mode || "optional",
      });
    }

    if (!files.some((file) => file.path.toLowerCase() === "index.html")) {
      throw new Error("index.html is not enabled. Re-enable it to build the web preview.");
    }

    return files;
  }

  async function fetchFile(path) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const url = `${WEB_PREVIEW_API}/repo/${encodeURIComponent(activeAnalysis.repo.owner)}/${encodeURIComponent(activeAnalysis.repo.repo)}/file/${encoded}?branch=${encodeURIComponent(activeAnalysis.repo.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Could not load ${path} (${response.status}).`);
    return payload;
  }

  function assemblePreview(files) {
    const fileMap = new Map(files.map((file) => [normalizePath(file.path), file]));
    const htmlFile = fileMap.get("index.html");
    if (!htmlFile) throw new Error("index.html was not loaded.");

    const parser = new DOMParser();
    const documentNode = parser.parseFromString(htmlFile.text, "text/html");

    documentNode.querySelectorAll("link[rel=stylesheet][href]").forEach((link) => {
      const ref = resolveRelative("index.html", link.getAttribute("href"));
      const file = fileMap.get(normalizePath(ref));
      if (!file) return;
      const style = documentNode.createElement("style");
      style.textContent = file.text;
      link.replaceWith(style);
    });

    documentNode.querySelectorAll("script[src]").forEach((script) => {
      const ref = resolveRelative("index.html", script.getAttribute("src"));
      const file = fileMap.get(normalizePath(ref));
      if (!file) return;
      const inline = documentNode.createElement("script");
      inline.textContent = file.text;
      script.replaceWith(inline);
    });

    documentNode.querySelectorAll("img[src], source[src], video[src], audio[src]").forEach((element) => {
      const ref = resolveRelative("index.html", element.getAttribute("src"));
      const file = fileMap.get(normalizePath(ref));
      if (!file) return;
      if (file.binaryDataUrl) element.setAttribute("src", file.binaryDataUrl);
      else element.setAttribute("src", `data:${getContentType(file.path)};charset=utf-8,${encodeURIComponent(file.text)}`);
    });

    documentNode.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("/") || href.startsWith("./") || href.startsWith("../")) {
        link.setAttribute("href", "#preview-navigation-disabled");
      }
    });

    for (const file of files) {
      if (file.mode !== "optional" || file.path.toLowerCase() === "index.html") continue;
      if (/\.css$/i.test(file.path)) {
        const style = documentNode.createElement("style");
        style.dataset.injectedPreviewFile = file.path;
        style.textContent = file.text;
        documentNode.body.append(style);
      } else if (/\.(js|mjs|cjs)$/i.test(file.path)) {
        const script = documentNode.createElement("script");
        script.dataset.injectedPreviewFile = file.path;
        script.textContent = file.text;
        documentNode.body.append(script);
      }
    }

    return `<!doctype html>${documentNode.documentElement.outerHTML}`;
  }

  function resolveRelative(from, ref) {
    if (!ref || /^(https?:|data:|blob:|#|\/\/)/i.test(ref)) return ref;
    const base = from.split("/");
    base.pop();
    for (const part of ref.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") base.pop();
      else base.push(part);
    }
    return base.join("/");
  }

  function normalizePath(path) {
    return String(path || "").replace(/^\.\//, "").replace(/^\//, "");
  }

  function isPreviewCandidate(path) {
    return /\.(html?|css|js|mjs|cjs|json|png|jpe?g|webp|gif|svg|ico)$/i.test(path) || path.toLowerCase() === "index.html";
  }

  function getContentType(path) {
    const ext = path.split(".").pop()?.toLowerCase();
    const map = {
      html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", cjs: "text/javascript",
      json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", ico: "image/x-icon",
    };
    return map[ext] || "text/plain";
  }

  function updateActiveCount(state) {
    const count = activeAnalysis?.analysis.querySelector("#live-preview-file-count");
    if (!count || !activeAnalysis) return;
    const supported = activeAnalysis.tree.filter((item) => isPreviewCandidate(item.path));
    const current = state || (() => {
      const defaults = discoverUsedFiles(supported);
      const stored = readSessionFileState();
      const map = new Map();
      for (const file of supported) map.set(file.path, stored.get(file.path) || { enabled: defaults.has(file.path), mode: defaults.has(file.path) ? "used" : "optional" });
      return map;
    })();
    const active = supported.filter((item) => current.get(item.path)?.enabled).length;
    count.textContent = `${active} active · ${supported.length} available`;
  }

  async function openPreviewInNewTab() {
    if (!activeAnalysis) return;
    await refreshPreview();
    const frame = activeAnalysis.analysis.querySelector(".live-preview-frame");
    if (!frame) return;
    const blob = new Blob([frame.srcdoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function addStyles() {
    if (document.querySelector("#live-web-preview-styles")) return;
    const style = document.createElement("style");
    style.id = "live-web-preview-styles";
    style.textContent = `
      .live-web-preview{display:grid;gap:14px}.live-preview-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.live-preview-heading h3{margin:0;color:var(--text);font-size:1.05rem}.live-preview-sub{margin:6px 0 0;color:var(--muted);font-size:.76rem;line-height:1.55}.live-preview-layout{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:12px}.live-preview-stage,.live-preview-files{min-width:0;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:rgba(255,255,255,.02)}.live-preview-toolbar,.live-preview-files-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.07);color:var(--faint);font-size:.66rem}.live-preview-actions{display:flex;gap:6px}.preview-action{min-height:30px;border:1px solid var(--border);border-radius:8px;padding:0 9px;color:var(--muted);background:rgba(255,255,255,.025);font:inherit;font-size:.66rem;cursor:pointer}.preview-action:hover{border-color:var(--border-strong);color:var(--text)}.live-preview-frame-wrap{min-height:520px;background:#050607}.live-preview-frame{display:block;width:100%;height:520px;border:0;background:#fff}.live-preview-file-list{max-height:520px;overflow:auto;padding:8px}.live-preview-file{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid transparent;border-radius:8px;cursor:pointer}.live-preview-file:hover{background:rgba(95,231,255,.035);border-color:var(--border)}.live-preview-file input{accent-color:var(--accent)}.live-preview-file-main{min-width:0;display:grid;gap:3px;flex:1}.live-preview-file-path{overflow:hidden;color:var(--text);font-size:.68rem;text-overflow:ellipsis;white-space:nowrap}.live-preview-file-role{color:var(--faint);font-size:.58rem}.live-preview-file-badge{flex:0 0 auto;border:1px solid var(--border);border-radius:999px;padding:3px 6px;color:var(--faint);font-size:.54rem}.live-preview-file.is-enabled .live-preview-file-badge{border-color:rgba(95,231,255,.22);color:var(--accent-strong);background:rgba(95,231,255,.04)}.live-preview-note{margin:0;color:var(--faint);font-size:.68rem;line-height:1.55}@media(max-width:850px){.live-preview-layout{grid-template-columns:1fr}.live-preview-file-list{max-height:300px}}@media(max-width:620px){.live-preview-heading{flex-direction:column}.live-preview-frame,.live-preview-frame-wrap{height:420px;min-height:420px}}
    `;
    document.head.append(style);
  }
})();
