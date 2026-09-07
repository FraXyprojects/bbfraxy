// Mock fetchFile
let callCount = 0;
const asyncWait = ms => new Promise(r => setTimeout(r, ms));
async function fetchFile(path) {
  callCount++;
  await asyncWait(10); // Mock network latency
  return { text: "mock text for " + path };
}

function normalize(path) {
  return String(path || "").replace(/^\.\//, "").replace(/^\//, "");
}

function isTextDependency(path) {
  return /\.(html?|css|js|mjs|cjs)$/i.test(path);
}

function extractReferences(text, fromPath) {
  // Mock just returning a few paths
  return new Set(["style.css", "script.js", "image.png"]);
}

// Current implementation
async function detectUsedPathsOld(entry, html, available) {
  const used = new Set([entry]);
  const queue = [{ path: entry, text: html }];

  while (queue.length) {
    const current = queue.shift();
    for (const ref of extractReferences(current.text, current.path)) {
      const actual = available.get(normalize(ref).toLowerCase());
      if (!actual || used.has(actual)) continue;
      used.add(actual);
      if (isTextDependency(actual) && used.size < 120) {
        try {
          const payload = await fetchFile(actual);
          queue.push({ path: actual, text: payload.text || "" });
        } catch {}
      }
    }
  }
  return used;
}

// Optimized implementation
async function detectUsedPathsNew(entry, html, available) {
  const used = new Set([entry]);
  const queue = [{ path: entry, text: html }];

  while (queue.length) {
    const current = queue.shift();
    const promises = [];
    for (const ref of extractReferences(current.text, current.path)) {
      const actual = available.get(normalize(ref).toLowerCase());
      if (!actual || used.has(actual)) continue;
      used.add(actual);
      if (isTextDependency(actual) && used.size < 120) {
        promises.push(
          fetchFile(actual).then(payload => ({ path: actual, text: payload.text || "" })).catch(() => null)
        );
      }
    }
    const results = await Promise.all(promises);
    for (const res of results) {
      if (res) queue.push(res);
    }
  }
  return used;
}

async function run() {
  const available = new Map([
    ["style.css", "style.css"],
    ["script.js", "script.js"],
    ["image.png", "image.png"],
    ["main.js", "main.js"]
  ]);

  console.log("Running old...");
  callCount = 0;
  const t0 = performance.now();
  await detectUsedPathsOld("index.html", "html content", available);
  const t1 = performance.now();
  console.log("Old took:", (t1 - t0).toFixed(2), "ms", "callCount:", callCount);

  console.log("Running new...");
  callCount = 0;
  const t2 = performance.now();
  await detectUsedPathsNew("index.html", "html content", available);
  const t3 = performance.now();
  console.log("New took:", (t3 - t2).toFixed(2), "ms", "callCount:", callCount);
}

run();
