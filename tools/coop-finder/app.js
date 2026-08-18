import { rankGames } from "./matcher.js";

const state = {
  players: null,
  time: null,
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

  if (!state.players || !state.time || !state.platform) {
    summary.textContent = "Choose players, time and platform first.";
    results.hidden = false;
    resultGrid.innerHTML = `<div class="coop-empty">We need the basics before we can find your matches.</div>`;
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
      resultGrid.innerHTML = `<div class="coop-empty">Nothing in the current seed database fits all your hard requirements. Try another platform or player count.</div>`;
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
          <span>Preferences ${match.breakdown.tags}%</span>
          <span>Challenge ${match.breakdown.challenge}%</span>
        </div>
      </details>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\\": "&#92;",
    '"': "&quot;",
  }[char] || char));
}
