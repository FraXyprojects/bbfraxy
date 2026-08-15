export const PALETTE = [
    '#5fe7ff',
    '#a78bfa',
    '#fb7185',
    '#fbbf24',
    '#34d399',
    '#f97316',
    '#e879f9',
    '#60a5fa',
    '#4ade80',
    '#f472b6'
];

export const esc = (value) => {
    return String(value).replace(/[&<>\\"]/g, (char) => {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '\\': '&#92;',
            '"': '&quot;'
        }[char] || char;
    });
};

export function renderPlayers({ players, container, onAdd, onRemove }) {
    container.innerHTML = players
        .map(
            (player, index) => `
                <div class="player-row">
                    <span
                        class="player-color"
                        style="--player-color:${player.color}"
                    ></span>
                    <input
                        value="${esc(player.name)}"
                        placeholder="Hráč / tým ${index + 1}"
                    >
                    <button
                        class="player-remove"
                        ${players.length <= 2 ? 'disabled' : ''}
                    >×</button>
                </div>
            `
        )
        .join('');

    container.querySelectorAll('input').forEach((input, index) => {
        input.oninput = () => {
            players[index].name = input.value;
        };
    });

    container.querySelectorAll('.player-remove').forEach((button, index) => {
        button.onclick = () => onRemove(index);
    });

    container.parentElement
        .querySelector('.add-player')
        ?.addEventListener('click', onAdd, { once: true });
}

export function renderQuestionEditor({ topicCount, questionCount, container }) {
    container.innerHTML = Array.from({ length: topicCount }, (_, topicIndex) => {
        return `
            <div class="topic-block">
                <div class="topic-title">
                    <input
                        data-topic="${topicIndex}"
                        placeholder="Téma ${topicIndex + 1}"
                    >
                </div>

                ${Array.from({ length: questionCount }, (_, questionIndex) => {
                    const value = (questionIndex + 1) * 100;

                    return `
                        <div class="q-row">
                            <input
                                data-q="${topicIndex}-${questionIndex}"
                                placeholder="Otázka za ${value}"
                            >
                            <input
                                data-a="${topicIndex}-${questionIndex}"
                                placeholder="Odpověď"
                            >
                            <input value="${value}" disabled>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

export function collectBuiltQuiz(container) {
    const topics = [];
    const questions = {};

    container.querySelectorAll('.topic-block').forEach((block, topicIndex) => {
        const name = (
            block.querySelector(`[data-topic="${topicIndex}"]`)?.value || ''
        ).trim();

        if (!name) {
            return;
        }

        topics.push(name);

        block.querySelectorAll('.q-row').forEach((row, questionIndex) => {
            const value = (questionIndex + 1) * 100;

            questions[`${name}-${value}`] = {
                question: (
                    row.querySelector(`[data-q="${topicIndex}-${questionIndex}"]`)?.value || ''
                ).trim() || `Otázka pro ${name} za ${value} bodů`,
                answer: (
                    row.querySelector(`[data-a="${topicIndex}-${questionIndex}"]`)?.value || ''
                ).trim() || '—',
                value
            };
        });
    });

    return {
        topics,
        questions
    };
}
