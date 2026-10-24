// Colour field behind the admin panel's glass surfaces. Admin-only (kept apart
// from the website/app backdrop so admin styling evolves independently): cool,
// dim pools so data-heavy screens stay calm. Pure gradients, no blur filters.
// Place it first inside a `relative isolate` wrapper.

const POOLS = [
  ["96%", "0%", "38rem", "28rem", "oklch(0.6 0.12 270 / 0.36)"],
  ["0%", "4%", "30rem", "24rem", "oklch(0.62 0.1 295 / 0.3)"],
  ["62%", "55%", "36rem", "26rem", "oklch(0.7 0.07 210 / 0.22)"],
  ["100%", "100%", "34rem", "26rem", "oklch(0.64 0.1 300 / 0.28)"],
] as const;

export function AdminBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={{
        backgroundColor: "oklch(0.95 0.008 270)",
        backgroundImage: POOLS.map(
          ([x, y, w, h, c]) => `radial-gradient(${w} ${h} at ${x} ${y}, ${c}, transparent 70%)`,
        ).join(", "),
      }}
    />
  );
}
