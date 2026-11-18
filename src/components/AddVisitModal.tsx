import { Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useModalDismiss } from '../hooks/useModalDismiss';
import type { Venue, Visit } from '../types';
import { localDateString } from '../utils/ids';

interface AddVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  venue: Venue;
  /** When set, modal edits this visit instead of creating a new one */
  initialVisit?: Visit | null;
  onAddVisit?: (visit: Omit<Visit, 'id'>, venue: Venue) => void;
  onUpdateVisit?: (
    visitId: string,
    patch: Partial<Omit<Visit, 'id' | 'venueId'>>
  ) => void;
  storageError?: string | null;
}

const QUICK_TAGS = [
  'Ottimo servizio',
  'Ambiente curato',
  'Buon rapporto qualità/prezzo',
  'Porzioni abbondanti',
  'Attesa lunga',
  'Musica piacevole',
  'Cicchetti',
  'Spritz',
  'Vino al calice',
];

export function AddVisitModal({
  isOpen,
  onClose,
  venue,
  initialVisit,
  onAddVisit,
  onUpdateVisit,
  storageError,
}: AddVisitModalProps) {
  const editing = Boolean(initialVisit);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDateString());
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  useModalDismiss(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    if (initialVisit) {
      setRating(initialVisit.rating);
      setSelectedTags(initialVisit.tags);
      setNote(initialVisit.note);
      setDate(initialVisit.date);
      setPhotoDataUrl(initialVisit.photoDataUrl);
    } else {
      setRating(4);
      setSelectedTags([]);
      setNote('');
      setDate(localDateString());
      setPhotoDataUrl(undefined);
    }
  }, [isOpen, initialVisit]);

  const onPickPhoto = (file: File | null) => {
    if (!file) {
      setPhotoDataUrl(undefined);
      return;
    }
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      // Keep storage light: reject huge data URLs (~200KB).
      if (raw.length > 280_000) {
        setPhotoDataUrl(undefined);
        return;
      }
      setPhotoDataUrl(raw);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else if (selectedTags.length < 5) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = () => {
    try {
      if (editing && initialVisit && onUpdateVisit) {
        onUpdateVisit(initialVisit.id, {
          date,
          rating,
          tags: selectedTags,
          note: note.trim(),
          photoDataUrl,
        });
      } else if (onAddVisit) {
        onAddVisit(
          {
            venueId: venue.id,
            date,
            rating,
            tags: selectedTags,
            note: note.trim(),
            photoDataUrl,
          },
          venue
        );
      }
      onClose();
    } catch {
      // storageError shown via prop
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-slide-up pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between p-4 border-b border-line shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {editing ? 'Modifica visita' : 'Ci sono stato'}
            </h2>
            <p className="text-sm text-subtle">{venue.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-subtle hover:text-muted"
          >
            <X size={24} />
          </button>
        </div>

        {storageError && (
          <p className="mx-4 mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 shrink-0">
            {storageError}
          </p>
        )}

        <div className="p-4 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Data della visita
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-app border border-line rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
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
                        ? 'text-accent fill-accent'
                        : 'text-line'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Tag (max 5)
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  disabled={
                    selectedTags.length >= 5 && !selectedTags.includes(tag)
                  }
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-primary text-on-primary'
                      : 'bg-elev text-muted hover:bg-line disabled:opacity-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Foto personale (opzionale)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-elev file:text-ink"
            />
            {photoDataUrl && (
              <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-line">
                <img
                  src={photoDataUrl}
                  alt="Anteprima visita"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(undefined)}
                  className="absolute top-1 right-1 p-0.5 rounded bg-black/50 text-white"
                  aria-label="Rimuovi foto"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <p className="text-xs text-subtle mt-1">
              Resta sul tuo dispositivo (dimensione limitata).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Note (opzionale)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Aggiungi un commento..."
              rows={3}
              maxLength={200}
              className="w-full px-3 py-2 bg-app border border-line rounded-xl text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-subtle text-right mt-1">
              {note.length}/200
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-line shrink-0 sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-3 bg-accent text-on-accent font-medium rounded-xl hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-primary"
          >
            {editing ? 'Salva modifiche' : 'Salva visita'}
          </button>
        </div>
      </div>
    </div>
  );
}
