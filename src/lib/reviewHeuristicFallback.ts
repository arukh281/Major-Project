/**
 * Deterministic admin copy when the LLM refuses or returns unusable text.
 * Uses only sanitized / neutral keyword cues (no raw slurs in logic).
 */
export function fallbackPublicReply(rating: number): string {
  if (rating <= 2) {
    return "We're sorry your visit did not meet expectations. We take this seriously and would welcome a chance to follow up—please reach out to us directly.";
  }
  return "Thank you for taking the time to share feedback—we appreciate it and hope to serve you again soon.";
}

/** Admin-facing summary when the customer submits stars only (no written review). */
export function ratingOnlyAdminSummary(rating: number): string {
  const lines = [
    `- Star rating only (${rating}/5); no written feedback.`,
    rating <= 2
      ? "- Low score suggests dissatisfaction; no specifics provided."
      : rating >= 4
        ? "- High score suggests an overall positive experience."
        : "- Mid-range score with no additional detail.",
  ];
  return lines.join("\n");
}

export function heuristicAdminSummary(
  rating: number,
  sanitizedReviewLower: string
): string {
  const t = sanitizedReviewLower;
  const bullets: string[] = [];

  const foodMention = /\bfood\b/.test(t);
  const staffMention = /\b(staff|server|servers|service|waiter|waitress)\b/.test(t);
  const foodPositive =
    foodMention &&
    /\b(good|great|nice|love|loved|delicious|tasty|amazing|excellent)\b/.test(t);
  const staffNegative =
    staffMention &&
    (rating <= 2 ||
      /\b(bad|poor|rude|slow|terrible|awful|horrible|worst|hate|angry|unprofessional)\b/.test(
        t
      ) ||
      t.includes("[redacted]"));

  if (foodPositive) {
    bullets.push("Customer expressed positive sentiment about food or menu.");
  }
  if (staffNegative) {
    bullets.push(
      "Customer expressed strong dissatisfaction with staff or service experience."
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      rating <= 2
        ? "Low rating with limited neutral keywords extracted; review text may be mostly emotional or redacted."
        : "Mixed or generic feedback; no strong theme detected from neutral keywords."
    );
  }
  return bullets.slice(0, 2).map((b) => `- ${b}`).join("\n");
}

export function heuristicAdminActions(
  rating: number,
  sanitizedReviewLower: string
): string {
  const t = sanitizedReviewLower;
  const lines: string[] = [];

  if (/\b(staff|server|service)\b/.test(t) && rating <= 2) {
    lines.push(
      "- Review service touchpoints with the team; reinforce professional tone and de-escalation."
    );
  }
  if (/\bfood\b/.test(t) && rating <= 2) {
    lines.push(
      "- Acknowledge kitchen wins they mentioned while addressing overall experience gaps."
    );
  }
  if (lines.length === 0) {
    lines.push(
      "- Log internally, watch for repeat low ratings in the same theme, and respond publicly with a calm improvement-focused message."
    );
  }
  if (lines.length < 2) {
    lines.push(
      "- If policy allows, invite the guest to continue the conversation offline for resolution."
    );
  }
  return lines.slice(0, 3).join("\n");
}
