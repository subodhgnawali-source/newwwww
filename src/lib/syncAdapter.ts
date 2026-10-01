/**
 * FrostArc Cloud Sync Adapter Interface
 * Decoupled sync layer. By default, FrostArc operates 100% offline-first using Dexie (IndexedDB).
 * If enabled in settings, this adapter handles pushing/pulling outbox changes to Supabase
 * with Row Level Security (RLS) scoped strictly to auth.uid() == user_id.
 */

export interface SyncPayload {
  table: string;
  op: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export interface SyncAdapter {
  name: string;
  isEnabled: () => boolean;
  pushChanges: (payloads: SyncPayload[]) => Promise<{ success: boolean; syncedCount: number }>;
  pullChanges: (sinceTimestamp: number) => Promise<{ success: boolean; updates: Record<string, any[]> }>;
}

export class OfflineLocalSyncAdapter implements SyncAdapter {
  name = 'OfflineLocalAdapter';

  isEnabled(): boolean {
    return false;
  }

  async pushChanges(payloads: SyncPayload[]) {
    // 100% offline local-first default
    return { success: true, syncedCount: payloads.length };
  }

  async pullChanges(sinceTimestamp: number) {
    return { success: true, updates: {} };
  }
}

export const syncAdapter: SyncAdapter = new OfflineLocalSyncAdapter();
