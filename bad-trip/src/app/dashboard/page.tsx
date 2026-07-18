import Link from "next/link";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { NewProjectForm } from "@/components/NewProjectForm";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (projects || []) as Project[];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1fr_320px]">
        <section>
          <h1 className="mb-4 text-2xl font-bold">Mes voyages</h1>
          {list.length === 0 ? (
            <div className="card text-slate-400">
              Aucun voyage pour l&apos;instant. Crée ton premier projet à droite 👉
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="card block transition-colors hover:border-accent"
                  >
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.destination && (
                      <p className="mt-1 text-sm text-slate-400">
                        📍 {p.destination}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside>
          <NewProjectForm />
        </aside>
      </main>
    </div>
  );
}
