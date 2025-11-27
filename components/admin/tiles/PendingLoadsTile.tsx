/**
 * Pending Loads Tile
 *
 * Displays list of trucking loads awaiting admin approval (status = NEW).
 * Shows after-hours surcharge indicator, document count, and AI summary.
 * Clicking a load opens the LoadDetailModal for review and approval.
 */

import React, { useState } from 'react';
import { usePendingLoads, calculateSurcharge } from '../../../hooks/useTruckingLoadQueries';
import { formatDate } from '../../../utils/dateUtils';
import LoadDetailModal from '../LoadDetailModal';
import GlassCard from '../../ui/GlassCard';
import GlassButton from '../../ui/GlassButton';

const PendingLoadsTile: React.FC = () => {
  const { data: loads = [], isLoading, error, refetch } = usePendingLoads();
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <GlassCard className="p-6 border-slate-700/50 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">Pending Loads</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-6 border-red-900/50 shadow-xl bg-red-950/20">
        <h2 className="text-2xl font-bold text-white mb-4">Pending Loads</h2>
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
          <p className="text-red-400 mb-2">Failed to load pending loads</p>
          <p className="text-red-300 text-sm mb-3">{error.message}</p>
          <GlassButton
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-800/80 hover:bg-red-700/80 text-white rounded-lg text-sm"
            variant="primary"
          >
            Retry
          </GlassButton>
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard className="p-6 border-slate-700/50 shadow-xl h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-2xl font-bold text-white">Pending Loads</h2>
          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm font-semibold border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            {loads.length} awaiting approval
          </span>
        </div>

        {loads.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex-1 flex flex-col justify-center">
            <div className="text-6xl mb-4 opacity-50">✓</div>
            <p className="text-lg font-semibold mb-2">All caught up!</p>
            <p className="text-sm">No pending loads awaiting approval</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {loads.map(load => {
              const surcharge = calculateSurcharge(load.isAfterHours);

              return (
                <button
                  key={load.loadId}
                  onClick={() => setSelectedLoadId(load.loadId)}
                  className="w-full text-left bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 hover:border-cyan-500/50 rounded-xl p-4 transition-all duration-300 group backdrop-blur-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {load.companyName}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {load.requestReferenceId} - Load #{load.sequenceNumber}
                      </p>
                    </div>
                    {load.isAfterHours && (
                      <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 text-xs font-semibold whitespace-nowrap">
                        After Hours +${surcharge}
                      </span>
                    )}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-0.5">Scheduled</p>
                      <p className="text-white font-medium">
                        {formatDate(load.scheduledSlotStart, true)}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {new Date(load.scheduledSlotStart).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-0.5">Trucking</p>
                      <p className="text-white font-medium">
                        {load.truckingCompany || 'Not specified'}
                      </p>
                      {load.driverName && (
                        <p className="text-gray-400 text-xs">{load.driverName}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats Footer */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs">
                      <span className="text-gray-500">Joints:</span>
                      <span className="text-white ml-1 font-semibold">
                        {load.totalJointsPlanned || '—'}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">Length:</span>
                      <span className="text-white ml-1 font-semibold">
                        {load.totalLengthFtPlanned
                          ? `${load.totalLengthFtPlanned.toFixed(1)} ft`
                          : '—'}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">Docs:</span>
                      <span className="text-cyan-400 ml-1 font-semibold">
                        {load.documentCount}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Load Detail Modal */}
      {selectedLoadId && (
        <LoadDetailModal
          loadId={selectedLoadId}
          isOpen={!!selectedLoadId}
          onClose={() => setSelectedLoadId(null)}
        />
      )}
    </>
  );
};

export default PendingLoadsTile;
