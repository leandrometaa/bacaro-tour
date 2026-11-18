import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  illustration?: 'glass' | 'map' | 'heart' | 'search';
  action?: ReactNode;
}

function Illustration({ kind }: { kind: NonNullable<EmptyStateProps['illustration']> }) {
  const common = 'w-20 h-20 text-accent-text';
  if (kind === 'glass') {
    return (
      <svg viewBox="0 0 64 64" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M20 12h24l-4 28a8 8 0 01-16 0L20 12z" />
        <path d="M24 20h16" />
        <path d="M32 40v10" />
        <path d="M24 54h16" />
      </svg>
    );
  }
  if (kind === 'map') {
    return (
      <svg viewBox="0 0 64 64" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 16l16-6 16 6 8-4v38l-8 4-16-6-16 6V16z" />
        <circle cx="28" cy="28" r="6" />
        <path d="M28 34v8" />
      </svg>
    );
  }
  if (kind === 'heart') {
    return (
      <svg viewBox="0 0 64 64" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M32 52S12 40 12 26a10 10 0 0118-6 10 10 0 0118 6c0 14-20 26-20 26z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="28" cy="28" r="14" />
      <path d="M40 40l12 12" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  illustration = 'glass',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-28 h-28 rounded-full bg-accent-soft flex items-center justify-center mb-4">
        <Illustration kind={illustration} />
      </div>
      <p className="font-display text-xl text-ink mb-2">{title}</p>
      <p className="text-muted text-sm max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
