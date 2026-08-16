const form = document.querySelector(".simplifier-form");
const input = document.querySelector("#repository-url");
const button = document.querySelector(".simplifier-submit");
const card = document.querySelector(".simplifier-card");

const API_BASE = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
const RAW_BASE = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/raw";
const MAX_TREE_ITEMS = 700;
const MAX_PREVIEW_BYTES = 180000;
const CACHE_KEY = "bbfraxy.github-simplifier.v3";
const REPOSITORY_LIST_LIMIT = 100;
let activeRepository = null;
let activeTree = [];

installLayoutGuard();
restoreCachedAnalysis();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const parsed = parseRepositoryUrl(input?.value || "");
  if (!parsed) {
    showMessage("Enter a valid public GitHub repository URL.", "error");
    input?.focus();
    return;
  }

  setLoading(true);
  clearDynamicResults();

  try {
    if (!parsed.repo) {
      const repositories = await fetchUserRepositories(parsed.owner);
      if (!repositories.length) {
        throw new Error(`No public repositories were found for ${parsed.owner}.`);
      }
      renderRepositoryPicker({
        owner: parsed.owner,
        repositories,
        message: `Select a repository from ${parsed.owner}.`,
      });
      return;
    }

    const treeResult = await fetchRepositoryTree(parsed.owner, parsed.repo);

    if (!treeResult) {
      const repositories = await fetchUserRepositories(parsed.owner);
      if (repositories.length) {
        renderRepositoryPicker({
          owner: parsed.owner,
          repositories,
          message: `Repository “${parsed.repo}” was not found. Here are the public repositories for ${parsed.owner}.`,
        });
        return;
      }
      throw new Error("Repository was not found. Make sure the repository is public and the URL is correct.");
    }

    const tree = Array.isArray(treeResult.tree)
      ? treeResult.tree.slice(0, MAX_TREE_ITEMS)
      : [];

    if (!tree.length) {
      throw new Error("GitHub returned an empty repository tree.");
    }

    const repository = {
      owner: parsed.owner,
      repo: parsed.repo,
      name: parsed.repo,
      full_name: `${parsed.owner}/${parsed.repo}`,
      branch: treeResult.branch || "main",
      html_url: `https://github.com/${parsed.owner}/${parsed.repo}`,
    };

    const [readmeText] = await Promise.all([
      fetchReadme(repository.owner, repository.repo, repository.branch),
    ]);

    const languages = detectLanguages(tree);
    activeRepository = repository;
    activeTree = tree;

    const analysis = {
      repository,
      readmeText,
      languages,
      tree,
      truncated: Boolean(treeResult.truncated),
    };

    saveCachedAnalysis(input.value.trim(), analysis);
    renderAnalysis(analysis);
  } catch (error) {
    showMessage(
      error instanceof Error ? error.message : "GitHub could not be analyzed.",
      "error",
    );
  } finally {
    setLoading(false);
  }
});

