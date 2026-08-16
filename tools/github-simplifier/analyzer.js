const form = document.querySelector(".simplifier-form");
const input = document.querySelector("#repository-url");
const button = document.querySelector(".simplifier-submit");
const card = document.querySelector(".simplifier-card");

const apiBase = "https://api.github.com";
const MAX_TREE_ITEMS = 700;
const MAX_PREVIEW_BYTES = 180000;
const CACHE_KEY = "bbfraxy.github-simplifier.v2";
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

  try {
    // V2.1 deliberately avoids the repository metadata, languages and branch
    // endpoints. The recursive tree is the main API request; README and file
    // previews use raw.githubusercontent.com instead and do not consume the
    // GitHub REST API quota.
    const treeResponse = await fetchRepositoryTree(parsed.owner, parsed.repo);
    const tree = Array.isArray(treeResponse.tree) ? treeResponse.tree.slice(0, MAX_TREE_ITEMS) : [];
    if (!tree.length) throw new Error("GitHub returned an empty repository tree.");

    const branch = treeResponse.branch;
    const repository = {
      owner: parsed.owner,
      repo: parsed.repo,
      name: parsed.repo,
      full_name: `${parsed.owner}/${parsed.repo}`,
      branch,
      html_url: `https://github.com/${parsed.owner}/${parsed.repo}`,
    };

    const readmeText = await fetchReadme(parsed.owner, parsed.repo, branch);
    const languages = detectLanguages(tree);

    activeRepository = repository;
    activeTree = tree;

    const analysis = { repository, readmeText, languages, tree, truncated: Boolean(treeResponse.truncated) };
    saveCachedAnalysis(input.value.trim(), analysis);
    renderAnalysis(analysis);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "GitHub could not be analyzed.", "error");
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
    .code-preview { width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; overflow-y: auto; }
    .code-preview pre { width: max-content; min-width: 100%; max-width: none; }
    .analysis-disclaimer { overflow-wrap: anywhere; }
    .important-panel { overflow: hidden; }
    .important-panel > summary { list-style: none; cursor: pointer; }
    .important-panel > summary::-webkit-details-marker { display: none; }
    .important-summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .important-summary:hover .important-summary-title h3 { color: var(--accent-strong); }
    .important-summary-title { min-width: 0; }
    .important-summary-chevron { flex: 0 0 auto; color: var(--faint); font-size: 1.1rem; transition: transform 160ms ease; }
    .important-panel[open] .important-summary-chevron { transform: rotate(90deg); }
    .important-list { margin-top: 15px; }
    @media (max-width: 620px) {
      .important-summary { align-items: flex-start; }
    }
  `;
  document.head.append(style);
}

function parseRepositoryUrl(value) {
  try {
    const url = new URL(value.trim());
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    return owner && repo ? { owner, repo } : null;
  } catch {
    return null;
  }
}

async function fetchRepositoryTree(owner, repo) {
  const branches = ["main", "master"];
  let lastStatus = null;

  for (const branch of branches) {
    const response = await fetch(`${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (response.ok) {
      const data = await response.json();
      return { ...data, branch };
    }

    lastStatus = response.status;
    if (response.status === 403) {
      throw new Error("GitHub API rate limit reached. Try again later. The analyzer now uses only one REST request for the repository scan.");
    }
    if (response.status !== 404) break;
  }

  if (lastStatus === 404) {
    throw new Error("Repository or default branch was not found. Make sure the repository is public and uses a main or master branch.");
  }
  throw new Error(`GitHub returned an error (${lastStatus || "unknown"}). Please try again.`);
}

