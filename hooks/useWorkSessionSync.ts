import { useEffect, useRef } from 'react';
import { useAFKStore } from '@/stores/afkStore';
import { useAuth, useUser, useOrganization } from '@clerk/nextjs';
import { saveWorkSession } from '@/app/actions/WorkSession';

const SYNC_INTERVAL_MS = 5 * 1000; // Sync every 5 seconds for real-time updates
const MIN_SYNC_INTERVAL_MS = 2 * 1000; // Minimum 2 seconds between syncs

/**
 * Hook to periodically sync work session data to the database
 */
export function useWorkSessionSync() {
  const { orgId } = useAuth();
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();
  const isAFK = useAFKStore((s) => s.isAFK);
  const getActiveMs = useAFKStore((s) => s.getActiveMs);
  const afkCount = useAFKStore((s) => s.afkCount);
  const lastSyncRef = useRef<number>(0);
  const syncTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Determine manager role (admin/org:admin)
    const role = (organization as any)?.membership?.role as string | undefined
    const isManager = !!role && (role === 'org:admin' || role === 'admin' || role.includes('admin'))

    // Don't sync if user is not authenticated, logged out, not in organization, or is manager
    if (!isLoaded || !user || !orgId || isManager) {
      // Pause tracking and stop syncing
      const { pauseTracking } = useAFKStore.getState();
      pauseTracking();
      return;
    }

    const syncWorkSession = async () => {
      const now = Date.now();
      
      // Don't sync too frequently
      if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) {
        return;
      }

      try {
        const workTimeMs = getActiveMs(now);
        
        const result = await saveWorkSession({
          org_id: orgId,
          work_time_ms: workTimeMs,
          is_afk: isAFK,
          afk_count: afkCount,
        });

        if (result.success) {
          lastSyncRef.current = now;
        } else {
          // Log error but don't crash
          if (result.error?.includes('does not exist')) {
            // Only log once to avoid spam
            if (!lastSyncRef.current || Date.now() - lastSyncRef.current > 60000) {
              console.warn('⚠️ work_sessions table not found. Please run the database migration. See migrations/create_work_sessions_table.sql');
            }
            // Don't retry if table doesn't exist - it will keep failing
            return;
          }
          console.error('Error syncing work session:', result.error);
          // Allow retry on next interval for other errors
        }
      } catch (error: any) {
        // Fallback error handling (shouldn't happen now, but just in case)
        console.error('Unexpected error syncing work session:', error);
      }
    };

    // Sync immediately on mount
    syncWorkSession();

    // Set up periodic sync
    const scheduleSync = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = window.setTimeout(() => {
        syncWorkSession().finally(() => {
          scheduleSync(); // Schedule next sync
        });
      }, SYNC_INTERVAL_MS);
    };

    scheduleSync();

    // Also sync when AFK status changes
    const handleAFKChange = () => {
      syncWorkSession();
    };

    // Sync on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWorkSession();
      }
    };

    // Sync before page unload (try to sync, but don't block)
    const handleBeforeUnload = () => {
      // Attempt a quick sync, but don't wait for it
      syncWorkSession().catch(() => {
        // Ignore errors on unload
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // User left room or logged out - stop syncing and pause timer
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Pause tracking when leaving room
      const { pauseTracking } = useAFKStore.getState();
      pauseTracking();
      
      // Final sync on cleanup (best effort)
      syncWorkSession().catch(() => {
        // Ignore errors on cleanup
      });
    };
  }, [orgId, isAFK, getActiveMs, afkCount, isLoaded, user, organization]);

  // Sync when AFK status changes
  useEffect(() => {
    const role = (organization as any)?.membership?.role as string | undefined
    const isManager = !!role && (role === 'org:admin' || role === 'admin' || role.includes('admin'))
    // Don't sync if user is not authenticated, logged out, not in organization, or is manager
    if (!isLoaded || !user || !orgId || isManager) return;

    const syncWorkSession = async () => {
      try {
        const workTimeMs = getActiveMs();
        const result = await saveWorkSession({
          org_id: orgId,
          work_time_ms: workTimeMs,
          is_afk: isAFK,
          afk_count: afkCount,
        });
        
        if (result.success) {
          lastSyncRef.current = Date.now();
        } else {
          // Log error but don't crash
          if (result.error?.includes('does not exist')) {
            console.warn('⚠️ work_sessions table not found. Migration required.');
          } else {
            console.error('Error syncing work session on AFK change:', result.error);
          }
        }
      } catch (error: any) {
        // Fallback error handling
        console.error('Unexpected error syncing work session on AFK change:', error);
      }
    };

    // Debounce AFK status sync
    const timeoutId = setTimeout(syncWorkSession, 2000);
    return () => clearTimeout(timeoutId);
  }, [orgId, isAFK, getActiveMs, afkCount, isLoaded, user, organization]);
}

