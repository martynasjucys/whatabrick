export type Verdict =
  | "IGNORE"
  | "WATCH"
  | "GOOD_BELOW_TARGET"
  | "INTERESTING_RISKY"
  | "SCARCE_OVERPRICED"
  | "STRONG_SIGNAL"
  | "AVOID_HYPE";

export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export const VERDICT_LABEL: Record<Verdict, string> = {
  IGNORE: "Ignore",
  WATCH: "Watch",
  GOOD_BELOW_TARGET: "Good below target",
  INTERESTING_RISKY: "Interesting but risky",
  SCARCE_OVERPRICED: "Scarce but overpriced",
  STRONG_SIGNAL: "Strong signal",
  AVOID_HYPE: "Avoid hype",
};

/**
 * Background / text classes per verdict. Token-only so the values come from
 * docs/design.md tokens (lavender, success-green, brand-secure, ink scales).
 */
export const VERDICT_TONE: Record<
  Verdict,
  { bg: string; fg: string; ring: string }
> = {
  STRONG_SIGNAL: {
    bg: "bg-[var(--brand-primary)]",
    fg: "text-white",
    ring: "ring-[var(--brand-primary)]",
  },
  GOOD_BELOW_TARGET: {
    bg: "bg-[var(--semantic-success)]",
    fg: "text-white",
    ring: "ring-[var(--semantic-success)]",
  },
  INTERESTING_RISKY: {
    bg: "bg-[var(--brand-secure)]",
    fg: "text-white",
    ring: "ring-[var(--brand-secure)]",
  },
  SCARCE_OVERPRICED: {
    bg: "bg-popover",
    fg: "text-[var(--ink-muted)]",
    ring: "ring-border",
  },
  AVOID_HYPE: {
    bg: "bg-popover",
    fg: "text-[var(--ink-muted)]",
    ring: "ring-border",
  },
  WATCH: {
    bg: "bg-popover",
    fg: "text-[var(--ink-subtle)]",
    ring: "ring-border",
  },
  IGNORE: {
    bg: "bg-popover",
    fg: "text-[var(--ink-subtle)]",
    ring: "ring-border",
  },
};
