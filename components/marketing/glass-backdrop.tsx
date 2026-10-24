// The colour field behind the public website's glass panels: soft brand-colour
// light pools spread down the whole page, so frosted surfaces always have
// colour to blur. Pure gradients (no blur filters) — cheap to paint on phones.
// Place it first inside a `relative isolate` page wrapper.

const POOLS = [
  // [x, y, width, height, colour] — positions are % of the page.
  ["90%", "1%", "48rem", "36rem", "oklch(0.66 0.2 277 / 0.62)"],
  ["-4%", "11%", "40rem", "32rem", "oklch(0.74 0.17 330 / 0.5)"],
  ["62%", "22%", "40rem", "30rem", "oklch(0.8 0.13 192 / 0.55)"],
  ["6%", "35%", "40rem", "32rem", "oklch(0.68 0.19 295 / 0.48)"],
  ["94%", "47%", "38rem", "30rem", "oklch(0.76 0.16 330 / 0.46)"],
  ["30%", "60%", "42rem", "30rem", "oklch(0.8 0.13 192 / 0.5)"],
  ["80%", "74%", "40rem", "30rem", "oklch(0.68 0.19 277 / 0.48)"],
  ["4%", "88%", "40rem", "30rem", "oklch(0.76 0.16 330 / 0.42)"],
  ["70%", "100%", "44rem", "30rem", "oklch(0.8 0.13 192 / 0.45)"],
] as const;

export function GlassBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[oklch(0.975_0.008_280)]"
      style={{
        backgroundImage: POOLS.map(
          ([x, y, w, h, c]) => `radial-gradient(${w} ${h} at ${x} ${y}, ${c}, transparent 70%)`,
        ).join(", "),
      }}
    />
  );
}
