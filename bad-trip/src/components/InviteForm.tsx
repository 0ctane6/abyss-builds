"use client";

import { useState } from "react";

export function InviteForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLink(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      setLink(json.link);
      setEmail("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <form onSubmit={invite} className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input"
          type="email"
          required
          placeholder="ami@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button disabled={busy} className="btn-primary flex-none">
          Inviter
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {link && (
        <div className="rounded-lg border border-edge bg-ink p-2 text-xs">
          <p className="mb-1 text-slate-400">
            Lien d&apos;invitation à partager :
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-accentSoft">{link}</code>
            <button
              type="button"
              onClick={copy}
              className="btn-ghost px-2 py-1 text-xs"
            >
              {copied ? "Copié ✓" : "Copier"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
