import { esc } from './setup.js';

export function renderGame({
    state,
    gameEl,
    onPick,
    onNewGame,
    updateScores
}) {
    const values = Object.values(state.questions)
        .map((question) => question.value);

    const uniqueValues = [...new Set(values)]
        .sort((a, b) => a - b);

    const head = state.topics
        .map((topic) => `<th>${esc(topic)}</th>`)
        .join('');

    const rows = uniqueValues
        .map((value) => {
            const cells = state.topics
                .map((topic) => {
                    const question = state.questions[`${topic}-${value}`];

                    return `
                        <td>
                            <button
                                class="cell-btn"
                                data-key="${esc(`${topic}-${value}`)}"
                                ${question ? '' : 'disabled'}
                            >
                                ${value}
                            </button>
                        </td>
                    `;
                })
                .join('');

            return `<tr>${cells}</tr>`;
        })
        .join('');

    gameEl.innerHTML = `
        <div class="topline">
            <div>
                <div class="eyebrow">FRAXY // RISKUJ</div>
                <h2>Herní deska</h2>
            </div>

            <button class="btn secondary" id="new-game">
                Nová hra
            </button>
        </div>

        <div id="scores" class="scorebar"></div>

        <div class="board-wrap">
            <table class="board">
                <thead>
                    <tr>${head}</tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>

        <div id="question" class="question-card"></div>
        <div id="question-preview" class="question-preview hidden"></div>
    `;

    gameEl.querySelector('#new-game').onclick = onNewGame;
    updateScores();

    gameEl
        .querySelectorAll('.cell-btn:not([disabled])')
        .forEach((button) => {
            button.onclick = () => onPick(button);
        });
}

export function openQuestion({
    state,
    btn,
    questionEl,
    startTimer
}) {
    if (
        state.gameOver ||
        state.selected ||
        btn.classList.contains('answered') ||
        btn.disabled
    ) {
        return;
    }

    state.selected = btn;
    btn.classList.add('selected');

    document
        .querySelectorAll('.cell-btn:not([disabled])')
        .forEach((cell) => {
            if (cell !== btn) {
                cell.disabled = true;
            }
        });

    const question = state.questions[btn.dataset.key];

    questionEl.innerHTML = `
        <div class="question-value">
            ${question.value} BODŮ
        </div>

        <div class="question-text">
            ${esc(question.question)}
        </div>

        <div id="answer" class="answer hidden">
            ${esc(question.answer)}
        </div>

        <div id="timer" class="timer">
            ${state.seconds}
        </div>

        <div class="actions">
            <button class="btn secondary" id="show-answer">
                Ukázat odpověď
            </button>

            <button class="btn success" id="score-right">
                ✓ Správně
            </button>

            <button class="btn danger" id="score-wrong">
                ✕ Špatně
            </button>
        </div>
    `;

    questionEl.querySelector('#show-answer').onclick = () => {
        if (state.timer) {
            clearInterval(state.timer);
        }

        state.timer = null;

        const timerElement = questionEl.querySelector('#timer');

        if (timerElement) {
            timerElement.textContent = '—';
        }

        questionEl
            .querySelector('#answer')
            .classList.remove('hidden');
    };

    questionEl.querySelector('#score-right').onclick = () => {
        state._scoreQuestion?.(true);
    };

    questionEl.querySelector('#score-wrong').onclick = () => {
        state._scoreQuestion?.(false);
    };

    startTimer();
}

export function scoreQuestion({
    state,
    ok,
    questionEl,
    updateScores,
    finishGame
}) {
    if (!state.selected) {
        return;
    }

    if (state.timer) {
        clearInterval(state.timer);
    }

    state.timer = null;

    const question = state.questions[state.selected.dataset.key];
    const player = state.players[state.currentPlayer];
    const key = state.selected.dataset.key;

    if (ok) {
        player.score += question.value;
    } else if (state.deductOnWrong) {
        player.score -= question.value;
    }

    state.answerHistory[key] = {
        correct: ok,
        player: player.name,
        playerColor: player.color
    };

    state.selected.classList.add(
        'answered',
        ok ? 'correct' : 'wrong'
    );

    state.selected.style.setProperty(
        '--answered-color',
        player.color
    );

    state.selected.classList.remove('selected');
    state.selected.disabled = true;
    state.selected = null;

    state.currentPlayer =
        (state.currentPlayer + 1) % state.players.length;

    document
        .querySelectorAll('.cell-btn:not(.answered)')
        .forEach((cell) => {
            cell.disabled = false;
        });

    updateScores();

    questionEl.innerHTML = `
        <div class="note">
            Tah vyhodnocen. Pokračuje další hráč.
        </div>
    `;

    const answeredCells = document.querySelectorAll(
        '.cell-btn.answered'
    ).length;

    const totalCells = Object.keys(state.questions).length;

    if (answeredCells >= totalCells) {
        finishGame();
    }
}

export function enablePostGameReview({ state, gameEl }) {
    state.gameOver = true;

    const preview = gameEl.querySelector('#question-preview');
    const cells = gameEl.querySelectorAll('.cell-btn');

    cells.forEach((cell) => {
        cell.disabled = false;

        cell.onclick = () => {
            toggleQuestionPreview({
                state,
                cell,
                preview
            });
        };
    });
}

function toggleQuestionPreview({ state, cell, preview }) {
    const key = cell.dataset.key;

    if (!preview || preview.dataset.key === key) {
        preview?.classList.toggle('hidden');
        return;
    }

    renderQuestionPreview({ state, cell, preview });
}

function renderQuestionPreview({ state, cell, preview }) {
    const question = state.questions[cell.dataset.key];

    if (!question || !preview) {
        return;
    }

    preview.dataset.key = cell.dataset.key;
    preview.innerHTML = `
        <button
            class="question-preview-close"
            type="button"
            aria-label="Zavřít"
        >
            ×
        </button>

        <div class="question-preview-value">
            ${question.value} BODŮ
        </div>

        <div class="question-preview-text">
            ${esc(question.question)}
        </div>

        <div class="question-preview-answer">
            ${esc(question.answer)}
        </div>
    `;

    preview.classList.remove('hidden');

    preview.querySelector('.question-preview-close').onclick = () => {
        preview.classList.add('hidden');
        preview.dataset.key = '';
    };
}
