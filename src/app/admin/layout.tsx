import Link from "next/link";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { OWNER_SESSION_COOKIE } from "@/lib/ownerSession";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "./SignOutButton";

function sessionKeyBytes(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s.slice(0, 32));
}

async function getSessionUserLabel(): Promise<string | null> {
  const token = (await cookies()).get(OWNER_SESSION_COOKIE)?.value;
  const key = sessionKeyBytes();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const userId = payload.userId as string | undefined;
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    return user?.name || user?.email || "Signed in";
  } catch {
    return null;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const label = await getSessionUserLabel();

  return (
    <div className="admin-root min-h-screen">
      <header className="admin-topbar sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface-elevated)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Fynd
            </span>
            <span className="text-[var(--fg)] text-sm font-medium tracking-tight">
              Console
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex items-center gap-1" aria-label="Admin sections">
              <Link className="nav-pill" href="/admin">
                Operations
              </Link>
              <Link className="nav-pill" href="/admin/analytics">
                Analytics
              </Link>
            </nav>
            {label && (
              <span className="hidden max-w-[200px] truncate text-xs text-[var(--muted)] sm:inline">
                {label}
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
