import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { Venue } from '../types';
import { isVenueOpenNow } from '../utils/openingHours';

const BRAND = '#69a6ab';
const BRAND_DARK = '#457880';
const CLOSED = '#9bb0b4';

const createCustomIcon = (isOpen: boolean, unknownHours: boolean) => {
  const color = unknownHours ? CLOSED : isOpen ? BRAND : CLOSED;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(26,69,73,0.3);
        border: 2px solid white;
      ">
        <svg style="transform: rotate(45deg); color: white; width: 14px; height: 14px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const userIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      background: ${BRAND_DARK};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(26,69,73,0.35);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapUpdater({
  center,
  radius,
}: {
  center: [number, number];
  radius: number;
}) {
  const map = useMap();
  const prevCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    const prev = prevCenterRef.current;
    if (!prev || prev[0] !== center[0] || prev[1] !== center[1]) {
      const zoom = radius <= 5 ? 14 : radius <= 10 ? 13 : radius <= 20 ? 12 : 11;
      map.setView(center, zoom);
      prevCenterRef.current = center;
    }
  }, [map, center, radius]);

  return null;
}

interface VenueMapProps {
  center: [number, number];
  radius: number;
  venues: Venue[];
  onVenueClick: (venue: Venue) => void;
}

export function VenueMap({
  center,
  radius,
  venues,
  onVenueClick,
}: VenueMapProps) {
  const zoom = useMemo(() => {
    if (radius <= 5) return 14;
    if (radius <= 10) return 13;
    if (radius <= 20) return 12;
    return 11;
  }, [radius]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapUpdater center={center} radius={radius} />

      <Circle
        center={center}
        radius={radius * 1000}
        pathOptions={{
          color: BRAND,
          fillColor: BRAND,
          fillOpacity: 0.12,
          weight: 2,
        }}
      />

      <Marker position={center} icon={userIcon}>
        <Popup>La tua posizione</Popup>
      </Marker>

      {venues.map((venue) => {
        const unknown = !venue.hasHours;
        const isOpen = !unknown && isVenueOpenNow(venue);
        return (
          <Marker
            key={venue.id}
            position={venue.coordinates}
            icon={createCustomIcon(isOpen, unknown)}
            eventHandlers={{
              click: () => onVenueClick(venue),
            }}
          >
            <Popup>
              <div className="font-medium">{venue.name}</div>
              <div className="text-sm text-surface-500">
                {venue.city || venue.address}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
