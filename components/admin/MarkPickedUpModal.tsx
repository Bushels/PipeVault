/**
 * Mark Picked Up Modal
 *
 * Allows admin to select inventory items for outbound pickup and mark load as picked up (IN_TRANSIT).
 * Calls mark_outbound_load_completed_and_clear_rack() database function atomically.
 *
 * Key features:
 * - Display available inventory (IN_STORAGE) for the company/request
 * - Multi-select inventory items to load
 * - Auto-calculate total joints and meters
 * - Validate actual joints loaded matches selection
 * - Atomic rack occupancy decrement + inventory status update
 * - Error handling with user-friendly messages
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { TruckingLoad, StorageRequest, Inventory } from '../../types';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import InventoryStatusDisplay from './InventoryStatusDisplay';

interface MarkPickedUpModalProps {
  load: TruckingLoad | null;
  request: StorageRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface InventoryWithRack extends Inventory {
  rackName?: string;
}

const MarkPickedUpModal: React.FC<MarkPickedUpModalProps> = ({
  load,
  request,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);
  const [actualJointsLoaded, setActualJointsLoaded] = useState<number>(0);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessState, setShowSuccessState] = useState(false);

  // Query available inventory for this request
  const { data: availableInventory = [], isLoading: isLoadingInventory } = useQuery({
    queryKey: ['inventory', 'available', request?.id],
    queryFn: async () => {
      if (!request) return [];

      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          racks (
            name
          )
        `)
        .eq('company_id', request.companyId)
        .eq('status', 'IN_STORAGE')
        .order('storage_area_id', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform to include rack name
      const enriched: InventoryWithRack[] = (data || []).map(inv => ({
        ...inv,
        rackName: (inv.racks as any)?.name || inv.storage_area_id || 'Unknown',
      }));

      return enriched;
    },
    enabled: isOpen && !!request,
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedInventoryIds([]);
      setActualJointsLoaded(0);
      setCompletionNotes('');
      setErrorMessage(null);
      setShowSuccessState(false);
    }
  }, [isOpen, load?.id]);

  // Calculate totals from selected inventory
  const selectedTotalJoints = availableInventory
    .filter(inv => selectedInventoryIds.includes(inv.id))
    .reduce((sum, inv) => sum + inv.quantity, 0);

  const selectedTotalMeters = availableInventory
    .filter(inv => selectedInventoryIds.includes(inv.id))
    .reduce((sum, inv) => sum + (inv.quantity * inv.length * 0.3048), 0);

  // Auto-set actual joints when selection changes
  useEffect(() => {
    if (selectedTotalJoints > 0) {
      setActualJointsLoaded(selectedTotalJoints);
    }
  }, [selectedTotalJoints]);

  const toggleInventorySelection = (inventoryId: string) => {
    setSelectedInventoryIds(prev =>
      prev.includes(inventoryId)
        ? prev.filter(id => id !== inventoryId)
        : [...prev, inventoryId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!load || !request) return;

    // Validation
    if (selectedInventoryIds.length === 0) {
      setErrorMessage('Please select at least one inventory item to load');
      return;
    }

    if (actualJointsLoaded <= 0) {
      setErrorMessage('Actual joints loaded must be greater than 0');
      return;
    }

    if (actualJointsLoaded !== selectedTotalJoints) {
      setErrorMessage(
        `Quantity mismatch: Selected inventory has ${selectedTotalJoints} joints but you entered ${actualJointsLoaded}. Please adjust your selection or actual quantity.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Call secure database function
      const { data, error } = await supabase.rpc('mark_outbound_load_completed_and_clear_rack', {
        load_id_param: load.id,
        company_id_param: request.companyId,
        request_id_param: request.id,
        inventory_ids_param: selectedInventoryIds,
        actual_joints_param: actualJointsLoaded,
        completion_notes_param: completionNotes.trim() || null,
      });

      if (error) throw error;

      console.log('✅ Load marked as picked up successfully:', data);

      // Show success state with inventory status instead of immediately closing
      setShowSuccessState(true);
    } catch (error: any) {
      console.error('❌ Failed to mark load as picked up:', error);

      // Parse database error messages
      let errorMsg = error.message || 'Failed to mark load as picked up. Please try again.';

      // Check for specific error patterns
      if (errorMsg.includes('Unauthorized')) {
        errorMsg = 'You do not have permission to mark loads as picked up.';
      } else if (errorMsg.includes('Quantity mismatch')) {
        errorMsg = errorMsg.split('[%]:')[1]?.trim() || errorMsg;
      } else if (errorMsg.includes('not IN_STORAGE')) {
        errorMsg = 'One or more selected items are not currently in storage. Please refresh and try again.';
      } else if (errorMsg.includes('insufficient occupancy')) {
        errorMsg = 'Rack occupancy mismatch detected. This indicates a data integrity issue. Please contact support.';
      } else if (errorMsg.includes('not APPROVED')) {
        errorMsg = 'This load is not in APPROVED status. Only approved loads can be marked as picked up.';
      }

      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !load || !request) return null;

  // Format destination for display
  const destinationParts: string[] = [load.destinationLsd || ''];
  if (load.destinationWellName) destinationParts.push(load.destinationWellName);
  if (load.destinationUwi) destinationParts.push(`UWI: ${load.destinationUwi}`);
  const destinationDisplay = destinationParts.filter(Boolean).join(' • ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-gray-900 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {showSuccessState ? 'Pickup Completed' : 'Mark as Picked Up'}
            </h2>
            <p className="text-gray-400 text-sm">
              Outbound Load #{load.sequenceNumber} - {request.referenceId}
            </p>
          </div>
          <button
            onClick={() => {
              if (showSuccessState) {
                onSuccess(); // Call onSuccess when closing after success
              }
              onClose();
            }}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success State - Show Inventory Status */}
        {showSuccessState ? (
          <div className="space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div className="text-center">
              <p className="text-lg font-semibold text-white mb-2">Pickup Completed Successfully</p>
              <p className="text-gray-400 text-sm">
                Inventory has been marked as picked up and rack occupancy updated
              </p>
            </div>

            {/* Inventory Status Display */}
            <InventoryStatusDisplay
              companyId={request.companyId}
              companyName={request.companyName || 'Company'}
              showPickedUp={true}
            />

            {/* Action Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                variant="primary"
                className="px-6 py-3"
              >
                Done - Close
              </Button>
            </div>
          </div>
        ) : (
          // Form State - Original form content
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* Destination Info */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-xs uppercase text-gray-400 mb-2">Destination</p>
            <p className="text-white font-medium">📍 {destinationDisplay}</p>
            <p className="text-gray-400 text-sm mt-1">
              Shipping: {load.shippingMethod === 'CUSTOMER_ARRANGED' ? 'Customer Arranged' : 'MPS Quote'}
            </p>
          </div>

          {/* Available Inventory */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Select Inventory to Load</h3>

            {isLoadingInventory ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="lg" />
                <span className="ml-3 text-gray-400">Loading available inventory...</span>
              </div>
            ) : availableInventory.length === 0 ? (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-yellow-200">
                No inventory currently in storage for this customer. The customer may need to deliver pipe before scheduling outbound pickups.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg p-3">
                {availableInventory.map(inv => {
                  const isSelected = selectedInventoryIds.includes(inv.id);
                  return (
                    <label
                      key={inv.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-500/20 border-2 border-blue-500'
                          : 'bg-gray-700/50 border-2 border-transparent hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleInventorySelection(inv.id)}
                        className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">
                            {inv.quantity} joints • {inv.type}
                          </span>
                          <span className="text-gray-400 text-sm">
                            Rack: {inv.rackName}
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          {inv.grade} • {inv.outerDiameter}" OD • {inv.weight} lbs/ft • {inv.length} ft avg
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection Summary */}
          {selectedInventoryIds.length > 0 && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
              <p className="text-xs uppercase text-blue-400 mb-2">Selection Summary</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Selected Items</p>
                  <p className="text-white font-semibold text-lg">{selectedInventoryIds.length}</p>
                </div>
                <div>
                  <p className="text-gray-400">Total Joints</p>
                  <p className="text-white font-semibold text-lg">{selectedTotalJoints}</p>
                </div>
                <div>
                  <p className="text-gray-400">Total Meters</p>
                  <p className="text-white font-semibold text-lg">{selectedTotalMeters.toFixed(1)} m</p>
                </div>
              </div>
            </div>
          )}

          {/* Actual Quantity Loaded */}
          {selectedInventoryIds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Actual Joints Loaded <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={actualJointsLoaded}
                onChange={(e) => setActualJointsLoaded(Number(e.target.value))}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Must match selected inventory total ({selectedTotalJoints} joints)
              </p>
              {actualJointsLoaded !== selectedTotalJoints && actualJointsLoaded > 0 && (
                <p className="text-xs text-orange-400 mt-1">
                  ⚠️ Mismatch: You entered {actualJointsLoaded} but selected {selectedTotalJoints} joints
                </p>
              )}
            </div>
          )}

          {/* Completion Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Completion Notes (Optional)
            </label>
            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="e.g., Loaded by Acme Trucking, Driver John Smith, Truck #42"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <Button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || selectedInventoryIds.length === 0 || actualJointsLoaded !== selectedTotalJoints}
              variant="primary"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                'Mark as Picked Up'
              )}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default MarkPickedUpModal;
