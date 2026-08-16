// File Preview Summary
// Intentionally scoped to an already-open file preview.
// It does not intercept submit/fetch, observe the DOM, or pre-scan repository files.
(() => {
  const SUMMARY_ID = "file-content-summary";
  const BOUND = "data-file-summary-bound";
  const STYLE_ID = "file-summary-styles";

  const boot = () => {
    installStyles();
    if (document.documentElement.dataset[BOUND]) return;
    document.documentElement.dataset[BOUND] = "true";

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target?.closest(".file-row, .important-file");
      if (!trigger) return;

      window.setTimeout(() => {
        const panel = document.querySelector("#file-preview-panel");
        if (!panel || panel.hidden) return;
        renderSummary(panel);
      }, 80);
    }, true);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function renderSummary(panel) {
    const preview = panel.querySelector("#code-preview");
    const title = panel.querySelector("#preview-title");
    if (!preview || !title) return;

    document.getElementById(SUMMARY_ID)?.remove();

    const filePath = title.textContent?.trim() || "Selected file";
    const code = preview.querySelector("pre code")?.textContent || "";
    const summary = buildSummary(filePath, code);

    const card = document.createElement("section");
    card.id = SUMMARY_ID;
    card.className = "file-summary-card";
    card.innerHTML = `
      <div class="file-summary-heading">
        <div>
          <span class="analysis-label">File analysis</span>
          <h4>What does this file do?</h4>
        </div>
        <span class="file-summary-type">${escapeHtml(summary.type)}</span>
      </div>
      <p class="file-summary-text">${escapeHtml(summary.description)}</p>
      ${summary.details.length ? `<div class="file-summary-details">${summary.details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}</div>` : ""}
    `;

    const editability = panel.querySelector("#editability-card");
    if (editability) editability.insertAdjacentElement("afterend", card);
    else preview.insertAdjacentElement("beforebegin", card);
  }

  function buildSummary(path, code) {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    const ext = base.includes(".") ? base.split(".").pop() : "";
    const content = code.slice(0, 90000);
    const details = [];

    if (/\.(png|jpe?g|gif|webp|bmp|ico|svg)$/.test(base)) {
      return {
        type: "Image / asset",
        description: "This is a binary or media asset rather than source code, so there is no code behavior to summarize.",
        details: ["Preview is not treated as executable code", "Usually safe to replace only when the project expects the same asset path and format"],
      };
    }

    if (/^readme(?:\.|$)/i.test(base)) {
      return {
        type: "Documentation",
        description: "Project documentation. It typically explains the purpose, setup, usage, configuration, and other information intended for people working with the repository.",
        details: extractSignals(content, [/installation|setup/i, /usage|how to|getting started/i, /config|configuration/i]),
      };
    }

    if (base === "package.json") {
      const deps = countObjectKeys(content, /"(dependencies|devDependencies|scripts)"\s*:\s*\{([\s\S]*?)\}/i);
      return {
        type: "Node project manifest",
        description: "Defines the JavaScript project's metadata, dependencies, and runnable scripts. Changes here can affect how the project is installed or started.",
        details: deps ? [`Detected ${deps} package/config entries`] : [],
      };
    }

    if (/\.csproj$/.test(base)) {
      const target = matchFirst(content, /<TargetFrameworks?>\s*([^<]+)\s*<\/TargetFrameworks?>/i);
      const packageRefs = (content.match(/<PackageReference\b/gi) || []).length;
      if (target) details.push(`Target framework: ${target.trim()}`);
      if (packageRefs) details.push(`${packageRefs} package references`);
      return {
        type: "C# project configuration",
        description: "Project configuration used to define how the C# project is built, which framework it targets, and which packages or build settings it uses.",
        details,
      };
    }

    if (/\.(json|ya?ml|toml|ini|cfg)$/.test(base)) {
      const keys = extractTopLevelKeys(content).slice(0, 5);
      if (keys.length) details.push(`Key settings: ${keys.join(", ")}`);
      return {
        type: "Configuration / structured data",
        description: "Structured data or configuration. These files often control project behavior, settings, metadata, or user-facing options without changing the main program logic.",
        details,
      };
    }

    if (/\.css$|\.scss$|\.less$/.test(base)) {
      const selectors = (content.match(/[^{}]+\{/g) || []).length;
      const media = (content.match(/@media\b/gi) || []).length;
      if (selectors) details.push(`${selectors} style blocks detected`);
      if (media) details.push(`${media} responsive media rules`);
      return {
        type: "Stylesheet",
        description: "Controls the visual presentation of the interface, including layout, spacing, typography, colors, and responsive behavior.",
        details,
      };
    }

    if (/\.html?$/.test(base)) {
      const scripts = (content.match(/<script\b/gi) || []).length;
      const links = (content.match(/<link\b/gi) || []).length;
      const forms = (content.match(/<form\b/gi) || []).length;
      if (scripts) details.push(`${scripts} script tag${scripts === 1 ? "" : "s"}`);
      if (links) details.push(`${links} linked resource${links === 1 ? "" : "s"}`);
      if (forms) details.push(`${forms} form${forms === 1 ? "" : "s"}`);
      return {
        type: "HTML page",
        description: "Defines the page structure and user-facing markup. It determines which interface elements exist and which styles or scripts are loaded.",
        details,
      };
    }

    if (/\.(cs|java|kt|cpp|c|h|hpp|rs|go)$/.test(base)) {
      const classes = countPattern(content, /\b(class|interface|struct)\s+[A-Za-z_][A-Za-z0-9_]*/g);
      const methods = countMethodLike(content, ext);
      const signals = [];
      if (/BepInEx/i.test(content) || /BepInPlugin/i.test(content)) signals.push("BepInEx plugin code");
      if (/Harmony(Lib|Patch)/i.test(content)) signals.push("Harmony patching");
      if (/MonoBehaviour/i.test(content)) signals.push("Unity component");
      if (classes) signals.push(`${classes} class/interface/struct declaration${classes === 1 ? "" : "s"}`);
      if (methods) signals.push(`${methods} method-like declaration${methods === 1 ? "" : "s"}`);
      return {
        type: "Compiled-language source",
        description: describeSourceFile(content, ext),
        details: signals.slice(0, 5),
      };
    }

    if (/\.(js|mjs|cjs|ts|tsx|jsx|py)$/.test(base)) {
      const imports = countPattern(content, /\b(import|require\(|from\s+)[^\n;]*/g);
      const funcs = countPattern(content, /\b(function\s+\w+|def\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g);
      if (imports) details.push(`${imports} import/dependency statement${imports === 1 ? "" : "s"}`);
      if (funcs) details.push(`${funcs} function-like declaration${funcs === 1 ? "" : "s"}`);
      if (/fetch\s*\(|axios\.|XMLHttpRequest/i.test(content)) details.push("Network requests");
      if (/addEventListener\s*\(|querySelector\s*\(/i.test(content)) details.push("Browser/UI interaction");
      if (/localStorage|sessionStorage/i.test(content)) details.push("Client-side storage");
      return {
        type: ext === "py" ? "Python source" : "JavaScript / TypeScript source",
        description: describeScriptFile(content, ext),
        details: details.slice(0, 5),
      };
    }

    return {
      type: ext ? `${ext.toUpperCase()} file` : "Project file",
      description: "A repository file whose exact role is best determined from its path and source content. The preview below shows the original file so you can inspect its behavior directly.",
      details: [],
    };
  }

  function describeSourceFile(content, ext) {
    if (/BepInPlugin|BepInEx/i.test(content)) return "Contains runtime logic for a plugin or mod. It connects project code to the host application's plugin/runtime API and usually controls the mod's behavior.";
    if (/HarmonyPatch|HarmonyPrefix|HarmonyPostfix/i.test(content)) return "Contains runtime patching logic that changes or extends existing application behavior through method patches.";
    if (/Main\s*\(|static\s+void\s+Main|Program\b/i.test(content)) return "Contains application-level execution logic or an entry point that coordinates the program's startup behavior.";
    if (/Controller|Service|Manager/i.test(content)) return "Contains reusable application logic, coordinating behavior between other parts of the project rather than primarily defining the user interface.";
    return `Contains ${ext === "cs" ? "C#" : ext.toUpperCase()} source code that implements part of the project's runtime or application behavior.`;
  }

  function describeScriptFile(content, ext) {
    if (/addEventListener|querySelector|document\.|window\./i.test(content)) return "Contains browser-side logic for the interface, handling user interactions, page state, navigation, or dynamic content.";
    if (/fetch\s*\(|axios\.|XMLHttpRequest/i.test(content)) return "Contains application logic that communicates with external or internal APIs and processes returned data.";
    if (/express\(|fastify|koa|hono/i.test(content)) return "Contains server-side web logic, including request handling or API routes.";
    if (/export\s+default|module\.exports|export\s+\{/i.test(content)) return `Contains reusable ${ext === "py" ? "Python" : "JavaScript/TypeScript"} module logic that is imported by other parts of the project.`;
    return `Contains ${ext === "py" ? "Python" : "JavaScript/TypeScript"} logic implementing part of the project's behavior.`;
  }

  function extractSignals(content, patterns) {
    return patterns.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source.includes("install") ? "Installation/setup guidance" : pattern.source.includes("usage") ? "Usage guidance" : "Configuration guidance");
  }

  function extractTopLevelKeys(content) {
    const keys = [];
    const pattern = /^\s*["']([^"']+)["']\s*:/gm;
    let match;
    while ((match = pattern.exec(content)) && keys.length < 8) keys.push(match[1]);
    return [...new Set(keys)];
  }

  function countObjectKeys(content, pattern) {
    const match = content.match(pattern);
    if (!match) return 0;
    return (match[2].match(/"[^"\n]+"\s*:/g) || []).length;
  }

  function countPattern(content, pattern) {
    return (content.match(pattern) || []).length;
  }

  function countMethodLike(content, ext) {
    if (ext === "cs" || ext === "java" || ext === "kt") return countPattern(content, /\b(?:public|private|protected|internal|static|override|async|virtual|sealed|abstract)?\s*(?:[A-Za-z_][\w<>\[\],.?]*\s+)+[A-Za-z_][\w]*\s*\([^;{}]*\)\s*(?:\{|=>)/g);
    return countPattern(content, /\b[A-Za-z_][\w]*\s*\([^;{}]*\)\s*(?:\{|=>)/g);
  }

  function matchFirst(content, pattern) {
    const match = content.match(pattern);
    return match?.[1] || "";
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .file-summary-card {
        margin: 0 0 14px;
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) - 3px);
        padding: 15px 16px;
        background: linear-gradient(180deg, rgba(95,231,255,.045), rgba(255,255,255,.018)), var(--surface);
      }
      .file-summary-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
      }
      .file-summary-heading h4 { margin: 0; color: var(--text); font-size: .92rem; }
      .file-summary-type {
        flex: 0 0 auto;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 4px 8px;
        color: var(--muted);
        background: rgba(255,255,255,.025);
        font-size: .63rem;
      }
      .file-summary-text { margin: 9px 0 0; color: var(--muted); font-size: .78rem; line-height: 1.6; }
      .file-summary-details { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
      .file-summary-details span { border: 1px solid var(--border); border-radius: 999px; padding: 4px 7px; color: var(--faint); background: rgba(255,255,255,.018); font-size: .62rem; }
    `;
    document.head.append(style);
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
})();
