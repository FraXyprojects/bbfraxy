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
  questionEl.innerHTML = '<div id="decision-wheel"></div>';
  processNextGroup(state, questionEl, renderFinal);
}

function processNextGroup(state, questionEl, renderFinal) {
  const group = state.groups[state.groupIndex];
  if (!group) {
    renderFinal(state.placed);
    return;
  }
  if (group.length === 1) {
    state.placed.push(group[0]);
    state.groupIndex += 1;
    processNextGroup(state, questionEl, renderFinal);
    return;
  }
  state.currentGroup = [...group];
  renderWheel(state, questionEl, renderFinal);
}

function renderWheel(state, questionEl, renderFinal) {
  const group = state.currentGroup;
  const segment = 360 / group.length;
  const gradient = group.map((player, i) => `${player.color} ${i * segment}deg ${(i + 1) * segment}deg`).join(',');
  const labels = group.map((player, i) => {
    const angle = i * segment + segment / 2 - 90;
    return `<span class="wheel-label" style="--angle:${angle}deg;--label-color:${player.color}">${esc(player.name)}</span>`;
  }).join('');

  questionEl.querySelector('#decision-wheel').innerHTML = `
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

  questionEl.querySelector('#spin-wheel').onclick = () => spin(state, questionEl, renderFinal);
}

function spin(state, questionEl, renderFinal) {
  const group = state.currentGroup;
  const wheel = questionEl.querySelector('#wheel');
  const button = questionEl.querySelector('#spin-wheel');
  const result = questionEl.querySelector('#wheel-result');
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
        renderWheel(state, questionEl, renderFinal);
        return;
      }
      if (state.currentGroup.length === 1) state.placed.push(state.currentGroup[0]);
      state.groupIndex += 1;
      processNextGroup(state, questionEl, renderFinal);
    }, 1000);
  }, 3900);
}
