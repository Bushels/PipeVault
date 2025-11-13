/**
 * useRealtimeUpdates Hook
 *
 * Subscribes to real-time database changes via Supabase Realtime
 * and automatically invalidates React Query caches to keep UI in sync.
 *
 * This enables multi-admin collaboration where changes made by one
 * admin are immediately visible to other admins without manual refresh.
 *
 * Subscribed Events:
 * - trucking_loads: Status changes (PENDING → APPROVED → IN_TRANSIT → COMPLETED)
 * - inventory: Create/Update/Delete operations
 * - racks: Occupancy changes (when pipe is added/removed)
 *
 * Usage:
 * ```tsx
 * // In AdminDashboard or App.tsx
 * useRealtimeUpdates({ enabled: isAdminUser });
 * ```
 *
 * Performance:
 * - Only subscribes when enabled
 * - Automatically unsubscribes on unmount
 * - Debounced invalidation to prevent excessive refetches
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeUpdatesOptions {
  /** Enable realtime subscriptions (default: true) */
  enabled?: boolean;
  /** Debounce delay in ms before invalidating queries (default: 500) */
  debounceMs?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const {
    enabled = true,
    debounceMs = 500,
    debug = false,
  } = options;

  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const invalidationTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!enabled) {
      if (debug) {
        console.log('[useRealtimeUpdates] Disabled - skipping subscription');
      }
      return;
    }

    if (debug) {
      console.log('[useRealtimeUpdates] Initializing realtime subscriptions...');
    }

    // =========================================================================
    // HELPER: Debounced query invalidation
    // =========================================================================
    const invalidateQueries = (queryKey: string[]) => {
      const key = queryKey.join(':');

      // Clear existing timeout for this query key
      if (invalidationTimeoutRef.current[key]) {
        clearTimeout(invalidationTimeoutRef.current[key]);
      }

      // Set new debounced timeout
      invalidationTimeoutRef.current[key] = setTimeout(() => {
        if (debug) {
          console.log('[useRealtimeUpdates] Invalidating queries:', queryKey);
        }
        queryClient.invalidateQueries({ queryKey });
        delete invalidationTimeoutRef.current[key];
      }, debounceMs);
    };

    // =========================================================================
    // SUBSCRIPTION: Trucking Loads (Status Changes)
    // =========================================================================
    const channel = supabase
      .channel('admin-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',  // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'trucking_loads',
        },
        (payload) => {
          if (debug) {
            console.log('[useRealtimeUpdates] trucking_loads change:', payload);
          }

          // Invalidate all load-related queries
          invalidateQueries(['loads']);
          invalidateQueries(['load-details', payload.new?.id]);
          invalidateQueries(['pending-loads']);
          invalidateQueries(['approved-loads']);
          invalidateQueries(['in-transit-loads']);
          invalidateQueries(['outbound-loads']);

          // If status changed, also invalidate request queries
          if (payload.eventType === 'UPDATE' && payload.old?.status !== payload.new?.status) {
            invalidateQueries(['requests']);
            invalidateQueries(['company-details']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        (payload) => {
          if (debug) {
            console.log('[useRealtimeUpdates] inventory change:', payload);
          }

          // Invalidate inventory queries
          invalidateQueries(['inventory']);
          invalidateQueries(['inventory', 'available']);

          // Also invalidate company and request data (shows inventory counts)
          if (payload.new?.company_id) {
            invalidateQueries(['company-details', payload.new.company_id]);
          }
          if (payload.new?.request_id) {
            invalidateQueries(['requests']);
          }

          // If storage_area_id changed, invalidate rack data
          const oldRackId = payload.old?.storage_area_id;
          const newRackId = payload.new?.storage_area_id;

          if (oldRackId && oldRackId !== newRackId) {
            invalidateQueries(['racks']);
            invalidateQueries(['yards']);
          }
          if (newRackId && oldRackId !== newRackId) {
            invalidateQueries(['racks']);
            invalidateQueries(['yards']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'racks',
        },
        (payload) => {
          if (debug) {
            console.log('[useRealtimeUpdates] racks change:', payload);
          }

          // Invalidate rack and yard queries
          invalidateQueries(['racks']);
          invalidateQueries(['yards']);

          // If this is an occupancy change, also invalidate analytics
          const oldOccupied = payload.old?.occupied;
          const newOccupied = payload.new?.occupied;

          if (oldOccupied !== newOccupied) {
            if (debug) {
              console.log(
                `[useRealtimeUpdates] Rack ${payload.new?.id} occupancy: ${oldOccupied} → ${newOccupied}`
              );
            }
            // Invalidate analytics to update capacity utilization
            invalidateQueries(['analytics']);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'storage_requests',
        },
        (payload) => {
          if (debug) {
            console.log('[useRealtimeUpdates] storage_requests change:', payload);
          }

          // Invalidate request queries
          invalidateQueries(['requests']);
          invalidateQueries(['company-details']);

          // If status changed, invalidate analytics
          if (payload.old?.status !== payload.new?.status) {
            invalidateQueries(['analytics']);
          }
        }
      )
      .subscribe((status) => {
        if (debug) {
          console.log('[useRealtimeUpdates] Subscription status:', status);
        }

        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time updates enabled - Admin dashboard will auto-refresh');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Real-time subscription failed:', status);
        }
      });

    channelRef.current = channel;

    // =========================================================================
    // CLEANUP
    // =========================================================================
    return () => {
      if (debug) {
        console.log('[useRealtimeUpdates] Cleaning up subscriptions...');
      }

      // Clear all pending invalidation timeouts
      Object.values(invalidationTimeoutRef.current).forEach(clearTimeout);
      invalidationTimeoutRef.current = {};

      // Unsubscribe from channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, debounceMs, debug, queryClient]);

  return {
    isSubscribed: channelRef.current !== null,
  };
}

export default useRealtimeUpdates;
