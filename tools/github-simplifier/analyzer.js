const form = document.querySelector(".simplifier-form");
const input = document.querySelector("#repository-url");
const button = document.querySelector(".simplifier-submit");
const card = document.querySelector(".simplifier-card");

const apiBase = "https://api.github.com";
const MAX_TREE_ITEMS = 700;
const MAX_PREVIEW_BYTES = 180_000;
let activeRepository = null;
let activeTree = [];

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
    const repository = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}`);
    const readmePromise = githubFetch(`/repos/${parsed.owner}/${parsed.repo}/readme`, true);
    const languagesPromise = githubFetch(`/repos/${parsed.owner}/${parsed.repo}/languages`, true);
    const branch = repository.default_branch || "main";
    const branchInfo = await githubFetch(`/repos/${parsed.owner}/${parsed.repo}/branches/${encodeURIComponent(branch)}`);
    const treeSha = branchInfo?.commit?.commit?.tree?.sha;

    if (!treeSha) {
      throw new Error("GitHub did not return a repository tree for the default branch.");
    }

    const [readme, languages, treeResponse] = await Promise.all([
      readmePromise,
      languagesPromise,
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${treeSha}?recursive=1`),
    ]);

    activeRepository = { ...repository, owner: parsed.owner, repo: parsed.repo, branch };
    activeTree = Array.isArray(treeResponse?.tree) ? treeResponse.tree.slice(0, MAX_TREE_ITEMS) : [];

    renderAnalysis({ repository: activeRepository, readme, languages, tree: activeTree, truncated: Boolean(treeResponse?.truncated) });
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "GitHub could not be analyzed.", "error");
  } finally {
    setLoading(false);
  }
});

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

async function githubFetch(path, optional = false) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (response.ok) return response.json();
  if (optional && response.status === 404) return null;
  if (response.status === 403) throw new Error("GitHub API rate limit reached. Please wait a little and try again.");
  if (response.status === 404) throw new Error("Repository or requested resource was not found. Make sure the repository is public.");
  throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
}

