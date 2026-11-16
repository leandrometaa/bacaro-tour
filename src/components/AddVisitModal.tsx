import { Star, X } from 'lucide-react';
import { useState } from 'react';
import type { Visit } from '../types';

interface AddVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  venueName: string;
  onAddVisit: (visit: Omit<Visit, 'id'>) => void;
}

const QUICK_TAGS = [
  'Ottimo servizio',
  'Ambiente curato',
  'Buon rapporto qualità/prezzo',
  'Porzioni abbondanti',
  'Attesa lunga',
  'Musica piacevole',
];

export function AddVisitModal({
  isOpen,
  onClose,
  venueId,
  venueName,
  onAddVisit,
}: AddVisitModalProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else if (selectedTags.length < 3) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = () => {
    onAddVisit({
      venueId,
      date,
      rating,
      tags: selectedTags,
      note: note.trim(),
    });
    onClose();
    setRating(4);
    setSelectedTags([]);
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <div>
            <h2 className="text-lg font-semibold text-brand-ink">
              Ci sono stato
            </h2>
            <p className="text-sm text-surface-500">{venueName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-surface-400 hover:text-surface-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto max-h-[65vh]">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">
              Data della visita
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">
              Voto
            </label>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setRating(value)}
                  className="p-2"
                >
                  <Star
                    size={32}
                    className={`transition-colors ${
                      value <= rating
                        ? 'text-brand-400 fill-brand-400'
                        : 'text-surface-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">
              Tag veloci (max 3)
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  disabled={
                    selectedTags.length >= 3 && !selectedTags.includes(tag)
                  }
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-100 text-surface-700 hover:bg-surface-200 disabled:opacity-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">
              Note (opzionale)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Aggiungi un commento..."
              rows={3}
              maxLength={200}
              className="w-full px-3 py-2 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
            <p className="text-xs text-surface-400 text-right mt-1">
              {note.length}/200
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-surface-200">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors"
          >
            Salva visita
          </button>
        </div>
      </div>
    </div>
  );
}
