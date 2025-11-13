import React, { useEffect, useMemo, useState, useRef } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { TruckIcon } from './icons/Icons';
import type { StorageRequest } from '../types';
import { calculateDaysBetween, formatDate } from '../utils/dateUtils';
import {
  getRequestLogisticsSnapshot,
  getStatusBadgeTone,
  type StatusBadgeTone,
} from '../utils/truckingStatus';
import LoadTimelineView from './LoadTimelineView';

interface RequestSummaryPanelProps {
  heading?: string;
  description?: string;
  requests: StorageRequest[];
  currentUserEmail?: string;
  onArchiveRequest?: (request: StorageRequest, shouldArchive: boolean) => void | Promise<void>;
  archivingRequestId?: string | null;
  onScheduleDelivery?: (request: StorageRequest) => void;
  onUploadDocuments?: (request: StorageRequest) => void;
  pendingSubmission?: StorageRequest | null;
}

const badgeThemes: Record<StatusBadgeTone, string> = {
  pending: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
  success: 'bg-green-900/30 text-green-300 border-green-700',
  info: 'bg-blue-900/30 text-blue-300 border-blue-700',
  danger: 'bg-red-900/30 text-red-300 border-red-700',
  neutral: 'bg-gray-800 text-gray-300 border-gray-700',
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
  pendingSubmission,
}) => {
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const [showArchived, setShowArchived] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [expandedLoadTimeline, setExpandedLoadTimeline] = useState<string | null>(null);

  const normalizedRequests = useMemo(() => {
    if (!currentUserEmail) return requests;
    const emailLower = currentUserEmail.trim().toLowerCase();
    const filtered = requests.filter((request) => (request.userId ?? '').trim().toLowerCase() === emailLower);
    return filtered.length ? filtered : requests;
  }, [requests, currentUserEmail]);

  const normalizedRequestsWithPending = useMemo(() => {
    if (!pendingSubmission) return normalizedRequests;
    const exists = normalizedRequests.some((request) => request.id === pendingSubmission.id);
    return exists ? normalizedRequests : [pendingSubmission, ...normalizedRequests];
  }, [normalizedRequests, pendingSubmission]);

  const sortedRequests = useMemo(() => {
    return [...normalizedRequestsWithPending].sort((a, b) => {
      const dateA = a.createdAt ? Date.parse(a.createdAt) : a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const dateB = b.createdAt ? Date.parse(b.createdAt) : b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return dateB - dateA;
    });
  }, [normalizedRequestsWithPending]);

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

  // Wheel scroll handler: Only intercept with Shift key for horizontal scroll
  // This fixes the passive listener preventDefault error and allows normal page scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only intercept if Shift is held down (horizontal scroll intent)
      if (e.shiftKey && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        container.scrollBy({
          left: e.deltaY,
          behavior: 'smooth',
        });
      }
      // Otherwise, let normal vertical scrolling work
    };

    // Add with { passive: false } to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Keyboard navigation for accessibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToNext();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Show special onboarding card or pending confirmation when no requests yet
  if (!normalizedRequests.length) {
    if (pendingSubmission) {
      const submittedAt =
        pendingSubmission.createdAt ||
        pendingSubmission.updatedAt ||
        new Date().toISOString();

      return (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold text-white">{heading}</h2>
            <p className="text-sm text-gray-400">{description}</p>
          </div>

          <div className="relative max-w-[600px]">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 via-amber-500 to-orange-500 rounded-2xl blur-lg opacity-40 animate-pulse" />

            <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-yellow-600/60 shadow-2xl overflow-hidden h-[480px]">
              <div className="absolute inset-0 bg-grid-pattern opacity-5" />
              <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-yellow-500/70 to-transparent" />

              <div className="relative p-6 h-full flex flex-col gap-6">
                <div className="flex items-center justify-between pb-4 border-b border-yellow-600/30">
                  <div>
                    <p className="text-[10px] text-yellow-300 uppercase tracking-widest font-semibold mb-2">
                      Request Submitted
                    </p>
                    <h3 className="text-2xl font-bold text-white">Awaiting Approval</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      We received your details and notified the MPS admin team.
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] uppercase tracking-wider text-gray-400">
                      Reference ID
                    </span>
                    <span className="text-2xl font-bold text-yellow-300">
                      {pendingSubmission.referenceId}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-800/60 rounded-xl border border-gray-700/60 p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 text-yellow-300 flex items-center justify-center text-xl">
                      ⏳
                    </div>
                    <div>
                      <p className="text-white font-semibold">Next Steps</p>
                      <p className="text-sm text-gray-300">
                        An MPS admin reviews every request. You&apos;ll receive email confirmation
                        as soon as it&apos;s approved or if we need any clarifications.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                      <p className="text-[11px] uppercase tracking-widest text-gray-400">
                        Submitted
                      </p>
                      <p className="text-lg font-semibold text-white mt-1">
                        {formatDate(submittedAt)}
                      </p>
                    </div>
                    <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                      <p className="text-[11px] uppercase tracking-widest text-gray-400">
                        Status
                      </p>
                      <p className="text-lg font-semibold text-yellow-300 mt-1">
                        Pending Approval
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto space-y-3 text-sm text-gray-400">
                  <p>
                    You can close this page—your request is saved. Return anytime to upload
                    manifests, schedule deliveries, or request updates from Roughneck AI.
                  </p>
                  <p className="text-xs text-gray-500">
                    Reference ID is required for any follow-up questions. Keep it handy!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

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
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="hidden sm:inline">Use arrow buttons, Shift+wheel, or swipe to view {visibleRequests.length} requests</span>
                <span className="sm:hidden">Swipe to view {visibleRequests.length} requests</span>
              </div>
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
          role="region"
          aria-label="Storage request tiles"
          tabIndex={0}
        >
          {visibleRequests.map((request, index) => {
            const requestDetails = request.requestDetails;
            const storageStartDate = requestDetails?.storageStartDate ?? null;
            const storageEndDate = requestDetails?.storageEndDate ?? null;
            const daysRemaining = storageEndDate ? calculateDaysBetween(nowIso, storageEndDate) : null;
            const daysUntilDropoff = storageStartDate ? calculateDaysBetween(nowIso, storageStartDate) : null;
            const referenceId = request.referenceId;

            const logistics = getRequestLogisticsSnapshot(request);
            const {
              inboundLoads,
              outboundLoads,
              inboundState,
              outboundState,
              customerStatusLabel,
              inboundStatusLabel,
              outboundStatusLabel,
              inboundProgress,
              outboundProgress,
            } = logistics;
            const inboundDocCount = inboundLoads.reduce(
              (sum, load) => sum + (load.documents?.length ?? 0),
              0
            );
            const outboundDocCount = outboundLoads.reduce(
              (sum, load) => sum + (load.documents?.length ?? 0),
              0
            );
            const hasAnyDocs =
              inboundLoads.length > 0 ||
              outboundLoads.length > 0 ||
              inboundDocCount > 0 ||
              outboundDocCount > 0;

            const badgeTone = getStatusBadgeTone(customerStatusLabel);
            const badgeStyle = badgeThemes[badgeTone];
            const backgroundGlowClass = (() => {
              if (/Rejected/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-red-500 to-transparent';
              if (/Pending/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-yellow-500 to-transparent';
              if (/Trucking/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-blue-500 to-transparent';
              if (/Stored|Approved|Complete/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-green-500 to-transparent';
              return 'bg-gradient-to-br from-blue-500 to-transparent';
            })();
            const inboundInProgress = ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(inboundState);
            const outboundInProgress = ['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(outboundState);
            const hasOpenDeliveryRequest = inboundInProgress || outboundInProgress;
            const inboundCompleted = inboundState === 'COMPLETED';
            const activeLogisticsLabel = outboundInProgress ? outboundStatusLabel : inboundInProgress ? inboundStatusLabel : null;
            const deliveredQuantity =
              inboundProgress.plannedJoints > 0 || inboundProgress.completedJoints > 0
                ? inboundProgress.completedJoints
                : null;
            const remainingQuantity =
              inboundProgress.plannedJoints > 0 ? inboundProgress.remainingJoints : null;
            const outboundRemaining =
              outboundProgress.plannedJoints > 0 ? outboundProgress.remainingJoints : null;
            const hasInboundLoads = inboundLoads.length > 0;
            const outboundReady = inboundCompleted && outboundState === 'NONE';
            const canStartInbound = request.status === 'APPROVED' || hasInboundLoads;
            let scheduleActionLabel = hasInboundLoads ? 'Load to MPS' : 'Truck to MPS';
            let scheduleActionHelper = hasInboundLoads
              ? 'Reuse your previous submission to request the next inbound load.'
              : 'Kick off trucking to bring pipe into MPS.';
            let scheduleDisabled = !canStartInbound;
            if (scheduleDisabled && request.status !== 'APPROVED') {
              scheduleActionHelper = 'Storage approval must be completed before trucking can be scheduled.';
            }

            if (outboundReady) {
              scheduleActionLabel = 'Truck from MPS (Coming Soon)';
              scheduleActionHelper = 'Inbound loads are complete. We are finalizing outbound scheduling now.';
              scheduleDisabled = true;
            } else if (outboundInProgress) {
              scheduleActionLabel = 'Truck from MPS';
              scheduleActionHelper = 'Outbound scheduling is being coordinated by the MPS team.';
              scheduleDisabled = true;
            }

            const handleScheduleClick = () => {
              if (scheduleDisabled || !onScheduleDelivery) return;
              onScheduleDelivery(request);
            };

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
                  `- Status: ${customerStatusLabel}`,
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
              <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden min-h-[480px] max-h-[600px] flex flex-col">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

                {/* Glow effect based on status */}
                <div className={`absolute inset-0 opacity-10 ${backgroundGlowClass}`}></div>

                <div className="relative p-6 flex-1 flex flex-col overflow-y-auto">
                  {/* Status and Next Steps Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-700/50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Current Status</p>
                        <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold border-2 rounded-full shadow-lg ${badgeStyle}`}>
                          {customerStatusLabel}
                        </span>
                      </div>
                      {onScheduleDelivery && customerStatusLabel !== 'Complete' && (
                        <>
                          <div className="hidden sm:flex items-center">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Actions</p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={handleScheduleClick}
                                disabled={scheduleDisabled}
                                className={`text-sm px-5 py-2 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 ${scheduleDisabled ? 'bg-gray-800/70 text-gray-300 border border-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white'}`}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <TruckIcon className="w-4 h-4" />
                                  {scheduleActionLabel}
                                </span>
                              </Button>
                              {onUploadDocuments && (
                                <Button
                                  onClick={() => onUploadDocuments(request)}
                                  className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-sm px-5 py-2 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                                >
                                  Upload Documents
                                </Button>
                              )}
                            </div>
                            {scheduleActionHelper && (<p className="text-[11px] text-gray-400">{scheduleActionHelper}</p>)}
                            {hasOpenDeliveryRequest && activeLogisticsLabel && (
                              <div className="flex items-center gap-2 text-xs text-blue-200 bg-blue-900/30 border border-blue-500/40 rounded-lg px-3 py-2">
                                <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                                {activeLogisticsLabel}
                              </div>
                            )}
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
                      {(inboundStatusLabel ||
                        outboundStatusLabel ||
                        deliveredQuantity != null ||
                        remainingQuantity != null ||
                        outboundRemaining != null ||
                        hasAnyDocs) && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold mb-1">Logistics Overview</p>
                          {inboundStatusLabel && (
                            <p className="text-xs text-blue-300">
                              <span className="font-semibold text-gray-100">Inbound:</span> {inboundStatusLabel}
                            </p>
                          )}

                          {/* Individual Inbound Load Status Badges */}
                          {inboundLoads.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              {inboundLoads.map(load => {
                                const loadBadgeClass = (() => {
                                  switch (load.status) {
                                    case 'NEW':
                                      return 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50';
                                    case 'APPROVED':
                                      return 'bg-green-900/40 text-green-300 border-green-700/50';
                                    case 'IN_TRANSIT':
                                      return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
                                    case 'COMPLETED':
                                      return 'bg-green-900/40 text-green-300 border-green-700/50';
                                    case 'REJECTED':
                                      return 'bg-red-900/40 text-red-300 border-red-700/50';
                                    default:
                                      return 'bg-gray-800/40 text-gray-300 border-gray-700/50';
                                  }
                                })();
                                const loadStatusEmoji = (() => {
                                  switch (load.status) {
                                    case 'NEW': return '⏳';
                                    case 'APPROVED': return '✓';
                                    case 'IN_TRANSIT': return '🚛';
                                    case 'COMPLETED': return '✓';
                                    case 'REJECTED': return '✗';
                                    default: return '•';
                                  }
                                })();
                                const loadStatusText = (() => {
                                  switch (load.status) {
                                    case 'NEW': return 'Pending Approval';
                                    case 'APPROVED': return 'Approved';
                                    case 'IN_TRANSIT': return 'En Route';
                                    case 'COMPLETED': return 'Delivered';
                                    case 'REJECTED': return 'Rejected';
                                    default: return load.status;
                                  }
                                })();
                                const isTimelineExpanded = expandedLoadTimeline === load.id;

                                return (
                                  <div key={load.id} className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <button
                                        onClick={() => setExpandedLoadTimeline(isTimelineExpanded ? null : load.id)}
                                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                                      >
                                        <span>Load #{load.sequenceNumber}</span>
                                        <svg
                                          className={`w-3 h-3 transition-transform ${isTimelineExpanded ? 'rotate-180' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${loadBadgeClass}`}>
                                        <span>{loadStatusEmoji}</span>
                                        <span>{loadStatusText}</span>
                                      </span>
                                    </div>

                                    {/* Expandable Timeline */}
                                    {isTimelineExpanded && (
                                      <div className="pl-2 pt-2 border-l-2 border-gray-700">
                                        <LoadTimelineView load={load} direction="INBOUND" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {deliveredQuantity != null && (
                            <p className="text-xs text-gray-300">
                              <span className="font-semibold text-gray-100">Delivered:</span>{' '}
                              {deliveredQuantity}
                              {inboundProgress.plannedJoints ? ` / ${inboundProgress.plannedJoints} joints` : ' joints'}
                            </p>
                          )}
                          {remainingQuantity != null && (
                            <p className="text-xs text-gray-300">
                              <span className="font-semibold text-gray-100">Remaining:</span> {remainingQuantity} joints
                            </p>
                          )}

                          {/* Outbound Loads Section */}
                          {outboundStatusLabel && (
                            <p className="text-xs text-blue-300 pt-2">
                              <span className="font-semibold text-gray-100">Outbound:</span> {outboundStatusLabel}
                            </p>
                          )}

                          {/* Individual Outbound Load Status Badges */}
                          {outboundLoads.length > 0 && (
                            <div className="space-y-1.5">
                              {outboundLoads.map(load => {
                                const loadBadgeClass = (() => {
                                  switch (load.status) {
                                    case 'NEW':
                                      return 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50';
                                    case 'APPROVED':
                                      return 'bg-green-900/40 text-green-300 border-green-700/50';
                                    case 'IN_TRANSIT':
                                      return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
                                    case 'COMPLETED':
                                      return 'bg-green-900/40 text-green-300 border-green-700/50';
                                    case 'REJECTED':
                                      return 'bg-red-900/40 text-red-300 border-red-700/50';
                                    default:
                                      return 'bg-gray-800/40 text-gray-300 border-gray-700/50';
                                  }
                                })();
                                const loadStatusEmoji = (() => {
                                  switch (load.status) {
                                    case 'NEW': return '⏳';
                                    case 'APPROVED': return '✓';
                                    case 'IN_TRANSIT': return '🚛';
                                    case 'COMPLETED': return '✓';
                                    case 'REJECTED': return '✗';
                                    default: return '•';
                                  }
                                })();
                                const loadStatusText = (() => {
                                  switch (load.status) {
                                    case 'NEW': return 'Pending Approval';
                                    case 'APPROVED': return 'Approved';
                                    case 'IN_TRANSIT': return 'En Route';
                                    case 'COMPLETED': return 'Picked Up';
                                    case 'REJECTED': return 'Rejected';
                                    default: return load.status;
                                  }
                                })();
                                const isTimelineExpanded = expandedLoadTimeline === load.id;

                                return (
                                  <div key={load.id} className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <button
                                        onClick={() => setExpandedLoadTimeline(isTimelineExpanded ? null : load.id)}
                                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                                      >
                                        <span>Pickup #{load.sequenceNumber}</span>
                                        <svg
                                          className={`w-3 h-3 transition-transform ${isTimelineExpanded ? 'rotate-180' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${loadBadgeClass}`}>
                                        <span>{loadStatusEmoji}</span>
                                        <span>{loadStatusText}</span>
                                      </span>
                                    </div>

                                    {/* Expandable Timeline */}
                                    {isTimelineExpanded && (
                                      <div className="pl-2 pt-2 border-l-2 border-gray-700">
                                        <LoadTimelineView load={load} direction="OUTBOUND" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {outboundRemaining != null && (
                            <p className="text-xs text-gray-300">
                              <span className="font-semibold text-gray-100">Outbound Remaining:</span> {outboundRemaining} joints
                            </p>
                          )}
                          {hasOpenDeliveryRequest && (
                            <p className="text-[11px] text-blue-200">MPS scheduling team has been notified of the latest load.</p>
                          )}
                          {hasAnyDocs && (
                            <p className="text-xs text-gray-300">
                              <span className="font-semibold text-gray-100">Documents:</span>{' '}
                              {inboundDocCount} inbound / {outboundDocCount} outbound
                            </p>
                          )}
                        </div>
                      )}
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

