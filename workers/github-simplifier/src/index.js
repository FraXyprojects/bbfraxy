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
const SUGGESTION_WINDOW_SECONDS = 1200;
const MAX_SUGGESTIONS_PER_WINDOW = 3;
const MAX_GAME_NAME_LENGTH = 120;
const MAX_SUGGESTION_LENGTH = 1200;
const ALLOWED_ORIGINS = new Set(["https://bbfraxy.com", "https://www.bbfraxy.com"]);
const ISSUE_REPOSITORY = "FraXyprojects/bbfraxy";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = getAllowedOrigin(request.headers.get("origin"));

    if (request.method !== "GET" && request.method !== "POST" && request.method !== "OPTIONS") {
      return json({ error: "Method not allowed." }, 405, { allow: "GET, POST, OPTIONS" }, origin);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "bbfraxy-api" }, 200, { "cache-control": "no-store" }, origin);
    }

    if (request.method === "POST" && url.pathname === "/v1/coop/suggest") {
      return handleCoopSuggestion(request, env, ctx, origin);
    }

    const userMatch = url.pathname.match(/^\/v1\/github\/user\/([^/]+)\/repos\/?$/);
    if (userMatch) {
      const owner = decodeURIComponent(userMatch[1]);
      const limit = clampNumber(url.searchParams.get("limit"), DEFAULT_REPO_LIMIT, 1, MAX_REPO_LIMIT);
      return handleUserRepos(owner, limit, env, ctx, origin);
    }

    const treeMatch = url.pathname.match(/^\/v1\/github\/repo\/([^/]+)\/([^/]+)\/tree\/?$/);
    if (treeMatch) {
      const owner = decodeURIComponent(treeMatch[1]);
      const repo = decodeURIComponent(treeMatch[2]);
      return handleRepoTree(owner, repo, env, ctx, origin);
    }

    const fileMatch = url.pathname.match(/^\/v1\/github\/repo\/([^/]+)\/([^/]+)\/file\/(.+)$/);
    if (fileMatch) {
      const owner = decodeURIComponent(fileMatch[1]);
      const repo = decodeURIComponent(fileMatch[2]);
      const path = fileMatch[3].split("/").map(decodeURIComponent).join("/");
      return handleRepoFile(owner, repo, path, url.searchParams.get("branch") || "main", env, ctx, origin);
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
        "POST /v1/coop/suggest",
      ],
    }, 404, {}, origin);
  },
};

