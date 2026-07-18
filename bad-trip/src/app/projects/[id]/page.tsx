import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { FileUpload } from "@/components/FileUpload";
import { GenerateButton } from "@/components/GenerateButton";
import { InviteForm } from "@/components/InviteForm";
import { ItineraryView } from "@/components/ItineraryView";
import { createClient } from "@/lib/supabase/server";
import type { Itinerary, Profile, Project, TripFile } from "@/lib/types";

const kindIcon: Record<string, string> = {
  text: "📝",
  image: "🖼️",
  doc: "📄",
};

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();
  const proj = project as Project;

  const [{ data: files }, { data: itineraries }, { data: members }] =
    await Promise.all([
      supabase
        .from("files")
        .select("*")
        .eq("project_id", params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("itineraries")
        .select("*")
        .eq("project_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("project_members")
        .select("*")
        .eq("project_id", params.id),
    ]);

  const fileList = (files || []) as TripFile[];
  const latest = ((itineraries || [])[0] as Itinerary | undefined) || null;

  const memberIds = (members || []).map((m: any) => m.user_id);
  let profiles: Profile[] = [];
  if (memberIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("*")
      .in("id", memberIds);
    profiles = (profs || []) as Profile[];
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Mes voyages
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{proj.name}</h1>
          {proj.destination && (
            <p className="text-slate-400">📍 {proj.destination}</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Colonne gauche : contenu, génération, membres */}
          <aside className="space-y-4">
            <FileUpload projectId={proj.id} />

            <div className="card">
              <h2 className="mb-2 font-semibold">
                Contenus déposés ({fileList.length})
              </h2>
              {fileList.length === 0 ? (
                <p className="text-sm text-slate-500">Rien pour l&apos;instant.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {fileList.map((f) => (
                    <li key={f.id} className="flex items-center gap-2">
                      <span>{kindIcon[f.kind] || "📄"}</span>
                      <span className="truncate">{f.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <GenerateButton
              projectId={proj.id}
              hasFiles={fileList.length > 0}
              hasItinerary={Boolean(latest)}
            />

            <div className="card">
              <h2 className="mb-3 font-semibold">Voyageurs</h2>
              <ul className="mb-3 space-y-1 text-sm">
                {profiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-edge text-xs">
                      {(p.display_name || p.email || "?")[0]?.toUpperCase()}
                    </span>
                    <span>{p.display_name || p.email}</span>
                    {p.id === proj.owner_id && (
                      <span className="text-xs text-accentSoft">(hôte)</span>
                    )}
                  </li>
                ))}
              </ul>
              <InviteForm projectId={proj.id} />
            </div>
          </aside>

          {/* Colonne droite : itinéraire + carte */}
          <section>
            <h2 className="mb-3 text-xl font-bold">
              {latest?.title || "Itinéraire"}
            </h2>
            <ItineraryView data={latest?.data || null} />
          </section>
        </div>
      </main>
    </div>
  );
}
