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

const largeText = "const a = 1; // comment\n".repeat(5000);

const t0 = performance.now();
const res = highlightWithLineNumbers(largeText, 'javascript');
const t1 = performance.now();
console.log(`Original: ${(t1 - t0).toFixed(2)}ms`);

function highlightWithLineNumbersOptimized(text, language) {
  // Can we optimize colorize?
  // Using an array to accumulate HTML to avoid intermediate strings
  let out = '';
  const lines = text.replace(/\r\n?/g,'\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    out += `<div class="code-line"><span class="code-ln">${i+1}</span><span class="code-src">${highlightLine(lines[i],language) || ' '}</span></div>`;
  }
  out += '<div class="code-copybar"><button type="button" class="code-copy">Copy file</button></div>';
  return out;
}

const t2 = performance.now();
const res2 = highlightWithLineNumbersOptimized(largeText, 'javascript');
const t3 = performance.now();
console.log(`Optimized loop: ${(t3 - t2).toFixed(2)}ms`);

// Let's test single-pass replace
function colorizeOptimized(text, rules) {
  // If we just use full string replacement
  let output = text;
  // wait, the problem with full string replacement is replacing html tags
}
