function buildTreeOriginal(tree) {
  const root = { name: "", path: "", type: "tree", children: new Map(), item: null };
  for (const item of tree) {
    const parts = item.path.split("/");
    let node = root;
    parts.forEach((part, index) => {
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          type: index === parts.length - 1 ? item.type : "tree",
          children: new Map(),
          item: index === parts.length - 1 ? item : null,
        });
      }
      node = node.children.get(part);
    });
  }
  return root;
}

function buildTreeOptimized(tree) {
  const root = { name: "", path: "", type: "tree", children: new Map(), item: null };
  for (const item of tree) {
    const parts = item.path.split("/");
    const len = parts.length;
    let node = root;
    let currentPath = "";
    for (let index = 0; index < len; index++) {
      const part = parts[index];
      currentPath = currentPath ? currentPath + "/" + part : part;

      let childNode = node.children.get(part);
      if (!childNode) {
        childNode = {
          name: part,
          path: currentPath,
          type: index === len - 1 ? item.type : "tree",
          children: new Map(),
          item: index === len - 1 ? item : null,
        };
        node.children.set(part, childNode);
      }
      node = childNode;
    }
  }
  return root;
}

const mockTree = [];
for (let i = 0; i < 700; i++) {
  const depth = (i % 5) + 1;
  const pathParts = [];
  for (let j = 0; j < depth; j++) {
    pathParts.push(`folder${j}`);
  }
  pathParts.push(`file${i}.js`);
  mockTree.push({ path: pathParts.join("/"), type: "blob" });
}

let t0 = performance.now();
for (let i = 0; i < 1000; i++) {
  buildTreeOriginal(mockTree);
}
let t1 = performance.now();
console.log(`Original: ${((t1 - t0) / 1000).toFixed(3)}ms`);

t0 = performance.now();
for (let i = 0; i < 1000; i++) {
  buildTreeOptimized(mockTree);
}
t1 = performance.now();
console.log(`Optimized: ${((t1 - t0) / 1000).toFixed(3)}ms`);
