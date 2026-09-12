const fs = require('fs');

function escapeHtml(value) { return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

const SYNTAX_RULES = {
  default: [/\/\/.*$/g,'comment',/#.*$/g,'comment',/\/\*.*?\*\//g,'comment',/\b(?:const|let|var|function|return|if|else|for|while|class|public|private|protected|using|namespace|new|this|async|await|import|from|export|extends|static|void|int|float|string|bool|true|false|null|undefined|def|try|catch|throw|switch|case|break|continue)\b/g,'keyword',/\b\d+(?:\.\d+)?\b/g,'number',/'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"|`(?:[^`\\]|\\.)*`/g,'string']
};

function colorize(text, rules) {
  let output = text; const placeholders = [];
  for (let i=0;i<rules.length;i+=2) output = output.replace(rules[i], match => { const token=`\u0000${placeholders.length}\u0000`; placeholders.push(`<span class="tok-${rules[i+1]}">${match}</span>`); return token; });
  placeholders.forEach((html,index) => { output = output.replaceAll(`\u0000${index}\u0000`,html); });
  return output;
}

function highlightLine(line, language) {
  const escaped = escapeHtml(line);
  return colorize(escaped, SYNTAX_RULES.default);
}

function highlightWithLineNumbers(text, language) {
  return text.replace(/\r\n?/g,'\n').split('\n').map((line,index) => `<div class="code-line"><span class="code-ln">${index+1}</span><span class="code-src">${highlightLine(line,language) || ' '}</span></div>`).join('') + '<div class="code-copybar"><button type="button" class="code-copy">Copy file</button></div>';
}

function highlightWithLineNumbersOptimized(text, language) {
  const lines = text.replace(/\r\n?/g,'\n').split('\n');
  const len = lines.length;
  const out = new Array(len + 1);
  for (let i = 0; i < len; i++) {
    out[i] = `<div class="code-line"><span class="code-ln">${i+1}</span><span class="code-src">${highlightLine(lines[i],language) || ' '}</span></div>`;
  }
  out[len] = '<div class="code-copybar"><button type="button" class="code-copy">Copy file</button></div>';
  return out.join('');
}

const largeText = fs.readFileSync('tools/github-simplifier/package-lock.json', 'utf8');

const runs = 20;
let t0 = performance.now();
for (let i=0; i<runs; i++) highlightWithLineNumbers(largeText, 'javascript');
let t1 = performance.now();
console.log(`Original: ${((t1 - t0)/runs).toFixed(2)}ms per run`);

t0 = performance.now();
for (let i=0; i<runs; i++) highlightWithLineNumbersOptimized(largeText, 'javascript');
t1 = performance.now();
console.log(`Optimized loop: ${((t1 - t0)/runs).toFixed(2)}ms per run`);
