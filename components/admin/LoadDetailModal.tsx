/**
 * Load Detail Modal
 *
 * Shows comprehensive view of a trucking load for admin review:
 * - Scheduling info (date, time, after-hours flag)
 * - Trucking details (company, driver, contact)
 * - Pickup/delivery locations
 * - AI extracted manifest data with line-items table
 * - Document viewer/download links
 * - Original customer request for comparison
 * - Admin action buttons (Approve, Request Correction, etc.)
 */

import React, { useState } from 'react';
import { useLoadDetails, isAfterHoursSlot, calculateSurcharge } from '../../hooks/useTruckingLoadQueries';
import { useApproveLoad, useMarkLoadInTransit, useMarkLoadCompleted } from '../../hooks/useLoadApproval';
import { formatDate } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';
import RejectLoadModal from './RejectLoadModal';
import RequestCorrectionModal from './RequestCorrectionModal';
import CompletionFormModal from './CompletionFormModal';

interface LoadDetailModalProps {
  loadId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const LoadDetailModal: React.FC<LoadDetailModalProps> = ({
  loadId,
  isOpen,
  onClose,
}) => {
  const { data, isLoading, error } = useLoadDetails(loadId || undefined);

  // Workflow hooks
  const { approveLoad, isLoading: isApproving } = useApproveLoad();
  const { markLoadInTransit, isLoading: isMarkingInTransit } = useMarkLoadInTransit();
  const { markLoadCompleted, isLoading: isMarkingCompleted, error: completionError } = useMarkLoadCompleted();

  // Modal state for reject/correction/completion flows
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Handler functions
  const handleApprove = () => {
    if (!data) return;

    const { load, company, storageRequest } = data;
    const loadData = load as any;

    approveLoad({
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
    }, {
      onSuccess: () => {
        onClose(); // Close modal after successful approval
      }
    });
  };

  const handleMarkInTransit = () => {
    if (!data) return;

    const { load, company } = data;
    const loadData = load as any;

    markLoadInTransit({
      loadId: load.id,
      companyId: company.id,
      companyName: company.name,
      companyDomain: company.domain,
      sequenceNumber: loadData.sequence_number,
      scheduledSlotEnd: loadData.scheduled_slot_end,
      driverName: loadData.driver_name,
      driverPhone: loadData.driver_phone,
      totalJointsPlanned: loadData.total_joints_planned,
    }, {
      onSuccess: () => {
        onClose(); // Close modal after successful transition
      }
    });
  };

  const handleMarkCompleted = (completionData: {
    rackId: string;
    actualJointsReceived: number;
    notes: string;
  }) => {
    if (!data) return;

    const { load, company, storageRequest } = data;
    const loadData = load as any;

    markLoadCompleted({
      loadId: load.id,
      companyId: company.id,
      companyName: company.name,
      companyDomain: company.domain,
      sequenceNumber: loadData.sequence_number,
      requestId: storageRequest.id,
      rackId: completionData.rackId,
      actualJointsReceived: completionData.actualJointsReceived,
      notes: completionData.notes,
    }, {
      onSuccess: () => {
        setShowCompletionModal(false); // Close completion modal
        onClose(); // Close detail modal
      }
    });
  };

  if (!isOpen || !loadId) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 rounded-3xl p-8 max-w-4xl w-full mx-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-lg">Loading load details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 rounded-3xl p-8 max-w-4xl w-full mx-4">
          <p className="text-red-400 text-center mb-4">
            Failed to load details: {error?.message || 'Unknown error'}
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { load, storageRequest, company, documents, parsedManifestItems } = data;
  // Note: load is raw database row with snake_case fields
  const loadData = load as any;
  const isAfterHours = loadData.scheduled_slot_start
    ? isAfterHoursSlot(loadData.scheduled_slot_start)
    : false;
  const surcharge = calculateSurcharge(isAfterHours);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 9999 }}
      >
        {/* Modal Content */}
        <div
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 w-full max-w-6xl rounded-3xl border-2 border-cyan-500 shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">
                Load #{loadData.sequence_number} - {storageRequest.referenceId}
              </p>
              <h2 className="text-2xl font-bold text-white">{company.name}</h2>
              <p className="text-sm text-gray-400">{company.domain}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl font-bold"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Scheduling Section */}
            <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Scheduling
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Date & Time</p>
                  <p className="text-white font-semibold text-lg">
                    {formatDate(loadData.scheduled_slot_start, true)}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {loadData.scheduled_slot_start &&
                      new Date(loadData.scheduled_slot_start).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    {' - '}
                    {loadData.scheduled_slot_end &&
                      new Date(loadData.scheduled_slot_end).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">After Hours</p>
                  <p className="text-white font-semibold text-lg">
                    {isAfterHours ? 'Yes' : 'No'}
                  </p>
                  {isAfterHours && (
                    <p className="text-orange-400 text-sm font-semibold">
                      Surcharge: ${surcharge}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Trucking Details */}
            <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Trucking Details
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs uppercase">Company</dt>
                  <dd className="text-white">{loadData.trucking_company || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase">Driver</dt>
                  <dd className="text-white">{loadData.driver_name || 'Not provided'}</dd>
                </div>
                {loadData.contact_name && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Contact</dt>
                    <dd className="text-white">{loadData.contact_name}</dd>
                  </div>
                )}
                {loadData.contact_phone && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Phone</dt>
                    <dd className="text-white">{loadData.contact_phone}</dd>
                  </div>
                )}
                {loadData.contact_email && (
                  <div className="col-span-2">
                    <dt className="text-gray-500 text-xs uppercase">Email</dt>
                    <dd className="text-white break-words">{loadData.contact_email}</dd>
                  </div>
                )}
                {loadData.driver_phone && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Driver Phone</dt>
                    <dd className="text-white">{loadData.driver_phone}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Location Info */}
            <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Locations
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Pickup Location</p>
                  <p className="text-white font-medium">
                    {(loadData.pickup_location as any)?.company || 'Not specified'}
                  </p>
                  {(loadData.pickup_location as any)?.address && (
                    <p className="text-gray-400 text-sm">
                      {(loadData.pickup_location as any).address}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Delivery Location</p>
                  <p className="text-white font-medium">
                    {(loadData.delivery_location as any)?.facility || 'MPS Pipe Storage'}
                  </p>
                  {(loadData.delivery_location as any)?.address && (
                    <p className="text-gray-400 text-sm">
                      {(loadData.delivery_location as any).address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* AI Extracted Manifest Data */}
            <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                AI Extracted Manifest Data
              </h3>

              {/* Summary Totals */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-cyan-900/20 border border-cyan-700 rounded-lg">
                <div>
                  <p className="text-xs text-cyan-400 uppercase">Total Joints</p>
                  <p className="text-2xl font-bold text-white">
                    {loadData.total_joints_planned || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-cyan-400 uppercase">Total Length</p>
                  <p className="text-2xl font-bold text-white">
                    {((loadData.total_length_ft_planned || 0) * 0.3048).toFixed(1)} m
                  </p>
                  <p className="text-sm text-gray-400">
                    ({loadData.total_length_ft_planned?.toFixed(1) || '0.0'} ft)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-cyan-400 uppercase">Total Weight</p>
                  <p className="text-2xl font-bold text-white">
                    {((loadData.total_weight_lbs_planned || 0) * 0.453592).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                  </p>
                  <p className="text-sm text-gray-400">
                    ({(loadData.total_weight_lbs_planned || 0).toLocaleString()} lbs)
                  </p>
                </div>
              </div>

              {/* Documents */}
              {documents.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">
                    Documents ({documents.length})
                  </p>
                  <div className="space-y-2">
                    {documents.map(doc => {
                      // Safety check: Skip documents without a valid storage path
                      if (!doc.storagePath) {
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2 bg-gray-800 rounded-lg opacity-50"
                          >
                            <span className="text-gray-400 text-sm">{doc.fileName}</span>
                            <span className="text-xs text-red-400">File not uploaded</span>
                          </div>
                        );
                      }

                      const publicUrl = supabase.storage
                        .from('documents')
                        .getPublicUrl(doc.storagePath).data.publicUrl;

                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 bg-gray-800 rounded-lg"
                        >
                          <span className="text-white text-sm">{doc.fileName}</span>
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 text-sm underline"
                          >
                            View
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Breakdown Table */}
              {parsedManifestItems.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-xs text-gray-500 uppercase mb-2">Detailed Breakdown</p>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">Serial #</th>
                          <th className="text-left px-3 py-2">Heat #</th>
                          <th className="text-left px-3 py-2">Length (ft)</th>
                          <th className="text-left px-3 py-2">OD</th>
                          <th className="text-left px-3 py-2">Weight (lb/ft)</th>
                          <th className="text-left px-3 py-2">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedManifestItems.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t border-gray-800">
                            <td className="px-3 py-2 text-white">
                              {item.serial_number || '—'}
                            </td>
                            <td className="px-3 py-2 text-white">
                              {item.heat_number || '—'}
                            </td>
                            <td className="px-3 py-2 text-white">
                              {item.tally_length_ft?.toFixed(2) || '—'}
                            </td>
                            <td className="px-3 py-2 text-white">
                              {item.outer_diameter || '—'}
                            </td>
                            <td className="px-3 py-2 text-white">
                              {item.weight_lbs_ft?.toFixed(2) || '—'}
                            </td>
                            <td className="px-3 py-2 text-white">{item.quantity || 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {parsedManifestItems.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">
                  No manifest items extracted (AI processing may not have run)
                </p>
              )}
            </div>

            {/* Original Customer Request (for comparison) */}
            {storageRequest.requestDetails && (
              <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Original Customer Request (For Comparison)
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {(storageRequest.requestDetails as any).totalJoints && (
                    <div>
                      <dt className="text-gray-500 text-xs uppercase">Estimated Joints</dt>
                      <dd className="text-white">
                        {(storageRequest.requestDetails as any).totalJoints}
                      </dd>
                    </div>
                  )}
                  {(storageRequest.requestDetails as any).grade && (
                    <div>
                      <dt className="text-gray-500 text-xs uppercase">Grade</dt>
                      <dd className="text-white">
                        {(storageRequest.requestDetails as any).grade}
                      </dd>
                    </div>
                  )}
                  {(storageRequest.requestDetails as any).connection && (
                    <div>
                      <dt className="text-gray-500 text-xs uppercase">Connection</dt>
                      <dd className="text-white">
                        {(storageRequest.requestDetails as any).connection}
                      </dd>
                    </div>
                  )}
                  {(storageRequest.requestDetails as any).itemType && (
                    <div>
                      <dt className="text-gray-500 text-xs uppercase">Item Type</dt>
                      <dd className="text-white">
                        {(storageRequest.requestDetails as any).itemType}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Footer - Admin Actions */}
          <div className="border-t border-gray-800 px-6 py-4 bg-gray-900">
            <div className="flex items-center justify-between gap-4">
              {/* Close Button */}
              <button
                onClick={onClose}
                disabled={isApproving || isMarkingInTransit}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>

              {/* Conditional Action Buttons Based on Load Status */}
              <div className="flex items-center gap-3">
                {/* NEW: Pending Admin Review - Show Approve/Reject/Correction */}
                {loadData.status === 'NEW' && (
                  <>
                    {/* Request Correction */}
                    <button
                      onClick={() => setShowCorrectionModal(true)}
                      disabled={isApproving}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Request Correction
                    </button>

                    {/* Reject */}
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={isApproving}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject Load
                    </button>

                    {/* Approve */}
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isApproving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve Load
                        </>
                      )}
                    </button>
                  </>
                )}

                {/* APPROVED: Ready for Transit - Show Mark In Transit */}
                {loadData.status === 'APPROVED' && (
                  <button
                    onClick={handleMarkInTransit}
                    disabled={isMarkingInTransit}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isMarkingInTransit ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Marking In Transit...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Mark In Transit
                      </>
                    )}
                  </button>
                )}

                {/* IN_TRANSIT: En Route - Show Receive Load */}
                {loadData.status === 'IN_TRANSIT' && (
                  <button
                    onClick={() => setShowCompletionModal(true)}
                    disabled={isMarkingCompleted}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isMarkingCompleted ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Receiving Load...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Receive Load #{loadData.sequence_number}
                      </>
                    )}
                  </button>
                )}

                {/* COMPLETED or REJECTED: Final States - Show Status */}
                {(loadData.status === 'COMPLETED' || loadData.status === 'REJECTED') && (
                  <div className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 border ${
                    loadData.status === 'COMPLETED'
                      ? 'bg-green-600/20 text-green-300 border-green-500/50'
                      : 'bg-red-600/20 text-red-300 border-red-500/50'
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {loadData.status === 'COMPLETED' ? 'Load Completed' : 'Load Rejected'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Load Modal */}
      <RejectLoadModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        load={data?.load || null}
        company={data?.company || null}
      />

      {/* Request Correction Modal */}
      <RequestCorrectionModal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        load={data?.load || null}
        company={data?.company || null}
      />

      {/* Completion Form Modal */}
      <CompletionFormModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        load={data?.load || null}
        company={data?.company || null}
        onComplete={handleMarkCompleted}
        isLoading={isMarkingCompleted}
        backendError={completionError?.message || null}
      />
    </>
  );
};

export default LoadDetailModal;
