/**
 * Company Tile Actions
 *
 * Quick access buttons for common admin actions.
 *
 * Buttons:
 * - Primary: "View Details" (always visible)
 * - Conditional: "Quick Approve (N)" (only if pendingRequests > 0)
 */

import React from 'react';
import GlassButton from '../../../components/ui/GlassButton';
import type { CompanySummary } from '../../../hooks/useCompanyData';

interface CompanyTileActionsProps {
  company: Pick<CompanySummary, 'id' | 'pendingRequests'>;
  onViewDetails: () => void;
  onQuickApprove: (e: React.MouseEvent) => void;
  isLoadingApproval?: boolean;
}

const CompanyTileActions: React.FC<CompanyTileActionsProps> = ({
  company,
  onViewDetails,
  onQuickApprove,
  isLoadingApproval = false,
}) => {
  const hasPending = company.pendingRequests > 0;

  return (
    <div className="pt-4 border-t border-slate-700/50 flex gap-2">
      {/* Primary Action: View Details */}
      <GlassButton
        onClick={(e) => {
          e.stopPropagation();
          onViewDetails();
        }}
        disabled={isLoadingApproval}
        className="flex-1"
        variant="secondary"
      >
        View Details
      </GlassButton>

      {/* Conditional Action: Quick Approve */}
      {hasPending && (
        <GlassButton
          onClick={onQuickApprove}
          disabled={isLoadingApproval}
          className="px-4 whitespace-nowrap"
          variant="primary"
        >
          {isLoadingApproval ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </span>
          ) : (
            `Quick Approve (${company.pendingRequests})`
          )}
        </GlassButton>
      )}
    </div>
  );
};

export default CompanyTileActions;
