import {esc} from './setup.js';

export function renderResults({players,questionEl,restart}){
  const sorted=[...players].sort((a,b)=>b.score-a.score);
  const topScore=sorted[0]?.score ?? 0;
  const tiedTop=sorted.filter(p=>p.score===topScore);
  renderScoreboard(sorted,questionEl,restart,tiedTop);
}

export function renderFinalResults({players,questionEl,restart}){
  renderScoreboard(players,questionEl,restart,null);
}

function renderScoreboard(players,questionEl,restart,tiedTop){
  const headline=tiedTop?.length>1
    ? `Vítězství je zatím nerozhodné mezi <strong>${tiedTop.map(p=>`<span style="color:${p.color}">${esc(p.name)}</span>`).join(' / ')}</strong>.`
    : players.length
      ? `Vítězem se stává <strong style="color:${players[0].color}">${esc(players[0].name)}</strong>.`
      : '';
  const note=tiedTop?.length>1 ? '<div class="decision-hint">O pořadí rozhodne Kolo rozhodnutí níže.</div>' : '';
  questionEl.innerHTML=`<div class="winner"><div class="eyebrow">FRAXY // RESULTS</div><h2>Hra skončila.</h2><p>${headline}</p>${note}<div class="scorebar">${players.map((p,i)=>`<div class="score" style="--player-color:${p.color}"><strong>#${i+1} ${esc(p.name)}</strong><br>${p.score} bodů</div>`).join('')}</div><button class="btn" id="restart">Hrát znovu</button></div>${tiedTop?.length>1?'<div id="decision-wheel"></div>':''}`;
  questionEl.querySelector('#restart').onclick=restart;
}
