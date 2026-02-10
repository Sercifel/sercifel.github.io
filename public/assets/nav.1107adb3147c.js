const toggleButton = document.querySelector("[data-nav-toggle]");
const menu = document.querySelector("[data-nav-menu]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const themeIcons = themeToggle
  ? {
      light: themeToggle.querySelector("[data-theme-icon='light']"),
      dark: themeToggle.querySelector("[data-theme-icon='dark']"),
    }
  : null;
const root = document.documentElement;
const progressBar = document.querySelector("[data-reading-progress]");

if (toggleButton && menu) {
  const setExpanded = (open) => {
    menu.hidden = !open;
    toggleButton.setAttribute("aria-expanded", String(open));
  };

  setExpanded(false);

  toggleButton.addEventListener("click", () => {
    setExpanded(menu.hidden);
  });

  document.addEventListener("click", (event) => {
    if (menu.hidden) {
      return;
    }
    if (!menu.contains(event.target) && !toggleButton.contains(event.target)) {
      setExpanded(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setExpanded(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setExpanded(false);
    }
  });
}

if (themeToggle) {
  const setTheme = (next) => {
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (themeIcons) {
      const showLight = next === "dark";
      if (themeIcons.light) {
        themeIcons.light.classList.toggle("hidden", !showLight);
      }
      if (themeIcons.dark) {
        themeIcons.dark.classList.toggle("hidden", showLight);
      }
    }
    themeToggle.setAttribute(
      "aria-label",
      next === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  };

  const current = root.getAttribute("data-theme") || "light";
  setTheme(current);

  themeToggle.addEventListener("click", () => {
    const active = root.getAttribute("data-theme") || "light";
    setTheme(active === "dark" ? "light" : "dark");
  });
}

if (progressBar) {
  let ticking = false;
  const updateProgress = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const current = max > 0 ? window.scrollY / max : 0;
    progressBar.style.width = `${Math.min(100, Math.max(0, current * 100))}%`;
    ticking = false;
  };

  const requestUpdate = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateProgress);
      ticking = true;
    }
  };

  requestUpdate();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
}
