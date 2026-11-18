const RADIUS_STEPS = [1, 2, 3, 5, 10, 20, 30];

interface RadiusSliderProps {
  value: number;
  onChange: (value: number) => void;
}

function nearestStep(value: number): number {
  let best = RADIUS_STEPS[0];
  let bestDist = Math.abs(value - best);
  for (const step of RADIUS_STEPS) {
    const d = Math.abs(value - step);
    if (d < bestDist) {
      best = step;
      bestDist = d;
    }
  }
  return best;
}

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  const current = nearestStep(value);
  const index = Math.max(0, RADIUS_STEPS.indexOf(current));

  return (
    <div className="space-y-2 px-1 py-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Raggio</span>
        <span className="font-medium text-ink">{current} km</span>
      </div>
      <input
        type="range"
        min={0}
        max={RADIUS_STEPS.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(RADIUS_STEPS[Number(e.target.value)])}
        className="w-full h-2 bg-elev rounded-lg appearance-none cursor-pointer accent-primary"
        aria-valuetext={`${current} chilometri`}
      />
      <div className="flex justify-between text-[10px] text-subtle px-0.5">
        {RADIUS_STEPS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  );
}
