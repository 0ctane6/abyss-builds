"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, destination }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      router.push(`/projects/${json.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="font-semibold">Nouveau voyage</h2>
      <div>
        <label className="label">Nom du projet</label>
        <input
          className="input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Roadtrip Islande"
        />
      </div>
      <div>
        <label className="label">Destination (facultatif)</label>
        <input
          className="input"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Islande"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={loading} className="btn-primary w-full">
        {loading ? "…" : "Créer le voyage"}
      </button>
    </form>
  );
}
