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
    theme: "Food & product quality",
    keywords: [
      // Hospitality — food & drink
      "food",
      "foods",
      "dish",
      "dishes",
      "cuisine",
      "appetizer",
      "appetiser",
      "entree",
      "dessert",
      "flavor",
      "flavour",
      "tasteless",
      "bland",
      "salty",
      "cold",
      "stale",
      "overcooked",
      "undercooked",
      "burnt",
      "burned",
      "dry",
      "greasy",
      "soggy",
      "chewy",
      "rubbery",
      "mushy",
      "watery",
      "flavorless",
      "flavourless",
      "gross",
      "awful",
      "horrible",
      "nasty",
      "disappointing",
      "mediocre",
      "underwhelming",
      "inedible",
      "unappetizing",
      "unappetising",
      // Retail / goods — what you bought
      "product",
      "products",
      "merchandise",
      "goods",
      "purchase",
      "item quality",
      "build quality",
      "cheaply made",
      "poorly made",
      "flimsy",
      "shoddy",
      "workmanship",
      "craftsmanship",
      // Education & coaching — outcomes / materials (not politeness)
      "lesson",
      "lessons",
      "curriculum",
      "coursework",
      "workshop",
      "tutorial",
      "tutoring",
      "homework",
      "lecture",
      "lectures",
      "module",
      "semester",
      "textbook",
      "instrument",
      "equipment",
      // Salon / wellness / fitness — service outcome as product
      "haircut",
      "highlights",
      "color job",
      "manicure",
      "pedicure",
      "facial",
      "massage",
      "workout",
      // Generic quality phrases (any vertical)
      "poor quality",
      "bad quality",
      "low quality",
      "terrible quality",
      "subpar",
      "not durable",
    ],
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

/**
 * Tokens that flip the meaning of a nearby keyword. Includes plain words and
 * common contracted negations so `wasn't slow`, `never dirty`, `no wait` are
 * all rejected as complaint signals.
 */
const NEGATORS: ReadonlySet<string> = new Set([
  "not",
  "no",
  "never",
  "without",
  "hardly",
  "barely",
  "rarely",
  "none",
  "neither",
  "nor",
  "nothing",
  "nobody",
  "cannot",
  "isn't",
  "wasn't",
  "weren't",
  "aren't",
  "didn't",
  "don't",
  "doesn't",
  "won't",
  "wouldn't",
  "shouldn't",
  "couldn't",
  "can't",
  "haven't",
  "hasn't",
  "hadn't",
  "ain't",
  "mustn't",
  "needn't",
  /** Typed without apostrophe; common in reviews. */
  "wasnt",
  "werent",
  "isnt",
  "arent",
]);

const NEGATION_LOOKBACK_CHARS = 50;
const NEGATION_LOOKBACK_TOKENS = 4;

/** Punctuation that ends a clause; negators across them shouldn't carry over. */
const CLAUSE_BOUNDARY_CHARS = new Set([".", ",", ";", "!", "?", ":"]);
/** Conjunctions that introduce a contrasting clause; same idea, word-level. */
const CLAUSE_BOUNDARY_WORDS = [
  " but ",
  " however ",
  " though ",
  " whereas ",
  " yet ",
  " although ",
];

/**
 * Returns true when one of the previous ~4 word-tokens before `matchIndex`
 * is a negator. The lookback is capped at the most recent clause boundary
 * (punctuation or contrast conjunction) so a negator in an earlier clause
 * does not leak across "but"/"," into the next clause.
 */
