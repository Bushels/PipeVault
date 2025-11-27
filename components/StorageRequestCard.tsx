import React, { useMemo, useState } from 'react';
import GlassCard from './ui/GlassCard';
import GlassButton from './ui/GlassButton';
import { TruckIcon } from './icons/Icons';
import type { StorageRequest } from '../types';
import { calculateDaysBetween, formatDate } from '../utils/dateUtils';
import {
  getRequestLogisticsSnapshot,
  getStatusBadgeTone,
  type StatusBadgeTone,
} from '../utils/truckingStatus';
import LoadTimelineView from './LoadTimelineView';

interface StorageRequestCardProps {
  request: StorageRequest;
  index: number;
  totalCount: number;
  onArchiveRequest?: (request: StorageRequest, shouldArchive: boolean) => void | Promise<void>;
  archivingRequestId?: string | null;
  onScheduleDelivery?: (request: StorageRequest) => void;
  onUploadDocuments?: (request: StorageRequest) => void;
}

const badgeThemes: Record<StatusBadgeTone, string> = {
  pending: 'bg-yellow-900/20 text-yellow-200 border-yellow-500/60 shadow-[0_0_20px_rgba(234,179,8,0.4)] backdrop-blur-xl',
  success: 'bg-green-900/20 text-green-200 border-green-500/60 shadow-[0_0_20px_rgba(34,197,94,0.4)] backdrop-blur-xl',
  info: 'bg-blue-900/20 text-blue-200 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.4)] backdrop-blur-xl',
  danger: 'bg-red-900/20 text-red-200 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.4)] backdrop-blur-xl',
  neutral: 'bg-slate-800/40 text-slate-200 border-slate-500/60 shadow-[0_0_20px_rgba(100,116,139,0.3)] backdrop-blur-xl',
};

