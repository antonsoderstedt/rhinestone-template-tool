/**
 * Reusable stone size selector control
 */

import type { StoneSizeId } from '@/src/lib/rhinestone-engine/index';

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
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StoneSizeId)}
        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
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
