/**
 * Reject Load Modal
 *
 * Modal for rejecting a pending load with rejection reason.
 * Sends Slack notification to customer with the reason.
 *
 * Design:
 * - Required reason text field (min 10 characters)
 * - Shows load summary for context
 * - Confirmation button disabled until valid reason provided
 * - Closes automatically on success
 */

import React, { useState } from 'react';
import { useRejectLoad } from '../../hooks/useLoadApproval';
import type { TruckingLoad, Company } from '../../types';

interface RejectLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: TruckingLoad | null;
  company: Company | null;
}

const RejectLoadModal: React.FC<RejectLoadModalProps> = ({
  isOpen,
  onClose,
  load,
  company,
}) => {
  const [reason, setReason] = useState('');
  const { rejectLoad, isLoading } = useRejectLoad();

  if (!isOpen || !load || !company) return null;

  const loadData = load as any;

  const handleReject = () => {
    if (reason.trim().length < 10) return; // Enforce minimum length

    rejectLoad({
      loadId: load.id,
      companyId: company.id,
      companyName: company.name,
      companyDomain: company.domain,
      sequenceNumber: loadData.sequence_number,
      scheduledSlotStart: loadData.scheduled_slot_start,
      scheduledSlotEnd: loadData.scheduled_slot_end,
      truckingCompany: loadData.trucking_company,
      driverName: loadData.driver_name,
      totalJointsPlanned: loadData.total_joints_planned,
      totalLengthFtPlanned: loadData.total_length_ft_planned,
      reason: reason.trim(),
    }, {
      onSuccess: () => {
        setReason(''); // Clear form
        onClose(); // Close modal
      }
    });
  };

  const isReasonValid = reason.trim().length >= 10;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ zIndex: 10000 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 10001 }}
      >
        <div
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-red-900/20 w-full max-w-lg rounded-2xl border-2 border-red-500 shadow-2xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject Load
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Load #{loadData.sequence_number} - {company.name}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Load Summary */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Load Summary</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs">Scheduled Date</dt>
                  <dd className="text-white">
                    {new Date(loadData.scheduled_slot_start).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs">Scheduled Time</dt>
                  <dd className="text-white">
                    {new Date(loadData.scheduled_slot_start).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs">Trucking Company</dt>
                  <dd className="text-white">{loadData.trucking_company || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs">Driver</dt>
                  <dd className="text-white">{loadData.driver_name || 'Not specified'}</dd>
                </div>
              </dl>
            </div>

            {/* Warning Message */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                <strong className="text-red-400">Important:</strong> Rejecting this load will notify the customer via Slack.
                Please provide a clear reason so they can correct any issues and reschedule.
              </p>
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
                placeholder="e.g., Manifest data incomplete - missing heat numbers for 15 joints"
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {reason.trim().length < 10 ? (
                  <span className="text-red-400">Minimum 10 characters required ({reason.trim().length}/10)</span>
                ) : (
                  <span className="text-green-400">✓ Reason is valid ({reason.trim().length} characters)</span>
                )}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-800 px-6 py-4 bg-gray-900 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!isReasonValid || isLoading}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Confirm Rejection
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RejectLoadModal;
