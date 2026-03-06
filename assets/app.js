// assets/app.js
(function () {
  const list = document.getElementById("taskList");
  if (!list) return;

  // Animate delete: fade out before submitting
  list.addEventListener("submit", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.classList.contains("js-delete")) {
      e.preventDefault();
      const li = form.closest(".item");
      if (!li) return;

      li.style.transition = "opacity .18s ease, transform .18s ease";
      li.style.opacity = "0";
      li.style.transform = "translateY(6px)";

      setTimeout(() => form.submit(), 180);
    }
  });

  // Animate toggle: optimistic UI effect (visual only)
  list.addEventListener("submit", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.classList.contains("js-toggle")) {
      const li = form.closest(".item");
      if (!li) return;

      li.style.transition = "transform .08s ease";
      li.style.transform = "translateY(1px)";
      setTimeout(() => (li.style.transform = "translateY(0)"), 80);
    }
  });
})();