function installLayoutGuard() {
  const style = document.createElement("style");
  style.textContent = `
    html, body { max-width: 100%; overflow-x: hidden; }
    .site-shell, .simplifier-page, .analysis-result, .analysis-panel, .analysis-head,
    .analysis-grid, .analysis-panel-heading, .file-preview-panel { min-width: 0; max-width: 100%; }
    .code-preview { width: 100%; max-width: 100%; min-width: 0; overflow: auto; }
    .code-preview pre { width: max-content; min-width: 100%; max-width: none; }
    .analysis-disclaimer { overflow-wrap: anywhere; }
    .important-panel { overflow: hidden; }
    .important-panel > summary { list-style: none; cursor: pointer; }
    .important-panel > summary::-webkit-details-marker { display: none; }
    .important-summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .important-summary-title { min-width: 0; }
    .important-summary-chevron { flex: 0 0 auto; color: var(--faint); font-size: 1.1rem; transition: transform 160ms ease; }
    .important-panel[open] .important-summary-chevron { transform: rotate(90deg); }
    .tree-browser { max-height: 540px; overflow: auto; }
    .tree-folder { border-radius: 9px; }
    .tree-folder[open] > .folder-row .tree-chevron { transform: rotate(90deg); }
    .tree-row { display: flex; min-width: 0; align-items: center; width: 100%; min-height: 36px; gap: 8px; border: 1px solid transparent; border-radius: 8px; padding: 0 9px; color: var(--muted); background: rgba(255,255,255,.018); font: inherit; font-size: .78rem; text-align: left; }
    .folder-row { cursor: pointer; list-style: none; }
    .folder-row::-webkit-details-marker { display: none; }
    .folder-row:hover, .file-row:hover, .file-row:focus-visible { border-color: var(--border); background: rgba(95,231,255,.04); color: var(--text); outline: none; }
    .tree-chevron { width: 12px; color: var(--faint); transition: transform 140ms ease; }
    .tree-icon { width: 14px; color: var(--accent); }
    .tree-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tree-kind { margin-left: auto; color: var(--faint); font-size: .64rem; white-space: nowrap; }
    .tree-children { display: grid; gap: 2px; margin-left: 18px; padding-left: 8px; border-left: 1px solid rgba(255,255,255,.07); }
    .file-row { cursor: pointer; }
    .tree-spacer { width: 12px; flex: 0 0 12px; }
    .file-safety { flex: 0 0 auto; border-radius: 999px; padding: 3px 7px; font-size: .6rem; line-height: 1; letter-spacing: .02em; }
    .file-safety.edit-safe { color: #8de9bd; background: rgba(75,210,135,.08); border: 1px solid rgba(75,210,135,.22); }
    .file-safety.edit-caution { color: #e7d48b; background: rgba(220,190,70,.08); border: 1px solid rgba(220,190,70,.22); }
    .file-safety.edit-core { color: #ff9f9f; background: rgba(255,80,80,.07); border: 1px solid rgba(255,80,80,.22); }
    .file-safety.edit-unknown { color: var(--faint); background: rgba(255,255,255,.035); border: 1px solid var(--border); }
    .folder-kind { border: 1px dashed rgba(255,255,255,.14); border-radius: 999px; padding: 3px 7px; }
    .preview-mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .preview-mode-card { border: 1px solid var(--border); border-radius: calc(var(--radius) - 3px); padding: 14px; background: rgba(255,255,255,.025); }
    .preview-mode-card strong { display: block; color: var(--text); font-size: .78rem; }
    .preview-mode-card p { margin: 6px 0 0; color: var(--faint); font-size: .68rem; line-height: 1.45; }
    .preview-mode-card[data-active="true"] { border-color: rgba(95,231,255,.3); box-shadow: 0 0 20px rgba(95,231,255,.05); }
    @media (max-width: 720px) { .preview-mode-grid { grid-template-columns: 1fr; } }
  `;
  document.head.append(style);
}

