const form = document.querySelector(".simplifier-form");
const input = document.querySelector("#repository-url");
const button = document.querySelector(".simplifier-submit");
const card = document.querySelector(".simplifier-card");

const API_BASE = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
const MAX_TREE_ITEMS = 700;
const REPOSITORY_LIST_LIMIT = 100;

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
      if (!repositories.length) throw new Error(`No public repositories were found for ${parsed.owner}.`);
      renderRepositoryPicker({ owner: parsed.owner, repositories, message: `Select a repository from ${parsed.owner}.` });
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

    const tree = Array.isArray(treeResult.tree) ? treeResult.tree.slice(0, MAX_TREE_ITEMS) : [];
    if (!tree.length) throw new Error("GitHub returned an empty repository tree.");

    const repository = {
      owner: parsed.owner,
      repo: parsed.repo,
      name: parsed.repo,
      full_name: `${parsed.owner}/${parsed.repo}`,
      branch: treeResult.branch || "main",
      html_url: `https://github.com/${parsed.owner}/${parsed.repo}`,
    };

    renderAnalysis({ repository, tree, truncated: Boolean(treeResult.truncated) });
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
    const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (!parts.length) return null;
    return { owner: parts[0], repo: parts[1] ? parts[1].replace(/\.git$/, "") : null };
  } catch {
    return null;
  }
}

async function fetchUserRepositories(owner) {
  const response = await fetch(`${API_BASE}/user/${encodeURIComponent(owner)}/repos?limit=${REPOSITORY_LIST_LIMIT}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return Array.isArray(payload?.repositories) ? payload.repositories : [];
  if (response.status === 404) throw new Error(`GitHub user “${owner}” was not found.`);
  if (response.status === 429) throw new Error("GitHub is temporarily rate-limiting the Simplifier. Please try again later.");
  throw new Error(payload?.error || `GitHub returned an error (${response.status}).`);
}

async function fetchRepositoryTree(owner, repo) {
  const response = await fetch(`${API_BASE}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  if (response.status === 404) return null;
  if (response.status === 429) throw new Error("GitHub is temporarily rate-limiting the Simplifier. Please try again later.");
  throw new Error(payload?.error || `GitHub returned an error (${response.status}).`);
}

function renderRepositoryPicker({ owner, repositories, message }) {
  const result = document.createElement("section");
  result.className = "analysis-result repository-picker-result";
  result.setAttribute("aria-live", "polite");
  result.innerHTML = `
    <article class="analysis-panel">
      <div class="repository-picker-head">
        <div><span class="analysis-label">Repository selection</span><p class="repository-picker-message">${escapeHtml(message)}</p></div>
        <span class="repository-picker-count">${repositories.length} public repos</span>
      </div>
      <div class="repository-picker" data-picker></div>
    </article>
  `;
  card?.after(result);
  const picker = result.querySelector("[data-picker]");
  for (const repo of repositories) {
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
        <span>★ ${Number(repo.stargazers_count || 0)}</span>
        <span class="repository-option-action">Analyze →</span>
      </span>`;
    option.addEventListener("click", () => {
      if (input) input.value = repo.html_url || `https://github.com/${owner}/${repo.name}`;
      result.remove();
      setLoading(false);
      setTimeout(() => form?.requestSubmit(), 0);
    });
    picker?.append(option);
  }
}

