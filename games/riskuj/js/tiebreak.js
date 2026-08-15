import {esc} from './setup.js';

export function createTiebreak({ players, renderFinal }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const groups = [];
  for (const player of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].score === player.score) last.push(player);
    else groups.push([player]);
  }

  const state = { groups, groupIndex: 0, currentGroup: null, placed: [], spinning: false };

  renderGroup();
  return state;

  function renderGroup() {
    const group = state.groups[state.groupIndex];
    if (!group || group.length < 2) {
      if (group?.length === 1) state.placed.push(group[0]);
      state.groupIndex += 1;
      if (state.groupIndex >= state.groups.length) {
        renderFinal(state.placed);
        return;
      }
      renderGroup();
      return;
    }

    state.currentGroup = [...group];
    renderWheel(state);
  }
}

export function renderWheel(state) {
  const root = document.querySelector('#decision-wheel');
  if (!root) return;
  const group = state.currentGroup || [];
  const segment = 360 / group.length;
  const colors = group.map((p) => p.color);
  const gradient = group.map((p, i) => `${p.color} ${i * segment}deg ${(i + 1) * segment}deg`).join(',');
  const labels = group.map((p, i) => {
    const angle = i * segment + segment / 2 - 90;
    return `<span class="wheel-label" style="--angle:${angle}deg;--label-color:${p.color}">${esc(p.name)}</span>`;
  }).join('');

  root.innerHTML = `
    <div class="tiebreak-card">
      <div class="eyebrow">FRAXY // DECISION ROUND</div>
      <h3>Kolo rozhodnutí</h3>
      <p>Skóre mezi <strong>${group.map((p) => esc(p.name)).join(', ')}</strong> je nerozhodné. O pořadí rozhodne náhoda.</p>
      <div class="wheel-stage">
        <div class="wheel-pointer" aria-hidden="true"></div>
        <div id="wheel" class="wheel" style="--wheel-gradient:conic-gradient(${gradient})">
          ${labels}
          <div class="wheel-center">?</div>
        </div>
      </div>
      <div id="wheel-result" class="wheel-result" aria-live="polite"></div>
      <button class="btn" id="spin-wheel" ${state.spinning ? 'disabled' : ''}>🎡 Zatočit kolem</button>
    </div>`;

  root.querySelector('#spin-wheel').onclick = () => spin(state, group);
}

function spin(state, group) {
  if (state.spinning) return;
  state.spinning = true;
  const wheel = document.querySelector('#wheel');
  const button = document.querySelector('#spin-wheel');
  const result = document.querySelector('#wheel-result');
  if (!wheel || !button || !result) return;

  const winnerIndex = Math.floor(Math.random() * group.length);
  const segment = 360 / group.length;
  const target = 360 * (4 + Math.floor(Math.random() * 3)) + (360 - (winnerIndex * segment + segment / 2));
  wheel.style.setProperty('--spin-target', `${target}deg`);
  wheel.classList.add('spinning');
  button.disabled = true;

  window.setTimeout(() => {
    const winner = group[winnerIndex];
    result.innerHTML = `<strong style="color:${winner.color}">${esc(winner.name)}</strong> vyhrává toto kolo a získává <strong>${placeLabel(state)}</strong> místo.`;
    state.placed.push(winner);
    state.currentGroup = group.filter((p) => p !== winner);

    window.setTimeout(() => {
      state.spinning = false;
      if (state.currentGroup.length > 1) {
        renderWheel(state);
        return;
      }
      if (state.currentGroup.length === 1) state.placed.push(state.currentGroup[0]);
      state.groupIndex += 1;
      if (state.groupIndex >= state.groups.length) renderFinal(state.placed);
      else renderGroupNext(state);
    }, 1100);
  }, 3900);
}

function renderGroupNext(state) {
  const group = state.groups[state.groupIndex];
  if (!group || group.length < 2) {
    if (group?.length === 1) state.placed.push(group[0]);
    state.groupIndex += 1;
    if (state.groupIndex >= state.groups.length) renderFinalFromState(state);
    else renderGroupNext(state);
    return;
  }
  state.currentGroup = [...group];
  renderWheel(state);
}

function renderFinalFromState(state) {
  const fn = window.__riskujRenderFinal;
  if (fn) fn(state.placed);
}

function placeLabel(state) {
  return `${state.placed.length + 1}.`;
}
