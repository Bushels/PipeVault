/**
 * Company Tile Stats
 *
 * Displays key metrics in a 2×2 grid.
 *
 * Metrics:
 * - Top-left: Pending (yellow)
 * - Top-right: Approved (green)
 * - Bottom-left: Loads (blue) with NEW badge indicator
 * - Bottom-right: Inventory (cyan)
 */

import React from 'react';
import type { CompanySummary } from '../../../hooks/useCompanyData';

interface CompanyTileStatsProps {
  company: Pick<
    CompanySummary,
    'pendingRequests' | 'approvedRequests' | 'totalLoads' | 'newLoads' | 'inStorageItems'
  >;
}

const CompanyTileStats: React.FC<CompanyTileStatsProps> = ({ company }) => {
  return (
    <div className="grid grid-cols-2 gap-3 py-4">
      {/* Pending Requests */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
          Pending
        </p>
        <p className="text-2xl font-bold text-amber-300 drop-shadow-sm">
          {company.pendingRequests}
        </p>
      </div>

      {/* Approved Requests */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
          Approved
        </p>
        <p className="text-2xl font-bold text-emerald-300 drop-shadow-sm">
          {company.approvedRequests}
        </p>
      </div>

      {/* Total Loads with NEW Badge */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
          Loads
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-blue-300 drop-shadow-sm">
            {company.totalLoads}
          </p>
          {company.newLoads > 0 && (
            <span className="text-sm font-semibold text-orange-300 bg-orange-900/40 px-2 py-0.5 rounded border border-orange-700/50 shadow-[0_0_5px_rgba(249,115,22,0.2)]">
              {company.newLoads} new
            </span>
          )}
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/70 transition-colors">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
          Inventory
        </p>
        <p className="text-2xl font-bold text-cyan-300 drop-shadow-sm">
          {company.inStorageItems}
        </p>
      </div>
    </div>
  );
};

export default CompanyTileStats;
