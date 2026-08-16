(() => {
  const originalFetch = window.fetch.bind(window);
  const githubApiBase = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
  const rawProxyBase = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/raw";
  const githubApiPrefix = "https://api.github.com";
  const rawGithubPrefix = "https://raw.githubusercontent.com";

  window.fetch = async (input, init) => {
    const requestUrl = input instanceof Request ? input.url : String(input);

    if (requestUrl.startsWith(rawGithubPrefix)) {
      const url = new URL(requestUrl);
      const rawPath = url.pathname.replace(/^\//, "");
      return originalFetch(`${rawProxyBase}/${rawPath}${url.search}`, {
        method: "GET",
        headers: { Accept: "*/*" },
      });
    }

    if (!requestUrl.startsWith(githubApiPrefix)) {
      return originalFetch(input, init);
    }

    const url = new URL(requestUrl);

    if (url.pathname.startsWith("/users/") && url.pathname.endsWith("/repos")) {
      const owner = decodeURIComponent(url.pathname.split("/")[2] || "");
      const limit = url.searchParams.get("per_page") || "100";
      const response = await originalFetch(
        `${githubApiBase}/user/${encodeURIComponent(owner)}/repos?limit=${encodeURIComponent(limit)}`,
        { method: "GET", headers: { Accept: "application/json" } },
      );

      if (!response.ok) return response;

      const payload = await response.json();
      return new Response(JSON.stringify(payload.repositories || []), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const treeMatch = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^/]+)$/);
    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      const response = await originalFetch(
        `${githubApiBase}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`,
        { method: "GET", headers: { Accept: "application/json" } },
      );

      if (!response.ok) return response;

      const payload = await response.json();
      return new Response(JSON.stringify({
        tree: payload.tree || [],
        truncated: Boolean(payload.truncated),
        branch: payload.branch || "main",
      }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    return new Response(
      JSON.stringify({
        error: "This GitHub API operation is not exposed by the Simplifier proxy.",
        code: "UNSUPPORTED_GITHUB_OPERATION",
      }),
      {
        status: 501,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  };

  installUiEnhancements();

  function installUiEnhancements() {
    const style = document.createElement("style");
    style.textContent = `
      .tree-browser .tree-folder > .folder-row .tree-kind {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        margin-left: auto;
        padding: 0 7px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 999px;
        color: var(--faint);
        background: rgba(255,255,255,.025);
        font-size: .6rem;
        letter-spacing: .02em;
      }
      .tree-browser .tree-row.file-row .tree-kind {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        margin-left: auto;
        padding: 0 7px;
        border-radius: 999px;
        font-size: .58rem;
        font-weight: 700;
        letter-spacing: .01em;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .tree-browser .tree-row.file-row .tree-kind.safety-safe {
        color: #8de9bd;
        background: rgba(75,210,135,.08);
        border-color: rgba(75,210,135,.2);
      }
      .tree-browser .tree-row.file-row .tree-kind.safety-caution {
        color: #e7d48b;
        background: rgba(220,190,70,.08);
        border-color: rgba(220,190,70,.18);
      }
      .tree-browser .tree-row.file-row .tree-kind.safety-core {
        color: #ff9f9f;
        background: rgba(255,80,80,.07);
        border-color: rgba(255,80,80,.18);
      }
      .tree-browser .tree-row.file-row .tree-kind.safety-unknown {
        color: var(--faint);
        background: rgba(255,255,255,.035);
        border-color: var(--border);
      }
      .tree-browser .tree-row.file-row { padding-right: 8px; }
      .simplifier-preview-panel {
        width: min(100%, 900px);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 22px;
        background: linear-gradient(180deg, rgba(255,255,255,.04), transparent 52%), var(--surface);
        box-shadow: 0 16px 50px var(--shadow);
        -webkit-backdrop-filter: blur(18px);
        backdrop-filter: blur(18px);
      }
      .simplifier-preview-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:14px; }
      .simplifier-preview-head h3 { margin:0; color:var(--text); font-size:1.05rem; }
      .simplifier-preview-sub { margin:5px 0 0; color:var(--faint); font-size:.72rem; line-height:1.5; }
      .simplifier-preview-badge { display:inline-flex; min-height:24px; align-items:center; border:1px solid var(--border); border-radius:999px; padding:0 8px; color:var(--muted); background:rgba(255,255,255,.025); font-size:.62rem; }
      .simplifier-preview-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
      .simplifier-preview-card { min-height:130px; display:flex; flex-direction:column; justify-content:center; border:1px solid var(--border); border-radius:calc(var(--radius) - 3px); padding:15px; background:rgba(255,255,255,.02); }
      .simplifier-preview-card strong { color:var(--text); font-size:.8rem; }
      .simplifier-preview-card p { margin:6px 0 0; color:var(--faint); font-size:.7rem; line-height:1.5; }
      .simplifier-preview-media { grid-column:1/-1; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
      .simplifier-preview-media img { display:block; width:100%; aspect-ratio:16/10; object-fit:cover; border:1px solid var(--border); border-radius:calc(var(--radius) - 4px); background:#05080a; }
      .simplifier-preview-note { margin-top:12px; color:var(--faint); font-size:.68rem; line-height:1.55; }
      @media (max-width:760px) { .simplifier-preview-grid,.simplifier-preview-media { grid-template-columns:1fr; } }
    `;
    document.head.append(style);

    const observer = new MutationObserver(() => {
      const analysis = document.querySelector(".analysis-result");
      if (!analysis) return;
      polishTree(analysis);
      ensureProjectPreview(analysis);
    });

    const start = () => {
      if (!document.body) return;
      observer.observe(document.body, { childList: true, subtree: true });
      polishTree(document);
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }

  function polishTree(root) {
    root.querySelectorAll?.(".tree-folder").forEach((details) => {
      details.open = false;
      const folderBadge = details.querySelector(":scope > .folder-row .tree-kind");
      if (folderBadge) {
        folderBadge.textContent = "Folder";
        folderBadge.title = "Folder — not an edit-safety indicator";
        folderBadge.classList.add("folder-indicator");
      }
    });

    root.querySelectorAll?.(".tree-row.file-row .tree-kind").forEach((badge) => {
      badge.title = `Edit safety indicator: ${badge.textContent}. This is a heuristic, not a guarantee.`;
      badge.classList.remove("safety-safe", "safety-caution", "safety-core", "safety-unknown");
      const text = (badge.textContent || "").toLowerCase();
      if (text.includes("likely safe")) badge.classList.add("safety-safe");
      else if (text.includes("caution")) badge.classList.add("safety-caution");
      else if (text.includes("core")) badge.classList.add("safety-core");
      else badge.classList.add("safety-unknown");
    });
  }

  function ensureProjectPreview(analysis) {
    if (analysis.querySelector(".simplifier-preview-panel")) return;
    const structure = analysis.querySelector(".structure-panel");
    if (!structure) return;

    const tree = getTreeFromRenderedRows(analysis);
    const ownerRepo = getRepositoryIdentity(analysis);
    const preview = document.createElement("article");
    preview.className = "simplifier-preview-panel";

    const heading = document.createElement("div");
    heading.className = "simplifier-preview-head";
    heading.innerHTML = `
      <div>
        <span class="analysis-label">Project preview</span>
        <h3>See what this project can become</h3>
        <p class="simplifier-preview-sub">A foundation for runnable web previews and real-world media from a repository.</p>
      </div>
      <span class="simplifier-preview-badge">Preview layer · prepared</span>
    `;
    preview.append(heading);

    const grid = document.createElement("div");
    grid.className = "simplifier-preview-grid";

    const hasWebEntry = tree.some((item) => /(^|\/)index\.html$/i.test(item.path || ""));
    const images = tree.filter((item) => item.type === "blob" && /\.(png|jpe?g|webp|gif|svg)$/i.test(item.path || "")).slice(0, 6);
    const isLikelyGameMod = /mod|plugin|valheim|bepinex|unity|unreal/i.test(`${ownerRepo?.repo || ""} ${tree.map((item) => item.path).join(" ")}`);

    appendPreviewCard(
      grid,
      hasWebEntry ? "Web runtime ready" : "Web runtime not detected",
      hasWebEntry ? "This repository exposes an index.html entry. The next step can render a sandboxed runnable preview." : "A browser-runnable entry point was not detected from the repository tree.",
    );

    appendPreviewCard(
      grid,
      images.length ? "Media found" : "No preview media yet",
      images.length ? `${images.length} image asset${images.length === 1 ? "" : "s"} can be surfaced as a project preview.` : "Screenshots or other visual assets can be surfaced here when the repository provides them.",
    );

    appendPreviewCard(
      grid,
      isLikelyGameMod ? "Game / mod preview" : "Runtime preview",
      isLikelyGameMod ? "A real in-game screenshot cannot be generated from source code alone. We can show repo-provided captures now, and later accept an explicit preview bundle/render." : "For other project types we can add a renderer when the runtime is safely reproducible in the browser.",
    );

    if (images.length && ownerRepo?.owner && ownerRepo?.repo) {
      const media = document.createElement("div");
      media.className = "simplifier-preview-media";
      images.forEach((item) => {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = item.path;
        img.src = `${rawProxyBase}/${encodeURIComponent(ownerRepo.owner)}/${encodeURIComponent(ownerRepo.repo)}/${encodeURIComponent(ownerRepo.branch || "main")}/${item.path.split("/").map(encodeURIComponent).join("/")}`;
        media.append(img);
      });
      grid.append(media);
    }

    const note = document.createElement("p");
    note.className = "simplifier-preview-note";
    note.textContent = "Preview strategy: runnable web projects → sandboxed browser preview; image/video assets → media gallery; game mods → repository captures or an explicitly supplied preview bundle. The analyzer will never pretend a screenshot was generated when no real runtime is available.";

    preview.append(grid, note);
    structure.insertAdjacentElement("afterend", preview);
  }

  function appendPreviewCard(grid, title, text) {
    const card = document.createElement("div");
    card.className = "simplifier-preview-card";
    card.innerHTML = `<strong>${escapeText(title)}</strong><p>${escapeText(text)}</p>`;
    grid.append(card);
  }

  function getRepositoryIdentity(analysis) {
    const ownerLine = analysis.querySelector(".analysis-owner")?.textContent || "";
    const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], branch: match[3] };
  }

  function getTreeFromRenderedRows(analysis) {
    return [...analysis.querySelectorAll(".tree-row.file-row")].map((row) => ({ path: row.querySelector(".tree-name")?.textContent || "", type: "blob" }));
  }

  function escapeText(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
})();