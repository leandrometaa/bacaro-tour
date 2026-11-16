import { Clock, Coffee, Pizza, Utensils, Wine } from 'lucide-react';
import type { Mood } from '../types';

interface FilterChipsProps {
  openNow: boolean;
  onOpenNowChange: (value: boolean) => void;
  selectedMood: Mood | null;
  onMoodChange: (mood: Mood | null) => void;
}

const MOODS: { id: Mood; label: string; icon: React.ReactNode }[] = [
  { id: 'aperitivo', label: 'Aperitivo', icon: <Coffee size={16} /> },
  { id: 'vino-tagliere', label: 'Vino e tagliere', icon: <Wine size={16} /> },
  { id: 'pizza', label: 'Pizza', icon: <Pizza size={16} /> },
  { id: 'cena', label: 'Cena', icon: <Utensils size={16} /> },
];

export function FilterChips({
  openNow,
  onOpenNowChange,
  selectedMood,
  onMoodChange,
}: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-1">
      <button
        type="button"
        onClick={() => onOpenNowChange(!openNow)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          openNow
            ? 'bg-open text-white'
            : 'bg-white text-surface-700 border border-surface-300'
        }`}
      >
        <Clock size={16} />
        Aperto adesso
      </button>

      {MOODS.map((mood) => (
        <button
          type="button"
          key={mood.id}
          onClick={() =>
            onMoodChange(selectedMood === mood.id ? null : mood.id)
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedMood === mood.id
              ? 'bg-brand-600 text-white'
              : 'bg-white text-surface-700 border border-surface-300'
          }`}
        >
          {mood.icon}
          {mood.label}
        </button>
      ))}
    </div>
  );
}
