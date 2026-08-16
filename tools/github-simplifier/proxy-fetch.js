(() => {
  const originalFetch = window.fetch.bind(window);
  const proxyBase = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
  const githubApiPrefix = "https://api.github.com";

  window.fetch = async (input, init) => {
    const requestUrl = input instanceof Request ? input.url : String(input);

    if (!requestUrl.startsWith(githubApiPrefix)) {
      return originalFetch(input, init);
    }

    const url = new URL(requestUrl);

    // Repository list: /users/:owner/repos
    if (url.pathname.startsWith("/users/") && url.pathname.endsWith("/repos")) {
      const owner = decodeURIComponent(url.pathname.split("/")[2] || "");
      const limit = url.searchParams.get("per_page") || "100";
      return originalFetch(
        `${proxyBase}/user/${encodeURIComponent(owner)}/repos?limit=${encodeURIComponent(limit)}`,
        { method: "GET", headers: { Accept: "application/json" } },
      );
    }

    // Deep repository tree: /repos/:owner/:repo/git/trees/:branch
    const treeMatch = url.pathname.match(
      /^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^/]+)$/,
    );

    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      return originalFetch(
        `${proxyBase}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`,
        { method: "GET", headers: { Accept: "application/json" } },
      );
    }

    // Keep unsupported GitHub API requests out of the analyzer's normal flow.
    // The current Simplifier only needs the two routes above.
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
