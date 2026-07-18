import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export async function Navbar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-edge bg-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-accent">Bad</span>&apos;Trip
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/dashboard" className="text-slate-300 hover:text-white">
                Mes voyages
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-300 hover:text-white">
                Connexion
              </Link>
              <Link href="/signup" className="btn-primary">
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
