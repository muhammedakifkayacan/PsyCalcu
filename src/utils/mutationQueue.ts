/**
 * Offline Outbox / Mutation Queue pattern.
 * Safely captures user actions (edits, payments, deletes) when offline
 * and automatically drains to cloud once connection is restored.
 */

import { safeStorage } from './storage';
import { idbGet, idbSet } from './idbStorage';

export type MutationActionType = 
  | 'SAVE_SESSION' 
  | 'DELETE_SESSION' 
  | 'TOGGLE_PAYMENT' 
  | 'UPDATE_SETTINGS' 
  | 'BULK_UPDATE';

export interface MutationItem {
  id: string;
  type: MutationActionType;
  timestamp: number;
  payload: any;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = 'psycalcu_offline_mutation_queue';

function getMemoryQueue(userId?: string): MutationItem[] {
  const key = userId ? `${QUEUE_STORAGE_KEY}_${userId}` : QUEUE_STORAGE_KEY;
  const raw = safeStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistQueue(items: MutationItem[], userId?: string): void {
  const key = userId ? `${QUEUE_STORAGE_KEY}_${userId}` : QUEUE_STORAGE_KEY;
  const serialized = JSON.stringify(items);
  safeStorage.setItem(key, serialized, userId);
  idbSet(key, items).catch(() => {});
}

export const mutationQueue = {
  getQueue(userId?: string): MutationItem[] {
    return getMemoryQueue(userId);
  },

  getQueueCount(userId?: string): number {
    return getMemoryQueue(userId).length;
  },

  enqueue(type: MutationActionType, payload: any, userId?: string): MutationItem {
    const queue = getMemoryQueue(userId);
    const item: MutationItem = {
      id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type,
      timestamp: Date.now(),
      payload,
      retryCount: 0
    };

    // If already in queue for the same session ID, supersede it with the latest action
    let updatedQueue = queue;
    if (payload?.id) {
      updatedQueue = queue.filter(q => q.payload?.id !== payload.id);
    }

    updatedQueue.push(item);
    persistQueue(updatedQueue, userId);
    return item;
  },

  dequeue(id: string, userId?: string): void {
    const queue = getMemoryQueue(userId);
    const filtered = queue.filter(item => item.id !== id);
    persistQueue(filtered, userId);
  },

  clear(userId?: string): void {
    persistQueue([], userId);
  },

  async loadFromIdb(userId?: string): Promise<MutationItem[]> {
    const key = userId ? `${QUEUE_STORAGE_KEY}_${userId}` : QUEUE_STORAGE_KEY;
    const idbItems = await idbGet<MutationItem[]>(key);
    if (Array.isArray(idbItems) && idbItems.length > 0) {
      persistQueue(idbItems, userId);
      return idbItems;
    }
    return getMemoryQueue(userId);
  }
};
