/**
 * Rack Assignment Modal
 *
 * Modal dialog for selecting rack assignments during Quick Approve workflow.
 * Provides capacity validation and visual feedback for rack selection.
 *
 * Features:
 * - Displays storage request details for context
 * - Shows all available racks with capacity information
 * - Multi-rack selection support with capacity validation
 * - Automatic suggestions based on available capacity
 * - Visual feedback for selected, suggested, and full racks
 *
 * Usage:
 * ```tsx
 * <RackAssignmentModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onApprove={(rackIds, notes) => handleApprove(rackIds, notes)}
 *   request={pendingRequest}
 *   companyName={companyName}
 *   yards={yards}
 *   isLoading={approveRequest.isPending}
 * />
 * ```
 */

import React, { useState, useMemo, useEffect } from 'react';
import type { StorageRequest, Yard, Rack } from '../../../types';
import Button from '../../ui/Button';

interface RackAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (rackIds: string[], notes?: string) => void;
  request: StorageRequest | null;
  companyName: string;
  yards: Yard[];
  isLoading?: boolean;
}

interface RackWithMetadata extends Rack {
  yardName: string;
  areaName: string;
  available: number;  // capacity - occupied
}

const RackAssignmentModal: React.FC<RackAssignmentModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  request,
  companyName,
  yards,
  isLoading = false,
}) => {
  const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Calculate required joints from request
  const requiredJoints = useMemo(() => {
    if (!request?.requestDetails?.totalJoints) return 0;
    return request.requestDetails.totalJoints;
  }, [request]);

  // Flatten all racks with metadata
  const allRacks = useMemo<RackWithMetadata[]>(() => {
    return yards.flatMap(yard =>
      yard.areas.flatMap(area =>
        area.racks.map(rack => ({
          ...rack,
          yardName: yard.name,
          areaName: area.name,
          available: rack.capacity - rack.occupied,
        }))
      )
    );
  }, [yards]);

  // Calculate suggested racks based on available capacity
  const suggestedRacks = useMemo(() => {
    const sortedRacks = [...allRacks]
      .filter(r => r.available > 0)
      .sort((a, b) => b.available - a.available);

    const selected: string[] = [];
    let remaining = requiredJoints;

    for (const rack of sortedRacks) {
      if (remaining <= 0) break;
      selected.push(rack.id);
      remaining -= rack.available;
    }

    return selected;
  }, [allRacks, requiredJoints]);

  // Auto-select suggested racks on first render
  useEffect(() => {
    if (isOpen && request && selectedRackIds.length === 0) {
      setSelectedRackIds(suggestedRacks);
    }
  }, [isOpen, request, suggestedRacks]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedRackIds([]);
      setNotes('');
    }
  }, [isOpen]);

  // Calculate total capacity of selected racks
  const selectedCapacity = useMemo(() => {
    return selectedRackIds.reduce((sum, rackId) => {
      const rack = allRacks.find(r => r.id === rackId);
      return sum + (rack?.available ?? 0);
    }, 0);
  }, [selectedRackIds, allRacks]);

  const capacityStatus = useMemo(() => {
    if (selectedCapacity === 0) return { valid: false, message: 'No racks selected' };
    if (selectedCapacity < requiredJoints) {
      return {
        valid: false,
        message: `Insufficient capacity: ${selectedCapacity} available, ${requiredJoints} required`,
      };
    }
    return {
      valid: true,
      message: `Sufficient capacity: ${selectedCapacity} available for ${requiredJoints} joints`,
    };
  }, [selectedCapacity, requiredJoints]);

  const handleToggleRack = (rackId: string) => {
    setSelectedRackIds(prev =>
      prev.includes(rackId) ? prev.filter(id => id !== rackId) : [...prev, rackId]
    );
  };

  const handleApprove = () => {
    if (capacityStatus.valid && selectedRackIds.length > 0) {
      onApprove(selectedRackIds, notes || undefined);
    }
  };

  if (!isOpen || !request) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-cyan-600/10 to-blue-600/10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Quick Approve Request</h2>
                <p className="text-gray-400 mt-1">
                  {companyName} - Request {request.referenceId}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-16rem)]">
            {/* Request Summary */}
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Request Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Required Joints:</span>
                  <span className="ml-2 text-white font-semibold">{requiredJoints}</span>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                    PENDING
                  </span>
                </div>
                {request.requestDetails?.pipeType && (
                  <div>
                    <span className="text-gray-400">Pipe Type:</span>
                    <span className="ml-2 text-white">{request.requestDetails.pipeType}</span>
                  </div>
                )}
                {request.requestDetails?.grade && (
                  <div>
                    <span className="text-gray-400">Grade:</span>
                    <span className="ml-2 text-white">{request.requestDetails.grade}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Capacity Status */}
            <div
              className={`mb-6 p-4 rounded-lg border ${
                capacityStatus.valid
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {capacityStatus.valid ? (
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <span
                  className={`text-sm font-medium ${
                    capacityStatus.valid ? 'text-green-300' : 'text-red-300'
                  }`}
                >
                  {capacityStatus.message}
                </span>
              </div>
            </div>

            {/* Rack Selection */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Select Storage Racks ({selectedRackIds.length} selected)
              </h3>

              {yards.map(yard => (
                <div key={yard.id} className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-3">{yard.name}</h4>

                  {yard.areas.map(area => (
                    <div key={area.id} className="mb-4 pl-4">
                      <h5 className="text-sm font-medium text-gray-300 mb-2">{area.name} Area</h5>

                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {area.racks.map(rack => {
                          const isSelected = selectedRackIds.includes(rack.id);
                          const isSuggested = suggestedRacks.includes(rack.id);
                          const available = rack.capacity - rack.occupied;
                          const utilization = rack.capacity > 0 ? (rack.occupied / rack.capacity) * 100 : 0;
                          const isFull = available === 0;

                          return (
                            <button
                              key={rack.id}
                              onClick={() => !isFull && handleToggleRack(rack.id)}
                              disabled={isFull || isLoading}
                              className={`
                                p-3 rounded-lg border-2 transition-all text-left
                                ${isSelected
                                  ? 'bg-cyan-600/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                                  : isSuggested
                                  ? 'bg-blue-600/10 border-blue-500/50'
                                  : 'bg-gray-800/50 border-gray-700'
                                }
                                ${isFull
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'hover:border-cyan-400 cursor-pointer'
                                }
                                disabled:opacity-40 disabled:cursor-not-allowed
                              `}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-white">{rack.name}</span>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>

                              <div className="text-xs text-gray-400">
                                {rack.allocationMode === 'SLOT' ? (
                                  <span>{available}/{rack.capacity} slots</span>
                                ) : (
                                  <span>{available}/{rack.capacity} joints</span>
                                )}
                              </div>

                              {/* Utilization bar */}
                              <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    utilization > 90 ? 'bg-red-500' : utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${utilization}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Admin Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={isLoading}
                placeholder="Add any internal notes about this approval..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50 flex justify-end gap-3">
            <Button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!capacityStatus.valid || isLoading || selectedRackIds.length === 0}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Approving...
                </span>
              ) : (
                'Approve Request'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RackAssignmentModal;
