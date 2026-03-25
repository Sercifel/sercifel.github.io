const sections = document.querySelectorAll("[data-pagination-scope]");

sections.forEach((section) => {
  const items = Array.from(section.querySelectorAll("[data-page-item]"));
  const pagination = section.querySelector("[data-pagination]");
  const buttons = pagination
    ? Array.from(pagination.querySelectorAll("[data-page-button]"))
    : [];

  if (!pagination || items.length === 0 || buttons.length === 0) {
    return;
  }

  const setActiveButton = (page) => {
    buttons.forEach((button) => {
      const isActive = Number(button.dataset.page) === page;
      button.classList.toggle("bg-blue-600", isActive);
      button.classList.toggle("text-white", isActive);
      button.classList.toggle("border-blue-600", isActive);
      button.classList.toggle("border-slate-300", !isActive);
      button.classList.toggle("text-slate-600", !isActive);
      button.classList.toggle("hover:border-blue-600", !isActive);
      button.classList.toggle("hover:text-blue-600", !isActive);
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  };

  const showPage = (page) => {
    items.forEach((item) => {
      const itemPage = Number(item.dataset.page || 1);
      item.classList.toggle("hidden", itemPage !== page);
    });
    setActiveButton(page);
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.page || 1);
      showPage(page);
    });
  });

  showPage(1);
});
