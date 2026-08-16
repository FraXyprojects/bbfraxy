(() => {
  const BINARY_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif", "tif", "tiff",
    "mp3", "wav", "ogg", "flac", "m4a", "mp4", "webm", "mov", "avi",
    "zip", "7z", "rar", "gz", "tar", "dll", "exe", "so", "dylib", "jar", "class", "wasm",
    "ttf", "otf", "woff", "woff2", "pdf"
  ]);

  const observer = new MutationObserver(() => apply());
  observer.observe(document.body, { childList: true, subtree: true });
  apply();

  function apply() {
    document.querySelectorAll("button.file-row").forEach((row) => {
      const path = getPath(row);
      if (!path || !isBinary(path)) return;

      const base = path.split("/").pop() || path;
      const ext = extension(base).toUpperCase();
      const name = row.querySelector(":scope > .tree-name");
      if (name) {
        name.classList.add("binary-file-name");
        let summary = name.querySelector(":scope > .file-map-summary");
        if (!summary) {
          summary = document.createElement("span");
          summary.className = "file-map-summary";
          name.append(summary);
        }
        summary.textContent = `${ext} image/media asset — source code preview not applicable`;
        summary.title = "Binary asset. The Simplifier does not decode binary data as source code.";
      }

      const safety = row.querySelector(":scope > .file-safety");
      if (safety) {
        safety.textContent = "Asset";
        safety.className = "file-safety edit-asset";
        safety.title = "Binary asset — not source code. Edit or replace the asset as a project resource.";
      }

      row.title = `${ext} asset — binary file, not source code`;
      row.dataset.binaryAsset = "true";
    });
  }

  function isBinary(path) {
    return BINARY_EXTENSIONS.has(extension(path));
  }

  function extension(path) {
    const base = path.split("/").pop() || "";
    const index = base.lastIndexOf(".");
    return index > 0 ? base.slice(index + 1).toLowerCase() : "";
  }

  function getPath(row) {
    const name = row.querySelector(":scope > .tree-name")?.childNodes?.[0]?.textContent?.trim() || "";
    if (!name) return "";
    const parts = [name];
    let folder = row.closest("details.tree-folder");
    while (folder) {
      const folderName = folder.querySelector(":scope > .folder-row .tree-name")?.textContent?.trim();
      if (folderName) parts.unshift(folderName);
      folder = folder.parentElement?.closest("details.tree-folder") || null;
    }
    return parts.join("/");
  }
})();
