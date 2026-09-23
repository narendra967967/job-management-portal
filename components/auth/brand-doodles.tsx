// Decorative job-search line-art scattered behind the login gradient. Pure
// inline SVG (no image asset) — white strokes at low opacity over the gradient.

export function BrandDoodles() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full text-white/[0.14]"
      viewBox="0 0 500 720"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <g
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Briefcase */}
        <g transform="translate(70 120) rotate(-12) scale(1.3)">
          <rect x="-18" y="-11" width="36" height="26" rx="3" />
          <path d="M-8 -11 v-4 a3 3 0 0 1 3 -3 h10 a3 3 0 0 1 3 3 v4" />
          <path d="M-18 0 h36" />
        </g>

        {/* Magnifier */}
        <g transform="translate(300 90) rotate(8) scale(1.4)">
          <circle cx="-4" cy="-4" r="12" />
          <path d="M5 5 L16 16" />
        </g>

        {/* Envelope */}
        <g transform="translate(420 210) rotate(-8) scale(1.3)">
          <rect x="-20" y="-14" width="40" height="28" rx="3" />
          <path d="M-20 -11 L0 4 L20 -11" />
        </g>

        {/* Sparkle */}
        <g transform="translate(150 250) scale(1.2)">
          <path d="M0 -15 C1.5 -4.5 4.5 -1.5 15 0 C4.5 1.5 1.5 4.5 0 15 C-1.5 4.5 -4.5 1.5 -15 0 C-4.5 -1.5 -1.5 -4.5 0 -15 Z" />
        </g>

        {/* Gauge / fit score */}
        <g transform="translate(360 330) rotate(-6) scale(1.35)">
          <path d="M-15 7 A15 15 0 0 1 15 7" />
          <path d="M0 7 L9 -5" />
          <circle cx="0" cy="7" r="2.2" />
        </g>

        {/* Bar chart */}
        <g transform="translate(90 360) rotate(6) scale(1.25)">
          <path d="M-16 15 h34" />
          <rect x="-14" y="1" width="7" height="12" />
          <rect x="-3" y="-9" width="7" height="22" />
          <rect x="8" y="-3" width="7" height="16" />
        </g>

        {/* Paper plane */}
        <g transform="translate(250 470) rotate(-14) scale(1.4)">
          <path d="M-16 -8 L16 -15 L4 16 L-1 3 Z" />
          <path d="M16 -15 L-1 3" />
        </g>

        {/* Check circle */}
        <g transform="translate(430 460) scale(1.25)">
          <circle cx="0" cy="0" r="14" />
          <path d="M-6 0 L-1 6 L8 -7" />
        </g>

        {/* Document */}
        <g transform="translate(120 560) rotate(-8) scale(1.25)">
          <path d="M-12 -16 h15 l9 9 v23 h-24 Z" />
          <path d="M3 -16 v9 h9" />
          <path d="M-6 4 h14 M-6 10 h14" />
        </g>

        {/* Connection nodes */}
        <g transform="translate(360 610) rotate(10) scale(1.3)">
          <circle cx="-13" cy="-8" r="3" />
          <circle cx="11" cy="5" r="3" />
          <circle cx="-6" cy="10" r="3" />
          <path d="M-10 -6 L8 3 M-9 -5 L-7 7" />
        </g>

        {/* Small sparkle bottom-left */}
        <g transform="translate(60 650) scale(0.8)">
          <path d="M0 -15 C1.5 -4.5 4.5 -1.5 15 0 C4.5 1.5 1.5 4.5 0 15 C-1.5 4.5 -4.5 1.5 -15 0 C-4.5 -1.5 -1.5 -4.5 0 -15 Z" />
        </g>
      </g>
    </svg>
  );
}
