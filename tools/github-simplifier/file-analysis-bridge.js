(() => {
  let lastAnalysisKey = null;
  let lastPreviewKey = null;
  let scheduled = false;

  function getState() {
    const analysis = document.querySelector(".analysis-result");
    if (!analysis) return null;
    const ownerLine = analysis.querySelector(".analysis-owner")?.textContent || "";
    const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
    if (!match) return null;
    const repoKey = `${match[1]}/${match[2]}@${match[3]}`;
    const title = analysis.querySelector("#preview-title")?.textContent?.trim() || "";
    const previewKey = `${repoKey}:${title}`;
    return { analysis, repoKey, previewKey };
  }

  function check() {
    scheduled = false;
    const state = getState();
    if (!state) return;

    const analysisChanged = state.repoKey !== lastAnalysisKey;
    const previewChanged = state.previewKey !== lastPreviewKey;
    if (!analysisChanged && !previewChanged) return;

    lastAnalysisKey = state.repoKey;
    lastPreviewKey = state.previewKey;
    document.dispatchEvent(new CustomEvent("github-simplifier:analysis-rendered", {
      detail: { analysis: state.analysis, reason: analysisChanged ? "repository" : "preview" },
    }));
  }

  function scheduleCheck() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(check, 0);
  }

  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  scheduleCheck();
})();
