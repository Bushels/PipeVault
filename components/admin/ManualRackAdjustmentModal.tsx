/**
 * Manual Rack Adjustment Modal
 *
 * Allows admins to manually adjust rack occupancy for physical yard management.
 * Use cases:
 * - Pipe physically moved between racks
 * - Manual corrections for data discrepancies
 * - Emergency adjustments for capacity management
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Rack } from '../../types';
import Button from '../ui/Button';

interface ManualRackAdjustmentModalProps {
  rack: Rack | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ManualRackAdjustmentModal: React.FC<ManualRackAdjustmentModalProps> = ({
  rack,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [occupied, setOccupied] = useState<number>(0);
  const [occupiedMeters, setOccupiedMeters] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form when rack changes
  useEffect(() => {
    if (rack) {
      setOccupied(rack.occupied);
      setOccupiedMeters(rack.occupiedMeters || 0);
      setReason('');
      setErrorMessage(null);
    }
  }, [rack]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rack) return;

    // Validation
    if (occupied < 0 || occupied > rack.capacity) {
      setErrorMessage(`Occupied must be between 0 and ${rack.capacity}`);
      return;
    }

    if (occupiedMeters < 0 || occupiedMeters > rack.capacityMeters) {
      setErrorMessage(`Occupied meters must be between 0 and ${rack.capacityMeters.toFixed(1)}`);
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      setErrorMessage('Reason must be at least 10 characters (for audit trail)');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Call secure database function (handles update + audit logging atomically)
      const { data, error } = await supabase.rpc('manually_adjust_rack_occupancy', {
        p_rack_id: rack.id,
        p_new_joints: occupied,
        p_new_meters: occupiedMeters,
        p_reason: reason.trim(),
      });

      if (error) throw error;

      console.log('✅ Rack adjusted successfully:', data);

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('❌ Failed to adjust rack occupancy:', error);

      // Parse database error messages for user-friendly display
      let errorMsg = error.message || 'Failed to update rack. Please try again.';

      // Check for specific error patterns
      if (errorMsg.includes('Unauthorized')) {
        errorMsg = 'You do not have permission to adjust rack occupancy.';
      } else if (errorMsg.includes('exceed rack capacity')) {
        errorMsg = errorMsg.split('[P0001]:')[1]?.trim() || errorMsg;
      } else if (errorMsg.includes('at least 10 characters')) {
        errorMsg = 'Reason must be at least 10 characters for audit trail.';
      }

      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !rack) return null;

  const deltaJoints = occupied - rack.occupied;
  const deltaMeters = occupiedMeters - (rack.occupiedMeters || 0);
  const utilizationPercent = rack.capacity > 0 ? (occupied / rack.capacity * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-gray-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Adjust Rack: {rack.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current State */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs uppercase text-gray-400 mb-2">Current State</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Occupied Joints</p>
              <p className="text-white font-semibold">{rack.occupied} / {rack.capacity}</p>
            </div>
            <div>
              <p className="text-gray-400">Occupied Meters</p>
              <p className="text-white font-semibold">
                {rack.occupiedMeters?.toFixed(1) || '0.0'} / {rack.capacityMeters.toFixed(1)} m
              </p>
            </div>
          </div>
        </div>

        {/* Adjustment Form */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              New Occupied Joints
            </label>
            <input
              type="number"
              min="0"
              max={rack.capacity}
              value={occupied}
              onChange={(e) => setOccupied(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Max capacity: {rack.capacity} joints
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              New Occupied Meters
            </label>
            <input
              type="number"
              min="0"
              max={rack.capacityMeters}
              step="0.1"
              value={occupiedMeters}
              onChange={(e) => setOccupiedMeters(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Max capacity: {rack.capacityMeters.toFixed(1)} meters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Reason for Adjustment <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              placeholder="e.g., Pipe physically moved to Rack B-3 for better organization"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Minimum 10 characters for audit trail
              {reason.trim().length > 0 && (
                <span className={reason.trim().length >= 10 ? 'text-green-400' : 'text-orange-400'}>
                  {' '}({reason.trim().length}/10)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Change Summary */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <p className="text-xs uppercase text-blue-400 mb-2">Change Summary</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Joints Change:</span>
              <span className={deltaJoints >= 0 ? 'text-green-400' : 'text-red-400'}>
                {deltaJoints >= 0 ? '+' : ''}{deltaJoints} joints
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Meters Change:</span>
              <span className={deltaMeters >= 0 ? 'text-green-400' : 'text-red-400'}>
                {deltaMeters >= 0 ? '+' : ''}{deltaMeters.toFixed(1)} m
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-blue-700">
              <span className="text-gray-400">New Utilization:</span>
              <span className="text-white font-semibold">{utilizationPercent}%</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !reason.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Updating...' : 'Update Rack'}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
};

export default ManualRackAdjustmentModal;
