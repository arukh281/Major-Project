"use client";

import type { CSSProperties } from "react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  OrgSynthesis,
  OrgSynthesisGrounding,
} from "@/lib/models/orgSynthesis";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

type Band = "red" | "amber" | "green" | "neutral";

type AnalyticsPayload = {
  generatedAt: string;
  range: string;
  trendSince: string;
  totals: {
    count: number;
    avgRating: number | null;
    negativeCount: number;
    withComment: number;
  };
  ratingHistogram: { rating: number; count: number }[];
  trend: { date: string; count: number }[];
  byLocation: {
    locationId: string;
    title: string;
    count: number;
    avgRating: number | null;
  }[];
  topThemes: { theme: string; count: number }[];
  alerts: Array<{
    keyword: string;
    count: number;
    examples: Array<{
      id: string;
      rating: number;
      locationTitle: string;
      snippet: string;
    }>;
  }>;
  bucketDefinitions?: Array<{ id: string; label: string; description: string }>;
  bucketInsights?: Array<{
    id: string;
    label: string;
    taggedCountWindow: number;
    taggedCountFullCorpus: number;
    healthScore: number | null;
    band: Band;
    priorityScore: number;
    workOnThisLine: string;
    exampleSnippets: string[];
    healthDeltaVsPrior?: number | null;
  }>;
  bucketTrend?: Array<{
    date: string;
    bucketId: string;
    count: number;
    avgRating: number | null;
    healthScore: number | null;
  }>;
  bucketByLocation?: Array<{
    locationId: string;
    title: string;
    buckets: Array<{
      bucketId: string;
      taggedCountWindow: number;
      taggedCountFullCorpus: number;
      healthScore: number | null;
      band: Band;
      priorityScore: number;
      workOnThisLine: string;
      exampleSnippets: string[];
    }>;
  }>;
  bucketMetricsMeta?: {
    windowStart: string;
    windowEnd: string;
    priorWindowStart: string;
    priorWindowEnd: string;
    corpusReviewCount: number;
    range: string;
  };
  windowTotals?: {
    count: number;
    avgRating: number | null;
    negativeCount: number;
    withComment: number;
  };
  priorWindowTotals?: {
    count: number;
    avgRating: number | null;
    negativeCount: number;
    withComment: number;
  };
  worstLocationsWindow?: Array<{
    locationId: string;
    title: string;
    count: number;
    avgRating: number | null;
    lowScoreShare: number;
  }>;
};

/** Saturated series colors — distinct in light & dark (not theme chart-*). */
const ANALYTICS_SERIES_COLORS = [
  "#0d9488",
  "#c2410c",
  "#7c3aed",
  "#db2777",
  "#0369a1",
  "#4d7c0f",
  "#a21caf",
  "#b45309",
] as const;

/** Histogram: low rating → warm, high → cool green. */
const RATING_BAR_COLORS: Record<number, string> = {
  1: "#9f1239",
  2: "#c2410c",
  3: "#a16207",
  4: "#15803d",
  5: "#0f7669",
};

const ARRIVAL_STROKE = "#0f7669";
const ARRIVAL_FILL_TOP = "rgba(15, 118, 105, 0.42)";
const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)",
  borderRadius: 0,
  fontSize: 11,
  outline: "none",
  boxShadow:
    "0 2px 14px color-mix(in oklab, var(--fg) 12%, transparent)",
};
const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = { color: "var(--fg)" };
const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = { color: "var(--muted)" };

/** Inline so fills always win over Tailwind / layer order (pills were rendering as plain text). */
const BAND_PILL_STYLE: Record<Band, CSSProperties> = {
  red: {
    backgroundColor: "#be123c",
    border: "1px solid #881337",
    color: "#fff",
    boxShadow: "none",
  },
  amber: {
    backgroundColor: "#ea580c",
    border: "1px solid #9a3412",
    color: "#fffbeb",
    boxShadow: "none",
  },
  green: {
    backgroundColor: "#059669",
    border: "1px solid #047857",
    color: "#ecfdf5",
    boxShadow: "none",
  },
  neutral: {
    backgroundColor: "#57534e",
    border: "1px solid #292524",
    color: "#fafaf9",
    boxShadow: "none",
  },
};

function normalizeBand(raw: string | undefined): Band {
  const x = (raw ?? "neutral").toLowerCase();
  if (x === "red" || x === "amber" || x === "green" || x === "neutral") {
    return x;
  }
  return "neutral";
}

function BandPill({ band }: { band: string }) {
  const key = normalizeBand(band);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
      style={BAND_PILL_STYLE[key]}
    >
      {key}
    </span>
  );
}

function formatDateTick(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type DeltaTone = "positive" | "negative" | "neutral";

function signedDelta(value: number, digits = 0) {
  const abs = Math.abs(value);
  const fixed = digits > 0 ? abs.toFixed(digits) : String(Math.round(abs));
  if (value === 0) return `0`;
  return `${value > 0 ? "+" : "-"}${fixed}`;
}

const RANGE_LABELS: Record<string, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 365 days",
  all: "All time",
};

type AnalyticsReadMode = "overview" | "full";

