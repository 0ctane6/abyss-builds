import {
  GoogleGenerativeAI,
  SchemaType,
  type Part,
} from "@google/generative-ai";
import type { ItineraryData } from "./types";

// Un fichier prêt à être envoyé à l'IA.
export type AiFile = {
  name: string;
  kind: "text" | "image" | "doc";
  mimeType?: string | null;
  text?: string | null; // pour le texte collé
  base64?: string | null; // pour images / PDF (contenu binaire encodé)
};

const itinerarySchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    days: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          day: { type: SchemaType.NUMBER },
          title: { type: SchemaType.STRING },
          stops: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                time: { type: SchemaType.STRING },
                lat: { type: SchemaType.NUMBER },
                lng: { type: SchemaType.NUMBER },
              },
              required: ["name"],
            },
          },
        },
        required: ["day", "stops"],
      },
    },
  },
  required: ["title", "days"],
} as const;

function partsFromFiles(files: AiFile[]): Part[] {
  const parts: Part[] = [];
  for (const f of files) {
    if (f.text && f.text.trim()) {
      parts.push({ text: `--- Fichier texte : ${f.name} ---\n${f.text}` });
    } else if (f.base64 && f.mimeType) {
      parts.push({
        inlineData: { data: f.base64, mimeType: f.mimeType },
      });
    }
  }
  return parts;
}

export async function generateItinerary(params: {
  destination?: string | null;
  notes?: string | null;
  files: AiFile[];
}): Promise<ItineraryData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquante. Ajoute-la dans .env.local.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: itinerarySchema as any,
      temperature: 0.7,
    },
  });

  const instruction = [
    "Tu es un expert du voyage. À partir des documents fournis (textes, images, PDF trouvés sur internet),",
    "conçois un itinéraire de voyage réaliste, jour par jour.",
    params.destination ? `Destination visée : ${params.destination}.` : "",
    params.notes ? `Consignes des voyageurs : ${params.notes}.` : "",
    "Pour CHAQUE étape (stop), donne un nom de lieu précis et géolocalisable,",
    "une courte description, un moment de la journée si pertinent,",
    "et les coordonnées lat/lng réelles et exactes du lieu (indispensable pour la carte).",
    "Regroupe les étapes en journées cohérentes géographiquement.",
    "Réponds uniquement avec le JSON demandé, en français.",
  ]
    .filter(Boolean)
    .join(" ");

  const parts: Part[] = [{ text: instruction }, ...partsFromFiles(params.files)];
  if (parts.length === 1) {
    parts.push({
      text: "Aucun document exploitable n'a été fourni : propose un itinéraire par défaut pour la destination.",
    });
  }

  const result = await model.generateContent(parts);
  const raw = result.response.text();

  let parsed: ItineraryData;
  try {
    parsed = JSON.parse(raw) as ItineraryData;
  } catch {
    throw new Error("Réponse de l'IA illisible (JSON invalide).");
  }

  // Garde-fous : structure toujours exploitable côté UI.
  if (!Array.isArray(parsed.days)) parsed.days = [];
  parsed.days = parsed.days.map((d, i) => ({
    day: typeof d.day === "number" ? d.day : i + 1,
    title: d.title,
    stops: Array.isArray(d.stops) ? d.stops : [],
  }));

  return parsed;
}
