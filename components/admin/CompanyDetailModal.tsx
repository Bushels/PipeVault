import React, { useEffect, useMemo, useState } from 'react';
import { useCompanyDetails } from '../../hooks/useCompanyData';
import { formatDate } from '../../utils/dateUtils';
import {
  getRequestLogisticsSnapshot,
  getStatusBadgeTone,
} from '../../utils/truckingStatus';
import {
  inchesToMillimeters,
  lbsPerFtToKgPerM,
} from '../../utils/unitConversions';
import type {
  NewRequestDetails,
  ProvidedTruckingDetails,
  StorageRequest,
} from '../../types';
import GlassButton from '../ui/GlassButton';
import Spinner from '../ui/Spinner';

interface CompanyDetailModalProps {
  companyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusThemes: Record<ReturnType<typeof getStatusBadgeTone>, string> = {
  pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md',
  info: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-md',
  success: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md',
  danger: 'bg-rose-500/10 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)] backdrop-blur-md',
  neutral: 'bg-slate-500/10 text-slate-300 border border-slate-500/30 shadow-[0_0_15px_rgba(100,116,139,0.2)] backdrop-blur-md',
};

type Fact = { label: string; value: string; fullWidth?: boolean };

const buildPipeFacts = (details?: NewRequestDetails | null): Fact[] => {
  if (!details) return [];

  const facts: Fact[] = [];
  const itemType =
    details.itemType === 'Other' && details.itemTypeOther
      ? `Other (${details.itemTypeOther})`
      : details.itemType;
  const grade =
    details.grade === 'Other' && details.gradeOther
      ? `Other (${details.gradeOther})`
      : details.grade;
  const connection =
    details.connection === 'Other' && details.connectionOther
      ? `Other (${details.connectionOther})`
      : details.connection;

  if (itemType) facts.push({ label: 'Item Type', value: itemType });
  if (grade) facts.push({ label: 'Grade', value: grade });
  if (connection) facts.push({ label: 'Connection', value: connection });
  if (details.threadType) facts.push({ label: 'Thread Type', value: details.threadType });
  if (typeof details.avgJointLength === 'number') {
    facts.push({ label: 'Avg Joint Length', value: `${details.avgJointLength.toFixed(1)} m` });
  }
  if (typeof details.totalJoints === 'number') {
    facts.push({ label: 'Total Joints', value: details.totalJoints.toLocaleString() });
  }
  if (typeof details.avgJointLength === 'number' && typeof details.totalJoints === 'number') {
    const totalLength = details.avgJointLength * details.totalJoints;
    facts.push({ label: 'Total Length', value: `${totalLength.toFixed(1)} m` });
  }
  if (details.storageStartDate || details.storageEndDate) {
    facts.push({
      label: 'Storage Window',
      value: `${details.storageStartDate || 'TBD'} → ${details.storageEndDate || 'TBD'}`,
      fullWidth: true,
    });
  }

  if (details.itemType === 'Sand Control' && details.sandControlScreenType) {
    const screen =
      details.sandControlScreenType === 'Other' && details.sandControlScreenTypeOther
        ? `Other (${details.sandControlScreenTypeOther})`
        : details.sandControlScreenType;
    facts.push({ label: 'Screen Type', value: screen });
  }

  if (details.casingSpec) {
    if (typeof details.casingSpec.size_in === 'number') {
      const outerDiameterMm = inchesToMillimeters(details.casingSpec.size_in);
      facts.push({ label: 'Outer Diameter (mm)', value: outerDiameterMm.toFixed(1) });
    }
    if (typeof details.casingSpec.weight_lbs_ft === 'number') {
      const weightKgPerM = lbsPerFtToKgPerM(details.casingSpec.weight_lbs_ft);
      facts.push({
        label: 'Weight (kg/m)',
        value: weightKgPerM.toFixed(2),
      });
    }
    if (typeof details.casingSpec.drift_in === 'number') {
      const driftMm = inchesToMillimeters(details.casingSpec.drift_in);
      facts.push({
        label: 'Drift ID (mm)',
        value: driftMm.toFixed(1),
      });
    }
  }

  return facts;
};

const buildTruckingFacts = (
  truckingType?: 'quote' | 'provided',
  details?: ProvidedTruckingDetails | null,
): Fact[] => {
  const facts: Fact[] = [];
  if (truckingType) {
    facts.push({
      label: 'Preference',
      value: truckingType === 'quote' ? 'MPS to provide trucking quote' : 'Customer arranging trucking',
    });
  }

  if (!details) return facts;

  if (details.storageCompany) facts.push({ label: 'Storage Company', value: details.storageCompany });
  if (details.storageLocation) {
    facts.push({
      label: 'Current Location',
      value: details.storageLocation,
      fullWidth: true,
    });
  }

  if (details.storageContactName || details.storageContactEmail || details.storageContactNumber) {
    const contactLines = [
      details.storageContactName,
      details.storageContactEmail,
      details.storageContactNumber,
    ]
      .filter(Boolean)
      .join('\n');
    if (contactLines) {
      facts.push({
        label: 'Trucking Contact',
        value: contactLines,
        fullWidth: true,
      });
    }
  }

  if (details.specialInstructions) {
    facts.push({
      label: 'Special Instructions',
      value: details.specialInstructions,
      fullWidth: true,
    });
  }

  return facts;
};

const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  companyId,
  isOpen,
  onClose,
}) => {
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useCompanyDetails(isOpen && companyId ? companyId : undefined);



  // Reset when company changes or modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveRequestId(null);
    }
  }, [isOpen, companyId]);

  // Auto-select first request when data loads
  useEffect(() => {
    if (!isOpen) return;
    if (data?.requests?.length) {
      setActiveRequestId(prev => {
        if (prev && data.requests.some(r => r.id === prev)) {
          return prev;
        }
        return data.requests[0].id;
      });
    }
  }, [data, isOpen]);

  // Calculate active request (must be before early return to satisfy Rules of Hooks)
  const activeRequest: StorageRequest | null = useMemo(() => {
    return data?.requests.find(r => r.id === activeRequestId) ?? null;
  }, [data?.requests, activeRequestId]);

  // Calculate status metadata (must be before early return to satisfy Rules of Hooks)
  const activeRequestStatusMeta = useMemo(() => {
    if (!activeRequest) return null;
    const snapshot = getRequestLogisticsSnapshot(activeRequest);
    const tone = getStatusBadgeTone(snapshot.customerStatusLabel);
    return {
      label: snapshot.customerStatusLabel,
      tone,
      className: statusThemes[tone],
    };
  }, [activeRequest]);



  // Early return AFTER all hooks to satisfy Rules of Hooks
  if (!isOpen || !companyId) {
    // console.log('❌ Modal not rendering - isOpen:', isOpen, 'companyId:', companyId);
    return null;
  }



  const renderRequestList = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-16 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse"
            />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-700/50 text-sm text-red-200 space-y-3 backdrop-blur-sm">
          <p>Failed to load company details.</p>
          <button
            onClick={() => refetch()}
            className="underline text-red-100 hover:text-white"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!data || data.requests.length === 0) {
      return (
        <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-400 backdrop-blur-sm">
          No storage requests found for this company.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {data.requests.map(request => {
          const tone = getStatusBadgeTone(
            getRequestLogisticsSnapshot(request).customerStatusLabel,
          );
          const isActive = request.id === activeRequestId;
          return (
            <button
              key={request.id}
              onClick={() => setActiveRequestId(request.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-200 ${
                isActive
                  ? 'bg-cyan-900/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className={`font-semibold ${isActive ? 'text-cyan-300' : 'text-white'}`}>
                    {request.referenceId}
                  </p>
                  <p className="text-xs text-slate-400">
                    {request.requestDetails?.companyName ?? 'Unknown company'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Submitted{' '}
                    {request.createdAt
                      ? formatDate(request.createdAt, true)
                      : '—'}
                  </p>
                </div>
                <span
                  className={`relative text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full overflow-hidden transition-all duration-200 ${
                    statusThemes[tone]
                  }`}
                >
                  <span className="absolute inset-0 bg-linear-to-r from-white/5 to-transparent opacity-50"></span>
                  <span className="relative z-10">{request.status}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderRequestDetails = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400">
          <Spinner size="lg" className="mr-3" />
          Loading request details...
        </div>
      );
    }

    if (!activeRequest) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-3 text-slate-400">
          <p>No request selected.</p>
          <p className="text-sm">
            Choose a request from the left panel to view full details.
          </p>
        </div>
      );
    }

    const details = activeRequest.requestDetails;
    const truckingInfo = activeRequest.truckingInfo?.details;
    const logistics = getRequestLogisticsSnapshot(activeRequest);
    const pipeFacts = buildPipeFacts(details);
    const truckingFacts = buildTruckingFacts(
      activeRequest.truckingInfo?.truckingType,
      truckingInfo,
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Reference ID</p>
              <h3 className="text-2xl font-bold text-white drop-shadow-md">
                {activeRequest.referenceId}
              </h3>
            </div>
            {activeRequestStatusMeta && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${activeRequestStatusMeta.className}`}
              >
                {activeRequestStatusMeta.label}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            Submitted{' '}
            {activeRequest.createdAt
              ? formatDate(activeRequest.createdAt, true)
              : '—'}
            {' · '}
            Contact:{' '}
            {details?.fullName ||
              details?.contactEmail ||
              activeRequest.userId}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel border border-slate-700/50 rounded-xl p-4 bg-slate-900/40 backdrop-blur-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Contact Info
            </h4>
            <dl className="text-sm text-slate-300 space-y-2">
              <div>
                <dt className="text-slate-500 text-xs uppercase">
                  Company
                </dt>
                <dd className="text-white font-medium">
                  {details?.companyName ?? 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs uppercase">
                  Name
                </dt>
                <dd className="text-white">
                  {details?.fullName || 'Missing'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs uppercase">
                  Email
                </dt>
                <dd className="text-white break-words">
                  {details?.contactEmail || activeRequest.userId}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs uppercase">
                  Phone
                </dt>
                <dd className="text-white">
                  {details?.contactNumber || 'Not provided'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="glass-panel border border-slate-700/50 rounded-xl p-4 bg-slate-900/40 backdrop-blur-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Status Timeline
            </h4>
            <dl className="text-sm text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 text-xs uppercase">
                  Requested
                </dt>
                <dd>
                  {activeRequest.createdAt
                    ? formatDate(activeRequest.createdAt, true)
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 text-xs uppercase">
                  Approved
                </dt>
                <dd>
                  {activeRequest.approvedAt
                    ? formatDate(activeRequest.approvedAt, true)
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 text-xs uppercase">
                  Rejected
                </dt>
                <dd>
                  {activeRequest.rejectedAt
                    ? formatDate(activeRequest.rejectedAt, true)
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {pipeFacts.length > 0 && (
          <div className="glass-panel border border-slate-700/50 rounded-xl p-4 bg-slate-900/40 backdrop-blur-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Customer Input (Pipe Specs)
            </h4>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
              {pipeFacts.map(fact => (
                <div
                  key={`${fact.label}-${fact.value}`}
                  className={fact.fullWidth ? 'md:col-span-2' : undefined}
                >
                  <dt className="text-xs uppercase text-slate-500">
                    {fact.label}
                  </dt>
                  <dd className="text-white font-medium whitespace-pre-wrap">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {activeRequest.approvalSummary && (
          <div className="glass-panel border border-slate-700/50 rounded-xl p-4 bg-slate-900/40 backdrop-blur-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Approval Summary
            </h4>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">
              {activeRequest.approvalSummary}
            </p>
          </div>
        )}

        {truckingFacts.length > 0 && (
          <div className="glass-panel border border-slate-700/50 rounded-xl p-4 bg-slate-900/40 backdrop-blur-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Customer Input (Trucking & Logistics)
            </h4>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
              {truckingFacts.map(fact => (
                <div
                  key={`${fact.label}-${fact.value}`}
                  className={fact.fullWidth ? 'md:col-span-2' : undefined}
                >
                  <dt className="text-xs uppercase text-slate-500">
                    {fact.label}
                  </dt>
                  <dd className="text-white font-medium whitespace-pre-wrap">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="glass-panel border border-slate-700/50 rounded-xl p-4 bg-slate-900/40 backdrop-blur-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Logistics Snapshot
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <p className="text-slate-500 text-xs uppercase mb-1">
                Inbound Loads
              </p>
              <p className="text-white font-semibold">
                {logistics.inboundLoads.length > 0
                  ? `${logistics.inboundLoads.length} loads (${logistics.inboundStatusLabel ?? '—'})`
                  : 'No inbound loads'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase mb-1">
                Outbound Loads
              </p>
              <p className="text-white font-semibold">
                {logistics.outboundLoads.length > 0
                  ? `${logistics.outboundLoads.length} loads (${logistics.outboundStatusLabel ?? '—'})`
                  : 'No outbound loads'}
              </p>
            </div>
          </div>

          {activeRequest.truckingLoads && activeRequest.truckingLoads.length > 0 && (
            <div className="mt-4 border border-slate-700/50 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2">Direction</th>
                    <th className="text-left px-3 py-2">Load #</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRequest.truckingLoads.map(load => (
                    <tr key={load.id} className="border-t border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 text-slate-300">
                        {load.direction}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {load.sequenceNumber}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700">
                          {load.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {load.documents?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const companyName = data?.company?.name ?? data?.summary?.name ?? 'Company';
  const companyDomain =
    data?.company?.domain ?? data?.summary?.domain ?? undefined;



  const overviewStats = [
    { label: 'Total Requests', value: data?.summary?.totalRequests ?? 0 },
    { label: 'Pending', value: data?.summary?.pendingRequests ?? 0 },
    { label: 'Approved', value: data?.summary?.approvedRequests ?? 0 },
    { label: 'Inventory Items', value: data?.summary?.totalInventoryItems ?? 0 },
  ];

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
          className="glass-panel w-full max-w-6xl rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto bg-slate-900/90 backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-700/50">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Company Detail
              </p>
              <h2 className="text-2xl font-bold text-white drop-shadow-md">{companyName}</h2>
              {companyDomain && (
                <p className="text-sm text-slate-400">{companyDomain}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800/50 rounded-full"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <aside className="lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-700/50 p-5 space-y-6 overflow-y-auto bg-slate-900/50">
              <div className="grid grid-cols-2 gap-3">
                {overviewStats.map(stat => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center backdrop-blur-sm"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-3 font-semibold">
                  Requests
                </h3>
                {renderRequestList()}
              </div>
            </aside>

            <section className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
              {renderRequestDetails()}
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompanyDetailModal;
