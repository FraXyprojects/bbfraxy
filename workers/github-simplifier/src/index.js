const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
};

const GITHUB_API = "https://api.github.com";
const RAW_GITHUB = "https://raw.githubusercontent.com";
const DEFAULT_REPO_LIMIT = 100;
const MAX_REPO_LIMIT = 100;
const MAX_TREE_ITEMS = 7000;
const MAX_FILE_BYTES = 180000;
const REPO_CACHE_TTL = 300;
const USER_CACHE_TTL = 300;
const FILE_CACHE_TTL = 300;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "OPTIONS") {
      return json({ error: "Method not allowed." }, 405, { allow: "GET, OPTIONS" });
    }

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

    if (url.pathname === "/health") {
      return json({ ok: true, service: "bbfraxy-github-simplifier" }, 200, { "cache-control": "no-store" });
    }

    const userMatch = url.pathname.match(/^\/v1\/github\/user\/([^/]+)\/repos\/?$/);
    if (userMatch) {
      const owner = decodeURIComponent(userMatch[1]);
      const limit = clampNumber(url.searchParams.get("limit"), DEFAULT_REPO_LIMIT, 1, MAX_REPO_LIMIT);
      return handleUserRepos(owner, limit, env, ctx);
    }

    const treeMatch = url.pathname.match(/^\/v1\/github\/repo\/([^/]+)\/([^/]+)\/tree\/?$/);
    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      return handleRepoTree(owner, repo, env, ctx);
    }

    const fileMatch = url.pathname.match(/^\/v1\/github\/repo\/([^/]+)\/([^/]+)\/file\/(.+)$/);
    if (fileMatch) {
      const owner = decodeURIComponent(fileMatch[1]);
      const repo = decodeURIComponent(fileMatch[2]);
      const path = fileMatch[3].split("/").map(decodeURIComponent).join("/");
      return handleRepoFile(owner, repo, path, url.searchParams.get("branch") || "main", env, ctx);
    }

    const rawMatch = url.pathname.match(/^\/v1\/raw\/(.+)$/);
    if (rawMatch) return handleRawContent(rawMatch[1], ctx);

    return json({
      error: "Not found.",
      endpoints: [
        "GET /health",
        "GET /v1/github/user/:owner/repos?limit=100",
        "GET /v1/github/repo/:owner/:repo/tree",
        "GET /v1/github/repo/:owner/:repo/file/:path?branch=main",
        "GET /v1/raw/:owner/:repo/:ref/:path",
      ],
    }, 404);
  },
};

async function handleUserRepos(owner, limit, env, ctx) {
  if (!isSafeGithubName(owner)) return json({ error: "Invalid GitHub username." }, 400);
  const cacheKey = new Request(`https://cache.bbfraxy.local/user/${encodeURIComponent(owner)}?limit=${limit}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached);

  const apiUrl = `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos?type=public&sort=updated&per_page=${limit}`;
  const response = await githubFetch(apiUrl, env);
  if (response.status === 404) return json({ error: `GitHub user “${owner}” was not found.`, code: "USER_NOT_FOUND" }, 404);
  if (!response.ok) return proxyGithubError(response, "Could not load public repositories.");

  const payload = await response.json();
  const repositories = Array.isArray(payload) ? payload : [];
  const body = JSON.stringify({ owner, count: repositories.length, repositories: repositories.map(normalizeRepository) });
  const result = jsonResponse(body, 200, { "cache-control": `public, max-age=60, s-maxage=${USER_CACHE_TTL}, stale-while-revalidate=86400` });
  ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
  return result;
}

async function handleRepoTree(owner, repo, env, ctx) {
  if (!isSafeGithubName(owner) || !isSafeGithubName(repo)) return json({ error: "Invalid GitHub repository name." }, 400);
  const cacheKey = new Request(`https://cache.bbfraxy.local/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached);

  const repositoryResponse = await githubFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, env);
  if (repositoryResponse.status === 404) return json({ error: "Repository was not found.", code: "REPO_NOT_FOUND" }, 404);
  if (!repositoryResponse.ok) return proxyGithubError(repositoryResponse, "Could not load repository metadata.");

  const repository = await repositoryResponse.json();
  const branch = repository.default_branch || "main";
  const treeResponse = await githubFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`, env);

  if (treeResponse.status === 404 && branch !== "master") {
    const fallbackResponse = await githubFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/master?recursive=1`, env);
    if (fallbackResponse.ok) return cacheTreeResponse(owner, repo, "master", fallbackResponse, ctx, cacheKey);
  }

  if (!treeResponse.ok) return proxyGithubError(treeResponse, "Could not load the repository tree.");
  return cacheTreeResponse(owner, repo, branch, treeResponse, ctx, cacheKey);
}

