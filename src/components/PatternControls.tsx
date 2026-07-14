import { useState } from 'react';
import type { MaterialId, PatternConfig, PatternType } from '../core/types';
import { codeToSeed, randomSeed, seedToCode } from '../core/pattern/prng';
import { MATERIALS } from '../data/palette';
import { PRESETS } from '../data/presets';
import { STR } from '../strings';

const TYPE_LABELS: Record<PatternType, string> = {
  solid: STR.patternSolid,
  random: STR.patternRandom,
  gradient: STR.patternGradient,
  stripes: STR.patternStripes,
  checker: STR.patternChecker,
};

/**
 * Pattern generator controls: type, per-type options, tone-variation slider,
 * and the seed field + shuffle.
 */
export function PatternControls({
  pattern,
  onPattern,
  onReroll,
}: {
  pattern: PatternConfig;
  onPattern: (next: Partial<PatternConfig>) => void;
  onReroll: () => void;
}) {
  const allowedList = MATERIALS.filter((m) => pattern.allowedMaterials.includes(m.id));
  // Local text state for the friendly variation code, so typing doesn't fight
  // the derived value; commit to a seed on blur/Enter.
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const codeValue = codeDraft ?? seedToCode(pattern.seed);
  const commitCode = () => {
    if (codeDraft === null) return;
    const seed = codeToSeed(codeDraft);
    if (seed !== null) onPattern({ seed });
    setCodeDraft(null);
  };
  return (
    <div className="section">
      <h2>{STR.preset}</h2>
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className="preset"
            title={p.name}
            onClick={() => onPattern({ ...p.config, seed: randomSeed() })}
          >
            <span className="preset-chips">
              {p.swatch.map((id) => (
                <span
                  key={id}
                  className="preset-chip"
                  style={{ background: MATERIALS.find((m) => m.id === id)?.hex }}
                />
              ))}
            </span>
            {p.name}
          </button>
        ))}
      </div>

      <h2 style={{ marginTop: 16 }}>{STR.pattern}</h2>

      <div className="field">
        <select
          value={pattern.type}
          onChange={(e) => onPattern({ type: e.target.value as PatternType })}
        >
          {(Object.keys(TYPE_LABELS) as PatternType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {pattern.type === 'solid' && (
        <div className="field">
          <label>{STR.baseColour}</label>
          <select
            value={pattern.solidMaterial}
            onChange={(e) => onPattern({ solidMaterial: e.target.value as MaterialId })}
          >
            {(allowedList.length ? allowedList : MATERIALS).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {pattern.type === 'gradient' && (
        <div className="field">
          <label>{STR.direction}</label>
          <select
            value={pattern.gradient.direction}
            onChange={(e) =>
              onPattern({
                gradient: { direction: e.target.value as PatternConfig['gradient']['direction'] },
              })
            }
          >
            <option value="horizontal">{STR.horizontal}</option>
            <option value="vertical">{STR.vertical}</option>
            <option value="diagonal">{STR.diagonal}</option>
          </select>
        </div>
      )}

      {pattern.type === 'stripes' && (
        <>
          <div className="field">
            <label>{STR.direction}</label>
            <select
              value={pattern.stripes.direction}
              onChange={(e) =>
                onPattern({
                  stripes: {
                    ...pattern.stripes,
                    direction: e.target.value as 'horizontal' | 'vertical',
                  },
                })
              }
            >
              <option value="horizontal">{STR.horizontal}</option>
              <option value="vertical">{STR.vertical}</option>
            </select>
          </div>
          <div className="field">
            <label>
              {STR.stripeWidth}: {pattern.stripes.width}
            </label>
            <input
              type="range"
              min={1}
              max={8}
              value={pattern.stripes.width}
              onChange={(e) =>
                onPattern({ stripes: { ...pattern.stripes, width: Number(e.target.value) } })
              }
            />
          </div>
        </>
      )}

      <div className="field">
        <label>
          {STR.toneVariation}: {Math.round(pattern.toneVariation * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={pattern.toneVariation}
          onChange={(e) => onPattern({ toneVariation: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <button className="btn primary" style={{ width: '100%' }} onClick={onReroll}>
          ⟳ {STR.reroll}
        </button>
        <div className="row" style={{ marginTop: 8, alignItems: 'baseline' }}>
          <label htmlFor="seed" style={{ flex: 'none', color: 'var(--pp-muted)', fontSize: 12 }}>
            {STR.variation}
          </label>
          <input
            id="seed"
            type="text"
            spellCheck={false}
            value={codeValue}
            onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
            onBlur={commitCode}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <p className="note">{STR.variationHint}</p>
      </div>
    </div>
  );
}
