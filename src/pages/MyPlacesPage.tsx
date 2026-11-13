import { Calendar, ChevronRight, Heart, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { VenuePhoto } from '../components/VenuePhoto';
import { getVenueById } from '../data/venues';
import { useUserData } from '../hooks/useUserData';
import type { SavedList, Visit } from '../types';
import { localiCount } from '../utils/i18n';

type Tab = 'liste' | 'diario';

export function MyPlacesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('liste');
  const { data, deleteList, deleteVisit } = useUserData();

  return (
    <div className="flex flex-col h-full bg-surface-50 pb-16">
      <div className="bg-white border-b border-surface-200">
        <div className="p-4">
          <h1 className="text-xl font-bold text-brand-ink">I miei posti</h1>
        </div>

        <div className="flex border-b border-surface-200">
          <button
            type="button"
            onClick={() => setActiveTab('liste')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'liste'
                ? 'text-brand-600 border-b-2 border-brand-600'
                : 'text-surface-500'
            }`}
          >
            Liste salvate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diario')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'diario'
                ? 'text-brand-600 border-b-2 border-brand-600'
                : 'text-surface-500'
            }`}
          >
            Diario visite
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'liste' ? (
          <ListsTab lists={data.lists} onDeleteList={deleteList} />
        ) : (
          <DiaryTab visits={data.visits} onDeleteVisit={deleteVisit} />
        )}
      </div>
    </div>
  );
}

function ListsTab({
  lists,
  onDeleteList,
}: {
  lists: SavedList[];
  onDeleteList: (listId: string) => void;
}) {
  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mb-4">
          <Heart size={32} className="text-surface-400" />
        </div>
        <p className="text-surface-500 text-lg mb-2">Nessuna lista</p>
        <p className="text-surface-400 text-sm">
          Salva i tuoi locali preferiti per trovarli facilmente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lists.map((list) => {
        const previewVenues = list.venueIds
          .slice(0, 3)
          .map((id) => getVenueById(id))
          .filter(Boolean);

        return (
          <div
            key={list.id}
            className="bg-white rounded-xl border border-surface-200 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-brand-ink">{list.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-surface-500">
                    {localiCount(list.venueIds.length)}
                  </span>
                  {list.id !== 'da-provare' && list.id !== 'preferiti' && (
                    <button
                      type="button"
                      onClick={() => onDeleteList(list.id)}
                      className="p-1 text-surface-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {previewVenues.length > 0 ? (
                <div className="space-y-2">
                  {previewVenues.map(
                    (venue) =>
                      venue && (
                        <Link
                          key={venue.id}
                          to={`/locale/${venue.id}`}
                          className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-brand-50"
                        >
                          <VenuePhoto
                            src={venue.photos[0]}
                            type={venue.type}
                            alt={venue.name}
                            className="w-12 h-12 rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-brand-ink truncate">
                              {venue.name}
                            </p>
                            <p className="text-sm text-surface-500 truncate">
                              {venue.city || venue.address}
                            </p>
                          </div>
                          <ChevronRight size={20} className="text-surface-400" />
                        </Link>
                      )
                  )}
                  {list.venueIds.length > 3 && (
                    <p className="text-sm text-brand-600 font-medium">
                      + altri {list.venueIds.length - 3}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-surface-400">Lista vuota</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiaryTab({
  visits,
  onDeleteVisit,
}: {
  visits: Visit[];
  onDeleteVisit: (visitId: string) => void;
}) {
  if (visits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mb-4">
          <Calendar size={32} className="text-surface-400" />
        </div>
        <p className="text-surface-500 text-lg mb-2">Nessuna visita</p>
        <p className="text-surface-400 text-sm">
          Tieni traccia dei locali che visiti
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visits.map((visit) => {
        const venue = getVenueById(visit.venueId);
        if (!venue) return null;

        return (
          <div
            key={visit.id}
            className="bg-white rounded-xl border border-surface-200 overflow-hidden"
          >
            <Link to={`/locale/${venue.id}`} className="flex gap-3 p-4">
              <VenuePhoto
                src={venue.photos[0]}
                type={venue.type}
                alt={venue.name}
                className="w-20 h-20 rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-brand-ink truncate">
                      {venue.name}
                    </h3>
                    <p className="text-sm text-surface-500">
                      {venue.city || venue.address}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteVisit(visit.id);
                    }}
                    className="p-1 text-surface-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={
                          star <= visit.rating
                            ? 'text-brand-400 fill-brand-400'
                            : 'text-surface-300'
                        }
                      />
                    ))}
                  </div>
                  <span className="text-xs text-surface-400">•</span>
                  <span className="text-xs text-surface-500">
                    {new Date(visit.date).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {visit.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {visit.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-surface-100 text-surface-600 px-2 py-0.5 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {visit.note && (
                  <p className="text-sm text-surface-600 mt-2 line-clamp-2">
                    {visit.note}
                  </p>
                )}
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