async function handleRepoFile(owner, repo, path, branch, env, ctx) {
  if (!isSafeGithubName(owner) || !isSafeGithubName(repo) || !path || path.length > 1000) {
    return json({ error: "Invalid GitHub file path." }, 400);
  }

  const normalizedBranch = isSafeRef(branch) ? branch : "main";
  const cacheKey = new Request(`https://cache.bbfraxy.local/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/file/${encodeURIComponent(normalizedBranch)}/${path}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached);

  const apiUrl = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(normalizedBranch)}`;
  const response = await githubFetch(apiUrl, env);
  if (response.status === 404) return json({ error: "File was not found.", code: "FILE_NOT_FOUND" }, 404);
  if (!response.ok) return proxyGithubError(response, "Could not load the file preview.");

  const payload = await response.json();
  if (Array.isArray(payload) || payload.type !== "file") return json({ error: "The selected path is not a file.", code: "NOT_A_FILE" }, 400);

  const size = Number(payload.size || 0);
  if (size > MAX_FILE_BYTES) return json({ error: "File is too large for preview.", code: "FILE_TOO_LARGE", size, maxSize: MAX_FILE_BYTES }, 413);
  if (payload.encoding !== "base64" || typeof payload.content !== "string") return json({ error: "GitHub did not return previewable text content.", code: "UNSUPPORTED_CONTENT" }, 415);

  let text;
  try { text = decodeBase64Utf8(payload.content); } catch { return json({ error: "File content could not be decoded.", code: "DECODE_FAILED" }, 500); }

  const result = jsonResponse(JSON.stringify({ owner, repo, branch: normalizedBranch, path, size, text }), 200, {
    "cache-control": `public, max-age=60, s-maxage=${FILE_CACHE_TTL}, stale-while-revalidate=86400`,
  });
  ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
  return result;
}

async function handleRawContent(rawPath, ctx) {
  if (!rawPath || rawPath.length > 2000 || rawPath.includes("..")) return json({ error: "Invalid raw content path." }, 400);

  const cacheKey = new Request(`https://cache.bbfraxy.local/raw/${rawPath}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached, "*");

  const response = await fetch(`${RAW_GITHUB}/${rawPath}`, {
    headers: { "user-agent": "BBFRAXY-GitHub-Simplifier/1.0" },
  });
  if (!response.ok) return new Response("", { status: response.status, headers: corsHeaders("*") });

  const contentType = response.headers.get("content-type") || "text/plain; charset=utf-8";
  const result = new Response(response.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=60, s-maxage=${FILE_CACHE_TTL}, stale-while-revalidate=86400`,
      ...corsHeaders("*"),
    },
  });
  ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
  return result;
}

async function cacheTreeResponse(owner, repo, branch, response, ctx, cacheKey) {
  const payload = await response.json();
  const sourceTree = Array.isArray(payload.tree) ? payload.tree : [];
  const tree = sourceTree.slice(0, MAX_TREE_ITEMS);
  const body = JSON.stringify({ owner, repo, branch, truncated: Boolean(payload.truncated) || sourceTree.length > MAX_TREE_ITEMS, tree });
  const result = jsonResponse(body, 200, { "cache-control": `public, max-age=60, s-maxage=${REPO_CACHE_TTL}, stale-while-revalidate=86400` });
  ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
  return result;
}

async function githubFetch(url, env) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "BBFRAXY-GitHub-Simplifier/1.0" };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return fetch(url, { headers });
}

function normalizeRepository(repo) {
  return {
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    updated_at: repo.updated_at,
    default_branch: repo.default_branch,
    archived: Boolean(repo.archived),
    fork: Boolean(repo.fork),
  };
}

function proxyGithubError(response, fallback) {
  if (response.status === 403 || response.status === 429) return json({ error: "GitHub temporarily rate-limited the Simplifier. Please try again later.", code: "GITHUB_RATE_LIMIT" }, 429);
  return json({ error: fallback, code: `GITHUB_${response.status}` }, response.status >= 500 ? 502 : response.status);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...corsHeaders(), ...extraHeaders } });
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(body, { status, headers: { ...JSON_HEADERS, ...corsHeaders(), ...extraHeaders } });
}

function withCors(response, origin = "https://bbfraxy.com") {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

function corsHeaders(origin = "https://bbfraxy.com") {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function isSafeGithubName(value) {
  return /^[A-Za-z0-9_.-]+$/.test(value) && value.length <= 100;
}

function isSafeRef(value) {
  return /^[A-Za-z0-9._\/-]+$/.test(value) && value.length <= 200;
}

function decodeBase64Utf8(value) {
  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
