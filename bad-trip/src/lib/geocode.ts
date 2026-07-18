import type { ItineraryData } from "./types";

// Géocode un lieu via Nominatim (OpenStreetMap) — gratuit, sans clé.
async function geocodeOne(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        // Nominatim exige un User-Agent identifiable.
        "User-Agent": "BadTrip/0.1 (itineraire-voyage)",
        "Accept-Language": "fr",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// Complète les coordonnées manquantes de l'itinéraire.
// Respecte la limite de Nominatim (~1 req/s) en enchaînant séquentiellement.
export async function fillMissingCoords(
  itinerary: ItineraryData,
  destination?: string | null
): Promise<ItineraryData> {
  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      const hasCoords =
        typeof stop.lat === "number" &&
        typeof stop.lng === "number" &&
        !Number.isNaN(stop.lat) &&
        !Number.isNaN(stop.lng);
      if (hasCoords) continue;

      const query = destination ? `${stop.name}, ${destination}` : stop.name;
      const coords = await geocodeOne(query);
      if (coords) {
        stop.lat = coords.lat;
        stop.lng = coords.lng;
      }
    }
  }
  return itinerary;
}
