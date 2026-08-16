(() => {
  const originalFetch = window.fetch.bind(window);
  const proxyBase = "https://api.bbfraxy.com/v1/github";
  const githubApiPrefix = "https://api.github.com";

  window.fetch = async (input, init) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (!requestUrl.startsWith(githubApiPrefix)) {
      return originalFetch(input, init);
    }

    const url = new URL(requestUrl);

    if (url.pathname.startsWith("/users/") && url.pathname.endsWith("/repos")) {
      const owner = decodeURIComponent(url.pathname.split("/")[2] || "");
      const limit = url.searchParams.get("per_page") || "100";
      const response = await originalFetch(`${proxyBase}/user/${encodeURIComponent(owner)}/repos?limit=${encodeURIComponent(limit)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return response;
      }

      const payload = await response.json();
      return new Response(JSON.stringify(payload.repositories || []), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const treeMatch = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^/]+)$/);
    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      const response = await originalFetch(`${proxyBase}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return response;
      }

      const payload = await response.json();
      return new Response(JSON.stringify({
        tree: payload.tree || [],
        truncated: Boolean(payload.truncated),
      }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    return originalFetch(input, init);
  };
})();
