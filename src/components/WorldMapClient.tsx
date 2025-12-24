"use client";

import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  GeoJSON,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
// Leaflet CSS is loaded in app/layout.tsx via CDN link to avoid Next.js global CSS import rules

type LatLng = [number, number];

type Props = {
  center?: LatLng;
  zoom?: number;
  height?: string | number;
  pathCoords?: LatLng[]; // ordered path coordinates (lat, lon)
  planePosition?: LatLng | null; // current plane position (lat, lon)
};

function FitBounds({ coords }: { coords?: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (!coords || coords.length === 0) return;
    try {
      map.fitBounds(coords as any, { padding: [40, 40] });
    } catch (e) {
      // ignore
    }
  }, [coords, map]);

  return null;
}

const WorldMapClient: React.FC<Props> = ({
  center = [25, 65],
  zoom = 3,
  height = "60vh",
  pathCoords = [],
  planePosition = null,
}) => {
  const [geo, setGeo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const url =
      "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load borders");
        return res.json();
      })
      .then((data) => {
        if (mounted) setGeo(data);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setError("Could not load country borders");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const style = {
    color: "#31708f",
    weight: 1,
    fill: false,
    opacity: 0.8,
  } as any;

  return (
    <div style={{ width: "100%", height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", borderRadius: 8 }}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <ZoomControl position="topright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geo && <GeoJSON data={geo} style={style} />}

        {/* Draw provided path as polyline (mock or real) */}
        {pathCoords && pathCoords.length > 0 && (
          <>
            <Polyline
              positions={pathCoords}
              pathOptions={{ color: "#4ade80", weight: 4, dashArray: "6 6" }}
            />
            <Polyline
              positions={pathCoords}
              pathOptions={{ color: "rgba(255,255,255,0.2)", weight: 2 }}
            />
            <FitBounds coords={pathCoords} />
          </>
        )}

        {/* Plane marker (if available) */}
        {planePosition && (
          <CircleMarker
            center={planePosition}
            radius={8}
            pathOptions={{ color: "#fbbf24", fillColor: "#f59e0b", weight: 2 }}
          />
        )}

        {error && (
          <div style={{ position: "absolute", left: 8, top: 8, zIndex: 9999 }}>
            <small style={{ color: "#fbbf24" }}>{error}</small>
          </div>
        )}
      </MapContainer>
    </div>
  );
};

export default WorldMapClient;
