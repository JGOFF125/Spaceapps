import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { earthSnapshot, HELLO_KEY, REPLIES_KEY, SNAPSHOT_KEY, SYNC_CHANNEL } from './earth.ts';
import { receiveEarthAdvice } from './session.ts';
import type { EarthReply, MissionSession } from './session.ts';

export function useShipSync(session: MissionSession, setSession: Dispatch<SetStateAction<MissionSession>>) {
  const current = useRef(session);
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => { current.current = session; }, [session]);
  const acceptPending = useCallback(() => {
    try {
      const pending: unknown = JSON.parse(localStorage.getItem(REPLIES_KEY) ?? '[]');
      if (Array.isArray(pending)) setSession(s => pending.slice(-50).reduce((next: MissionSession, reply: EarthReply) => receiveEarthAdvice(next, reply), s));
    } catch { /* BroadcastChannel still works when local storage is blocked. */ }
  }, [setSession]);
  useEffect(() => {
    const publish = () => {
      const snapshot = earthSnapshot(current.current);
      channel.current?.postMessage({ type: 'snapshot', snapshot });
      try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch { /* Channel transport remains available. */ }
    };
    if (typeof BroadcastChannel !== 'undefined' && new URLSearchParams(location.search).get('sync') !== 'storage') {
      try {
        channel.current = new BroadcastChannel(SYNC_CHANNEL);
        channel.current.onmessage = e => {
          if (e.data?.type === 'hello') { publish(); acceptPending(); }
          if (e.data?.type === 'reply') setSession(s => receiveEarthAdvice(s, e.data.reply));
        };
      } catch { /* Use the storage-event fallback. */ }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === REPLIES_KEY) acceptPending();
      if (e.key === HELLO_KEY) { publish(); acceptPending(); }
    };
    window.addEventListener('storage', onStorage);
    publish(); acceptPending();
    return () => { window.removeEventListener('storage', onStorage); channel.current?.close(); channel.current = null; };
  }, [setSession, acceptPending]);
  useEffect(() => {
    const snapshot = earthSnapshot(session);
    channel.current?.postMessage({ type: 'snapshot', snapshot });
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch { /* Continue with the channel. */ }
    // Retry advice written while the ship tab was reloading. IDs deduplicate
    // channel + storage delivery, including React StrictMode's effect replay.
    acceptPending();
  }, [session, acceptPending]);
}
