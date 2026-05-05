"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { markdownToHtml } from "@/lib/markdownLite";
import { ratingChipStyle } from "@/lib/ratingVisual";
import { BusinessesSection } from "./BusinessesSection";

type Review = {
  id: string;
  rating: number;
  userReview: string;
  aiSummary: string;
  aiActions: string;
  createdAt: string;
  business: { id: string; displayName: string } | null;
  businessLocation: { id: string; name: string } | null;
};

type ExternalReview = {
  id: string;
  rating: number;
  comment: string | null;
  aiSummary: string | null;
  aiActions: string | null;
  reviewerName: string | null;
  createTime: string;
  replyText: string | null;
  location: {
    id: string;
    locationTitle: string;
  };
};

type ExternalReviewResponse = {
  data: ExternalReview[];
  locations: { id: string; locationTitle: string }[];
};

export default function AdminPage() {
  const [gbpBanner, setGbpBanner] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"businesses" | "internal" | "google">(
    "businesses"
  );
  const [externalReviews, setExternalReviews] = useState<ExternalReview[]>([]);
  const [locations, setLocations] = useState<
    { id: string; locationTitle: string }[]
  >([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedRating, setSelectedRating] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [googleLoading, setGoogleLoading] = useState(false);
  /** `i:` internal review id, `g:` Google (external) review id */
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("gbp_connected");
    const e = sp.get("gbp_error");
    if (c) setGbpBanner("Google Business Profile connected.");
    else if (e) setGbpBanner(`Google connection issue: ${e}`);
    else setGbpBanner(null);
  }, []);

  async function fetchReviews() {
    const res = await fetch("/api/admin/reviews");
    const data = await res.json();
    setReviews(data.data || []);
    setLoading(false);
  }

  async function fetchExternalReviews(params?: {
    locationId?: string;
    rating?: string;
    startDate?: string;
  }) {
    setGoogleLoading(true);

    const url = new URL(window.location.origin + "/api/admin/external-reviews");
    if (params?.locationId) url.searchParams.set("locationId", params.locationId);
    if (params?.rating) url.searchParams.set("rating", params.rating);
    if (params?.startDate) url.searchParams.set("startDate", params.startDate);

    const res = await fetch(url.toString());
    const data: ExternalReviewResponse = await res.json();
    setExternalReviews(data.data || []);
    setLocations(data.locations || []);
    setGoogleLoading(false);
  }

  async function syncGoogleNow() {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: dateFrom || undefined }),
      });
      if (!res.ok) {
        console.error("Google sync failed", await res.text());
      }
      await fetchExternalReviews({
        locationId: selectedLocationId || undefined,
        rating: selectedRating || undefined,
        startDate: dateFrom || undefined,
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function generateAiForMissing() {
    const targetIds = externalReviews
      .filter((r) => !r.aiSummary)
      .map((r) => r.id);

    if (targetIds.length === 0) return;

    setGoogleLoading(true);
    try {
      const res = await fetch(
        "/api/admin/external-reviews/generate-ai",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reviewIds: targetIds }),
        }
      );
      if (!res.ok) {
        console.error(
          "Failed to generate AI for external reviews",
          await res.text()
        );
      }
      await fetchExternalReviews({
        locationId: selectedLocationId || undefined,
        rating: selectedRating || undefined,
        startDate: dateFrom || undefined,
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  /** Re-runs AI summaries for every Google review in the current filtered list (fixes stale/bad LLM rows). */
  async function regenerateAllAiInView() {
    const targetIds = externalReviews.map((r) => r.id);
    if (targetIds.length === 0) return;

    setGoogleLoading(true);
    try {
      const res = await fetch("/api/admin/external-reviews/generate-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reviewIds: targetIds }),
      });
      if (!res.ok) {
        console.error(
          "Failed to regenerate AI for external reviews",
          await res.text()
        );
      }
      await fetchExternalReviews({
        locationId: selectedLocationId || undefined,
        rating: selectedRating || undefined,
        startDate: dateFrom || undefined,
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function deleteInternalReview(id: string) {
    if (
      !window.confirm(
        "Delete this internal review permanently? This cannot be undone."
      )
    ) {
      return;
    }
    const key = `i:${id}`;
    setDeleteBusy(key);
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Failed to delete review", await res.text());
        return;
      }
      await fetchReviews();
    } finally {
      setDeleteBusy(null);
    }
  }

  async function deleteGoogleReviewCopy(id: string) {
    if (
      !window.confirm(
        "Remove this review from the app? If it still exists on Google Business Profile, the next sync may import it again."
      )
    ) {
      return;
    }
    const key = `g:${id}`;
    setDeleteBusy(key);
    try {
      const res = await fetch(
        `/api/admin/external-reviews/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        console.error("Failed to delete Google review row", await res.text());
        return;
      }
      await fetchExternalReviews({
        locationId: selectedLocationId || undefined,
        rating: selectedRating || undefined,
        startDate: dateFrom || undefined,
      });
    } finally {
      setDeleteBusy(null);
    }
  }

  useEffect(() => {
    fetchReviews();
    fetchExternalReviews();
    const interval = setInterval(fetchReviews, 5000); // auto-refresh internal reviews
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-16 font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8">
      <header className="border-b border-[var(--line)] pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
            Operations
          </p>
          <Link
            href="/admin/analytics"
            className="btn-ghost w-fit text-center no-underline sm:ml-auto"
          >
            Open analytics →
          </Link>
        </div>

        <nav
          className="mt-5 flex flex-wrap gap-2 border-b border-[var(--line)] pb-px"
          aria-label="Tabs"
        >
          <button
            type="button"
            className={`tab-trigger ${tab === "businesses" ? "tab-trigger--on" : ""}`}
            onClick={() => setTab("businesses")}
          >
            Business
          </button>
          <button
            type="button"
            className={`tab-trigger ${tab === "internal" ? "tab-trigger--on" : ""}`}
            onClick={() => setTab("internal")}
          >
            Internal
          </button>
          <button
            type="button"
            className={`tab-trigger ${tab === "google" ? "tab-trigger--on" : ""}`}
            onClick={() => setTab("google")}
          >
            Google review
          </button>
        </nav>

        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
            {tab === "businesses" ? "Business" : "Review stream"}
          </h1>
          <p className="muted mt-2 max-w-lg text-sm leading-relaxed">
            {tab === "businesses"
              ? "Create a business or edit an existing one—mint a review link and QR for customers."
              : "Internal submissions and imported Google corpus. Charts live under Analytics."}
          </p>
        </div>
      </header>
      {gbpBanner && (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--fg-soft)]">
          {gbpBanner}
        </div>
      )}

      {tab === "businesses" && (
        <BusinessesSection
          onConnectGoogle={() => {
            window.location.href = "/api/google/oauth/start";
          }}
        />
      )}

      {tab === "internal" && (
        <section className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          {reviews.map((r) => (
            <article
              key={r.id}
              className="panel p-5 transition-shadow hover:shadow-[0_0_0_1px_var(--line)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
                    Review
                  </h2>
                  {(r.business || r.businessLocation) && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      {[r.business?.displayName, r.businessLocation?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-soft)]">
                    {r.userReview}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rating-chip" style={ratingChipStyle(r.rating)}>
                    {r.rating} ★
                  </span>
                  <time className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                    {new Date(r.createdAt).toLocaleString()}
                  </time>
                  <button
                    type="button"
                    className="btn-ghost text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    disabled={deleteBusy !== null}
                    aria-label="Delete this internal review"
                    onClick={() => deleteInternalReview(r.id)}
                  >
                    {deleteBusy === `i:${r.id}` ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  AI Summary
                </h3>
                <div className="mt-1 text-sm text-[var(--fg-soft)]">
                  <div
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(r.aiSummary) }}
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "google" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="filter-label">Location</label>
              <select
                className="select-custom mt-1 block w-56 text-sm"
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  fetchExternalReviews({
                    locationId: e.target.value || undefined,
                    rating: selectedRating || undefined,
                    startDate: dateFrom || undefined,
                  });
                }}
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.locationTitle}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="filter-label">Rating</label>
              <select
                className="select-custom mt-1 block w-32 text-sm"
                value={selectedRating}
                onChange={(e) => {
                  setSelectedRating(e.target.value);
                  fetchExternalReviews({
                    locationId: selectedLocationId || undefined,
                    rating: e.target.value || undefined,
                    startDate: dateFrom || undefined,
                  });
                }}
              >
                <option value="">All</option>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    {r} ★
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="filter-label">From</label>
              <input
                type="date"
                className="mt-1 block border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--fg)]"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  fetchExternalReviews({
                    locationId: selectedLocationId || undefined,
                    rating: selectedRating || undefined,
                    startDate: e.target.value || undefined,
                  });
                }}
              />
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={syncGoogleNow}
              className="btn-solid disabled:opacity-45"
              disabled={googleLoading}
            >
              {googleLoading ? "Syncing…" : "Sync now"}
            </button>

            <button
              type="button"
              onClick={generateAiForMissing}
              className="btn-ghost disabled:opacity-45"
              disabled={googleLoading}
            >
              Generate AI for missing
            </button>

            <button
              type="button"
              onClick={regenerateAllAiInView}
              className="btn-ghost disabled:opacity-45"
              disabled={googleLoading || externalReviews.length === 0}
              title="Re-runs the AI summary for every review in the current list (uses API credits)"
            >
              Regenerate all AI in view
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
            {externalReviews.map((r) => (
              <article
                key={r.id}
                className="panel p-5 transition-shadow hover:shadow-[0_0_0_1px_var(--line)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--fg)]">
                      <span>{r.location.locationTitle}</span>
                      {r.reviewerName && (
                        <span className="text-xs text-[var(--muted)]">
                          · {r.reviewerName}
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-soft)]">
                      {r.comment || "(No comment text provided)"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rating-chip" style={ratingChipStyle(r.rating)}>
                      {r.rating} ★
                    </span>
                    <time className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                      {new Date(r.createTime).toLocaleString()}
                    </time>
                    <button
                      type="button"
                      className="btn-ghost text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      disabled={deleteBusy !== null || googleLoading}
                      aria-label="Remove this Google review from the app"
                      title="Removes the imported copy from this app. Sync may fetch it again if it still exists on Google."
                      onClick={() => deleteGoogleReviewCopy(r.id)}
                    >
                      {deleteBusy === `g:${r.id}` ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <h3 className="filter-label">Public reply (Google)</h3>
                  {r.replyText ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-soft)]">
                      {r.replyText}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      No public reply on Google Business Profile for this review
                      yet—this app only shows what is already posted there.
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    AI Summary
                  </h3>
                  <div className="mt-1 text-sm text-[var(--fg-soft)]">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(r.aiSummary || ""),
                      }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
