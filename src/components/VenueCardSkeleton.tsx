export function VenueCardSkeleton() {
  return (
    <div className="flex gap-3 items-start py-3.5 border-b border-line animate-pulse">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 bg-elev rounded w-2/3" />
          <div className="h-4 w-12 bg-elev rounded-full" />
        </div>
        <div className="h-3 bg-elev rounded w-1/3" />
        <div className="h-3 bg-elev rounded w-1/2" />
      </div>
      <div className="shrink-0 flex flex-col items-center gap-1 w-12 pt-1">
        <div className="w-5 h-5 bg-elev rounded" />
        <div className="h-2 w-8 bg-elev rounded" />
      </div>
    </div>
  );
}