function renderAnalysis({ repository, readme, languages, tree, truncated }) {
  document.querySelector(".analysis-result")?.remove();
  document.querySelector(".analysis-message")?.remove();

  const readmeText = readme?.content ? decodeBase64(readme.content) : "";
  const summary = cleanReadme(readmeText) || repository.description || "No project description is available yet.";
  const languageNames = languages ? Object.keys(languages).slice(0, 6) : [];
  const projectType = detectProjectType(tree, repository, languages);
  const important = rankImportantFiles(tree, repository, projectType);
  const rootEntries = tree.filter((item) => !item.path.includes("/")).sort(sortTreeItems);
  const fileCount = tree.filter((item) => item.type === "blob").length;
  const folderCount = tree.filter((item) => item.type === "tree").length;

  const result = document.createElement("section");
  result.className = "analysis-result";
  result.setAttribute("aria-live", "polite");
  result.innerHTML = `
    <div class="analysis-head">
      <div>
        <p class="analysis-kicker">ANALYSIS COMPLETE · V2</p>
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
          <span><b>${formatNumber(repository.stargazers_count)}</b> stars</span>
          <span><b>${formatNumber(repository.forks_count)}</b> forks</span>
          <span><b>${fileCount}</b> files · <b>${folderCount}</b> folders</span>
        </div>
        ${languageNames.length ? `<div class="analysis-tags">${languageNames.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}
      </article>
    </div>

    <article class="analysis-panel important-panel">
      <div class="analysis-panel-heading">
        <div>
          <span class="analysis-label">Key files</span>
          <h3>Files worth knowing</h3>
        </div>
        <span class="analysis-count">${important.length} highlighted</span>
      </div>
      <div class="important-list">
        ${important.map(renderImportantFile).join("") || `<p class="analysis-empty">No obvious key files were detected yet.</p>`}
      </div>
    </article>

    <article class="analysis-panel structure-panel">
      <div class="analysis-panel-heading">
        <div>
          <span class="analysis-label">Repository map</span>
          <h3>Explore the codebase</h3>
        </div>
        <span class="analysis-count">${Math.min(tree.length, MAX_TREE_ITEMS)} items${truncated ? " · partial" : ""}</span>
      </div>
      <div class="tree-browser" id="tree-browser"></div>
    </article>

    <article class="analysis-panel file-preview-panel" id="file-preview-panel" hidden>
      <div class="analysis-panel-heading">
        <div>
          <span class="analysis-label">File preview</span>
          <h3 id="preview-title">Select a file</h3>
        </div>
        <div class="preview-actions" id="preview-actions"></div>
      </div>
      <div class="editability-card" id="editability-card"></div>
      <div class="code-preview" id="code-preview"><span class="analysis-empty">Select a file from the repository map.</span></div>
    </article>

    <p class="analysis-disclaimer">V2 scans the repository tree, highlights likely important files, estimates editability and previews text files. These are heuristics, not guarantees. Private repositories are not accessed.</p>
  `;

  card?.after(result);
  renderTree(tree, result.querySelector("#tree-browser"));
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTree(tree, container) {
  if (!container) return;
  const nodes = buildTree(tree);
  container.replaceChildren(renderTreeNode(nodes, ""));
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

function renderTreeNode(node, level) {
  const fragment = document.createDocumentFragment();
  const entries = [...node.children.values()].sort(sortTreeItems);

  for (const child of entries) {
    if (child.type === "tree") {
      const details = document.createElement("details");
      details.className = "tree-folder";
      details.open = level === "";

      const summary = document.createElement("summary");
      summary.className = "tree-row folder-row";
      summary.innerHTML = `<span class="tree-chevron" aria-hidden="true">›</span><span class="tree-icon" aria-hidden="true">▣</span><span class="tree-name">${escapeHtml(child.name)}</span><span class="tree-kind">folder</span>`;
      details.append(summary);

      const children = document.createElement("div");
      children.className = "tree-children";
      children.append(renderTreeNode(child, `${level}  `));
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
    <span class="important-file-icon" aria-hidden="true">${item.type === "tree" ? "▣" : "◇"}</span>
    <span class="important-file-main"><b>${escapeHtml(item.path)}</b><small>${escapeHtml(item.reason)}</small></span>
    <span class="editability-pill ${editability.className}">${editability.badge}</span>
  </button>`;
}

function rankImportantFiles(tree, repository, projectType) {
  const candidates = tree.filter((item) => item.type === "blob");
  const scored = candidates.map((item) => {
    const path = item.path.toLowerCase();
    let score = 0;
    let reason = "Relevant project file";

    if (/^readme(\\.|$)/i.test(item.path)) { score += 100; reason = "Project documentation and usage overview"; }
    else if (/manifest\\.(json|xml|yaml|yml)$/i.test(item.path)) { score += 95; reason = "Project metadata or mod/plugin manifest"; }
    else if (/(^|\\/)package\\.json$/.test(path)) { score += 90; reason = "Dependencies and project scripts"; }
    else if (/(^|\\/)(vite|next|astro|webpack|rollup)\\.config\\./.test(path)) { score += 85; reason = "Build and development configuration"; }
    else if (/(^|\\/)(config|configs|configuration|settings)(\\/|\\.|$)/.test(path) || /config\\.(json|yaml|yml|toml|ini|cfg)$/.test(path)) { score += 80; reason = "Likely user-facing configuration"; }
    else if (/\\.(csproj|sln|gradle|pom|cargo|mod)$/.test(path)) { score += 75; reason = "Project/build configuration"; }
    else if (/(^|\\/)(index|main|app|program)\\.[a-z0-9]+$/.test(path)) { score += 70; reason = "Likely application entry point"; }
    else if (/\\.(html|tsx|jsx|vue|svelte)$/.test(path)) { score += 50; reason = "User-facing interface"; }
    else if (/\\.(css|scss|less)$/.test(path)) { score += 45; reason = "Visual styling"; }
    else if (/\\.(cs|java|kt|py|js|ts|cpp|c|rs|go)$/.test(path)) { score += 35; reason = `Source code for ${projectType.toLowerCase()}`; }

    if (path.includes("test") || path.includes("node_modules") || path.includes("dist/") || path.includes("build/")) score -= 50;
    return { ...item, score, reason };
  });

  return scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 10);
}

