import Link from "next/link";

export default function ReviewNotFound() {
  return (
    <main className="container-center py-20 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
        Review link
      </p>
      <h1 className="hero-title mt-2">Link not valid</h1>
      <p className="muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
        This review page may have expired or the link may be incorrect. Please
        use the link or QR code provided by the business.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] underline decoration-[var(--line)] underline-offset-4 hover:text-[var(--fg)]"
      >
        Owner sign-in →
      </Link>
    </main>
  );
}
