import { useEffect, useState } from 'react';
import type { VenueType } from '../types';
import { resolveMediaPhoto } from '../utils/wikidata';

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
  showLabel = false,
}: {
  type: VenueType;
  className?: string;
  showLabel?: boolean;
}) {
  const label = TYPE_LABELS[type] ?? 'Locale';
  return (
    <div
      className={`flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-elev via-accent-soft to-line ${className ?? ''}`}
    >
      <svg
        viewBox="0 0 64 64"
        className={`text-primary ${
          showLabel ? 'w-14 h-14 mb-2' : 'w-[55%] h-[55%] max-w-14 max-h-14'
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        {type === 'pizzeria' ||
        type === 'ristorante' ||
        type === 'trattoria' ||
        type === 'osteria' ? (
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
      {showLabel && (
        <span className="text-ink text-sm font-semibold tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}

interface VenuePhotoProps {
  src: string;
  type: VenueType;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  /** Called when the photo cannot be shown (category, resolve fail, or load error). */
  onUnavailable?: () => void;
}

function isResolvableMedia(src: string): boolean {
  return src.startsWith('wikidata:') || src.startsWith('wikipedia:');
}

export function VenuePhoto({
  src,
  type,
  alt,
  className,
  loading = 'lazy',
  onUnavailable,
}: VenuePhotoProps) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const needsResolve = isResolvableMedia(src);
  const isCategory = !src || src.startsWith('category:');

  useEffect(() => {
    setFailed(false);
    if (!needsResolve) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    void resolveMediaPhoto(src).then((url) => {
      if (cancelled) return;
      if (!url) {
        setFailed(true);
        onUnavailable?.();
        return;
      }
      setResolved(url);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally omit onUnavailable from deps: callers pass inline setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, needsResolve]);

  if (isCategory || failed || (needsResolve && !resolved)) {
    return (
      <CategoryIllustration type={type} className={className} showLabel={false} />
    );
  }

  const imageSrc = needsResolve ? resolved! : src;

  return (
    <img
      src={imageSrc}
      alt={alt}
      loading={loading}
      className={`object-cover ${className ?? ''}`}
      onError={() => {
        setFailed(true);
        onUnavailable?.();
      }}
    />
  );
}

export function isCategoryPhoto(src: string): boolean {
  return !src || src.startsWith('category:');
}

export function isWikidataPhoto(src: string): boolean {
  return isResolvableMedia(src);
}

export { CategoryIllustration };
