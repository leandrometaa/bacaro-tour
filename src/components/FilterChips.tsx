import {
  Accessibility,
  Beer,
  Clock,
  Coffee,
  Dog,
  EyeOff,
  Heart,
  Moon,
  Pizza,
  ShoppingBag,
  Utensils,
  Wifi,
  Wine,
} from 'lucide-react';
import type { Mood } from '../types';
import {
  FEATURE_FILTERS,
  type FeatureFilterId,
} from '../utils/featureFilters';

interface FilterChipsProps {
  openNow: boolean;
  onOpenNowChange: (value: boolean) => void;
  selectedMoods: Mood[];
  onToggleMood: (mood: Mood) => void;
  selectedFeatures: FeatureFilterId[];
  onToggleFeature: (id: FeatureFilterId) => void;
  hideVisited?: boolean;
  onHideVisitedChange?: (v: boolean) => void;
  onlyToTry?: boolean;
  onOnlyToTryChange?: (v: boolean) => void;
  showPersonal?: boolean;
}

const MOODS: { id: Mood; label: string; icon: React.ReactNode }[] = [
  { id: 'aperitivo', label: 'Aperitivo', icon: <Coffee size={16} /> },
  { id: 'vino-tagliere', label: 'Vino e tagliere', icon: <Wine size={16} /> },
  { id: 'pizza', label: 'Pizza', icon: <Pizza size={16} /> },
  { id: 'cena', label: 'Cena', icon: <Utensils size={16} /> },
];

const FEATURE_ICONS: Record<FeatureFilterId, React.ReactNode> = {
  'tipo-bar': <Coffee size={16} />,
  'tipo-pub': <Beer size={16} />,
  'tipo-enoteca': <Wine size={16} />,
  'tipo-pizzeria': <Pizza size={16} />,
  dehors: <Coffee size={16} />,
  cani: <Dog size={16} />,
  accessibile: <Accessibility size={16} />,
  wifi: <Wifi size={16} />,
  asporto: <ShoppingBag size={16} />,
  tardi: <Moon size={16} />,
};

function chipClass(active: boolean) {
  return `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
    active
      ? 'bg-primary text-on-primary'
      : 'bg-card text-ink border border-line'
  }`;
}

export function FilterChips({
  openNow,
  onOpenNowChange,
  selectedMoods,
  onToggleMood,
  selectedFeatures,
  onToggleFeature,
  hideVisited = false,
  onHideVisitedChange,
  onlyToTry = false,
  onOnlyToTryChange,
  showPersonal = true,
}: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 py-1">
      <button
        type="button"
        onClick={() => onOpenNowChange(!openNow)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
          openNow
            ? 'bg-accent text-on-accent'
            : 'bg-card text-ink border border-line'
        }`}
      >
        <Clock size={16} />
        Aperti / orario n/d
      </button>

      {MOODS.map((mood) => (
        <button
          type="button"
          key={mood.id}
          onClick={() => onToggleMood(mood.id)}
          className={chipClass(selectedMoods.includes(mood.id))}
        >
          {mood.icon}
          {mood.label}
        </button>
      ))}

      {FEATURE_FILTERS.map((f) => (
        <button
          type="button"
          key={f.id}
          onClick={() => onToggleFeature(f.id)}
          className={chipClass(selectedFeatures.includes(f.id))}
        >
          {FEATURE_ICONS[f.id]}
          {f.label}
        </button>
      ))}

      {showPersonal && onHideVisitedChange && (
        <button
          type="button"
          onClick={() => onHideVisitedChange(!hideVisited)}
          className={chipClass(hideVisited)}
        >
          <EyeOff size={16} />
          Nascondi visitati
        </button>
      )}

      {showPersonal && onOnlyToTryChange && (
        <button
          type="button"
          onClick={() => onOnlyToTryChange(!onlyToTry)}
          className={chipClass(onlyToTry)}
        >
          <Heart size={16} />
          Solo da provare
        </button>
      )}
    </div>
  );
}
