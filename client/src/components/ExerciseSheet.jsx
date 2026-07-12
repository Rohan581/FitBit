import { useState } from 'react';
import Sheet from './Sheet';
import { api } from '../api';

const EXERCISE_TYPES = [
  { id: 'gym', label: 'Gym / weights' },
  { id: 'running', label: 'Running' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'walking', label: 'Walking' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'other', label: 'Other' },
];

const INTENSITIES = [
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'intense', label: 'Intense' },
];

export default function ExerciseSheet({ open, onClose, onLogged }) {
  const [type, setType] = useState('gym');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('moderate');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!duration || parseInt(duration) < 1) return;
    setSaving(true);
    try {
      await api.logExercise({ type, duration_min: parseInt(duration), intensity });
      onLogged?.();
      onClose();
      setDuration('');
      setType('gym');
      setIntensity('moderate');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log workout">
      <div className="px-5 pb-6 space-y-5">
        {/* Type */}
        <div>
          <p className="text-xs text-warm-500 mb-2">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {EXERCISE_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3 py-2.5 rounded-card border text-sm transition-colors press-scale ${
                  type === t.id
                    ? 'border-accent bg-accent-tint text-accent'
                    : 'border-warm-200 bg-white text-warm-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="text-xs text-warm-500 block mb-2">Duration (minutes)</label>
          <div className="flex items-center gap-2">
            {[15, 30, 45, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setDuration(String(d))}
                className={`flex-1 py-2 rounded-card text-sm border transition-colors press-scale ${
                  duration === String(d)
                    ? 'border-accent bg-accent-tint text-accent'
                    : 'border-warm-200 bg-white text-warm-600'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder="Or type custom"
            className="mt-2 w-full px-3 py-2.5 rounded-card border border-warm-200 text-sm text-warm-800 focus:outline-none focus:border-accent bg-white"
            min="1"
            max="300"
          />
        </div>

        {/* Intensity */}
        <div>
          <p className="text-xs text-warm-500 mb-2">Intensity</p>
          <div className="flex gap-2">
            {INTENSITIES.map(i => (
              <button
                key={i.id}
                onClick={() => setIntensity(i.id)}
                className={`flex-1 py-2 rounded-card text-sm border transition-colors press-scale ${
                  intensity === i.id
                    ? 'border-accent bg-accent-tint text-accent'
                    : 'border-warm-200 bg-white text-warm-600'
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!duration || saving}
          className="w-full py-3.5 bg-accent text-white rounded-card text-sm disabled:opacity-40 press-scale"
        >
          {saving ? 'Saving...' : 'Log workout'}
        </button>
      </div>
    </Sheet>
  );
}
