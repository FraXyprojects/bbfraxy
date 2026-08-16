const form = document.querySelector(".simplifier-form");
const input = document.querySelector("#repository-url");
const button = document.querySelector(".simplifier-submit");
const card = document.querySelector(".simplifier-card");

const apiBase = "https://api.github.com";

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
    const [repository, readme, contents, languages] = await Promise.all([
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}`),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/readme`, true),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/contents/`),
      githubFetch(`/repos/${parsed.owner}/${parsed.repo}/languages`, true),
    ]);

    renderAnalysis({ repository, readme, contents, languages });
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "GitHub could not be analyzed.", "error");
  } finally {
    setLoading(false);
  }
});

function parseRepositoryUrl(value) {
  try {
    const url = new URL(value.trim());

    if (url.hostname.toLowerCase() !== "github.com") {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");

    if (!owner || !repo) {
      return null;
    }

    return { owner, repo };
  } catch {
    return null;
  }
}

async function githubFetch(path, optional = false) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (response.ok) {
    return response.json();
  }

  if (optional && response.status === 404) {
    return null;
  }

  if (response.status === 403) {
    throw new Error("GitHub API rate limit reached. Please wait a little and try again.");
  }

  if (response.status === 404) {
    throw new Error("Repository not found. Make sure the URL points to a public GitHub repository.");
  }

  throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
}

function renderAnalysis({ repository, readme, contents, languages }) {
  const files = Array.isArray(contents) ? contents : [];
  const fileNames = files.map((item) => item.name).filter(Boolean);
  const projectType = detectProjectType(fileNames, repository, languages);
  const readmeText = readme?.content ? decodeBase64(readme.content) : "";
  const summary = cleanReadme(readmeText) || repository.description || "No project description is available yet.";
  const languageNames = languages ? Object.keys(languages).slice(0, 4) : [];

  const existing = document.querySelector(".analysis-result");
  existing?.remove();

  const result = document.createElement("section");
  result.className = "analysis-result";
  result.setAttribute("aria-live", "polite");

  result.innerHTML = `
    <div class="analysis-head">
      <div>
        <p class="analysis-kicker">ANALYSIS COMPLETE</p>
        <h2>${escapeHtml(repository.name)}</h2>
        <p class="analysis-owner">${escapeHtml(repository.full_name)}</p>
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
          <span><b>${escapeHtml(repository.default_branch || "main")}</b> branch</span>
        </div>
        ${languageNames.length ? `<div class="analysis-tags">${languageNames.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}
      </article>
    </div>

    <article class="analysis-panel analysis-files">
      <div class="analysis-panel-heading">
        <div>
          <span class="analysis-label">Top level</span>
          <h3>Repository structure</h3>
        </div>
        <span class="analysis-count">${files.length} items</span>
      </div>
      <div class="file-list">
        ${files.slice(0, 16).map(renderFile).join("") || `<p class="analysis-empty">No top-level files were returned.</p>`}
      </div>
    </article>

    <p class="analysis-disclaimer">This first version reads public GitHub metadata, the README and the repository root. Deeper code analysis, editable-file detection and interactive previews come next.</p>
  `;

  card?.after(result);
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderFile(file) {
  const icon = file.type === "dir" ? "▣" : "◇";
  const label = file.type === "dir" ? "folder" : "file";

  return `<a class="file-item" href="${escapeAttribute(file.html_url || "#")}" target="_blank" rel="noreferrer">
    <span class="file-icon" aria-hidden="true">${icon}</span>
    <span class="file-name">${escapeHtml(file.name)}</span>
    <span class="file-type">${label}</span>
  </a>`;
}

function detectProjectType(fileNames, repository, languages) {
  const names = new Set(fileNames.map((name) => name.toLowerCase()));
  const description = `${repository.description || ""} ${repository.name || ""}`.toLowerCase();
  const languageNames = Object.keys(languages || {}).map((name) => name.toLowerCase());

  if (names.has("manifest.json") && (description.includes("mod") || names.has("package"))) {
    return "Game mod / plugin";
  }

  if (names.has("package.json") && (names.has("vite.config.js") || names.has("vite.config.ts") || names.has("next.config.js") || names.has("next.config.ts"))) {
    return "Web application";
  }

  if (names.has("pyproject.toml") || names.has("requirements.txt")) {
    return "Python project";
  }

  if (names.has("cargo.toml")) {
    return "Rust project";
  }

  if (names.has("go.mod")) {
    return "Go project";
  }

  if (names.has("pom.xml") || names.has("build.gradle")) {
    return "Java project";
  }

  if (languageNames.includes("c#") || languageNames.includes("csharp") || [...names].some((name) => name.endsWith(".csproj"))) {
    return "C# / .NET project";
  }

  if (description.includes("game")) {
    return "Game project";
  }

  if (description.includes("tool") || description.includes("utility")) {
    return "Tool / utility";
  }

  return repository.language ? `${repository.language} project` : "Software project";
}

function cleanReadme(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
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

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function showMessage(message, type = "info") {
  const existing = document.querySelector(".analysis-message");
  existing?.remove();

  const element = document.createElement("p");
  element.className = `analysis-message ${type}`;
  element.textContent = message;
  card?.after(element);
}
