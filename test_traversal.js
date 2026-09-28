function hasPathTraversal(path) {
  if (!path) return false;
  let decoded = path;
  let previous = "";

  while (decoded !== previous) {
    previous = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch (e) {
      break;
    }
  }

  const lower = decoded.toLowerCase();
  return lower.includes("..") || lower.includes("%2e%2e") || lower.includes("%252e%252e");
}

console.log(hasPathTraversal("..")); // true
console.log(hasPathTraversal("%2e%2e")); // true
console.log(hasPathTraversal("%252e%252e")); // true
console.log(hasPathTraversal("%252E%252E")); // true
console.log(hasPathTraversal("%252e%252e%malformed")); // true
console.log(hasPathTraversal("dir/../secret")); // true
console.log(hasPathTraversal("dir/%252e%252e/secret")); // true
console.log(hasPathTraversal("dir/secret")); // false
