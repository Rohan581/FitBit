/**
 * Local-first set store using IndexedDB + sync queue.
 *
 * Every set logged during a workout is written to IndexedDB first,
 * then queued for sync to the server. Retries use exponential backoff:
 * 2s → 5s → 15s → 60s → 120s (cap).
 */
import { api } from './api';

const DB_NAME = 'earned_sets';
const DB_VERSION = 1;
const STORE = 'sets';

const BACKOFF = [2000, 5000, 15000, 60000, 120000]; // ms

// ── Helpers ──────────────────────────────────────────────────────────
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_uuid' });
        store.createIndex('session', 'session_id', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDB().then(db => {
    const t = db.transaction(STORE, mode);
    return t.objectStore(STORE);
  });
}

// ── CRUD ─────────────────────────────────────────────────────────────

/** Save a set locally. Returns the generated client_uuid. */
export async function saveSet(sessionId, data) {
  const store = await tx('readwrite');
  const record = {
    client_uuid: uuid(),
    session_id: sessionId,
    exercise_id: data.exercise_id,
    set_number: data.set_number,
    weight_kg: data.weight_kg,
    reps: data.reps,
    created_at: new Date().toISOString(),
    synced: 0,      // 0 = pending, 1 = synced
    retries: 0,
    server_id: null, // filled after successful sync
  };
  return new Promise((resolve, reject) => {
    const r = store.put(record);
    r.onsuccess = () => resolve(record);
    r.onerror = () => reject(r.error);
  });
}

/** Update a set locally (e.g. weight/reps change before sync). */
export async function updateSet(clientUuid, fields) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const r = store.get(clientUuid);
    r.onsuccess = () => {
      if (!r.result) return resolve(null);
      const updated = { ...r.result, ...fields, synced: 0 };
      const p = store.put(updated);
      p.onsuccess = () => resolve(updated);
      p.onerror = () => reject(p.error);
    };
    r.onerror = () => reject(r.error);
  });
}

/** Delete a set locally. */
export async function deleteSet(clientUuid) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const r = store.delete(clientUuid);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

/** Get all sets for a session (both pending and synced). */
export async function getSetsForSession(sessionId) {
  const store = await tx('readonly');
  const idx = store.index('session');
  return new Promise((resolve, reject) => {
    const r = idx.getAll(sessionId);
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

/** Get all pending (unsynced) sets. */
export async function getPendingSets() {
  const store = await tx('readonly');
  const idx = store.index('synced');
  return new Promise((resolve, reject) => {
    const r = idx.getAll(0);
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

/** Count pending sets. */
export async function pendingCount() {
  const sets = await getPendingSets();
  return sets.length;
}

/** Clear all synced sets for a finished session. */
export async function clearSyncedForSession(sessionId) {
  const sets = await getSetsForSession(sessionId);
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    let remaining = 0;
    for (const s of sets) {
      if (s.synced) {
        store.delete(s.client_uuid);
      } else {
        remaining++;
      }
    }
    store.transaction.oncomplete = () => resolve(remaining);
    store.transaction.onerror = () => reject(store.transaction.error);
  });
}

// ── Sync queue ───────────────────────────────────────────────────────

let syncing = false;
let syncTimer = null;

/** Flush all pending sets to the server. */
export async function flushSync() {
  if (syncing) return;
  syncing = true;
  try {
    const pending = await getPendingSets();
    for (const set of pending) {
      try {
        const resp = await api.logSet(set.session_id, {
          exercise_id: set.exercise_id,
          set_number: set.set_number,
          weight_kg: set.weight_kg,
          reps: set.reps,
          client_uuid: set.client_uuid,
          created_at: set.created_at,
        });
        // Mark synced
        const store = await tx('readwrite');
        await new Promise((resolve, reject) => {
          const r = store.get(set.client_uuid);
          r.onsuccess = () => {
            if (!r.result) return resolve();
            const updated = { ...r.result, synced: 1, retries: 0, server_id: resp.id };
            const p = store.put(updated);
            p.onsuccess = () => resolve();
            p.onerror = () => reject(p.error);
          };
          r.onerror = () => reject(r.error);
        });
      } catch (err) {
        // Bump retry count on failure — will retry on next flush
        const store = await tx('readwrite');
        await new Promise((resolve) => {
          const r = store.get(set.client_uuid);
          r.onsuccess = () => {
            if (!r.result) return resolve();
            const updated = { ...r.result, retries: (r.result.retries || 0) + 1 };
            store.put(updated);
            resolve();
          };
          r.onerror = () => resolve();
        });
      }
    }
  } finally {
    syncing = false;
  }
}

/** Schedule a retry flush with exponential backoff based on max retry count. */
export function scheduleRetry(retryCount) {
  if (syncTimer) return; // already scheduled
  const delay = BACKOFF[Math.min(retryCount, BACKOFF.length - 1)];
  syncTimer = setTimeout(() => {
    syncTimer = null;
    flushSync().then(() => {
      // If still pending, schedule again
      getPendingSets().then(p => {
        if (p.length > 0) {
          const maxRetries = Math.max(...p.map(s => s.retries || 0));
          scheduleRetry(maxRetries);
        }
      });
    });
  }, delay);
}

/** Trigger sync: flush immediately, then schedule retry if needed. */
export async function triggerSync() {
  await flushSync();
  const pending = await getPendingSets();
  if (pending.length > 0) {
    const maxRetries = Math.max(...pending.map(s => s.retries || 0));
    scheduleRetry(maxRetries);
  }
}

/** Stop any scheduled retry. */
export function stopSync() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

// ── Diagnostics ──────────────────────────────────────────────────────

/** Return diagnostic info for the settings panel. */
export async function getDiagnostics() {
  const pending = await getPendingSets();
  const db = await openDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const total = await new Promise((resolve) => {
    const r = store.count();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(0);
  });
  return {
    totalLocal: total,
    pendingSync: pending.length,
    maxRetries: pending.length > 0 ? Math.max(...pending.map(s => s.retries || 0)) : 0,
    pendingSets: pending.map(s => ({
      client_uuid: s.client_uuid,
      session_id: s.session_id,
      exercise_id: s.exercise_id,
      set_number: s.set_number,
      retries: s.retries,
      created_at: s.created_at,
    })),
  };
}
