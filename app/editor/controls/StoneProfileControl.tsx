/**
 * Reusable stone size selector control
 */

import type { StoneSizeId } from '@/src/lib/rhinestone-engine/index';
import { editorFieldLabelClassName, editorSelectClassName } from './controlStyles';

interface StoneProfileControlProps {
  value: StoneSizeId;
  onChange: (size: StoneSizeId) => void;
  label?: string;
}

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20'];

export default function StoneProfileControl({ 
  value, 
  onChange, 
  label = 'Stone Size' 
}: StoneProfileControlProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={editorFieldLabelClassName}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StoneSizeId)}
        className={editorSelectClassName}
      >
        {STONE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
