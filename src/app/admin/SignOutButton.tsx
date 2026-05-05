"use client";

export function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-md border border-[var(--line)] px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted)] hover:border-[var(--fg)] hover:text-[var(--fg)]"
    >
      Sign out
    </button>
  );
}
