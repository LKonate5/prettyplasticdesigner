import { useState } from 'react';

/**
 * A number input you can actually edit. It keeps a local text draft while you
 * type, so you can clear the field and retype without it snapping back to a
 * value mid-edit. It commits (clamped to min/max) only on blur or Enter — the
 * bug where deleting the number jammed the field is gone.
 */
export function DraftNumberInput({
  value,
  min,
  max,
  onCommit,
  id,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
  id?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
    setDraft(null); // revert display to the committed (possibly snapped) value
  };

  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
