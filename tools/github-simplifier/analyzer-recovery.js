// Stable submit path for GitHub Simplifier.
// It intentionally renders from repository metadata/tree first and treats README as optional background data.
(() => {
  const form = document.querySelector(".simplifier-form");
  const input = document.querySelector("#repository-url");
  if (!form || !input) return;

  let runId = 0;
  const LIMIT = 9000;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    runAnalysis(input.value || "");
  }, true);

  async function runAnalysis(value) {
    const currentRun = ++runId;
    const parsed = parseRepositoryUrl(value);
    if (!parsed) {
      showMessage("Enter a valid public GitHub repository URL.", "error");
      input.focus();
      return;
    }

    setLoading(true);
    clearDynamicResults();

    try {
      if (!parsed.repo) {
        const repositories = await withTimeout(fetchUserRepositories(parsed.owner), LIMIT, "Repository list request timed out.");
        if (!repositories.length) throw new Error(`No public repositories were found for ${parsed.owner}.`);
        renderRepositoryPicker({
          owner: parsed.owner,
          repositories,
          message: `Select a repository from ${parsed.owner}.`,
        });
        return;
      }

      const treeResult = await withTimeout(fetchRepositoryTree(parsed.owner, parsed.repo), LIMIT, "Repository tree request timed out. Please try again.");
      if (!treeResult) {
        const repositories = await withTimeout(fetchUserRepositories(parsed.owner), LIMIT, "Repository lookup timed out. Please try again.");
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

      const languages = detectLanguages(tree);
      const analysis = {
        repository,
        readmeText: "",
        languages,
        tree,
        truncated: Boolean(treeResult.truncated),
      };

      activeRepository = repository;
      activeTree = tree;
      saveCachedAnalysis(value.trim(), analysis);
      renderAnalysis(analysis);

      // README is enrichment only. It can never block or break the main analysis.
      withTimeout(fetchReadme(repository.owner, repository.repo, repository.branch), 5000, "")
        .then((readmeText) => {
          if (!readmeText || currentRun !== runId) return;
          const result = document.querySelector(".analysis-result");
          if (!result) return;
          const owner = result.querySelector(".analysis-owner")?.textContent || "";
          if (!owner.includes(repository.full_name)) return;
          const summary = result.querySelector(".analysis-summary p");
          if (summary) summary.textContent = readmeText;
          analysis.readmeText = readmeText;
          saveCachedAnalysis(value.trim(), analysis);
        })
        .catch(() => {});
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "GitHub could not be analyzed.", "error");
    } finally {
      setLoading(false);
    }
  }

  function withTimeout(promise, ms, timeoutMessage) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]).finally(() => window.clearTimeout(timer));
  }
})();
