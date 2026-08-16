# BBFRAXY

FraXy's personal web hub — one place for games, tools, projects, experiments and other things.

🌐 **Website:** https://bbfraxy.com/

## What BBFRAXY currently contains

### 🎮 Games
The Games section contains custom games and interactive experiments hosted directly on BBFRAXY:

- **FraXy´s Trivia** — a board-style knowledge quiz with categories, randomized questions, a time limit and a final result.
- **FraXy's Competition** — a Europe map guessing game. Players select countries, enter numerical estimates and earn points based on accuracy.
- **Riskuj** — a multiplayer social quiz game for players or teams. It includes a classic mode and an extended mode with custom quizzes, a quiz builder, multiple players, a timer, advanced settings, a decision round for tied scores and a detailed result review.
- **FraXy's Wild West Quiz** — an externally hosted quiz created in Combos. It can later be moved directly onto BBFRAXY once export is available.

The game pages share the common BBFRAXY visual system and support dark/light theme switching.

### 🛠 Tools

- **GitHub Simplifier** — a planned tool for analyzing GitHub repositories. The goal is to turn a repository structure into a clear overview, explain important files and make projects easier to understand and navigate.

### 📦 Downloads
The Downloads section is used for projects that are ready to download or are being prepared for release. Currently listed:

- **Valheim Session Chronicle** — a client-side Valheim mod that records gameplay sessions and creates Czech text reports with JSON export support. It is currently marked as development and a public download is planned.

### 🧩 Projects
A separate section for larger projects and experiments that are more than a single utility or game.

### 🔐 Privacy
BBFRAXY includes a `/privacy/` page covering local storage, cookies and external services used by the site.

## Technical foundation

BBFRAXY is a primarily static website built with HTML, CSS and JavaScript. Individual games and tools use their own files, while larger projects are split into multiple modules to keep the code readable and maintainable.

The shared BBFRAXY visual system provides, among other things:

- dark/light theme switching,
- shared navigation,
- responsive layouts,
- reusable UI elements,
- a GitHub link,
- a subtle Privacy link in the footer.

### Technologies and libraries

Depending on the page, the project uses technologies such as:

- HTML / CSS / JavaScript
- Leaflet + OpenStreetMap for the map-based competition
- html2canvas for exporting results to PNG
- external libraries loaded from CDNs where needed

## Structure

```text
/
├── games/
│   ├── trivia/
│   ├── fraxy-soutez/
│   ├── riskuj/
│   └── ...
├── tools/
├── downloads/
├── privacy/
├── assets/
└── index.html
```

Larger games are separated into dedicated HTML, CSS and JavaScript parts. Game data is kept separate from game logic where appropriate.

## Project status

BBFRAXY is an actively developed personal project. Some sections are complete and ready to use, while others are still in development or serve as experimental foundations for future features.

## License

No project-wide license is currently specified in this repository.
