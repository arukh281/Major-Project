"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function HomeClient() {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setHint(e);
  }, []);

  return (
    <main className="container-center py-16">
      <div className="mx-auto max-w-lg">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
          Fynd · Owners
        </p>
        <h1 className="hero-title mt-2">Run your review desk</h1>
        <p className="muted mt-4 text-sm leading-relaxed">
          Sign in with Google to manage your business, share a private review
          link and QR code per location set, and optionally connect Google
          Business Profile to import public reviews. Customers never use a
          global anonymous form—they only review through your link.
        </p>

        {hint && (
          <p className="mt-4 text-sm text-[var(--chart-4)]" role="alert">
            Sign-in issue: {hint}
          </p>
        )}

        <div className="mt-10 flex flex-col gap-4">
          <a
            href="/api/auth/google/start"
            className="submit-cta inline-flex items-center justify-center no-underline"
          >
            Sign in with Google
          </a>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Customer? Open the link or scan the QR from the business you visited.
          </p>
        </div>

        <p className="mt-12 text-center text-xs text-[var(--muted)]">
          <Link
            href="/admin"
            className="underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--fg)]"
          >
            Already signed in → Console
          </Link>
        </p>
      </div>
    </main>
  );
}
