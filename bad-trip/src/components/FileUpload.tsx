"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function FileUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [textName, setTextName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function send(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: form,
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

  async function addText(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const form = new FormData();
    form.set("kind", "text");
    form.set("name", textName || "Note");
    form.set("text", text);
    await send(form);
    setText("");
    setTextName("");
  }

  async function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const form = new FormData();
      form.set("name", file.name);
      form.set("file", file);
      await send(form);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold">Ajouter du contenu</h2>

      <form onSubmit={addText} className="space-y-2">
        <input
          className="input"
          placeholder="Titre (facultatif)"
          value={textName}
          onChange={(e) => setTextName(e.target.value)}
        />
        <textarea
          className="input min-h-[90px]"
          placeholder="Colle ici un texte, un article, des idées trouvées sur le net…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button disabled={busy || !text.trim()} className="btn-ghost w-full">
          Ajouter le texte
        </button>
      </form>

      <div className="border-t border-edge pt-3">
        <label className="label">Ou importe des fichiers (images, PDF)</label>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*"
          onChange={onFilesPicked}
          disabled={busy}
          className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent/90"
        />
      </div>

      {busy && <p className="text-sm text-slate-400">Envoi en cours…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
