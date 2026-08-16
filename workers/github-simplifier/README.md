# BBFRAXY GitHub Simplifier Worker

This Cloudflare Worker is the server-side bridge for the GitHub Simplifier.

## Endpoints

- `GET /health`
- `GET /v1/github/user/:owner/repos?limit=100`
- `GET /v1/github/repo/:owner/:repo/tree`

The Worker adds CORS for `https://bbfraxy.com`, uses Cloudflare's edge cache, and optionally authenticates to GitHub with a `GITHUB_TOKEN` secret.

## Why the Worker exists

The Simplifier used to call GitHub's public REST API directly from every visitor's browser. That exposes the shared unauthenticated rate limit to every visitor and quickly becomes unreliable.

The Worker centralizes those requests and caches the public results. A GitHub token can be stored as a Cloudflare secret so the upstream quota is much higher without exposing the token in browser code.

## Cloudflare setup

1. Create a Worker named `bbfraxy-github-simplifier`.
2. Deploy the contents of `src/index.js` (or deploy this directory with Wrangler).
3. Add the Worker to the `api.bbfraxy.com` hostname, so the endpoints are available at:
   - `https://api.bbfraxy.com/health`
   - `https://api.bbfraxy.com/v1/github/user/FraXyprojects/repos`
4. Add a GitHub token as a Worker secret named `GITHUB_TOKEN`.
   - Use a fine-grained GitHub token.
   - Only public repository read access is needed for the current Simplifier.
   - Never put the token in frontend JavaScript.
5. Open `/health` and confirm the JSON response contains `ok: true`.

## Wrangler

From this directory:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

The current frontend bridge expects the Worker base URL to be:

```text
https://api.bbfraxy.com/v1/github
```

Until the Worker is deployed and the hostname is configured, the Simplifier's GitHub calls will not be available through the new bridge.
