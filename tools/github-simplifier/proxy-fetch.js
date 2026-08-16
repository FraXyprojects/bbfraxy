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
      return originalFetch(
        `${githubApiBase}/user/${encodeURIComponent(owner)}/repos?limit=${encodeURIComponent(limit)}`,
        { method: "GET", headers: { Accept: "application/json" } },
      );
    }

    const treeMatch = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^/]+)$/);
    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      return originalFetch(
        `${githubApiBase}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`,
        { method: "GET", headers: { Accept: "application/json" } },
      );
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
})();
