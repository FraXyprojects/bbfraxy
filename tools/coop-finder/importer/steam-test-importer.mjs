#!/usr/bin/env node

/**
 * CoopFinder Steam test importer.
 *
 * TEST MODE ONLY:
 * - Reads Steam's public "new releases" search feed.
 * - Fetches Steam Store details for a small sample.
 * - Scores whether each game looks relevant to CoopFinder.
 * - Writes a local JSON report.
 * - NEVER modifies tools/coop-finder/data/games.json.
 *
 * Requires Node.js 18+ (native fetch).
 *
 * Usage:
 *   node tools/coop-finder/importer/steam-test-importer.mjs
 *   node tools/coop-finder/importer/steam-test-importer.mjs --count 10
 *   node tools/coop-finder/importer/steam-test-importer.mjs --days 7 --count 30
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, "steam-test-report.json");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const value = process.argv[i];
  if (!value.startsWith("--")) continue;
  const [key, inline] = value.slice(2).split("=");
  if (inline !== undefined) args.set(key, inline);
  else args.set(key, process.argv[i + 1]?.startsWith("--") ? "true" : process.argv[++i]);
}

const count = Math.max(1, Math.min(50, Number(args.get("count") || 10)));
const days = Math.max(1, Math.min(30, Number(args.get("days") || 7)));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "bbfraxy-coopfinder-test-importer/0.1",
      accept: "application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

function parseSteamDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) return new Date(timestamp);

  const match = String(value).match(/^(\d{1,2})\s+([A-Za-z]{3}),\s*(\d{4})$/);
  if (!match) return null;

  const timestamp2 = Date.parse(`${match[1]} ${match[2]} ${match[3]}`);
  return Number.isNaN(timestamp2) ? null : new Date(timestamp2);
}

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function scoreCoop(details) {
  const data = details?.data || {};
  const categories = new Set((data.categories || []).map((item) => String(item.description || "").toLowerCase()));
  const genres = new Set((data.genres || []).map((item) => String(item.description || "").toLowerCase()));
  const text = [data.name, data.short_description, data.detailed_description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  const signals = [];

  if (categories.has("online co-op")) {
    score += 50;
    signals.push("Online Co-op");
  }
  if (categories.has("local co-op")) {
    score += 50;
    signals.push("Local Co-op");
  }
  if (categories.has("shared/split screen co-op")) {
    score += 45;
    signals.push("Shared/Split Screen Co-op");
  }
  if (categories.has("remote play together")) {
    score += 20;
    signals.push("Remote Play Together");
  }
  if (categories.has("multi-player")) {
    score += 10;
    signals.push("Multi-player");
  }

  if (/\b(co-op|coop|cooperative|co-operatively|cooperation)\b/.test(text)) {
    score += 15;
    signals.push("Co-op language in description");
  }

  if (genres.has("action") || genres.has("adventure") || genres.has("survival") || genres.has("strategy")) {
    score += 5;
  }

  if (categories.has("single-player") && score < 30) {
    score -= 20;
    signals.push("Single-player without strong co-op signal");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
    categories: [...categories],
    genres: [...genres],
  };
}

function normalize(details, coop) {
  const data = details?.data || {};
  const releaseDate = parseSteamDate(data.release_date?.date);

  return {
    steam: {
      appid: data.steam_appid,
      url: `https://store.steampowered.com/app/${data.steam_appid}/`,
      releaseDate: data.release_date?.date || null,
      comingSoon: Boolean(data.release_date?.coming_soon),
    },
    title: data.name || null,
    players: {
      min: null,
      max: null,
    },
    platforms: [
      ...(data.platforms?.windows ? ["pc"] : []),
    ],
    genres: (data.genres || []).map((item) => item.description),
    tags: [],
    steamCategories: (data.categories || []).map((item) => item.description),
    description: data.short_description || "",
    developers: data.developers || [],
    publishers: data.publishers || [],
    releaseAgeDays: daysSince(releaseDate),
    coop: {
      score: coop.score,
      signals: coop.signals,
    },
  };
}

async function getNewReleaseApps() {
  const url = new URL("https://store.steampowered.com/search/results/");
  url.searchParams.set("sort_by", "Released_DESC");
  url.searchParams.set("category1", "998");
  url.searchParams.set("filter", "popularnew");
  url.searchParams.set("ignore_preferences", "1");
  url.searchParams.set("json", "1");
  url.searchParams.set("count", String(Math.max(count * 2, 20)));

  const payload = await fetchJson(url);
  return Array.isArray(payload.items) ? payload.items : [];
}

async function getDetails(appid) {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appid));
  url.searchParams.set("l", "english");
  const payload = await fetchJson(url);
  return payload[String(appid)] || null;
}

async function main() {
  console.log(`Steam test importer — newest ${count} candidates, last ${days} days`);
  console.log("TEST MODE: games.json will NOT be modified.\n");

  const candidates = await getNewReleaseApps();
  const results = [];
  const errors = [];

  for (const candidate of candidates) {
    if (results.length >= count) break;
    const appid = candidate.appid || candidate.id;
    if (!appid) continue;

    try {
      const details = await getDetails(appid);
      if (!details?.success || !details.data) continue;

      const releaseDate = parseSteamDate(details.data.release_date?.date);
      const age = daysSince(releaseDate);
      if (age !== null && age > days) continue;
      if (details.data.release_date?.coming_soon) continue;

      const coop = scoreCoop(details);
      results.push(normalize(details, coop));
      console.log(`${String(results.length).padStart(2, "0")}. ${details.data.name} — co-op ${coop.score}/100`);
      await sleep(250);
    } catch (error) {
      errors.push({ appid, error: error.message });
    }
  }

  results.sort((a, b) => b.coop.score - a.coop.score);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "test",
    source: "Steam Store search + appdetails",
    parameters: { count, days },
    summary: {
      candidates: candidates.length,
      inspected: results.length,
      likelyCoop: results.filter((game) => game.coop.score >= 50).length,
      review: results.filter((game) => game.coop.score >= 20 && game.coop.score < 50).length,
      ignoredByScore: results.filter((game) => game.coop.score < 20).length,
      errors: errors.length,
    },
    games: results,
    errors,
  };

  await fs.writeFile(OUTPUT, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nReport written to: ${OUTPUT}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error("Importer failed:", error.message);
  process.exitCode = 1;
});
