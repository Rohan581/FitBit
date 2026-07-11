import { useState } from 'react';
import Sheet from './Sheet';
import { api } from '../api';

export default function WeightSheet({ open, onClose, onLogged, existing }) {
  const [weight, setWeight] = useState(existing?.weight_kg ? String(existing.weight_kg) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const w = parseFloat(weight);
    if (!w || w < 30 || w > 250) return;
    setSaving(true);
    try {
      await api.logWeight({ weight_kg: w });
      onLogged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log Weight">
      <div className="px-5 pb-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-warm-500 block mb-2">Weight (kg)</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeight(w => String(Math.max(30, parseFloat(w || 0) - 0.1).toFixed(1)))}
              className="w-12 h-12 rounded-xl border border-warm-200 text-2xl text-warm-500 bg-white flex items-center justify-center active:bg-warm-100"
            >
              −
            </button>
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 88.4"
              className="flex-1 px-3 py-3 rounded-xl border border-warm-200 text-center text-2xl font-semibold text-warm-800 focus:outline-none focus:border-amber-400 bg-white"
              step="0.1"
              min="30"
              max="250"
            />
            <button
              onClick={() => setWeight(w => String((parseFloat(w || 0) + 0.1).toFixed(1)))}
              className="w-12 h-12 rounded-xl border border-warm-200 text-2xl text-warm-500 bg-white flex items-center justify-center active:bg-warm-100"
            >
              +
            </button>
          </div>
        </div>

        <p className="text-xs text-warm-400 text-center">
          Best logged in the morning, after waking, before eating. Daily fluctuations are normal — the 7-day average is what matters.
        </p>

        <button
          onClick={handleSave}
          disabled={!weight || saving}
          className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-semibold text-sm disabled:opacity-40 active:bg-amber-600 transition-colors"
        >
          {saving ? 'Saving...' : 'Log Weight'}
        </button>
      </div>
    </Sheet>
  );
}
