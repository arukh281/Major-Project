"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { ownerLogoImgSrc } from "@/lib/blobLogoRef";

type BucketDef = {
  id: string;
  label: string;
  description: string;
};

type MeBusiness = {
  id: string;
  displayName: string;
  logoUrl: string | null;
  businessDescription: string | null;
  analyticsSubjectBucketIds?: string[];
  locations: { id: string; name: string; sortOrder: number }[];
  activeTokens: {
    id: string;
    token: string;
    expiresAt: string | null;
    createdAt: string;
  }[];
};

type MeResponse = {
  user: { id: string; email: string | null; name: string | null };
  business: MeBusiness | null;
  googleLinked: boolean;
  googleAccountEmail: string | null;
};

function ShareBlock({
  token,
  businessLabel,
}: {
  token: string;
  businessLabel: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/review/${encodeURIComponent(token)}`;
  }, [token]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setQrLoading(true);
    setQr(null);
    QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((data) => {
        if (!cancelled) {
          setQr(data);
          setQrLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQr(null);
          setQrLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  function downloadQr() {
    if (!qr) return;
    const a = document.createElement("a");
    const safe = businessLabel.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "review";
    a.href = qr;
    a.download = `${safe}-review-qr.png`;
    a.click();
  }

  return (
    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className="admin-field-label">Customer review link</p>
        <code className="mt-2 block break-all rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-2 font-mono text-[11px] text-[var(--fg-soft)]">
          {url || "…"}
        </code>
        <button
          type="button"
          className="btn-ghost mt-2 text-xs"
          onClick={copy}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="shrink-0">
        <p className="admin-field-label">QR code</p>
        {qrLoading ? (
          <div
            className="mt-2 flex h-[240px] w-[240px] items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]"
            aria-busy
          >
            Generating…
          </div>
        ) : qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR code for review link"
              className="mt-2 rounded-lg border border-[var(--line)] bg-white p-2"
              width={240}
              height={240}
            />
            <button
              type="button"
              className="btn-ghost mt-2 w-full text-xs sm:w-auto"
              onClick={downloadQr}
            >
              Download QR (PNG)
            </button>
          </>
        ) : (
          <p className="muted mt-2 max-w-[240px] text-xs">
            QR could not be generated. Try refreshing the page.
          </p>
        )}
      </div>
    </div>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

export function BusinessesSection({
  onConnectGoogle,
}: {
  onConnectGoogle: () => void;
}) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [createName, setCreateName] = useState("");
  const [createLocationsText, setCreateLocationsText] = useState("");
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [locationsText, setLocationsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const [bucketCatalog, setBucketCatalog] = useState<BucketDef[] | null>(null);
  const [createBusinessDesc, setCreateBusinessDesc] = useState("");
  const [createBucketIds, setCreateBucketIds] = useState(() => new Set<string>());
  const [bucketSuggestLoading, setBucketSuggestLoading] = useState(false);
  const [bucketSuggestNote, setBucketSuggestNote] = useState<string | null>(null);
  /** After core fields are saved (POST), user confirms analytics themes (PATCH). */
  const [createAnalyticsStep, setCreateAnalyticsStep] = useState(false);
  const [createPendingBusinessId, setCreatePendingBusinessId] = useState<
    string | null
  >(null);

  const [editBusinessDesc, setEditBusinessDesc] = useState("");
  const [editBucketIds, setEditBucketIds] = useState(() => new Set<string>());

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!createOpen && !editOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [createOpen, editOpen]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/owner/me", { credentials: "include" });
      if (!res.ok) {
        setErr("Could not load your business");
        setMe(null);
        return;
      }
      const data = (await res.json()) as MeResponse;
      setMe(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const primary = me?.business ?? null;

  useEffect(() => {
    if (!primary) return;
    setEditName(primary.displayName);
    setEditLogo(primary.logoUrl ?? "");
    setLocationsText(primary.locations.map((l) => l.name).join("\n"));
  }, [primary]);

  useEffect(() => {
    if (!primary) setEditOpen(false);
  }, [primary]);

  useEffect(() => {
    if (!createOpen && !editOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (createOpen) closeCreateModal();
      else if (editOpen) closeEditModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createOpen, editOpen]);

  useEffect(() => {
    if (!(createOpen || editOpen)) return;
    if (bucketCatalog) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/owner/bucket-catalog");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { buckets?: BucketDef[] };
        if (!cancelled && data.buckets?.length) {
          setBucketCatalog(data.buckets);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, editOpen, bucketCatalog]);

  useEffect(() => {
    if (!createOpen || !bucketCatalog?.length) return;
    setCreateBucketIds((prev) =>
      prev.size > 0 ? prev : new Set(bucketCatalog.map((b) => b.id))
    );
  }, [createOpen, bucketCatalog]);

  useEffect(() => {
    if (!editOpen || !primary || !bucketCatalog?.length) return;
    setEditBusinessDesc(primary.businessDescription ?? "");
    const stored = primary.analyticsSubjectBucketIds ?? [];
    const allowed = new Set(bucketCatalog.map((b) => b.id));
    const picked =
      stored.length === 0
        ? bucketCatalog.map((b) => b.id)
        : stored.filter((id) => allowed.has(id));
    setEditBucketIds(new Set(picked.length ? picked : [...allowed]));
  }, [editOpen, primary, bucketCatalog]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  function resetCreateModal() {
    setCreateName("");
    setCreateLocationsText("");
    setCreateBusinessDesc("");
    setBucketSuggestNote(null);
    setCreateBucketIds(
      bucketCatalog?.length
        ? new Set(bucketCatalog.map((b) => b.id))
        : new Set()
    );
    setCreateLogoFile(null);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (logoInputRef.current) logoInputRef.current.value = "";
    setCreateAnalyticsStep(false);
    setCreatePendingBusinessId(null);
  }

  function openCreateModal() {
    if (me?.business) return;
    setErr("");
    setCreateErr("");
    resetCreateModal();
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateErr("");
    resetCreateModal();
  }

  function closeEditModal() {
    setEditOpen(false);
    setBucketSuggestNote(null);
  }

  function toggleCreateBucket(id: string) {
    setCreateBucketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEditBucket(id: string) {
    setEditBucketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function requestBucketSuggestions() {
    const desc = editBusinessDesc.trim();
    if (desc.length < 8) {
      setErr("Add at least 8 characters describing your business.");
      return;
    }
    setBucketSuggestLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/owner/bucket-suggestions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        recommendedIds?: string[];
        summary?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? "Suggestions failed");
        return;
      }
      const ids = j.recommendedIds ?? [];
      setEditBucketIds(new Set(ids));
      setBucketSuggestNote(
        typeof j.summary === "string" && j.summary.trim()
          ? j.summary.trim()
          : null
      );
    } finally {
      setBucketSuggestLoading(false);
    }
  }

  async function saveAnalyticsTopics() {
    if (!primary?.id) return;
    if (editBucketIds.size === 0) {
      setErr("Pick at least one theme.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/owner/businesses/${primary.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessDescription: editBusinessDesc.trim() || null,
          analyticsSubjectBucketIds: [...editBucketIds],
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setErr(j?.error ?? "Could not save analytics settings");
        return;
      }
      setBucketSuggestNote(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function onCreateLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setCreateLogoFile(f);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  async function onEditLogoFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSaving(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("file", f);
      const up = await fetch("/api/owner/upload/logo", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!up.ok) {
        const j = (await up.json().catch(() => null)) as {
          error?: string;
        } | null;
        setErr(j?.error ?? "Logo upload failed");
        return;
      }
      const payload = (await up.json()) as { data?: { logoUrl?: string } };
      const logoUrl = payload.data?.logoUrl ?? "";
      setEditLogo(logoUrl);
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  }

  async function fetchBucketCatalogIfNeeded(): Promise<BucketDef[] | null> {
    if (bucketCatalog?.length) return bucketCatalog;
    try {
      const res = await fetch("/api/owner/bucket-catalog");
      if (!res.ok) return null;
      const data = (await res.json()) as { buckets?: BucketDef[] };
      const buckets = data.buckets?.length ? data.buckets : null;
      if (buckets) setBucketCatalog(buckets);
      return buckets ?? null;
    } catch {
      return null;
    }
  }

  async function hydratePostCreateBucketSuggestions(
    desc: string,
    catalog: BucketDef[]
  ) {
    const allIds = new Set(catalog.map((b) => b.id));
    if (desc.length < 8) {
      setCreateBucketIds(allIds);
      setBucketSuggestNote(
        "We could not infer topics from a very short description. All themes are selected below — remove any you do not need. You can add more detail under Edit business later to get tailored suggestions."
      );
      return;
    }
    try {
      const res = await fetch("/api/owner/bucket-suggestions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        recommendedIds?: string[];
        summary?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setCreateBucketIds(allIds);
        setBucketSuggestNote(
          j.error ??
            "Suggestions are unavailable. All themes are selected — adjust as you like."
        );
        return;
      }
      const ids = j.recommendedIds ?? [];
      const allowed = ids.filter((id) => allIds.has(id));
      setCreateBucketIds(new Set(allowed.length ? allowed : [...allIds]));
      const summary =
        typeof j.summary === "string" && j.summary.trim()
          ? j.summary.trim()
          : null;
      setBucketSuggestNote(
        summary ??
          "Based on your description, these analytics themes should suit you best. Uncheck any you do not want."
      );
    } catch {
      setCreateBucketIds(allIds);
      setBucketSuggestNote(
        "Could not load suggestions. All themes are selected — adjust as you like."
      );
    }
  }

  async function saveCreateBusinessCore() {
    const displayName = createName.trim();
    const locationNames = createLocationsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!displayName) return;
    if (locationNames.length === 0) {
      setCreateErr("Add at least one location (one per line).");
      return;
    }

    const catalog = await fetchBucketCatalogIfNeeded();
    if (!catalog?.length) {
      setCreateErr(
        "Could not load analytics themes. Check your connection and try again."
      );
      return;
    }

    setSaving(true);
    setCreateErr("");
    try {
      let logoUrl: string | null = null;
      if (createLogoFile) {
        const fd = new FormData();
        fd.set("file", createLogoFile);
        const up = await fetch("/api/owner/upload/logo", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!up.ok) {
          const j = (await up.json().catch(() => null)) as { error?: string } | null;
          setCreateErr(j?.error ?? "Logo upload failed");
          return;
        }
        const payload = (await up.json()) as { data?: { logoUrl?: string } };
        logoUrl = payload.data?.logoUrl ?? null;
      }

      const res = await fetch("/api/owner/businesses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          logoUrl,
          locations: locationNames.map((name) => ({ name })),
          businessDescription: createBusinessDesc.trim() || undefined,
        }),
      });
      const createJson = (await res.json().catch(() => null)) as {
        data?: { id?: string };
        error?: string;
      } | null;
      if (!res.ok) {
        setCreateErr(
          createJson?.error ??
            (res.status === 409
              ? "You already have a business. Close this dialog and use Edit."
              : "Create failed")
        );
        return;
      }
      const businessId = createJson?.data?.id;
      if (!businessId) {
        setCreateErr("Create failed (missing id).");
        return;
      }
      setBucketSuggestNote(null);
      setCreatePendingBusinessId(businessId);
      await hydratePostCreateBucketSuggestions(createBusinessDesc.trim(), catalog);
      setCreateAnalyticsStep(true);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveCreateBusinessAnalytics() {
    if (!createPendingBusinessId) return;
    if (createBucketIds.size === 0) {
      setCreateErr("Pick at least one theme.");
      return;
    }
    setSaving(true);
    setCreateErr("");
    try {
      const res = await fetch(
        `/api/owner/businesses/${createPendingBusinessId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analyticsSubjectBucketIds: [...createBucketIds],
          }),
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setCreateErr(j?.error ?? "Could not save theme selection");
        return;
      }
      await refresh();
      closeCreateModal();
    } finally {
      setSaving(false);
    }
  }

  async function saveBusiness() {
    if (!primary?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/owner/businesses/${primary.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editName.trim(),
          logoUrl: editLogo.trim() || null,
        }),
      });
      if (!res.ok) {
        setErr("Save failed");
        return;
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveLocations() {
    if (!primary?.id) return;
    const names = locationsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/owner/businesses/${primary.id}/locations`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locations: names.map((name) => ({ name })),
          }),
        }
      );
      if (!res.ok) {
        setErr("Locations update failed");
        return;
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function mintToken() {
    if (!primary?.id) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/owner/businesses/${primary.id}/review-token`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        setErr("Could not mint token");
        return;
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function rotateToken() {
    if (!primary?.id) return;
    if (
      !window.confirm(
        "Rotate the review link? Old QR codes and links will stop working."
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/owner/businesses/${primary.id}/review-token/rotate`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        setErr("Rotate failed");
        return;
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function openEditModal() {
    setErr("");
    setBucketSuggestNote(null);
    setEditOpen(true);
  }

  async function deleteBusiness() {
    if (!primary?.id) return;
    if (!window.confirm("Delete this business and all its data?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/owner/businesses/${primary.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setErr("Delete failed");
        return;
      }
      setEditOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !me) {
    return (
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
        Loading your business…
      </div>
    );
  }

  const activeToken = primary?.activeTokens?.[0]?.token ?? null;

  return (
    <section className="space-y-8">
      {err && (
        <p className="text-sm text-[var(--chart-4)]" role="alert">
          {err}
        </p>
      )}

      <details className="panel overflow-hidden p-0 open:[&>summary]:border-b open:[&>summary]:border-[var(--line)]">
        <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
              Google Business Profile
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Optional · Click to expand
            </span>
          </div>
        </summary>
        <div className="space-y-4 px-5 pb-5 pt-2">
          <p className="muted max-w-2xl text-sm leading-relaxed">
            Connect separately after signing in. Importing Google reviews is
            optional—you can run the console without it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-solid"
              onClick={onConnectGoogle}
            >
              Connect Google Business
            </button>
            {me?.googleLinked ? (
              <span className="text-sm text-[var(--fg-soft)]">
                Linked
                {me.googleAccountEmail ? ` · ${me.googleAccountEmail}` : ""}
              </span>
            ) : (
              <span className="text-sm text-[var(--muted)]">Not connected</span>
            )}
          </div>
        </div>
      </details>

      <div className="panel p-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[var(--fg)]">
            Your business
          </h2>
        </div>

        <div className="mt-6">
          {primary ? (
            <div className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--fg)]">
                  {primary.displayName}
                </p>
                <p className="muted mt-1 text-sm">
                  {primary.locations.length} location
                  {primary.locations.length === 1 ? "" : "s"} for customers ·
                  connect Google above to import public reviews
                </p>
              </div>
              <button
                type="button"
                className="btn-solid flex h-10 w-full shrink-0 items-center justify-center gap-2 px-4 sm:w-auto"
                onClick={openEditModal}
              >
                <PencilIcon className="h-4 w-4" />
                Edit business
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <p className="admin-field-label">Get started</p>
              <p className="muted mt-2 text-sm leading-relaxed">
                Add your business name, at least one location, and optionally a
                logo and description. You will confirm analytics themes right
                after saving, then you can generate the private review link and QR
                code.
              </p>
              <button
                type="button"
                className="btn-solid mt-5 w-full px-5 py-2.5 text-sm sm:w-auto"
                onClick={openCreateModal}
              >
                Set up your business
              </button>
            </div>
          )}
        </div>
      </div>

      {portalReady &&
        createOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 bg-[var(--fg)]/30 backdrop-blur-[2px]"
              aria-label="Close dialog"
              onClick={closeCreateModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-business-title"
              className="panel relative z-10 w-full max-w-lg max-h-[min(92vh,760px)] overflow-y-auto overscroll-contain p-5 shadow-lg"
            >
              <h2
                id="create-business-title"
                className="text-sm font-semibold tracking-tight text-[var(--fg)]"
              >
                {createAnalyticsStep ? "Analytics themes" : "Set up your business"}
              </h2>
              <p className="muted mt-1 text-xs leading-relaxed">
                {createAnalyticsStep
                  ? "Your business is saved. Based on your description, these are the themes we think will suit you best for review analytics. Adjust the checkboxes, then confirm to finish."
                  : "Enter a name, at least one location, and optionally a logo and short description. After you save, you will confirm which analytics themes to track."}
              </p>
              {createErr ? (
                <p className="mt-3 text-sm text-[var(--chart-4)]" role="alert">
                  {createErr}
                </p>
              ) : null}

              {createAnalyticsStep ? (
                <div className="mt-4">
                  {bucketSuggestNote ? (
                    <p className="text-sm leading-relaxed text-[var(--fg)]">
                      {bucketSuggestNote}
                    </p>
                  ) : null}

                  <div className={bucketSuggestNote ? "mt-4" : ""}>
                    <span className="admin-field-label">Themes for analytics</span>
                    <p className="muted mt-1 text-[11px] leading-relaxed">
                      Pick at least one.
                    </p>
                    <div className="mt-2 max-h-[min(52vh,440px)] space-y-2 overflow-y-auto border border-[var(--line)] bg-[var(--surface)] p-3">
                      {bucketCatalog?.length ? (
                        bucketCatalog.map((b) => (
                          <label
                            key={b.id}
                            className="flex cursor-pointer gap-2 text-sm leading-snug"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0"
                              checked={createBucketIds.has(b.id)}
                              onChange={() => toggleCreateBucket(b.id)}
                            />
                            <span className="min-w-0">
                              <span className="font-medium text-[var(--fg)]">
                                {b.label}
                              </span>
                              <span className="muted mt-0.5 block text-[11px]">
                                {b.description}
                              </span>
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="muted text-[11px]">Loading…</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={saving}
                      onClick={closeCreateModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-solid disabled:opacity-45"
                      disabled={saving || createBucketIds.size === 0}
                      onClick={() => void saveCreateBusinessAnalytics()}
                    >
                      {saving ? "Saving…" : "Confirm & save themes"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="admin-field-label">Business name</span>
                      <input
                        className="mt-1 block w-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--fg)]"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="e.g. Northside Coffee"
                        autoComplete="organization"
                      />
                    </label>

                    <label className="block">
                      <span className="admin-field-label">Locations (one per line)</span>
                      <textarea
                        className="review-textarea mt-1 font-mono text-sm"
                        rows={4}
                        value={createLocationsText}
                        onChange={(e) => setCreateLocationsText(e.target.value)}
                        placeholder={
                          "Ashok Vihar Delhi\nConnaught Place\nLaxmi Nagar"
                        }
                      />
                    </label>

                    <label className="block">
                      <span className="admin-field-label">About your business</span>
                      <textarea
                        className="review-textarea mt-1 text-sm"
                        rows={3}
                        value={createBusinessDesc}
                        onChange={(e) => setCreateBusinessDesc(e.target.value)}
                        placeholder="What you sell, who you serve, online vs in-store, delivery, etc."
                      />
                      <p className="muted mt-1 text-[11px] leading-relaxed">
                        Optional but recommended: we use this to suggest analytics
                        themes after you save.
                      </p>
                    </label>

                    <div>
                      <span className="admin-field-label">Logo</span>
                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="max-w-full text-sm text-[var(--fg-soft)] file:mr-2 file:rounded file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-2 file:py-1 file:text-xs file:text-[var(--fg)]"
                          onChange={onCreateLogoChange}
                        />
                        {logoPreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logoPreviewUrl}
                            alt=""
                            className="h-14 w-14 rounded-md border border-[var(--line)] object-contain"
                          />
                        ) : null}
                      </div>
                      <p className="muted mt-1 text-[11px]">
                        Optional. PNG, JPEG, WebP, or GIF — max 2MB.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={saving}
                      onClick={closeCreateModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-solid disabled:opacity-45"
                      disabled={
                        saving ||
                        !bucketCatalog?.length ||
                        !createName.trim() ||
                        !createLocationsText.split("\n").some((l) => l.trim())
                      }
                      onClick={() => void saveCreateBusinessCore()}
                    >
                      {saving ? "Saving…" : "Save business"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {portalReady &&
        editOpen &&
        primary &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 bg-[var(--fg)]/30 backdrop-blur-[2px]"
              aria-label="Close dialog"
              onClick={closeEditModal}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-business-title"
              className="panel relative z-10 w-full max-w-lg max-h-[min(90vh,720px)] overflow-y-auto overscroll-contain p-5 shadow-lg"
            >
              <h2
                id="edit-business-title"
                className="text-sm font-semibold tracking-tight text-[var(--fg)]"
              >
                Edit — {primary.displayName}
              </h2>
              <p className="muted mt-1 text-xs leading-relaxed">
                Update details here. Save each section when you change it.
              </p>

              <div className="mt-6 space-y-8">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--fg)]">
                    Name &amp; logo
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="admin-field-label">Business name</span>
                      <input
                        className="mt-1 block w-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="admin-field-label">Logo URL</span>
                      <input
                        className="mt-1 block w-full border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                        value={editLogo}
                        onChange={(e) => setEditLogo(e.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <span className="admin-field-label">Or upload logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="mt-2 max-w-full text-sm text-[var(--fg-soft)] file:mr-2 file:rounded file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-2 file:py-1 file:text-xs file:text-[var(--fg)]"
                        onChange={(e) => void onEditLogoFilePick(e)}
                      />
                      <p className="muted mt-1 text-[11px]">
                        Upload fills the logo URL — then click Save below.
                      </p>
                      {editLogo.trim() && ownerLogoImgSrc(editLogo.trim()) ? (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="admin-field-label">Preview</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ownerLogoImgSrc(editLogo.trim())!}
                            alt=""
                            className="h-14 w-14 rounded-md border border-[var(--line)] object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-solid disabled:opacity-45"
                    disabled={saving}
                    onClick={saveBusiness}
                  >
                    Save name &amp; logo
                  </button>
                </section>

                <section className="space-y-4 border-t border-[var(--line)] pt-8">
                  <h3 className="text-sm font-semibold text-[var(--fg)]">
                    Analytics topics
                  </h3>
                  <p className="muted text-xs leading-relaxed">
                    Used on your Analytics page. Describe your business to
                    pre-fill checkboxes, or set them yourself.
                  </p>
                  <label className="block">
                    <span className="admin-field-label">About your business</span>
                    <textarea
                      className="review-textarea mt-1 text-sm"
                      rows={3}
                      value={editBusinessDesc}
                      onChange={(e) => setEditBusinessDesc(e.target.value)}
                      placeholder="What you sell, locations, delivery, etc."
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-xs disabled:opacity-45"
                      disabled={
                        bucketSuggestLoading ||
                        editBusinessDesc.trim().length < 8
                      }
                          onClick={() => void requestBucketSuggestions()}
                    >
                      {bucketSuggestLoading ? "Working…" : "Match topics"}
                    </button>
                    <span className="muted text-[11px]">
                      Prefills from the text above.
                    </span>
                  </div>
                  {bucketSuggestNote ? (
                    <p className="muted text-xs leading-relaxed">
                      {bucketSuggestNote}
                    </p>
                  ) : null}
                  <div>
                    <span className="admin-field-label">Themes for analytics</span>
                    <div className="mt-2 max-h-52 space-y-2 overflow-y-auto border border-[var(--line)] bg-[var(--surface)] p-3">
                      {bucketCatalog?.length ? (
                        bucketCatalog.map((b) => (
                          <label
                            key={b.id}
                            className="flex cursor-pointer gap-2 text-sm leading-snug"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0"
                              checked={editBucketIds.has(b.id)}
                              onChange={() => toggleEditBucket(b.id)}
                            />
                            <span className="min-w-0">
                              <span className="font-medium text-[var(--fg)]">
                                {b.label}
                              </span>
                              <span className="muted mt-0.5 block text-[11px]">
                                {b.description}
                              </span>
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="muted text-[11px]">Loading…</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-solid disabled:opacity-45"
                    disabled={saving || editBucketIds.size === 0}
                    onClick={() => void saveAnalyticsTopics()}
                  >
                    Save themes
                  </button>
                </section>

                <section className="space-y-4 border-t border-[var(--line)] pt-8">
                  <h3 className="text-sm font-semibold text-[var(--fg)]">
                    Locations
                  </h3>
                  <p className="muted text-xs leading-relaxed">
                    One location per line. Customers pick one when they leave a
                    review.
                  </p>
                  <textarea
                    className="review-textarea font-mono text-sm"
                    rows={6}
                    value={locationsText}
                    onChange={(e) => setLocationsText(e.target.value)}
                    placeholder={
                      "Ashok Vihar Delhi\nConnaught Place\nLaxmi Nagar"
                    }
                  />
                  <button
                    type="button"
                    className="btn-solid disabled:opacity-45"
                    disabled={saving}
                    onClick={saveLocations}
                  >
                    Save locations
                  </button>
                </section>

                <section className="space-y-4 border-t border-[var(--line)] pt-8">
                  <h3 className="text-sm font-semibold text-[var(--fg)]">
                    Customer link &amp; QR code
                  </h3>
                  <p className="muted text-xs leading-relaxed">
                    Mint a link once, then share the URL or QR with customers.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="btn-solid disabled:opacity-45"
                      disabled={saving}
                      onClick={mintToken}
                    >
                      {activeToken
                        ? "Ensure active link"
                        : "Generate review link & QR"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost disabled:opacity-45"
                      disabled={saving || !activeToken}
                      onClick={rotateToken}
                    >
                      Rotate link (invalidate old QR)
                    </button>
                  </div>
                  {activeToken ? (
                    <ShareBlock
                      token={activeToken}
                      businessLabel={primary.displayName}
                    />
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Generate a link to show the customer URL and QR code here.
                    </p>
                  )}
                </section>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-6">
                <button
                  type="button"
                  className="text-xs text-[var(--chart-4)] underline-offset-2 hover:underline"
                  disabled={saving}
                  onClick={deleteBusiness}
                >
                  Delete this business
                </button>
                <button
                  type="button"
                  className="btn-solid"
                  disabled={saving}
                  onClick={closeEditModal}
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
