import L from 'leaflet';
import {
  ChevronRight,
  Download,
  Info,
  Pencil,
  Share2,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { AddVisitModal } from '../components/AddVisitModal';
import { EmptyState } from '../components/EmptyState';
import { Toast } from '../components/Toast';
import { VenuePhoto } from '../components/VenuePhoto';
import { getVenueById } from '../data/venues';
import { useUserData } from '../hooks/useUserData';
import type { SavedList, Venue, Visit } from '../types';
import { computeDiaryStats } from '../utils/diaryStats';
import { localiCount } from '../utils/i18n';
import { shareList } from '../utils/share';

type Tab = 'liste' | 'diario' | 'mappa' | 'stats';

const pinIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width:28px;height:28px;background:var(--color-primary);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(42,31,34,0.3)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const label = d.toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MyPlacesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('liste');
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    data,
    deleteList,
    deleteVisit,
    updateVisit,
    exportData,
    importData,
    getPersonalVenues,
    storageError,
  } = useUserData();

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bacaro-tour-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Backup scaricato');
  };

  const handleImportFile = async (file: File) => {
    const ok = window.confirm(
      'L’import sostituisce tutte le liste e le visite attuali. Continuare?'
    );
    if (!ok) return;
    try {
      const text = await file.text();
      importData(text);
      setToast('Dati importati');
    } catch (err) {
      setToast(
        err instanceof Error ? err.message : 'Import non riuscito'
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-app pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="bg-card border-b border-line">
        <div className="p-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl text-ink">I miei posti</h1>
            <p className="text-sm text-subtle mt-0.5">
              Liste, diario e mappa personale
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Link
              to="/info"
              className="p-2 rounded-lg text-muted hover:bg-elev"
              aria-label="Info e crediti"
              title="Info"
            >
              <Info size={20} />
            </Link>
            <button
              type="button"
              onClick={handleExport}
              className="p-2 rounded-lg text-muted hover:bg-elev"
              aria-label="Esporta backup"
              title="Esporta JSON"
            >
              <Download size={20} />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-lg text-muted hover:bg-elev"
              aria-label="Importa backup"
              title="Importa JSON"
            >
              <Upload size={20} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="flex border-b border-line">
          {(
            [
              ['liste', 'Liste'],
              ['diario', 'Diario'],
              ['stats', 'Stats'],
              ['mappa', 'Mappa'],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-subtle'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'liste' && (
          <ListsTab
            lists={data.lists}
            onDeleteList={deleteList}
            onShareList={async (list) => {
              const venues = list.venueIds
                .map((id) => getVenueById(id))
                .filter((v): v is Venue => Boolean(v));
              try {
                const result = await shareList(list, venues);
                setToast(
                  result === 'copied' ? 'Lista copiata' : 'Lista condivisa'
                );
              } catch {
                /* cancelled */
              }
            }}
          />
        )}
        {activeTab === 'diario' && (
          <DiaryTab
            visits={data.visits}
            onDeleteVisit={deleteVisit}
            onUpdateVisit={updateVisit}
            storageError={storageError}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab data={data} />
        )}
        {activeTab === 'mappa' && (
          <PersonalMapTab venues={getPersonalVenues()} />
        )}
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function ListsTab({
  lists,
  onDeleteList,
  onShareList,
}: {
  lists: SavedList[];
  onDeleteList: (listId: string) => void;
  onShareList: (list: SavedList) => void;
}) {
  if (lists.length === 0) {
    return (
      <EmptyState
        title="Nessuna lista"
        description="Salva i tuoi locali preferiti per trovarli facilmente"
        illustration="heart"
      />
    );
  }

  return (
    <div className="space-y-3">
      {lists.map((list) => {
        const previewVenues = list.venueIds
          .slice(0, 3)
          .map((id) => getVenueById(id))
          .filter(Boolean);

        return (
          <div
            key={list.id}
            className="bg-card rounded-xl border border-line overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Link
                  to={`/lista-salvata/${list.id}`}
                  className="font-semibold text-ink hover:text-primary min-w-0 truncate"
                >
                  {list.name}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-subtle">
                    {localiCount(list.venueIds.length)}
                  </span>
                  {list.venueIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onShareList(list)}
                      className="p-1 text-subtle hover:text-primary"
                      aria-label="Condividi lista (con snapshot)"
                      title="Condividi con anteprime locali nel link"
                    >
                      <Share2 size={16} />
                    </button>
                  )}
                  {list.id !== 'da-provare' && list.id !== 'preferiti' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Eliminare la lista “${list.name}”? Non si può annullare.`
                          )
                        ) {
                          onDeleteList(list.id);
                        }
                      }}
                      className="p-1 text-subtle hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {previewVenues.length > 0 ? (
                <div className="space-y-2">
                  {previewVenues.map(
                    (venue) =>
                      venue && (
                        <Link
                          key={venue.id}
                          to={`/locale/${venue.id}`}
                          className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-elev"
                        >
                          <VenuePhoto
                            src={venue.photos[0]}
                            type={venue.type}
                            alt={venue.name}
                            className="w-12 h-12 rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-ink truncate">
                              {venue.name}
                            </p>
                            <p className="text-sm text-subtle truncate">
                              {venue.city || venue.address}
                            </p>
                          </div>
                          <ChevronRight size={20} className="text-subtle" />
                        </Link>
                      )
                  )}
                  {list.venueIds.length > 3 && (
                    <Link
                      to={`/lista-salvata/${list.id}`}
                      className="text-sm text-primary font-medium inline-flex items-center gap-1"
                    >
                      + altri {list.venueIds.length - 3}
                      <ChevronRight size={16} />
                    </Link>
                  )}
                </div>
              ) : (
                <Link
                  to={`/lista-salvata/${list.id}`}
                  className="text-sm text-subtle"
                >
                  Lista vuota — apri dettaglio
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiaryTab({
  visits,
  onDeleteVisit,
  onUpdateVisit,
  storageError,
}: {
  visits: Visit[];
  onDeleteVisit: (visitId: string) => void;
  onUpdateVisit: (
    visitId: string,
    patch: Partial<Omit<Visit, 'id' | 'venueId'>>
  ) => void;
  storageError?: string | null;
}) {
  const [editing, setEditing] = useState<{
    visit: Visit;
    venue: Venue;
  } | null>(null);

  const grouped = useMemo(() => {
    const sorted = [...visits].sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, Visit[]>();
    for (const visit of sorted) {
      const key = visit.date.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(visit);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [visits]);

  const summary = useMemo(() => {
    return computeDiaryStats(
      { version: 3, lists: [], visits, venuesById: {} },
      getVenueById
    );
  }, [visits]);

  if (visits.length === 0) {
    return (
      <EmptyState
        title="Nessuna visita"
        description="Tieni traccia dei locali che visiti con voto e note"
        illustration="glass"
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="bg-card rounded-xl border border-line p-3 space-y-2">
          <p className="text-sm text-muted">
            Questo mese:{' '}
            <span className="font-semibold text-ink">
              {summary.thisMonthCount} visite
            </span>
          </p>
          {summary.citiesExplored.length > 0 && (
            <p className="text-sm text-muted">
              Città:{' '}
              <span className="text-ink">
                {summary.citiesExplored.slice(0, 4).join(', ')}
              </span>
            </p>
          )}
          {summary.topRated.length > 0 && (
            <p className="text-sm text-muted">
              Preferiti:{' '}
              <span className="text-ink">
                {summary.topRated
                  .slice(0, 3)
                  .map((t) => `${t.name} (${t.rating}★)`)
                  .join(' · ')}
              </span>
            </p>
          )}
        </div>

        {grouped.map(([monthKey, monthVisits]) => (
          <div key={monthKey}>
            <h2 className="text-sm font-semibold text-subtle uppercase tracking-wide mb-3">
              {monthLabel(monthVisits[0].date)}
            </h2>
            <div className="space-y-3">
              {monthVisits.map((visit) => {
                const venue = getVenueById(visit.venueId);

                return (
                  <div
                    key={visit.id}
                    className="bg-card rounded-xl border border-line overflow-hidden"
                  >
                    <div className="flex gap-3 p-4">
                      {visit.photoDataUrl ? (
                        <img
                          src={visit.photoDataUrl}
                          alt=""
                          className="w-20 h-20 rounded-lg object-cover shrink-0 border border-line"
                        />
                      ) : venue ? (
                        <Link to={`/locale/${venue.id}`} className="shrink-0">
                          <VenuePhoto
                            src={venue.photos[0]}
                            type={venue.type}
                            alt={venue.name}
                            className="w-20 h-20 rounded-lg"
                          />
                        </Link>
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-elev flex items-center justify-center shrink-0 text-subtle text-xs text-center px-1">
                          Locale non in cache
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          {venue ? (
                            <Link to={`/locale/${venue.id}`} className="min-w-0">
                              <h3 className="font-semibold text-ink truncate">
                                {venue.name}
                              </h3>
                              <p className="text-sm text-subtle">
                                {venue.city || venue.address}
                              </p>
                            </Link>
                          ) : (
                            <div className="min-w-0">
                              <h3 className="font-semibold text-ink truncate">
                                Locale rimosso
                              </h3>
                              <p className="text-sm text-subtle truncate">
                                {visit.venueId}
                              </p>
                            </div>
                          )}
                          <div className="flex gap-1 shrink-0">
                            {venue && (
                            <button
                              type="button"
                              onClick={() => setEditing({ visit, venue })}
                              className="p-1.5 text-subtle hover:text-primary"
                              aria-label="Modifica visita"
                            >
                              <Pencil size={16} />
                            </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Eliminare questa visita? Non si può annullare.'
                                  )
                                ) {
                                  onDeleteVisit(visit.id);
                                }
                              }}
                              className="p-1.5 text-subtle hover:text-red-500"
                              aria-label="Elimina visita"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={14}
                                className={
                                  star <= visit.rating
                                    ? 'text-accent fill-accent'
                                    : 'text-line'
                                }
                              />
                            ))}
                          </div>
                          <span className="text-xs text-subtle">•</span>
                          <span className="text-xs text-subtle">
                            {new Date(visit.date).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {visit.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {visit.tags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-elev text-muted px-2 py-0.5 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {visit.note && (
                          <p className="text-sm text-muted mt-2 line-clamp-2">
                            {visit.note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <AddVisitModal
          isOpen
          onClose={() => setEditing(null)}
          venue={editing.venue}
          initialVisit={editing.visit}
          onUpdateVisit={(id, patch) => {
            onUpdateVisit(id, patch);
            setEditing(null);
          }}
          storageError={storageError}
        />
      )}
    </>
  );
}

function StatsTab({ data }: { data: import('../types').UserData }) {
  const stats = useMemo(
    () => computeDiaryStats(data, getVenueById),
    [data]
  );

  if (stats.visitCount === 0) {
    return (
      <EmptyState
        title="Niente da mostrare"
        description="Registra qualche visita per vedere le statistiche del diario."
        illustration="glass"
      />
    );
  }

  return (
    <div className="space-y-3 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-line p-4">
          <p className="text-2xl font-display text-ink">{stats.visitCount}</p>
          <p className="text-sm text-muted">Visite</p>
        </div>
        <div className="bg-card rounded-xl border border-line p-4">
          <p className="text-2xl font-display text-ink">{stats.uniqueVenues}</p>
          <p className="text-sm text-muted">Locali visitati</p>
        </div>
        <div className="bg-card rounded-xl border border-line p-4">
          <p className="text-2xl font-display text-ink">
            {stats.averageRating ?? '—'}
          </p>
          <p className="text-sm text-muted">Voto medio</p>
        </div>
        <div className="bg-card rounded-xl border border-line p-4">
          <p className="text-lg font-display text-ink truncate">
            {stats.favoriteArea ?? '—'}
          </p>
          <p className="text-sm text-muted">Zona preferita</p>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-line p-4">
        <h3 className="font-semibold text-ink mb-1">Questo mese</h3>
        <p className="text-2xl font-display text-ink">{stats.thisMonthCount}</p>
        <p className="text-sm text-muted">visite registrate</p>
      </div>
      {stats.citiesExplored.length > 0 && (
        <div className="bg-card rounded-xl border border-line p-4">
          <h3 className="font-semibold text-ink mb-2">Città esplorate</h3>
          <p className="text-sm text-muted">
            {stats.citiesExplored.join(' · ')}
          </p>
        </div>
      )}
      {stats.topRated.length > 0 && (
        <div className="bg-card rounded-xl border border-line p-4">
          <h3 className="font-semibold text-ink mb-2">I tuoi preferiti</h3>
          <ul className="space-y-1 text-sm text-muted">
            {stats.topRated.map((t) => (
              <li key={t.venueId}>
                {t.name} · {t.rating}★
              </li>
            ))}
          </ul>
        </div>
      )}
      {stats.topTags.length > 0 && (
        <div className="bg-card rounded-xl border border-line p-4">
          <h3 className="font-semibold text-ink mb-2">Tag più usati</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topTags.map(({ tag, count }) => (
              <span
                key={tag}
                className="bg-accent-soft text-accent-text text-sm px-3 py-1 rounded-full"
              >
                {tag} · {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonalMapTab({ venues }: { venues: Venue[] }) {
  const navigate = useNavigate();

  if (venues.length === 0) {
    return (
      <EmptyState
        title="Mappa vuota"
        description="Salva o visita dei locali per vederli qui"
        illustration="map"
      />
    );
  }

  const center = venues[0].coordinates;

  return (
    <div className="space-y-3">
      <p className="text-sm text-subtle">
        {localiCount(venues.length)} tra salvati e visitati
      </p>
      <div className="h-[55vh] min-h-[280px] rounded-xl overflow-hidden border border-line">
        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {venues.map((venue) => (
            <Marker
              key={venue.id}
              position={venue.coordinates}
              icon={pinIcon}
              eventHandlers={{
                click: () => navigate(`/locale/${venue.id}`),
              }}
            >
              <Popup>
                <button
                  type="button"
                  className="font-medium text-left"
                  onClick={() => navigate(`/locale/${venue.id}`)}
                >
                  {venue.name}
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
