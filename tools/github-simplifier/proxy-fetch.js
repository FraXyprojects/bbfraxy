// Compatibility loader for the standalone code-preview module.
// The analyzer itself talks directly to the BBFRAXY Cloudflare Worker.
// This file no longer intercepts window.fetch; it only applies a small
// compatibility stylesheet for the legacy Simplifier header markup.
(() => {
  const load = () => {
    if (!document.getElementById('bbfraxy-simplifier-header-fix')) {
      const style = document.createElement('style');
      style.id = 'bbfraxy-simplifier-header-fix';
      style.textContent = `
        .site-header-inner {
          display: flex;
          width: min(100%, 980px);
          min-height: 58px;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: color-mix(in srgb, var(--surface) 86%, transparent);
          box-shadow: 0 18px 50px var(--shadow), 0 0 36px rgba(95, 231, 255, 0.06);
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
        }
        .site-menu {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 16px;
        }
        .site-menu > a {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          border-radius: var(--radius);
          padding: 0 13px;
          color: var(--muted);
          font-size: .93rem;
          transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease;
        }
        .site-menu > a:hover,
        .site-menu > a:focus-visible {
          color: var(--text);
          background: rgba(95, 231, 255, .08);
          box-shadow: 0 0 18px rgba(95, 231, 255, .08);
        }
        .site-menu-divider { display: none; }
        .site-menu-socials,
        .site-menu-socials#social-links {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .site-menu-socials .social-link,
        #social-links .social-link {
          width: 42px;
          height: 42px;
          margin: 0;
        }
        .site-menu .theme-toggle {
          display: inline-grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border: 1px solid transparent;
          border-radius: var(--radius);
          color: var(--muted);
          background: transparent;
          cursor: pointer;
        }
        .site-menu .theme-toggle:hover,
        .site-menu .theme-toggle:focus-visible {
          color: var(--accent-strong);
          border-color: var(--border-strong);
          background: rgba(95, 231, 255, .08);
          box-shadow: 0 0 22px var(--glow);
        }
        @media (max-width: 760px) {
          .site-header-inner { width: min(100%, 980px); }
          .site-menu {
            display: none;
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            left: 0;
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
            padding: 10px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--surface-strong);
            box-shadow: 0 18px 50px var(--shadow);
            -webkit-backdrop-filter: blur(18px);
            backdrop-filter: blur(18px);
          }
          .site-menu.is-open { display: flex; }
          .site-menu > a { justify-content: flex-start; }
          .site-menu-socials { justify-content: flex-start; }
        }
      `;
      document.head.append(style);
    }

    const menuToggle = document.querySelector('.menu-toggle');
    const siteMenu = document.querySelector('.site-menu');
    if (menuToggle && siteMenu && !menuToggle.dataset.headerFixBound) {
      menuToggle.dataset.headerFixBound = 'true';
      menuToggle.addEventListener('click', () => {
        const open = menuToggle.getAttribute('aria-expanded') === 'true';
        menuToggle.setAttribute('aria-expanded', String(!open));
        siteMenu.classList.toggle('is-open', !open);
      });
    }

    if (!document.querySelector('script[data-bbfraxy-file-analysis-bridge]')) {
      const script = document.createElement('script');
      script.src = './file-analysis-bridge.js';
      script.defer = true;
      script.dataset.bbfraxyFileAnalysisBridge = 'true';
      document.head.append(script);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();
