"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton({
  projectId,
  hasFiles,
  hasItinerary,
}: {
  projectId: string;
  hasFiles: boolean;
  hasItinerary: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Générer l&apos;itinéraire</h2>
      <textarea
        className="input min-h-[70px]"
        placeholder="Consignes (facultatif) : durée, budget, rythme, centres d'intérêt…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button
        onClick={generate}
        disabled={busy || !hasFiles}
        className="btn-primary w-full"
      >
        {busy
          ? "L'IA réfléchit…"
          : hasItinerary
          ? "Régénérer l'itinéraire"
          : "Créer l'itinéraire"}
      </button>
      {!hasFiles && (
        <p className="text-xs text-slate-500">
          Ajoute au moins un texte ou un fichier d&apos;abord.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
