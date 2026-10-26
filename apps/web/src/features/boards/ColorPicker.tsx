import { m } from '../../i18n/messages';
import { boardBackground, isHexColor, PALETTE } from './boardColors';

interface ColorPickerProps {
  value: string;
  onChange(color: string): void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const custom = isHexColor(value) ? value : '#4f7cff';
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="swatches" role="radiogroup" aria-label={m.boards.boardColor}>
        {PALETTE.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            aria-label={m.superpowers.paletteNames[key]}
            title={m.superpowers.paletteNames[key]}
            className="swatch"
            style={{ background: boardBackground(key) }}
            onClick={() => onChange(key)}
          />
        ))}
      </div>
      <label className="color-custom">
        <input
          type="color"
          value={custom}
          aria-label={m.boards.customColor}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="field-hint">{m.boards.customColor}</span>
      </label>
    </div>
  );
}
