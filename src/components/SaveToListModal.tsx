import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useModalDismiss } from '../hooks/useModalDismiss';
import type { SavedList, Venue } from '../types';

interface SaveToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: SavedList[];
  venue: Venue;
  onSaveToList: (listId: string, venue: Venue) => void;
  onRemoveFromList: (listId: string, venueId: string) => void;
  onCreateList: (name: string) => SavedList;
  isInList: (listId: string, venueId: string) => boolean;
  storageError?: string | null;
}

export function SaveToListModal({
  isOpen,
  onClose,
  lists,
  venue,
  onSaveToList,
  onRemoveFromList,
  onCreateList,
  isInList,
  storageError,
}: SaveToListModalProps) {
  const [newListName, setNewListName] = useState('');
  const [showNewListInput, setShowNewListInput] = useState(false);
  useModalDismiss(isOpen, onClose);

  if (!isOpen) return null;

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    try {
      const newList = onCreateList(newListName.trim());
      onSaveToList(newList.id, venue);
      setNewListName('');
      setShowNewListInput(false);
    } catch {
      // storageError shown via prop
    }
  };

  const handleToggleList = (listId: string) => {
    try {
      if (isInList(listId, venue.id)) {
        onRemoveFromList(listId, venue.id);
      } else {
        onSaveToList(listId, venue);
      }
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
      <div className="relative bg-card rounded-t-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden animate-slide-up pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between p-4 border-b border-line shrink-0">
          <h2 className="text-lg font-semibold text-ink">
            Salva in una lista
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-subtle hover:text-muted"
          >
            <X size={24} />
          </button>
        </div>

        {storageError && (
          <p className="mx-4 mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {storageError}
          </p>
        )}

        <div className="p-4 space-y-2 overflow-y-auto flex-1 min-h-0">
          {lists.map((list) => {
            const inList = isInList(list.id, venue.id);
            return (
              <button
                type="button"
                key={list.id}
                onClick={() => handleToggleList(list.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  inList
                    ? 'bg-elev border-primary'
                    : 'bg-card border-line hover:bg-app'
                }`}
              >
                <span className="font-medium text-ink">{list.name}</span>
                {inList && <Check size={20} className="text-primary" />}
              </button>
            );
          })}

          {showNewListInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nome della lista..."
                className="flex-1 px-3 py-2 bg-app border border-line rounded-xl text-ink placeholder-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl font-medium disabled:opacity-50"
              >
                Crea
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewListInput(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-line text-subtle hover:bg-app transition-colors"
            >
              <Plus size={20} />
              Nuova lista
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
