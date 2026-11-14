import { useState } from 'react';
import { api } from '../api';

export default function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError(err.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full bg-page flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-[340px] bg-card rounded-card p-6 shadow-subtle">
        <h1 className="font-num text-[26px] font-bold text-tx tracking-[-0.02em]">Earned</h1>
        <p className="text-[13.5px] text-tx-2 mt-1 mb-5">Enter your password to unlock.</p>
        <label htmlFor="pw" className="block text-[12.5px] text-tx-2 mb-1.5">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full h-12 px-3.5 rounded-[12px] border border-hair bg-card-2 text-tx text-[16px] outline-none focus:border-tx-3"
        />
        {error && <p role="alert" className="text-[13px] text-danger mt-2">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full h-12 mt-4 rounded-[12px] bg-tx text-page text-[15px] font-semibold press-scale"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
