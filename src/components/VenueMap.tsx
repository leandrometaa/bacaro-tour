import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useEffect, useMemo, useRef } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { Venue, VenueType } from '../types';
import { getOpeningState } from '../utils/openingHours';

const BRAND = 'var(--color-primary)';
const BRAND_DARK = 'var(--color-ink)';
const ACCENT = 'var(--color-accent)';
const VISITED = 'var(--color-primary)';
const TO_TRY = 'var(--color-accent-text)';
const CLOSED = 'var(--color-closed)';
const UNKNOWN = 'var(--color-subtle)';
const MUTED = 'var(--color-line)';

type PinKind = 'default' | 'visited' | 'toTry';

function typeGlyph(type: VenueType): string {
  // Compact SVG paths for pin badge
  if (type === 'pizzeria') {
    return `<circle cx="12" cy="12" r="7"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="14" cy="11" r="1" fill="currentColor"/><circle cx="11" cy="14" r="1" fill="currentColor"/>`;
  }
  if (type === 'cafe' || type === 'gelateria') {
    return `<path d="M7 9h8v6a3 3 0 01-3 3h-2a3 3 0 01-3-3V9z"/><path d="M15 10h2a2 2 0 010 4h-2"/>`;
  }
  if (
    type === 'ristorante' ||
    type === 'trattoria' ||
    type === 'osteria'
  ) {
    return `<path d="M8 5v14M8 5c0 3 3 3 3 6v8M16 5v14M13 5v6c0 2 3 2 3 0V5"/>`;
  }
  // glass / bar / pub / enoteca
  return `<path d="M8 5h8l-1.5 10a2.5 2.5 0 01-5 0L8 5z"/><path d="M12 15v4"/><path d="M9 20h6"/>`;
}

function createTypeIcon(
  type: VenueType,
  color: string,
  size = 34,
  selected = false
) {
  const border = selected
    ? '3px solid var(--color-ink)'
    : '2px solid white';
  const glyph = typeGlyph(type);
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(42,31,34,0.3);
        border: ${border};
      ">
        <svg style="transform: rotate(45deg); color: white; width: ${Math.round(size * 0.48)}px; height: ${Math.round(size * 0.48)}px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          ${glyph}
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function pinColor(
  kind: PinKind,
  opening: 'open' | 'closed' | 'unknown'
): string {
  if (kind === 'visited') return VISITED;
  if (kind === 'toTry') return TO_TRY;
  // Open venues stay brand teal — orange is reserved for an active giro.
  if (opening === 'open') return BRAND;
  if (opening === 'closed') return CLOSED;
  return UNKNOWN;
}

function createGiroStopIcon(order: number, selected = false) {
  const size = selected ? 42 : 38;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${ACCENT};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-on-accent);
        font-weight: 700;
        font-size: 15px;
        box-shadow: 0 2px 8px rgba(42,31,34,0.35);
        border: 3px solid white;
      ">${order}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const userIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      background: ${BRAND_DARK};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(42,31,34,0.35);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 2) return 15;
  if (radiusKm <= 5) return 14;
  if (radiusKm <= 10) return 13;
  if (radiusKm <= 20) return 12;
  return 11;
}

function FitGiroBounds({
  points,
}: {
  points: [number, number][] | null;
}) {
  const map = useMap();
  const keyRef = useRef<string>('');

  useEffect(() => {
    if (!points || points.length < 2) return;
    const key = points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join('|');
    if (keyRef.current === key) return;
    keyRef.current = key;
    const bounds = L.latLngBounds(points.map(([lat, lon]) => [lat, lon]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16, animate: true });
  }, [map, points]);

  return null;
}

function MapController({
  center,
  radius,
  flyNonce,
}: {
  center: [number, number];
  radius: number;
  flyNonce: number;
}) {
  const map = useMap();
  const prevCenterRef = useRef<[number, number] | null>(null);
  const prevRadiusRef = useRef(radius);
  const prevFlyRef = useRef(flyNonce);
  const bootedRef = useRef(false);

  useEffect(() => {
    // After keep-alive show/hide, Leaflet needs a size refresh without flying.
    const onVisible = () => {
      map.invalidateSize({ animate: false });
    };
    onVisible();
    const ro = new ResizeObserver(onVisible);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => {
    const zoom = zoomForRadius(radius);
    const centerChanged =
      !prevCenterRef.current ||
      prevCenterRef.current[0] !== center[0] ||
      prevCenterRef.current[1] !== center[1];
    const radiusChanged = prevRadiusRef.current !== radius;
    const flyRequested = prevFlyRef.current !== flyNonce;

    // First paint: jump without animation to avoid the remount "shake".
    if (!bootedRef.current) {
      map.setView(center, zoom, { animate: false });
      bootedRef.current = true;
      prevCenterRef.current = center;
      prevRadiusRef.current = radius;
      prevFlyRef.current = flyNonce;
      return;
    }

    if (centerChanged || flyRequested) {
      map.flyTo(center, zoom, { duration: 0.45 });
      prevCenterRef.current = center;
    } else if (radiusChanged) {
      map.setZoom(zoom, { animate: false });
    }

    prevRadiusRef.current = radius;
    prevFlyRef.current = flyNonce;
  }, [map, center, radius, flyNonce]);

  return null;
}

function MapMoveWatcher({
  queryCenter,
  onMovedAway,
  onViewCenter,
}: {
  queryCenter: [number, number];
  onMovedAway: (moved: boolean) => void;
  onViewCenter: (center: [number, number]) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      const view: [number, number] = [c.lat, c.lng];
      onViewCenter(view);
      const moved =
        Math.abs(view[0] - queryCenter[0]) > 0.002 ||
        Math.abs(view[1] - queryCenter[1]) > 0.002;
      onMovedAway(moved);
    },
  });

  useEffect(() => {
    onMovedAway(false);
  }, [queryCenter, onMovedAway]);

  return null;
}

