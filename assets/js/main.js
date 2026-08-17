const socialLinks = [
  {
    label: "Discord",
    url: "https://discord.com/users/667728965615484947",
    icon: "discord",
  },
  {
    label: "GitHub",
    url: "https://github.com/FraXyprojects",
    icon: "github",
  },
  {
    label: "Steam",
    url: "https://steamcommunity.com/id/fraxyk/",
    icon: "steam",
  },
  {
    label: "YouTube",
    url: "https://www.youtube.com/@fraxy01",
    icon: "youtube",
  },
  {
    label: "Spotify",
    url: "https://open.spotify.com/user/fraxycz",
    icon: "spotify",
  },
  {
    label: "Instagram",
    url: "https://www.instagram.com/fraxycz",
    icon: "instagram",
  },
];

const icons = {
  discord:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.8 5.2A15.6 15.6 0 0 0 15 4l-.4.8a14 14 0 0 1 3.3 1.4 11.1 11.1 0 0 0-9.8 0 14 14 0 0 1 3.3-1.4L11 4a15.6 15.6 0 0 0-3.8 1.2c-2.4 3.5-3 6.9-2.7 10.2a15.5 15.5 0 0 0 4.7 2.4l.9-1.5c-.5-.2-1-.5-1.4-.8l.3-.2a11.9 11.9 0 0 0 6 0l.3.2c-.5.3-.9.6-1.4.8l.9 1.5a15.5 15.5 0 0 0 4.7-2.4c.4-3.8-.7-7.1-2.7-10.2ZM9.4 13.4c-.8 0-1.4-.7-1.4-1.6 0-.9.6-1.6 1.4-1.6.8 0 1.4.7 1.4 1.6 0 .9-.6 1.6-1.4 1.6Zm5.2 0c-.8 0-1.4-.7-1.4-1.6 0-.9.6-1.6 1.4-1.6.8 0 1.4.7 1.4 1.6 0 .9-.6 1.6-1.4 1.6Z"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6-.1.8-.4.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1.6 2.5 3.3 1.8.1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.6 0-1.2.4-2.2 1.2-3-.1-.3-.5-1.5-.1-3 0 0 1-.3 3.1 1.2a10.7 10.7 0 0 1 5.6 0c2.1-1.5 3.1-1.2 3.1-1.2.6 1.5.2 2.7.1 3 .7.8 1.2 1.8 1.2 3 0 4.4-2.7 5.3-5.3 5.6.4.3.8 1 .8 2.1v3.1c0 .4.2.7.8.6A11.3 11.3 0 0 0 12 .7Z"/></svg>',
  steam:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-9.9 8.8l5.3 2.2a3.1 3.1 0 0 1 1.8-.6l2.4-3.4V9a3.8 3.8 0 1 1 3.8 3.8h-.1l-3.4 2.4a3.1 3.1 0 0 1-6 1.2l-3.8-1.6A10 10 0 1 0 12 2Zm-3.5 15.3-1.7-.7a2.3 2.3 0 0 0 4.5-.6 2.3 2.3 0 0 0-3.1-2.1l1.8.8a1.7 1.7 0 0 1-1.5 3.1Zm6.9-6.2a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Zm0-.8a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 7.1a2.8 2.8 0 0 0-2-2C17.7 4.7 12 4.7 12 4.7s-5.7 0-7.4.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.2 12c0 1.7.1 3.4.4 4.9a2.8 2.8 0 0 0 2 2c1.7.4 7.4.4 7.4.4s5.7 0 7.4-.4a2.8 2.8 0 0 0 2-2c.3-1.5.4-3.2.4-4.9s-.1-3.4-.4-4.9ZM10 15.1V8.9l5.3 3.1L10 15.1Z"/></svg>',
  spotify:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.57 14.42a.77.77 0 0 1-1.06.26 9.13 9.13 0 0 0-9.15-.51.77.77 0 1 1-.73-1.36 10.67 10.67 0 0 1 10.68.59.77.77 0 0 1 .26 1.02Zm1.5-2.66a.96.96 0 0 1-1.32.32 11.6 11.6 0 0 0-11.54-.62.96.96 0 1 1-.9-1.7 13.5 13.5 0 0 1 13.44.73.96.96 0 0 1 .32 1.27Zm.13-2.76a1.15 1.15 0 0 1-1.58.39A14.17 14.17 0 0 0 5.22 10.3a1.15 1.15 0 1 1-.72-2.18 16.45 16.45 0 0 1 12.99 1.1 1.15 1.15 0 0 1 .71 1.78Z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm-.1 1.8A3.3 3.3 0 0 0 3.8 7.1v9.8a3.3 3.3 0 0 0 3.3 3.3h9.8a3.3 3.3 0 0 0 3.3-3.3V7.1a3.3 3.3 0 0 0-3.3-3.3H7.1Zm9.9 1.35a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z"/></svg>',
};

