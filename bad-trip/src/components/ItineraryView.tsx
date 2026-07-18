"use client";

import dynamic from "next/dynamic";
import type { ItineraryData } from "@/lib/types";

// La carte Leaflet ne doit être rendue que côté navigateur.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-xl border border-edge bg-panel text-sm text-slate-400">
      Chargement de la carte…
    </div>
  ),
});

export function ItineraryView({ data }: { data: ItineraryData | null }) {
  if (!data || !data.days || data.days.length === 0) {
    return (
      <div className="card text-slate-400">
        Pas encore d&apos;itinéraire. Dépose des fichiers puis lance la
        génération.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {data.summary && (
          <div className="card">
            <p className="text-sm text-slate-300">{data.summary}</p>
          </div>
        )}
        {data.days.map((day) => (
          <div key={day.day} className="card">
            <h3 className="mb-2 font-semibold text-accentSoft">
              Jour {day.day}
              {day.title ? ` — ${day.title}` : ""}
            </h3>
            <ol className="space-y-3">
              {day.stops.map((stop, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium">
                      {stop.name}
                      {stop.time && (
                        <span className="ml-2 text-xs text-slate-400">
                          {stop.time}
                        </span>
                      )}
                    </div>
                    {stop.description && (
                      <p className="text-sm text-slate-400">
                        {stop.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="min-h-[400px] lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
        <MapView data={data} />
      </div>
    </div>
  );
}