function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 42 : 48;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${BRAND};color:white;display:flex;align-items:center;
      justify-content:center;font-weight:600;font-size:13px;
      border:3px solid white;box-shadow:0 2px 8px rgba(42,31,34,0.3);
    ">${count}</div>`,
    className: 'bacaro-cluster',
    iconSize: L.point(size, size),
  });
}

interface VenueMapProps {
  center: [number, number];
  radius: number;
  venues: Venue[];
  selectedVenueId?: string | null;
  visitedIds?: Set<string>;
  toTryIds?: Set<string>;
  /** Ordered giro stops — highlighted only after “Inizia giro”. */
  giroStops?: Venue[] | null;
  /** Optional pedestrian route polyline (lat,lon). */
  giroRoutePath?: [number, number][] | null;
  flyNonce?: number;
  onVenueClick: (venue: Venue) => void;
  onMovedAway: (moved: boolean) => void;
  onViewCenter: (center: [number, number]) => void;
}

export function VenueMap({
  center,
  radius,
  venues,
  selectedVenueId = null,
  visitedIds,
  toTryIds,
  giroStops = null,
  giroRoutePath = null,
  flyNonce = 0,
  onVenueClick,
  onMovedAway,
  onViewCenter,
}: VenueMapProps) {
  const initialZoom = useMemo(() => zoomForRadius(radius), [radius]);
  const giroActive = Boolean(giroStops?.length);

  const giroIdSet = useMemo(() => {
    if (!giroStops?.length) return null;
    return new Set(giroStops.map((v) => v.id));
  }, [giroStops]);

  const giroPath = useMemo(() => {
    if (giroRoutePath && giroRoutePath.length >= 2) return giroRoutePath;
    if (!giroStops?.length) return null;
    return [center, ...giroStops.map((v) => v.coordinates)] as [
      number,
      number,
    ][];
  }, [giroStops, giroRoutePath, center]);

  const dashed = !(giroRoutePath && giroRoutePath.length >= 2);

  return (
    <MapContainer
      center={center}
      zoom={initialZoom}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        crossOrigin=""
      />

      <MapController center={center} radius={radius} flyNonce={flyNonce} />
      <MapMoveWatcher
        queryCenter={center}
        onMovedAway={onMovedAway}
        onViewCenter={onViewCenter}
      />
      <FitGiroBounds points={giroPath} />

      <Circle
        center={center}
        radius={radius * 1000}
        pathOptions={{
          color: BRAND,
          fillColor: BRAND,
          fillOpacity: giroActive ? 0.06 : 0.12,
          weight: 2,
        }}
      />

      <Marker position={center} icon={userIcon}>
        <Popup>Centro ricerca</Popup>
      </Marker>

      {giroPath && (
        <Polyline
          positions={giroPath}
          pathOptions={{
            color: ACCENT,
            weight: 5,
            opacity: 0.9,
            ...(dashed ? { dashArray: '10 8' } : {}),
          }}
        />
      )}

      {/* Giro stops outside the cluster so they stay visible and numbered */}
      {giroStops?.map((venue, i) => (
        <Marker
          key={`giro-${venue.id}`}
          position={venue.coordinates}
          icon={createGiroStopIcon(
            i + 1,
            venue.id === selectedVenueId
          )}
          zIndexOffset={3000 + i}
          eventHandlers={{
            click: () => onVenueClick(venue),
          }}
        >
          <Popup>
            <strong>
              {i + 1}. {venue.name}
            </strong>
          </Popup>
        </Marker>
      ))}

      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={56}
        spiderfyOnMaxZoom
        iconCreateFunction={createClusterIcon}
      >
        {venues.map((venue) => {
          if (giroIdSet?.has(venue.id)) return null;

          const opening = getOpeningState(venue);
          const kind: PinKind = visitedIds?.has(venue.id)
            ? 'visited'
            : toTryIds?.has(venue.id)
              ? 'toTry'
              : 'default';
          const selected = venue.id === selectedVenueId;
          const icon = createTypeIcon(
            venue.type,
            giroActive ? MUTED : pinColor(kind, opening),
            selected ? 40 : 34,
            selected
          );
          return (
            <Marker
              key={venue.id}
              position={venue.coordinates}
              icon={icon}
              zIndexOffset={selected ? 1000 : 0}
              opacity={giroActive ? 0.35 : 1}
              eventHandlers={{
                click: () => onVenueClick(venue),
              }}
            />
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
