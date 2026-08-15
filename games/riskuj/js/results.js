import { esc } from './setup.js';

export function renderResults({
    players,
    state,
    questionEl,
    restart
}) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    const tiedTop = sorted.filter((player) => player.score === topScore);

    renderScoreboard(
        sorted,
        state,
        questionEl,
        restart,
        tiedTop
    );
}

export function renderFinalResults({
    players,
    state,
    questionEl,
    restart
}) {
    renderScoreboard(
        players,
        state,
        questionEl,
        restart,
        null
    );
}

function renderScoreboard(
    players,
    state,
    questionEl,
    restart,
    tiedTop
) {
    const headline = tiedTop?.length > 1
        ? `
            Vítězství je zatím nerozhodné mezi
            <strong>
                ${tiedTop
                    .map(
                        (player) => `
                            <span style="color:${player.color}">
                                ${esc(player.name)}
                            </span>
                        `
                    )
                    .join(' / ')}
            </strong>.
        `
        : players.length
            ? `
                Vítězem se stává
                <strong style="color:${players[0].color}">
                    ${esc(players[0].name)}
                </strong>.
            `
            : '';

    const note = tiedTop?.length > 1
        ? '<div class="decision-hint">O pořadí rozhodne Kolo rozhodnutí níže.</div>'
        : '';

    questionEl.innerHTML = `
        <div class="winner">
            <div class="eyebrow">FRAXY // RESULTS</div>
            <h2>Hra skončila.</h2>
            <p>${headline}</p>
            ${note}

            <div class="scorebar">
                ${players
                    .map(
                        (player, index) => `
                            <div
                                class="score"
                                style="--player-color:${player.color}"
                            >
                                <strong>
                                    #${index + 1} ${esc(player.name)}
                                </strong><br>
                                ${player.score} bodů
                            </div>
                        `
                    )
                    .join('')}
            </div>

            <div class="results-actions">
                <button class="btn" id="restart">
                    Hrát znovu
                </button>

                <button class="btn secondary" id="show-questions">
                    Zobrazit otázky
                </button>
            </div>
        </div>

        <div
            id="question-history-modal"
            class="question-history-modal hidden"
            aria-hidden="true"
        ></div>

        ${tiedTop?.length > 1
            ? '<div id="decision-wheel"></div>'
            : ''}
    `;

    questionEl.querySelector('#restart').onclick = restart;
    questionEl.querySelector('#show-questions').onclick = () => {
        openQuestionHistory({ state, questionEl });
    };
}

function openQuestionHistory({ state, questionEl }) {
    const modal = questionEl.querySelector('#question-history-modal');

    if (!modal) {
        return;
    }

    modal.innerHTML = `
        <div class="question-history-dialog" role="dialog" aria-modal="true" aria-labelledby="question-history-title">
            <div class="question-history-header">
                <div>
                    <div class="eyebrow">FRAXY // QUESTION REVIEW</div>
                    <h2 id="question-history-title">Všechny otázky</h2>
                </div>

                <button
                    class="question-history-close"
                    type="button"
                    aria-label="Zavřít"
                >
                    ×
                </button>
            </div>

            <div class="question-history-content">
                ${state.topics
                    .map((topic) => renderTopicHistory({ state, topic }))
                    .join('')}
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    const close = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    };

    modal.querySelector('.question-history-close').onclick = close;
    modal.onclick = (event) => {
        if (event.target === modal) {
            close();
        }
    };
}

function renderTopicHistory({ state, topic }) {
    const questions = Object.values(state.questions)
        .filter((question) => {
            const key = Object.keys(state.questions)
                .find((candidate) => state.questions[candidate] === question);

            return key?.startsWith(`${topic}-`);
        })
        .sort((a, b) => a.value - b.value);

    const results = questions.map((question) => {
        const key = Object.keys(state.questions)
            .find((candidate) => state.questions[candidate] === question);
        const result = state.answerHistory[key];

        return `
            <article class="question-history-item">
                <div class="question-history-meta">
                    <span class="question-history-points">
                        ${question.value} bodů
                    </span>

                    <span
                        class="question-status ${result?.correct ? 'correct' : 'wrong'}"
                        title="${result?.correct ? 'Správně' : 'Špatně'}"
                    >
                        ${result?.correct ? '✓' : '✕'}
                    </span>
                </div>

                <div class="question-history-question">
                    ${esc(question.question)}
                </div>

                <div class="question-history-answer">
                    Odpověď: ${esc(question.answer)}
                </div>
            </article>
        `;
    }).join('');

    const correct = questions.reduce((count, question) => {
        const key = Object.keys(state.questions)
            .find((candidate) => state.questions[candidate] === question);

        return count + (state.answerHistory[key]?.correct ? 1 : 0);
    }, 0);

    const success = questions.length
        ? Math.round((correct / questions.length) * 100)
        : 0;

    return `
        <section class="question-history-topic">
            <div class="question-history-topic-header">
                <h3>${esc(topic)}</h3>
                <span>Úspěšnost ${success}%</span>
            </div>

            <div class="question-history-list">
                ${results}
            </div>
        </section>
    `;
}
