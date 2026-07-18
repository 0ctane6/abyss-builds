import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

async function assertMember(
  supabase: ReturnType<typeof createClient>,
  projectId: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null as any, ok: false };
  const { data } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, ok: Boolean(data) };
}

function detectKind(mime: string): "text" | "image" | "doc" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/")) return "text";
  return "doc";
}

// Ajoute un fichier au projet : soit du texte collé, soit un fichier binaire.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { user, ok } = await assertMember(supabase, params.id);
  if (!ok) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const form = await request.formData();
  const kindField = (form.get("kind") || "").toString();
  const name = (form.get("name") || "").toString().trim();
  const text = form.get("text")?.toString() || "";
  const file = form.get("file");

  const admin = createAdminClient();

  // Cas 1 : texte collé.
  if (kindField === "text" || (!file && text)) {
    if (!text.trim()) {
      return NextResponse.json({ error: "Texte vide." }, { status: 400 });
    }
    const { data, error } = await admin
      .from("files")
      .insert({
        project_id: params.id,
        uploaded_by: user.id,
        name: name || "Note",
        kind: "text",
        content_text: text,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ file: data });
  }

  // Cas 2 : fichier binaire (image / PDF / doc).
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  const kind = detectKind(mime);
  const safeName = (name || file.name).replace(/[^\w.\-]+/g, "_");
  const storagePath = `${params.id}/${crypto.randomUUID()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("trip-files")
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from("files")
    .insert({
      project_id: params.id,
      uploaded_by: user.id,
      name: name || file.name,
      kind,
      mime_type: mime,
      storage_path: storagePath,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ file: data });
}
