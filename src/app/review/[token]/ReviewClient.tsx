"use client";

import { useState } from "react";
import { markdownToHtml } from "@/lib/markdownLite";
import {
  ratingChipStyle,
  ratingStarButtonStyle,
} from "@/lib/ratingVisual";

type Props = {
  token: string;
  business: { displayName: string; logoUrl: string | null };
  locations: { id: string; name: string }[];
};

export function ReviewClient({ token, business, locations }: Props) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  async function submitReview() {
    setLoading(true);
    setError("");
    setAiResponse("");

    try {
      const res = await fetch("/api/review-by-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          businessLocationId: locationId,
          rating,
          review,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setAiResponse(data.data.aiResponse);
      setReview("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (locations.length === 0) {
    return (
      <main className="container-center py-16">
        <p className="text-sm text-[var(--muted)]">
          This business has not set up any locations yet. Please check back
          later.
        </p>
      </main>
    );
  }

  return (
    <main className="container-center py-10">
      <header className="mb-10">
        {business.logoUrl ? (
          <div className="grid grid-cols-[auto,minmax(0,1fr)] gap-x-4 gap-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={business.logoUrl}
              alt=""
              className="row-span-2 self-center h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-[var(--line)]"
            />
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Review
              </p>
              <h1 className="hero-title mt-1">{business.displayName}</h1>
            </div>
            <p className="muted col-start-2 text-sm leading-relaxed">
              Tell us about your visit. Pick the location you visited, then
              choose a star rating. Written feedback is optional.
            </p>
          </div>
        ) : (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Review
            </p>
            <h1 className="hero-title mt-1">{business.displayName}</h1>
            <p className="muted mt-2 text-sm leading-relaxed">
              Tell us about your visit. Pick the location you visited, then
              choose a star rating. Written feedback is optional.
            </p>
          </div>
        )}
      </header>

      <section className="review-card">
        <div className="mb-6">
          <label className="block">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Location visited
            </div>
            <select
              className="select-custom mt-2 block w-full max-w-md text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Score
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={"star-btn " + (s <= rating ? "active" : "")}
                  style={ratingStarButtonStyle(s, rating)}
                  onClick={() => setRating(s)}
                  aria-label={`Set rating ${s}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="rating-pill" style={ratingChipStyle(rating)}>
            {rating} / 5
          </div>
        </div>

        <label className="block">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Your feedback{" "}
            <span className="font-normal normal-case tracking-normal text-[var(--muted)]">
              (optional)
            </span>
          </div>
          <textarea
            className="review-textarea mt-2"
            rows={6}
            placeholder="Add details if you like—service, quality, wait time, atmosphere…"
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={submitReview}
            disabled={loading}
            className="submit-cta"
          >
            {loading ? "Sending…" : "Submit"}
          </button>
          {error && (
            <p className="text-sm text-[var(--chart-4)]" role="alert">
              {error}
            </p>
          )}
        </div>

        {aiResponse && (
          <div className="ai-response">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Response
            </h2>
            <div className="prose-custom mt-3 text-sm leading-relaxed text-[var(--fg-soft)]">
              <div
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(aiResponse),
                }}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
