import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { VenueType } from '../types';
import { resolveMediaPhoto } from '../utils/wikidata';
import { CategoryIllustration, isCategoryPhoto } from './VenuePhoto';

interface VenuePhotoCarouselProps {
  photos: string[];
  type: VenueType;
  alt: string;
  onShare?: () => void;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
}

export function VenuePhotoCarousel({
  photos,
  type,
  alt,
  topLeft,
  topRight,
}: VenuePhotoCarouselProps) {
  const raw = useMemo(
    () => (photos.length ? photos : [`category:${type}`]),
    [photos, type]
  );
  const [resolved, setResolved] = useState<(string | null)[]>([]);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(new Set());
    setIndex(0);
    void Promise.all(
      raw.map(async (src) => {
        if (isCategoryPhoto(src)) return src;
        if (src.startsWith('wikidata:') || src.startsWith('wikipedia:')) {
          return resolveMediaPhoto(src);
        }
        return src;
      })
    ).then((urls) => {
      if (!cancelled) setResolved(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  const slides = useMemo(() => {
    if (!resolved.length) return [] as { src: string; isCategory: boolean }[];
    const out: { src: string; isCategory: boolean }[] = [];
    resolved.forEach((url, i) => {
      if (failed.has(i)) return;
      if (!url) return;
      if (isCategoryPhoto(url)) {
        // Keep a single category fallback only if nothing else worked
        return;
      }
      out.push({ src: url, isCategory: false });
    });
    if (out.length === 0) {
      out.push({ src: `category:${type}`, isCategory: true });
    }
    return out;
  }, [resolved, failed, type]);

  const safeIndex = Math.min(index, Math.max(0, slides.length - 1));
  const current = slides[safeIndex];
  const onlyCategory = slides.length === 1 && Boolean(current?.isCategory);
  const heroHeight = onlyCategory ? 'h-36' : 'h-64';

  const next = useCallback(() => {
    setIndex((i) => (slides.length ? (i + 1) % slides.length : 0));
  }, [slides.length]);

  const prev = useCallback(() => {
    setIndex((i) =>
      slides.length ? (i === 0 ? slides.length - 1 : i - 1) : 0
    );
  }, [slides.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) next();
    else prev();
  };

  return (
    <div
      className={`relative ${heroHeight} bg-elev select-none touch-pan-y`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {current?.isCategory ? (
        <CategoryIllustration type={type} className="w-full h-full" showLabel />
      ) : current ? (
        <img
          src={current.src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => {
            const rawIdx = resolved.findIndex((u) => u === current.src);
            if (rawIdx >= 0) {
              setFailed((prev) => new Set(prev).add(rawIdx));
            }
          }}
        />
      ) : (
        <CategoryIllustration type={type} className="w-full h-full" showLabel />
      )}

      {topLeft}
      {topRight}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 shadow"
            aria-label="Foto precedente"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 shadow"
            aria-label="Foto successiva"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === safeIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
