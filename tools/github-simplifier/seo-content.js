(() => {
  const PAGE_PATH = "/tools/github-simplifier/";
  const CONTENT_ID = "simplifier-seo-content";
  const STYLE_ID = "simplifier-seo-styles";

  const boot = () => {
    if (window.location.pathname !== PAGE_PATH || document.getElementById(CONTENT_ID)) return;

    installStyles();

    const card = document.querySelector(".simplifier-card");
    if (!card) return;

    const section = document.createElement("section");
    section.id = CONTENT_ID;
    section.className = "simplifier-seo-content";
    section.innerHTML = `
      <div class="simplifier-info-card">
        <div class="simplifier-info-kicker">ABOUT THE TOOL</div>
        <h2>Understand a GitHub repository without digging through the whole codebase.</h2>
        <p>GitHub Simplifier turns a public GitHub repository into a clearer, easier-to-read overview. Instead of opening dozens of files one by one, you can start with the repository structure, see which files are likely important, and inspect individual files with context about what they do.</p>
      </div>

      <div class="simplifier-info-grid">
        <article class="simplifier-info-card">
          <span class="simplifier-info-icon" aria-hidden="true">01</span>
          <h2>See the project structure</h2>
          <p>Get a compact repository map with folders, files, detected technologies and basic project type information.</p>
        </article>
        <article class="simplifier-info-card">
          <span class="simplifier-info-icon" aria-hidden="true">02</span>
          <h2>Find the files that matter</h2>
          <p>Important files such as manifests, configuration files, entry points and documentation are highlighted so you can navigate the project faster.</p>
        </article>
        <article class="simplifier-info-card">
          <span class="simplifier-info-icon" aria-hidden="true">03</span>
          <h2>Understand individual files</h2>
          <p>Open a file to see its source and a concise explanation of its likely purpose, detected signals and editing considerations.</p>
        </article>
        <article class="simplifier-info-card">
          <span class="simplifier-info-icon" aria-hidden="true">04</span>
          <h2>Use Safe to edit as a guide</h2>
          <p>Files receive a heuristic editability label such as Likely safe, Caution, Core or Asset. These labels are guidance, not guarantees.</p>
        </article>
      </div>

      <div class="simplifier-info-card simplifier-howto">
        <div class="simplifier-info-kicker">HOW IT WORKS</div>
        <h2>From GitHub URL to a useful overview.</h2>
        <div class="simplifier-steps">
          <div><b>1. Paste a repository URL</b><span>Use a public GitHub repository such as github.com/FraXyprojects/bbfraxy.</span></div>
          <div><b>2. Choose a repository</b><span>You can also enter a GitHub user URL and choose one of their public repositories.</span></div>
          <div><b>3. Explore the analysis</b><span>Review the project summary, repository map and the files worth knowing.</span></div>
          <div><b>4. Open the files you care about</b><span>File Preview provides the source, edit-safety guidance and a focused explanation of the file.</span></div>
        </div>
      </div>

      <div class="simplifier-info-card">
        <div class="simplifier-info-kicker">FAQ</div>
        <h2>Frequently asked questions</h2>
        <div class="simplifier-faq">
          <details>
            <summary>What is GitHub Simplifier?</summary>
            <p>GitHub Simplifier is a repository analyzer that helps you understand how a public GitHub project is structured, what its important files do, and where configuration or other editable parts are likely to be found.</p>
          </details>
          <details>
            <summary>Can GitHub Simplifier analyze private repositories?</summary>
            <p>Not currently. The public version of GitHub Simplifier is designed for public GitHub repositories and public repositories belonging to a GitHub user.</p>
          </details>
          <details>
            <summary>Does GitHub Simplifier modify my repository?</summary>
            <p>No. The Simplifier is read-only. It does not commit changes, edit files or push anything back to GitHub.</p>
          </details>
          <details>
            <summary>Does GitHub Simplifier run the repository's code?</summary>
            <p>Not in the current analyzer workflow. It reads public repository metadata, the source tree, documentation and selected file contents. The analysis is intended to help you understand the project before you decide what to do with it.</p>
          </details>
          <details>
            <summary>What does “Safe to edit” mean?</summary>
            <p>It is a heuristic indicator based on the file path, filename and file type. Configuration and documentation are often marked as more likely to be safe, while source code, build files and generated content receive more cautious labels. Always check the project's own documentation before editing.</p>
          </details>
          <details>
            <summary>What happens if I enter a GitHub user instead of a repository?</summary>
            <p>GitHub Simplifier can list the user's public repositories and let you choose which one to analyze. If a repository name is invalid but the GitHub user exists, the tool can also offer the user's public repositories as alternatives.</p>
          </details>
          <details>
            <summary>Does GitHub Simplifier use the GitHub API directly from my browser?</summary>
            <p>The browser talks to BBFRAXY's GitHub Simplifier service, which handles the public GitHub requests used by the analyzer. This keeps the repository analysis flow behind the BBFRAXY tool instead of relying on unauthenticated browser calls to GitHub for every step.</p>
          </details>
        </div>
      </div>
    `;

    card.after(section);
    installFaqStructuredData();
  };

  function installFaqStructuredData() {
    if (document.getElementById("simplifier-faq-schema")) return;

    const entities = [
      ["What is GitHub Simplifier?", "GitHub Simplifier is a repository analyzer that helps you understand how a public GitHub project is structured, what its important files do, and where configuration or other editable parts are likely to be found."],
      ["Can GitHub Simplifier analyze private repositories?", "Not currently. The public version of GitHub Simplifier is designed for public GitHub repositories and public repositories belonging to a GitHub user."],
      ["Does GitHub Simplifier modify my repository?", "No. The Simplifier is read-only. It does not commit changes, edit files or push anything back to GitHub."],
      ["Does GitHub Simplifier run the repository's code?", "Not in the current analyzer workflow. It reads public repository metadata, the source tree, documentation and selected file contents."],
      ["What does Safe to edit mean?", "It is a heuristic indicator based on the file path, filename and file type. It is guidance rather than a guarantee."],
      ["What happens if I enter a GitHub user instead of a repository?", "GitHub Simplifier can list the user's public repositories and let you choose which one to analyze."],
      ["Does GitHub Simplifier use the GitHub API directly from my browser?", "The browser talks to BBFRAXY's GitHub Simplifier service, which handles the public GitHub requests used by the analyzer."]
    ];

    const script = document.createElement("script");
    script.id = "simplifier-faq-schema";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: entities.map(([name, answer]) => ({
        "@type": "Question",
        name,
        acceptedAnswer: { "@type": "Answer", text: answer }
      }))
    });
    document.head.append(script);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .simplifier-seo-content { width: min(100%, 900px); margin: 18px auto 0; display: grid; gap: 14px; }
      .simplifier-info-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; background: linear-gradient(180deg, rgba(255,255,255,.035), transparent 52%), var(--surface); box-shadow: 0 16px 50px var(--shadow); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
      .simplifier-info-card h2 { margin: 0; color: var(--text); font-size: 1.25rem; line-height: 1.25; letter-spacing: -.02em; }
      .simplifier-info-card > p { margin: 10px 0 0; color: var(--muted); font-size: .9rem; line-height: 1.7; }
      .simplifier-info-kicker { margin: 0 0 8px; color: var(--faint); font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      .simplifier-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .simplifier-info-grid .simplifier-info-card { min-height: 170px; }
      .simplifier-info-icon { display: inline-flex; min-width: 32px; min-height: 24px; align-items: center; justify-content: center; margin-bottom: 14px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent-strong); background: rgba(95,231,255,.05); font-size: .62rem; font-weight: 800; }
      .simplifier-info-grid p { margin: 9px 0 0; color: var(--muted); font-size: .82rem; line-height: 1.6; }
      .simplifier-howto { overflow: hidden; }
      .simplifier-steps { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin-top: 18px; }
      .simplifier-steps > div { display: grid; gap: 5px; padding: 13px 14px; border: 1px solid var(--border); border-radius: calc(var(--radius) - 3px); background: rgba(255,255,255,.02); }
      .simplifier-steps b { color: var(--text); font-size: .78rem; }
      .simplifier-steps span { color: var(--faint); font-size: .72rem; line-height: 1.5; }
      .simplifier-faq { display: grid; gap: 8px; margin-top: 16px; }
      .simplifier-faq details { border: 1px solid var(--border); border-radius: calc(var(--radius) - 3px); background: rgba(255,255,255,.02); overflow: hidden; }
      .simplifier-faq summary { list-style: none; cursor: pointer; padding: 14px 16px; color: var(--text); font-size: .82rem; font-weight: 700; }
      .simplifier-faq summary::-webkit-details-marker { display: none; }
      .simplifier-faq summary::after { float: right; color: var(--faint); content: "+"; font-weight: 500; }
      .simplifier-faq details[open] summary::after { content: "−"; }
      .simplifier-faq details p { margin: 0; padding: 0 16px 15px; color: var(--muted); font-size: .78rem; line-height: 1.65; }
      @media (max-width: 720px) {
        .simplifier-info-grid, .simplifier-steps { grid-template-columns: 1fr; }
        .simplifier-info-card { padding: 20px; }
      }
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
