/**
 * In Transit Tile
 *
 * Displays list of loads currently in transit (status = IN_TRANSIT).
 * Shows ETA, driver contact info, and expected quantity.
 * Clicking a load opens the LoadDetailModal with "Mark Completed" action.
 */

import React, { useState } from 'react';
import { useInTransitLoads, calculateSurcharge } from '../../../hooks/useTruckingLoadQueries';
import { formatDate } from '../../../utils/dateUtils';
import LoadDetailModal from '../LoadDetailModal';
import GlassCard from '../../ui/GlassCard';
import GlassButton from '../../ui/GlassButton';

const InTransitTile: React.FC = () => {
  const { data: loads = [], isLoading, error, refetch } = useInTransitLoads();
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <GlassCard className="p-6 border-slate-700/50 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">In Transit</h2>
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
        <h2 className="text-2xl font-bold text-white mb-4">In Transit</h2>
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
          <p className="text-red-400 mb-2">Failed to load in-transit loads</p>
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
          <h2 className="text-2xl font-bold text-white">In Transit</h2>
          <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm font-semibold border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
            {loads.length} en route
          </span>
        </div>

        {loads.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex-1 flex flex-col justify-center">
            <div className="text-6xl mb-4 opacity-50">🚛</div>
            <p className="text-lg font-semibold mb-2">No trucks on the road</p>
            <p className="text-sm">All deliveries have arrived or are awaiting departure</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {loads.map(load => {
              const surcharge = calculateSurcharge(load.isAfterHours);

              return (
                <button
                  key={load.loadId}
                  onClick={() => setSelectedLoadId(load.loadId)}
                  className="w-full text-left bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 hover:border-purple-500/50 rounded-xl p-4 transition-all duration-300 group backdrop-blur-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">
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
                      <p className="text-gray-500 text-xs uppercase mb-0.5">ETA</p>
                      <p className="text-white font-medium">
                        {formatDate(load.scheduledSlotEnd, true)}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {new Date(load.scheduledSlotEnd).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-0.5">Driver</p>
                      <p className="text-white font-medium">
                        {load.driverName || 'Not specified'}
                      </p>
                      {load.truckingCompany && (
                        <p className="text-gray-400 text-xs">{load.truckingCompany}</p>
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
                      <span className="text-purple-400 ml-1 font-semibold">
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

export default InTransitTile;
