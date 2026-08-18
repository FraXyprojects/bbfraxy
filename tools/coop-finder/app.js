import { rankGames } from "./matcher.js";

const API_BASE = "https://bbfraxy-api.fraxy.workers.dev";

const state = {
  players: null,
  time: 120,
  platform: null,
  tags: new Set(),
  challenge: 3,
};

const results = document.createElement("section");
results.className = "coop-results";
results.hidden = true;
results.innerHTML = `
  <div class="coop-results-heading">
    <div>
      <p class="coop-label">Your matches</p>
      <h2>Games worth playing</h2>
    </div>
    <p class="coop-results-note" id="results-summary"></p>
  </div>
  <div class="coop-result-grid" id="result-grid"></div>
`;

document.querySelector(".coop-card")?.after(results);

const timeRange = document.querySelector("#time-range");
const timeLabel = document.querySelector("#time-value-label");

if (timeRange && timeLabel) {
  const syncTime = () => {
    state.time = Number(timeRange.value);
    timeLabel.textContent = formatMinutes(state.time);
  };

  timeRange.addEventListener("input", syncTime);
  syncTime();
}

for (const group of document.querySelectorAll("[data-group]")) {
  const groupName = group.dataset.group;

  group.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;

    if (groupName === "tags") {
      const value = button.dataset.value;
      if (state.tags.has(value)) {
        state.tags.delete(value);
        button.classList.remove("is-selected");
      } else {
        state.tags.add(value);
        button.classList.add("is-selected");
      }
      return;
    }

    for (const sibling of group.querySelectorAll("button[data-value]")) {
      sibling.classList.toggle("is-selected", sibling === button);
    }

    state[groupName] = button.dataset.value;
  });
}

document.querySelector("#find-games")?.addEventListener("click", async () => {
  const resultGrid = document.querySelector("#result-grid");
  const summary = document.querySelector("#results-summary");

  if (!resultGrid || !summary) return;

  if (!state.players || !state.platform) {
    summary.textContent = "Choose players and platform first.";
    results.hidden = false;
    resultGrid.innerHTML = `<div class="coop-empty">We need the player count and platform before we can find your matches.</div>`;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  resultGrid.innerHTML = `<div class="coop-empty">Finding your best matches…</div>`;
  summary.textContent = "";
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const response = await fetch("./data/games.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load game database");

    const games = await response.json();
    const matches = rankGames(games, {
      ...state,
      tags: [...state.tags],
    });

    if (!matches.length) {
      summary.textContent = "No direct matches yet.";
      resultGrid.innerHTML = `<div class="coop-empty">Nothing in the current database fits all your hard requirements. Try another platform or player count.</div>`;
      return;
    }

    summary.textContent = `${matches.length} matching games in the current database.`;
    resultGrid.innerHTML = matches.slice(0, 8).map(renderMatch).join("");
  } catch (error) {
    console.error(error);
    summary.textContent = "The database could not be loaded.";
    resultGrid.innerHTML = `<div class="coop-empty">Something went wrong while loading the game database. Try again in a moment.</div>`;
  }
});

const missingTrigger = document.querySelector("#missing-trigger");
const missingPanel = document.querySelector("#missing-game-panel");
const missingClose = document.querySelector("#missing-close");
const missingForm = document.querySelector("#missing-form");
const missingStatus = document.querySelector("#missing-status");

function setMissingOpen(open) {
  if (!missingPanel || !missingTrigger) return;
  missingPanel.classList.toggle("is-open", open);
  missingPanel.setAttribute("aria-hidden", String(!open));
  if (open) document.querySelector("#missing-title")?.focus();
}

missingTrigger?.addEventListener("click", () => {
  setMissingOpen(!missingPanel?.classList.contains("is-open"));
});
missingClose?.addEventListener("click", () => setMissingOpen(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMissingOpen(false);
});

document.addEventListener("click", (event) => {
  if (!missingPanel?.classList.contains("is-open")) return;
  if (missingPanel.contains(event.target) || missingTrigger?.contains(event.target)) return;
  setMissingOpen(false);
});

missingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const titleInput = document.querySelector("#missing-title");
  const noteInput = document.querySelector("#missing-note");
  const honeypotInput = document.querySelector("#missing-website");
  const submit = missingForm.querySelector(".missing-submit");

  const game = titleInput?.value.trim() || "";
  const note = noteInput?.value.trim() || "";
  const website = honeypotInput?.value.trim() || "";

  if (!game) return;

  const originalText = submit?.textContent || "Send game suggestion →";
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Sending…";
  }
  if (missingStatus) missingStatus.textContent = "";

  try {
    const response = await fetch(`${API_BASE}/v1/coop/suggest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game, note, website }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not send the suggestion.");

    missingForm.innerHTML = `
      <div class="coop-empty">
        <strong>Thanks! We got it.</strong><br>
        We’ll verify the game and consider adding it to the database.
      </div>
    `;
  } catch (error) {
    console.error(error);
    if (missingStatus) {
      missingStatus.textContent = error.message || "Could not send the suggestion. Please try again later.";
    }
  } finally {
    if (submit && document.body.contains(submit)) {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }
});

function renderMatch(match) {
  const percent = Math.max(0, Math.min(100, match.score));
  const facts = [
    `${match.game.players.min}–${match.game.players.max} players`,
    `${match.game.idealSessionMinutes} min ideal session`,
  ];

  return `
    <article class="coop-result-card">
      <div class="coop-result-top">
        <div>
          <span class="coop-match-label">${percent}% match</span>
          <h3>${escapeHtml(match.game.title)}</h3>
        </div>
        <div class="coop-score-ring" style="--score:${percent}%">${percent}%</div>
      </div>
      <p>${escapeHtml(match.game.description)}</p>
      <div class="coop-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>
      <ul class="coop-reasons">
        ${match.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
      </ul>
      <details class="coop-breakdown">
        <summary>Why this score?</summary>
        <div>
          <span>Players ${match.breakdown.players}%</span>
          <span>Platform ${match.breakdown.platform}%</span>
          <span>Time ${match.breakdown.time}%</span>
          <span>Preferences ${match.breakdown.preferences}%</span>
          <span>Challenge ${match.breakdown.challenge}%</span>
        </div>
      </details>
    </article>
  `;
}

function formatMinutes(value) {
  const minutes = Number(value) || 0;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\\"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\\": "&#92;",
    '"': "&quot;",
  }[char] || char));
}
