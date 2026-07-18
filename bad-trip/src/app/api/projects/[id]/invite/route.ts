import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Crée une invitation et renvoie le lien à partager (aucun envoi d'e-mail requis).
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("project_members")
    .select("project_id")
    .eq("project_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").toString().trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "E-mail requis." }, { status: 400 });
  }

  const { data: invite, error } = await admin
    .from("invitations")
    .insert({ project_id: params.id, email, invited_by: user.id })
    .select()
    .single();
  if (error || !invite) {
    return NextResponse.json(
      { error: error?.message || "Invitation impossible." },
      { status: 500 }
    );
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(request.url).origin;
  const link = `${base}/invite/${invite.token}`;

  return NextResponse.json({ invitation: invite, link });
}
