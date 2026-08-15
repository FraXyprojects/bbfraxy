import {esc} from './setup.js';

export function renderResults({players,questionEl,restart}){
  const sorted=[...players].sort((a,b)=>b.score-a.score);
  renderScoreboard(sorted, questionEl, restart, true);
}

export function renderFinalResults({players,questionEl,restart}){
  renderScoreboard(players, questionEl, restart, false);
}

function renderScoreboard(players,questionEl,restart,showDecisionMount){
  questionEl.innerHTML=`<div class="winner"><div class="eyebrow">FRAXY // RESULTS</div><h2>Hra skončila.</h2>${players.length?`<p>Vítězem se stává <strong style="color:${players[0].color}">${esc(players[0].name)}</strong>.</p>`:''}<div class="scorebar">${players.map((p,i)=>`<div class="score" style="--player-color:${p.color}"><strong>#${i+1} ${esc(p.name)}</strong><br>${p.score} bodů</div>`).join('')}</div><button class="btn" id="restart">Hrát znovu</button></div>${showDecisionMount?'<div id="decision-wheel"></div>':''}`;
  questionEl.querySelector('#restart').onclick=restart;
}
