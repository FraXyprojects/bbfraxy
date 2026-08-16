const WEB_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
const RAW_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/raw";

(() => {
  const form = document.querySelector(".simplifier-form");
  if (!form) return;

  let active = null;
  let buildId = 0;
  let history = [];

  form.addEventListener("submit", waitForAnalysis);
  window.addEventListener("message", (event) => {
    if (!active?.frame || event.source !== active.frame.contentWindow) return;
    if (event.data?.type !== "bbfraxy-preview-navigate") return;
    navigate(event.data.route || "/", true);
  });

  function waitForAnalysis() {
    const started = performance.now();
    const poll = () => {
      const analysis = document.querySelector(".analysis-result");
      const ownerLine = analysis?.querySelector(".analysis-owner")?.textContent || "";
      const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
      if (analysis && match) {
        mount(analysis, { owner: match[1], repo: match[2], branch: match[3] });
        return;
      }
      if (performance.now() - started < 8000) setTimeout(poll, 100);
    };
    setTimeout(poll, 100);
  }

  function mount(analysis, repo) {
    if (analysis.querySelector(".live-web-preview")) return;
    const type = analysis.querySelector(".analysis-summary strong")?.textContent || "";
    if (!/web application|web|html|javascript|typescript/i.test(type)) return;

    const files = collectTreePaths(analysis);
    if (!files.some((item) => item.path.toLowerCase() === "index.html")) return;

    active = { analysis, repo, files, frame: null, currentEntry: "index.html" };
    history = [];

    const panel = document.createElement("article");
    panel.className = "analysis-panel live-web-preview";
    panel.innerHTML = `
      <div class="live-preview-heading">
        <div>
          <span class="analysis-label">Live web preview</span>
          <h3>Run the repository in an isolated browser</h3>
          <p class="live-preview-sub">CSS is assembled directly from the repository. Internal links stay inside the preview, and optional files can be enabled for experiments.</p>
        </div>
        <span class="analysis-count" id="live-preview-status">Ready</span>
      </div>
      <div class="live-preview-layout">
        <section class="live-preview-stage">
          <div class="live-preview-toolbar">
            <span id="live-preview-route">/</span>
            <div class="live-preview-actions">
              <button type="button" class="preview-action" data-preview-action="back">Back</button>
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
      <p class="live-preview-note">The preview is assembled from the selected repository and runs in a sandboxed iframe. Repository scripts cannot access the parent page.</p>
    `;

    const anchor = analysis.querySelector(".project-preview-panel") || analysis.querySelector(".structure-panel");
    if (anchor) anchor.insertAdjacentElement("afterend", panel); else analysis.append(panel);

    active.frame = panel.querySelector(".live-preview-frame");
    wireActions();
    navigate("/", false);
  }

  function collectTreePaths(analysis) {
    const browser = analysis.querySelector("#tree-browser");
    const result = [];
    if (!browser) return result;

    const walk = (container, prefix = "") => {
      for (const node of container.children) {
        if (node.matches?.("details.tree-folder")) {
          const folder = node.querySelector(":scope > .folder-row .tree-name")?.textContent?.trim() || "";
          const next = prefix ? `${prefix}/${folder}` : folder;
          const children = node.querySelector(":scope > .tree-children");
          if (children) walk(children, next);
        } else if (node.matches?.("button.file-row")) {
          const name = node.querySelector(".tree-name")?.textContent?.trim() || "";
          const path = prefix ? `${prefix}/${name}` : name;
          if (path) result.push({ path });
        }
      }
    };
    walk(browser);
    return result;
  }

  function candidateFiles() {
    return active.files.filter((file) => /\.(html?|css|js|mjs|cjs|png|jpe?g|webp|gif|svg|ico)$/i.test(file.path));
  }

  async function navigate(route, pushHistory) {
    if (!active) return;
    const normalized = normalizeRoute(route);
    const entry = routeToEntry(normalized);
    if (pushHistory && active.currentEntry !== entry) history.push(active.currentEntry);
    active.currentEntry = entry;

    const id = ++buildId;
    const status = active.analysis.querySelector("#live-preview-status");
    const routeLabel = active.analysis.querySelector("#live-preview-route");
    const back = active.analysis.querySelector('[data-preview-action="back"]');
    status.textContent = "Building…";
    routeLabel.textContent = normalized;
    back.disabled = history.length === 0;
    active.frame.srcdoc = loadingHtml();

    try {
      const htmlPayload = await fetchFile(entry);
      if (id !== buildId) return;
      const html = htmlPayload.text || "";
      const used = await detectUsedPaths(entry, html);
      if (id !== buildId) return;
      renderFileControls(used);

      const enabled = new Set(used);
      for (const path of getEnabledOptionals(used)) enabled.add(path);
      const source = applyDisabledState(html, entry, used);
      const srcdoc = await assemblePage(source, entry, enabled);
      if (id !== buildId) return;
      active.frame.srcdoc = srcdoc;
      status.textContent = `${enabled.size} files active`;
      back.disabled = history.length === 0;
    } catch (error) {
      if (id !== buildId) return;
      status.textContent = "Preview failed";
      active.frame.srcdoc = errorHtml(error?.message || "Preview could not be built.");
      renderFileControls(new Set());
    }
  }

  async function detectUsedPaths(entry, html) {
    const available = new Map(active.files.map((file) => [normalize(file.path).toLowerCase(), file.path]));
    const used = new Set([entry]);
    const queue = [{ path: entry, text: html }];

    while (queue.length) {
      const current = queue.shift();
      for (const ref of extractReferences(current.text, current.path)) {
        const actual = available.get(normalize(ref).toLowerCase());
        if (!actual || used.has(actual)) continue;
        used.add(actual);
        if (isTextDependency(actual) && used.size < 120) {
          try {
            const payload = await fetchFile(actual);
            queue.push({ path: actual, text: payload.text || "" });
          } catch {}
        }
      }
    }
    return used;
  }

  function extractReferences(text, fromPath) {
    const refs = new Set();
    const htmlRefs = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    const importRefs = /(?:import\s+(?:[^'";]+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/g;
    const cssRefs = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let match;
    while ((match = htmlRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
    while ((match = importRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
    while ((match = cssRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
    return refs;
  }

  function renderFileControls(used) {
    const list = active.analysis.querySelector("#live-preview-file-list");
    const count = active.analysis.querySelector("#live-preview-file-count");
    if (!list || !count) return;
    const stored = readState();
    list.replaceChildren();

    for (const item of [...candidateFiles()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))) {
      const wasUsed = used.has(item.path);
      const saved = stored[item.path];
      const mode = wasUsed ? "used" : isInjectable(item.path) ? "optional" : "asset";
      const enabled = saved ? saved.enabled : wasUsed;
      const row = document.createElement("label");
      row.className = `live-preview-file ${enabled ? "is-enabled" : ""}`;
      row.innerHTML = `
        <input type="checkbox" ${enabled ? "checked" : ""} ${mode === "asset" ? "disabled" : ""}>
        <span class="live-preview-file-main">
          <span class="live-preview-file-path" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</span>
          <span class="live-preview-file-role">${mode === "used" ? "Used by current page" : mode === "optional" ? "Optional · can be injected" : "Asset · loaded when referenced"}</span>
        </span>
        <span class="live-preview-file-badge">${mode === "used" ? "Used" : mode === "optional" ? "Optional" : "Asset"}</span>
      `;
      const input = row.querySelector("input");
      if (input && mode !== "asset") {
        input.addEventListener("change", (event) => {
          saveState(item.path, { enabled: event.currentTarget.checked });
          navigate(routeForEntry(active.currentEntry), false);
        });
      }
      list.append(row);
    }

    const activeCount = candidateFiles().filter((item) => used.has(item.path) || (stored[item.path]?.enabled === true && isInjectable(item.path))).length;
    count.textContent = `${activeCount} active · ${candidateFiles().length} available`;
  }

  function getEnabledOptionals(used) {
    const stored = readState();
    return candidateFiles().filter((item) => !used.has(item.path) && isInjectable(item.path) && stored[item.path]?.enabled === true).map((item) => item.path);
  }

  function applyDisabledState(html, entryPath, used) {
    const disabled = readState();
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("link[href],script[src],img[src],source[src],video[src],audio[src]").forEach((element) => {
      const attr = element.hasAttribute("src") ? "src" : "href";
      const value = element.getAttribute(attr) || "";
      if (!isLocalRef(value)) return;
      const path = findTreePath(resolveRelative(entryPath, value));
      if (path && disabled[path]?.enabled === false && used.has(path)) element.remove();
    });
    return `<!doctype html>${doc.documentElement.outerHTML}`;
  }

  async function assemblePage(html, entryPath, enabledPaths) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    for (const link of [...doc.querySelectorAll("link[href]")]) {
      const href = link.getAttribute("href") || "";
      if (!isLocalRef(href)) continue;
      const path = findTreePath(resolveRelative(entryPath, href));
      if (!path || !enabledPaths.has(path)) continue;
      if (/stylesheet/i.test(link.getAttribute("rel") || "")) {
        const payload = await fetchFile(path);
        const style = doc.createElement("style");
        style.dataset.previewFile = path;
        style.textContent = rewriteCss(payload.text || "", path);
        link.replaceWith(style);
      } else if (/icon/i.test(link.getAttribute("rel") || "")) {
        link.setAttribute("href", rawUrl(path));
      }
    }

    for (const script of [...doc.querySelectorAll("script[src]")]) {
      const src = script.getAttribute("src") || "";
      if (!isLocalRef(src)) continue;
      const path = findTreePath(resolveRelative(entryPath, src));
      if (path && enabledPaths.has(path)) script.setAttribute("src", rawUrl(path));
    }

    for (const element of [...doc.querySelectorAll("img[src],source[src],video[src],audio[src]")]) {
      const src = element.getAttribute("src") || "";
      if (!isLocalRef(src)) continue;
      const path = findTreePath(resolveRelative(entryPath, src));
      if (path && enabledPaths.has(path)) element.setAttribute("src", rawUrl(path));
    }

    for (const link of [...doc.querySelectorAll("a[href]")]) {
      const href = link.getAttribute("href") || "";
      if (!href || /^(https?:|mailto:|javascript:|#|\/\/)/i.test(href)) continue;
      const route = href.startsWith("/") ? href : routeFromRelativeLink(entryPath, href);
      if (!route) continue;
      link.setAttribute("href", "#");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        window.parent.postMessage({ type: "bbfraxy-preview-navigate", route: normalizeRoute(route) }, "*");
      });
    }

    doc.querySelectorAll("form").forEach((formElement) => formElement.addEventListener("submit", (event) => event.preventDefault()));

    for (const path of enabledPaths) {
      if (path === entryPath || !isInjectable(path)) continue;
      const state = readState()[path];
      if (!state?.enabled) continue;
      if (/\.css$/i.test(path)) {
        const payload = await fetchFile(path);
        const style = doc.createElement("style");
        style.dataset.previewInjected = path;
        style.textContent = rewriteCss(payload.text || "", path);
        doc.head.append(style);
      } else {
        const script = doc.createElement("script");
        script.src = rawUrl(path);
        script.dataset.previewInjected = path;
        doc.body.append(script);
      }
    }

    return `<!doctype html>${doc.documentElement.outerHTML}`;
  }

  function rewriteCss(css, cssPath) {
    return String(css || "").replace(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, (full, raw) => {
      const value = String(raw).trim();
      if (/^(data:|https?:|#|blob:|\/\/)/i.test(value)) return full;
      const path = findTreePath(resolveRelative(cssPath, value));
      return path ? `url("${rawUrl(path)}")` : full;
    });
  }

  function wireActions() {
    active.analysis.querySelectorAll("[data-preview-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.previewAction;
        if (action === "refresh") navigate(routeForEntry(active.currentEntry), false);
        if (action === "back" && history.length) navigate(routeForEntry(history.pop()), false);
        if (action === "reset") { clearState(); navigate(routeForEntry(active.currentEntry), false); }
        if (action === "newtab") openNewTab();
      });
    });
  }

  function openNewTab() {
    if (!active?.frame?.srcdoc) return;
    const blob = new Blob([active.frame.srcdoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function fetchFile(path) {
    const url = `${WEB_API}/repo/${encodeURIComponent(active.repo.owner)}/${encodeURIComponent(active.repo.repo)}/file/${normalize(path).split("/").map(encodeURIComponent).join("/")}?branch=${encodeURIComponent(active.repo.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Could not load ${path} (${response.status}).`);
    return payload;
  }

  function rawUrl(path) {
    const parts = [active.repo.owner, active.repo.repo, active.repo.branch, ...normalize(path).split("/")];
    return `${RAW_API}/${parts.map(encodeURIComponent).join("/")}`;
  }

  function findTreePath(path) {
    const wanted = normalize(path).toLowerCase();
    return active.files.find((file) => normalize(file.path).toLowerCase() === wanted)?.path || null;
  }

  function routeToEntry(route) {
    if (route === "/") return "index.html";
    const clean = route.replace(/^\//, "").replace(/\/$/, "");
    return /\.html?$/i.test(clean) ? clean : `${clean}/index.html`;
  }

  function routeForEntry(entry) {
    return entry === "index.html" ? "/" : `/${entry.replace(/\/index\.html$/i, "")}/`;
  }

  function routeFromRelativeLink(entryPath, href) {
    return routeForEntry(resolveRelative(entryPath, href));
  }

  function resolveRelative(from, ref) {
    const cleanRef = String(ref || "").split("?")[0].split("#")[0];
    if (!cleanRef) return from;
    if (cleanRef.startsWith("/")) return cleanRef.replace(/^\//, "");
    const base = from.split("/");
    base.pop();
    for (const part of cleanRef.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") base.pop(); else base.push(part);
    }
    return base.join("/");
  }

  function normalizeRoute(route) {
    let value = String(route || "/").split("?")[0].split("#")[0];
    if (!value.startsWith("/")) value = `/${value}`;
    if (value !== "/" && !value.endsWith("/")) value += "/";
    return value;
  }

  function isLocalRef(value) {
    return Boolean(value) && !/^(https?:|data:|blob:|mailto:|javascript:|#|\/\/)/i.test(value);
  }

  function isTextDependency(path) {
    return /\.(html?|css|js|mjs|cjs)$/i.test(path);
  }

  function isInjectable(path) {
    return /\.(css|js|mjs|cjs)$/i.test(path);
  }

  function storageKey() {
    return `bbfraxy.preview.v5.${active.repo.owner}/${active.repo.repo}@${active.repo.branch}`;
  }

  function readState() {
    try { return JSON.parse(sessionStorage.getItem(storageKey()) || "{}"); } catch { return {}; }
  }

  function saveState(path, state) {
    const current = readState();
    current[path] = state;
    try { sessionStorage.setItem(storageKey(), JSON.stringify(current)); } catch {}
  }

  function clearState() {
    try { sessionStorage.removeItem(storageKey()); } catch {}
  }

  function loadingHtml() {
    return '<style>html,body{height:100%;margin:0;background:#050607;color:#d8e4e8;font:14px system-ui;display:grid;place-items:center}body:after{content:"Building preview…";opacity:.65}</style>';
  }

  function errorHtml(message) {
    return `<style>html,body{height:100%;margin:0;background:#050607;color:#ffbcbc;font:14px system-ui;padding:24px;box-sizing:border-box}pre{white-space:pre-wrap;font:inherit}</style><pre>${escapeHtml(message)}</pre>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
})();
