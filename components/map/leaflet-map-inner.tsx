"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { MAP_ATTRIBUTION, MAP_TILE_URL } from "@/lib/maps";

export type MapPoint = { lat: number; lng: number };

export type LeafletMapInnerProps = {
  center: MapPoint;
  zoom: number;
  marker?: MapPoint;
  draggableMarker?: boolean;
  onPick?: (lat: number, lng: number) => void;
  interactive: "inline" | "full";
  height?: number | string;
};

function createPinIcon(color = "#2563eb") {
  return L.divIcon({
    className: "custom-pin-icon",
    html: `
      <span
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.28);
          transform: translateY(-2px);
          position: relative;
        "
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2.75C8.13 2.75 5 5.88 5 9.75c0 5.27 7 11.5 7 11.5s7-6.23 7-11.5c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" fill="white"/>
        </svg>
      </span>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -10],
  });
}

function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function MapClickHandler({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      if (!onPick) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export function LeafletMapInner({
  center,
  zoom,
  marker,
  draggableMarker = false,
  onPick,
  interactive,
  height = 320,
}: LeafletMapInnerProps) {
  const pinIcon = useMemo(() => createPinIcon(), []);
  const visibleMarker = marker ?? center;

  return (
    <div style={{ height, width: "100%" }} className="relative overflow-hidden rounded-lg border bg-muted/40">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={interactive === "full"}
        zoomControl
        dragging
        attributionControl
        style={{ height: "100%", width: "100%" }}
      >
        <MapResizer />
        <MapClickHandler onPick={onPick} />
        <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
        {visibleMarker && (
          <Marker
            position={[visibleMarker.lat, visibleMarker.lng]}
            icon={pinIcon}
            draggable={Boolean(draggableMarker)}
            eventHandlers={
              draggableMarker
                ? {
                    dragend(event) {
                      if (!onPick) return;
                      const point = event.target.getLatLng();
                      onPick(point.lat, point.lng);
                    },
                  }
                : undefined
            }
          />
        )}
      </MapContainer>
    </div>
  );
}

export default LeafletMapInner;
