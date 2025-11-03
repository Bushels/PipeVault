import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  onUploadDocuments?: (request: StorageRequest) => void;
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
  onUploadDocuments,
}) => {
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const [showArchived, setShowArchived] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  // Update scroll button visibility
  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);
      return () => {
        container.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
  }, [visibleRequests]);

  const scrollToNext = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = container.querySelector('div')?.offsetWidth || 600;
    container.scrollBy({ left: cardWidth + 24, behavior: 'smooth' });
  };

  const scrollToPrev = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = container.querySelector('div')?.offsetWidth || 600;
    container.scrollBy({ left: -(cardWidth + 24), behavior: 'smooth' });
  };

  // Show special onboarding card for new users
  if (!sortedRequests.length) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{heading}</h2>
          <p className="text-sm text-gray-400">{description}</p>
        </div>

        {/* New User Onboarding Card */}
        <div className="relative max-w-[600px]">
          {/* 3D Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl blur-lg opacity-30 animate-pulse"></div>

          <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden h-[480px]">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

            {/* Status glow */}
            <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-indigo-500 to-transparent"></div>

            <div className="relative p-6 h-full flex flex-col">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-700/50">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Getting Started</p>
                  <span className="inline-flex items-center px-4 py-1.5 text-xs font-bold border-2 rounded-full shadow-lg bg-indigo-900/30 text-indigo-300 border-indigo-700">
                    STORAGE REQUEST
                  </span>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 flex flex-col justify-center space-y-5 py-4">
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
                        Click the <span className="text-indigo-300 font-semibold">"Request Storage"</span> button to get started with your first pipe storage request.
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
                <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/30 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                    <span>💡</span>
                    <span>Roughneck AI assistant will guide you through every step</span>
                  </div>
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

      {/* Horizontal Scrolling Carousel */}
      <div className="relative -mx-4 px-4">
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {/* Previous Button */}
        {canScrollLeft && (
          <button
            onClick={scrollToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-gray-900/95 hover:bg-gray-800 border-2 border-gray-700 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 group"
            aria-label="Previous request"
          >
            <svg
              className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next Button */}
        {canScrollRight && (
          <button
            onClick={scrollToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-gray-900/95 hover:bg-gray-800 border-2 border-gray-700 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 group"
            aria-label="Next request"
          >
            <svg
              className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto overflow-y-visible pb-6 snap-x snap-mandatory scrollbar-hide"
        >
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
                className="flex-none w-full sm:w-[calc(100%-2rem)] lg:w-[600px] snap-center"
              >
              <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden h-[480px]">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

                {/* Glow effect based on status */}
                <div className={`absolute inset-0 opacity-10 ${
                  status === 'APPROVED' ? 'bg-gradient-to-br from-green-500 to-transparent' :
                  status === 'PENDING' ? 'bg-gradient-to-br from-yellow-500 to-transparent' :
                  status === 'REJECTED' ? 'bg-gradient-to-br from-red-500 to-transparent' :
                  'bg-gradient-to-br from-blue-500 to-transparent'
                }`}></div>

                <div className="relative p-6 h-full flex flex-col overflow-y-auto">
                  {/* Status and Next Steps Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-700/50 flex-shrink-0">
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
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Actions</p>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => onScheduleDelivery(request)}
                                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm px-5 py-2 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                              >
                                🚛 Truck to MPS
                              </Button>
                              {onUploadDocuments && (
                                <Button
                                  onClick={() => onUploadDocuments(request)}
                                  className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-sm px-5 py-2 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                                >
                                  📄 Upload Docs
                                </Button>
                              )}
                            </div>
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
                  <div className="pt-4 flex-shrink-0">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 rounded-xl p-5 border border-gray-700/30 mt-4 flex-shrink-0">
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
    </div>
  );
};

export default RequestSummaryPanel;
