import { useState } from 'react';
import Sheet from './Sheet';
import { api } from '../api';

const QUALITIES = [
  { id: 'poor', label: 'Poor', emoji: '😴' },
  { id: 'ok', label: 'OK', emoji: '😊' },
  { id: 'good', label: 'Good', emoji: '✨' },
];

export default function SleepSheet({ open, onClose, onLogged, existing }) {
  const [hours, setHours] = useState(existing?.hours ? String(existing.hours) : '');
  const [quality, setQuality] = useState(existing?.quality || 'ok');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const h = parseFloat(hours);
    if (!h || h < 1 || h > 16) return;
    setSaving(true);
    try {
      await api.logSleep({ hours: h, quality });
      onLogged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const PRESETS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

  return (
    <Sheet open={open} onClose={onClose} title="Log Sleep">
      <div className="px-5 pb-6 space-y-5">
        {/* Hours */}
        <div>
          <label className="text-xs font-medium text-warm-500 block mb-2">Hours slept</label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {PRESETS.map(h => (
              <button
                key={h}
                onClick={() => setHours(String(h))}
                className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                  hours === String(h)
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-warm-200 bg-white text-warm-600'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
          <input
            type="number"
            value={hours}
            onChange={e => setHours(e.target.value)}
            placeholder="Or type hours (e.g. 7.5)"
            className="w-full px-3 py-2.5 rounded-xl border border-warm-200 text-sm text-warm-800 focus:outline-none focus:border-amber-400 bg-white"
            step="0.5"
            min="1"
            max="16"
          />
        </div>

        {/* Quality */}
        <div>
          <p className="text-xs font-medium text-warm-500 mb-2">Quality</p>
          <div className="flex gap-2">
            {QUALITIES.map(q => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                  quality === q.id
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-warm-200 bg-white text-warm-600'
                }`}
              >
                <span className="text-xl">{q.emoji}</span>
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ideal range hint */}
        <p className="text-xs text-warm-400 text-center">7–8.5 hours earns full points. Good job either way.</p>

        <button
          onClick={handleSave}
          disabled={!hours || saving}
          className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-semibold text-sm disabled:opacity-40 active:bg-amber-600 transition-colors"
        >
          {saving ? 'Saving...' : 'Log Sleep'}
        </button>
      </div>
    </Sheet>
  );
}
