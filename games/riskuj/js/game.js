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

    player.score += ok
        ? question.value
        : -question.value;

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
            if (!cell.hasAttribute('data-locked')) {
                cell.disabled = false;
            }
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

    const totalCells = document.querySelectorAll(
        '.cell-btn'
    ).length;

    if (answeredCells >= totalCells) {
        finishGame();
    }
}
