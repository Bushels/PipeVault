/**
 * React Query hooks for project-centric admin data
 * Uses get_project_summaries_by_company() RPC
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProjectSummariesResponse } from '../types/projectSummaries';

/**
 * Fetch all project summaries grouped by company
 * Admin-only - requires user to be in admin_users table
 *
 * Data structure:
 * [
 *   {
 *     company: { id, name, domain, contactEmail, contactPhone },
 *     projects: [
 *       {
 *         id, referenceId, status,
 *         pipeDetails: { ... },
 *         inboundLoads: [{ documents: [...], assignedRacks: [...] }],
 *         outboundLoads: [...],
 *         inventorySummary: { totalJoints, totalLengthFt, rackNames }
 *       }
 *     ]
 *   }
 * ]
 */
export function useProjectSummaries(): UseQueryResult<ProjectSummariesResponse, Error> {
  return useQuery({
    queryKey: ['projectSummaries'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_summaries_by_company');

      if (error) {
        // Handle specific error cases
        if (error.message?.includes('Access denied')) {
          throw new Error('Admin privileges required. Please contact support if you believe this is an error.');
        }
        throw new Error(`Failed to fetch project summaries: ${error.message}`);
      }

      // RPC returns JSON, parse if needed
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      return parsed as ProjectSummariesResponse;
    },

    // Data freshness settings (addresses critical review finding #3)
    staleTime: 30 * 1000,        // Consider data fresh for 30 seconds
    refetchOnMount: 'always',     // Always fetch latest on component mount
    refetchOnWindowFocus: true,   // Refetch when user returns to tab
    refetchInterval: 60 * 1000,   // Poll every 60 seconds for live updates

    // Error retry settings
    retry: 2,                     // Retry failed requests twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Performance settings
    gcTime: 5 * 60 * 1000,       // Keep unused data in cache for 5 minutes
  });
}

/**
 * Get a specific company's projects by company ID
 * Derived from useProjectSummaries data
 */
export function useCompanyProjects(companyId: string | null) {
  const { data, ...queryResult } = useProjectSummaries();

  const companyData = data?.find(c => c.company.id === companyId);

  return {
    ...queryResult,
    data: companyData || null,
    projects: companyData?.projects || [],
  };
}

/**
 * Get a specific project by ID
 * Derived from useProjectSummaries data
 */
export function useProjectById(projectId: string | null) {
  const { data, ...queryResult } = useProjectSummaries();

  let foundProject = null;
  if (data && projectId) {
    for (const companyGroup of data) {
      const project = companyGroup.projects.find(p => p.id === projectId);
      if (project) {
        foundProject = {
          company: companyGroup.company,
          project,
        };
        break;
      }
    }
  }

  return {
    ...queryResult,
    data: foundProject,
  };
}

/**
 * Get summary statistics across all companies
 * Useful for admin dashboard overview metrics
 */
export function useAdminMetrics() {
  const { data, ...queryResult } = useProjectSummaries();

  const metrics = {
    totalCompanies: data?.length || 0,
    totalProjects: data?.reduce((sum, c) => sum + c.projects.length, 0) || 0,
    pendingApprovals: data?.reduce(
      (sum, c) => sum + c.projects.filter(p => p.status === 'PENDING').length,
      0
    ) || 0,
    approvedProjects: data?.reduce(
      (sum, c) => sum + c.projects.filter(p => p.status === 'APPROVED').length,
      0
    ) || 0,
    totalInventoryJoints: data?.reduce(
      (sum, c) => sum + c.projects.reduce((s, p) => s + p.inventorySummary.totalJoints, 0),
      0
    ) || 0,
    totalLoads: data?.reduce(
      (sum, c) => sum + c.projects.reduce(
        (s, p) => s + p.inboundLoads.length + p.outboundLoads.length,
        0
      ),
      0
    ) || 0,
  };

  return {
    ...queryResult,
    metrics,
  };
}

/**
 * Hook for realtime updates via Supabase subscriptions
 * Automatically invalidates queries when data changes
 *
 * Usage:
 * useProjectSummariesRealtime(); // Call once in AdminDashboard
 */
export function useProjectSummariesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to changes on relevant tables
    const subscription = supabase
      .channel('admin-project-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'storage_requests',
        },
        () => {
          // Invalidate project summaries when storage requests change
          queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trucking_loads',
        },
        () => {
          // Invalidate when loads change
          queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        () => {
          // Invalidate when inventory changes
          queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}

// Import for realtime hook
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
