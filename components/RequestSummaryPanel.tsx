import React, { useEffect, useMemo, useState, useRef } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import StorageRequestCard from './StorageRequestCard';
import { StorageRequest } from '../types';
import { formatDate } from '../utils/dateUtils';

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
  onClearPendingSubmission?: () => void;
}

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
  onClearPendingSubmission,
}) => {
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const [showArchived, setShowArchived] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Normalize requests
  const normalizedRequests = useMemo(() => {
    return requests.map((request) => ({
      ...request,
      isArchived: request.isArchived ?? false,
    }));
  }, [requests]);

  // Separate active and archived requests
  const activeRequests = useMemo(
    () => normalizedRequests.filter((r) => !r.isArchived),
    [normalizedRequests]
  );

  const archivedRequests = useMemo(
    () => normalizedRequests.filter((r) => r.isArchived),
    [normalizedRequests]
  );

  const archivedCount = archivedRequests.length;

  // Visible requests based on showArchived toggle
  const visibleRequests = useMemo(
    () => (showArchived ? archivedRequests : activeRequests),
    [showArchived, archivedRequests, activeRequests]
  );

  // Scroll handlers
  const scrollToPrev = () => {
    if (scrollContainerRef.current) {
      const cardWidth = 400;
      scrollContainerRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    }
  };

  const scrollToNext = () => {
    if (scrollContainerRef.current) {
      const cardWidth = 400;
      scrollContainerRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }
  };

  // Update scroll button visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateScrollButtons = () => {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1
      );
    };

    updateScrollButtons();
    container.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      container.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [visibleRequests]);

  // Show confirmation overlay if pendingSubmission exists
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

        <div className="relative max-w-[600px] animate-fade-in-up">
          {/* Industrial Glassmorphism Glow - Cyan/Indigo */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-40 animate-pulse" />

          <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden h-[480px]">
            <div className="absolute inset-0 bg-grid-pattern opacity-10" />
            <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-cyan-500/20 to-transparent" />

            <div className="relative p-8 h-full flex flex-col gap-6">
              <div className="flex items-center justify-between pb-6 border-b border-cyan-500/20">
                <div>
                  <p className="text-[10px] text-cyan-300 uppercase tracking-widest font-semibold mb-2">
                    Request Submitted
                  </p>
                  <h3 className="text-3xl font-bold text-white tracking-tight">Awaiting Approval</h3>
                  <p className="text-sm text-slate-400 mt-2">
                    We received your details and notified the MPS admin team.
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                    Reference ID
                  </span>
                  <span className="text-2xl font-mono font-bold text-cyan-400 tracking-wider">
                    {pendingSubmission.referenceId}
                  </span>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-2xl shadow-lg shadow-cyan-900/20">
                    ⏳
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">Next Steps</p>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                      An MPS admin reviews every request. You&apos;ll receive email confirmation
                      as soon as it&apos;s approved or if we need any clarifications.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                      Submitted
                    </p>
                    <p className="text-lg font-semibold text-white mt-1">
                      {formatDate(submittedAt)}
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                      Status
                    </p>
                    <p className="text-lg font-semibold text-amber-400 mt-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Pending Approval
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-800 flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500 max-w-[60%]">
                  Reference ID is required for any follow-up questions. Keep it handy!
                </p>
                <Button
                  variant="primary"
                  onClick={onClearPendingSubmission}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 px-6"
                >
                  Continue to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show onboarding card for new users with no requests
  if (!requests.length) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{heading}</h2>
          <p className="text-sm text-gray-400">{description}</p>
        </div>

        {/* New User Onboarding Card */}
        <div className="relative max-w-[600px]">
          {/* 3D Glow Effect */}
          <div className="absolute -inset-1 bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl blur-lg opacity-30 animate-pulse"></div>

          <div className="relative glass-panel rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden h-[480px]">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.05]"></div>

            {/* Status glow */}
            <div className="absolute inset-0 bg-linear-to-br from-cyan-500/20 via-indigo-500/10 to-transparent"></div>

            <div className="relative p-6 h-full flex flex-col">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-700/50">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Getting Started</p>
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
                    <div className="w-10 h-10 bg-indigo-600/30 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Welcome to PipeVault!</h3>
                      <p className="text-sm text-slate-300">
                        Click the <span className="text-indigo-300 font-semibold">"Request Storage"</span> button to get started with your first pipe storage request.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Active Requests</p>
                    <p className="text-2xl font-bold text-white">0</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Ready to Start</p>
                    <p className="text-2xl font-bold text-green-400">✓</p>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="bg-slate-800/20 rounded-lg p-4 border border-slate-700/30 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
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
          className="flex overflow-x-auto gap-6 pb-8 pt-2 px-4 snap-x snap-mandatory scrollbar-hide"
        >
          {visibleRequests.map((request, index) => (
            <StorageRequestCard
              key={request.id}
              request={request}
              index={index}
              totalCount={visibleRequests.length}
              onArchiveRequest={onArchiveRequest}
              archivingRequestId={archivingRequestId}
              onScheduleDelivery={onScheduleDelivery}
              onUploadDocuments={onUploadDocuments}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RequestSummaryPanel;