export function isNegatedAt(text: string, matchIndex: number): boolean {
  if (matchIndex <= 0) return false;
  const start = Math.max(0, matchIndex - NEGATION_LOOKBACK_CHARS);
  const slice = text.slice(start, matchIndex);
  const lower = slice.toLowerCase();

  let cutoff = -1;
  for (let i = 0; i < lower.length; i++) {
    if (CLAUSE_BOUNDARY_CHARS.has(lower[i])) {
      if (i > cutoff) cutoff = i;
    }
  }
  for (const w of CLAUSE_BOUNDARY_WORDS) {
    const idx = lower.lastIndexOf(w);
    if (idx >= 0) {
      const end = idx + w.length - 1;
      if (end > cutoff) cutoff = end;
    }
  }

  const effective = cutoff >= 0 ? lower.slice(cutoff + 1) : lower;
  const tokens = effective.split(/[^a-z']+/).filter(Boolean);
  const window = tokens.slice(-NEGATION_LOOKBACK_TOKENS);
  for (const t of window) {
    if (NEGATORS.has(t)) return true;
  }
  return false;
}

const FORWARD_LITOTES_MAX_CHARS = 100;

/**
 * After a subject keyword (e.g. "food", "service"), negation often follows the
 * copula ("the food was not bad", "service was not slow"). Backward-only
 * `isNegatedAt` misses that. We treat copula + negation + these tails as
 * non-complaint for that match. Quality complaints like "was not good/fresh"
 * stay as complaints; speed complaints like "was not fast/quick" are unchanged.
 */
const FORWARD_LITOTES_PATTERNS: RegExp[] = [
  /\b(?:was|were|is|are)(?:\s+[\w']+){0,2}\s+not\s+(?:(?:too|that|so|half|all)\s+)?(?:bad|terrible|awful|horrible|nasty|disappointing|mediocre|poor|subpar)\b/i,
  /\b(?:was|were|is|are)(?:\s+[\w']+){0,2}\s+not\s+the\s+worst\b/i,
  /\b(?:was|were|is|are)(?:\s+[\w']+){0,2}\s+not\s+bad\s+at\s+all\b/i,
  /\b(?:wasn't|weren't|isn't|aren't|wasnt|werent|isnt|arent)(?:\s+(?:too|that|so|half|all))?\s+(?:bad|terrible|awful|horrible|nasty)\b/i,
  /\b(?:wasn't|weren't|isn't|aren't|wasnt|werent|isnt|arent)\s+half\s+bad\b/i,
  /\b(?:wasn't|weren't|isn't|aren't|wasnt|werent|isnt|arent)\s+the\s+worst\b/i,
  /\b(?:was|were|is|are)(?:\s+[\w']+){0,2}\s+not\s+(?:(?:too|that|so|all)\s+)?(?:slow|late)\b/i,
  /\b(?:was|were|is|are)(?:\s+[\w']+){0,2}\s+not\s+delayed\b/i,
  /\b(?:wasn't|weren't|isn't|aren't|wasnt|werent|isnt|arent)(?:\s+(?:too|that|so|all))?\s+(?:slow|late)\b/i,
  /\b(?:wasn't|weren't|isn't|aren't|wasnt|werent|isnt|arent)\s+delayed\b/i,
  /\b(?:was|were|is|are)(?:\s+[\w']+){0,2}\s+not\s+(?:(?:too|that|so|all)\s+)?long\b/i,
  /\b(?:wasn't|weren't|isn't|aren't|wasnt|werent|isnt|arent)(?:\s+(?:too|that|so|all))?\s+long\b/i,
];

function forwardClauseSlice(text: string, from: number): string {
  let end = Math.min(text.length, from + FORWARD_LITOTES_MAX_CHARS);
  for (let i = from; i < end; i++) {
    if (CLAUSE_BOUNDARY_CHARS.has(text[i])) {
      end = i;
      break;
    }
  }
  const slice = text.slice(from, end);
  let limit = slice.length;
  const lowerSlice = slice.toLowerCase();
  for (const w of CLAUSE_BOUNDARY_WORDS) {
    const idx = lowerSlice.indexOf(w);
    if (idx >= 0 && idx < limit) limit = idx;
  }
  return slice.slice(0, limit);
}

function hasLitotesNegationAfter(text: string, matchEnd: number): boolean {
  if (matchEnd >= text.length) return false;
  const forward = forwardClauseSlice(text, matchEnd);
  if (!forward) return false;
  return FORWARD_LITOTES_PATTERNS.some((re) => re.test(forward));
}

/** True if this keyword hit should be ignored (negated or understatement). */
export function isKeywordMatchNegated(
  text: string,
  matchIndex: number,
  matchLength: number
): boolean {
  if (isNegatedAt(text, matchIndex)) return true;
  return hasLitotesNegationAfter(text, matchIndex + matchLength);
}

function includesAny(text: string, needles: readonly string[]) {
  for (const n of needles) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (!isKeywordMatchNegated(text, m.index, m[0].length)) return true;
    }
  }
  return false;
}

/**
 * Substring variant for severe keywords (preserves the existing
 * `String.prototype.includes` semantics — e.g. "rudely" still matches "rude")
 * while suppressing negated occurrences. Returns true when at least one
 * non-negated occurrence exists.
 */
function hasNonNegatedOccurrence(text: string, needle: string): boolean {
  if (!needle) return false;
  let from = 0;
  while (from <= text.length) {
    const idx = text.indexOf(needle, from);
    if (idx === -1) return false;
    if (!isKeywordMatchNegated(text, idx, needle.length)) return true;
    from = idx + 1;
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
      if (hasNonNegatedOccurrence(combined, k)) {
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
