/**
 * Company Tile Header
 *
 * Displays company name, domain, status indicators, and requester identity.
 *
 * Layout:
 * - Top: Company icon + name/domain + status dot
 * - Bottom: Requester card (when pending requests exist)
 *
 * Requester Card (Yellow-themed):
 * - Customer name and email
 * - Request ID (optional)
 * - Only shown when pendingRequests > 0
 */

import React from 'react';
import type { CompanySummary } from '../../../hooks/useCompanyData';

interface CompanyTileHeaderProps {
  company: Pick<CompanySummary, 'name' | 'domain' | 'pendingRequests' | 'lastRequesterName' | 'lastRequesterEmail'>;
}

const CompanyTileHeader: React.FC<CompanyTileHeaderProps> = ({ company }) => {
  const hasPending = company.pendingRequests > 0;
  const hasRequesterInfo = hasPending && (company.lastRequesterName || company.lastRequesterEmail);

  // Graceful fallback for display name
  const displayName = company.lastRequesterName ||
                       company.lastRequesterEmail?.split('@')[0] ||
                       'Unknown User';

  return (
    <div className="flex flex-col gap-3 pb-4 border-b border-slate-700/50">
      {/* Top Row: Company Info + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Company Icon */}
          <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <svg
              className="w-6 h-6 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>

          {/* Company Info */}
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-white truncate drop-shadow-md">
              {company.name}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {company.domain}
            </p>
          </div>
        </div>

        {/* Status Dot (yellow pulse if pending approvals) */}
        {hasPending && (
          <div
            className="w-3 h-3 bg-amber-500 rounded-full animate-pulse flex-shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
            title={`${company.pendingRequests} pending approval${company.pendingRequests === 1 ? '' : 's'}`}
            aria-label={`${company.pendingRequests} pending approvals`}
          />
        )}
      </div>

      {/* Requester Card (only shown when pending requests exist) */}
      {hasRequesterInfo && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 backdrop-blur-sm">
          <div className="flex items-start gap-2">
            {/* User Icon */}
            <svg
              className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>

            {/* Requester Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-100 truncate">
                {displayName}
              </p>
              {company.lastRequesterEmail && (
                <p className="text-xs text-amber-300/80 truncate">
                  {company.lastRequesterEmail}
                </p>
              )}
              <p className="text-xs text-amber-400/60 mt-1">
                Latest pending request
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyTileHeader;
