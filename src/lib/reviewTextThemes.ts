export type ThemeInsightRow = {
  id: string;
  rating: number;
  comment: string | null;
  aiSummary: string | null;
  locationTitle: string;
};

type ThemeBucket = {
  theme: string;
  keywords: string[];
};

/** Lexical theme buckets (keyword-based). Exported for bucket intelligence / tests. */
export const THEME_BUCKETS: ThemeBucket[] = [
  {
    theme: "Service speed / wait time",
    keywords: ["slow", "wait", "waiting", "queue", "late", "took long", "delay"],
  },
  {
    theme: "Staff behavior",
    keywords: ["rude", "impolite", "unprofessional", "attitude", "ignored", "yelled"],
  },
  {
    theme: "Cleanliness",
    keywords: ["dirty", "unclean", "filthy", "sticky", "smell", "odor", "stain"],
  },
  {
    theme: "Food quality / taste",
    keywords: ["tasteless", "bland", "salty", "cold", "stale", "overcooked", "undercooked"],
  },
  {
    theme: "Food safety",
    keywords: ["food poisoning", "sick", "ill", "vomit", "diarrhea", "unsafe", "expired"],
  },
  {
    theme: "Order accuracy",
    keywords: ["wrong", "missing", "incorrect", "messed up", "not what", "swap", "forgot"],
  },
  {
    theme: "Pricing / value",
    keywords: ["expensive", "overpriced", "price", "value", "costly", "not worth"],
  },
  {
    theme: "Refunds / billing",
    keywords: ["refund", "charge", "charged", "billing", "payment", "overcharge", "money back"],
  },
  {
    theme: "Scam / trust",
    keywords: ["scam", "fraud", "cheat", "fake", "rip off", "ripoff"],
  },
  {
    theme: "Ambience",
    keywords: ["noisy", "loud", "music", "crowded", "ambience", "atmosphere"],
  },
  {
    theme: "Pests / contamination",
    keywords: ["bug", "cockroach", "roach", "insect", "fly", "maggot", "rat", "mouse"],
  },
  {
    theme: "Hair / foreign object",
    keywords: ["hair", "plastic", "glass", "stone", "foreign object"],
  },
  {
    theme: "Portion size",
    keywords: ["small portion", "tiny portion", "portion", "quantity", "less food"],
  },
  {
    theme: "Packaging / delivery",
    keywords: ["spilled", "leaked", "packaging", "cold on arrival", "delivery", "driver"],
  },
];

export const SEVERE_KEYWORDS = [
  "food poisoning",
  "rude",
  "refund",
  "scam",
  "dirty",
  "hair",
  "bug",
] as const;

function normalize(s: string) {
  return s.toLowerCase();
}

function includesAny(text: string, needles: readonly string[]) {
  for (const n of needles) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(text)) return true;
  }
  return false;
}

/** Theme names from `THEME_BUCKETS` that match this review's text (multi-bucket). */
export function matchedThemeNames(
  comment: string | null,
  aiSummary: string | null
): string[] {
  const combined = normalize(`${comment ?? ""} ${aiSummary ?? ""}`);
  if (!combined) return [];
  const out: string[] = [];
  for (const bucket of THEME_BUCKETS) {
    if (includesAny(combined, bucket.keywords)) {
      out.push(bucket.theme);
    }
  }
  return out;
}

export function snippetFrom(text: string, maxLen: number) {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return t.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

export type ThemeTop = { theme: string; count: number };
export type ThemeAlert = {
  keyword: string;
  count: number;
  examples: Array<{
    id: string;
    rating: number;
    locationTitle: string;
    snippet: string;
  }>;
};

export function analyzeThemesAndAlerts(reviews: ThemeInsightRow[]): {
  topThemes: ThemeTop[];
  alerts: ThemeAlert[];
} {
  const themeCounts = new Map<string, number>();
  const severeMap = new Map<
    (typeof SEVERE_KEYWORDS)[number],
    { count: number; examples: ThemeAlert["examples"] }
  >();

  for (const k of SEVERE_KEYWORDS) {
    severeMap.set(k, { count: 0, examples: [] });
  }

  for (const r of reviews) {
    const combined = normalize(`${r.comment ?? ""} ${r.aiSummary ?? ""}`);

    for (const bucket of THEME_BUCKETS) {
      if (!combined) continue;
      if (includesAny(combined, bucket.keywords)) {
        themeCounts.set(bucket.theme, (themeCounts.get(bucket.theme) ?? 0) + 1);
      }
    }

    for (const k of SEVERE_KEYWORDS) {
      if (combined.includes(k)) {
        const entry = severeMap.get(k)!;
        entry.count += 1;
        if (entry.examples.length < 3) {
          entry.examples.push({
            id: r.id,
            rating: r.rating,
            locationTitle: r.locationTitle,
            snippet: snippetFrom(r.comment ?? r.aiSummary ?? "", 160),
          });
        }
      }
    }
  }

  const topThemes = Array.from(themeCounts.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const alerts = Array.from(severeMap.entries())
    .filter(([, v]) => v.count > 0)
    .map(([keyword, v]) => ({ keyword, count: v.count, examples: v.examples }))
    .sort((a, b) => b.count - a.count);

  return { topThemes, alerts };
}
