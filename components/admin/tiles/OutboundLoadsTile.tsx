/**
 * Outbound Loads Tile
 *
 * Displays list of outbound loads (pickup requests from customer).
 * Shows destination (LSD, Well Name, UWI), pickup time, and inventory to be loaded.
 * Clicking a load opens modal to select inventory and mark as picked up.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { formatDate } from '../../../utils/dateUtils';
import type { TruckingLoad } from '../../../types';
import MarkPickedUpModal from '../MarkPickedUpModal';
import GlassCard from '../../ui/GlassCard';
import GlassButton from '../../ui/GlassButton';

interface OutboundLoadWithDetails extends TruckingLoad {
  companyName: string;
  requestReferenceId: string;
  contactName?: string;
  contactPhone?: string;
}

const OutboundLoadsTile: React.FC = () => {
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  // Query for outbound loads with APPROVED status (waiting for pickup)
  const { data: loads = [], isLoading, error, refetch } = useQuery({
    queryKey: ['outbound-loads', 'approved'],
    queryFn: async () => {
      const { data: loadsData, error: loadsError } = await supabase
        .from('trucking_loads')
        .select(`
          *,
          storage_requests!inner (
            id,
            reference_id,
            company_id,
            companies!inner (
              name
            )
          )
        `)
        .eq('direction', 'OUTBOUND')
        .eq('status', 'APPROVED')
        .order('scheduled_slot_start', { ascending: true });

      if (loadsError) throw loadsError;

      // Transform data to include company details
      const enrichedLoads: OutboundLoadWithDetails[] = (loadsData || []).map(load => ({
        ...load,
        companyName: (load.storage_requests as any).companies.name,
        requestReferenceId: (load.storage_requests as any).reference_id,
      }));

      return enrichedLoads;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <GlassCard className="p-6 border-slate-700/50 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">Outbound Pickups</h2>
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
        <h2 className="text-2xl font-bold text-white mb-4">Outbound Pickups</h2>
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
          <p className="text-red-400 mb-2">Failed to load outbound pickups</p>
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
          <h2 className="text-2xl font-bold text-white">Outbound Pickups</h2>
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm font-semibold border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
            {loads.length} scheduled
          </span>
        </div>

        {loads.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex-1 flex flex-col justify-center">
            <div className="text-6xl mb-4 opacity-50">📤</div>
            <p className="text-lg font-semibold mb-2">No pickups scheduled</p>
            <p className="text-sm">Customers haven't requested any outbound shipments yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {loads.map(load => {
              // Format destination for display
              const destinationParts: string[] = [];
              if (load.destinationWellName) destinationParts.push(load.destinationWellName);
              if (load.destinationUwi) destinationParts.push(load.destinationUwi);
              const destinationDisplay = destinationParts.join(' • ');

              return (
                <button
                  key={load.id}
                  onClick={() => setSelectedLoadId(load.id)}
                  className="w-full text-left bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 hover:border-blue-500/50 rounded-xl p-4 transition-all duration-300 group backdrop-blur-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {load.companyName}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {load.requestReferenceId} - Pickup #{load.sequenceNumber}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-semibold whitespace-nowrap">
                      {load.shippingMethod === 'CUSTOMER_ARRANGED' ? '🚚 Customer Arranged' : '💰 MPS Quote'}
                    </span>
                  </div>

                  {/* Destination */}
                  <div className="mt-2 mb-3 p-2 bg-slate-700/30 rounded-lg border border-slate-600/30">
                    <p className="text-slate-400 text-xs uppercase mb-1">Destination</p>
                    <p className="text-white font-medium text-sm">
                      📍 {load.destinationLsd}
                    </p>
                    {destinationDisplay && (
                      <p className="text-slate-300 text-xs mt-0.5">
                        {destinationDisplay}
                      </p>
                    )}
                  </div>

                  {/* Pickup Time */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-0.5">Pickup Time</p>
                      <p className="text-white font-medium">
                        {load.scheduledSlotStart && formatDate(load.scheduledSlotStart, true)}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {load.scheduledSlotStart && new Date(load.scheduledSlotStart).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {' - '}
                        {load.scheduledSlotEnd && new Date(load.scheduledSlotEnd).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-0.5">Status</p>
                      <p className="text-blue-400 font-medium">
                        Awaiting Pickup
                      </p>
                      <p className="text-gray-400 text-xs">
                        Click to select inventory
                      </p>
                    </div>
                  </div>

                  {/* Notes (if any) */}
                  {load.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-gray-500 text-xs uppercase mb-1">Special Instructions</p>
                      <p className="text-gray-300 text-xs line-clamp-2">{load.notes}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Mark Picked Up Modal */}
      {selectedLoadId && (
        <MarkPickedUpModal
          load={loads.find(l => l.id === selectedLoadId) || null}
          request={loads.find(l => l.id === selectedLoadId)?.storage_requests as any || null}
          isOpen={!!selectedLoadId}
          onClose={() => setSelectedLoadId(null)}
          onSuccess={() => {
            refetch(); // Refresh the outbound loads list
            setSelectedLoadId(null);
          }}
        />
      )}
    </>
  );
};

export default OutboundLoadsTile;
