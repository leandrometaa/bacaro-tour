import { SlidersHorizontal, X } from 'lucide-react';
import { useModalDismiss } from '../hooks/useModalDismiss';
import type { Mood } from '../types';
import type { FeatureFilterId } from '../utils/featureFilters';
import { localiCount } from '../utils/i18n';
import { FilterChips } from './FilterChips';
import { RadiusSlider } from './RadiusSlider';

interface FiltersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  radius: number;
  onRadiusChange: (r: number) => void;
  openNow: boolean;
  onOpenNowChange: (v: boolean) => void;
  selectedMoods: Mood[];
  onToggleMood: (m: Mood) => void;
  selectedFeatures: FeatureFilterId[];
  onToggleFeature: (f: FeatureFilterId) => void;
  hideVisited: boolean;
  onHideVisitedChange: (v: boolean) => void;
  onlyToTry: boolean;
  onOnlyToTryChange: (v: boolean) => void;
  onReset: () => void;
  activeCount: number;
  resultCount?: number;
}

export function FiltersSheet({
  isOpen,
  onClose,
  radius,
  onRadiusChange,
  openNow,
  onOpenNowChange,
  selectedMoods,
  onToggleMood,
  selectedFeatures,
  onToggleFeature,
  hideVisited,
  onHideVisitedChange,
  onlyToTry,
  onOnlyToTryChange,
  onReset,
  activeCount,
  resultCount,
}: FiltersSheetProps) {
  useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Chiudi filtri"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtri"
        className="relative bg-card rounded-t-2xl w-full max-w-lg shadow-xl animate-slide-up pb-[env(safe-area-inset-bottom)] max-h-[85dvh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-card flex items-center justify-between p-4 border-b border-line z-10">
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <SlidersHorizontal size={20} />
            Filtri
            {activeCount > 0 && (
              <span className="text-xs font-medium bg-elev text-primary px-2 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            aria-label="Chiudi"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <RadiusSlider value={radius} onChange={onRadiusChange} />
          <FilterChips
            openNow={openNow}
            onOpenNowChange={onOpenNowChange}
            selectedMoods={selectedMoods}
            onToggleMood={onToggleMood}
            selectedFeatures={selectedFeatures}
            onToggleFeature={onToggleFeature}
            hideVisited={hideVisited}
            onHideVisitedChange={onHideVisitedChange}
            onlyToTry={onlyToTry}
            onOnlyToTryChange={onOnlyToTryChange}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={activeCount === 0}
              className="flex-1 py-3 rounded-xl border border-line text-ink font-medium disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary"
            >
              Azzera
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-[2] py-3 bg-accent text-on-accent font-medium rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
            >
              {typeof resultCount === 'number'
                ? `Mostra ${localiCount(resultCount)}`
                : 'Mostra risultati'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
