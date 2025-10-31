import React, { useEffect, useMemo, useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import type { StorageRequest } from '../types';
import { calculateDaysBetween, formatDate } from '../utils/dateUtils';

interface RequestSummaryPanelProps {
  heading?: string;
  description?: string;
  requests: StorageRequest[];
  currentUserEmail?: string;
  onArchiveRequest?: (request: StorageRequest, shouldArchive: boolean) => void | Promise<void>;
  archivingRequestId?: string | null;
  onScheduleDelivery?: (request: StorageRequest) => void;
}

type StatusBadge = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'DRAFT';

const statusStyles: Record<StatusBadge, string> = {
  PENDING: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
  APPROVED: 'bg-green-900/30 text-green-300 border-green-700',
  REJECTED: 'bg-red-900/30 text-red-300 border-red-700',
  COMPLETED: 'bg-blue-900/30 text-blue-300 border-blue-700',
  DRAFT: 'bg-gray-800 text-gray-300 border-gray-700',
};

const RequestSummaryPanel: React.FC<RequestSummaryPanelProps> = ({
  heading = 'Project Summary',
  description = 'Latest status for your stored pipe.',
  requests,
  currentUserEmail,
  onArchiveRequest,
  archivingRequestId,
  onScheduleDelivery,
}) => {
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const [showArchived, setShowArchived] = useState(false);

  const normalizedRequests = useMemo(() => {
    if (!currentUserEmail) return requests;
    const emailLower = currentUserEmail.trim().toLowerCase();
    const filtered = requests.filter((request) => (request.userId ?? '').trim().toLowerCase() === emailLower);
    return filtered.length ? filtered : requests;
  }, [requests, currentUserEmail]);

  const sortedRequests = useMemo(() => {
    return [...normalizedRequests].sort((a, b) => {
      const dateA = a.createdAt ? Date.parse(a.createdAt) : a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const dateB = b.createdAt ? Date.parse(b.createdAt) : b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return dateB - dateA;
    });
  }, [normalizedRequests]);

  const archivedCount = useMemo(
    () => sortedRequests.filter((request) => Boolean(request.archivedAt)).length,
    [sortedRequests]
  );

  const visibleRequests = useMemo(
    () => sortedRequests.filter((request) => (showArchived ? true : !request.archivedAt)),
    [sortedRequests, showArchived]
  );

  useEffect(() => {
    if (archivedCount === 0 && showArchived) {
      setShowArchived(false);
    }
  }, [archivedCount, showArchived]);

  // Show special onboarding card for new users
  if (!sortedRequests.length) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{heading}</h2>
          <p className="text-sm text-gray-400">{description}</p>
        </div>

        {/* New User Onboarding Card */}
        <div className="relative">
          {/* 3D Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl blur-lg opacity-30 animate-pulse"></div>

          <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

            {/* Status glow */}
            <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-indigo-500 to-transparent"></div>

            <div className="relative p-6 space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-700/50">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Getting Started</p>
                  <span className="inline-flex items-center px-4 py-1.5 text-xs font-bold border-2 rounded-full shadow-lg bg-indigo-900/30 text-indigo-300 border-indigo-700">
                    STORAGE REQUEST
                  </span>
                </div>
              </div>

              {/* Welcome Message */}
              <div className="bg-gradient-to-r from-indigo-600/10 to-purple-600/10 border border-indigo-500/20 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-indigo-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Welcome to PipeVault!</h3>
                    <p className="text-sm text-gray-300">
                      Let's get started with your first pipe storage request. Fill in the details below or use the <span className="text-indigo-300 font-semibold">"New Storage"</span> button below to launch our guided wizard with AI assistance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Active Requests</p>
                  <p className="text-2xl font-bold text-white">0</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Ready to Start</p>
                  <p className="text-2xl font-bold text-green-300">✓</p>
                </div>
              </div>

              {/* Call to Action */}
              <div className="bg-gray-800/20 rounded-lg p-5 border border-gray-700/30 text-center">
                <p className="text-sm text-gray-300 mb-4 flex items-center justify-center gap-2">
                  <span>👇</span>
                  <span>Click <span className="text-indigo-300 font-bold">"New Storage"</span> below to begin your first request</span>
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <span>💡</span>
                  <span>Tip: Our Roughneck AI assistant will guide you through every step</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!visibleRequests.length) {
    return (
      <Card className="p-6 bg-gray-900/70 border border-gray-700 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">{heading}</h2>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
        <p className="text-sm text-gray-400">
          All requests are archived. Restore a project to bring it back into your active dashboard.
        </p>
        {archivedCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => setShowArchived(true)}
            className="self-start px-3 py-1 text-xs sm:text-sm"
          >
            Show Archived Requests ({archivedCount})
          </Button>
        )}
      </Card>
    );
  }

  const statusCounts = sortedRequests.reduce<Record<StatusBadge, number>>((acc, req) => {
    const key = (req.status || 'DRAFT') as StatusBadge;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, { PENDING: 0, APPROVED: 0, REJECTED: 0, COMPLETED: 0, DRAFT: 0 });

  return (
    <div className="space-y-3">
      {heading && (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{heading}</h2>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
            {visibleRequests.length > 1 && (
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Swipe to view {visibleRequests.length} requests
              </span>
            )}
            {archivedCount > 0 && (
              <Button
                variant="secondary"
                onClick={() => setShowArchived((prev) => !prev)}
                className="px-3 py-1 text-xs sm:text-sm"
              >
                {showArchived ? 'Hide Archived' : `Show Archived (${archivedCount})`}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {visibleRequests.map((request, index) => {
          const status = (request.status ?? 'PENDING') as StatusBadge;
          const badgeStyle = statusStyles[status] ?? statusStyles.PENDING;
          const requestDetails = request.requestDetails;
          const storageStartDate = requestDetails?.storageStartDate ?? null;
          const storageEndDate = requestDetails?.storageEndDate ?? null;
          const daysRemaining = storageEndDate
            ? calculateDaysBetween(nowIso, storageEndDate)
            : null;
          const daysUntilDropoff = storageStartDate
            ? calculateDaysBetween(nowIso, storageStartDate)
            : null;
          const referenceId = request.referenceId;

          const handleExtensionRequest = () => {
            if (!referenceId) return;
            const subject = encodeURIComponent(`PipeVault Storage Extension Request (${referenceId})`);
            const body = encodeURIComponent(
              [
                `Hello MPS Team,`,
                '',
                `I would like to discuss extending storage for project reference ${referenceId}.`,
                '',
                'Current status/details:',
                `- Status: ${status}`,
                requestDetails?.storageEndDate ? `- Current end date: ${requestDetails.storageEndDate}` : '',
                '',
                'Please let me know next steps.',
                '',
                'Thank you,',
              ].filter(Boolean).join('\n')
            );
            window.location.href = `mailto:pipevault@mpsgroup.ca?subject=${subject}&body=${body}`;
          };

          const isProcessingArchive = archivingRequestId === request.id;

          return (
            <div
              key={request.id}
              className="relative"
            >
              <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

                {/* Glow effect based on status */}
                <div className={`absolute inset-0 opacity-10 ${
                  status === 'APPROVED' ? 'bg-gradient-to-br from-green-500 to-transparent' :
                  status === 'PENDING' ? 'bg-gradient-to-br from-yellow-500 to-transparent' :
                  status === 'REJECTED' ? 'bg-gradient-to-br from-red-500 to-transparent' :
                  'bg-gradient-to-br from-blue-500 to-transparent'
                }`}></div>

                <div className="relative p-6 space-y-5">
                  {/* Status and Next Steps Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-700/50">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Current Status</p>
                        <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold border-2 rounded-full shadow-lg ${badgeStyle}`}>
                          {status}
                        </span>
                      </div>
                      {status === 'APPROVED' && onScheduleDelivery && (
                        <>
                          <div className="hidden sm:flex items-center">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Next Step</p>
                            <Button
                              onClick={() => onScheduleDelivery(request)}
                              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm px-5 py-2 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                            >
                              🚛 Truck to MPS
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                    {onArchiveRequest && (
                      <Button
                        variant="secondary"
                        onClick={() => onArchiveRequest(request, !request.archivedAt)}
                        disabled={isProcessingArchive}
                        className="px-4 py-2 text-xs font-semibold bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600 rounded-lg transition-all"
                      >
                        {isProcessingArchive ? 'Saving...' : request.archivedAt ? '↻ Restore' : '📦 Archive'}
                      </Button>
                    )}
                  </div>

                  {/* Reference ID and Request Info */}
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      Request {index + 1} of {visibleRequests.length}
                    </p>
                    <h3 className="text-2xl font-bold text-white mt-2 tracking-tight">{referenceId}</h3>
                    {request.archivedAt && (
                      <p className="text-xs text-yellow-400/80 mt-2 flex items-center gap-1">
                        <span>📦</span> Archived on {formatDate(request.archivedAt)}
                      </p>
                    )}
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 rounded-xl p-5 border border-gray-700/30">
                    <div className="space-y-4">
                      {request.assignedLocation && (
                        <div className="bg-gray-800/50 rounded-lg p-3 border border-green-500/20">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Storage Location</p>
                          <p className="text-base text-green-300 font-bold flex items-center gap-2">
                            <span>📍</span> {request.assignedLocation}
                          </p>
                        </div>
                      )}
                      {storageStartDate && (
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Storage Start</p>
                          <p className="text-sm text-gray-100 font-semibold">
                            {formatDate(storageStartDate)}
                          </p>
                          {daysUntilDropoff !== null && daysUntilDropoff > 0 && (
                            <p className="text-xs text-blue-300 mt-1 flex items-center gap-1">
                              <span>⏰</span> {daysUntilDropoff} {daysUntilDropoff === 1 ? 'day' : 'days'} until dropoff
                            </p>
                          )}
                        </div>
                      )}
                      {storageEndDate && (
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Storage End</p>
                          <p className="text-sm text-gray-100 font-semibold">
                            {formatDate(storageEndDate)}
                          </p>
                          {daysRemaining !== null && (
                            <p className={`text-xs mt-1 flex items-center gap-1 ${daysRemaining < 0 ? 'text-red-300' : 'text-yellow-300'}`}>
                              <span>{daysRemaining < 0 ? '⚠️' : '⏳'}</span>
                              {Math.abs(daysRemaining)} {Math.abs(daysRemaining) === 1 ? 'day' : 'days'} {daysRemaining < 0 ? 'overdue' : 'remaining'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {requestDetails?.itemType && (
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Item Type</p>
                          <p className="text-sm text-gray-100 font-semibold">{requestDetails.itemType}</p>
                        </div>
                      )}
                      {requestDetails?.grade && (
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Grade & Connection</p>
                          <p className="text-sm text-gray-100 font-semibold">
                            {requestDetails.grade} - {requestDetails.connection || 'N/A'}
                            {requestDetails.threadType && ` ${requestDetails.threadType}`}
                          </p>
                        </div>
                      )}
                      {requestDetails?.totalJoints && (
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Quantity</p>
                          <p className="text-lg text-white font-bold">
                            {(requestDetails.totalJoints * requestDetails.avgJointLength).toFixed(1)}m
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {requestDetails.totalJoints} {requestDetails.totalJoints === 1 ? 'joint' : 'joints'} @ {requestDetails.avgJointLength}m avg length
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RequestSummaryPanel;
