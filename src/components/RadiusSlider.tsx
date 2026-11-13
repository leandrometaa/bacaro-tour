interface RadiusSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-surface-200">
      <span className="text-sm text-surface-500 whitespace-nowrap">Raggio:</span>
      <input
        type="range"
        min={1}
        max={30}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-surface-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
      />
      <span className="text-sm font-medium text-brand-ink w-12 text-right">
        {value} km
      </span>
    </div>
  );
}
