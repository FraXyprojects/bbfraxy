import { esc } from './setup.js';

export function startTiebreak({
    players,
    questionEl,
    renderFinal
}) {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const groups = [];

    for (const player of sorted) {
        const lastGroup = groups[groups.length - 1];

        if (lastGroup && lastGroup[0].score === player.score) {
            lastGroup.push(player);
        } else {
            groups.push([player]);
        }
    }

    if (!groups.some((group) => group.length > 1)) {
        renderFinal(sorted);
        return;
    }

    const state = {
        groups,
        groupIndex: 0,
        currentGroup: null,
        placed: []
    };

    const mount = questionEl.querySelector('#decision-wheel');

    if (!mount) {
        renderFinal(sorted);
        return;
    }

    processNextGroup(state, mount, renderFinal);
}

function processNextGroup(state, mount, renderFinal) {
    const group = state.groups[state.groupIndex];

    if (!group) {
        renderFinal(state.placed);
        return;
    }

    if (group.length === 1) {
        state.placed.push(group[0]);
        state.groupIndex += 1;
        processNextGroup(state, mount, renderFinal);
        return;
    }

    state.currentGroup = [...group];
    renderWheel(state, mount, renderFinal);
}

function renderWheel(state, mount, renderFinal) {
    const group = state.currentGroup;
    const segment = 360 / group.length;
    const labelRadius = 27;

    const gradient = group
        .map(
            (player, index) =>
                `${player.color} ${index * segment}deg ${(index + 1) * segment}deg`
        )
        .join(',');

    const labels = group
        .map((player, index) => {
            const middleAngle = (index + 0.5) * segment;
            const radians = (middleAngle - 90) * Math.PI / 180;
            const x = 50 + labelRadius * Math.cos(radians);
            const y = 50 + labelRadius * Math.sin(radians);

            return `
                <span
                    class="wheel-label"
                    style="left:${x}%;top:${y}%;--label-color:${player.color}"
                    title="${esc(player.name)}"
                >
                    ${esc(player.name)}
                </span>
            `;
        })
        .join('');

    mount.innerHTML = `
        <div class="tiebreak-card">
            <div class="eyebrow">FRAXY // DECISION ROUND</div>
            <h3>Kolo rozhodnutí</h3>
            <p>
                Skóre mezi
                <strong>
                    ${group
                        .map(
                            (player) =>
                                `<span style="color:${player.color}">${esc(player.name)}</span>`
                        )
                        .join(', ')}
                </strong>
                je nerozhodné. O vítězi rozhodne náhoda.
            </p>

            <div class="wheel-stage">
                <div class="wheel-pointer" aria-hidden="true"></div>

                <div
                    class="wheel"
                    id="wheel"
                    style="--wheel-gradient: conic-gradient(${gradient})"
                >
                    ${labels}

                    <div class="wheel-center">?</div>
                </div>
            </div>

            <div id="wheel-result" class="wheel-result" aria-live="polite"></div>

            <button class="btn" id="spin-wheel">
                🎡 Zatočit kolem
            </button>
        </div>
    `;

    mount.querySelector('#spin-wheel').onclick = () => {
        spin(state, mount, renderFinal);
    };
}

function randomIndex(max) {
    if (globalThis.crypto?.getRandomValues) {
        const values = new Uint32Array(1);
        globalThis.crypto.getRandomValues(values);

        return Math.floor((values[0] / 4294967296) * max);
    }

    return Math.floor(Math.random() * max);
}

function spin(state, mount, renderFinal) {
    const group = state.currentGroup;
    const wheel = mount.querySelector('#wheel');
    const button = mount.querySelector('#spin-wheel');
    const result = mount.querySelector('#wheel-result');

    if (!wheel || !button || !result || button.disabled) {
        return;
    }

    const winnerIndex = randomIndex(group.length);
    const segment = 360 / group.length;
    const centerAngle = winnerIndex * segment + segment / 2;
    const target = 360 * 5 + (360 - centerAngle);

    wheel.style.setProperty('--spin-target', `${target}deg`);
    wheel.classList.add('spinning');
    button.disabled = true;

    window.setTimeout(() => {
        const winner = group[winnerIndex];
        const place = state.placed.length + 1;

        state.placed.push(winner);

        result.innerHTML = `
            <strong style="color:${winner.color}">
                ${esc(winner.name)}
            </strong>
            vyhrává toto kolo a získává
            <strong>${place}. místo</strong>.
        `;

        state.currentGroup = group.filter(
            (player) => player !== winner
        );

        window.setTimeout(() => {
            if (state.currentGroup.length > 1) {
                renderWheel(state, mount, renderFinal);
                return;
            }

            if (state.currentGroup.length === 1) {
                state.placed.push(state.currentGroup[0]);
            }

            state.groupIndex += 1;
            processNextGroup(state, mount, renderFinal);
        }, 1000);
    }, 3900);
}
