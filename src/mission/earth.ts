import { LIGHT_MINUTES_PER_DEMO_DAY, lightTimeToDays, restoreOutbox } from '../brain/outbox.ts';
import type { OutboxMessage } from '../types.ts';
import type { MissionSession } from './session.ts';

export const SYNC_CHANNEL = 'baseline-sync';
export const SNAPSHOT_KEY = 'baseline-earth-snapshot-v1';
export const REPLIES_KEY = 'baseline-earth-replies-v1';
export const HELLO_KEY = 'baseline-earth-hello-v1';
export type EarthSnapshot = Pick<MissionSession, 'missionId' | 'day' | 'outbox' | 'inbox' | 'earthReplies'> & {
  marsMode: boolean; lightTimeMin: number;
};

export function earthSnapshot(state: MissionSession): EarthSnapshot {
  // Never broadcast readings, private check-ins, or the mission's future data.
  return structuredClone({ missionId: state.missionId, day: state.day, marsMode: state.outbox.marsMode,
    lightTimeMin: state.outbox.lightTimeMin, outbox: state.outbox, inbox: state.inbox, earthReplies: state.earthReplies });
}

export function restoreEarthSnapshot(value: unknown): EarthSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid Earth snapshot.');
  const s = value as EarthSnapshot;
  if (typeof s.missionId !== 'string' || !s.missionId || !Number.isFinite(s.day) || s.day < 1 || s.day > 180 ||
      typeof s.marsMode !== 'boolean' || s.lightTimeMin !== (s.marsMode ? 22 : 3) || !s.earthReplies || typeof s.earthReplies !== 'object') throw new Error('Invalid Earth clock.');
  const outbox = restoreOutbox(JSON.stringify(s.outbox));
  const inbox = restoreOutbox(JSON.stringify(s.inbox));
  if (outbox.day !== s.day || inbox.day !== s.day || outbox.marsMode !== s.marsMode || inbox.marsMode !== s.marsMode || outbox.blackout !== inbox.blackout) throw new Error('Earth clocks disagree.');
  if (Array.isArray(s.earthReplies) || Object.values(s.earthReplies).some(r => !r ||
      !outbox.messages.some(m => m.id === r.sourceMessageId) || !inbox.messages.some(m => m.id === r.messageId))) throw new Error('Invalid advice history.');
  return { missionId: s.missionId, day: s.day, marsMode: s.marsMode, lightTimeMin: s.lightTimeMin, outbox, inbox, earthReplies: s.earthReplies };
}

export const earthVisibleDay = (s: EarthSnapshot) => s.day - lightTimeToDays(s.lightTimeMin);
export const arrived = (m: OutboxMessage) => m.state === 'received' || m.state === 'confirmed';

export function adviceBadge(message: OutboxMessage, s: EarthSnapshot): string {
  const timing = s.inbox.timings[message.id];
  const record = Object.values(s.earthReplies).find(r => r.messageId === message.id);
  const source = s.outbox.messages.find(m => m.id === record?.sourceMessageId);
  const age = (day: number) => Math.max(0, Math.floor((s.day - day) * LIGHT_MINUTES_PER_DEMO_DAY + 1e-8));
  const sourceAge = source ? ` · based on data from ${age(source.day)} min ago` : '';
  if (timing?.sentDay === undefined) return `Queued at Earth · awaiting relay${sourceAge}`;
  return `Left Earth ${age(timing.sentDay)} min ago${sourceAge} · ${arrived(message) ? 'arrived onboard' : 'en route to ship'}`;
}
