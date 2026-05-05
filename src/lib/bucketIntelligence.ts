/**
 * Deterministic “subject bucket” layer on top of lexical `THEME_BUCKETS`.
 * Scoring weights are documented inline — no ML/embeddings.
 *
 * Vertical note: `THEME_BUCKETS` / theme names skew hospitality (food, etc.).
 * Subject buckets stay stable IDs for the API; labels + `SUBJECT_DIRECT_KEYWORDS`
 * are widened so retail / apparel / services still map into the same buckets
 * (e.g. fabric → quality bucket, fitting room → staff & service).
 */
import type { ThemeTop } from "@/lib/reviewTextThemes";
import { matchedThemeNames, snippetFrom } from "@/lib/reviewTextThemes";

export type AnalyticsRange = "week" | "month" | "year" | "all";

export type NormalizedBlendedReview = {
  id: string;
  /** Distinguishes corpus breakdown in grounding. */
  source: "external" | "internal";
  rating: number;
  comment: string | null;
  aiSummary: string | null;
  locationTitle: string;
  /** Stable key: `g:<googleLocationId>` | `i:<businessLocationId>` | `i:none` */
  locationKey: string;
  reviewTime: Date;
};

export type SubjectBucketId =
  | "staff_service"
  | "food_drinks"
  | "cleanliness_ambience"
  | "stock_items_orders"
  | "pricing_trust"
  | "delivery_ops";

/** RAG health bands (0–100 scale). */
export const HEALTH_RED_MAX = 39;
export const HEALTH_AMBER_MAX = 69;

/** Penalty: up to this many points scaled by share of ≤2★ in-bucket (window). */
const LOW_STAR_SHARE_PENALTY_MAX = 15;

/** Minimum tagged reviews in prior window to trust trend multiplier. */
const PRIOR_WINDOW_MIN_COUNT = 3;

/** Worsening: priorHealth - windowHealth above this starts boosting priority. */
const WORSENING_HEALTH_DELTA_THRESHOLD = 5;

/** `priority ≈ count * stress * trend` — trend multiplier capped. */
const TREND_MULTIPLIER_MAX = 2;

export const BUCKET_DEFINITIONS: Array<{
  id: SubjectBucketId;
  label: string;
  description: string;
}> = [
  {
    id: "staff_service",
    label: "Staff & service",
    description: "People, speed, and front-line service quality.",
  },
  {
    id: "food_drinks",
    label: "Product & food quality",
    description:
      "Food/drink taste and safety where relevant; also material, construction, and sensory product quality (e.g. apparel).",
  },
  {
    id: "cleanliness_ambience",
    label: "Cleanliness & ambience",
    description: "Hygiene, pests, noise, and atmosphere.",
  },
  {
    id: "stock_items_orders",
    label: "Stock, items & order accuracy",
    description:
      "Wrong/missing SKUs, sizes, or picks; inventory gaps; foreign objects in orders (any vertical).",
  },
  {
    id: "pricing_trust",
    label: "Pricing & trust",
    description: "Value, billing/refunds, and trust/scam language.",
  },
  {
    id: "delivery_ops",
    label: "Delivery & packaging",
    description: "Drivers, packaging, spills, and arrival condition.",
  },
];

const KNOWN_SUBJECT_IDS = new Set<SubjectBucketId>(
  BUCKET_DEFINITIONS.map((b) => b.id)
);

/**
 * DB stores `[]` to mean "all buckets" (legacy default). A non-empty array is an
 * explicit subset. Invalid ids are dropped; if nothing valid remains, fall back
 * to all buckets. PATCH may set `[]` to reset to all topics.
 */
export function resolveActiveSubjectBucketIds(
  stored: string[] | null | undefined
): SubjectBucketId[] {
  const raw = stored ?? [];
  if (raw.length === 0) {
    return BUCKET_DEFINITIONS.map((b) => b.id);
  }
  const unique = [...new Set(raw)];
  const out = unique.filter((id): id is SubjectBucketId =>
    KNOWN_SUBJECT_IDS.has(id as SubjectBucketId)
  );
  return out.length > 0
    ? out
    : BUCKET_DEFINITIONS.map((b) => b.id);
}

/** Validate bucket ids from API JSON; returns unique allowed ids or []. */
export function normalizeIncomingAnalyticsBucketIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.filter(
    (x): x is string =>
      typeof x === "string" && KNOWN_SUBJECT_IDS.has(x as SubjectBucketId)
  );
  return [...new Set(out)];
}

