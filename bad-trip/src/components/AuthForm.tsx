"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (error) throw error;
        // Si la confirmation par e-mail est activée, il n'y a pas encore de session.
        if (!data.session) {
          setInfo(
            "Compte créé ! Vérifie ta boîte mail pour confirmer, puis connecte-toi."
          );
          setLoading(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h1 className="text-xl font-bold">
        {mode === "signup" ? "Créer un compte" : "Connexion"}
      </h1>

      {mode === "signup" && (
        <div>
          <label className="label">Pseudo</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ton nom affiché"
          />
        </div>
      )}

      <div>
        <label className="label">E-mail</label>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
        />
      </div>

      <div>
        <label className="label">Mot de passe</label>
        <input
          className="input"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6 caractères minimum"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-emerald-400">{info}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading
          ? "…"
          : mode === "signup"
          ? "Créer mon compte"
          : "Se connecter"}
      </button>

      <p className="text-center text-sm text-slate-400">
        {mode === "signup" ? (
          <>
            Déjà inscrit ?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Connexion
            </Link>
          </>
        ) : (
          <>
            Pas encore de compte ?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Créer un compte
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
