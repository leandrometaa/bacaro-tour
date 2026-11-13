import type { VenueType } from '../types';

const TYPE_LABELS: Record<VenueType, string> = {
  ristorante: 'Ristorante',
  bar: 'Bar',
  pizzeria: 'Pizzeria',
  enoteca: 'Enoteca',
  trattoria: 'Trattoria',
  osteria: 'Osteria',
  cafe: 'Caffè',
  pub: 'Pub',
  gelateria: 'Gelateria',
  altro: 'Locale',
};

function CategoryIllustration({
  type,
  className,
}: {
  type: VenueType;
  className?: string;
}) {
  const label = TYPE_LABELS[type] ?? 'Locale';
  return (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br from-brand-100 via-brand-200 to-brand-300 ${className ?? ''}`}
    >
      <svg
        viewBox="0 0 64 64"
        className="w-14 h-14 text-brand-700 mb-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        {type === 'pizzeria' || type === 'ristorante' || type === 'trattoria' || type === 'osteria' ? (
          <>
            <circle cx="32" cy="32" r="18" />
            <circle cx="24" cy="26" r="2" fill="currentColor" />
            <circle cx="36" cy="28" r="2" fill="currentColor" />
            <circle cx="30" cy="38" r="2" fill="currentColor" />
          </>
        ) : type === 'gelateria' ? (
          <>
            <path d="M32 12 L44 36 H20 Z" />
            <rect x="26" y="36" width="12" height="14" rx="2" />
          </>
        ) : (
          <>
            <path d="M18 40 V20 M18 20 C18 14 26 14 26 20 V40" />
            <path d="M38 18 V40 M44 18 V40 M38 18 C38 12 44 12 44 18" />
            <line x1="14" y1="44" x2="50" y2="44" />
          </>
        )}
      </svg>
      <span className="text-brand-ink text-sm font-semibold tracking-wide">
        {label}
      </span>
    </div>
  );
}

interface VenuePhotoProps {
  src: string;
  type: VenueType;
  alt: string;
  className?: string;
}

export function VenuePhoto({ src, type, alt, className }: VenuePhotoProps) {
  if (!src || src.startsWith('category:') || src.startsWith('wikidata:')) {
    return <CategoryIllustration type={type} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className ?? ''}`}
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent && !parent.querySelector('[data-fallback]')) {
          const fallback = document.createElement('div');
          fallback.dataset.fallback = '1';
          fallback.className = className ?? '';
          parent.appendChild(fallback);
          // React will not re-render; use a simple CSS fallback via sibling
        }
      }}
    />
  );
}

export function isCategoryPhoto(src: string): boolean {
  return !src || src.startsWith('category:') || src.startsWith('wikidata:');
}

export { CategoryIllustration };