const StorageRequestCard: React.FC<StorageRequestCardProps> = ({
  request,
  index,
  totalCount,
  onArchiveRequest,
  archivingRequestId,
  onScheduleDelivery,
  onUploadDocuments,
}) => {
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const [expandedLoadTimeline, setExpandedLoadTimeline] = useState<string | null>(null);

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
    if (/Rejected/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-red-500/20 to-transparent';
    if (/Pending/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-yellow-500/20 to-transparent';
    if (/Trucking/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-blue-500/20 to-transparent';
    if (/Stored|Approved|Complete/i.test(customerStatusLabel)) return 'bg-gradient-to-br from-green-500/20 to-transparent';
    return 'bg-gradient-to-br from-blue-500/20 to-transparent';
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

  const isProcessingArchive = archivingRequestId === request.id;

  return (
    <div className="flex-none w-full sm:w-[calc(100%-2rem)] lg:w-[600px] snap-center animate-fade-in">
      <div className="relative group h-full">
        {/* Outer Glow - Tightly bound to card */}
        <div className={`absolute -inset-1 rounded-2xl blur-md opacity-30 group-hover:opacity-60 transition duration-500 min-h-[480px] max-h-[600px] ${backgroundGlowClass.replace('/20', '')}`}></div>
        
        <GlassCard className="relative overflow-hidden min-h-[480px] max-h-[600px] flex flex-col p-0 border-slate-700/50 shadow-2xl">
          {/* Inner Status Glow */}
          <div className={`absolute inset-0 opacity-10 ${backgroundGlowClass}`}></div>

          <div className="relative p-6 flex-1 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {/* Status and Next Steps Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-700/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Current Status</p>
                  <span className={`relative inline-flex items-center px-4 py-1.5 text-xs font-bold border-2 rounded-full shadow-lg overflow-hidden group transition-all duration-300 hover:scale-105 ${badgeStyle}`}>
                    <span className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-50"></span>
                    <span className="relative z-10">{customerStatusLabel}</span>
                  </span>
                </div>
                {onScheduleDelivery && customerStatusLabel !== 'Complete' && (
                  <>
                    <div className="hidden sm:flex items-center">
                      <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Actions</p>
                      <div className="flex flex-wrap gap-2">
                        <GlassButton
                          onClick={handleScheduleClick}
                          disabled={scheduleDisabled}
                          variant="primary"
                          className={`text-sm px-5 py-2 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 ${scheduleDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <TruckIcon className="w-4 h-4" />
                            {scheduleActionLabel}
                          </span>
                        </GlassButton>
                        {onUploadDocuments && (
                          <GlassButton
                            onClick={() => onUploadDocuments(request)}
                            variant="secondary"
                            className="text-sm px-5 py-2 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            Upload Documents
                          </GlassButton>
                        )}
                      </div>
                      {scheduleActionHelper && (<p className="text-[11px] text-slate-500">{scheduleActionHelper}</p>)}
                      {hasOpenDeliveryRequest && activeLogisticsLabel && (
                        <div className="flex items-center gap-2 text-xs text-blue-200 bg-blue-900/20 border border-blue-500/30 rounded-lg px-3 py-2 backdrop-blur-sm">
                          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.6)]"></span>
                          {activeLogisticsLabel}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {onArchiveRequest && (
                <GlassButton
                  variant="secondary"
                  onClick={() => onArchiveRequest(request, !request.archivedAt)}
                  disabled={isProcessingArchive}
                  className="px-4 py-2 text-xs font-semibold"
                >
                  {isProcessingArchive ? 'Saving...' : request.archivedAt ? '↻ Restore' : '📦 Archive'}
                </GlassButton>
              )}
            </div>

            {/* Reference ID and Request Info */}
            <div className="pt-4 flex-shrink-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Request {index + 1} of {totalCount}
              </p>
              <h3 className="text-2xl font-bold text-white mt-2 tracking-tight font-mono">{referenceId}</h3>
              {request.archivedAt && (
                <p className="text-xs text-yellow-400/80 mt-2 flex items-center gap-1">
                  <span>📦</span> Archived on {formatDate(request.archivedAt)}
                </p>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/30 rounded-xl p-5 border border-slate-700/30 mt-4 flex-shrink-0 backdrop-blur-sm">
              <div className="space-y-4">
                {request.assignedLocation && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-green-500/20 shadow-inner">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Storage Location</p>
                    <p className="text-base text-green-400 font-bold flex items-center gap-2 font-mono">
                      <span className="text-green-500/80">📍</span> {request.assignedLocation}
                    </p>
                  </div>
                )}
                {storageStartDate && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Storage Start</p>
                    <p className="text-sm text-slate-200 font-semibold">
                      {formatDate(storageStartDate)}
                    </p>
                    {daysUntilDropoff !== null && daysUntilDropoff > 0 && (
                      <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                        <span>⏰</span> {daysUntilDropoff} {daysUntilDropoff === 1 ? 'day' : 'days'} until dropoff
                      </p>
                    )}
                  </div>
                )}
                {storageEndDate && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Storage End</p>
                    <p className="text-sm text-slate-200 font-semibold">
                      {formatDate(storageEndDate)}
                    </p>
                    {daysRemaining !== null && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${daysRemaining < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
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
                  <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 space-y-2 shadow-inner">
                    <p className="text-[10px] uppercase tracking-wider text-blue-300 font-semibold mb-1">Logistics Overview</p>
                    {inboundStatusLabel && (
                      <p className="text-xs text-blue-200">
                        <span className="font-semibold text-slate-200">Inbound:</span> {inboundStatusLabel}
                      </p>
                    )}

                    {/* Individual Inbound Load Status Badges */}
                    {inboundLoads.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {inboundLoads.map(load => {
                          const loadBadgeClass = (() => {
                            switch (load.status) {
                              case 'NEW':
                                return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50';
                              case 'APPROVED':
                                return 'bg-green-900/30 text-green-300 border-green-700/50';
                              case 'IN_TRANSIT':
                                return 'bg-blue-900/30 text-blue-300 border-blue-700/50';
                              case 'COMPLETED':
                                return 'bg-green-900/30 text-green-300 border-green-700/50';
                              case 'CANCELLED':
                                return 'bg-red-900/30 text-red-300 border-red-700/50';
                              default:
                                return 'bg-slate-800/40 text-slate-300 border-slate-700/50';
                            }
                          })();
                          const loadStatusEmoji = (() => {
                            switch (load.status) {
                              case 'NEW': return '⏳';
                              case 'APPROVED': return '✓';
                              case 'IN_TRANSIT': return '🚛';
                              case 'COMPLETED': return '✓';
                              case 'CANCELLED': return '✗';
                              default: return '•';
                            }
                          })();
                          const loadStatusText = (() => {
                            switch (load.status) {
                              case 'NEW': return 'Pending Approval';
                              case 'APPROVED': return 'Approved';
                              case 'IN_TRANSIT': return 'En Route';
                              case 'COMPLETED': return 'Delivered';
                              case 'CANCELLED': return 'Cancelled';
                              default: return load.status;
                            }
                          })();
                          const isTimelineExpanded = expandedLoadTimeline === load.id;

                          return (
                            <div key={load.id} className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <button
                                  onClick={() => setExpandedLoadTimeline(isTimelineExpanded ? null : load.id)}
                                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                                >
                                  <span className="font-mono">Load #{load.sequenceNumber}</span>
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
                                <div className="pl-2 pt-2 border-l-2 border-slate-700 ml-1">
                                  <LoadTimelineView load={load} direction="INBOUND" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {deliveredQuantity != null && (
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-200">Delivered:</span>{' '}
                        {deliveredQuantity}
                        {inboundProgress.plannedJoints ? ` / ${inboundProgress.plannedJoints} joints` : ' joints'}
                      </p>
                    )}
                    {remainingQuantity != null && (
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-200">Remaining:</span> {remainingQuantity} joints
                      </p>
                    )}

                    {/* Outbound Loads Section */}
                    {outboundStatusLabel && (
                      <p className="text-xs text-blue-300 pt-2">
                        <span className="font-semibold text-slate-200">Outbound:</span> {outboundStatusLabel}
                      </p>
                    )}

                    {/* Individual Outbound Load Status Badges */}
                    {outboundLoads.length > 0 && (
                      <div className="space-y-1.5">
                        {outboundLoads.map(load => {
                          const loadBadgeClass = (() => {
                            switch (load.status) {
                              case 'NEW':
                                return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50';
                              case 'APPROVED':
                                return 'bg-green-900/30 text-green-300 border-green-700/50';
                              case 'IN_TRANSIT':
                                return 'bg-blue-900/30 text-blue-300 border-blue-700/50';
                              case 'COMPLETED':
                                return 'bg-green-900/30 text-green-300 border-green-700/50';
                              case 'CANCELLED':
                                return 'bg-red-900/30 text-red-300 border-red-700/50';
                              default:
                                return 'bg-slate-800/40 text-slate-300 border-slate-700/50';
                            }
                          })();
                          const loadStatusEmoji = (() => {
                            switch (load.status) {
                              case 'NEW': return '⏳';
                              case 'APPROVED': return '✓';
                              case 'IN_TRANSIT': return '🚛';
                              case 'COMPLETED': return '✓';
                              case 'CANCELLED': return '✗';
                              default: return '•';
                            }
                          })();
                          const loadStatusText = (() => {
                            switch (load.status) {
                              case 'NEW': return 'Pending Approval';
                              case 'APPROVED': return 'Approved';
                              case 'IN_TRANSIT': return 'En Route';
                              case 'COMPLETED': return 'Delivered';
                              case 'CANCELLED': return 'Cancelled';
                              default: return load.status;
                            }
                          })();
                          const isTimelineExpanded = expandedLoadTimeline === load.id;

                          return (
                            <div key={load.id} className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <button
                                  onClick={() => setExpandedLoadTimeline(isTimelineExpanded ? null : load.id)}
                                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                                >
                                  <span className="font-mono">Load #{load.sequenceNumber}</span>
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
                                <div className="pl-2 pt-2 border-l-2 border-slate-700 ml-1">
                                  <LoadTimelineView load={load} direction="OUTBOUND" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default StorageRequestCard;
