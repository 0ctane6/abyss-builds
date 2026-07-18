"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      router.push(`/projects/${json.project_id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 text-center">
      <h1 className="text-xl font-bold">Rejoindre un voyage</h1>
      <p className="text-slate-300">
        Tu as été invité à collaborer sur un projet Bad&apos;Trip.
      </p>
      <button onClick={accept} disabled={busy} className="btn-primary w-full">
        {busy ? "…" : "Rejoindre le voyage"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
