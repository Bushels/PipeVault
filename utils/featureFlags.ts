/**
 * Feature Flags Utility
 *
 * Centralized configuration for feature flag management.
 * All flags are read from environment variables (import.meta.env)
 * and can be toggled without code changes.
 *
 * Usage:
 * ```typescript
 * import { isFeatureEnabled, FEATURES } from '@/utils/featureFlags';
 *
 * if (isFeatureEnabled(FEATURES.TILE_ADMIN)) {
 *   return <TileBasedAdmin />;
 * } else {
 *   return <LegacyTabAdmin />;
 * }
 * ```
 */

/**
 * Available feature flags
 */
export const FEATURES = {
  /**
   * Tile-based admin dashboard
   *
   * When enabled: Displays company-centric tile carousel interface
   * When disabled: Shows legacy tab-based admin dashboard
   *
   * Environment variable: VITE_ENABLE_TILE_ADMIN
   * Default: false (legacy UI)
   *
   * Rollout plan:
   * - Phase 1 (Week 1-2): Development/testing with flag=false
   * - Phase 2 (Week 3): Internal testing with flag=true
   * - Phase 3 (Week 4): Staged rollout to production
   * - Phase 4 (Week 5+): Full rollout, remove flag
   */
  TILE_ADMIN: 'VITE_ENABLE_TILE_ADMIN',
} as const;

/**
 * Check if a feature is enabled
 *
 * @param feature - Feature flag key from FEATURES enum
 * @returns true if feature is enabled, false otherwise
 *
 * @example
 * ```typescript
 * if (isFeatureEnabled(FEATURES.TILE_ADMIN)) {
 *   console.log('New tile UI is enabled');
 * }
 * ```
 */
export function isFeatureEnabled(feature: string): boolean {
  const value = import.meta.env[feature];

  // Handle various truthy values
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return false;
}

/**
 * Get all feature flags and their current states
 *
 * Useful for admin debugging UI or feature flag dashboards
 *
 * @returns Object mapping feature names to their enabled state
 *
 * @example
 * ```typescript
 * const flags = getAllFeatureFlags();
 * console.log('Active features:', flags);
 * // Output: { TILE_ADMIN: false }
 * ```
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  return Object.entries(FEATURES).reduce((acc, [name, envKey]) => {
    acc[name] = isFeatureEnabled(envKey);
    return acc;
  }, {} as Record<string, boolean>);
}

/**
 * Type-safe feature flag hook for React components
 *
 * @param feature - Feature flag key from FEATURES enum
 * @returns true if feature is enabled, false otherwise
 *
 * @example
 * ```typescript
 * function AdminDashboard() {
 *   const useTileUI = useFeatureFlag(FEATURES.TILE_ADMIN);
 *
 *   return useTileUI ? <TileBasedAdmin /> : <LegacyAdmin />;
 * }
 * ```
 */
export function useFeatureFlag(feature: string): boolean {
  // Feature flags are static (from env vars), so no need for useState
  // This is just a convenience wrapper for React components
  return isFeatureEnabled(feature);
}

/**
 * Get a descriptive label for the current UI mode
 *
 * Useful for displaying to admins which version they're using
 *
 * @returns Human-readable UI mode description
 */
export function getAdminUIMode(): string {
  if (isFeatureEnabled(FEATURES.TILE_ADMIN)) {
    return 'Tile-Based Dashboard (New)';
  }
  return 'Tab-Based Dashboard (Legacy)';
}

/**
 * Development-only: Log all feature flags to console
 *
 * Helps with debugging during development
 * Only runs in development mode
 */
export function logFeatureFlags(): void {
  if (import.meta.env.DEV) {
    console.group('🚩 Feature Flags');
    const flags = getAllFeatureFlags();
    Object.entries(flags).forEach(([name, enabled]) => {
      const icon = enabled ? '✅' : '❌';
      console.log(`${icon} ${name}: ${enabled}`);
    });
    console.groupEnd();
  }
}

// Auto-log feature flags in development
if (import.meta.env.DEV) {
  logFeatureFlags();
}
