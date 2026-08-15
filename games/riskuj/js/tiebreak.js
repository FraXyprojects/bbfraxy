import {esc} from './setup.js';

export function startTiebreak({ players, questionEl, renderFinal }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const groups = [];
  for (const player of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].score === player.score) last.push(player);
    else groups.push([player]);
  }

  if (!groups.some((group) => group.length > 1)) {
    renderFinal(sorted);
    return;
  }

  const state = { groups, groupIndex: 0, currentGroup: null, placed: [] };
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
  const gradient = group.map((player, i) => `${player.color} ${i * segment}deg ${(i + 1) * segment}deg`).join(',');
  const labels = group.map((player, i) => {
    const angle = i * segment + segment / 2 - 90;
    return `<span class="wheel-label" style="--angle:${angle}deg;--label-color:${player.color}">${esc(player.name)}</span>`;
  }).join('');

  mount.innerHTML = `
    <div class="tiebreak-card">
      <div class="eyebrow">FRAXY // DECISION ROUND</div>
      <h3>Kolo rozhodnutí</h3>
      <p>Skóre mezi <strong>${group.map((p) => esc(p.name)).join(', ')}</strong> je nerozhodné. O vítězi rozhodne náhoda.</p>
      <div class="wheel-stage">
        <div class="wheel-pointer" aria-hidden="true"></div>
        <div class="wheel" id="wheel" style="--wheel-gradient:conic-gradient(${gradient})">
          ${labels}
          <div class="wheel-center">?</div>
        </div>
      </div>
      <div id="wheel-result" class="wheel-result" aria-live="polite"></div>
      <button class="btn" id="spin-wheel">🎡 Zatočit kolem</button>
    </div>`;

  mount.querySelector('#spin-wheel').onclick = () => spin(state, mount, renderFinal);
}

function spin(state, mount, renderFinal) {
  const group = state.currentGroup;
  const wheel = mount.querySelector('#wheel');
  const button = mount.querySelector('#spin-wheel');
  const result = mount.querySelector('#wheel-result');
  if (!wheel || !button || !result || button.disabled) return;

  const winnerIndex = Math.floor(Math.random() * group.length);
  const segment = 360 / group.length;
  const target = 360 * (4 + Math.floor(Math.random() * 3)) + (360 - (winnerIndex * segment + segment / 2));
  wheel.style.setProperty('--spin-target', `${target}deg`);
  wheel.classList.add('spinning');
  button.disabled = true;

  window.setTimeout(() => {
    const winner = group[winnerIndex];
    const place = state.placed.length + 1;
    state.placed.push(winner);
    result.innerHTML = `<strong style="color:${winner.color}">${esc(winner.name)}</strong> vyhrává toto kolo a získává <strong>${place}. místo</strong>.`;

    state.currentGroup = group.filter((player) => player !== winner);
    window.setTimeout(() => {
      if (state.currentGroup.length > 1) {
        renderWheel(state, mount, renderFinal);
        return;
      }
      if (state.currentGroup.length === 1) state.placed.push(state.currentGroup[0]);
      state.groupIndex += 1;
      processNextGroup(state, mount, renderFinal);
    }, 1000);
  }, 3900);
}