function classifyEditability(path) {
  const lower = path.toLowerCase();
  if (/(^|\\/)(node_modules|dist|build|bin|obj|\.git)(\\/|$)/.test(lower)) return { badge: "Core", className: "edit-core", explanation: "Generated or dependency content. Editing it directly is usually not the right approach." };
  if (/\.(dll|exe|so|dylib|jar|class|wasm)$/i.test(lower)) return { badge: "Core", className: "edit-core", explanation: "Compiled or binary content. It is generally not intended for manual editing." };
  if (/(^|\\/)(config|configs|configuration|settings)(\\/|$)/.test(lower) || /(^|\\/)(config|settings)\.(json|yaml|yml|toml|ini|cfg)$/i.test(lower) || /\.(cfg|ini)$/i.test(lower)) return { badge: "Likely safe", className: "edit-safe", explanation: "The path looks like user-facing configuration. Changes should still be checked against the project's documentation." };
  if (/^readme(\.|$)/i.test(path) || /(^|\\/)(docs?|documentation)(\\/|$)/i.test(lower)) return { badge: "Likely safe", className: "edit-safe", explanation: "Documentation is normally safe to edit and does not directly change runtime behavior." };
  if (/(^|\\/)(package-lock|pnpm-lock|yarn\.lock|composer\.lock|cargo\.lock)$/i.test(lower)) return { badge: "Caution", className: "edit-caution", explanation: "Lockfiles are generated from dependency state. Prefer changing the dependency definition instead." };
  if (/\.(json|yaml|yml|toml)$/i.test(lower) && !/package-lock|pnpm-lock|yarn\.lock|cargo\.lock/.test(lower)) return { badge: "Likely safe", className: "edit-safe", explanation: "Structured configuration or metadata is often editable, but the exact effect depends on the project." };
  if (/\.(css|scss|less|html|tsx|jsx|vue|svelte)$/i.test(lower)) return { badge: "Caution", className: "edit-caution", explanation: "This is likely user-facing code. It is editable, but changes can affect application behavior or presentation." };
  if (/\.(js|ts|py|cs|java|kt|rs|go|cpp|c|h|hpp)$/i.test(lower)) return { badge: "Caution", className: "edit-caution", explanation: "Source code is editable, but changes may alter program behavior or introduce errors." };
  return { badge: "Unknown", className: "edit-unknown", explanation: "There is not enough evidence from the path alone to classify this file safely." };
}

async function previewFile(item) {
  const panel = document.querySelector("#file-preview-panel");
  const title = document.querySelector("#preview-title");
  const actions = document.querySelector("#preview-actions");
  const editabilityCard = document.querySelector("#editability-card");
  const preview = document.querySelector("#code-preview");
  if (!panel || !title || !actions || !editabilityCard || !preview || !activeRepository) return;

  panel.hidden = false;
  title.textContent = item.path;
  actions.innerHTML = `<a class="preview-github" href="${escapeAttribute(item.html_url || `${activeRepository.html_url}/blob/${encodeURIComponent(activeRepository.branch)}/${item.path}`)}" target="_blank" rel="noreferrer">Open on GitHub ↗</a>`;

  const editability = classifyEditability(item.path);
  editabilityCard.innerHTML = `<span class="editability-dot ${editability.className}" aria-hidden="true"></span><div><b>${escapeHtml(editability.badge)}</b><p>${escapeHtml(editability.explanation)}</p></div>`;
  preview.innerHTML = `<div class="preview-loading">Loading file preview…</div>`;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    if (item.size > MAX_PREVIEW_BYTES) {
      preview.innerHTML = `<div class="preview-empty">This file is too large for a browser preview (${formatBytes(item.size)}). Open it on GitHub instead.</div>`;
      return;
    }

    const data = await githubFetch(`/repos/${activeRepository.owner}/${activeRepository.repo}/contents/${item.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(activeRepository.branch)}`);
    if (Array.isArray(data) || !data) throw new Error("GitHub did not return a readable file.");
    if (data.size > MAX_PREVIEW_BYTES) throw new Error("This file is too large for a browser preview.");

    const content = data.content ? decodeBase64(data.content) : "";
    if (!content) {
      preview.innerHTML = `<div class="preview-empty">This file has no text content available for preview.</div>`;
      return;
    }

    const language = detectLanguage(item.path);
    preview.innerHTML = `<div class="preview-meta">${escapeHtml(language)} · ${formatBytes(data.size || item.size || content.length)}</div><pre><code>${escapeHtml(content.slice(0, 160_000))}</code></pre>`;
  } catch (error) {
    preview.innerHTML = `<div class="preview-empty">${escapeHtml(error instanceof Error ? error.message : "File preview failed.")}</div>`;
  }
}

