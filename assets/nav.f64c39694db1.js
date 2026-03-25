const toggleButton = document.querySelector("[data-nav-toggle]");
const menu = document.querySelector("[data-nav-menu]");
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