async function fetchReadme(owner, repo, branch) {
  const candidates = ["README.md", "readme.md", "README.MD"];
  for (const file of candidates) {
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${file}`;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return cleanReadme(await response.text());
    } catch {
      // README is optional. Keep the analyzer useful if raw content is unavailable.
    }
  }
  return "";
}

function renderAnalysis({ repository, readmeText, languages, tree, truncated }) {
  document.querySelector(".analysis-result")?.remove();
  document.querySelector(".analysis-message")?.remove();

  const summary = readmeText || "No project description is available yet. The repository structure below is inferred directly from the source tree.";
  const projectType = detectProjectType(tree, repository, languages);
  const important = rankImportantFiles(tree, projectType);
  const fileCount = tree.filter((item) => item.type === "blob").length;
  const folderCount = tree.filter((item) => item.type === "tree").length;

  const result = document.createElement("section");
  result.className = "analysis-result";
  result.setAttribute("aria-live", "polite");
  result.innerHTML = `
    <div class="analysis-head">
      <div>
        <p class="analysis-kicker">ANALYSIS COMPLETE · V2.1</p>
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

    <p class="analysis-disclaimer">V2.1 uses one GitHub REST request for the repository tree. README and file previews are loaded directly from raw GitHub content. Editability labels are heuristics, not guarantees.</p>
  `;

  card?.after(result);
  renderTree(tree, result.querySelector("#tree-browser"));
  result.querySelectorAll(".important-file").forEach((element) => {
    element.addEventListener("click", () => previewFile(activeTree.find((item) => item.path === element.dataset.path)));
  });
  safeScrollTo(result);
}

function buildTree(tree) {
  const root = { name: "", path: "", type: "tree", children: new Map(), item: null };
  for (const item of tree) {
    const parts = item.path.split("/");
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
      details.open = node.path === "";

      const summary = document.createElement("summary");
      summary.className = "tree-row folder-row";
      summary.innerHTML = `<span class="tree-chevron" aria-hidden="true">›</span><span class="tree-icon" aria-hidden="true">▣</span><span class="tree-name">${escapeHtml(child.name)}</span><span class="tree-kind">folder</span>`;
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
      row.innerHTML = `<span class="tree-spacer" aria-hidden="true"></span><span class="tree-icon" aria-hidden="true">◇</span><span class="tree-name">${escapeHtml(child.name)}</span><span class="tree-kind">${editability.badge}</span>`;
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
    <span class="editability-pill ${editability.className}">${editability.badge}</span>
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

      if (parts.includes("node_modules") || parts.includes("dist") || parts.includes("build") || parts.includes("test") || parts.includes("tests")) score -= 50;
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
  if (/\.(js|ts|py|cs|java|kt|cpp|c|rs|go)$/.test(base)) return { badge: "Core", className: "edit-core", explanation: "Core source code. It can be edited, but changes may alter application behavior." };
  return { badge: "Unknown", className: "edit-unknown", explanation: "The analyzer cannot confidently classify this file." };
}

async function previewFile(item) {
  if (!item || item.type !== "blob" || !activeRepository) return;

  const panel = document.querySelector("#file-preview-panel");
  const title = document.querySelector("#preview-title");
  const actions = document.querySelector("#preview-actions");
  const editabilityCard = document.querySelector("#editability-card");
  const code = document.querySelector("#code-preview");
  if (!panel || !title || !actions || !editabilityCard || !code) return;

  panel.hidden = false;
  title.textContent = item.path;
  actions.innerHTML = `<a class="preview-github" href="https://github.com/${encodeURIComponent(activeRepository.owner)}/${encodeURIComponent(activeRepository.repo)}/blob/${encodeURIComponent(activeRepository.branch)}/${item.path.split("/").map(encodeURIComponent).join("/")}" target="_blank" rel="noreferrer">Open on GitHub ↗</a>`;

  const editability = classifyEditability(item.path);
  editabilityCard.innerHTML = `<span class="editability-dot ${editability.className}" aria-hidden="true"></span><div><b>${escapeHtml(editability.badge)}</b><p>${escapeHtml(editability.explanation)}</p></div>`;
  code.innerHTML = `<div class="preview-loading">Loading ${escapeHtml(item.path)}…</div>`;
  safeScrollTo(panel);

  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(activeRepository.owner)}/${encodeURIComponent(activeRepository.repo)}/${encodeURIComponent(activeRepository.branch)}/${item.path.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const response = await fetch(rawUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load this file (${response.status}).`);
    const content = await response.text();
    if (content.length > MAX_PREVIEW_BYTES) {
      code.innerHTML = `<div class="preview-empty">This file is too large for an inline preview. Open it on GitHub instead.</div>`;
      return;
    }
    const bytes = new Blob([content]).size;
    code.innerHTML = `<div class="preview-meta">${escapeHtml(getLanguageLabel(item.path))} · ${formatBytes(bytes)}</div><pre>${escapeHtml(content)}</pre>`;
  } catch (error) {
    code.innerHTML = `<div class="preview-empty">${escapeHtml(error instanceof Error ? error.message : "Unable to preview this file.")}</div>`;
  }
}

