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
        cache: "no-store",
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
        `${githubApiBase}/user/${encodeURIComponent(owner)}/repos?limit=${encodeURIComponent(limit)}&_=${Date.now()}`,
        { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" },
      );

      if (!response.ok) return response;
      const payload = await response.json();
      const repositories = Array.isArray(payload) ? payload : payload.repositories;
      return new Response(JSON.stringify(Array.isArray(repositories) ? repositories : []), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const treeMatch = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^/]+)$/);
    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      const response = await originalFetch(
        `${githubApiBase}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree?_=${Date.now()}`,
        { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" },
      );

      if (!response.ok) return response;
      const payload = await response.json();
      return new Response(JSON.stringify({
        tree: payload.tree || [],
        truncated: Boolean(payload.truncated),
        branch: payload.branch,
      }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    return new Response(JSON.stringify({
      error: "This GitHub API operation is not exposed by the Simplifier proxy.",
      code: "UNSUPPORTED_GITHUB_OPERATION",
    }), {
      status: 501,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  };

  const loadScripts = () => {
    const scripts = [
      ["./analyzer-legacy.js", "data-bbfraxy-legacy-analyzer"],
      ["./seo-content.js", "data-bbfraxy-seo-content"],
    ];

    for (const [src, attribute] of scripts) {
      if (document.querySelector(`script[${attribute}]`)) continue;
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.setAttribute(attribute, "true");
      document.head.append(script);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadScripts, { once: true });
  } else {
    loadScripts();
  }
})();
