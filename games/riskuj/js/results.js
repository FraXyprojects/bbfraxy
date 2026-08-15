import {esc} from './setup.js';

export function renderResults({players,questionEl,restart}){
  const sorted=[...players].sort((a,b)=>b.score-a.score);
  questionEl.innerHTML=`<div class="winner"><div class="eyebrow">FRAXY // RESULTS</div><h2>Hra skončila.</h2><div class="scorebar">${sorted.map((p,i)=>`<div class="score" style="--player-color:${p.color}"><strong>#${i+1} ${esc(p.name)}</strong><br>${p.score} bodů</div>`).join('')}</div><button class="btn" id="restart">Hrát znovu</button></div><div id="decision-wheel"></div>`;
  questionEl.querySelector('#restart').onclick=restart;
}
