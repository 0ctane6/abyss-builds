import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateItinerary, type AiFile } from "@/lib/gemini";
import { fillMissingCoords } from "@/lib/geocode";

export const maxDuration = 60; // l'analyse IA peut prendre quelques secondes

// Génère (ou régénère) l'itinéraire du projet à partir des fichiers déposés.
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

  // Vérifie l'appartenance au projet.
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
  const notes = (body.notes || "").toString().trim() || null;

  const { data: project } = await admin
    .from("projects")
    .select("destination")
    .eq("id", params.id)
    .single();

  const { data: files } = await admin
    .from("files")
    .select("*")
    .eq("project_id", params.id);

  // Prépare les fichiers pour l'IA (texte inline, binaires téléchargés en base64).
  const aiFiles: AiFile[] = [];
  for (const f of files || []) {
    if (f.kind === "text" && f.content_text) {
      aiFiles.push({ name: f.name, kind: "text", text: f.content_text });
    } else if (f.storage_path) {
      const { data: blob } = await admin.storage
        .from("trip-files")
        .download(f.storage_path);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        aiFiles.push({
          name: f.name,
          kind: f.kind,
          mimeType: f.mime_type,
          base64: buf.toString("base64"),
        });
      }
    }
  }

  try {
    let itinerary = await generateItinerary({
      destination: project?.destination,
      notes,
      files: aiFiles,
    });
    itinerary = await fillMissingCoords(itinerary, project?.destination);

    const { data: saved, error } = await admin
      .from("itineraries")
      .insert({
        project_id: params.id,
        generated_by: user.id,
        title: itinerary.title || null,
        summary: itinerary.summary || null,
        data: itinerary,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ itinerary: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Échec de la génération." },
      { status: 500 }
    );
  }
}