document.addEventListener("click", (event) => {
  const importantButton = event.target.closest(".important-file");
  if (!importantButton) return;
  const path = importantButton.dataset.path;
  const item = activeTree.find((entry) => entry.path === path);
  if (item) previewFile(item);
});

function detectLanguage(path) {
  const extension = path.split(".").pop()?.toLowerCase();
  const map = { js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", ts: "TypeScript", jsx: "JSX", tsx: "TSX", html: "HTML", css: "CSS", scss: "SCSS", json: "JSON", md: "Markdown", yaml: "YAML", yml: "YAML", py: "Python", cs: "C#", java: "Java", kt: "Kotlin", rs: "Rust", go: "Go", cpp: "C++", c: "C", h: "C/C++ header", toml: "TOML", xml: "XML", ini: "INI", cfg: "Config" };
  return map[extension] || "Text";
}

function detectProjectType(tree, repository, languages) {
  const paths = tree.map((item) => item.path.toLowerCase());
  const description = `${repository.description || ""} ${repository.name || ""} ${(repository.topics || []).join(" ")}`.toLowerCase();
  const languageNames = Object.keys(languages || {}).map((name) => name.toLowerCase());
  const has = (name) => paths.some((path) => path === name || path.endsWith(`/${name}`));

  if ((has("manifest.json") || paths.some((path) => /manifest\\.(json|xml|yaml|yml)$/.test(path))) && /(mod|plugin|bepinex|valheim|minecraft)/.test(description)) return "Game mod / plugin";
  if (paths.some((path) => /(^|\\/)package\\.json$/.test(path)) && paths.some((path) => /(^|\\/)(vite|next|astro)\.config\./.test(path))) return "Web application";
  if (has("pyproject.toml") || has("requirements.txt")) return "Python project";
  if (has("cargo.toml")) return "Rust project";
  if (has("go.mod")) return "Go project";
  if (has("pom.xml") || has("build.gradle")) return "Java project";
  if (languageNames.includes("c#") || languageNames.includes("csharp") || paths.some((path) => path.endsWith(".csproj"))) return "C# / .NET project";
  if (description.includes("game")) return "Game project";
  if (description.includes("tool") || description.includes("utility")) return "Tool / utility";
  return repository.language ? `${repository.language} project` : "Software project";
}

function cleanReadme(text) {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^#{1,6}\s*/gm, "").replace(/[*_`>#~-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 420);
}

function decodeBase64(value) {
  try {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function sortTreeItems(a, b) {
  if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttribute(value) { return escapeHtml(value); }

function setLoading(isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Scanning…" : "Analyze";
  input?.toggleAttribute("disabled", isLoading);
}

function showMessage(message, type = "info") {
  document.querySelector(".analysis-message")?.remove();
  document.querySelector(".analysis-result")?.remove();
  const element = document.createElement("p");
  element.className = `analysis-message ${type}`;
  element.textContent = message;
  card?.after(element);
}
