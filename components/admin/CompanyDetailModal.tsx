import React, { useEffect, useMemo, useState } from 'react';
import { useCompanyDetails } from '../../hooks/useCompanyData';
import { formatDate } from '../../utils/dateUtils';
import {
  getRequestLogisticsSnapshot,
  getStatusBadgeTone,
} from '../../utils/truckingStatus';
import type {
  NewRequestDetails,
  ProvidedTruckingDetails,
  StorageRequest,
} from '../../types';

interface CompanyDetailModalProps {
  companyId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusThemes: Record<ReturnType<typeof getStatusBadgeTone>, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300 border border-yellow-600/30',
  info: 'bg-blue-500/15 text-blue-300 border border-blue-600/30',
  success: 'bg-green-500/15 text-green-300 border border-green-600/30',
  danger: 'bg-red-500/15 text-red-300 border border-red-600/30',
  neutral: 'bg-gray-500/15 text-gray-300 border border-gray-500/30',
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
    facts.push({ label: 'Avg Joint Length', value: `${details.avgJointLength} ft` });
  }
  if (typeof details.totalJoints === 'number') {
    facts.push({ label: 'Total Joints', value: details.totalJoints.toLocaleString() });
  }
  if (typeof details.avgJointLength === 'number' && typeof details.totalJoints === 'number') {
    const totalLength = details.avgJointLength * details.totalJoints;
    facts.push({ label: 'Total Length', value: `${totalLength.toFixed(1)} ft` });
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
      facts.push({ label: 'Outer Diameter (in)', value: details.casingSpec.size_in.toString() });
    }
    if (typeof details.casingSpec.weight_lbs_ft === 'number') {
      facts.push({
        label: 'Weight (lbs/ft)',
        value: details.casingSpec.weight_lbs_ft.toFixed(1),
      });
    }
    if (typeof details.casingSpec.drift_in === 'number') {
      facts.push({
        label: 'Drift ID (in)',
        value: details.casingSpec.drift_in.toFixed(3),
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

  // DIAGNOSTIC: Log modal state and data flow
  useEffect(() => {
    console.log('[CompanyDetailModal] State Update:', {
      isOpen,
      companyId,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      requestsCount: data?.requests?.length ?? 0,
      isLoading,
      error,
      activeRequestId,
    });
  }, [isOpen, companyId, data, isLoading, error, activeRequestId]);

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

  // DEBUG: Log modal state
  console.log('🔍 CompanyDetailModal render:', {
    isOpen,
    companyId,
    hasData: !!data,
    isLoading,
    error: error?.message,
    requestsCount: data?.requests?.length,
    activeRequestId,
    activeRequestRef: activeRequest?.referenceId,
  });

  // Early return AFTER all hooks to satisfy Rules of Hooks
  if (!isOpen || !companyId) {
    console.log('❌ Modal not rendering - isOpen:', isOpen, 'companyId:', companyId);
    return null;
  }

  console.log('📄 Active request:', activeRequest?.referenceId || 'None');

  const renderRequestList = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-16 rounded-xl bg-gray-800/70 border border-gray-700 animate-pulse"
            />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-700 text-sm text-red-200 space-y-3">
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
        <div className="p-4 rounded-xl bg-gray-800/60 border border-gray-700 text-sm text-gray-300">
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
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                isActive
                  ? 'bg-cyan-900/30 border-cyan-600 shadow-lg shadow-cyan-900/40'
                  : 'bg-gray-900/40 border-gray-700 hover:border-cyan-500/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-white font-semibold">
                    {request.referenceId}
                  </p>
                  <p className="text-xs text-gray-400">
                    {request.requestDetails?.companyName ?? 'Unknown company'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Submitted{' '}
                    {request.createdAt
                      ? formatDate(request.createdAt, true)
                      : '—'}
                  </p>
                </div>
                <span
                  className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    statusThemes[tone]
                  }`}
                >
                  {request.status}
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
        <div className="flex items-center justify-center h-full text-gray-400">
          Loading request details...
        </div>
      );
    }

    if (!activeRequest) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-3 text-gray-400">
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
              <p className="text-sm text-gray-400">Reference ID</p>
              <h3 className="text-2xl font-bold text-white">
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
          <p className="text-sm text-gray-400">
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
          <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Contact Info
            </h4>
            <dl className="text-sm text-gray-300 space-y-2">
              <div>
                <dt className="text-gray-500 text-xs uppercase">
                  Company
                </dt>
                <dd className="text-white">
                  {details?.companyName ?? 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase">
                  Name
                </dt>
                <dd className="text-white">
                  {details?.fullName || 'Missing'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase">
                  Email
                </dt>
                <dd className="text-white break-words">
                  {details?.contactEmail || activeRequest.userId}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs uppercase">
                  Phone
                </dt>
                <dd className="text-white">
                  {details?.contactNumber || 'Not provided'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Status Timeline
            </h4>
            <dl className="text-sm text-gray-300 space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 text-xs uppercase">
                  Requested
                </dt>
                <dd>
                  {activeRequest.createdAt
                    ? formatDate(activeRequest.createdAt, true)
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 text-xs uppercase">
                  Approved
                </dt>
                <dd>
                  {activeRequest.approvedAt
                    ? formatDate(activeRequest.approvedAt, true)
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 text-xs uppercase">
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
          <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Customer Input (Pipe Specs)
            </h4>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
              {pipeFacts.map(fact => (
                <div
                  key={`${fact.label}-${fact.value}`}
                  className={fact.fullWidth ? 'md:col-span-2' : undefined}
                >
                  <dt className="text-xs uppercase text-gray-500">
                    {fact.label}
                  </dt>
                  <dd className="text-white whitespace-pre-wrap">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {activeRequest.approvalSummary && (
          <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Approval Summary
            </h4>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {activeRequest.approvalSummary}
            </p>
          </div>
        )}

        {truckingFacts.length > 0 && (
          <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Customer Input (Trucking & Logistics)
            </h4>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
              {truckingFacts.map(fact => (
                <div
                  key={`${fact.label}-${fact.value}`}
                  className={fact.fullWidth ? 'md:col-span-2' : undefined}
                >
                  <dt className="text-xs uppercase text-gray-500">
                    {fact.label}
                  </dt>
                  <dd className="text-white whitespace-pre-wrap">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Logistics Snapshot
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">
                Inbound Loads
              </p>
              <p className="text-white font-semibold">
                {logistics.inboundLoads.length > 0
                  ? `${logistics.inboundLoads.length} loads (${logistics.inboundStatusLabel ?? '—'})`
                  : 'No inbound loads'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">
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
            <div className="mt-4 border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2">Direction</th>
                    <th className="text-left px-3 py-2">Load #</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRequest.truckingLoads.map(load => (
                    <tr key={load.id} className="border-t border-gray-800">
                      <td className="px-3 py-2 text-gray-300">
                        {load.direction}
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {load.sequenceNumber}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-200">
                          {load.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-300">
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

  console.log('🏢 Rendering modal for:', companyName, '- Requests:', data?.requests?.length);

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
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 w-full max-w-6xl rounded-3xl border border-gray-700 shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">
                Company Detail
              </p>
              <h2 className="text-2xl font-bold text-white">{companyName}</h2>
              {companyDomain && (
                <p className="text-sm text-gray-400">{companyDomain}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <aside className="lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-800 p-5 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {overviewStats.map(stat => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-gray-900/60 border border-gray-700 text-center"
                  >
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {stat.label}
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-3">
                  Requests
                </h3>
                {renderRequestList()}
              </div>
            </aside>

            <section className="flex-1 overflow-y-auto p-6 bg-gray-950/40">
              {renderRequestDetails()}
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompanyDetailModal;
