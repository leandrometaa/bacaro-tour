import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { VenueCard } from '../components/VenueCard';
import { getVenueById, loadVenueById } from '../data/venues';
import type { Venue } from '../types';
import { localiCount } from '../utils/i18n';
import { decodeSharedSnaps, snapToVenue } from '../utils/share';

export function SharedListPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const name = params.get('name') || 'Lista condivisa';
  const ids = useMemo(
    () =>
      (params.get('ids') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40),
    [params]
  );
  const embedded = useMemo(() => {
    const raw = params.get('v');
    if (!raw) return [] as Venue[];
    return decodeSharedSnaps(raw).map(snapToVenue);
  }, [params]);

  const [venues, setVenues] = useState<Venue[]>(embedded);
  const [loading, setLoading] = useState(embedded.length === 0 && ids.length > 0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      const byId = new Map<string, Venue>();
      for (const v of embedded) byId.set(v.id, v);

      // Prefer embedded snapshots; fill gaps from cache / Overpass.
      for (const id of ids) {
        if (byId.has(id)) continue;
        const cached = getVenueById(id);
        if (cached) {
          byId.set(id, cached);
          continue;
        }
        try {
          const v = await loadVenueById(id, controller.signal);
          if (v) byId.set(id, v);
        } catch {
          /* skip */
        }
      }

      // Preserve share order when possible
      const ordered: Venue[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        const v = byId.get(id);
        if (v && !seen.has(v.id)) {
          ordered.push(v);
          seen.add(v.id);
        }
      }
      for (const v of byId.values()) {
        if (!seen.has(v.id)) {
          ordered.push(v);
          seen.add(v.id);
        }
      }

      if (!cancelled) {
        setVenues(ordered);
        setLoading(false);
      }
    }

    setLoading(true);
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ids, embedded]);

  return (
    <div className="flex flex-col h-full bg-app pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-10 bg-card border-b border-line px-4 py-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg text-muted hover:bg-elev"
          aria-label="Indietro"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-xl text-ink truncate">{name}</h1>
          <p className="text-sm text-muted">
            {loading ? 'Caricamento…' : localiCount(venues.length)}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!loading && venues.length === 0 ? (
          <EmptyState
            title="Nessun locale"
            description="Il link non contiene ID validi o i locali non sono raggiungibili."
            illustration="search"
            action={
              <Link to="/" className="text-primary font-medium">
                Vai alla mappa
              </Link>
            }
          />
        ) : (
          <div className="grid gap-0 bg-card rounded-xl border border-line px-3">
            {venues.map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
