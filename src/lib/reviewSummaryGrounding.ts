/**
 * Detects when an LLM summary likely describes a different review than `reviewText`
 * (small instruct models sometimes drift). Used to fall back to heuristics.
 */

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "are",
  "was",
  "were",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "one",
  "our",
  "out",
  "they",
  "them",
  "their",
  "have",
  "has",
  "been",
  "being",
  "also",
  "into",
  "than",
  "then",
  "what",
  "when",
  "where",
  "which",
  "while",
  "about",
  "after",
  "before",
  "there",
  "here",
  "more",
  "some",
  "very",
  "just",
  "only",
  "even",
  "such",
  "both",
  "each",
  "other",
  "review",
  "reviewer",
  "customer",
  "business",
  "experience",
  "feedback",
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns true when we cannot verify grounding (very short/generic text) or
 * when at least one substantive token from the review appears in the summary.
 */
export function isSummaryGroundedInReview(
  reviewText: string,
  summary: string
): boolean {
  const flat = reviewText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = flat.split(" ").filter((w) => w.length > 0);
  const content = tokens.filter(
    (w) => w.length >= 3 && !STOP.has(w)
  );
  const unique = [...new Set(content)];

  if (unique.length < 2) {
    return true;
  }

  let hits = 0;
  for (const w of unique) {
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, "i");
    if (re.test(summary)) {
      hits += 1;
      if (hits >= 1) {
        return true;
      }
    }
  }

  return false;
}
