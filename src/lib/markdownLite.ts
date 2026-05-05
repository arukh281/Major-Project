/** Minimal markdown → HTML for trusted-ish model text (escape + ** + lists + section lines). */
export function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInline(raw: string): string {
  let out = escapeHtml(raw);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return out;
}

export function markdownToHtml(s: string) {
  if (!s) return "";
  const lines = s.split(/\r?\n/);
  const parts: string[] = [];
  let listKind: null | "ol" | "ul" = null;

  function closeList() {
    if (listKind === "ol") parts.push("</ol>");
    else if (listKind === "ul") parts.push("</ul>");
    listKind = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      closeList();
      continue;
    }

    const section = trimmed.match(/^\*\*(.+?)\*\*\s*$/);
    if (section) {
      closeList();
      parts.push(`<h3>${formatInline(section[1])}</h3>`);
      continue;
    }

    const num = trimmed.match(/^\d+\.\s+(.*)$/);
    if (num) {
      if (listKind !== "ol") {
        closeList();
        parts.push("<ol>");
        listKind = "ol";
      }
      parts.push(`<li>${formatInline(num[1])}</li>`);
      continue;
    }

    const bullet = trimmed.match(/^(?:[•*\-]|\u2022)\s+(.+)$/);
    if (bullet) {
      if (listKind !== "ul") {
        closeList();
        parts.push("<ul>");
        listKind = "ul";
      }
      parts.push(`<li>${formatInline(bullet[1])}</li>`);
      continue;
    }

    closeList();
    parts.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeList();
  return parts.join("");
}