/** Full-report sections: topics, trends, AI overview. */
type FullReportSection = "subjects" | "trends" | "synthesis";

function parseFullSection(raw: string | null): FullReportSection {
  if (raw === "trends") return "trends";
  if (raw === "synthesis") return "synthesis";
  return "subjects";
}

function AnalyticsRouteFallback() {
  return (
    <div
      className="admin-analytics mx-auto max-w-7xl space-y-8 px-5 py-10 pb-16"
      aria-busy="true"
      aria-label="Loading analytics"
    >
      <div className="panel p-5 sm:p-6 motion-safe:animate-pulse motion-reduce:animate-none">
        <div className="h-2.5 w-28 bg-[color-mix(in_oklab,var(--fg)_10%,var(--surface))]" />
        <div className="mt-4 h-8 max-w-md bg-[color-mix(in_oklab,var(--fg)_10%,var(--surface))]" />
        <div className="mt-3 h-4 max-w-lg bg-[color-mix(in_oklab,var(--fg)_7%,var(--surface))]" />
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="h-9 w-[11rem] bg-[color-mix(in_oklab,var(--fg)_8%,var(--surface))]" />
          <div className="h-9 w-28 bg-[color-mix(in_oklab,var(--fg)_8%,var(--surface))]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 motion-safe:animate-pulse motion-reduce:animate-none">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel px-4 py-3.5">
            <div className="h-2 w-20 bg-[color-mix(in_oklab,var(--fg)_10%,var(--surface))]" />
            <div className="mt-2 h-7 w-16 bg-[color-mix(in_oklab,var(--fg)_12%,var(--surface))]" />
            <div className="mt-2 h-3 w-full max-w-[12rem] bg-[color-mix(in_oklab,var(--fg)_7%,var(--surface))]" />
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
        Loading snapshot…
      </p>
    </div>
  );
}

function AnalyticsPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const readMode: AnalyticsReadMode =
    searchParams.get("view") === "full" ? "full" : "overview";

  const fullReportSection = useMemo(
    () => parseFullSection(searchParams.get("section")),
    [searchParams]
  );

  const applyAnalyticsQuery = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mutate(p);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setReadMode = useCallback(
    (mode: AnalyticsReadMode) => {
      applyAnalyticsQuery((p) => {
        if (mode === "overview") {
          p.set("view", "overview");
          p.delete("section");
        } else {
          p.set("view", "full");
          if (!p.get("section")) p.set("section", "subjects");
        }
      });
    },
    [applyAnalyticsQuery]
  );

  const setFullReportSection = useCallback(
    (section: FullReportSection) => {
      applyAnalyticsQuery((p) => {
        p.set("view", "full");
        p.set("section", section);
      });
    },
    [applyAnalyticsQuery]
  );

  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [range, setRange] = useState<"week" | "month" | "year" | "all">("all");
  const [bucketBandFilter, setBucketBandFilter] = useState<"all" | Band>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [synthesis, setSynthesis] = useState<OrgSynthesis | null>(null);
  const [synthesisGrounding, setSynthesisGrounding] =
    useState<OrgSynthesisGrounding | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const url = new URL(
        window.location.origin + "/api/admin/analytics"
      );
      url.searchParams.set("range", range);
      const res = await fetch(url.toString());
      if (!res.ok) {
        setErr(await res.text());
        setData(null);
        return;
      }
      const payload = (await res.json()) as AnalyticsPayload;
      setData(payload);
    } catch {
      setErr(
        "Could not load analytics. Check your connection, then press Refresh data."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const stripMetrics = useMemo(() => {
    if (!data) return { negPct: 0, textPct: 0 };
    const t = data.windowTotals ?? data.totals;
    const negPct =
      t.count > 0 ? Math.round((t.negativeCount / t.count) * 100) : 0;
    const textPct =
      t.count > 0 ? Math.round((t.withComment / t.count) * 100) : 0;
    return { negPct, textPct };
  }, [data]);

  const kpiDeltas = useMemo(() => {
    if (!data?.windowTotals || !data.priorWindowTotals) return null;
    const current = data.windowTotals;
    const prior = data.priorWindowTotals;
    const avgDelta =
      current.avgRating != null && prior.avgRating != null
        ? current.avgRating - prior.avgRating
        : null;
    const countDelta = current.count - prior.count;
    const negativeDelta = current.negativeCount - prior.negativeCount;
    const withCommentDelta = current.withComment - prior.withComment;

    return {
      count: {
        text: `${signedDelta(countDelta)} vs prior`,
        tone: countDelta > 0 ? "positive" : countDelta < 0 ? "negative" : "neutral",
      } as { text: string; tone: DeltaTone },
      avgRating:
        avgDelta == null
          ? null
          : ({
              text: `${signedDelta(avgDelta, 2)} vs prior`,
              tone:
                avgDelta > 0 ? "positive" : avgDelta < 0 ? "negative" : "neutral",
            } as { text: string; tone: DeltaTone }),
      negativeCount: {
        text: `${signedDelta(negativeDelta)} vs prior`,
        tone:
          negativeDelta < 0
            ? "positive"
            : negativeDelta > 0
              ? "negative"
              : "neutral",
      } as { text: string; tone: DeltaTone },
      withComment: {
        text: `${signedDelta(withCommentDelta)} vs prior`,
        tone:
          withCommentDelta > 0
            ? "positive"
            : withCommentDelta < 0
              ? "negative"
              : "neutral",
      } as { text: string; tone: DeltaTone },
    };
  }, [data?.priorWindowTotals, data?.windowTotals]);

  const attentionHighlights = useMemo(() => {
    if (!data) return [];
    const lowHealth = [...(data.bucketInsights ?? [])]
      .filter((b) => b.healthScore != null && b.taggedCountWindow > 0)
      .sort((a, b) => (a.healthScore ?? 101) - (b.healthScore ?? 101))[0];
    const worsening = [...(data.bucketInsights ?? [])]
      .filter((b) => (b.healthDeltaVsPrior ?? 0) > 0 && b.taggedCountWindow > 0)
      .sort((a, b) => (b.healthDeltaVsPrior ?? 0) - (a.healthDeltaVsPrior ?? 0))[0];
    const worstLocation = data.worstLocationsWindow?.[0];

    return [
      {
        id: "low-health",
        label: "Lowest topic health",
        value:
          lowHealth == null
            ? "No tagged topics in this window"
            : `${lowHealth.label} (${lowHealth.healthScore})`,
        detail:
          lowHealth == null
            ? "Nothing to rank yet"
            : `Priority ${lowHealth.priorityScore} · ${lowHealth.taggedCountWindow} reviews in window`,
      },
      {
        id: "worsening",
        label: "Largest health drop",
        value:
          worsening == null
            ? "No drop vs prior window"
            : `${worsening.label} (worse by ${worsening.healthDeltaVsPrior})`,
        detail:
          worsening == null
            ? "Stable compared with last period"
            : `Health now ${worsening.healthScore ?? "—"} · ${worsening.taggedCountWindow} reviews in window`,
      },
      {
        id: "worst-location",
        label: "Strained location",
        value:
          worstLocation == null
            ? "No location stands out in this range"
            : `${worstLocation.title} (${Math.round(
                worstLocation.lowScoreShare * 100
              )}% ≤2★)`,
        detail:
          worstLocation == null
            ? "Try a wider date range"
            : `${worstLocation.count} reviews · avg ${
                worstLocation.avgRating?.toFixed(2) ?? "—"
              }`,
      },
    ];
  }, [data]);

  const filteredBucketInsights = useMemo(() => {
    const rows = [...(data?.bucketInsights ?? [])].sort(
      (a, b) => b.priorityScore - a.priorityScore
    );
    if (bucketBandFilter === "all") return rows;
    return rows.filter((b) => b.band === bucketBandFilter);
  }, [bucketBandFilter, data?.bucketInsights]);

  /** Highest-priority buckets with window signal (Overview strip). */
  const overviewTopBuckets = useMemo(() => {
    return [...(data?.bucketInsights ?? [])]
      .filter((b) => b.taggedCountWindow > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 3);
  }, [data?.bucketInsights]);

  const bucketTrendChartData = useMemo(() => {
    if (!data?.bucketTrend?.length) return [];
    const rows = data.bucketTrend;
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const ids = data.bucketDefinitions?.map((b) => b.id) ?? [];
    return dates.map((date) => {
      const row: Record<string, string | number> = { date };
      for (const id of ids) {
        row[id] =
          rows.find((t) => t.date === date && t.bucketId === id)?.count ?? 0;
      }
      return row;
    });
  }, [data?.bucketTrend, data?.bucketDefinitions]);

  async function runStrategy() {
    setStrategyLoading(true);
    setSynthesis(null);
    setSynthesisGrounding(null);
    setSynthesisError(null);
    try {
      const res = await fetch("/api/admin/analytics/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: data?.range ?? range }),
      });
      const j = await res.json();
      if (!res.ok) {
        setSynthesisError(
          typeof j.error === "string"
            ? j.error
            : "Could not generate overview. Try again."
        );
        return;
      }
      if (j.synthesis && typeof j.synthesis === "object") {
        setSynthesis(j.synthesis as OrgSynthesis);
        if (j.grounding && typeof j.grounding === "object") {
          setSynthesisGrounding(j.grounding as OrgSynthesisGrounding);
        }
      } else {
        setSynthesisError("Unexpected response from server. Try again.");
      }
    } finally {
      setStrategyLoading(false);
    }
  }

  if (loading && !data) {
    return <AnalyticsRouteFallback />;
  }

  return (
    <main className="admin-analytics mx-auto max-w-7xl space-y-8 px-5 py-10 pb-16">
      <header className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 xl:max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Review intelligence
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--fg)]">
              Operations analytics
            </h1>
            <div className="mt-2 min-h-[3.25rem] max-w-2xl">
              {readMode === "full" ? (
                <p className="muted text-sm leading-relaxed">
                  Tabs for topics, trend charts, or an AI overview. Dates match your
                  range above.
                </p>
              ) : (
                <p className="muted text-sm leading-snug">
                  Headline counts and priority topics for your range. Full charts live
                  under Full report.
                </p>
              )}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-4 sm:w-auto xl:min-w-[min(100%,22rem)] xl:max-w-md xl:pt-0">
            <fieldset className="flex w-full flex-col gap-1.5 sm:w-fit sm:self-end">
              <legend className="sr-only">Choose summary or full analytics</legend>
              <span className="filter-label">View</span>
              <div
                className="flex w-fit max-w-full rounded-sm border border-[var(--line)] p-0.5"
                role="group"
                aria-label="Summary or full analytics"
              >
                {(
                  [
                    { id: "overview" as const, label: "Overview" },
                    { id: "full" as const, label: "Full report" },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`focus-ring-accent inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-sm px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors duration-150 ease-out ${
                      readMode === id
                        ? "bg-[var(--fg)] text-[var(--surface)] hover:opacity-[0.92]"
                        : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
                    }`}
                    onClick={() => setReadMode(id)}
                    aria-pressed={readMode === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-end gap-3 sm:justify-end">
              <div>
                <label htmlFor="analytics-range" className="filter-label">
                  Time range
                </label>
                <select
                  id="analytics-range"
                  className="select-custom mt-1 block h-10 min-h-10 min-w-[11rem] font-mono text-sm text-[var(--fg)]"
                  value={range}
                  onChange={(e) =>
                    setRange(e.target.value as "week" | "month" | "year" | "all")
                  }
                >
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <button
                type="button"
                className="btn-ghost h-10 min-w-[8.5rem] justify-center"
                onClick={() => void load()}
              >
                Refresh data
              </button>
            </div>
          </div>
        </div>
      </header>

      {err && (
        <div
          className="rounded-sm border border-[color-mix(in_oklab,var(--danger-fg)_28%,var(--line))] bg-[color-mix(in_oklab,var(--danger-fg)_06%,var(--surface))] px-4 py-3"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm leading-snug text-[var(--danger-fg)]">{err}</p>
        </div>
      )}

      {data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Reviews"
              value={String(data.windowTotals?.count ?? data.totals.count)}
              hint={`In selected window · ${RANGE_LABELS[data.range] ?? data.range}`}
              delta={kpiDeltas?.count ?? null}
            />
            <Kpi
              label="Mean rating"
              value={
                (data.windowTotals?.avgRating ?? data.totals.avgRating) == null
                  ? "—"
                  : (data.windowTotals?.avgRating ?? data.totals.avgRating)!.toFixed(
                      2
                    )
              }
              hint="Average for selected window · scale 1 to 5"
              delta={kpiDeltas?.avgRating ?? null}
            />
            <Kpi
              label="≤2★ reviews"
              value={String(
                data.windowTotals?.negativeCount ?? data.totals.negativeCount
              )}
              hint="Count in selected window · very low ratings"
              delta={kpiDeltas?.negativeCount ?? null}
            />
            <Kpi
              label="With comments"
              value={String(
                data.windowTotals?.withComment ?? data.totals.withComment
              )}
              hint="Reviews that include written text in selected window"
              delta={kpiDeltas?.withComment ?? null}
            />
          </section>

          <section
            className="panel-muted border border-[var(--line)] px-4 py-3"
            aria-label="Signals for this window"
          >
            <ul className="space-y-3">
              {attentionHighlights.map((item) => (
                <li
                  key={item.id}
                  className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug text-[var(--fg)]">
                    {item.value}
                  </p>
                  <p className="muted mt-0.5 text-[11px] leading-snug">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          {readMode === "overview" && (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
                    Top topics (this window)
                  </h2>
                  <p className="muted mt-0.5 max-w-xl text-xs">
                    From automatic tags. Full topic list and charts are in Full report.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-solid min-h-10 shrink-0 self-start px-4 py-2.5 sm:self-auto"
                  onClick={() => setReadMode("full")}
                >
                  Open full report
                </button>
              </div>
              {overviewTopBuckets.length === 0 ? (
                <p className="panel-muted p-4 text-sm text-[var(--muted)]">
                  No tagged topics in this window. Try Full report for charts, or
                  widen the time range.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line)] border border-[var(--line)] bg-[var(--surface)]">
                  {overviewTopBuckets.map((b, idx) => (
                    <li
                      key={b.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                          className="font-mono text-[10px] tabular-nums text-[var(--muted)]"
                          aria-hidden
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[var(--fg)]">
                              {b.label}
                            </span>
                            <BandPill band={b.band} />
                          </div>
                          <p className="muted mt-1 line-clamp-2 text-xs leading-snug">
                            {b.workOnThisLine}
                          </p>
                        </div>
                      </div>
                      <dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--muted)] sm:flex-col sm:items-end sm:text-right">
                        <div>
                          <dt className="sr-only">Health</dt>
                          <dd>
                            <span className="text-[var(--muted)]">Health </span>
                            <span className="tabular-nums text-[var(--fg)]">
                              {b.healthScore ?? "—"}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">Reviews in this window</dt>
                          <dd>
                            <span className="text-[var(--muted)]">In window </span>
                            <span className="tabular-nums text-[var(--fg)]">
                              {b.taggedCountWindow}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {readMode === "full" && (
            <>
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                Full report
              </p>
              <p className="muted mt-1 max-w-md text-xs leading-snug">
                Topics, charts, or AI overview as separate tabs.
              </p>
            </div>
            <div
              className="flex shrink-0 flex-wrap rounded-sm border border-[var(--line)] p-0.5"
              role="tablist"
              aria-label="Full report: topics, trends, AI overview"
            >
              {(
                [
                  { id: "subjects" as const, label: "Topics" },
                  { id: "trends" as const, label: "Trends & volume" },
                  { id: "synthesis" as const, label: "AI overview" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`analytics-full-tab-${id}`}
                  aria-selected={fullReportSection === id}
                  aria-controls={`analytics-full-panel-${id}`}
                  className={`focus-ring-accent inline-flex min-h-11 min-w-[7rem] shrink-0 items-center justify-center rounded-sm px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors duration-150 ease-out ${
                    fullReportSection === id
                      ? "bg-[var(--fg)] text-[var(--surface)] hover:opacity-[0.92]"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)]"
                  }`}
                  onClick={() => setFullReportSection(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[12rem] space-y-8">
          {fullReportSection === "subjects" && (
            <div
              role="tabpanel"
              id="analytics-full-panel-subjects"
              aria-labelledby="analytics-full-tab-subjects"
            >
          {data.bucketInsights && data.bucketMetricsMeta && (
            <section className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
                    Review topics (tagged)
                  </h2>
                  <p className="muted mt-1 max-w-3xl text-xs leading-relaxed">
                    Tags come from review text and ratings. Health is 0 to 100 (higher
                    is better). Window counts compare to all-time.{" "}
                    {RANGE_LABELS[data.range] ?? data.range}:{" "}
                    {new Date(data.bucketMetricsMeta.windowStart).toLocaleDateString()}{" "}
                    –{" "}
                    {new Date(data.bucketMetricsMeta.windowEnd).toLocaleDateString()}.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    Severity
                  </span>
                  {(["all", "red", "amber"] as const).map((band) => (
                    <button
                      key={band}
                      type="button"
                      className={`focus-ring-accent inline-flex min-h-10 min-w-[3.25rem] items-center justify-center rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors duration-150 ease-out ${
                        bucketBandFilter === band
                          ? "border-[var(--fg)] text-[var(--fg)]"
                          : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--fg-soft)] hover:text-[var(--fg)]"
                      }`}
                      onClick={() => setBucketBandFilter(band)}
                      aria-pressed={bucketBandFilter === band}
                    >
                      {band === "all" ? "All" : band}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredBucketInsights.length === 0 ? (
                  <div className="panel-muted p-4 text-sm text-[var(--muted)] sm:col-span-2 xl:col-span-3">
                    No topics match this severity filter for your dates.
                  </div>
                ) : (
                  filteredBucketInsights.map((b) => (
                    <div
                      key={b.id}
                      className="panel border border-[var(--line)] p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-[var(--fg)]">
                          {b.label}
                        </h3>
                        <BandPill band={b.band} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-[var(--muted)]">
                        <div>
                          <dt>Health</dt>
                          <dd className="text-[var(--fg)]">
                            {b.healthScore == null ? "—" : `${b.healthScore}`}
                          </dd>
                        </div>
                        <div>
                          <dt>Priority</dt>
                          <dd className="text-[var(--fg)]">{b.priorityScore}</dd>
                        </div>
                        <div>
                          <dt>This window</dt>
                          <dd className="text-[var(--fg)]">{b.taggedCountWindow}</dd>
                        </div>
                        <div>
                          <dt>All time</dt>
                          <dd className="text-[var(--fg)]">{b.taggedCountFullCorpus}</dd>
                        </div>
                      </dl>
                      <p className="muted mt-3 text-xs leading-snug">
                        {b.workOnThisLine}
                      </p>
                      {b.exampleSnippets.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--fg-soft)]">
                          {b.exampleSnippets.map((s, i) => (
                            <li key={i} className="italic">
                              “{s}”
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                )}
              </div>

              {bucketTrendChartData.length > 0 && data.bucketDefinitions && (
                <ChartPanel
                  title="Topic volume over time"
                  subtitle="Reviews per day for each tagged topic in your window"
                >
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={bucketTrendChartData}>
                        <CartesianGrid strokeDasharray="3 6" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickMargin={8}
                          minTickGap={20}
                          tickFormatter={formatDateTick}
                        />
                        <YAxis allowDecimals={false} width={36} />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                          labelFormatter={(v) => formatDateTick(String(v))}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 10, color: "var(--fg)" }}
                        />
                        {data.bucketDefinitions.map((def, i) => (
                          <Line
                            key={def.id}
                            type="monotone"
                            dataKey={def.id}
                            name={def.label}
                            stroke={
                              ANALYTICS_SERIES_COLORS[
                                i % ANALYTICS_SERIES_COLORS.length
                              ]
                            }
                            strokeWidth={2.4}
                            dot={false}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartPanel>
              )}

              {data.bucketByLocation && data.bucketByLocation.length > 0 && (
                <ChartPanel
                  title="Topics by location"
                  subtitle="Where each tagged topic shows up in your window"
                >
                  <div className="max-h-[28rem] space-y-5 overflow-y-auto pr-1">
                    {data.bucketByLocation.map((loc) => (
                      <div
                        key={loc.locationId}
                        className="border-b border-[var(--line)] pb-5 last:border-0 last:pb-0"
                      >
                        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {loc.title}
                        </h3>
                        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
                          {loc.buckets
                            .filter((x) => x.taggedCountWindow > 0)
                            .sort((a, b) => b.priorityScore - a.priorityScore)
                            .map((b) => {
                              const label =
                                data.bucketDefinitions?.find(
                                  (d) => d.id === b.bucketId
                                )?.label ?? b.bucketId;
                              const snippet = b.exampleSnippets[0];
                              return (
                                <li
                                  key={b.bucketId}
                                  className="bucket-by-loc-card panel-muted space-y-2 p-4"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="min-w-0 flex-1 text-xs font-medium leading-snug text-[var(--fg)] break-words">
                                      {label}
                                    </h4>
                                    <BandPill band={b.band} />
                                  </div>
                                  <p className="flex flex-wrap items-baseline gap-2 font-mono text-[10px] leading-tight text-[var(--muted)]">
                                    <span>
                                      Reviews{" "}
                                      <span className="tabular-nums text-[var(--fg)]">
                                        {b.taggedCountWindow}
                                      </span>
                                    </span>
                                    <span>
                                      Health{" "}
                                      <span className="tabular-nums text-[var(--fg)]">
                                        {b.healthScore ?? "—"}
                                      </span>
                                    </span>
                                    <span>
                                      Priority{" "}
                                      <span className="tabular-nums text-[var(--fg)]">
                                        {b.priorityScore}
                                      </span>
                                    </span>
                                  </p>
                                  {snippet ? (
                                    <p className="line-clamp-2 text-[11px] leading-snug text-[var(--fg-soft)] italic">
                                      “{snippet}”
                                    </p>
                                  ) : null}
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ChartPanel>
              )}
            </section>
          )}
            {!data.bucketInsights || !data.bucketMetricsMeta ? (
              <div className="panel-muted p-6 text-sm text-[var(--muted)]">
                No topic metrics for these dates. Open{" "}
                <strong className="font-medium text-[var(--fg)]">Trends & volume</strong>{" "}
                for arrivals, rating spread, locations, and common phrases.
              </div>
            ) : null}
            </div>
          )}

          {fullReportSection === "trends" && (
            <div
              role="tabpanel"
              id="analytics-full-panel-trends"
              aria-labelledby="analytics-full-tab-trends"
              className="space-y-8"
            >
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartPanel
              className="lg:col-span-2"
              title="Review arrival trend"
              subtitle={`Daily review volume · ${RANGE_LABELS[data.range] ?? data.range}`}
            >
              {data.trend.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No review arrivals in this range.
                </p>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trend}>
                      <defs>
                        <linearGradient id="fillT" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ARRIVAL_FILL_TOP} />
                          <stop
                            offset="100%"
                            stopColor={ARRIVAL_STROKE}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickMargin={8}
                        minTickGap={24}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis allowDecimals={false} width={32} />
                      <Tooltip
                        cursor={false}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                        labelFormatter={(v) => formatDateTick(String(v))}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={ARRIVAL_STROKE}
                        strokeWidth={2.25}
                        fill="url(#fillT)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartPanel>

            <ChartPanel title="Composition" subtitle="Share of low scores and written comments">
              <div className="space-y-6 pt-2">
                <AbstractStrip
                  label="Low scores (≤2★)"
                  pct={stripMetrics.negPct}
                  tone="#c2410c"
                />
                <AbstractStrip
                  label="Reviews with text"
                  pct={stripMetrics.textPct}
                  tone="#0d9488"
                />
              </div>
            </ChartPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Rating spectrum" subtitle="Histogram">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ratingHistogram}>
                    <CartesianGrid strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="rating" tickFormatter={(v) => `${v}★`} />
                    <YAxis allowDecimals={false} width={32} />
                    <Tooltip
                      cursor={false}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 0, 0, 0]}
                      activeBar={false}
                      isAnimationActive={false}
                    >
                      {data.ratingHistogram.map((row) => (
                        <Cell
                          key={row.rating}
                          fill={
                            RATING_BAR_COLORS[row.rating] ??
                            ANALYTICS_SERIES_COLORS[0]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel
              title="Location load"
              subtitle="Review count by location (Google and in-app)"
            >
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data.byLocation.slice(0, 10)}
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 6" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="title"
                      width={120}
                      tickFormatter={(v) =>
                        v.length > 18 ? `${v.slice(0, 16)}…` : v
                      }
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      formatter={(value: number, _n, item) => {
                        const p = item?.payload as {
                          avgRating?: number | null;
                        };
                        const avg =
                          p?.avgRating != null ? p.avgRating.toFixed(2) : "—";
                        return [`${value} reviews · avg ${avg}`, "Reviews"];
                      }}
                    />
                    <Bar
                      dataKey="count"
                      activeBar={false}
                      isAnimationActive={false}
                    >
                      {data.byLocation.slice(0, 10).map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            ANALYTICS_SERIES_COLORS[
                              i % ANALYTICS_SERIES_COLORS.length
                            ]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartPanel
              title="Common phrases"
              subtitle="Words or short phrases that repeat in comments"
            >
              {data.topThemes.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No repeated phrases for this range.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={[...data.topThemes].reverse()}
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 6" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="theme" width={150} />
                      <Tooltip
                        cursor={false}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      />
                      <Bar
                        dataKey="count"
                        activeBar={false}
                        isAnimationActive={false}
                      >
                        {[...data.topThemes].reverse().map((_, i) => (
                          <Cell
                            key={i}
                            fill={
                              ANALYTICS_SERIES_COLORS[
                                i % ANALYTICS_SERIES_COLORS.length
                              ]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartPanel>

            <ChartPanel title="Watchlist words" subtitle="Reviews that contain these strings">
              {data.alerts.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No watchlist matches in this window.
                </p>
              ) : (
                <ul className="max-h-72 space-y-4 overflow-y-auto pr-1">
                  {data.alerts.map((a) => (
                    <li
                      key={a.keyword}
                      className="border-b border-[var(--line)] pb-3 last:border-0"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs text-[var(--fg)]">
                          {a.keyword}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--muted)]">
                          {a.count}
                        </span>
                      </div>
                      {a.examples.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-[var(--fg-soft)]">
                          {a.examples.map((ex) => (
                            <li key={ex.id}>
                              <span className="text-[var(--muted)]">
                                {ex.locationTitle}
                              </span>{" "}
                              · {ex.rating}★ — {ex.snippet}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ChartPanel>
          </div>
            </div>
          )}

          {fullReportSection === "synthesis" && (
            <div
              role="tabpanel"
              id="analytics-full-panel-synthesis"
              aria-labelledby="analytics-full-tab-synthesis"
            >
          <section className="panel p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
                  AI overview
                </h2>
                <p className="muted mt-1 text-xs">
                  One generated pass over the stats on this page. It surfaces patterns
                  and suggested next steps, not replies to individual reviews.
                </p>
              </div>
              <button
                type="button"
                className="btn-solid min-h-10 shrink-0 px-4 py-2.5"
                disabled={strategyLoading}
                onClick={() => void runStrategy()}
              >
                {strategyLoading ? "Generating…" : "Generate AI overview"}
              </button>
            </div>
            {synthesisError && (
              <p
                className="mt-5 rounded-sm border border-[color-mix(in_oklab,var(--danger-fg)_28%,var(--line))] bg-[color-mix(in_oklab,var(--danger-fg)_06%,var(--surface))] px-4 py-3 text-sm leading-snug text-[var(--danger-fg)]"
                role="alert"
              >
                {synthesisError}
              </p>
            )}
            {synthesis && (
              <div className="mt-6 space-y-5">
                {synthesisGrounding && (
                  <OrgGroundTruthStrip grounding={synthesisGrounding} />
                )}
                <OrgSynthesisOverview synthesis={synthesis} />
              </div>
            )}
            {!strategyLoading && !synthesis && !synthesisError && (
              <p className="mt-5 text-sm text-[var(--muted)]">
                Generate an AI overview to see themes and suggested actions from the
                numbers above.
              </p>
            )}
          </section>
            </div>
          )}
          </div>

            </>
          )}

          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Data{" "}
            {new Date(data.generatedAt).toLocaleString()} ·{" "}
            {RANGE_LABELS[data.range] ?? data.range} · reviews since{" "}
            {new Date(data.trendSince).toLocaleDateString()}
          </p>
        </>
      )}
    </main>
  );
}

function OrgGroundTruthStrip({
  grounding: g,
}: {
  grounding: OrgSynthesisGrounding;
}) {
  const avgLabel =
    g.avgRating == null ? "—" : `${g.avgRating.toFixed(2)} / 5`;
  const themeLine =
    g.topThemes.length === 0
      ? "None yet"
      : g.topThemes
          .slice(0, 4)
          .map((t) => `${t.theme} (${t.count})`)
          .join(" · ");
  const riskLine =
    g.riskKeywords.length === 0
      ? "None flagged"
      : g.riskKeywords
          .slice(0, 4)
          .map((r) => `${r.keyword} (${r.count})`)
          .join(" · ");

  const ext = g.externalReviewCount ?? 0;
  const int = g.internalReviewCount ?? 0;
  const lowBucketLine =
    (g.lowHealthBuckets?.length ?? 0) === 0
      ? "None in this window"
      : (g.lowHealthBuckets ?? [])
          .slice(0, 4)
          .map((b) => `${b.label} (${b.healthScore})`)
          .join(" · ");
  const worsenLine =
    (g.worseningBuckets?.length ?? 0) === 0
      ? "No change vs prior window"
      : (g.worseningBuckets ?? [])
          .slice(0, 4)
          .map((b) => `${b.label} (Δ${b.healthDeltaVsPrior})`)
          .join(" · ");
  const worstLocLine =
    (g.worstLocations?.length ?? 0) === 0
      ? "—"
      : (g.worstLocations ?? [])
          .slice(0, 3)
          .map(
            (l) =>
              `${l.title} (${Math.round(l.lowScoreShare * 100)}% ≤2★, n=${l.count})`
          )
          .join(" · ");

  return (
    <div className="panel-muted p-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Numbers fed to the model
      </p>
      <p className="muted mt-1 text-[11px] leading-snug">
        Same totals shown above (Google plus in-app reviews), passed through before the
        AI overview runs.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">
            Mean rating
          </dt>
          <dd className="font-mono-nums mt-1 text-xl font-medium tabular-nums tracking-tight text-[var(--fg)]">
            {avgLabel}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">
            Total reviews
          </dt>
          <dd className="font-mono-nums mt-1 text-xl font-medium tabular-nums tracking-tight text-[var(--fg)]">
            {g.totalReviews}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">
            Google / in-app
          </dt>
          <dd className="font-mono-nums mt-1 text-xl font-medium tabular-nums tracking-tight text-[var(--fg)]">
            {ext} / {int}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">
            Low scores (≤2★)
          </dt>
          <dd className="font-mono-nums mt-1 text-xl font-medium tabular-nums tracking-tight text-[var(--fg)]">
            {g.negativeCount}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">
            Share ≤2★
          </dt>
          <dd className="font-mono-nums mt-1 text-xl font-medium tabular-nums tracking-tight text-[var(--fg)]">
            {g.totalReviews > 0
              ? `${Math.round((g.negativeCount / g.totalReviews) * 100)}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted)]">
            Data mix
          </dt>
          <dd className="mt-1 text-xs font-medium capitalize text-[var(--fg)]">
            {g.corpusKind ?? "blended"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-xs leading-relaxed text-[var(--fg-soft)]">
        <p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Top phrases
          </span>
          <span className="mt-0.5 block">{themeLine}</span>
        </p>
        <p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Watchlist
          </span>
          <span className="mt-0.5 block">{riskLine}</span>
        </p>
        <p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Lowest-health topics
          </span>
          <span className="mt-0.5 block">{lowBucketLine}</span>
        </p>
        <p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Topics slipping
          </span>
          <span className="mt-0.5 block">{worsenLine}</span>
        </p>
        <p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Hardest locations
          </span>
          <span className="mt-0.5 block">{worstLocLine}</span>
        </p>
      </div>
    </div>
  );
}

function OrgSynthesisOverview({ synthesis }: { synthesis: OrgSynthesis }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
      <div className="panel-muted p-5 lg:min-h-[12rem]">
        <div className="flex items-baseline justify-between gap-2 border-b border-[var(--line)] pb-3">
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Patterns
          </h3>
          <span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">
            {synthesis.patterns.length}
          </span>
        </div>
        <ul className="mt-4 space-y-3.5" aria-label="Pattern list">
          {synthesis.patterns.map((text, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm leading-relaxed text-[var(--fg-soft)]"
            >
              <span
                className="font-mono-nums mt-0.5 w-6 shrink-0 text-right text-[10px] tabular-nums text-[var(--muted)]"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-sm border border-[var(--line)] bg-[color-mix(in_oklch,var(--chart-2)_14%,var(--surface))] p-5 lg:min-h-[12rem]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-[var(--chart-2)]"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="square"
              aria-hidden
            >
              <path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h6" />
            </svg>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Next steps
            </h3>
          </div>
          <span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">
            {synthesis.nextSteps.length}
          </span>
        </div>
        <ul className="mt-4 space-y-3.5" aria-label="Suggested next steps">
          {synthesis.nextSteps.map((step, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm leading-relaxed text-[var(--fg-soft)]"
            >
              <span
                className="font-mono-nums mt-0.5 w-6 shrink-0 text-right text-[10px] tabular-nums text-[var(--muted)]"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <strong className="font-semibold text-[var(--fg)]">
                  {step.keyword}
                </strong>{" "}
                {step.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: { text: string; tone: DeltaTone } | null;
}) {
  const deltaToneClass =
    delta?.tone === "positive"
      ? "border-[var(--delta-positive-border)] text-[var(--delta-positive-fg)]"
      : delta?.tone === "negative"
        ? "border-[var(--delta-negative-border)] text-[var(--delta-negative-fg)]"
        : "border-[var(--line)] text-[var(--muted)]";

  return (
    <div className="panel px-4 py-3.5 sm:px-4 sm:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
            {label}
          </p>
          <p className="font-mono-nums mt-1 text-xl font-medium tabular-nums tracking-tight text-[var(--fg)] sm:text-2xl">
            {value}
          </p>
        </div>
        {delta && (
          <span
            className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${deltaToneClass}`}
          >
            {delta.text}
          </span>
        )}
      </div>
      <p className="muted mt-1.5 text-[11px] leading-snug">{hint}</p>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`panel p-5 ${className}`}>
      <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
        {title}
      </h2>
      <p className="muted mt-0.5 text-xs">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function AbstractStrip({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2.5 w-full border border-[var(--line)] bg-[var(--surface)]">
        <div
          className="h-full max-w-full motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out motion-reduce:transition-none"
          style={{ width: `${Math.min(100, pct)}%`, background: tone }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsRouteFallback />}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
