import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ToastProps {
  message: string | null;
  onDone: () => void;
  durationMs?: number;
}

export function Toast({ message, onDone, durationMs = 2200 }: ToastProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => onDoneRef.current(), durationMs);
    return () => window.clearTimeout(t);
  }, [message, durationMs]);

  if (!message) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink text-on-primary text-sm font-medium shadow-lg animate-slide-up">
        <Check size={16} className="text-accent" />
        {message}
      </div>
    </div>
  );
}
