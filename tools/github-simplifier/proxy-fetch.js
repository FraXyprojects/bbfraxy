// Compatibility loader for the standalone code-preview module.
// The analyzer itself talks directly to the BBFRAXY Cloudflare Worker.
// This file only loads the code preview enhancer after the page is ready;
// it does not intercept window.fetch or observe the DOM continuously.
(() => {
  const load = () => {
    if (document.querySelector('script[data-bbfraxy-code-preview]')) return;
    const script = document.createElement('script');
    script.src = './code-preview.js';
    script.defer = true;
    script.dataset.bbfraxyCodePreview = 'true';
    document.head.append(script);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();
