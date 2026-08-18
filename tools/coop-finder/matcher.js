const WEIGHTS = {
  players: 30,
  platform: 20,
  time: 15,
  preferences: 25,
  challenge: 10,
};

const PREFERENCE_FIELDS = [
  "puzzle",
  "action",
  "adventure",
  "horror",
  "survival",
  "strategy",
  "story",
  "chaos",
  "exploration",
  "creativity",
  "relaxing",
  "competition",
];

export function rankGames(games, preferences) {
  return games
    .map((game) => {
      const playerScore = scorePlayers(game, preferences.players);
      const platformScore = scorePlatform(game, preferences.platform);
      const timeScore = scoreTime(game, preferences.time);
      const preferenceScore = scorePreferences(game, preferences.tags);
      const challengeScore = scoreChallenge(game, preferences.challenge ?? 3);

      const weighted =
        (playerScore * WEIGHTS.players +
          platformScore * WEIGHTS.platform +
          timeScore * WEIGHTS.time +
          preferenceScore * WEIGHTS.preferences +
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
          preferences: preferenceScore,
          challenge: challengeScore,
        },
        reasons: buildReasons(game, preferences, {
          playerScore,
          platformScore,
          timeScore,
          preferenceScore,
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
  if (count === game.players.max || count === game.players.min) return 100;
  return 94;
}

function scorePlatform(game, selected) {
  if (!selected) return 70;
  if (selected === "crossplay") {
    return game.platforms.length > 1 ? 100 : 35;
  }
  return game.platforms.includes(selected) ? 100 : 0;
}

function scoreTime(game, selected) {
  if (!selected) return 65;

  const available = Number(selected);
  const ideal = Number(game.idealSessionMinutes) || 60;
  const difference = Math.abs(available - ideal);

  if (difference === 0) return 100;
  if (difference <= 30) return 96;
  if (difference <= 60) return 90;
  if (difference <= 90) return 82;
  if (difference <= 120) return 72;
  if (difference <= 180) return 58;
  return 45;
}

function scorePreferences(game, requestedPreferences) {
  if (!requestedPreferences?.length) return 70;

  const intensity = getIntensity(game);
  const scores = requestedPreferences.map((preference) => {
    const value = Number(intensity[preference] ?? 0);
    return value * 20;
  });

  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function scoreChallenge(game, preferred) {
  const distance = Math.abs(Number(preferred) - Number(game.difficulty));
  return Math.max(35, 100 - distance * 20);
}

function getIntensity(game) {
  if (game.intensity) return game.intensity;

  return Object.fromEntries(
    PREFERENCE_FIELDS.map((field) => [field, field === "puzzle" ? Number(game.puzzleIntensity ?? 0) : 0])
  );
}

function buildReasons(game, preferences, scores) {
  const reasons = [];
  const requested = preferences.tags ?? [];
  const intensity = getIntensity(game);

  if (scores.playerScore === 100) {
    reasons.push(`Fits ${preferences.players} players exactly.`);
  }

  if (scores.platformScore === 100) {
    reasons.push(`Available on ${platformLabel(preferences.platform)}.`);
  }

  if (requested.length) {
    const strongest = [...requested]
      .sort((a, b) => Number(intensity[b] ?? 0) - Number(intensity[a] ?? 0))
      .slice(0, 2)
      .filter((key) => Number(intensity[key] ?? 0) >= 3);

    if (strongest.length) {
      reasons.push(`Strong ${strongest.map(intensityLabel).join(" and ")} focus.`);
    } else {
      reasons.push("Includes some of the things you selected.");
    }
  }

  if (scores.timeScore >= 90) {
    reasons.push("Fits your available play time well.");
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

function intensityLabel(value) {
  return ({
    puzzle: "puzzle",
    action: "action",
    adventure: "adventure",
    horror: "horror",
    survival: "survival",
    strategy: "strategy",
    story: "story",
    chaos: "chaos",
    exploration: "exploration",
    creativity: "creative",
    relaxing: "relaxing",
    competition: "competitive",
  }[value] ?? value);
}