function detectLanguages(tree) {
  const counts = new Map();
  const extensions = {
    cs: "C#", js: "JavaScript", jsx: "JavaScript", ts: "TypeScript", tsx: "TypeScript", py: "Python", java: "Java", kt: "Kotlin", cpp: "C++", c: "C", h: "C/C++", rs: "Rust", go: "Go", php: "PHP", rb: "Ruby", swift: "Swift", html: "HTML", css: "CSS", scss: "SCSS", vue: "Vue", svelte: "Svelte", json: "JSON", yaml: "YAML", yml: "YAML", md: "Markdown" };
  tree.filter((item) => item.type === "blob").forEach((item) => {
    const match = item.path.match(/\.([^.\/]+)$/);
    const language = match ? extensions[match[1].toLowerCase()] : null;
    if (language) counts.set(language, (counts.get(language) || 0) + (item.size || 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
}

function detectProjectType(tree, repository, languages) {
  const paths = tree.map((item) => item.path.toLowerCase());
  const name = repository.name.toLowerCase();
  if (paths.some((path) => path.endsWith("manifest.json")) && paths.some((path) => path.includes("plugins/"))) return "Game mod / plugin";
  if (paths.some((path) => path.endsWith("package.json"))) return "JavaScript / web project";
  if (paths.some((path) => path.endsWith(".csproj")) || languages.includes("C#")) return "C# project";
  if (paths.some((path) => path.endsWith(".sln"))) return ".NET solution";
  if (paths.some((path) => path.endsWith("requirements.txt")) || languages.includes("Python")) return "Python project";
  if (paths.some((path) => path.endsWith("index.html")) && (languages.includes("HTML") || languages.includes("CSS"))) return "Web project";
  if (name.includes("mod") || name.includes("plugin")) return "Mod / plugin project";
  return languages[0] ? `${languages[0]} project` : "Software project";
}

function cleanReadme(text) {
  return text
    .replace(/^\s*#.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#~-]/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" ")
    .slice(0, 520);
}

function sortTreeItems(a, b) {
  if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function getLanguageLabel(path) {
  const ext = (path.split(".").pop() || "").toLowerCase();
  const map = { cs: "C#", js: "JavaScript", ts: "TypeScript", jsx: "JavaScript", tsx: "TypeScript", json: "JSON", md: "Markdown", html: "HTML", css: "CSS", yaml: "YAML", yml: "YAML", py: "Python", java: "Java", rs: "Rust", cpp: "C++", c: "C", xml: "XML", ini: "INI", cfg: "Config" };
  return map[ext] || (ext ? ext.toUpperCase() : "Text");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function saveCachedAnalysis(url, analysis) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ url, analysis, savedAt: Date.now() }));
  } catch {
    // Cache is an enhancement only.
  }
}

function restoreCachedAnalysis() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (!cached?.analysis?.repository || !Array.isArray(cached.analysis.tree)) return;
    if (input && cached.url) input.value = cached.url;
    activeRepository = cached.analysis.repository;
    activeTree = cached.analysis.tree;
    renderAnalysis(cached.analysis);
  } catch {
    // Ignore invalid or unavailable session storage.
  }
}

function setLoading(loading) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Analyzing…" : "Analyze";
}

function showMessage(message) {
  document.querySelector(".analysis-message")?.remove();
  const result = document.querySelector(".analysis-result");
  const element = document.createElement("div");
  element.className = "analysis-message";
  element.textContent = message;
  (result || card)?.after(element);
}

function safeScrollTo(element) {
  element?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  window.setTimeout(() => {
    if (window.scrollX !== 0) window.scrollTo({ left: 0, behavior: "instant" });
  }, 120);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}
