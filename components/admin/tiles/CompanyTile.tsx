/**
 * Company Tile
 *
 * Individual company summary card displaying key metrics and recent activity.
 * Follows the customer tile pattern (600×480px) with admin-specific styling.
 *
 * Layout:
 * - Header (80px): Company info + status indicator
 * - Stats Grid (200px): 2×2 metrics (Pending, Approved, Loads, Inventory)
 * - Activity Feed (140px): Last 3 activities
 * - Actions (60px): View Details + Quick Approve buttons
 *
 * States:
 * - Default: Neutral glow
 * - Has Pending: Yellow glow
 * - Selected: Cyan border highlight
 * - Hover: 3D glow effect
 */

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import type { CompanySummary } from '../../../hooks/useCompanyData';
import type { Yard, StorageRequest } from '../../../types';
import { useApproveRequest } from '../../../hooks/useApprovalWorkflow';
import { supabase } from '../../../lib/supabase';
import CompanyTileHeader from './CompanyTileHeader';
import CompanyTileStats from './CompanyTileStats';
import CompanyTileActions from './CompanyTileActions';
import RackAssignmentModal from './RackAssignmentModal';

interface CompanyTileProps {
  company: CompanySummary;
  onSelect: () => void;
  onViewDetails: () => void;
  isSelected: boolean;
  yards: Yard[];
}

const CompanyTile: React.FC<CompanyTileProps> = ({
  company,
  onSelect,
  onViewDetails,
  isSelected,
  yards,
}) => {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<StorageRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const queryClient = useQueryClient();
  const approveRequest = useApproveRequest();
  const hasPending = company.pendingRequests > 0;

  // Fetch first pending request when Quick Approve is clicked
  const handleQuickApproveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!hasPending) return;

    setLoadingRequest(true);
    try {
      // Fetch the oldest pending request for this company
      const { data, error } = await supabase
        .from('storage_requests')
        .select('*')
        .eq('company_id', company.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        // Map database row to StorageRequest type
        const request: StorageRequest = {
          id: data.id,
          companyId: data.company_id,
          userId: data.user_email,
          referenceId: data.reference_id,
          status: data.status,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          requestDetails: data.request_details,
          truckingInfo: data.trucking_info,
          assignedRackIds: data.assigned_rack_ids || undefined,
          internalNotes: data.internal_notes || undefined,
        };

        setPendingRequest(request);
        setShowApprovalModal(true);
      }
    } catch (error) {
      console.error('Error fetching pending request:', error);
      toast.error('Failed to load request details. Please try again.');
    } finally {
      setLoadingRequest(false);
    }
  };

  // Handle approval submission
  const handleApprove = async (rackIds: string[], notes?: string) => {
    if (!pendingRequest) return;

    const requiredJoints = pendingRequest.requestDetails?.totalJoints || 0;

    try {
      await approveRequest.mutateAsync({
        requestId: pendingRequest.id,
        assignedRackIds: rackIds,
        requiredJoints,
        notes,
      });

      // Invalidate company summaries cache to update tile immediately
      queryClient.invalidateQueries({ queryKey: ['companies', 'summaries'] });
      queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

      toast.success(`Request ${pendingRequest.referenceId} approved successfully!`);
      setShowApprovalModal(false);
      setPendingRequest(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Approval failed';
      toast.error(errorMessage);
      // Keep modal open for retry
    }
  };

  // Status-based background glow
  const backgroundGlowClass = hasPending
    ? 'bg-gradient-to-br from-yellow-500 to-transparent'
    : 'bg-gradient-to-br from-cyan-500 to-transparent';

  return (
    <div
      className="flex-none w-full sm:w-[calc(100%-2rem)] lg:w-[600px] snap-center"
      role="article"
      aria-label={`${company.name} summary`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* 3D Glow Effect (appears on hover) */}
      <div className="relative group cursor-pointer">
        <div
          className={`absolute -inset-1 bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 rounded-2xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300 ${
            isSelected ? 'opacity-30' : ''
          }`}
        />

        {/* Card Container */}
        <div
          className={`relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl overflow-hidden min-h-[480px] max-h-[600px] transition-all duration-200 group-hover:transform group-hover:-translate-y-1 flex flex-col ${
            isSelected
              ? 'border-2 border-cyan-500'
              : 'border border-gray-700/50'
          }`}
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />

          {/* Status glow (yellow for pending, cyan for approved) */}
          <div className={`absolute inset-0 opacity-10 ${backgroundGlowClass}`} />

          {/* Content */}
          <div className="relative p-6 flex-1 flex flex-col overflow-y-auto">
            {/* Header (80px) */}
            <CompanyTileHeader company={company} />

            {/* Stats Grid (200px) */}
            <CompanyTileStats company={company} />

            {/* Activity Feed (140px) */}
            <div className="flex-1 py-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Recent Activity
              </h4>
              <div className="space-y-2">
                {company.latestActivity ? (
                  <>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">
                        Latest activity:{' '}
                        {new Date(company.latestActivity).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-gray-400">
                        {company.totalRequests} total request{company.totalRequests === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-gray-600 rounded-full mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-gray-400">
                        {company.totalLoads} trucking load{company.totalLoads === 1 ? '' : 's'}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No recent activity
                  </p>
                )}
              </div>
            </div>

            {/* Actions (60px) */}
            <CompanyTileActions
              company={company}
              onViewDetails={onViewDetails}
              onQuickApprove={handleQuickApproveClick}
              isLoadingApproval={loadingRequest}
            />
          </div>
        </div>
      </div>

      {/* Rack Assignment Modal (rendered outside tile for proper z-index layering) */}
      <RackAssignmentModal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setPendingRequest(null);
        }}
        onApprove={handleApprove}
        request={pendingRequest}
        companyName={company.name}
        yards={yards}
        isLoading={approveRequest.isPending}
      />
    </div>
  );
};

export default CompanyTile;
