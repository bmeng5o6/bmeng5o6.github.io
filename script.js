// Fade elements marked .reveal in as they scroll into view.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("in");
        observer.unobserve(el);
        // drop the stagger delay once it's shown so hover effects stay snappy
        el.addEventListener("transitionend", () => (el.style.transitionDelay = ""), { once: true });
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  // stagger siblings so cards and list items cascade in
  items.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.transitionDelay = `${siblings.indexOf(el) * 80}ms`;
    observer.observe(el);
  });
});