const root = document.documentElement;
const favicon = document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/svg+xml";
favicon.href = "/assets/favicon.svg";
document.head.append(favicon);

const brandStyle = document.createElement("style");
brandStyle.textContent = `.brand-mark{font-size:0}.brand-mark::before{content:"F";font-size:1rem;font-weight:850;line-height:1}`;
document.head.append(brandStyle);

const themeToggle = document.querySelector(".theme-toggle");
const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector("#site-menu");
const socialContainer = document.querySelector("#social-links");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersLight = window.matchMedia("(prefers-color-scheme: light)");
const themeStorage = {
  get() {
    try {
      return localStorage.getItem("bbfraxy-theme");
    } catch {
      return null;
    }
  },
  set(theme) {
    try {
      localStorage.setItem("bbfraxy-theme", theme);
    } catch {
      return null;
    }
  },
};

const storedTheme = themeStorage.get();
const initialTheme = storedTheme || (prefersLight.matches ? "light" : "dark");

root.dataset.theme = initialTheme;
syncThemeToggle();
renderSocialLinks();
removeHeaderGithubLink();
setupNavigation();
setupPrivacyFooter();
setupAmbientCanvas();

function removeHeaderGithubLink() {
  const headerGithub = document.querySelector('.nav-actions > a.icon-button[aria-label="GitHub"]');
  headerGithub?.remove();
}

function syncThemeToggle() {
  if (!themeToggle) {
    return;
  }

  const isLight = root.dataset.theme === "light";
  themeToggle.setAttribute("aria-pressed", String(isLight));
  themeToggle.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
}

themeToggle?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = nextTheme;
  themeStorage.set(nextTheme);
  syncThemeToggle();
});

function renderSocialLinks() {
  if (!socialContainer) {
    return;
  }

  socialContainer.replaceChildren();

  for (const item of socialLinks) {
    const hasUrl = Boolean(item.url);
    const element = document.createElement(hasUrl ? "a" : "span");

    element.className = "social-link";
    element.setAttribute("aria-label", hasUrl ? item.label : `${item.label} link not added yet`);
    element.setAttribute("title", hasUrl ? item.label : `${item.label} link not added yet`);
    element.innerHTML = icons[item.icon] || item.label;

    if (hasUrl) {
      element.href = item.url;
      element.target = "_blank";
      element.rel = "noreferrer";
    } else {
      element.setAttribute("aria-disabled", "true");
    }

    socialContainer.append(element);
  }
}

function setupPrivacyFooter() {
  const footers = document.querySelectorAll(".site-footer");

  for (const footer of footers) {
    if (footer.querySelector(".privacy-footer-link")) {
      continue;
    }

    const link = document.createElement("a");
    link.className = "privacy-footer-link";
    link.href = "/privacy/";
    link.textContent = "Soukromí";
    footer.append(link);
  }
}

function setupNavigation() {
  if (!menuToggle || !navMenu) {
    return;
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    navMenu.classList.toggle("is-open", !isOpen);
    root.classList.toggle("nav-open", !isOpen);
  });

  navMenu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeNavigation();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNavigation();
    }
  });
}

function closeNavigation() {
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Open navigation");
  navMenu?.classList.remove("is-open");
  root.classList.remove("nav-open");
}

function setupAmbientCanvas() {
  const canvas = document.querySelector("#ambient-canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let particles = [];
  let animationFrame = 0;

  const createParticles = () => {
    const density = Math.round((width * height) / 28000);
    const count = Math.max(26, Math.min(72, density));

    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      radius: Math.random() * 1.3 + 0.45,
    }));
  };

  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    createParticles();
    draw();
  };

  const getPalette = () => {
    const light = root.dataset.theme === "light";

    return {
      dot: light ? "rgba(0, 125, 152, 0.2)" : "rgba(95, 231, 255, 0.22)",
      line: light ? "rgba(0, 125, 152, 0.07)" : "rgba(95, 231, 255, 0.075)",
    };
  };

  const draw = () => {
    const palette = getPalette();

    context.clearRect(0, 0, width, height);

    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];

      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = palette.dot;
      context.fill();

      for (let next = index + 1; next < particles.length; next += 1) {
        const other = particles[next];
        const distance = Math.hypot(particle.x - other.x, particle.y - other.y);

        if (distance < 118) {
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = palette.line;
          context.lineWidth = 1;
          context.stroke();
        }
      }
    }
  };

  const tick = () => {
    if (!prefersReducedMotion.matches) {
      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;
      }
    }

    draw();
    animationFrame = window.requestAnimationFrame(tick);
  };

  const restart = () => {
    window.cancelAnimationFrame(animationFrame);

    if (prefersReducedMotion.matches) {
      draw();
      return;
    }

    animationFrame = window.requestAnimationFrame(tick);
  };

  window.addEventListener("resize", resize);
  prefersReducedMotion.addEventListener("change", restart);
  resize();
  restart();
}