function renderAnalysis({ repository, tree, truncated }) {
  const files = tree.filter((item) => item.type === "blob");
  const folders = tree.filter((item) => item.type === "tree");
  const languages = [...new Set(files.map((item) => extensionLanguage(item.path)).filter(Boolean))].slice(0, 8);
  const result = document.createElement("section");
  result.className = "analysis-result";
  result.setAttribute("aria-live", "polite");
  result.innerHTML = `
    <div class="analysis-head">
      <div><p class="analysis-kicker">ANALYSIS COMPLETE · V2.3</p><h2>${escapeHtml(repository.name)}</h2><p class="analysis-owner">${escapeHtml(repository.full_name)} · ${escapeHtml(repository.branch)}</p></div>
      <a class="analysis-github" href="${escapeAttribute(repository.html_url)}" target="_blank" rel="noreferrer">GitHub ↗</a>
    </div>
    <div class="analysis-grid">
      <article class="analysis-panel analysis-summary"><span class="analysis-label">What is this?</span><strong>${escapeHtml(detectType(files, tree))}</strong><p>Repository structure analyzed directly from GitHub. Deeper file analysis is temporarily disabled while the core analyzer is stabilized.</p></article>
      <article class="analysis-panel"><span class="analysis-label">Repository</span><div class="analysis-stats"><span><b>${files.length}</b> files</span><span><b>${folders.length}</b> folders</span><span><b>${tree.length}</b> scanned items${truncated ? " · partial" : ""}</span></div>${languages.length ? `<div class="analysis-tags">${languages.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}</article>
    </div>
    <details class="analysis-panel important-panel">
      <summary class="important-summary"><span class="important-summary-title"><span class="analysis-label">Key files</span><h3>Files worth knowing</h3></span><span class="important-summary-chevron" aria-hidden="true">›</span></summary>
      <div class="important-list">${files.slice(0, 12).map((item) => `<div class="important-file-static"><span class="important-file-icon">◇</span><span><b>${escapeHtml(item.path)}</b><small>${escapeHtml(extensionLanguage(item.path) || "Project file")}</small></span></div>`).join("") || `<p class="analysis-empty">No obvious key files were detected yet.</p>`}</div>
    </details>
    <article class="analysis-panel">
      <div class="analysis-panel-heading"><div><span class="analysis-label">Repository map</span><h3>Explore the codebase</h3></div><span class="analysis-count">${tree.length} items${truncated ? " · partial" : ""}</span></div>
      <div class="tree-browser" data-tree></div>
    </article>`;
  card?.after(result);
  renderTree(result.querySelector("[data-tree]"), tree);
}

function renderTree(container, items) {
  const root = { children: new Map() };
  for (const item of items) {
    const parts = item.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, index) => {
      if (!node.children.has(part)) node.children.set(part, { name: part, type: index === parts.length - 1 ? item.type : "tree", children: new Map() });
      node = node.children.get(part);
    });
  }
  const frag = document.createDocumentFragment();
  [...root.children.values()].sort(sortNodes).forEach((node) => frag.append(renderNode(node)));
  container?.replaceChildren(frag);
}

function sortNodes(a, b) {
  if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function renderNode(node) {
  if (node.type === "tree") {
    const details = document.createElement("details");
    details.className = "tree-folder";
    details.innerHTML = `<summary class="tree-row folder-row"><span class="tree-chevron">›</span><span class="tree-icon">▣</span><span class="tree-name">${escapeHtml(node.name)}</span><span class="tree-kind folder-kind">folder</span></summary>`;
    const children = document.createElement("div");
    children.className = "tree-children";
    const frag = document.createDocumentFragment();
    [...node.children.values()].sort(sortNodes).forEach((child) => frag.append(renderNode(child)));
    children.append(frag);
    details.append(children);
    return details;
  }
  const row = document.createElement("div");
  row.className = "tree-row file-row";
  row.innerHTML = `<span class="tree-spacer"></span><span class="tree-icon">◇</span><span class="tree-name">${escapeHtml(node.name)}</span><span class="tree-kind">${escapeHtml(extensionLanguage(node.name) || "file")}</span>`;
  return row;
}

function extensionLanguage(path) {
  const ext = path.toLowerCase().split(".").pop();
  return ({js:"JavaScript",mjs:"JavaScript",cjs:"JavaScript",ts:"TypeScript",tsx:"TypeScript",jsx:"JavaScript",html:"HTML",htm:"HTML",css:"CSS",scss:"SCSS",json:"JSON",md:"Markdown",cs:"C#",py:"Python",java:"Java",kt:"Kotlin",rs:"Rust",yml:"YAML",yaml:"YAML",toml:"TOML"})[ext] || "";
}

function detectType(files, tree) {
  if (files.some((item) => /\.csproj$|\.cs$/i.test(item.path)) && tree.some((item) => /BepInEx|Valheim/i.test(item.path))) return "C# mod / plugin project";
  if (files.some((item) => /(^|\/)index\.html?$/i.test(item.path))) return "Web project";
  if (files.some((item) => /\.py$/i.test(item.path))) return "Python project";
  if (files.some((item) => /\.cs$/i.test(item.path))) return "C# project";
  return "GitHub project";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
