function normalize(path) { return String(path || "").replace(/^\.\//, "").replace(/^\//, ""); }
function isLocalRef(ref) { return ref && !ref.startsWith("http://") && !ref.startsWith("https://") && !ref.startsWith("data:") && !ref.startsWith("#"); }
function resolveRelative(base, relative) {
  if (relative.startsWith("/")) return normalize(relative);
  const baseParts = normalize(base).split("/");
  baseParts.pop();
  const relParts = relative.split("/");
  for (const part of relParts) {
    if (part === ".") continue;
    if (part === "..") baseParts.pop();
    else baseParts.push(part);
  }
  return baseParts.join("/");
}

function extractReferences(text, fromPath) {
  const refs = new Set();
  const htmlRefs = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  const importRefs = /(?:import\s+(?:[^'";]+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/g;
  const cssRefs = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let match;
  while ((match = htmlRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
  while ((match = importRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
  while ((match = cssRefs.exec(text))) if (isLocalRef(match[1])) refs.add(resolveRelative(fromPath, match[1]));
  return refs;
}

const largeHTML = `
  <html><body>
  <script src="./js/app.js"></script>
  <link rel="stylesheet" href="./css/style.css">
  <img src="img/logo.png">
  <a href="about.html">About</a>
  <script type="module">
    import { fn } from "./js/module.js";
  </script>
  <style>
    .bg { background: url('img/bg.jpg'); }
  </style>
  </body></html>
`.repeat(100);

let t0 = performance.now();
for (let i = 0; i < 1000; i++) {
  extractReferences(largeHTML, "index.html");
}
let t1 = performance.now();
console.log(`Extract: ${((t1-t0)/1000).toFixed(2)}ms`);
