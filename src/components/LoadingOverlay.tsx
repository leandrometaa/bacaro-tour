import { Loader2, RefreshCw } from 'lucide-react';

interface LoadingOverlayProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export function LoadingOverlay({
  loading,
  error,
  onRetry,
}: LoadingOverlayProps) {
  if (!loading && !error) return null;

  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-surface-200 px-4 py-3 max-w-sm w-full">
        {loading && (
          <div className="flex items-center gap-3 text-surface-700">
            <Loader2 size={20} className="animate-spin text-brand-600" />
            <span className="text-sm">Caricamento locali da OpenStreetMap…</span>
          </div>
        )}
        {error && !loading && (
          <div className="space-y-2">
            <p className="text-sm text-surface-700">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <RefreshCw size={16} />
                Riprova
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
