import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { SavedList } from '../types';

interface SaveToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: SavedList[];
  venueId: string;
  onSaveToList: (listId: string, venueId: string) => void;
  onRemoveFromList: (listId: string, venueId: string) => void;
  onCreateList: (name: string) => SavedList;
  isInList: (listId: string, venueId: string) => boolean;
}

export function SaveToListModal({
  isOpen,
  onClose,
  lists,
  venueId,
  onSaveToList,
  onRemoveFromList,
  onCreateList,
  isInList,
}: SaveToListModalProps) {
  const [newListName, setNewListName] = useState('');
  const [showNewListInput, setShowNewListInput] = useState(false);

  if (!isOpen) return null;

  const handleCreateList = () => {
    if (newListName.trim()) {
      const newList = onCreateList(newListName.trim());
      onSaveToList(newList.id, venueId);
      setNewListName('');
      setShowNewListInput(false);
    }
  };

  const handleToggleList = (listId: string) => {
    if (isInList(listId, venueId)) {
      onRemoveFromList(listId, venueId);
    } else {
      onSaveToList(listId, venueId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <h2 className="text-lg font-semibold text-brand-ink">
            Salva in una lista
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-surface-400 hover:text-surface-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
          {lists.map((list) => {
            const inList = isInList(list.id, venueId);
            return (
              <button
                type="button"
                key={list.id}
                onClick={() => handleToggleList(list.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  inList
                    ? 'bg-brand-50 border-brand-200'
                    : 'bg-white border-surface-200 hover:bg-surface-50'
                }`}
              >
                <span className="font-medium text-brand-ink">{list.name}</span>
                {inList && <Check size={20} className="text-brand-600" />}
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
                className="flex-1 px-3 py-2 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCreateList}
                disabled={!newListName.trim()}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl font-medium disabled:opacity-50"
              >
                Crea
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewListInput(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-surface-300 text-surface-500 hover:bg-surface-50 transition-colors"
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
