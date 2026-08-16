// Self-contained, fail-safe Analyze handler.
// It captures submit events at the document level so the legacy analyzer cannot
// also handle the same submit. It performs only one required tree request.
(() => {
  const API_BASE = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
  const MAX_TREE_ITEMS = 700;
  const TIMEOUT_MS = 10000;
  let runId = 0;
  let ready = false;

  const boot = () => {
    if (ready) return;
    ready = true;
    document.addEventListener("submit", onSubmit, true);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  async function onSubmit(event) {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || !form.matches(".simplifier-form")) return;

    // Prevent the legacy analyzer and any other listeners from running.
    event.preventDefault();
    event.stopImmediatePropagation();

    const input = form.querySelector("#repository-url");
    const button = form.querySelector(".simplifier-submit");
    const card = document.querySelector(".simplifier-card");
    const value = input?.value?.trim() || "";
    const parsed = parseRepositoryUrl(value);
    if (!parsed) {
      showLocalMessage("Enter a valid public GitHub repository URL.");
      return;
    }

    const current = ++runId;
    setLocalLoading(button, true);
    removeResults(card);

    try {
      if (!parsed.repo) {
        const repos = await requestJson(`${API_BASE}/user/${encodeURIComponent(parsed.owner)}/repos?limit=100`, TIMEOUT_MS);
        if (!Array.isArray(repos?.repositories) || !repos.repositories.length) {
          throw new Error(`No public repositories were found for ${parsed.owner}.`);
        }
        if (current !== runId) return;
        renderPicker(card, parsed.owner, repos.repositories);
        return;
      }

      const payload = await requestJson(`${API_BASE}/repo/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/tree`, TIMEOUT_MS);
      if (!payload || !Array.isArray(payload.tree)) {
        throw new Error("GitHub returned an invalid repository tree.");
      }
      const tree = payload.tree.slice(0, MAX_TREE_ITEMS);
      if (!tree.length) throw new Error("GitHub returned an empty repository tree.");
      if (current !== runId) return;

      renderBasicAnalysis(card, {
        owner: parsed.owner,
        repo: parsed.repo,
        branch: payload.branch || "main",
        tree,
        truncated: Boolean(payload.truncated),
      });
    } catch (error) {
      if (current !== runId) return;
      showLocalMessage(error instanceof Error ? error.message : "GitHub could not be analyzed.");
    } finally {
      if (current === runId) setLocalLoading(button, false);
    }
  }

  function parseRepositoryUrl(value) {
    try {
      const url = new URL(value);
      if (url.hostname.toLowerCase() !== "github.com") return null;
      const parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
      if (!parts.length) return null;
      return { owner: parts[0], repo: parts[1] ? parts[1].replace(/\.git$/, "") : null };
    } catch {
      return null;
    }
  }

  async function requestJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `GitHub returned an error (${response.status}).`);
      }
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("GitHub request timed out. Please try again.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setLocalLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "Analyzing…" : "Analyze";
  }

  function removeResults(card) {
    if (!card) return;
    let node = card.nextElementSibling;
    while (node) {
      const next = node.nextElementSibling;
      if (node.classList.contains("analysis-result") || node.classList.contains("analysis-message")) node.remove();
      node = next;
    }
  }

  function showLocalMessage(message) {
    const card = document.querySelector(".simplifier-card");
    removeResults(card);
    const box = document.createElement("div");
    box.className = "analysis-message";
    box.textContent = message;
    card?.after(box);
  }

  function renderPicker(card, owner, repositories) {
    const section = document.createElement("section");
    section.className = "analysis-result repository-picker-result";
    section.innerHTML = `
      <article class="analysis-panel">
        <div class="repository-picker-head">
          <div><span class="analysis-label">Repository selection</span><p class="repository-picker-message">Select a repository from ${escapeHtml(owner)}.</p></div>
          <span class="repository-picker-count">${repositories.length} public repos</span>
        </div>
        <div class="repository-picker" data-picker></div>
      </article>`;
    card?.after(section);
    const picker = section.querySelector("[data-picker]");
    for (const repo of repositories) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "repository-option";
      button.innerHTML = `<span class="repository-option-main"><span class="repository-option-name">${escapeHtml(repo.name)}</span><span class="repository-option-description">${escapeHtml(repo.description || "No description available.")}</span></span><span class="repository-option-meta"><span>${escapeHtml(repo.language || "")}</span><span>★ ${Number(repo.stargazers_count || 0)}</span><span class="repository-option-action">Analyze →</span></span>`;
      button.addEventListener("click", () => {
        const input = document.querySelector("#repository-url");
        if (input) input.value = repo.html_url || `https://github.com/${owner}/${repo.name}`;
        section.remove();
        document.querySelector(".simplifier-form")?.requestSubmit();
      });
      picker?.append(button);
    }
  }

  function renderBasicAnalysis(card, { owner, repo, branch, tree, truncated }) {
    const files = tree.filter((item) => item.type === "blob");
    const folders = tree.filter((item) => item.type === "tree");
    const languages = [...new Set(files.map((item) => extensionLanguage(item.path)).filter(Boolean))].slice(0, 8);

    const section = document.createElement("section");
    section.className = "analysis-result";
    section.innerHTML = `
      <div class="analysis-head">
        <div><p class="analysis-kicker">ANALYSIS COMPLETE · V2.3 SAFE MODE</p><h2>${escapeHtml(repo)}</h2><p class="analysis-owner">${escapeHtml(owner)}/${escapeHtml(repo)} · ${escapeHtml(branch)}</p></div>
        <a class="analysis-github" href="https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}" target="_blank" rel="noreferrer">GitHub ↗</a>
      </div>
      <div class="analysis-grid">
        <article class="analysis-panel analysis-summary"><span class="analysis-label">What is this?</span><strong>${escapeHtml(detectType(files, tree))}</strong><p>Repository structure analyzed directly from GitHub. File descriptions and richer analysis are intentionally disabled in this safe mode.</p></article>
        <article class="analysis-panel"><span class="analysis-label">Repository</span><div class="analysis-stats"><span><b>${files.length}</b> files</span><span><b>${folders.length}</b> folders</span><span><b>${tree.length}</b> scanned items${truncated ? " · partial" : ""}</span></div>${languages.length ? `<div class="analysis-tags">${languages.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}</article>
      </div>
      <details class="analysis-panel important-panel"><summary class="important-summary"><span class="important-summary-title"><span class="analysis-label">Key files</span><h3>Files worth knowing</h3></span><span class="important-summary-chevron" aria-hidden="true">›</span></summary><div class="important-list">${files.slice(0, 12).map((item) => `<div class="important-file-static"><span class="important-file-icon">◇</span><span><b>${escapeHtml(item.path)}</b><small>${escapeHtml(extensionLanguage(item.path) || "Project file")}</small></span></div>`).join("")}</div></details>
      <article class="analysis-panel"><div class="analysis-panel-heading"><div><span class="analysis-label">Repository map</span><h3>Explore the codebase</h3></div><span class="analysis-count">${tree.length} items</span></div><div class="tree-browser" data-tree></div></article>
    `;
    card?.after(section);
    renderTree(section.querySelector("[data-tree]"), tree);
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
    [...root.children.values()].sort((a,b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "tree" ? -1 : 1)).forEach((node) => frag.append(renderNode(node)));
    container?.replaceChildren(frag);
  }

  function renderNode(node) {
    if (node.type === "tree") {
      const details = document.createElement("details");
      details.className = "tree-folder";
      details.innerHTML = `<summary class="tree-row folder-row"><span class="tree-chevron">›</span><span class="tree-icon">▣</span><span class="tree-name">${escapeHtml(node.name)}</span><span class="tree-kind folder-kind">folder</span></summary>`;
      const children = document.createElement("div");
      children.className = "tree-children";
      const frag = document.createDocumentFragment();
      [...node.children.values()].sort((a,b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "tree" ? -1 : 1)).forEach((child) => frag.append(renderNode(child)));
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
})();