/** Lexical theme title → one-or-many subject buckets (deterministic). */
export const THEME_TO_SUBJECT_BUCKETS: Record<string, SubjectBucketId[]> = {
  "Service speed / wait time": ["staff_service"],
  "Staff behavior": ["staff_service"],
  Cleanliness: ["cleanliness_ambience"],
  "Food quality / taste": ["food_drinks"],
  "Food safety": ["food_drinks", "cleanliness_ambience"],
  "Order accuracy": ["stock_items_orders"],
  "Pricing / value": ["pricing_trust"],
  "Refunds / billing": ["pricing_trust"],
  "Scam / trust": ["pricing_trust"],
  Ambience: ["cleanliness_ambience"],
  "Pests / contamination": ["cleanliness_ambience", "food_drinks"],
  "Hair / foreign object": ["stock_items_orders", "food_drinks"],
  "Portion size": ["food_drinks", "stock_items_orders"],
  "Packaging / delivery": ["delivery_ops"],
};

/** Lexical “top themes” rows filtered to match owner-selected subject buckets. */
export function filterTopThemesByActiveSubjects(
  themes: ThemeTop[],
  activeBucketIds: SubjectBucketId[]
): ThemeTop[] {
  const active = new Set(activeBucketIds);
  if (active.size >= BUCKET_DEFINITIONS.length) return themes;

  return themes.filter((t) => {
    const mapped =
      THEME_TO_SUBJECT_BUCKETS[t.theme as keyof typeof THEME_TO_SUBJECT_BUCKETS];
    if (!mapped?.length) return true;
    return mapped.some((sid) => active.has(sid));
  });
}

/** Extra subject signals not covered by theme names (word-boundary match). */
const SUBJECT_DIRECT_KEYWORDS: Record<SubjectBucketId, readonly string[]> = {
  staff_service: [
    "service",
    "support",
    "staff",
    "wait time",
    "cashier",
    "server",
    "hostess",
    "front desk",
    "customer service",
    "helpful staff",
    "rude staff",
    "sales associate",
    "shop assistant",
    "fitting room",
    "dressing room",
    "stylist",
    "personal shopper",
    "checkout line",
    "queue at checkout",
    "long line",
  ],
  food_drinks: [
    "menu",
    "coffee",
    "drink",
    "beverage",
    "meal",
    "breakfast",
    "lunch",
    "dinner",
    "fabric quality",
    "poor stitching",
    "stitching undone",
    "threads loose",
    "seam ripped",
    "material feels",
    "fabric feels",
    "pilling",
    "faded after",
    "zipper broke",
    "button fell",
    "smelled chemical",
    "defective item",
  ],
  cleanliness_ambience: [
    "restroom",
    "bathroom",
    "toilet",
    "seating area",
    "messy store",
    "dirty floor",
    "fitting room was dirty",
    "dressing room dirty",
    "crowded store",
    "store layout",
  ],
  stock_items_orders: [
    "out of stock",
    "sold out",
    "unavailable",
    "shelf",
    "aisle",
    "sku",
    "wrong size",
    "size runs small",
    "size runs large",
    "size chart",
    "hemmed wrong",
    "alteration",
    "exchange",
    "received wrong item",
    "missing item from order",
    "not what i ordered",
  ],
  pricing_trust: [
    "overcharge",
    "hidden fee",
    "receipt",
    "sale price",
    "markdown",
    "coupon did not work",
    "charged twice",
  ],
  delivery_ops: [
    "uber eats",
    "doordash",
    "grubhub",
    "courier",
    "shipping",
    "tracking number",
    "package arrived",
    "late shipment",
    "usps",
    "fedex",
    "ups",
    "return label",
  ],
};

function normalize(s: string) {
  return s.toLowerCase();
}

function includesAnyKeyword(text: string, needles: readonly string[]) {
  for (const n of needles) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(text)) return true;
  }
  return false;
}

