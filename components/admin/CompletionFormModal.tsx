/**
 * Completion Form Modal
 *
 * Modal for marking an in-transit load as completed.
 * Collects:
 * - Rack assignment for inventory storage
 * - Actual joints received (defaults to planned quantity)
 * - Optional completion notes
 *
 * On submit, triggers:
 * - Load status update to COMPLETED
 * - Inventory auto-creation from manifest data
 * - Rack occupancy update
 * - Slack notification to customer
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { TruckingLoad, Company } from '../../types';

interface Rack {
  id: string;
  name: string;
  area_id: string;
  capacity: number;
  occupied: number;
  available: number;
}

interface CompletionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: TruckingLoad | null;
  company: Company | null;
  onComplete: (data: {
    rackId: string;
    actualJointsReceived: number;
    notes: string;
  }) => void;
  isLoading: boolean;
  backendError?: string | null;
}

const CompletionFormModal: React.FC<CompletionFormModalProps> = ({
  isOpen,
  onClose,
  load,
  company,
  onComplete,
  isLoading,
  backendError,
}) => {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [selectedRackId, setSelectedRackId] = useState('');
  const [actualJointsReceived, setActualJointsReceived] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isLoadingRacks, setIsLoadingRacks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load racks on modal open
  useEffect(() => {
    if (isOpen && load) {
      loadRacks();
      // Pre-fill actual joints with planned quantity
      const loadData = load as any;
      setActualJointsReceived(loadData.total_joints_planned || 0);
      setNotes('');
      setError(null);
    }
  }, [isOpen, load]);

  const loadRacks = async () => {
    setIsLoadingRacks(true);
    setError(null);

    try {
      // Query racks with capacity info
      const { data, error: fetchError } = await supabase
        .from('racks')
        .select('id, name, area_id, capacity, occupied')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      // Calculate available capacity
      const racksWithAvailability = (data || []).map(rack => ({
        ...rack,
        available: rack.capacity - rack.occupied,
      }));

      setRacks(racksWithAvailability);
    } catch (err: any) {
      console.error('[CompletionFormModal] Failed to load racks:', err);
      setError(`Failed to load racks: ${err.message}`);
    } finally {
      setIsLoadingRacks(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!selectedRackId) {
      setError('Please select a storage rack');
      return;
    }

    if (actualJointsReceived <= 0) {
      setError('Actual joints received must be greater than 0');
      return;
    }

    // Check rack capacity
    const selectedRack = racks.find(r => r.id === selectedRackId);
    if (selectedRack && actualJointsReceived > selectedRack.available) {
      setError(
        `Rack ${selectedRack.name} only has ${selectedRack.available} joints available (capacity: ${selectedRack.capacity}, occupied: ${selectedRack.occupied})`
      );
      return;
    }

    // Submit
    onComplete({
      rackId: selectedRackId,
      actualJointsReceived,
      notes: notes.trim(),
    });
  };

  if (!isOpen || !load || !company) return null;

  const loadData = load as any;
  const plannedJoints = loadData.total_joints_planned || 0;
  const discrepancy = actualJointsReceived - plannedJoints;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ zIndex: 10000 }}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 10001 }}
      >
        {/* Modal Content */}
        <div
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 w-full max-w-2xl rounded-3xl border-2 border-purple-500 shadow-2xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <h2 className="text-2xl font-bold text-white">Mark Load Completed</h2>
              <p className="text-sm text-gray-400 mt-1">
                {company.name} - Load #{loadData.sequence_number}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors text-2xl font-bold disabled:opacity-50"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Message - Show backend errors with priority */}
            {(backendError || error) && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                <p className="text-red-300 text-sm font-semibold mb-1">
                  {backendError ? '⚠️ Database Error' : '⚠️ Validation Error'}
                </p>
                <p className="text-red-300 text-sm">
                  {backendError || error}
                </p>
              </div>
            )}

            {/* Rack Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Storage Rack <span className="text-red-400">*</span>
              </label>
              {isLoadingRacks ? (
                <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
                  Loading racks...
                </div>
              ) : racks.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
                  No racks available
                </div>
              ) : (
                <select
                  value={selectedRackId}
                  onChange={(e) => setSelectedRackId(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  required
                >
                  <option value="">Select a rack...</option>
                  {racks.map(rack => (
                    <option key={rack.id} value={rack.id} disabled={rack.available <= 0}>
                      {rack.name} - {rack.available} joints available ({rack.occupied}/{rack.capacity} used)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Actual Joints Received */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Actual Joints Received <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={actualJointsReceived}
                onChange={(e) => setActualJointsReceived(parseInt(e.target.value) || 0)}
                disabled={isLoading}
                min="1"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                required
              />
              <div className="mt-2 text-sm">
                <p className="text-gray-400">
                  Planned: <span className="text-white font-medium">{plannedJoints} joints</span>
                </p>
                {discrepancy !== 0 && (
                  <p className={`font-semibold ${discrepancy > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                    {discrepancy > 0 ? '+' : ''}{discrepancy} joints difference ({discrepancy > 0 ? 'over' : 'under'} estimate)
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Completion Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
                rows={3}
                placeholder="Any notes about the delivery or inventory..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isLoadingRacks}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Marking Completed...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark Completed
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default CompletionFormModal;
