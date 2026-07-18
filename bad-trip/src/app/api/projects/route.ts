import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Crée un projet et ajoute son créateur comme propriétaire/membre.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").toString().trim();
  const destination = (body.destination || "").toString().trim() || null;
  if (!name) {
    return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: project, error: projErr } = await admin
    .from("projects")
    .insert({ name, destination, owner_id: user.id })
    .select()
    .single();
  if (projErr || !project) {
    return NextResponse.json(
      { error: projErr?.message || "Création impossible." },
      { status: 500 }
    );
  }

  const { error: memErr } = await admin
    .from("project_members")
    .insert({ project_id: project.id, user_id: user.id, role: "owner" });
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: project.id });
}
