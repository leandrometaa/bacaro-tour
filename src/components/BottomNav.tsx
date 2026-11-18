import { Heart, List, MapPin } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1 px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary rounded-lg ${
    isActive ? 'text-accent-text' : 'text-subtle'
  }`;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-line z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <NavLink to="/" end className={linkClass}>
          <MapPin size={24} />
          <span className="text-xs font-medium">Mappa</span>
        </NavLink>

        <NavLink to="/lista" className={linkClass}>
          <List size={24} />
          <span className="text-xs font-medium">Lista</span>
        </NavLink>

        <NavLink to="/i-miei-posti" className={linkClass}>
          <Heart size={24} />
          <span className="text-xs font-medium">I miei posti</span>
        </NavLink>
      </div>
    </nav>
  );
}