function parseRepositoryUrl(value) {
  try {
    const url = new URL(value.trim());
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (!parts.length) return null;
    if (parts.length === 1) return { owner: parts[0], repo: null };
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

async function fetchUserRepositories(owner) {
  const response = await fetch(
    `${API_BASE}/user/${encodeURIComponent(owner)}/repos?limit=${REPOSITORY_LIST_LIMIT}`,
    { headers: { Accept: "application/json" } },
  );

  if (response.ok) {
    const payload = await response.json();
    return Array.isArray(payload?.repositories) ? payload.repositories : [];
  }

  if (response.status === 404) throw new Error(`GitHub user “${owner}” was not found.`);
  if (response.status === 429) throw new Error("GitHub is temporarily rate-limiting the Simplifier. Please try again later.");
  throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
}

async function fetchRepositoryTree(owner, repo) {
  const response = await fetch(
    `${API_BASE}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`,
    { headers: { Accept: "application/json" } },
  );

  if (response.ok) return response.json();
  if (response.status === 404) return null;
  if (response.status === 429) throw new Error("GitHub is temporarily rate-limiting the Simplifier. Please try again later.");
  throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
}

async function fetchReadme(owner, repo, branch) {
  const candidates = ["README.md", "readme.md", "README.MD"];
  for (const file of candidates) {
    const path = `${owner}/${repo}/${encodeURIComponent(branch)}/${file}`
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    try {
      const response = await fetch(`${RAW_BASE}/${path}`, { cache: "force-cache" });
      if (response.ok) return cleanReadme(await response.text());
    } catch {
      // README is optional.
    }
  }
  return "";
}

function renderRepositoryPicker({ owner, repositories, message }) {
  const result = document.createElement("section");
  result.className = "analysis-result repository-picker-result";
  result.setAttribute("aria-live", "polite");
  result.innerHTML = `
    <article class="analysis-panel">
      <div class="repository-picker-head">
        <div>
          <span class="analysis-label">Repository selection</span>
          <p class="repository-picker-message">${escapeHtml(message)}</p>
        </div>
        <span class="repository-picker-count">${repositories.length} public repos</span>
      </div>
      <div class="repository-picker" id="repository-picker"></div>
    </article>
  `;

  card?.after(result);
  const container = result.querySelector("#repository-picker");

  repositories.forEach((repo) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "repository-option";
    option.innerHTML = `
      <span class="repository-option-main">
        <span class="repository-option-name">${escapeHtml(repo.name)}</span>
        <span class="repository-option-description">${escapeHtml(repo.description || "No description available.")}</span>
      </span>
      <span class="repository-option-meta">
        ${repo.language ? `<span class="repository-option-language">${escapeHtml(repo.language)}</span>` : ""}
        <span>★ ${formatNumber(repo.stargazers_count)}</span>
        <span class="repository-option-action">Analyze →</span>
      </span>
    `;
    option.addEventListener("click", () => {
      input.value = repo.html_url;
      result.remove();
      form?.requestSubmit();
    });
    container?.append(option);
  });

  safeScrollTo(result);
}

function renderAnalysis({ repository, readmeText, languages, tree, truncated }) {
  const summary = readmeText || "No project description is available yet. The repository structure below is inferred directly from the source tree.";
  const projectType = detectProjectType(tree, repository, languages);
  const important = rankImportantFiles(tree, projectType);
  const fileCount = tree.filter((item) => item.type === "blob").length;
  const folderCount = tree.filter((item) => item.type === "tree").length;
  const previewMode = detectPreviewMode(tree, projectType);

  const result = document.createElement("section");
  result.className = "analysis-result";
  result.setAttribute("aria-live", "polite");
  result.innerHTML = `
    <div class="analysis-head">
      <div>
        <p class="analysis-kicker">ANALYSIS COMPLETE · V2.2</p>
        <h2>${escapeHtml(repository.name)}</h2>
        <p class="analysis-owner">${escapeHtml(repository.full_name)} · ${escapeHtml(repository.branch)}</p>
      </div>
      <a class="analysis-github" href="${escapeAttribute(repository.html_url)}" target="_blank" rel="noreferrer">GitHub ↗</a>
    </div>

    <div class="analysis-grid">
      <article class="analysis-panel analysis-summary">
        <span class="analysis-label">What is this?</span>
        <strong>${escapeHtml(projectType)}</strong>
        <p>${escapeHtml(summary)}</p>
      </article>
      <article class="analysis-panel">
        <span class="analysis-label">Repository</span>
        <div class="analysis-stats">
          <span><b>${fileCount}</b> files</span>
          <span><b>${folderCount}</b> folders</span>
          <span><b>${tree.length}</b> scanned items${truncated ? " · partial tree" : ""}</span>
        </div>
        ${languages.length ? `<div class="analysis-tags">${languages.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}
      </article>
    </div>

    <details class="analysis-panel important-panel">
      <summary class="important-summary">
        <span class="important-summary-title"><span class="analysis-label">Key files</span><h3>Files worth knowing</h3></span>
        <span class="important-summary-chevron" aria-hidden="true">›</span>
      </summary>
      <div class="important-list">
        ${important.map(renderImportantFile).join("") || `<p class="analysis-empty">No obvious key files were detected yet.</p>`}
      </div>
    </details>

    <article class="analysis-panel structure-panel">
      <div class="analysis-panel-heading">
        <div><span class="analysis-label">Repository map</span><h3>Explore the codebase</h3></div>
        <span class="analysis-count">${Math.min(tree.length, MAX_TREE_ITEMS)} items${truncated ? " · partial" : ""}</span>
      </div>
      <div class="tree-browser" id="tree-browser"></div>
    </article>

    <article class="analysis-panel file-preview-panel" id="file-preview-panel" hidden>
      <div class="analysis-panel-heading">
        <div><span class="analysis-label">File preview</span><h3 id="preview-title">Select a file</h3></div>
        <div class="preview-actions" id="preview-actions"></div>
      </div>
      <div class="editability-card" id="editability-card"></div>
      <div class="code-preview" id="code-preview"><span class="analysis-empty">Select a file from the repository map.</span></div>
    </article>

    <article class="analysis-panel project-preview-panel">
      <div class="analysis-panel-heading">
        <div><span class="analysis-label">Project preview</span><h3>See what this project can become</h3></div>
        <span class="analysis-count">${escapeHtml(previewMode.label)}</span>
      </div>
      <div class="preview-mode-grid">
        <div class="preview-mode-card" data-active="${previewMode.kind === "web"}">
          <strong>Web runtime</strong>
          <p>${previewMode.kind === "web" ? "This repo looks suitable for a browser preview." : "Reserved for web projects with a clear client entry point."}</p>
        </div>
        <div class="preview-mode-card" data-active="${previewMode.kind === "media"}">
          <strong>Media / screenshots</strong>
          <p>Repository images can be surfaced here as project context.</p>
        </div>
        <div class="preview-mode-card" data-active="${previewMode.kind === "game"}">
          <strong>Game / mod runtime</strong>
          <p>${previewMode.kind === "game" ? "Game screenshots or rendered captures can be attached here later." : "Reserved for detected game or mod repositories."}</p>
        </div>
      </div>
    </article>

    <p class="analysis-disclaimer">Analysis and file previews use the BBFRAXY Worker. Edit safety labels are heuristics, not guarantees. Game previews require a real game/runtime capture and cannot be reconstructed from source code alone.</p>
  `;

  card?.after(result);
  renderTree(tree, result.querySelector("#tree-browser"));
  result.querySelectorAll(".important-file").forEach((element) => {
    element.addEventListener("click", () => {
      const item = activeTree.find((entry) => entry.path === element.dataset.path);
      previewFile(item);
    });
  });
  safeScrollTo(result);
}

function buildTree(tree) {
  const root = { name: "", path: "", type: "tree", children: new Map(), item: null };
  for (const item of tree) {
    const parts = item.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, index) => {
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          type: index === parts.length - 1 ? item.type : "tree",
          children: new Map(),
          item: index === parts.length - 1 ? item : null,
        });
      }
      node = node.children.get(part);
    });
  }
  return root;
}

function renderTree(tree, container) {
  if (!container) return;
  container.replaceChildren(renderTreeNode(buildTree(tree)));
}

function renderTreeNode(node) {
  const fragment = document.createDocumentFragment();
  const entries = [...node.children.values()].sort(sortTreeItems);

  for (const child of entries) {
    if (child.type === "tree") {
      const details = document.createElement("details");
      details.className = "tree-folder";
      details.open = false;

      const summary = document.createElement("summary");
      summary.className = "tree-row folder-row";
      summary.innerHTML = `<span class="tree-chevron" aria-hidden="true">›</span><span class="tree-icon" aria-hidden="true">▣</span><span class="tree-name">${escapeHtml(child.name)}</span><span class="tree-kind folder-kind">folder</span>`;
      details.append(summary);

      const children = document.createElement("div");
      children.className = "tree-children";
      children.append(renderTreeNode(child));
      details.append(children);
      fragment.append(details);
    } else {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "tree-row file-row";
      const editability = classifyEditability(child.path);
      row.innerHTML = `<span class="tree-spacer" aria-hidden="true"></span><span class="tree-icon" aria-hidden="true">◇</span><span class="tree-name">${escapeHtml(child.name)}</span><span class="file-safety ${editability.className}">${escapeHtml(editability.badge)}</span>`;
      row.title = `Edit safety: ${editability.badge} — ${editability.explanation}`;
      row.addEventListener("click", () => previewFile(child.item));
      fragment.append(row);
    }
  }

  return fragment;
}

function renderImportantFile(item) {
  const editability = classifyEditability(item.path);
  return `<button type="button" class="important-file" data-path="${escapeAttribute(item.path)}">
    <span class="important-file-icon" aria-hidden="true">◇</span>
    <span class="important-file-main"><b>${escapeHtml(item.path)}</b><small>${escapeHtml(item.reason)}</small></span>
    <span class="editability-pill ${editability.className}">${escapeHtml(editability.badge)}</span>
  </button>`;
}

function rankImportantFiles(tree, projectType) {
  return tree
    .filter((item) => item.type === "blob")
    .map((item) => {
      const path = item.path.toLowerCase();
      const base = path.split("/").pop() || path;
      const parts = path.split("/");
      let score = 0;
      let reason = "Relevant project file";

      if (/^readme(?:\.|$)/i.test(base)) { score = 100; reason = "Project documentation and usage overview"; }
      else if (/^manifest\.(json|xml|yaml|yml)$/.test(base)) { score = 95; reason = "Project metadata or mod/plugin manifest"; }
      else if (base === "package.json") { score = 90; reason = "Dependencies and project scripts"; }
      else if (/^(vite|next|astro|webpack|rollup)\.config\./.test(base)) { score = 85; reason = "Build and development configuration"; }
      else if (parts.some((part) => ["config", "configs", "configuration", "settings"].includes(part)) || /^(config|settings)\.(json|yaml|yml|toml|ini|cfg)$/.test(base)) { score = 80; reason = "Likely user-facing configuration"; }
      else if (/\.(csproj|sln|gradle|pom|cargo|mod)$/.test(base)) { score = 75; reason = "Project or build configuration"; }
      else if (/^(index|main|app|program)\.[a-z0-9]+$/.test(base)) { score = 70; reason = "Likely application entry point"; }
      else if (/\.(html|tsx|jsx|vue|svelte)$/.test(base)) { score = 50; reason = "User-facing interface"; }
      else if (/\.(css|scss|less)$/.test(base)) { score = 45; reason = "Visual styling"; }
      else if (/\.(cs|java|kt|py|js|ts|cpp|c|rs|go)$/.test(base)) { score = 35; reason = `Source code for ${projectType.toLowerCase()}`; }

      if (["node_modules", "dist", "build", "test", "tests"].some((part) => parts.includes(part))) score -= 50;
      return { ...item, score, reason };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 10);
}

function classifyEditability(path) {
  const lower = path.toLowerCase();
  const parts = lower.split("/");
  const base = parts[parts.length - 1] || lower;

  if (parts.some((part) => ["node_modules", "dist", "build", "bin", "obj", ".git"].includes(part))) return { badge: "Core", className: "edit-core", explanation: "Generated or dependency content. Editing it directly is usually not the right approach." };
  if (/\.(dll|exe|so|dylib|jar|class|wasm)$/.test(base)) return { badge: "Core", className: "edit-core", explanation: "Compiled or binary content. It is generally not intended for manual editing." };
  if (parts.some((part) => ["config", "configs", "configuration", "settings"].includes(part)) || /^(config|settings)\.(json|yaml|yml|toml|ini|cfg)$/.test(base) || /\.(cfg|ini)$/.test(base)) return { badge: "Likely safe", className: "edit-safe", explanation: "The path looks like user-facing configuration. Check the project's documentation before changing values." };
  if (/^readme(?:\.|$)/i.test(base) || parts.includes("docs") || parts.includes("documentation")) return { badge: "Likely safe", className: "edit-safe", explanation: "Documentation is normally safe to edit and does not directly change runtime behavior." };
  if (["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "composer.lock", "cargo.lock"].includes(base)) return { badge: "Caution", className: "edit-caution", explanation: "Lockfiles represent dependency state. Prefer changing the dependency definition instead." };
  if (/\.(json|yaml|yml|toml)$/.test(base)) return { badge: "Likely safe", className: "edit-safe", explanation: "Structured configuration or metadata is often editable, but the exact effect depends on the project." };
  if (/\.(css|scss|less|html|tsx|jsx|vue|svelte)$/.test(base)) return { badge: "Caution", className: "edit-caution", explanation: "This is likely user-facing code. It is editable, but changes can affect behavior or presentation." };
  if (/\.(js|ts|py|cs|java|kt|rs|go|cpp|c|h|hpp)$/.test(base)) return { badge: "Caution", className: "edit-caution", explanation: "Source code is editable, but changes may alter program behavior or introduce errors." };
  return { badge: "Unknown", className: "edit-unknown", explanation: "There is not enough evidence from the path alone to classify this file safely." };
}

async function previewFile(item) {
  const panel = document.querySelector("#file-preview-panel");
  const title = document.querySelector("#preview-title");
  const actions = document.querySelector("#preview-actions");
  const editabilityCard = document.querySelector("#editability-card");
  const preview = document.querySelector("#code-preview");

  if (!panel || !title || !actions || !editabilityCard || !preview || !item || !activeRepository) return;

  panel.hidden = false;
  title.textContent = item.path;
  actions.innerHTML = `<a class="preview-github" href="${escapeAttribute(`${activeRepository.html_url}/blob/${encodeURIComponent(activeRepository.branch)}/${item.path.split("/").map(encodeURIComponent).join("/")}`)}" target="_blank" rel="noreferrer">Open on GitHub ↗</a>`;

  const editability = classifyEditability(item.path);
  editabilityCard.innerHTML = `<span class="editability-dot ${editability.className}" aria-hidden="true"></span><div><b>${escapeHtml(editability.badge)}</b><p>${escapeHtml(editability.explanation)}</p></div>`;
  preview.innerHTML = `<div class="preview-loading">Loading file preview…</div>`;
  safeScrollTo(panel);

  if (item.size > MAX_PREVIEW_BYTES) {
    preview.innerHTML = `<div class="preview-empty">This file is too large for a browser preview (${formatBytes(item.size)}). Open it on GitHub instead.</div>`;
    return;
  }

  try {
    const apiUrl = `${API_BASE}/repo/${encodeURIComponent(activeRepository.owner)}/${encodeURIComponent(activeRepository.repo)}/file/${item.path.split("/").map(encodeURIComponent).join("/")}?branch=${encodeURIComponent(activeRepository.branch)}`;
    const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || `Preview could not be loaded (${response.status}).`);
    }

    if (/\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(item.path)) {
      preview.innerHTML = `<div class="preview-empty">Binary/image file. Open it on GitHub to view the original asset.</div>`;
      return;
    }

    const text = typeof payload.text === "string" ? payload.text : "";
    preview.innerHTML = `<div class="preview-meta">${escapeHtml(getFileType(item.path))} · ${formatBytes(payload.size || item.size || text.length)}</div><pre><code>${escapeHtml(text)}</code></pre>`;
  } catch (error) {
    preview.innerHTML = `<div class="preview-empty">${escapeHtml(error instanceof Error ? error.message : "Preview could not be loaded.")}</div>`;
  }
}

function detectPreviewMode(tree, projectType) {
  const paths = tree.filter((item) => item.type === "blob").map((item) => item.path.toLowerCase());
  if (paths.includes("index.html") || paths.some((path) => path.endsWith("/index.html"))) return { kind: "web", label: "Web candidate" };
  if (paths.some((path) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path))) return { kind: "media", label: "Media available" };
  if (/game|mod|plugin/i.test(projectType)) return { kind: "game", label: "Runtime capture" };
  return { kind: "generic", label: "Source overview" };
}

function detectLanguages(tree) {
  const counts = new Map();
  const extensions = { js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", ts: "TypeScript", tsx: "TypeScript", jsx: "JavaScript", html: "HTML", css: "CSS", scss: "SCSS", py: "Python", cs: "C#", java: "Java", kt: "Kotlin", rs: "Rust", go: "Go", cpp: "C++", c: "C", h: "C/C++", hpp: "C++", php: "PHP", rb: "Ruby", swift: "Swift", json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML", md: "Markdown" };

  for (const item of tree) {
    if (item.type !== "blob") continue;
    const match = item.path.toLowerCase().match(/\.([a-z0-9]+)$/);
    const language = match ? extensions[match[1]] : null;
    if (language) counts.set(language, (counts.get(language) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
}

function detectProjectType(tree, repository, languages) {
  const paths = tree.map((item) => item.path.toLowerCase());
  const description = `${repository.name} ${repository.full_name} ${languages.join(" ")}`.toLowerCase();
  const has = (name) => paths.some((path) => path === name || path.endsWith(`/${name}`));
  if (has("manifest.json") && description.includes("mod")) return "Game mod / plugin";
  if (has("package.json") && (has("vite.config.js") || has("vite.config.ts") || has("next.config.js") || has("next.config.ts") || has("index.html"))) return "Web application";
  if (has("pyproject.toml") || has("requirements.txt")) return "Python project";
  if (has("cargo.toml")) return "Rust project";
  if (has("go.mod")) return "Go project";
  if (has("pom.xml") || has("build.gradle")) return "Java project";
  if (languages.includes("C#")) return "C# / .NET project";
  if (description.includes("game")) return "Game project";
  if (description.includes("tool") || description.includes("utility")) return "Tool / utility";
  return languages[0] ? `${languages[0]} project` : "Software project";
}

function sortTreeItems(a, b) {
  if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function cleanReadme(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*>_`~#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

function getFileType(path) {
  const extension = path.split(".").pop()?.toLowerCase();
  const map = { js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", ts: "TypeScript", jsx: "JSX", tsx: "TSX", html: "HTML", css: "CSS", scss: "SCSS", json: "JSON", md: "Markdown", yaml: "YAML", yml: "YAML", py: "Python", cs: "C#", java: "Java", kt: "Kotlin", rs: "Rust", go: "Go", cpp: "C++", c: "C", h: "C/C++ header", toml: "TOML", xml: "XML", ini: "INI", cfg: "Config" };
  return map[extension] || "Text";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function setLoading(isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Analyzing…" : "Analyze";
  input?.toggleAttribute("disabled", isLoading);
}

function clearDynamicResults() {
  document.querySelectorAll(".analysis-result, .analysis-message").forEach((element) => element.remove());
}

function showMessage(message, type = "info") {
  document.querySelector(".analysis-message")?.remove();
  const element = document.createElement("p");
  element.className = `analysis-message ${type}`;
  element.textContent = message;
  card?.after(element);
}

function safeScrollTo(element) {
  element?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
}

function saveCachedAnalysis(url, analysis) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ url, analysis, savedAt: Date.now() })); } catch { /* optional */ }
}

function restoreCachedAnalysis() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (!cached?.analysis || !cached?.url) return;
    activeRepository = cached.analysis.repository;
    activeTree = cached.analysis.tree || [];
    if (input) input.value = cached.url;
    renderAnalysis(cached.analysis);
  } catch {
    // Ignore malformed or unavailable cache.
  }
}
