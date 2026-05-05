import type { CSSProperties } from "react";

/**
 * Per-star fill when lit (position 1 = worst → 5 = best).
 * Matches `RATING_BAR_COLORS` on the admin analytics histogram.
 */
export const RATING_STAR_FILL: Record<number, string> = {
  1: "#9f1239",
  2: "#c2410c",
  3: "#a16207",
  4: "#15803d",
  5: "#0f7669",
};

const RATING_CHIP: Record<
  number,
  { bg: string; fg: string; bd: string }
> = {
  1: { bg: "#9f1239", fg: "#fff1f2", bd: "#881337" },
  2: { bg: "#c2410c", fg: "#fff7ed", bd: "#9a3412" },
  3: { bg: "#a16207", fg: "#1c1917", bd: "#854d0e" },
  4: { bg: "#15803d", fg: "#f0fdf4", bd: "#166534" },
  5: { bg: "#0f7669", fg: "#ecfdf5", bd: "#0d9488" },
};

export function clampRating(r: number): number {
  if (Number.isNaN(r)) return 3;
  return Math.min(5, Math.max(1, Math.round(r)));
}

/** Star button: each position uses its tier color when selected. */
export function ratingStarButtonStyle(
  starIndex: number,
  selectedRating: number
): CSSProperties {
  const lit = starIndex <= selectedRating;
  if (!lit) {
    return {
      color: "var(--muted)",
      borderColor: "transparent",
      background: "transparent",
    };
  }
  const fill = RATING_STAR_FILL[starIndex] ?? RATING_STAR_FILL[5];
  return {
    color: fill,
    borderColor: "transparent",
    background: "transparent",
  };
}

/** Compact “4 ★” chip on admin review cards. */
export function ratingChipStyle(rating: number): CSSProperties {
  const r = clampRating(rating);
  const c = RATING_CHIP[r] ?? RATING_CHIP[3];
  return {
    backgroundColor: c.bg,
    color: c.fg,
    borderColor: c.bd,
    borderStyle: "solid",
    borderWidth: 1,
  };
}

/** Inline snippet “4★” (alerts / lists). */
export function ratingInlineStyle(rating: number): CSSProperties {
  const r = clampRating(rating);
  return { color: RATING_STAR_FILL[r] ?? RATING_STAR_FILL[3] };
}
