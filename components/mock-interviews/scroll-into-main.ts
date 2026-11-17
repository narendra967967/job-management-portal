// Scroll an element into view inside the app's <main> scroller only.
// element.scrollIntoView() also scrolls overflow-hidden ancestors (the app shell),
// which nudges the whole frame and hides the top bar.

export function scrollIntoMain(el: Element | null, block: "center" | "end" = "center") {
  if (!el) return;
  const main = el.closest("main");
  if (!main) return el.scrollIntoView({ block });
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  // "end": all the way down, so a sticky footer (the answer box) never covers the
  // last item.
  if (block === "end") return main.scrollTo({ top: main.scrollHeight, behavior });
  const r = el.getBoundingClientRect();
  const m = main.getBoundingClientRect();
  main.scrollBy({ top: r.top - m.top - m.height / 2 + r.height / 2, behavior });
}
