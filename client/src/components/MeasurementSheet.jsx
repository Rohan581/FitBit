import { useState, useEffect } from 'react';
import Sheet from './Sheet';
import { api } from '../api';

export default function MeasurementSheet({ open, onClose, onLogged, enableChest, enableHips }) {
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [hips, setHips] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.getMeasurement().then(m => {
        if (m) {
          setWaist(String(m.waist_cm));
          if (m.chest_cm) setChest(String(m.chest_cm));
          if (m.hips_cm) setHips(String(m.hips_cm));
        } else {
          setWaist('');
          setChest('');
          setHips('');
        }
      }).catch(() => {});
    }
  }, [open]);

  async function handleSave() {
    const w = parseFloat(waist);
    if (!w || w < 40 || w > 200) return;
    setSaving(true);
    try {
      await api.logMeasurement({
        waist_cm: w,
        chest_cm: chest ? parseFloat(chest) : null,
        hips_cm: hips ? parseFloat(hips) : null,
      });
      onLogged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log measurements">
      <div className="px-5 pb-6 space-y-4">
        <MeasureInput label="Waist (cm)" value={waist} onChange={setWaist} required />
        {enableChest && <MeasureInput label="Chest (cm)" value={chest} onChange={setChest} />}
        {enableHips && <MeasureInput label="Hips (cm)" value={hips} onChange={setHips} />}

        <p className="text-xs text-tx-3 text-center">
          Suggested weekly. Waist often drops even when the scale stalls.
        </p>

        <button
          onClick={handleSave}
          disabled={!waist || saving}
          className="w-full py-3.5 bg-points text-white rounded-card text-sm disabled:opacity-40 press-scale"
        >
          {saving ? 'Saving...' : 'Log measurements'}
        </button>
      </div>
    </Sheet>
  );
}

function MeasureInput({ label, value, onChange, required }) {
  return (
    <div>
      <label className="text-xs text-tx-3 block mb-2">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(v => String(Math.max(30, parseFloat(v || 0) - 0.5).toFixed(1)))}
          className="w-10 h-10 rounded-card border border-hair text-xl text-tx-3 bg-card flex items-center justify-center press-scale"
        >
          -
        </button>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="cm"
          className="flex-1 px-3 py-2.5 rounded-card border border-hair text-center text-lg font-num text-tx focus:outline-none bg-card-2"
          step="0.5"
          min="30"
          max="200"
        />
        <button
          onClick={() => onChange(v => String((parseFloat(v || 0) + 0.5).toFixed(1)))}
          className="w-10 h-10 rounded-card border border-hair text-xl text-tx-3 bg-card flex items-center justify-center press-scale"
        >
          +
        </button>
      </div>
    </div>
  );
}
