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
      const proxied = await tryProxy(
        `${proxyBase}/user/${encodeURIComponent(owner)}/repos?limit=${encodeURIComponent(limit)}`,
        { Accept: "application/json" }
      );

      if (proxied) {
        if (!proxied.ok) return proxied;
        const payload = await proxied.json();
        return new Response(JSON.stringify(payload.repositories || []), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      return originalFetch(input, init);
    }

    const treeMatch = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/([^/]+)$/);
    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      const proxied = await tryProxy(
        `${proxyBase}/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`,
        { Accept: "application/json" }
      );

      if (proxied) {
        if (!proxied.ok) return proxied;
        const payload = await proxied.json();
        return new Response(JSON.stringify({
          tree: payload.tree || [],
          truncated: Boolean(payload.truncated),
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      return originalFetch(input, init);
    }

    return originalFetch(input, init);
  };

  async function tryProxy(url, headers) {
    try {
      const response = await originalFetch(url, {
        method: "GET",
        headers,
      });

      // A missing Worker route can happen while Cloudflare is being configured.
      // In that case keep the current browser API behavior as a temporary fallback.
      if (response.status === 404 && !response.headers.get("content-type")?.includes("application/json")) {
        return null;
      }

      return response;
    } catch {
      return null;
    }
  }
})();
