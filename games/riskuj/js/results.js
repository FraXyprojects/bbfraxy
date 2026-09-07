import { esc } from './setup.js';
import { openTiebreak } from './tiebreak.js';

export function renderResults({
    players,
    state,
    questionEl,
    restart,
    onOpenTiebreak
}) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const topScore = sorted[0]?.score ?? 0;
    const tiedTop = sorted.filter((player) => player.score === topScore);

    renderScoreboard(
        sorted,
        state,
        questionEl,
        restart,
        tiedTop,
        onOpenTiebreak
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
        null,
        null
    );
}

function getHeadlineHTML(players, tiedTop) {
    return tiedTop?.length > 1
        ? `
            <span data-i18n="riskuj.results.tieHeadline">Vítězství je zatím nerozhodné mezi</span>
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
                <span data-i18n="riskuj.results.winnerHeadline">Vítězem se stává</span>
                <strong style="color:${players[0].color}">
                    ${esc(players[0].name)}
                </strong>.
            `
            : '';
}

function getNoteHTML(tiedTop) {
    return tiedTop?.length > 1
        ? '<div class="decision-hint" data-i18n="riskuj.results.decisionHint">O pořadí rozhodne Kolo rozhodnutí.</div>'
        : '';
}

function getTiebreakButtonHTML(tiedTop) {
    return tiedTop?.length > 1
        ? `
            <button class="btn" id="open-tiebreak" data-i18n="riskuj.results.tiebreakButton">
                🎡 Kolo rozhodnutí
            </button>
        `
        : '';
}

function getScorebarHTML(players) {
    return players
        .map(
            (player, index) => `
                <div
                    class="score"
                    style="--player-color:${player.color}"
                >
                    <strong>
                        #${index + 1} ${esc(player.name)}
                    </strong><br>
                    ${player.score} <span data-i18n="riskuj.points">bodů</span>
                </div>
            `
        )
        .join('');
}

function getWinnerHTML(headline, note, tiebreakButton, scorebar) {
    return `
        <div class="winner">
            <div class="eyebrow">FRAXY // RESULTS</div>
            <h2 data-i18n="riskuj.results.gameOver">Hra skončila.</h2>
            <p>${headline}</p>
            ${note}

            ${tiebreakButton}

            <div class="scorebar">
                ${scorebar}
            </div>

            <div class="results-actions">
                <button class="btn" id="restart" data-i18n="riskuj.results.playAgain">
                    Hrát znovu
                </button>

                <button class="btn secondary" id="show-questions" data-i18n="riskuj.results.showQuestions">
                    Zobrazit otázky
                </button>
            </div>
        </div>

        <div
            id="question-history-modal"
            class="question-history-modal hidden"
            aria-hidden="true"
        ></div>
    `;
}

function renderScoreboard(
    players,
    state,
    questionEl,
    restart,
    tiedTop,
    onOpenTiebreak
) {
    const headline = getHeadlineHTML(players, tiedTop);
    const note = getNoteHTML(tiedTop);
    const tiebreakButton = getTiebreakButtonHTML(tiedTop);
    const scorebar = getScorebarHTML(players);

    questionEl.innerHTML = getWinnerHTML(headline, note, tiebreakButton, scorebar);
    if (window.BBFRAXY_I18N) window.BBFRAXY_I18N.apply();

    questionEl.querySelector('#restart').onclick = restart;
    questionEl.querySelector('#show-questions').onclick = () => {
        openQuestionHistory({ state, questionEl });
    };

    const tiebreakTrigger = questionEl.querySelector('#open-tiebreak');

    if (tiebreakTrigger) {
        tiebreakTrigger.onclick = () => {
            const open = onOpenTiebreak || (() => {
                openTiebreak({
                    players: tiedTop,
                    questionEl,
                    renderFinal: (orderedPlayers) => {
                        renderFinalResults({
                            players: orderedPlayers,
                            state,
                            questionEl,
                            restart
                        });
                    }
                });
            });

            open();
        };
    }
}

function openQuestionHistory({ state, questionEl }) {
    const modal = questionEl.querySelector('#question-history-modal');

    if (!modal) {
        return;
    }

    modal.innerHTML = `
        <div
            class="question-history-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-history-title"
        >
            <div class="question-history-header">
                <div>
                    <div class="eyebrow">FRAXY // QUESTION REVIEW</div>
                    <h2 id="question-history-title" data-i18n="riskuj.results.allQuestionsTitle">Všechny otázky</h2>
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

    if (window.BBFRAXY_I18N) window.BBFRAXY_I18N.apply();
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
    const questions = Object.entries(state.questions)
        .filter(([key]) => key.startsWith(`${topic}-`))
        .map(([key, question]) => ({ key, question }))
        .sort((a, b) => a.question.value - b.question.value);

    const correctCount = questions.reduce((count, item) => {
        return count + (state.answerHistory[item.key]?.correct ? 1 : 0);
    }, 0);

    const success = questions.length
        ? Math.round((correctCount / questions.length) * 100)
        : 0;

    return `
        <section class="question-history-topic">
            <div class="question-history-topic-header">
                <h3>${esc(topic)}</h3>
                <span><span data-i18n="riskuj.results.successRate">Úspěšnost</span> ${success}%</span>
            </div>

            <div class="question-history-list">
                ${questions
                    .map(({ key, question }) => {
                        const result = state.answerHistory[key];

                        return `
                            <article class="question-history-item">
                                <div class="question-history-meta">
                                    <span class="question-history-points">
                                        ${question.value} <span data-i18n="riskuj.points">bodů</span>
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
                                    <span data-i18n="riskuj.results.answerPrefix">Odpověď:</span> ${esc(question.answer)}
                                </div>
                            </article>
                        `;
                    })
                    .join('')}
            </div>
        </section>
    `;
}
