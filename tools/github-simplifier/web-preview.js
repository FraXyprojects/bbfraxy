const WEB_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
const RAW_API = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/raw";

(() => {
  const form = document.querySelector(".simplifier-form");
  if (!form) return;

  let active = null;
  let buildId = 0;
  let previewHistory = [];

  form.addEventListener("submit", waitForAnalysis);
  window.addEventListener("message", (event) => {
    if (!active?.frame || event.source !== active.frame.contentWindow) return;
    if (event.data?.type !== "bbfraxy-preview-navigate") return;
    const route = typeof event.data.route === "string" ? event.data.route : "/";
    navigate(route, true);
  });

  function waitForAnalysis() {
    const started = performance.now();
    const poll = () => {
      const analysis = document.querySelector(".analysis-result");
      const ownerLine = analysis?.querySelector(".analysis-owner")?.textContent || "";
      const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
      if (analysis && match) return setup(analysis, { owner: match[1], repo: match[2], branch: match[3] });
      if (performance.now() - started < 8000) window.setTimeout(poll, 100);
    };
    window.setTimeout(poll, 100);
  }

  function setup(analysis, repo) {
    if (analysis.querySelector(".live-web-preview")) return;
    const type = analysis.querySelector(".analysis-summary strong")?.textContent || "";
    if (!/web application|web|html|javascript|typescript/i.test(type)) return;

    const files = collectTreePaths(analysis);
    if (!files.some((item) => item.path.toLowerCase() === "index.html")) return;

    active = { analysis, repo, files, currentEntry: "index.html", frame: null };
    previewHistory = [];

    const panel = document.createElement("article");
    panel.className = "analysis-panel live-web-preview";
    panel.innerHTML = `
      <div class="live-preview-heading">
        <div>
          <span class="analysis-label">Live web preview</span>
          <h3>Run the repository in an isolated browser</h3>
          <p class="live-preview-sub">Used files are detected from the current HTML page. Internal links stay inside this preview, and optional CSS/JS files can be injected.</p>
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
      <p class="live-preview-note">Each page is assembled from the repository through the BBFRAXY Worker. The sandbox cannot access the parent page. Game/module scripts keep their real module URLs, so relative imports can continue to work.</p>
    `;

    const anchor = analysis.querySelector(".project-preview-panel") || analysis.querySelector(".structure-panel");
    if (anchor) anchor.insertAdjacentElement("afterend", panel); else analysis.append(panel);

    active.frame = panel.querySelector(".live-preview-frame");
    injectStyles();
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
    const normalizedRoute = normalizeRoute(route);
    const entryPath = routeToEntry(normalizedRoute);
    if (pushHistory && active.currentEntry !== entryPath) previewHistory.push(active.currentEntry);
    active.currentEntry = entryPath;

    const id = ++buildId;
    const status = active.analysis.querySelector("#live-preview-status");
    const routeLabel = active.analysis.querySelector("#live-preview-route");
    status.textContent = "Building…";
    routeLabel.textContent = normalizedRoute;
    active.frame.srcdoc = loadingHtml();

    try {
      const htmlPayload = await fetchFile(entryPath);
      if (id !== buildId) return;
      const pageHtml = htmlPayload.text || "";
      const usedPaths = await detectUsedPaths(entryPath, pageHtml);
      if (id !== buildId) return;
      renderFileControls(usedPaths);

      const enabledOptionals = getEnabledOptionals(usedPaths);
      const pageSource = applyDisabledState(pageHtml, entryPath, usedPaths);
      const srcdoc = assemblePage(pageSource, entryPath, new Set([...usedPaths, ...enabledOptionals]));
      active.frame.srcdoc = srcdoc;
      status.textContent = `${usedPaths.size + enabledOptionals.length} files active`;
      const back = active.analysis.querySelector('[data-preview-action="back"]');
      if (back) back.disabled = previewHistory.length === 0;
    } catch (error) {
      if (id !== buildId) return;
      status.textContent = "Preview failed";
      active.frame.srcdoc = errorHtml(error instanceof Error ? error.message : "Preview could not be built.");
      renderFileControls([]);
    }
  }

  async function detectUsedPaths(entryPath, html) {
    const available = new Map(active.files.map((file) => [normalize(file.path).toLowerCase(), file.path]));
    const used = new Set([entryPath]);
    const queue = [{ path: entryPath, text: html }];

    while (queue.length) {
      const current = queue.shift();
      for (const ref of extractReferences(current.text, current.path)) {
        const actual = available.get(normalize(ref).toLowerCase());
        if (!actual || used.has(actual)) continue;
        used.add(actual);
        if (isTextDependency(actual) && used.size < 100) {
          try {
            const payload = await fetchFile(actual);
            queue.push({ path: actual, text: payload.text || "" });
          } catch {
            // Optional/unreadable dependency.
          }
        }
      }
    }
    return used;
  }

  function extractReferences(text, fromPath) {
    const refs = new Set();
    const htmlRefs = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    const jsRefs = /(?:import\s+(?:[^'";]+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/g;
    const cssRefs = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let match;
    while ((match = htmlRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
    while ((match = jsRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
    while ((match = cssRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
    return refs;
  }

  function renderFileControls(usedPaths) {
    const list = active.analysis.querySelector("#live-preview-file-list");
    if (!list) return;
    const used = new Set(usedPaths);
    const stored = readState();
    list.replaceChildren();

    for (const item of [...candidateFiles()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))) {
      const wasUsed = used.has(item.path);
      const saved = stored[item.path];
      const enabled = saved ? saved.enabled : wasUsed;
      const mode = wasUsed ? "used" : isInjectable(item.path) ? "optional" : "asset";
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
          row.classList.toggle("is-enabled", event.currentTarget.checked);
          navigate(routeForEntry(active.currentEntry), false);
        });
      }
      list.append(row);
    }

    const activeCount = candidateFiles().filter((item) => used.has(item.path) || (stored[item.path]?.enabled === true && isInjectable(item.path))).length;
    active.analysis.querySelector("#live-preview-file-count").textContent = `${activeCount} active · ${candidateFiles().length} available`;
  }

  function getEnabledOptionals(usedPaths) {
    const stored = readState();
    return candidateFiles().filter((item) => !usedPaths.has(item.path) && isInjectable(item.path) && stored[item.path]?.enabled === true).map((item) => item.path);
  }

  function applyDisabledState(html, entryPath, usedPaths) {
    const disabled = readState();
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("link[href],script[src],img[src],source[src],video[src],audio[src]").forEach((element) => {
      const attr = element.hasAttribute("src") ? "src" : "href";
      const value = element.getAttribute(attr) || "";
      if (!isLocalRef(value)) return;
      const path = findTreePath(resolveRelative(entryPath, value));
      if (path && disabled[path]?.enabled === false && usedPaths.has(path)) element.remove();
    });
    return `<!doctype html>${doc.documentElement.outerHTML}`;
  }

  function assemblePage(html, entryPath, enabledPaths) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    doc.querySelectorAll("link[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!isLocalRef(href)) return;
      const path = findTreePath(resolveRelative(entryPath, href));
      if (path && enabledPaths.has(path) && /stylesheet/i.test(link.getAttribute("rel") || "")) link.setAttribute("href", rawUrl(path));
    });

    doc.querySelectorAll("script[src]").forEach((script) => {
      const src = script.getAttribute("src") || "";
      if (!isLocalRef(src)) return;
      const path = findTreePath(resolveRelative(entryPath, src));
      if (path && enabledPaths.has(path)) script.setAttribute("src", rawUrl(path));
    });

    doc.querySelectorAll("img[src],source[src],video[src],audio[src],link[rel=icon][href]").forEach((element) => {
      const attr = element.hasAttribute("src") ? "src" : "href";
      const value = element.getAttribute(attr) || "";
      if (!isLocalRef(value)) return;
      const path = findTreePath(resolveRelative(entryPath, value));
      if (path && enabledPaths.has(path)) element.setAttribute(attr, rawUrl(path));
    });

    doc.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href || /^(https?:|mailto:|javascript:|#|\/\/)/i.test(href)) return;
      const route = href.startsWith("/") ? href : routeFromRelativeLink(entryPath, href);
      if (!route) return;
      link.setAttribute("href", "#");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        window.parent.postMessage({ type: "bbfraxy-preview-navigate", route: normalizeRoute(route) }, "*");
      });
    });

    doc.querySelectorAll("form").forEach((formElement) => formElement.addEventListener("submit", (event) => event.preventDefault()));

    for (const path of enabledPaths) {
      if (path === entryPath || !isInjectable(path)) continue;
      const state = readState()[path];
      if (!state?.enabled) continue;
      const tag = /\.css$/i.test(path) ? "link" : "script";
      if (tag === "link") {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = rawUrl(path);
        link.dataset.previewInjected = path;
        doc.head.append(link);
      } else {
        const script = doc.createElement("script");
        script.src = rawUrl(path);
        script.dataset.previewInjected = path;
        doc.body.append(script);
      }
    }

    return `<!doctype html>${doc.documentElement.outerHTML}`;
  }

  function findTreePath(path) {
    const wanted = normalize(path).toLowerCase();
    return active.files.find((file) => normalize(file.path).toLowerCase() === wanted)?.path || null;
  }

  function rawUrl(path) {
    const parts = [active.repo.owner, active.repo.repo, active.repo.branch, ...normalize(path).split("/")];
    return `${RAW_API}/${parts.map(encodeURIComponent).join("/")}`;
  }

  function routeToEntry(route) {
    if (route === "/") return "index.html";
    const clean = route.replace(/^\//, "").replace(/\/$/, "");
    if (/\.html?$/i.test(clean)) return clean;
    return `${clean}/index.html`;
  }

  function routeForEntry(entry) {
    if (entry === "index.html") return "/";
    return `/${entry.replace(/\/index\.html$/i, "")}/`;
  }

  function routeFromRelativeLink(entryPath, href) {
    const clean = href.split("?")[0].split("#")[0];
    const resolved = resolveRelative(entryPath, clean);
    if (/\.html?$/i.test(resolved)) return `/${resolved}`;
    if (resolved.endsWith("/index.html")) return `/${resolved.slice(0, -10)}/`;
    return `/${resolved}`;
  }

  function resolveRelative(from, ref) {
    if (!ref || !isLocalRef(ref)) return ref;
    if (ref.startsWith("/")) return normalize(ref.slice(1));
    const parts = from.split("/");
    parts.pop();
    for (const part of ref.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop(); else parts.push(part);
    }
    return normalize(parts.join("/"));
  }

  function normalizeRoute(route) {
    let value = String(route || "/").trim();
    if (!value.startsWith("/")) value = `/${value}`;
    value = value.split("?")[0].split("#")[0];
    if (value.length > 1 && !value.endsWith("/") && !/\.html?$/i.test(value)) value += "/";
    return value;
  }

  function normalize(path) {
    return String(path || "").replace(/^\.\//, "").replace(/^\//, "");
  }

  function isLocalRef(value) {
    return Boolean(value) && !/^(https?:|data:|blob:|#|\/\/|mailto:|javascript:)/i.test(value);
  }

  function isTextDependency(path) {
    return /\.(html?|css|js|mjs|cjs|json|ts|tsx|jsx|py|cs|java|kt|rs|go|xml|yaml|yml|toml)$/i.test(path);
  }

  function isInjectable(path) {
    return /\.(css|js|mjs|cjs)$/i.test(path);
  }

  function readState() {
    try { return JSON.parse(sessionStorage.getItem(stateKey()) || "{}"); } catch { return {}; }
  }

  function saveState(path, value) {
    const state = readState();
    state[path] = value;
    try { sessionStorage.setItem(stateKey(), JSON.stringify(state)); } catch {}
  }

  function stateKey() {
    return `bbfraxy.preview.state.${active.repo.owner}/${active.repo.repo}`;
  }

  function wireActions() {
    active.analysis.querySelectorAll("[data-preview-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.previewAction;
        if (action === "refresh") navigate(routeForEntry(active.currentEntry), false);
        if (action === "newtab") openNewTab();
        if (action === "reset") {
          try { sessionStorage.removeItem(stateKey()); } catch {}
          navigate(routeForEntry(active.currentEntry), false);
        }
        if (action === "back" && previewHistory.length) {
          const previous = previewHistory.pop();
          active.currentEntry = previous;
          navigate(routeForEntry(previous), false);
        }
      });
    });
  }

  async function fetchFile(path) {
    const encoded = normalize(path).split("/").map(encodeURIComponent).join("/");
    const url = `${WEB_API}/repo/${encodeURIComponent(active.repo.owner)}/${encodeURIComponent(active.repo.repo)}/file/${encoded}?branch=${encodeURIComponent(active.repo.branch)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `Could not load ${path} (${response.status}).`);
    return payload;
  }

  async function openNewTab() {
    if (!active?.frame?.srcdoc) return;
    const blob = new Blob([active.frame.srcdoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function loadingHtml() {
    return '<style>html,body{height:100%;margin:0;background:#050607;color:#d8e4e8;font:14px system-ui;display:grid;place-items:center}body:after{content:"Building preview…";opacity:.65}</style>';
  }

  function errorHtml(message) {
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
      .live-web-preview{display:grid;gap:14px}.live-preview-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.live-preview-heading h3{margin:0;color:var(--text);font-size:1.05rem}.live-preview-sub{margin:6px 0 0;color:var(--muted);font-size:.76rem;line-height:1.55}.live-preview-layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:12px}.live-preview-stage,.live-preview-files{min-width:0;border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background:rgba(255,255,255,.02)}.live-preview-toolbar,.live-preview-files-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.07);color:var(--faint);font-size:.66rem}.live-preview-actions{display:flex;gap:6px}.preview-action{min-height:30px;border:1px solid var(--border);border-radius:8px;padding:0 9px;color:var(--muted);background:rgba(255,255,255,.025);font:inherit;font-size:.66rem;cursor:pointer}.preview-action:hover:not(:disabled){border-color:var(--border-strong);color:var(--text)}.preview-action:disabled{opacity:.4;cursor:not-allowed}.live-preview-frame-wrap{background:#fff}.live-preview-frame{display:block;width:100%;height:560px;border:0;background:#fff}.live-preview-file-list{max-height:560px;overflow:auto;padding:8px}.live-preview-file{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid transparent;border-radius:8px;cursor:pointer}.live-preview-file:hover{background:rgba(95,231,255,.035);border-color:var(--border)}.live-preview-file input{accent-color:var(--accent)}.live-preview-file-main{min-width:0;display:grid;gap:3px;flex:1}.live-preview-file-path{overflow:hidden;color:var(--text);font-size:.68rem;text-overflow:ellipsis;white-space:nowrap}.live-preview-file-role{color:var(--faint);font-size:.58rem}.live-preview-file-badge{flex:0 0 auto;border:1px solid var(--border);border-radius:999px;padding:3px 6px;color:var(--faint);font-size:.54rem}.live-preview-file.is-enabled .live-preview-file-badge{border-color:rgba(95,231,255,.22);color:var(--accent-strong);background:rgba(95,231,255,.04)}.live-preview-note{margin:0;color:var(--faint);font-size:.68rem;line-height:1.55}@media(max-width:850px){.live-preview-layout{grid-template-columns:1fr}.live-preview-file-list{max-height:300px}}@media(max-width:620px){.live-preview-heading{flex-direction:column}.live-preview-frame{height:420px}}
    `;
    document.head.append(style);
  }
})();
