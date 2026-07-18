import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Rejoint un projet à partir d'un jeton d'invitation.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token = (body.token || "").toString().trim();
  if (!token) {
    return NextResponse.json({ error: "Jeton manquant." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!invite) {
    return NextResponse.json(
      { error: "Invitation introuvable ou expirée." },
      { status: 404 }
    );
  }

  // Ajoute l'utilisateur comme membre (idempotent).
  const { error: memErr } = await admin
    .from("project_members")
    .upsert(
      { project_id: invite.project_id, user_id: user.id, role: "member" },
      { onConflict: "project_id,user_id", ignoreDuplicates: true }
    );
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  await admin
    .from("invitations")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  return NextResponse.json({ project_id: invite.project_id });
}
