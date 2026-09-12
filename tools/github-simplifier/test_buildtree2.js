function sortTreeItems(a, b) {
  if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function renderTreeNode(node) {
  const entries = [...node.children.values()].sort(sortTreeItems);
}

function renderTreeNodeOptimized(node) {
  const entries = Array.from(node.children.values()).sort(sortTreeItems);
}
