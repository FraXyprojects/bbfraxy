(() => {
  const API_BASE = "https://bbfraxy-github-simplifier.fraxy.workers.dev/v1/github";
  const MAX_FILE_BYTES = 180000;
  const MAX_ALL_CODE_BYTES = 8000000;
  const LANGUAGE_MAP = {
    js:"javascript",mjs:"javascript",cjs:"javascript",ts:"typescript",tsx:"typescript",jsx:"javascript",
    html:"html",htm:"html",css:"css",scss:"css",less:"css",json:"json",py:"python",cs:"csharp",java:"java",kt:"kotlin",
    rs:"rust",go:"go",cpp:"cpp",c:"c",h:"cpp",hpp:"cpp",php:"php",rb:"ruby",swift:"swift",xml:"xml",svg:"xml",
    md:"markdown",yaml:"yaml",yml:"yaml",toml:"toml",ini:"ini",cfg:"ini",txt:"text",sh:"shell",bat:"bat",ps1:"powershell"
  };

  let mountedKey = null;
  let active = null;
  let generation = 0;
  const observer = new MutationObserver(() => sync());

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  sync();

  function getAnalysis() {
    return document.querySelector('.analysis-result:not(.repository-picker-result)');
  }

  function getRepositoryFromAnalysis(analysis) {
    const ownerLine = analysis?.querySelector('.analysis-owner')?.textContent?.trim() || '';
    const match = ownerLine.match(/^([^/\s]+)\/([^\s]+)\s*·\s*(.+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], branch: match[3] };
  }

  function sync() {
    const analysis = getAnalysis();
    const repo = getRepositoryFromAnalysis(analysis);
    const key = repo ? `${repo.owner}/${repo.repo}@${repo.branch}` : null;

    if (!analysis || !repo) {
      if (active) destroyPreview();
      mountedKey = null;
      return;
    }

    const existing = document.querySelector('.code-workspace-panel');
    if (key !== mountedKey || !existing || existing.dataset.repositoryKey !== key) {
      destroyPreview();
      mountedKey = key;
      mount(analysis, repo, key);
    }
  }

  function destroyPreview() {
    generation += 1;
    document.querySelectorAll('.code-workspace-panel').forEach((node) => node.remove());
    active = null;
  }

  async function mount(analysis, repo, key) {
    const panel = document.createElement('section');
    panel.className = 'code-workspace-panel';
    panel.dataset.repositoryKey = key;
    panel.innerHTML = `
      <div class="code-workspace-head">
        <div>
          <span class="analysis-label">Code preview · A+B</span>
          <h3>Explore the complete codebase</h3>
          <p class="code-workspace-sub">Repository-scoped source browser with lightweight syntax highlighting. Files load on demand.</p>
        </div>
        <div class="code-workspace-actions">
          <button type="button" class="code-action code-load-all">Load all code</button>
          <button type="button" class="code-action code-collapse">Collapse</button>
        </div>
      </div>
      <div class="code-workspace-toolbar">
        <input class="code-search" type="search" placeholder="Search files…" aria-label="Search files">
        <span class="code-count"></span>
      </div>
      <div class="code-workspace">
        <aside class="code-sidebar" aria-label="Repository files">
          <div class="code-sidebar-empty">Loading repository files…</div>
        </aside>
        <section class="code-editor" aria-live="polite">
          <div class="code-editor-head">
            <div class="code-editor-title">Select a file</div>
            <div class="code-editor-meta"></div>
          </div>
          <div class="code-editor-body"><div class="code-empty-state">Choose a file from this repository.</div></div>
        </section>
      </div>
      <p class="code-workspace-note">Scoped to <strong>${escapeHtml(repo.owner)}/${escapeHtml(repo.repo)}</strong>. Repository code is never executed in this code viewer.</p>
    `;
    analysis.insertAdjacentElement('afterend', panel);
    installStyles();

    const state = { analysis, repo, key, panel, tree: [], filtered: [], fileCache: new Map(), token: ++generation };
    active = state;

    panel.querySelector('.code-search').addEventListener('input', (event) => {
      const q = event.currentTarget.value.trim().toLowerCase();
      state.filtered = q ? state.tree.filter((item) => item.path.toLowerCase().includes(q)) : state.tree.slice();
      renderSidebar(state);
    });
    panel.querySelector('.code-collapse').addEventListener('click', () => panel.querySelectorAll('details.code-folder').forEach((node) => { node.open = false; }));
    panel.querySelector('.code-load-all').addEventListener('click', () => loadAll(state));

    try {
      const response = await fetch(`${API_BASE}/repo/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/tree`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Repository tree could not be loaded (${response.status}).`);
      const payload = await response.json();
      if (!isCurrent(state)) return;
      state.tree = Array.isArray(payload.tree) ? payload.tree.filter((item) => item.type === 'blob' && !isGenerated(item.path)) : [];
      state.filtered = state.tree.slice();
      renderSidebar(state);
    } catch (error) {
      if (!isCurrent(state)) return;
      panel.querySelector('.code-sidebar').innerHTML = `<div class="code-sidebar-empty">${escapeHtml(error.message || 'Repository files could not be loaded.')}</div>`;
    }
  }

  function isCurrent(state) {
    return active === state && state.token === generation && document.querySelector('.code-workspace-panel') === state.panel && state.panel.isConnected;
  }

  function renderSidebar(state) {
    if (!isCurrent(state)) return;
    const sidebar = state.panel.querySelector('.code-sidebar');
    const count = state.panel.querySelector('.code-count');
    sidebar.replaceChildren();
    const groups = new Map();
    for (const item of state.filtered) {
      const parts = item.path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(item);
    }
    let visible = 0;
    for (const [folder, files] of [...groups.entries()].sort((a,b) => a[0].localeCompare(b[0]))) {
      const details = document.createElement('details');
      details.className = 'code-folder';
      details.open = folder === '.';
      const summary = document.createElement('summary');
      summary.className = 'code-folder-row';
      summary.innerHTML = `<span class="code-folder-chevron">›</span><span class="code-folder-name">${escapeHtml(folder)}</span><span class="code-folder-count">${files.length}</span>`;
      details.append(summary);
      const body = document.createElement('div');
      body.className = 'code-folder-files';
      for (const item of files.sort((a,b) => a.path.localeCompare(b.path, undefined, { numeric:true, sensitivity:'base' }))) {
        visible += 1;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'code-file-row';
        button.title = item.path;
        button.innerHTML = `<span class="code-file-icon">◇</span><span class="code-file-name">${escapeHtml(item.name || item.path.split('/').pop())}</span><span class="code-file-lang">${escapeHtml(languageLabel(item.path))}</span>`;
        button.addEventListener('click', () => openFile(state, item));
        body.append(button);
      }
      details.append(body);
      sidebar.append(details);
    }
    if (!visible) sidebar.innerHTML = '<div class="code-sidebar-empty">No files match this search.</div>';
    count.textContent = `${visible} file${visible === 1 ? '' : 's'}`;
  }

  async function openFile(state, item) {
    if (!isCurrent(state)) return;
    const title = state.panel.querySelector('.code-editor-title');
    const meta = state.panel.querySelector('.code-editor-meta');
    const body = state.panel.querySelector('.code-editor-body');
    title.textContent = item.path;
    meta.textContent = `${languageLabel(item.path)} · ${formatBytes(item.size || 0)}`;
    body.innerHTML = `<div class="code-empty-state">Loading ${escapeHtml(item.path)}…</div>`;
    if (item.size > MAX_FILE_BYTES) {
      body.innerHTML = '<div class="code-empty-state">This file is too large for browser preview. Open it directly on GitHub instead.</div>';
      return;
    }
    try {
      const text = await fetchFileText(state, item);
      if (!isCurrent(state)) return;
      body.innerHTML = `<div class="code-line-wrap">${highlightWithLineNumbers(text, languageFor(item.path))}</div>`;
      body.querySelector('.code-copy')?.addEventListener('click', () => copyText(text, body.querySelector('.code-copy')));
    } catch (error) {
      if (isCurrent(state)) body.innerHTML = `<div class="code-empty-state">${escapeHtml(error.message || 'File preview failed.')}</div>`;
    }
  }

  async function loadAll(state) {
    if (!isCurrent(state)) return;
    const button = state.panel.querySelector('.code-load-all');
    button.disabled = true;
    button.textContent = 'Loading…';
    let total = 0;
    let loaded = 0;
    try {
      for (const item of state.tree) {
        if (!isCurrent(state)) return;
        if (item.size > MAX_FILE_BYTES) continue;
        total += item.size || 0;
        if (total > MAX_ALL_CODE_BYTES) break;
        try { await fetchFileText(state, item); loaded += 1; button.textContent = `Loaded ${loaded}`; } catch {}
      }
      if (isCurrent(state)) button.textContent = `Loaded ${loaded}`;
    } finally {
      if (isCurrent(state)) {
        button.disabled = false;
        window.setTimeout(() => { if (isCurrent(state)) button.textContent = 'Load all code'; }, 1400);
      }
    }
  }

  async function fetchFileText(state, item) {
    const cacheKey = `${state.repo.owner}/${state.repo.repo}@${state.repo.branch}:${item.path}`;
    if (state.fileCache.has(cacheKey)) return state.fileCache.get(cacheKey);
    const url = `${API_BASE}/repo/${encodeURIComponent(state.repo.owner)}/${encodeURIComponent(state.repo.repo)}/file/${item.path.split('/').map(encodeURIComponent).join('/')}?branch=${encodeURIComponent(state.repo.branch)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Preview failed (${response.status}).`);
    const text = typeof payload.text === 'string' ? payload.text : '';
    state.fileCache.set(cacheKey, text);
    return text;
  }

  function highlightWithLineNumbers(text, language) {
    return text.replace(/\r\n?/g,'\n').split('\n').map((line,index) => `<div class="code-line"><span class="code-ln">${index+1}</span><span class="code-src">${highlightLine(line,language) || ' '}</span></div>`).join('') + '<div class="code-copybar"><button type="button" class="code-copy">Copy file</button></div>';
  }

  function highlightLine(line, language) {
    const escaped = escapeHtml(line);
    if (language === 'json') return colorize(escaped, [/(\"(?:[^\"\\]|\\.)*\")(?=\s*:)/g,'string',/(\"(?:[^\"\\]|\\.)*\")/g,'string',/\b(?:true|false|null)\b/g,'keyword',/-?\b\d+(?:\.\d+)?\b/g,'number']);
    if (language === 'html' || language === 'xml') return colorize(escaped,[/&lt;\/?[A-Za-z][^&]*?&gt;/g,'tag',/&lt;!--.*?--&gt;/g,'comment']);
    if (language === 'css') return colorize(escaped,[/\/\/.*$/g,'comment',/#[0-9a-fA-F]{3,8}\b/g,'number',/\b(?:margin|padding|display|position|color|background|font-size|width|height)\b/g,'property']);
    if (language === 'markdown') return colorize(escaped,[/^\s{0,3}#{1,6}.*$/g,'heading',/\*\*[^*]+\*\*|__[^_]+__/g,'strong',/`[^`]+`/g,'string']);
    if (language === 'ini') return colorize(escaped,[/^\s*[#;].*$/g,'comment',/^\s*\[[^\]]+\]/g,'section',/^\s*[A-Za-z0-9_.-]+(?=\s*=)/g,'property']);
    return colorize(escaped,[/\/\/.*$/g,'comment',/#.*$/g,'comment',/\/\*.*?\*\//g,'comment',/\b(?:const|let|var|function|return|if|else|for|while|class|public|private|protected|using|namespace|new|this|async|await|import|from|export|extends|static|void|int|float|string|bool|true|false|null|undefined|def|try|catch|throw|switch|case|break|continue)\b/g,'keyword',/\b\d+(?:\.\d+)?\b/g,'number',/'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"|`(?:[^`\\]|\\.)*`/g,'string']);
  }

  function colorize(text, rules) {
    let output = text; const placeholders = [];
    for (let i=0;i<rules.length;i+=2) output = output.replace(rules[i], match => { const token=`\u0000${placeholders.length}\u0000`; placeholders.push(`<span class="tok-${rules[i+1]}">${match}</span>`); return token; });
    placeholders.forEach((html,index) => { output = output.replaceAll(`\u0000${index}\u0000`,html); });
    return output;
  }

  function languageFor(path) { return LANGUAGE_MAP[path.split('.').pop()?.toLowerCase() || ''] || 'text'; }
  function languageLabel(path) { const v=languageFor(path); return v==='text' ? 'Text' : v.charAt(0).toUpperCase()+v.slice(1); }
  function isGenerated(path) { return path.toLowerCase().split('/').some(part => ['node_modules','.git','dist','build','bin','obj'].includes(part)); }
  function formatBytes(bytes) { if (!Number.isFinite(bytes)||bytes<1024) return `${Math.max(0,Math.round(bytes||0))} B`; const units=['KB','MB','GB']; let value=bytes/1024,index=0; while(value>=1024&&index<units.length-1){value/=1024;index++;} return `${value.toFixed(value>=10?0:1)} ${units[index]}`; }
  function escapeHtml(value) { return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  async function copyText(text,button){ try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1200);}catch{button.textContent='Copy failed';} }

  function installStyles(){
    if(document.getElementById('bbfraxy-code-preview-styles')) return;
    const style=document.createElement('style'); style.id='bbfraxy-code-preview-styles';
    style.textContent=`
      .code-workspace-panel{display:grid;gap:12px;border:1px solid var(--border);border-radius:var(--radius);background:linear-gradient(180deg,rgba(255,255,255,.04),transparent 52%),var(--surface);box-shadow:0 16px 50px var(--shadow);backdrop-filter:blur(18px);padding:22px}
      .code-workspace-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.code-workspace-head h3{margin:0;color:var(--text);font-size:1.05rem}.code-workspace-sub{margin:6px 0 0;color:var(--muted);font-size:.76rem;line-height:1.55}.code-workspace-actions{display:flex;gap:8px}.code-action{min-height:32px;border:1px solid var(--border);border-radius:8px;padding:0 10px;background:rgba(255,255,255,.025);color:var(--muted);font:inherit;font-size:.66rem;cursor:pointer}.code-action:hover:not(:disabled){border-color:var(--border-strong);color:var(--text)}.code-action:disabled{opacity:.55;cursor:wait}
      .code-workspace-toolbar{display:flex;align-items:center;gap:10px}.code-search{min-width:0;flex:1;height:34px;border:1px solid var(--border);border-radius:8px;padding:0 10px;background:rgba(255,255,255,.025);color:var(--text);outline:none;font:inherit;font-size:.7rem}.code-search:focus{border-color:var(--border-strong);box-shadow:0 0 16px var(--glow)}.code-count{color:var(--faint);font-size:.65rem;white-space:nowrap}
      .code-workspace{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:480px;border:1px solid rgba(255,255,255,.07);border-radius:calc(var(--radius) - 3px);overflow:hidden;background:#05080a}.code-sidebar{min-width:0;max-height:620px;overflow:auto;border-right:1px solid rgba(255,255,255,.07);padding:8px}.code-folder{border-radius:8px}.code-folder-row{display:flex;align-items:center;gap:7px;padding:7px 8px;color:var(--muted);cursor:pointer;list-style:none;font-size:.68rem}.code-folder-row::-webkit-details-marker{display:none}.code-folder-row:hover{background:rgba(95,231,255,.04);color:var(--text)}.code-folder-chevron{transition:transform 140ms ease}.code-folder[open] .code-folder-chevron{transform:rotate(90deg)}.code-folder-count,.code-file-lang{margin-left:auto;color:var(--faint);font-size:.56rem}.code-folder-files{display:grid;gap:2px;padding:0 0 10px 5px;border-left:1px solid rgba(255,255,255,.07);margin-left:10px}.code-file-row{display:flex;align-items:center;gap:7px;min-width:0;width:100%;border:1px solid transparent;border-radius:7px;padding:7px 8px;background:transparent;color:var(--muted);font:inherit;font-size:.64rem;text-align:left;cursor:pointer}.code-file-row:hover{border-color:var(--border);background:rgba(95,231,255,.04);color:var(--text)}.code-file-icon{color:var(--accent)}.code-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .code-editor{min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr)}.code-editor-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.07)}.code-editor-title{min-width:0;overflow:hidden;color:var(--text);font-size:.68rem;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.code-editor-meta{color:var(--faint);font-size:.6rem;white-space:nowrap}.code-editor-body{min-width:0;overflow:auto}.code-line-wrap{min-width:max-content;padding-bottom:30px}.code-line{display:grid;grid-template-columns:52px max-content;min-width:100%;font:12px/1.65 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;tab-size:2}.code-ln{position:sticky;left:0;padding:0 10px;color:#4e5b65;text-align:right;background:#05080a;user-select:none}.code-src{padding-right:22px;color:#d8e4e8}.tok-comment{color:#64737d}.tok-string{color:#88d9f0}.tok-keyword{color:#d79bff}.tok-number{color:#efc96d}.tok-tag{color:#78d7a3}.tok-property{color:#79c8ff}.tok-heading{color:#82e1ff}.tok-strong{color:#f4f7f8}.tok-section{color:#d79bff}.code-copybar{position:sticky;left:0;display:flex;justify-content:flex-end;padding:8px 12px;border-top:1px solid rgba(255,255,255,.07);background:#05080a}.code-copy{border:1px solid var(--border);border-radius:8px;padding:5px 9px;background:rgba(255,255,255,.025);color:var(--muted);font:inherit;font-size:.62rem;cursor:pointer}.code-copy:hover{color:var(--text)}.code-empty-state,.code-sidebar-empty{padding:28px 14px;color:var(--faint);text-align:center;font-size:.7rem}.code-workspace-note{margin:0;color:var(--faint);font-size:.66rem;line-height:1.5}
      @media(max-width:860px){.code-workspace{grid-template-columns:1fr}.code-sidebar{max-height:260px;border-right:0;border-bottom:1px solid rgba(255,255,255,.07)}}@media(max-width:640px){.code-workspace-head{flex-direction:column}.code-workspace-actions{width:100%}.code-action{flex:1}}
    `;
    document.head.append(style);
  }
})();