export function subjectBucketsForReview(
  comment: string | null,
  aiSummary: string | null
): SubjectBucketId[] {
  const combined = normalize(`${comment ?? ""} ${aiSummary ?? ""}`);
  const subjects = new Set<SubjectBucketId>();

  for (const theme of matchedThemeNames(comment, aiSummary)) {
    const mapped = THEME_TO_SUBJECT_BUCKETS[theme];
    if (mapped) {
      for (const s of mapped) subjects.add(s);
    }
  }

  if (combined) {
    for (const sid of Object.keys(SUBJECT_DIRECT_KEYWORDS) as SubjectBucketId[]) {
      if (includesAnyKeyword(combined, SUBJECT_DIRECT_KEYWORDS[sid])) {
        subjects.add(sid);
      }
    }
  }

  return Array.from(subjects);
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function dayKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type MetricsWindowResolved = {
  windowStart: Date;
  windowEnd: Date;
  priorWindowStart: Date;
  priorWindowEnd: Date;
};

/**
 * Resolves `[windowStart, windowEnd]` and equal-length prior window.
 * Used for both arrival trend SQL and bucket metrics.
 */
export function resolveMetricsWindow(
  range: AnalyticsRange,
  opts: {
    now: Date;
    corpusMinTime?: Date | null;
    corpusMaxTime?: Date | null;
  }
): MetricsWindowResolved {
  const now = opts.now;
  const endBase = startOfUtcDay(now);
  const endDay = addUtcDays(endBase, 1);
  const endExclusive = endDay;

  let windowStart: Date;
  let windowEndExclusive: Date;

  if (range === "week") {
    windowEndExclusive = endExclusive;
    windowStart = addUtcDays(startOfUtcDay(now), -7);
  } else if (range === "month") {
    windowEndExclusive = endExclusive;
    windowStart = addUtcDays(startOfUtcDay(now), -30);
  } else if (range === "year") {
    windowEndExclusive = endExclusive;
    windowStart = addUtcDays(startOfUtcDay(now), -365);
  } else {
    const minT = opts.corpusMinTime;
    const maxT = opts.corpusMaxTime ?? now;
    if (minT) {
      windowStart = startOfUtcDay(minT);
      windowEndExclusive = addUtcDays(startOfUtcDay(maxT), 1);
    } else {
      windowStart = addUtcDays(startOfUtcDay(now), -30);
      windowEndExclusive = endExclusive;
    }
  }

  const windowMs =
    windowEndExclusive.getTime() - windowStart.getTime() || 86400000;
  const priorWindowEndExclusive = windowStart;
  const priorWindowStart = new Date(
    priorWindowEndExclusive.getTime() - windowMs
  );

  return {
    windowStart,
    windowEnd: new Date(windowEndExclusive.getTime() - 1),
    priorWindowStart,
    priorWindowEnd: new Date(priorWindowEndExclusive.getTime() - 1),
  };
}

export function parseAnalyticsRange(raw: string | null): AnalyticsRange {
  if (raw === "week" || raw === "month" || raw === "year" || raw === "all") {
    return raw;
  }
  return "month";
}

function inRange(t: Date, start: Date, endExclusive: Date) {
  return t >= start && t < endExclusive;
}

/** Exclusive UTC end instant for metrics window filtering (matches bucket builders). */
export function metricsWindowEndExclusive(windows: MetricsWindowResolved): Date {
  return addUtcDays(startOfUtcDay(windows.windowEnd), 1);
}

export function computeWorstLocationsForWindow(
  reviews: NormalizedBlendedReview[],
  windowStart: Date,
  windowEndExclusive: Date,
  limit = 5
): Array<{
  locationId: string;
  title: string;
  count: number;
  avgRating: number | null;
  lowScoreShare: number;
}> {
  const m = new Map<string, { title: string; ratings: number[] }>();
  for (const r of reviews) {
    if (!inRange(r.reviewTime, windowStart, windowEndExclusive)) continue;
    const cur = m.get(r.locationKey) ?? { title: r.locationTitle, ratings: [] as number[] };
    cur.ratings.push(r.rating);
    cur.title = r.locationTitle;
    m.set(r.locationKey, cur);
  }
  const rows = [...m.entries()].map(([locationId, v]) => {
    const c = v.ratings.length;
    const avg = meanRating(v.ratings);
    const low = v.ratings.filter((x) => x <= 2).length;
    return {
      locationId,
      title: v.title,
      count: c,
      avgRating: avg,
      lowScoreShare: c ? low / c : 0,
    };
  });
  rows.sort(
    (a, b) =>
      b.lowScoreShare - a.lowScoreShare || b.count - a.count
  );
  return rows.slice(0, limit);
}

function meanRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

/**
 * Base health from mean 1–5 rating → 0–100, then subtract up to
 * `LOW_STAR_SHARE_PENALTY_MAX` based on fraction of ≤2★ mentions in bucket.
 */
export function healthScoreFromRatings(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const avg = meanRating(ratings)!;
  let health = ((avg - 1) / 4) * 100;
  const low = ratings.filter((r) => r <= 2).length;
  const lowShare = low / ratings.length;
  health -= LOW_STAR_SHARE_PENALTY_MAX * lowShare;
  return Math.max(0, Math.min(100, Math.round(health)));
}

export function bandFromHealth(health: number | null): "red" | "amber" | "green" | "neutral" {
  if (health == null) return "neutral";
  if (health <= HEALTH_RED_MAX) return "red";
  if (health <= HEALTH_AMBER_MAX) return "amber";
  return "green";
}

/**
 * `trendMultiplier` in [1, TREND_MULTIPLIER_MAX] when prior window health
 * is meaningfully higher than current (worsening).
 */
export function trendMultiplierFromHealths(
  windowHealth: number | null,
  priorHealth: number | null,
  priorCount: number
): number {
  if (
    windowHealth == null ||
    priorHealth == null ||
    priorCount < PRIOR_WINDOW_MIN_COUNT
  ) {
    return 1;
  }
  const delta = priorHealth - windowHealth;
  if (delta <= WORSENING_HEALTH_DELTA_THRESHOLD) return 1;
  const extra = Math.min(1, (delta - WORSENING_HEALTH_DELTA_THRESHOLD) / 35);
  return 1 + extra * (TREND_MULTIPLIER_MAX - 1);
}

export function priorityScore(params: {
  taggedCountWindow: number;
  healthScore: number | null;
  trendMultiplier: number;
}): number {
  const { taggedCountWindow, healthScore, trendMultiplier } = params;
  if (taggedCountWindow === 0 || healthScore == null) return 0;
  const stress = (100 - healthScore) / 100;
  return Math.round(taggedCountWindow * stress * trendMultiplier * 100) / 100;
}

function workOnThisLine(
  band: "red" | "amber" | "green" | "neutral",
  worsening: boolean,
  taggedCountWindow: number
): string {
  if (taggedCountWindow === 0) {
    return "No tagged reviews in this window — widen the range or wait for more text.";
  }
  if (band === "neutral") {
    return "Insufficient bucket signal in this window.";
  }
  const trend = worsening ? "Trend vs prior period looks worse — prioritize." : "";
  if (band === "red") {
    return `Low health in this bucket. ${trend} Focus coaching, checks, and recovery plays.`.trim();
  }
  if (band === "amber") {
    return `Mixed performance. ${trend} Tighten standards and monitor weekly.`.trim();
  }
  return "Strong relative signal — keep routines and spot-check outliers.";
}

export type BucketInsightRow = {
  id: SubjectBucketId;
  label: string;
  taggedCountWindow: number;
  taggedCountFullCorpus: number;
  healthScore: number | null;
  band: "red" | "amber" | "green" | "neutral";
  priorityScore: number;
  workOnThisLine: string;
  exampleSnippets: string[];
  /** `priorHealth - windowHealth` when both exist; positive ⇒ worsening. */
  healthDeltaVsPrior: number | null;
};

export type BucketTrendRow = {
  date: string;
  bucketId: SubjectBucketId;
  count: number;
  avgRating: number | null;
  healthScore: number | null;
};

export type BucketByLocationRow = {
  locationId: string;
  title: string;
  buckets: Array<{
    bucketId: SubjectBucketId;
    taggedCountWindow: number;
    taggedCountFullCorpus: number;
    healthScore: number | null;
    band: "red" | "amber" | "green" | "neutral";
    priorityScore: number;
    workOnThisLine: string;
    exampleSnippets: string[];
  }>;
};

export type BucketMetricsMeta = {
  windowStart: string;
  windowEnd: string;
  priorWindowStart: string;
  priorWindowEnd: string;
  corpusReviewCount: number;
  range: AnalyticsRange;
};

const MAX_BUCKET_EXAMPLES = 3;
const MAX_LOCATIONS = 24;

export function buildBucketIntelligencePayload(
  reviews: NormalizedBlendedReview[],
  windows: MetricsWindowResolved,
  range: AnalyticsRange,
  /** When omitted or empty, all subject buckets are included. */
  activeBucketIds?: SubjectBucketId[] | null
): {
  bucketDefinitions: typeof BUCKET_DEFINITIONS;
  bucketInsights: BucketInsightRow[];
  bucketTrend: BucketTrendRow[];
  bucketByLocation: BucketByLocationRow[];
  bucketMetricsMeta: BucketMetricsMeta;
} {
  const windowEndExclusive = metricsWindowEndExclusive(windows);
  /** Prior slice ends strictly before current window start. */
  const priorEndExclusive = windows.windowStart;

  const activeResolved =
    activeBucketIds && activeBucketIds.length > 0
      ? activeBucketIds
      : BUCKET_DEFINITIONS.map((b) => b.id);
  const activeSet = new Set<SubjectBucketId>(activeResolved);
  const defsActive = BUCKET_DEFINITIONS.filter((d) => activeSet.has(d.id));
  const allIds = defsActive.map((d) => d.id);

  const subjectsByReview = reviews.map((r) => ({
    r,
    subjects: new Set(
      [...subjectBucketsForReview(r.comment, r.aiSummary)].filter((sid) =>
        activeSet.has(sid)
      )
    ),
  }));

  const fullCount = new Map<SubjectBucketId, number>();
  const winRatings = new Map<SubjectBucketId, number[]>();
  const priorRatings = new Map<SubjectBucketId, number[]>();
  const winExamples = new Map<SubjectBucketId, Array<{ rating: number; snippet: string }>>();

  for (const id of allIds) {
    fullCount.set(id, 0);
    winRatings.set(id, []);
    priorRatings.set(id, []);
    winExamples.set(id, []);
  }

  for (const { r, subjects } of subjectsByReview) {
    for (const sid of subjects) {
      fullCount.set(sid, (fullCount.get(sid) ?? 0) + 1);
    }
    if (inRange(r.reviewTime, windows.windowStart, windowEndExclusive)) {
      for (const sid of subjects) {
        winRatings.get(sid)!.push(r.rating);
        const ex = winExamples.get(sid)!;
        if (ex.length < MAX_BUCKET_EXAMPLES * 4) {
          ex.push({
            rating: r.rating,
            snippet: snippetFrom(r.comment ?? r.aiSummary ?? "", 140),
          });
        }
      }
    }
    if (inRange(r.reviewTime, windows.priorWindowStart, priorEndExclusive)) {
      for (const sid of subjects) {
        priorRatings.get(sid)!.push(r.rating);
      }
    }
  }

  const bucketInsights: BucketInsightRow[] = defsActive.map((def) => {
    const taggedCountFullCorpus = fullCount.get(def.id) ?? 0;
    const wr = winRatings.get(def.id) ?? [];
    const taggedCountWindow = wr.length;
    const healthScore = healthScoreFromRatings(wr);
    const pr = priorRatings.get(def.id) ?? [];
    const priorHealth = healthScoreFromRatings(pr);
    const tm = trendMultiplierFromHealths(
      healthScore,
      priorHealth,
      pr.length
    );
    const band = bandFromHealth(healthScore);
    const worsening =
      priorHealth != null &&
      healthScore != null &&
      pr.length >= PRIOR_WINDOW_MIN_COUNT &&
      healthScore < priorHealth - WORSENING_HEALTH_DELTA_THRESHOLD;
    const healthDeltaVsPrior =
      priorHealth != null && healthScore != null && pr.length >= PRIOR_WINDOW_MIN_COUNT
        ? Math.round((priorHealth - healthScore) * 10) / 10
        : null;
    const ps = priorityScore({
      taggedCountWindow,
      healthScore,
      trendMultiplier: tm,
    });

    const examples = (winExamples.get(def.id) ?? [])
      .sort((a, b) => a.rating - b.rating)
      .slice(0, MAX_BUCKET_EXAMPLES)
      .map((x) => x.snippet)
      .filter(Boolean);

    return {
      id: def.id,
      label: def.label,
      taggedCountWindow,
      taggedCountFullCorpus,
      healthScore,
      band,
      priorityScore: ps,
      workOnThisLine: workOnThisLine(band, worsening, taggedCountWindow),
      exampleSnippets: examples,
      healthDeltaVsPrior,
    };
  });

  const bucketTrend: BucketTrendRow[] = [];
  for (
    let d = startOfUtcDay(windows.windowStart);
    d < windowEndExclusive;
    d = addUtcDays(d, 1)
  ) {
    const dk = dayKeyUtc(d);
    const dayStart = d;
    const dayEnd = addUtcDays(d, 1);
    for (const def of defsActive) {
      const dayRatings: number[] = [];
      for (const { r, subjects } of subjectsByReview) {
        if (!subjects.has(def.id)) continue;
        if (!inRange(r.reviewTime, dayStart, dayEnd)) continue;
        dayRatings.push(r.rating);
      }
      const count = dayRatings.length;
      const avgRating = meanRating(dayRatings);
      const hs = healthScoreFromRatings(dayRatings);
      bucketTrend.push({
        date: dk,
        bucketId: def.id,
        count,
        avgRating,
        healthScore: hs,
      });
    }
  }

  const locMap = new Map<
    string,
    { title: string; winByBucket: Map<SubjectBucketId, number[]>; fullByBucket: Map<SubjectBucketId, number>; exByBucket: Map<SubjectBucketId, Array<{ rating: number; snippet: string }>> }
  >();

  for (const { r, subjects } of subjectsByReview) {
    const title = r.locationTitle;
    if (!locMap.has(r.locationKey)) {
      const fullByBucket = new Map<SubjectBucketId, number>();
      const winByBucket = new Map<SubjectBucketId, number[]>();
      const exByBucket = new Map<SubjectBucketId, Array<{ rating: number; snippet: string }>>();
      for (const id of allIds) {
        fullByBucket.set(id, 0);
        winByBucket.set(id, []);
        exByBucket.set(id, []);
      }
      locMap.set(r.locationKey, { title, winByBucket, fullByBucket, exByBucket });
    }
    const cell = locMap.get(r.locationKey)!;
    for (const sid of subjects) {
      cell.fullByBucket.set(sid, (cell.fullByBucket.get(sid) ?? 0) + 1);
    }
    if (inRange(r.reviewTime, windows.windowStart, windowEndExclusive)) {
      for (const sid of subjects) {
        cell.winByBucket.get(sid)!.push(r.rating);
        const ex = cell.exByBucket.get(sid)!;
        if (ex.length < 12) {
          ex.push({
            rating: r.rating,
            snippet: snippetFrom(r.comment ?? r.aiSummary ?? "", 120),
          });
        }
      }
    }
  }

  const locScores = Array.from(locMap.entries()).map(([locationId, v]) => {
    let vol = 0;
    for (const id of allIds) {
      vol += (v.winByBucket.get(id) ?? []).length;
    }
    return { locationId, title: v.title, cell: v, vol };
  });
  locScores.sort((a, b) => b.vol - a.vol);
  const topLocs = locScores.slice(0, MAX_LOCATIONS);

  const bucketByLocation: BucketByLocationRow[] = topLocs.map(({ locationId, title, cell }) => ({
    locationId,
    title,
    buckets: defsActive.map((def) => {
      const wr = cell.winByBucket.get(def.id) ?? [];
      const taggedCountWindow = wr.length;
      const taggedCountFullCorpus = cell.fullByBucket.get(def.id) ?? 0;
      const healthScore = healthScoreFromRatings(wr);
      const band = bandFromHealth(healthScore);
      const ex = (cell.exByBucket.get(def.id) ?? [])
        .sort((a, b) => a.rating - b.rating)
        .slice(0, 2)
        .map((x) => x.snippet);
      return {
        bucketId: def.id,
        taggedCountWindow,
        taggedCountFullCorpus,
        healthScore,
        band,
        priorityScore: priorityScore({
          taggedCountWindow,
          healthScore,
          trendMultiplier: 1,
        }),
        workOnThisLine: workOnThisLine(band, false, taggedCountWindow),
        exampleSnippets: ex,
      };
    }),
  }));

  const bucketMetricsMeta: BucketMetricsMeta = {
    windowStart: windows.windowStart.toISOString(),
    windowEnd: windows.windowEnd.toISOString(),
    priorWindowStart: windows.priorWindowStart.toISOString(),
    priorWindowEnd: windows.priorWindowEnd.toISOString(),
    corpusReviewCount: reviews.length,
    range,
  };

  return {
    bucketDefinitions: defsActive,
    bucketInsights,
    bucketTrend,
    bucketByLocation,
    bucketMetricsMeta,
  };
}
