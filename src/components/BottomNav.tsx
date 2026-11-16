import { Heart, List, MapPin } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              isActive ? 'text-brand-600' : 'text-surface-500'
            }`
          }
        >
          <MapPin size={24} />
          <span className="text-xs font-medium">Mappa</span>
        </NavLink>

        <NavLink
          to="/lista"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              isActive ? 'text-brand-600' : 'text-surface-500'
            }`
          }
        >
          <List size={24} />
          <span className="text-xs font-medium">Lista</span>
        </NavLink>

        <NavLink
          to="/i-miei-posti"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              isActive ? 'text-brand-600' : 'text-surface-500'
            }`
          }
        >
          <Heart size={24} />
          <span className="text-xs font-medium">I miei posti</span>
        </NavLink>
      </div>
    </nav>
  );
}
