"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ItineraryData } from "@/lib/types";

type Point = {
  lat: number;
  lng: number;
  name: string;
  description?: string;
  time?: string;
  order: number;
};

function numberedIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#f0603a;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function MapView({ data }: { data: ItineraryData }) {
  const points = useMemo<Point[]>(() => {
    const pts: Point[] = [];
    let order = 0;
    for (const day of data.days || []) {
      for (const stop of day.stops || []) {
        if (
          typeof stop.lat === "number" &&
          typeof stop.lng === "number" &&
          !Number.isNaN(stop.lat) &&
          !Number.isNaN(stop.lng)
        ) {
          order += 1;
          pts.push({
            lat: stop.lat,
            lng: stop.lng,
            name: stop.name,
            description: stop.description,
            time: stop.time,
            order,
          });
        }
      }
    }
    return pts;
  }, [data]);

  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-edge bg-panel text-sm text-slate-400">
        Aucun lieu géolocalisé à afficher sur la carte.
      </div>
    );
  }

  const center: [number, number] = [points[0].lat, points[0].lng];
  const line: [number, number][] = points.map((p) => [p.lat, p.lng]);

  return (
    <MapContainer center={center} zoom={6} scrollWheelZoom className="h-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={line} color="#f0603a" weight={3} opacity={0.7} />
      {points.map((p) => (
        <Marker
          key={p.order}
          position={[p.lat, p.lng]}
          icon={numberedIcon(p.order)}
        >
          <Popup>
            <strong>{p.name}</strong>
            {p.time && <div className="text-xs">🕑 {p.time}</div>}
            {p.description && <div className="mt-1 text-xs">{p.description}</div>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
