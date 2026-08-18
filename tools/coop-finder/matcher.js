const WEIGHTS = {
  players: 30,
  platform: 20,
  time: 15,
  tags: 25,
  challenge: 10,
};

export function rankGames(games, preferences) {
  return games
    .map((game) => {
      const playerScore = scorePlayers(game, preferences.players);
      const platformScore = scorePlatform(game, preferences.platform);
      const timeScore = scoreTime(game, preferences.time);
      const tagScore = scoreTags(game, preferences.tags);
      const challengeScore = scoreChallenge(game, preferences.challenge ?? 3);

      const weighted =
        (playerScore * WEIGHTS.players +
          platformScore * WEIGHTS.platform +
          timeScore * WEIGHTS.time +
          tagScore * WEIGHTS.tags +
          challengeScore * WEIGHTS.challenge) /
        100;

      const score = Math.round(weighted);
      const hardMismatch = playerScore === 0 || platformScore === 0;

      return {
        game,
        score: hardMismatch ? Math.min(score, 49) : score,
        breakdown: {
          players: playerScore,
          platform: platformScore,
          time: timeScore,
          tags: tagScore,
          challenge: challengeScore,
        },
        reasons: buildReasons(game, preferences, {
          playerScore,
          platformScore,
          timeScore,
          tagScore,
          challengeScore,
        }),
      };
    })
    .filter((item) => item.breakdown.players > 0 && item.breakdown.platform > 0)
    .sort((a, b) => b.score - a.score);
}

function scorePlayers(game, selected) {
  if (!selected) return 65;
  const count = selected === "5+" ? 5 : Number(selected);
  if (count < game.players.min || count > game.players.max) return 0;
  if (count === game.players.max) return 100;
  return 92;
}

function scorePlatform(game, selected) {
  if (!selected) return 70;
  if (selected === "crossplay") return game.platforms.length > 1 ? 100 : 35;
  return game.platforms.includes(selected) ? 100 : 0;
}

function scoreTime(game, selected) {
  if (!selected) return 65;
  const available = Number(selected);
  const ideal = game.idealSessionMinutes;
  const ratio = available / ideal;
  if (ratio >= 1) return 100;
  if (ratio >= 0.75) return 90;
  if (ratio >= 0.5) return 72;
  if (ratio >= 0.33) return 55;
  return 35;
}

function scoreTags(game, requestedTags) {
  if (!requestedTags?.length) return 70;
  const matched = requestedTags.filter((tag) => tagMatchesGame(tag, game)).length;
  return Math.round((matched / requestedTags.length) * 100);
}

function tagMatchesGame(tag, game) {
  if (game.genres.includes(tag)) return true;
  if (tag === "chaos") return game.tags.includes("chaos") || game.genres.includes("action");
  return game.tags.includes(tag);
}

function scoreChallenge(game, preferred) {
  const distance = Math.abs(Number(preferred) - Number(game.difficulty));
  return Math.max(35, 100 - distance * 20);
}

function buildReasons(game, preferences, scores) {
  const reasons = [];
  const requestedTags = preferences.tags ?? [];

  if (scores.playerScore === 100) {
    reasons.push(`Fits ${preferences.players} players exactly.`);
  }
  if (scores.platformScore === 100) {
    reasons.push(`Available on ${platformLabel(preferences.platform)}.`);
  }
  if (requestedTags.some((tag) => tagMatchesGame(tag, game))) {
    const matched = requestedTags.filter((tag) => tagMatchesGame(tag, game));
    reasons.push(`Matches ${matched.slice(0, 2).map(tagLabel).join(" and ")}.`);
  }
  if (scores.timeScore >= 90) {
    reasons.push("Works well within your available play time.");
  }
  if (!reasons.length) {
    reasons.push("A reasonable match for your group.");
  }

  return reasons;
}

function platformLabel(value) {
  return ({
    pc: "PC",
    playstation: "PlayStation",
    xbox: "Xbox",
    switch: "Switch",
    crossplay: "crossplay",
  }[value] ?? value);
}

function tagLabel(value) {
  return ({
    puzzle: "puzzle",
    action: "action",
    adventure: "adventure",
    horror: "horror",
    chaos: "chaos",
    story: "story",
    strategy: "strategy",
    survival: "survival",
  }[value] ?? value);
}
