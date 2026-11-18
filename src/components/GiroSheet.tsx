import {
  Footprints,
  Navigation,
  RefreshCw,
  Replace,
  SkipForward,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  buildGiro,
  formatClosesIn,
  loadGiroPlan,
  replaceGiroStop,
  saveGiroPlan,
  skipGiroStop,
  type GiroPlan,
} from '../utils/giro';
import { walkingDirectionsUrl } from '../utils/routing';
import { venueTypeLabel } from '../utils/typeLabels';
import { EmptyState } from './EmptyState';

interface GiroSheetProps {
  open: boolean;
  /** True when a giro is already running on the map. */
  active?: boolean;
  onClose: () => void;
  /** Called when the user confirms the plan — then map shows numbered stops. */
  onStart: (plan: GiroPlan) => void | Promise<void>;
  onEnd?: () => void;
}

function formatHop(km: number): string {
  const d = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return `${d} (aria)`;
}

export function GiroSheet({
  open,
  active = false,
  onClose,
  onStart,
  onEnd,
}: GiroSheetProps) {
  const { center, venues, now, loading } = useAppContext();
  const [stopCount, setStopCount] = useState(4);
  const [plan, setPlan] = useState<GiroPlan | null>(null);
  const [swapHint, setSwapHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    // Wait for the venue pool — opening the sheet during Overpass/peek race
    // used to leave a permanent "Giro non disponibile" until manual regenerate.
    if (venues.length < 3) {
      if (!loading) setPlan(null);
      return;
    }

    const saved = loadGiroPlan(center, venues, now);
    if (saved) {
      setStopCount(saved.stops.length);
      setPlan(saved);
      return;
    }

    const fresh = buildGiro(center, venues, stopCount, now);
    setPlan(fresh);
    if (fresh) saveGiroPlan(center, fresh);
    // stopCount is applied via regenerate / handleStopCount — not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, center, venues, loading, now]);

  useEffect(() => {
    if (!swapHint) return;
    const t = window.setTimeout(() => setSwapHint(null), 2200);
    return () => window.clearTimeout(t);
  }, [swapHint]);

  const applyPlan = (next: GiroPlan | null) => {
    setPlan(next);
    if (next) saveGiroPlan(center, next);
  };

  const regenerate = (count = stopCount) => {
    const fresh = buildGiro(center, venues, count, now);
    applyPlan(fresh);
  };

  const handleStopCount = (n: number) => {
    setStopCount(n);
    regenerate(n);
  };

  const handleReplaceStop = (index: number) => {
    if (!plan) return;
    const next = replaceGiroStop(plan, center, index, venues, now);
    if (!next) {
      setSwapHint('Nessun altro locale disponibile qui vicino');
      return;
    }
    applyPlan(next);
    setSwapHint('Tappa aggiornata e salvata');
  };

  const handleSkipStop = (index: number) => {
    if (!plan) return;
    const next = skipGiroStop(plan, center, index, now);
    if (!next) {
      setSwapHint('Servono almeno 3 tappe');
      return;
    }
    applyPlan(next);
    setStopCount(next.stops.length);
    setSwapHint('Tappa saltata');
  };

  const openNavTo = (index: number) => {
    if (!plan) return;
    const from =
      index === 0 ? center : plan.stops[index - 1].venue.coordinates;
    const to = plan.stops[index].venue.coordinates;
    window.open(walkingDirectionsUrl(from, to), '_blank', 'noopener,noreferrer');
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[1200] flex flex-col bg-app/95 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative mt-auto max-h-[88%] flex flex-col bg-card rounded-t-2xl border-t border-line shadow-lg animate-slide-up pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 z-10 bg-card border-b border-line px-4 py-3 space-y-3 shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl text-ink">Giro di locali</h1>
              <p className="text-sm text-muted">
                Scegli le tappe, poi avvialo sulla mappa
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-muted hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Chiudi"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted shrink-0">Tappe</span>
            {[3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleStopCount(n)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  stopCount === n
                    ? 'bg-accent text-on-accent'
                    : 'bg-elev text-ink border border-line'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => regenerate()}
              className="ml-auto p-2 rounded-lg text-primary hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Rigenera percorso"
              title="Rigenera percorso"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {swapHint && (
            <p className="text-xs text-accent-text" role="status">
              {swapHint}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading && venues.length < 3 ? (
            <p className="text-center text-muted py-12">Caricamento locali…</p>
          ) : !plan ? (
            <EmptyState
              title="Giro non disponibile"
              description="Servono almeno 3 locali nella zona. Aumenta il raggio o togli i filtri."
              illustration="map"
              action={
                <button
                  type="button"
                  onClick={onClose}
                  className="text-primary font-medium"
                >
                  Chiudi
                </button>
              }
            />
          ) : (
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="flex items-center gap-2 text-sm text-muted bg-elev border border-line rounded-xl px-4 py-3">
                <Footprints size={18} className="text-accent" />
                <span>
                  {plan.walkingKm != null ? (
                    <>
                      ~
                      {plan.walkingKm < 1
                        ? `${Math.round(plan.walkingKm * 1000)} m`
                        : `${plan.walkingKm.toFixed(1)} km`}{' '}
                      a piedi (stima)
                      {plan.walkingMin != null
                        ? ` · ~${plan.walkingMin} min`
                        : ''}{' '}
                      · {plan.stops.length} tappe
                    </>
                  ) : (
                    <>
                      ~
                      {plan.totalWalkKm < 1
                        ? `${Math.round(plan.totalWalkKm * 1000)} m`
                        : `${plan.totalWalkKm.toFixed(1)} km`}{' '}
                      in linea d&apos;aria · {plan.stops.length} tappe
                    </>
                  )}
                </span>
              </div>

              <ol className="space-y-3">
                {plan.stops.map((stop, i) => (
                  <li key={`${stop.venue.id}-${i}`}>
                    <div className="bg-card rounded-xl border border-line p-4">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-accent text-on-accent font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <Link
                          to={`/locale/${stop.venue.id}`}
                          className="min-w-0 flex-1"
                        >
                          <h2 className="font-semibold text-ink truncate">
                            {stop.venue.name}
                          </h2>
                          <p className="text-sm text-muted">
                            {venueTypeLabel(stop.venue.type)}
                            {i === 0
                              ? ` · ${formatHop(stop.distanceFromPrevKm)} da te`
                              : ` · ${formatHop(stop.distanceFromPrevKm)} dalla tappa prima`}
                          </p>
                          <p className="text-sm font-medium text-open mt-1">
                            {formatClosesIn(stop.closesInMinutes)}
                          </p>
                        </Link>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openNavTo(i)}
                            className="p-2 rounded-lg text-primary hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Naviga verso tappa ${i + 1}`}
                            title="Indicazioni a piedi"
                          >
                            <Navigation size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReplaceStop(i)}
                            className="p-2 rounded-lg text-primary hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Cambia tappa ${i + 1}`}
                            title="Cambia questa tappa"
                          >
                            <Replace size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSkipStop(i)}
                            className="p-2 rounded-lg text-muted hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Salta tappa ${i + 1}`}
                            title="Salta questa tappa"
                          >
                            <SkipForward size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {plan && (
          <div className="shrink-0 border-t border-line p-4 bg-card space-y-2">
            <button
              type="button"
              onClick={() => void onStart(plan)}
              className="w-full py-3.5 rounded-xl bg-accent text-on-accent font-semibold shadow-sm hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
            >
              {active ? 'Aggiorna giro sulla mappa' : 'Inizia giro'}
            </button>
            {active && onEnd && (
              <button
                type="button"
                onClick={onEnd}
                className="w-full py-3 rounded-xl bg-card border border-line text-ink font-medium hover:bg-elev focus-visible:ring-2 focus-visible:ring-primary"
              >
                Termina giro
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
