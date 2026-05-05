/**
 * Redacts coarse language in review text before sending it to an LLM API.
 * Original review text is still stored verbatim in the database; this is prompt-only.
 */
export function sanitizeReviewForLlm(input: string): string {
  let s = input;
  for (const re of REDACTION_PATTERNS) {
    s = s.replace(re, "[redacted]");
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

const REDACTION_PATTERNS: RegExp[] = [
  /\b(f+u*c+k+(e?r|i+n*g|s)?|fck+|fcuk|fuk)\b/gi,
  /\b(s+h+i+t+|sh1t|sht)\b/gi,
  /\b(b+i+t+c+h+|b1tch)\b/gi,
  /\b(m+o+t+h+e+r*f+u*c+k+|mthrfckr|mofo)\w*\b/gi,
  /\b(d+i+c+k+|d1ck|dck)\w*\b/gi,
  /\b(c+u+n+t+)\w*\b/gi,
  /\b(a+s+s+h+o+l+e+|a[s$][s$]h*o+l+e+)\w*\b/gi,
  /\b(b+a+s+t+a+r+d+|bstrd)\w*\b/gi,
  /\b(d+a+m+n+|dmn|hell)\b/gi,
  /\b(c+r+a+p+)\b/gi,
  /\b(p+i+s+s+)\w*\b/gi,
  /\b(c+o+c+k+|c0ck)\w*\b/gi,
  /\b(n+i+g+g+|n1gg)\w*\b/gi,
  /\bfaggots?\b/gi,
  /\bfag(s|gy|got)?\b/gi,
  /\b(retard|retarded|retards)\b/gi,
  /\b\w*f+u*c+k+\w*\b/gi,
  /\b\w*s+h+i+t+\w*\b/gi,
  /\bmf\b/gi,
];

function normalizeForRefusalCheck(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .trim();
}

export function looksLikeLlmRefusal(text: string): boolean {
  const s = normalizeForRefusalCheck(text);
  if (s.length === 0 || s.length > 600) return false;
  return REFUSAL_MARKERS.some((re) => re.test(s));
}

const REFUSAL_MARKERS: RegExp[] = [
  /i (cannot|can't) generate/i,
  /cannot generate (a |the )?(summary|content|actions?|text)/i,
  /generate content that includes profanity/i,
  /i (cannot|can't) (create|produce) (a |the )?(summary|content)/i,
  /i can't fulfill that request/i,
  /i cannot fulfill that request/i,
  /unable to (generate|fulfill)/i,
  /not able to (generate|fulfill)/i,
  /can i help you with (anything|something) else/i,
  /is there anything else i can help/i,
  /is there something else i can help/i,
  /content (that includes|with) profanity/i,
  /inappropriate to (generate|process|fulfill)/i,
  /i'?m not able to generate/i,
  /i (can'?t|cannot) (assist|comply) with that/i,
];
