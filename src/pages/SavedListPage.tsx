import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { VenueCard } from '../components/VenueCard';
import { getVenueById } from '../data/venues';
import { useUserData } from '../hooks/useUserData';
import type { Venue } from '../types';
import { localiCount } from '../utils/i18n';

export function SavedListPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { data, removeFromList, renameList, deleteList, isInAnyList } =
    useUserData();
  const list = data.lists.find((l) => l.id === listId);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(list?.name ?? '');

  const venues = useMemo(() => {
    if (!list) return [];
    return list.venueIds
      .map((id) => getVenueById(id))
      .filter((v): v is Venue => Boolean(v));
  }, [list, data.venuesById]);

  if (!list) {
    return (
      <div className="flex flex-col h-full pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <EmptyState
          title="Lista non trovata"
          description="Potrebbe essere stata eliminata."
          illustration="heart"
          action={
            <Link to="/i-miei-posti" className="text-primary font-medium">
              Torna ai miei posti
            </Link>
          }
        />
      </div>
    );
  }

  const canRename = true;
  const canDelete = list.id !== 'da-provare' && list.id !== 'preferiti';

  const saveRename = () => {
    const next = nameDraft.trim();
    if (next && next !== list.name) renameList(list.id, next);
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full bg-app pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-10 bg-card border-b border-line px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/i-miei-posti')}
            className="p-2 -ml-2 rounded-lg text-muted hover:bg-elev"
            aria-label="Indietro"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename();
                  if (e.key === 'Escape') {
                    setNameDraft(list.name);
                    setEditingName(false);
                  }
                }}
                autoFocus
                className="w-full font-display text-xl text-ink bg-app border border-line rounded-lg px-2 py-1"
              />
            ) : (
              <h1 className="font-display text-xl text-ink truncate">
                {list.name}
              </h1>
            )}
            <p className="text-sm text-muted">
              {localiCount(list.venueIds.length)}
            </p>
          </div>
          {canRename && !editingName && (
            <button
              type="button"
              onClick={() => {
                setNameDraft(list.name);
                setEditingName(true);
              }}
              className="p-2 text-subtle hover:text-primary"
              aria-label="Rinomina lista"
            >
              <Pencil size={18} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Eliminare la lista “${list.name}”? Non si può annullare.`
                  )
                ) {
                  deleteList(list.id);
                  navigate('/i-miei-posti');
                }
              }}
              className="p-2 text-subtle hover:text-red-500"
              aria-label="Elimina lista"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {venues.length === 0 ? (
          <EmptyState
            title="Lista vuota"
            description="Salva locali dalle schede per ritrovarli qui."
            illustration="heart"
          />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-0 bg-card rounded-xl border border-line px-3">
              {venues.map((venue) => (
                <div key={venue.id} className="relative">
                  <VenueCard
                    venue={venue}
                    isSaved={isInAnyList(venue.id)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Rimuovere “${venue.name}” da questa lista?`
                        )
                      ) {
                        removeFromList(list.id, venue.id);
                      }
                    }}
                    className="absolute top-2 right-16 z-10 px-2 py-1 rounded-lg bg-card/95 border border-line text-xs font-medium text-red-600 shadow-sm"
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
            {list.venueIds.length > venues.length && (
              <p className="text-sm text-muted text-center py-2">
                {list.venueIds.length - venues.length} locali senza snapshot
                locale (apri il link condiviso o riesegui una ricerca).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
