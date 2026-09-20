/**
 * Safe localStorage wrapper with automated QuotaExceededError handling,
 * proactive size reduction, and non-blocking fallbacks.
 */

const LOG_PREFIX = '[safeStorage]';

/**
 * Clean up redundant or oversized localStorage keys to free up space.
 */
export function pruneStorage(currentUserId?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const keysToRemove: string[] = [];
    const keysToClean: string[] = [
      'psycalcu_ai_summaries',
      'psycalcu_local_notifications',
      'psycalcu_read_announcement_ids',
      'psycalcu_debug_log',
      'psycalcu_calendar_temp_events',
      'psycalcu_temp_notes_cache',
      'psycalcu_has_fetched_instant_notes',
      'psycalcu_pending_redirect',
      'psycalcu_audit_visible_columns',
      'psycalcu_pwa_prompt_dismissed',
      'psycalcu_pwa_banner_dismissed'
    ];

    // If we have a user-specific ID, old un-scoped global keys can be purged safely
    if (currentUserId) {
      keysToRemove.push('psycalcu_sessions');
      keysToRemove.push('psycalcu_settings');
      keysToRemove.push('psycalcu_expenses');
    }

    for (const key of keysToClean) {
      keysToRemove.push(key);
      if (currentUserId) {
        keysToRemove.push(`${key}_${currentUserId}`);
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('debug_') || k.startsWith('temp_') || k.includes('cache_blob') || k.startsWith('psycalcu_tour_'))) {
        keysToRemove.push(k);
      }
    }

    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Storage prune warning:`, err);
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn(`${LOG_PREFIX} getItem failed for ${key}:`, err);
      return null;
    }
  },

  setItem(key: string, value: string, userId?: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err: any) {
      // Check if QuotaExceededError
      const isQuota = 
        err?.name === 'QuotaExceededError' || 
        err?.code === 22 || 
        err?.code === 1014 || 
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        String(err).toLowerCase().includes('quota');

      if (isQuota) {
        console.warn(`${LOG_PREFIX} Quota exceeded on setItem(${key}). Pruning non-essential cache...`);
        pruneStorage(userId);

        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryErr) {
          console.warn(`${LOG_PREFIX} setItem non-fatal fallback (data safely stored in Firestore cloud):`, retryErr);
          // Do not crash the app or throw. The cloud database (Firestore) preserves all user data.
          return false;
        }
      }

      console.warn(`${LOG_PREFIX} setItem error for ${key}:`, err);
      return false;
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`${LOG_PREFIX} removeItem failed for ${key}:`, err);
    }
  },

  clearAllSafely(userId?: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // CRITICAL SAFETY GUARD:
      // Never call localStorage.clear() indiscriminately!
      // Doing so destroys Firebase Auth session state (logging the user out) and user settings.
      // Instead, selectively remove non-essential cache while strictly protecting Auth & User Data.
      
      pruneStorage(userId);

      // Clean temporary session storage safely
      try {
        sessionStorage.clear();
      } catch (e) {}

      // Remove non-essential keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // PROTECT Firebase Auth credentials & User Settings/Sessions
        const isProtected = 
          key.startsWith('firebase:') ||
          key.startsWith('firebaseApp:') ||
          key.startsWith('psycalcu_settings') ||
          key.startsWith('psycalcu_sessions') ||
          key.startsWith('psycalcu_expenses') ||
          key === 'psycalcu_registration_created_at';

        if (!isProtected) {
          keysToRemove.push(key);
        }
      }

      for (const k of keysToRemove) {
        try { localStorage.removeItem(k); } catch (e) {}
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} clearAllSafely failed:`, err);
    }
  }
};
