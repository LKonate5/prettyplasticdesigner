import { JOINT_COLOURS } from '../config';
import { STR } from '../strings';

/**
 * Joint / grout colour: preset swatches plus a custom picker. The chosen colour
 * shows through the gaps between tiles (it's the render background), so it
 * affects every raster/PDF export too.
 */
export function JointColour({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const isPreset = JOINT_COLOURS.some((c) => c.hex.toLowerCase() === value.toLowerCase());
  return (
    <div className="section">
      <h2>{STR.jointColour}</h2>
      <div className="joints">
        {JOINT_COLOURS.map((c) => (
          <button
            key={c.hex}
            className={`joint${c.hex.toLowerCase() === value.toLowerCase() ? ' sel' : ''}`}
            style={{ background: c.hex }}
            title={c.name}
            onClick={() => onChange(c.hex)}
          />
        ))}
        <label
          className={`joint custom${isPreset ? '' : ' sel'}`}
          style={{ background: isPreset ? 'conic-gradient(red,orange,yellow,green,blue,violet,red)' : value }}
          title="Custom colour"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </label>
      </div>
      <p className="note">{STR.jointHint}</p>
    </div>
  );
}
