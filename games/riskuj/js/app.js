import { PALETTE, esc } from './setup.js';
import {
    state,
    renderSetup,
    readBuilt
} from './setup-flow.js';
import {
    renderGame,
    openQuestion,
    scoreQuestion
} from './game.js';
import {
    renderResults,
    renderFinalResults
} from './results.js';
import { startTiebreak } from './tiebreak.js';

const $ = (id) => document.getElementById(id);
const landing = $('landing');
const launch = $('launch');
const setupEl = $('setup');
const gameEl = $('game');

landing.querySelector('#launch-game').onclick = () => {
    landing.classList.add('hidden');
    launch.classList.remove('hidden');
};

launch.querySelector('#launch-back').onclick = () => {
    launch.classList.add('hidden');
    landing.classList.remove('hidden');
};

launch.querySelectorAll('.mode').forEach((element) => {
    element.onclick = () => {
        state.runMode = element.dataset.mode;
        launch.classList.add('hidden');
        setupEl.classList.remove('hidden');

        renderSetup({
            setupEl,
            backLanding: () => {
                setupEl.classList.add('hidden');
                landing.classList.remove('hidden');
            },
            startGame,
            addPlayer,
            removePlayer,
            loadQuiz
        });
    };
});

function setupRender() {
    renderSetup({
        setupEl,
        backLanding: () => {
            setupEl.classList.add('hidden');
            landing.classList.remove('hidden');
        },
        startGame,
        addPlayer,
        removePlayer,
        loadQuiz
    });
}

function addPlayer() {
    if (state.players.length >= 10) {
        return;
    }

    state.players.push({
        name: '',
        color: PALETTE[state.players.length],
        score: 0
    });

    setupRender();
}

function removePlayer(index) {
    if (state.players.length <= 2) {
        return;
    }

    state.players.splice(index, 1);
    setupRender();
}

function loadQuiz(event) {
    const file = event.target.files?.[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
        try {
            const data = JSON.parse(loadEvent.target.result);

            if (!Array.isArray(data.topics) || !data.topics.length) {
                throw new Error();
            }

            state.topics = data.topics.map((topic) => topic.name);
            state.questions = {};

            data.topics.forEach((topic) => {
                (topic.questions || []).forEach((question) => {
                    state.questions[`${topic.name}-${question.value}`] = {
                        question: question.question || '',
                        answer: question.answer || '',
                        value: Number(question.value) || 0
                    };
                });
            });

            state.loadedQuiz = true;

            const loadStatus = $('loadStatus');
            if (loadStatus) {
                loadStatus.textContent =
                    `Načteno: ${state.topics.length} témat. Kvíz je připraven.`;
            }
        } catch {
            state.loadedQuiz = false;

            const loadStatus = $('loadStatus');
            if (loadStatus) {
                loadStatus.textContent = 'Soubor není platný Riskuj JSON.';
            }
        }
    };

    reader.readAsText(file);
}

function startGame() {
    state.seconds = Math.max(
        1,
        Math.min(600, Number($('timerSeconds')?.value) || 60)
    );

    state.deductOnWrong = $('deductWrong')?.checked ?? true;

    state.players.forEach((player, index) => {
        player.name = player.name.trim() || `Tým ${index + 1}`;
        player.score = 0;
    });

    if (state.runMode === 'build' && !readBuilt(setupEl)) {
        alert('Zadej alespoň jedno téma.');
        return;
    }

    if (state.runMode === 'prepared' && !state.loadedQuiz) {
        alert('Nejdřív vyber a načti quiz.json.');
        return;
    }

    state.currentPlayer = 0;
    state.selected = null;

    setupEl.classList.add('hidden');
    gameEl.classList.remove('hidden');

    renderGame({
        state,
        gameEl,
        onPick,
        updateScores,
        onNewGame: () => location.reload()
    });
}

function updateScores() {
    $('scores').innerHTML = state.players
        .map(
            (player, index) => `
                <div
                    class="score ${index === state.currentPlayer ? 'active' : ''}"
                    style="--player-color:${player.color}"
                >
                    <strong>${esc(player.name)}</strong><br>
                    ${player.score} bodů
                </div>
            `
        )
        .join('');
}

function startTimer() {
    if (state.timer) {
        clearInterval(state.timer);
    }

    let remaining = state.seconds;
    const timerElement = $('timer');

    if (timerElement) {
        timerElement.textContent = remaining;
    }

    state.timer = setInterval(() => {
        remaining--;

        const currentTimer = $('timer');
        if (currentTimer) {
            currentTimer.textContent = remaining;
        }

        if (remaining <= 0) {
            clearInterval(state.timer);
            state.timer = null;

            if (currentTimer) {
                currentTimer.textContent = 'ČAS';
            }
        }
    }, 1000);
}

function onPick(button) {
    openQuestion({
        state,
        btn: button,
        questionEl: $('question'),
        startTimer
    });

    state._scoreQuestion = (correct) => {
        scoreQuestion({
            state,
            ok: correct,
            questionEl: $('question'),
            updateScores,
            finishGame
        });
    };
}

function finishGame() {
    renderResults({
        players: state.players,
        questionEl: $('question'),
        restart: () => location.reload()
    });

    startTiebreak({
        players: state.players,
        questionEl: $('question'),
        renderFinal: (orderedPlayers) => {
            renderFinalResults({
                players: orderedPlayers,
                questionEl: $('question'),
                restart: () => location.reload()
            });
        }
    });
}