async function handleCoopSuggestion(request, env, ctx, origin) {
  if (!env.GITHUB_ISSUE_TOKEN) {
    return json({ error: "Suggestion service is not configured.", code: "SUGGESTION_NOT_CONFIGURED" }, 503, {}, origin);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400, {}, origin);
  }

  const game = normalizeSuggestionText(payload?.game);
  const note = normalizeSuggestionText(payload?.note);
  const honeypot = normalizeSuggestionText(payload?.website);

  if (honeypot) {
    return json({ ok: true }, 202, { "cache-control": "no-store" }, origin);
  }

  if (!game || game.length > MAX_GAME_NAME_LENGTH) {
    return json({ error: "Please enter a valid game title." }, 400, {}, origin);
  }
  if (note.length > MAX_SUGGESTION_LENGTH) {
    return json({ error: `Additional details must be ${MAX_SUGGESTION_LENGTH} characters or fewer.` }, 400, {}, origin);
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashKey(ip);
  const rateLimitKey = new Request(`https://cache.bbfraxy.local/coop-suggestion/${ipHash}`);
  const now = Math.floor(Date.now() / 1000);
  const existing = await caches.default.match(rateLimitKey);

  let timestamps = [];
  if (existing) {
    try {
      const stored = await existing.json();
      if (Array.isArray(stored?.timestamps)) {
        timestamps = stored.timestamps.filter((timestamp) => Number.isFinite(timestamp) && now - timestamp < SUGGESTION_WINDOW_SECONDS);
      }
    } catch {
      timestamps = [];
    }
  }

  if (timestamps.length >= MAX_SUGGESTIONS_PER_WINDOW) {
    const oldest = Math.min(...timestamps);
    const retryAfter = Math.max(1, SUGGESTION_WINDOW_SECONDS - (now - oldest));
    return json({
      error: "Thanks for helping us improve Coop Finder! We allow a few suggestions per 20 minutes to keep the queue spam-free. Please try again a little later.",
      code: "RATE_LIMITED",
      retryAfter,
    }, 429, { "retry-after": String(retryAfter) }, origin);
  }

  const issueBody = [
    "## Coop Finder suggestion",
    "",
    `**Game:** ${game}`,
    note ? `**Note:** ${note}` : "**Note:** _No additional note provided._",
    "",
    "**Source:** BBFRAXY Coop Finder",
    `**Submitted:** ${new Date().toISOString()}`,
    `**Origin:** ${request.headers.get("origin") || "unknown"}`,
  ].join("\n");

  const response = await fetch(`${GITHUB_API}/repos/${ISSUE_REPOSITORY}/issues`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "BBFRAXY-API/1.0",
      authorization: `Bearer ${env.GITHUB_ISSUE_TOKEN}`,
    },
    body: JSON.stringify({
      title: `[Coop Suggestion] ${game}`,
      body: issueBody,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return json({ error: "Suggestion service authorization failed.", code: "GITHUB_ISSUE_AUTH" }, 502, {}, origin);
    }
    if (response.status === 404) {
      return json({ error: "Suggestion repository was not found.", code: "GITHUB_ISSUE_REPO" }, 502, {}, origin);
    }
    return json({ error: "Could not submit the game suggestion.", code: `GITHUB_${response.status}` }, 502, {}, origin);
  }

  const issue = await response.json();
  const updatedTimestamps = [...timestamps, now].slice(-MAX_SUGGESTIONS_PER_WINDOW);
  const rateResponse = new Response(JSON.stringify({ timestamps: updatedTimestamps }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${SUGGESTION_WINDOW_SECONDS}`,
    },
  });
  ctx.waitUntil(caches.default.put(rateLimitKey, rateResponse));

  return json({ ok: true, issue: { number: issue.number, url: issue.html_url } }, 201, { "cache-control": "no-store" }, origin);
}

async function handleUserRepos(owner, limit, env, ctx, origin) {
  if (!isSafeGithubName(owner)) return json({ error: "Invalid GitHub username." }, 400, {}, origin);
  const cacheKey = new Request(`https://cache.bbfraxy.local/user/${encodeURIComponent(owner)}?limit=${limit}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached, origin);

  const apiUrl = `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos?type=public&sort=updated&per_page=${limit}`;
  const response = await githubFetch(apiUrl, env);
  if (response.status === 404) return json({ error: `GitHub user “${owner}” was not found.`, code: "USER_NOT_FOUND" }, 404, {}, origin);
  if (!response.ok) return proxyGithubError(response, "Could not load public repositories.", origin);

  const payload = await response.json();
  const repositories = Array.isArray(payload) ? payload : [];
  const body = JSON.stringify({ owner, count: repositories.length, repositories: repositories.map(normalizeRepository) });
  const result = jsonResponse(body, 200, { "cache-control": `public, max-age=60, s-maxage=${USER_CACHE_TTL}, stale-while-revalidate=86400` }, origin);
  ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
  return result;
}

async function handleRepoTree(owner, repo, env, ctx, origin) {
  if (!isSafeGithubName(owner) || !isSafeGithubName(repo)) return json({ error: "Invalid GitHub repository name." }, 400, {}, origin);
  const cacheKey = new Request(`https://cache.bbfraxy.local/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached, origin);

  const repositoryResponse = await githubFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, env);
  if (repositoryResponse.status === 404) return json({ error: "Repository was not found.", code: "REPO_NOT_FOUND" }, 404, {}, origin);
  if (!repositoryResponse.ok) return proxyGithubError(repositoryResponse, "Could not load repository metadata.", origin);

  const repository = await repositoryResponse.json();
  const branch = repository.default_branch || "main";
  const treeResponse = await githubFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`, env);

  if (treeResponse.status === 404 && branch !== "master") {
    const fallbackResponse = await githubFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/master?recursive=1`, env);
    if (fallbackResponse.ok) return cacheTreeResponse(owner, repo, "master", fallbackResponse, ctx, cacheKey, origin);
  }

  if (!treeResponse.ok) return proxyGithubError(treeResponse, "Could not load the repository tree.", origin);
  return cacheTreeResponse(owner, repo, branch, treeResponse, ctx, cacheKey, origin);
}

async function handleRepoFile(owner, repo, path, branch, env, ctx, origin) {
  if (!isSafeGithubName(owner) || !isSafeGithubName(repo) || !path || path.length > 1000) {
    return json({ error: "Invalid GitHub file path." }, 400, {}, origin);
  }

  const normalizedBranch = isSafeRef(branch) ? branch : "main";
  const cacheKey = new Request(`https://cache.bbfraxy.local/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/file/${encodeURIComponent(normalizedBranch)}/${path}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached, origin);

  const apiUrl = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(normalizedBranch)}`;
  const response = await githubFetch(apiUrl, env);
  if (response.status === 404) return json({ error: "File was not found.", code: "FILE_NOT_FOUND" }, 404, {}, origin);
  if (!response.ok) return proxyGithubError(response, "Could not load the file preview.", origin);

  const payload = await response.json();
  if (Array.isArray(payload) || payload.type !== "file") return json({ error: "The selected path is not a file.", code: "NOT_A_FILE" }, 400, {}, origin);

  const size = Number(payload.size || 0);
  if (size > MAX_FILE_BYTES) return json({ error: "File is too large for preview.", code: "FILE_TOO_LARGE", size, maxSize: MAX_FILE_BYTES }, 413, {}, origin);
  if (payload.encoding !== "base64" || typeof payload.content !== "string") return json({ error: "GitHub did not return previewable text content.", code: "UNSUPPORTED_CONTENT" }, 415, {}, origin);

  let text;
  try { text = decodeBase64Utf8(payload.content); } catch { return json({ error: "File content could not be decoded.", code: "DECODE_FAILED" }, 500, {}, origin); }

  const result = jsonResponse(JSON.stringify({ owner, repo, branch: normalizedBranch, path, size, text }), 200, {
    "cache-control": `public, max-age=60, s-maxage=${FILE_CACHE_TTL}, stale-while-revalidate=86400`,
  }, origin);
  ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
  return result;
}

async function handleRawContent(rawPath, ctx) {
  if (!rawPath || rawPath.length > 2000 || rawPath.includes("..")) return new Response(JSON.stringify({ error: "Invalid raw content path." }), { status: 400, headers: { ...JSON_HEADERS, ...corsHeaders("*") } });

  const cacheKey = new Request(`https://cache.bbfraxy.local/raw/${rawPath}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withCors(cached, "*");

  const response = await fetch(`${RAW_GITHUB}/${rawPath}`, {
    headers: { "user-agent": "BBFRAXY-API/1.0" },
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

async function cacheTreeResponse(owner, repo, branch, response, ctx, cacheKey, origin) {
  const payload = await response.json();
  const sourceTree = Array.isArray(payload.tree) ? payload.tree : [];
  const tree = sourceTree.slice(0, MAX_TREE_ITEMS);
  const body = JSON.stringify({ owner, repo, branch, truncated: Boolean(payload.truncated) || sourceTree.length > MAX_TREE_ITEMS, tree });
  const result = jsonResponse(body, 200, { "cache-control": `public, max-age=60, s-maxage=${REPO_CACHE_TTL}, stale-while-revalidate=86400` }, origin);
  ctx.waitUntil(caches.default.put(cacheKey, result.clone()));
  return result;
}

async function githubFetch(url, env) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "BBFRAXY-API/1.0" };
  if (env.GITHUB_READ_TOKEN) headers.authorization = `Bearer ${env.GITHUB_READ_TOKEN}`;
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

function proxyGithubError(response, fallback, origin) {
  if (response.status === 403 || response.status === 429) return json({ error: "GitHub temporarily rate-limited the API. Please try again later.", code: "GITHUB_RATE_LIMIT" }, 429, {}, origin);
  return json({ error: fallback, code: `GITHUB_${response.status}` }, response.status >= 500 ? 502 : response.status, {}, origin);
}

function json(data, status = 200, extraHeaders = {}, origin = "https://bbfraxy.com") {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...corsHeaders(origin), ...extraHeaders } });
}

function jsonResponse(body, status, extraHeaders = {}, origin = "https://bbfraxy.com") {
  return new Response(body, { status, headers: { ...JSON_HEADERS, ...corsHeaders(origin), ...extraHeaders } });
}

function withCors(response, origin = "https://bbfraxy.com") {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

function corsHeaders(origin = "https://bbfraxy.com") {
  const resolvedOrigin = origin === "*" ? "*" : (origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://bbfraxy.com");
  return {
    "access-control-allow-origin": resolvedOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function getAllowedOrigin(origin) {
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://bbfraxy.com";
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

function normalizeSuggestionText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

async function hashKey(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
