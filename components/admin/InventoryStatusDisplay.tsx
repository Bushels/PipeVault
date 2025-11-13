/**
 * Inventory Status Display
 *
 * Shows remaining inventory in storage vs picked up for a company.
 * Used after outbound pickups to give admin immediate feedback.
 *
 * Displays:
 * - What was just picked up (status='PICKED_UP')
 * - What remains in storage (status='IN_STORAGE')
 * - Grouped by type, grade, size
 * - Rack locations
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Inventory } from '../../types';
import Spinner from '../ui/Spinner';

interface InventoryStatusDisplayProps {
  companyId: string;
  companyName: string;
  showPickedUp?: boolean; // Show recently picked up inventory
}

interface InventoryWithRack extends Inventory {
  rackName?: string;
}

interface InventoryGroup {
  type: string;
  grade: string;
  outerDiameter: number;
  weight: number;
  totalJoints: number;
  totalMeters: number;
  racks: string[];
}

const InventoryStatusDisplay: React.FC<InventoryStatusDisplayProps> = ({
  companyId,
  companyName,
  showPickedUp = true,
}) => {
  // Query inventory in storage
  const { data: inStorageInventory = [], isLoading: isLoadingStorage } = useQuery({
    queryKey: ['inventory', 'in-storage', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          racks (name)
        `)
        .eq('company_id', companyId)
        .eq('status', 'IN_STORAGE')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(inv => ({
        ...inv,
        rackName: (inv.racks as any)?.name || inv.storage_area_id || 'Unknown',
      })) as InventoryWithRack[];
    },
  });

  // Query recently picked up inventory (last 7 days)
  const { data: pickedUpInventory = [], isLoading: isLoadingPickedUp } = useQuery({
    queryKey: ['inventory', 'picked-up', companyId],
    queryFn: async () => {
      if (!showPickedUp) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'PICKED_UP')
        .gte('pickup_timestamp', sevenDaysAgo.toISOString())
        .order('pickup_timestamp', { ascending: false });

      if (error) throw error;

      return data || [];
    },
    enabled: showPickedUp,
  });

  // Group inventory by type, grade, size
  const groupInventory = (inventory: InventoryWithRack[]): InventoryGroup[] => {
    const groups: { [key: string]: InventoryGroup } = {};

    inventory.forEach(inv => {
      const key = `${inv.type}-${inv.grade}-${inv.outerDiameter}-${inv.weight}`;

      if (!groups[key]) {
        groups[key] = {
          type: inv.type,
          grade: inv.grade,
          outerDiameter: inv.outerDiameter,
          weight: inv.weight,
          totalJoints: 0,
          totalMeters: 0,
          racks: [],
        };
      }

      groups[key].totalJoints += inv.quantity;
      groups[key].totalMeters += inv.quantity * inv.length * 0.3048;
      if (inv.rackName && !groups[key].racks.includes(inv.rackName)) {
        groups[key].racks.push(inv.rackName);
      }
    });

    return Object.values(groups).sort((a, b) => b.totalJoints - a.totalJoints);
  };

  const inStorageGroups = groupInventory(inStorageInventory);
  const pickedUpGroups = groupInventory(pickedUpInventory);

  const totalInStorageJoints = inStorageGroups.reduce((sum, g) => sum + g.totalJoints, 0);
  const totalInStorageMeters = inStorageGroups.reduce((sum, g) => sum + g.totalMeters, 0);
  const totalPickedUpJoints = pickedUpGroups.reduce((sum, g) => sum + g.totalJoints, 0);
  const totalPickedUpMeters = pickedUpGroups.reduce((sum, g) => sum + g.totalMeters, 0);

  if (isLoadingStorage || (showPickedUp && isLoadingPickedUp)) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-400">Loading inventory status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Inventory Status</h3>
        <p className="text-gray-400 text-sm">{companyName}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* In Storage */}
        <div className="bg-green-900/20 border border-green-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase text-green-400 font-semibold">In Storage</p>
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{totalInStorageJoints}</span>
              <span className="text-gray-400 text-sm">joints</span>
            </div>
            <div className="text-gray-400 text-sm">
              {totalInStorageMeters.toFixed(1)} meters total
            </div>
            <div className="text-green-400 text-xs mt-2">
              {inStorageGroups.length} pipe {inStorageGroups.length === 1 ? 'spec' : 'specs'}
            </div>
          </div>
        </div>

        {/* Picked Up (if showing) */}
        {showPickedUp && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase text-blue-400 font-semibold">Recently Picked Up</p>
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{totalPickedUpJoints}</span>
                <span className="text-gray-400 text-sm">joints</span>
              </div>
              <div className="text-gray-400 text-sm">
                {totalPickedUpMeters.toFixed(1)} meters total
              </div>
              <div className="text-blue-400 text-xs mt-2">
                Last 7 days
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Breakdown */}
      {inStorageGroups.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">In Storage - Detailed Breakdown</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {inStorageGroups.map((group, idx) => (
              <div
                key={idx}
                className="bg-gray-800/60 border border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {group.type} • {group.grade}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {group.outerDiameter}" OD • {group.weight} lbs/ft
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Racks: {group.racks.join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{group.totalJoints} joints</p>
                    <p className="text-gray-400 text-sm">{group.totalMeters.toFixed(1)} m</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inStorageGroups.length === 0 && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-400 text-lg font-semibold mb-2">No Inventory in Storage</p>
          <p className="text-gray-500 text-sm">
            All pipe has been picked up or no deliveries have been completed yet
          </p>
        </div>
      )}

      {/* Picked Up Breakdown (if showing and exists) */}
      {showPickedUp && pickedUpGroups.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Recently Picked Up</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {pickedUpGroups.map((group, idx) => (
              <div
                key={idx}
                className="bg-gray-800/30 border border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {group.type} • {group.grade}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {group.outerDiameter}" OD • {group.weight} lbs/ft
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">{group.totalJoints} joints</p>
                    <p className="text-gray-400 text-sm">{group.totalMeters.toFixed(1)} m</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryStatusDisplay;
