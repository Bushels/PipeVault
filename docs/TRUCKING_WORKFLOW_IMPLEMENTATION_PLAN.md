# PipeVault Trucking Workflow - Master Implementation Plan

**Date:** 2025-11-11
**Status:** Ready for Implementation
**Based On:** Technical analysis + Codex strategic guidance
**Approach:** Phased implementation with specialized agent orchestration

---

## EXECUTIVE SUMMARY

**Goal:** Complete the trucking workflow from 70% → 100% production-ready

**Strategy:**
1. ✅ Keep existing customer booking flow (already works)
2. 🎯 Build admin verification UI (critical blocker)
3. 🎯 Implement state transitions (approve, in-transit, complete)
4. 🎯 Add sequential load blocking (improve UX)
5. 🎯 Create inventory auto-creation (close the loop)
6. 🎯 Abstract notifications (future-proof for email)

**Timeline:** 4-6 days (30-42 hours)
**Risk Level:** Low - No technical blockers, clear path forward

---

## PHASE 1: ADMIN VISIBILITY (Pending Loads)

**Goal:** Admin can see and review booked loads
**Duration:** 6-8 hours
**Priority:** CRITICAL - Blocks all other workflows
**Agent Assignment:** UI/UX Guardian + Admin Ops Orchestrator

### 1.1 Data Layer - Load Queries

**File:** `hooks/usePendingLoads.ts` (NEW)

```typescript
/**
 * Lightweight hook for admin pending loads list
 * Returns NEW loads with essential info for tile display
 */
export function usePendingLoads() {
  return useQuery({
    queryKey: ['trucking-loads', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trucking_loads')
        .select(`
          id,
          sequence_number,
          status,
          scheduled_slot_start,
          scheduled_slot_end,
          trucking_company,
          driver_name,
          total_joints_planned,
          total_length_ft_planned,
          total_weight_lbs_planned,
          created_at,
          storage_request:storage_requests!inner(
            id,
            reference_id,
            company_id,
            company:companies!inner(id, name, domain)
          ),
          documents:trucking_documents(id, file_name)
        `)
        .eq('direction', 'INBOUND')
        .eq('status', 'NEW')
        .order('scheduled_slot_start', { ascending: true });

      if (error) throw error;

      return data.map(load => ({
        loadId: load.id,
        sequenceNumber: load.sequence_number,
        companyId: load.storage_request.company_id,
        companyName: load.storage_request.company.name,
        requestReferenceId: load.storage_request.reference_id,
        scheduledSlotStart: load.scheduled_slot_start,
        scheduledSlotEnd: load.scheduled_slot_end,
        isAfterHours: isAfterHoursSlot(load.scheduled_slot_start),
        truckingCompany: load.trucking_company,
        driverName: load.driver_name,
        totalJointsPlanned: load.total_joints_planned,
        totalLengthFtPlanned: load.total_length_ft_planned,
        totalWeightLbsPlanned: load.total_weight_lbs_planned,
        documentCount: load.documents.length,
        createdAt: load.created_at,
      }));
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Full load details for modal view
 * Includes AI parsed data and documents
 */
export function useLoadDetails(loadId?: string) {
  return useQuery({
    queryKey: loadId ? ['trucking-loads', 'details', loadId] : ['trucking-loads', 'details', 'null'],
    enabled: !!loadId,
    queryFn: async () => {
      if (!loadId) return null;

      const { data, error } = await supabase
        .from('trucking_loads')
        .select(`
          *,
          storage_request:storage_requests!inner(
            *,
            company:companies!inner(*)
          ),
          documents:trucking_documents!trucking_documents_load_fkey(*)
        `)
        .eq('id', loadId)
        .single();

      if (error) throw error;

      return {
        load: data,
        storageRequest: data.storage_request,
        company: data.storage_request.company,
        documents: data.documents,
        parsedManifestItems: data.documents.flatMap(d => d.parsed_payload || []),
      };
    },
  });
}
```

**Helper Utility:**

```typescript
// utils/timeSlotHelpers.ts
export function isAfterHoursSlot(slotStart: string): boolean {
  const date = new Date(slotStart);
  const hour = date.getHours();
  const dayOfWeek = date.getDay();

  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  // Before 7 AM or after 5 PM
  if (hour < 7 || hour >= 17) return true;

  return false;
}

export function calculateSurcharge(isAfterHours: boolean): number {
  return isAfterHours ? 450 : 0;
}
```

**Checkpoint:** Query returns NEW loads with all required fields ✓

---

### 1.2 UI Component - Pending Loads Tile

**File:** `components/admin/tiles/PendingLoadsTile.tsx` (NEW)

```typescript
import React, { useState } from 'react';
import { usePendingLoads } from '../../../hooks/usePendingLoads';
import { formatDate } from '../../../utils/dateUtils';
import { calculateSurcharge } from '../../../utils/timeSlotHelpers';
import LoadDetailModal from '../LoadDetailModal';

const PendingLoadsTile: React.FC = () => {
  const { data: loads = [], isLoading, error } = usePendingLoads();
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Pending Loads</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-red-700 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Pending Loads</h2>
        <p className="text-red-400">Failed to load pending loads: {error.message}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Pending Loads</h2>
          <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-sm font-semibold">
            {loads.length} awaiting approval
          </span>
        </div>

        {loads.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">No pending loads</p>
            <p className="text-sm">All loads have been approved or completed</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {loads.map(load => {
              const surcharge = calculateSurcharge(load.isAfterHours);

              return (
                <button
                  key={load.loadId}
                  onClick={() => setSelectedLoadId(load.loadId)}
                  className="w-full text-left bg-gray-800/60 hover:bg-gray-800 border border-gray-700 hover:border-cyan-500 rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {load.companyName}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {load.requestReferenceId} - Load #{load.sequenceNumber}
                      </p>
                    </div>
                    {load.isAfterHours && (
                      <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 text-xs font-semibold">
                        After Hours +${surcharge}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase">Scheduled</p>
                      <p className="text-white">
                        {formatDate(load.scheduledSlotStart, true)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase">Trucking</p>
                      <p className="text-white">{load.truckingCompany}</p>
                      {load.driverName && (
                        <p className="text-gray-400 text-xs">{load.driverName}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs">
                      <span className="text-gray-500">Joints:</span>
                      <span className="text-white ml-1 font-semibold">
                        {load.totalJointsPlanned}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">Length:</span>
                      <span className="text-white ml-1 font-semibold">
                        {load.totalLengthFtPlanned.toFixed(1)} ft
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">Documents:</span>
                      <span className="text-white ml-1 font-semibold">
                        {load.documentCount}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <LoadDetailModal
        loadId={selectedLoadId}
        isOpen={!!selectedLoadId}
        onClose={() => setSelectedLoadId(null)}
      />
    </>
  );
};

export default PendingLoadsTile;
```

**Checkpoint:** Tile displays pending loads, after-hours flag, document count ✓

---

### 1.3 Modal Component - Load Detail View

**File:** `components/admin/LoadDetailModal.tsx` (NEW)

```typescript
import React from 'react';
import { useLoadDetails } from '../../hooks/usePendingLoads';
import { formatDate } from '../../utils/dateUtils';
import { calculateSurcharge } from '../../utils/timeSlotHelpers';
import type { ManifestItem } from '../../types';

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

  if (!isOpen || !loadId) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 rounded-3xl p-8 max-w-4xl w-full mx-4">
          <p className="text-white text-center">Loading load details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 rounded-3xl p-8 max-w-4xl w-full mx-4">
          <p className="text-red-400 text-center">Failed to load details: {error?.message || 'Unknown error'}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">
            Close
          </button>
        </div>
      </div>
    );
  }

  const { load, storageRequest, company, documents, parsedManifestItems } = data;
  const isAfterHours = load.scheduled_slot_start ? isAfterHoursSlot(load.scheduled_slot_start) : false;
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
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 w-full max-w-6xl rounded-3xl border border-cyan-500 shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500">
                Load #{load.sequence_number} - {storageRequest.reference_id}
              </p>
              <h2 className="text-2xl font-bold text-white">{company.name}</h2>
              <p className="text-sm text-gray-400">{company.domain}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl"
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
                  <p className="text-xs text-gray-500 uppercase">Date & Time</p>
                  <p className="text-white font-semibold">
                    {formatDate(load.scheduled_slot_start, true)}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {load.scheduled_slot_start && new Date(load.scheduled_slot_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {' - '}
                    {load.scheduled_slot_end && new Date(load.scheduled_slot_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">After Hours</p>
                  <p className="text-white font-semibold">
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
                  <dd className="text-white">{load.trucking_company || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs uppercase">Driver</dt>
                  <dd className="text-white">{load.driver_name || 'Not provided'}</dd>
                </div>
                {load.contact_name && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Contact</dt>
                    <dd className="text-white">{load.contact_name}</dd>
                  </div>
                )}
                {load.contact_phone && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Phone</dt>
                    <dd className="text-white">{load.contact_phone}</dd>
                  </div>
                )}
                {load.contact_email && (
                  <div className="col-span-2">
                    <dt className="text-gray-500 text-xs uppercase">Email</dt>
                    <dd className="text-white break-words">{load.contact_email}</dd>
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
                  <p className="text-white">{load.pickup_location?.company || 'Not specified'}</p>
                  {load.pickup_location?.address && (
                    <p className="text-gray-400 text-sm">{load.pickup_location.address}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Delivery Location</p>
                  <p className="text-white">{load.delivery_location?.facility || 'MPS Pipe Storage'}</p>
                  {load.delivery_location?.address && (
                    <p className="text-gray-400 text-sm">{load.delivery_location.address}</p>
                  )}
                </div>
              </div>
            </div>

            {/* AI Extracted Manifest Data */}
            <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                AI Extracted Manifest Data
              </h3>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-cyan-900/20 border border-cyan-700 rounded-lg">
                <div>
                  <p className="text-xs text-cyan-400 uppercase">Total Joints</p>
                  <p className="text-2xl font-bold text-white">{load.total_joints_planned}</p>
                </div>
                <div>
                  <p className="text-xs text-cyan-400 uppercase">Total Length</p>
                  <p className="text-2xl font-bold text-white">
                    {load.total_length_ft_planned?.toFixed(1)} ft
                  </p>
                  <p className="text-sm text-gray-400">
                    ({(load.total_length_ft_planned * 0.3048).toFixed(1)} m)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-cyan-400 uppercase">Total Weight</p>
                  <p className="text-2xl font-bold text-white">
                    {load.total_weight_lbs_planned?.toLocaleString()} lbs
                  </p>
                  <p className="text-sm text-gray-400">
                    ({(load.total_weight_lbs_planned * 0.453592).toFixed(0)} kg)
                  </p>
                </div>
              </div>

              {/* Documents */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase mb-2">Documents ({documents.length})</p>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                      <span className="text-white text-sm">{doc.file_name}</span>
                      <a
                        href={`${supabase.storage.from('trucking-documents').getPublicUrl(doc.storage_path).data.publicUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 text-sm underline"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Breakdown */}
              {parsedManifestItems.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-xs text-gray-500 uppercase mb-2">Detailed Breakdown</p>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase">
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
                      {parsedManifestItems.map((item: ManifestItem, idx) => (
                        <tr key={idx} className="border-t border-gray-800">
                          <td className="px-3 py-2 text-white">{item.serial_number || '—'}</td>
                          <td className="px-3 py-2 text-white">{item.heat_number || '—'}</td>
                          <td className="px-3 py-2 text-white">{item.tally_length_ft?.toFixed(2) || '—'}</td>
                          <td className="px-3 py-2 text-white">{item.outer_diameter || '—'}</td>
                          <td className="px-3 py-2 text-white">{item.weight_lbs_ft?.toFixed(2) || '—'}</td>
                          <td className="px-3 py-2 text-white">{item.quantity || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Original Customer Request (for comparison) */}
            <div className="border border-gray-700 rounded-xl p-4 bg-gray-900/40">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Original Customer Request (For Comparison)
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {storageRequest.request_details?.totalJoints && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Estimated Joints</dt>
                    <dd className="text-white">{storageRequest.request_details.totalJoints}</dd>
                  </div>
                )}
                {storageRequest.request_details?.grade && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Grade</dt>
                    <dd className="text-white">{storageRequest.request_details.grade}</dd>
                  </div>
                )}
                {storageRequest.request_details?.connection && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Connection</dt>
                    <dd className="text-white">{storageRequest.request_details.connection}</dd>
                  </div>
                )}
                {storageRequest.request_details?.itemType && (
                  <div>
                    <dt className="text-gray-500 text-xs uppercase">Item Type</dt>
                    <dd className="text-white">{storageRequest.request_details.itemType}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Admin Actions will go here in Phase 2 */}
          </div>
        </div>
      </div>
    </>
  );
};

export default LoadDetailModal;
```

**Checkpoint:** Modal displays all load data, documents, AI extraction, original request ✓

---

### 1.4 Integration - Add to AdminDashboard

**File:** `components/admin/AdminDashboard.tsx` (MODIFY)

```typescript
// Add import
import PendingLoadsTile from './tiles/PendingLoadsTile';

// In the tabs array, add:
{
  id: 'pending-loads',
  label: 'Pending Loads',
  content: <PendingLoadsTile />,
  badge: pendingLoadsCount, // From usePendingLoads hook
},
```

**Checkpoint:** Tab visible, accessible, shows pending loads ✓

---

## PHASE 2: STATE TRANSITIONS & APPROVALS

**Goal:** Admin can approve loads, mark in-transit, block sequential loads
**Duration:** 8-10 hours
**Priority:** CRITICAL
**Agent Assignment:** Admin Ops Orchestrator + Database Integrity Guardian

### 2.1 Approve Load Mutation

**File:** `hooks/useApproveTruckingLoad.ts` (NEW)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { sendLoadApprovalNotification } from '../services/notificationService';

interface ApproveTruckingLoadInput {
  loadId: string;
  notes?: string;
}

export function useApproveTruckingLoad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ loadId, notes }: ApproveTruckingLoadInput) => {
      // Update load status
      const { data, error } = await supabase
        .from('trucking_loads')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', loadId)
        .select(`
          *,
          storage_request:storage_requests!inner(
            *,
            company:companies!inner(*)
          )
        `)
        .single();

      if (error) throw error;

      return data;
    },

    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['trucking-loads', 'details', data.id] });
      queryClient.invalidateQueries({ queryKey: ['companies', 'summaries'] });
      queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

      // Send notification
      sendLoadApprovalNotification({
        loadId: data.id,
        sequenceNumber: data.sequence_number,
        companyName: data.storage_request.company.name,
        referenceId: data.storage_request.reference_id,
        scheduledSlotStart: data.scheduled_slot_start,
        truckingCompany: data.trucking_company,
      });

      console.log(`✅ Load #${data.sequence_number} approved successfully`);
    },

    onError: (error) => {
      console.error('❌ Failed to approve load:', error);
    },
  });
}
```

**Checkpoint:** Mutation updates status to APPROVED, invalidates caches ✓

---

### 2.2 Notification Service Abstraction

**File:** `services/notificationService.ts` (NEW)

```typescript
/**
 * Centralized notification service
 * Currently uses Slack, designed for future email integration
 */
import { sendSlackNotification } from './slackService';

interface LoadNotificationPayload {
  loadId: string;
  sequenceNumber: number;
  companyName: string;
  referenceId: string;
  scheduledSlotStart: string;
  truckingCompany: string;
}

/**
 * Send load approval notification
 * Current: Slack to admin
 * Future: Email to customer + Slack to admin
 */
export async function sendLoadApprovalNotification(payload: LoadNotificationPayload) {
  const slotDate = new Date(payload.scheduledSlotStart).toLocaleDateString();
  const slotTime = new Date(payload.scheduledSlotStart).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Slack notification
  await sendSlackNotification({
    type: 'LOAD_APPROVED',
    title: `Load #${payload.sequenceNumber} Approved`,
    message: `${payload.companyName} (${payload.referenceId}) - ${payload.truckingCompany}`,
    details: [
      { label: 'Scheduled', value: `${slotDate} at ${slotTime}` },
      { label: 'Load ID', value: payload.loadId },
    ],
  });

  // Email notification (placeholder for future implementation)
  // await sendCustomerEmail({
  //   to: payload.customerEmail,
  //   template: 'load-approved',
  //   data: payload,
  // });
}

/**
 * Send load in-transit notification
 */
export async function sendLoadInTransitNotification(payload: LoadNotificationPayload) {
  // Similar structure, separate function for clarity
  await sendSlackNotification({
    type: 'LOAD_IN_TRANSIT',
    title: `Load #${payload.sequenceNumber} In Transit`,
    message: `${payload.companyName} (${payload.referenceId})`,
  });

  // Future: Email to customer
}

/**
 * Send load completed notification
 */
export async function sendLoadCompletedNotification(payload: LoadNotificationPayload & {
  actualJoints: number;
  actualLengthFt: number;
  discrepancies?: string;
}) {
  await sendSlackNotification({
    type: 'LOAD_COMPLETED',
    title: `Load #${payload.sequenceNumber} Completed`,
    message: `${payload.companyName} (${payload.referenceId})`,
    details: [
      { label: 'Actual Joints', value: payload.actualJoints.toString() },
      { label: 'Actual Length', value: `${payload.actualLengthFt.toFixed(1)} ft` },
      ...(payload.discrepancies ? [{ label: 'Notes', value: payload.discrepancies }] : []),
    ],
  });

  // Future: Email to customer with discrepancies
}
```

**Checkpoint:** Notification service abstracted, Slack works, email interface defined ✓

---

### 2.3 Approve Button in Modal

**File:** `components/admin/LoadDetailModal.tsx` (MODIFY)

Add to bottom of modal content (before closing divs):

```typescript
import { useApproveTruckingLoad } from '../../hooks/useApproveTruckingLoad';
import { useState } from 'react';

// Inside component:
const [notes, setNotes] = useState('');
const approveMutation = useApproveTruckingLoad();

// Add before closing </div> of content section:
{load.status === 'NEW' && (
  <div className="border-t border-gray-800 p-6 bg-gray-900">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
      Admin Actions
    </h3>

    <textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      placeholder="Optional notes (e.g., 'Verified all serials match', 'Called to confirm time')"
      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 mb-3"
      rows={2}
    />

    <div className="flex gap-3">
      <button
        onClick={async () => {
          if (window.confirm(`Approve Load #${load.sequence_number} for ${company.name}?\n\nThis will confirm the booking and notify the customer.`)) {
            try {
              await approveMutation.mutateAsync({ loadId: load.id, notes });
              onClose();
            } catch (error) {
              console.error('Failed to approve load:', error);
              alert('Failed to approve load. Please try again.');
            }
          }
        }}
        disabled={approveMutation.isPending}
        className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
      >
        {approveMutation.isPending ? 'Approving...' : 'Approve Load'}
      </button>

      <button
        onClick={() => {
          // Future: Open correction request modal
          alert('Request Correction feature coming soon');
        }}
        className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
      >
        Request Correction
      </button>
    </div>

    {approveMutation.isError && (
      <p className="mt-3 text-red-400 text-sm">
        Failed to approve load: {approveMutation.error?.message}
      </p>
    )}
  </div>
)}
```

**Checkpoint:** Approve button works, confirmation prompt shows, status updates ✓

---

### 2.4 Sequential Load Blocking

**File:** `utils/loadBlockingLogic.ts` (NEW)

```typescript
import type { TruckingLoad } from '../types';

/**
 * Determine if customer can book next load
 * Blocks if previous load is not yet APPROVED
 */
export function canBookNextLoad(loads: TruckingLoad[]): {
  allowed: boolean;
  blockingLoad?: TruckingLoad;
  nextSequenceNumber: number;
} {
  if (loads.length === 0) {
    return { allowed: true, nextSequenceNumber: 1 };
  }

  // Sort by sequence number
  const sortedLoads = [...loads].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // Find first load that is not APPROVED or beyond
  const blockingLoad = sortedLoads.find(
    load => load.status === 'NEW' // Still awaiting approval
  );

  if (blockingLoad) {
    return {
      allowed: false,
      blockingLoad,
      nextSequenceNumber: sortedLoads.length + 1,
    };
  }

  // All loads are APPROVED or beyond, can book next
  return {
    allowed: true,
    nextSequenceNumber: sortedLoads.length + 1,
  };
}
```

**File:** `components/InboundShipmentWizard.tsx` (MODIFY)

Add at start of wizard (Step 1):

```typescript
import { canBookNextLoad } from '../utils/loadBlockingLogic';

// Inside component:
const existingLoads = request?.truckingLoads || [];
const loadCheck = canBookNextLoad(existingLoads);

if (!loadCheck.allowed && loadCheck.blockingLoad) {
  return (
    <Card className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-4">
        Load #{loadCheck.nextSequenceNumber} Blocked
      </h2>
      <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-6">
        <p className="text-yellow-300 mb-4">
          You must wait for Load #{loadCheck.blockingLoad.sequenceNumber} to be approved by MPS before booking the next load.
        </p>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-400">Load Status</dt>
            <dd className="text-white font-semibold">Awaiting MPS Approval</dd>
          </div>
          <div>
            <dt className="text-gray-400">Scheduled For</dt>
            <dd className="text-white">{formatDate(loadCheck.blockingLoad.scheduledSlotStart, true)}</dd>
          </div>
        </dl>
        <button
          onClick={onReturnToDashboard}
          className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
        >
          Return to Dashboard
        </button>
      </div>
    </Card>
  );
}

// Continue with normal wizard flow...
```

**Checkpoint:** Wizard blocks Load #2 until Load #1 is APPROVED ✓

---

## PHASE 3: COMPLETION & INVENTORY INTEGRATION

**Goal:** Close the loop - mark loads complete, create inventory
**Duration:** 8-10 hours
**Priority:** HIGH
**Agent Assignment:** Inventory Tracker + Database Integrity Guardian

### 3.1 Mark In-Transit Mutation

**File:** `hooks/useTruckingLoadTransitions.ts` (NEW)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { sendLoadInTransitNotification } from '../services/notificationService';

export function useMarkLoadInTransit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loadId: string) => {
      const { data, error } = await supabase
        .from('trucking_loads')
        .update({ status: 'IN_TRANSIT' })
        .eq('id', loadId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trucking-loads'] });
      sendLoadInTransitNotification({
        loadId: data.id,
        sequenceNumber: data.sequence_number,
        // ... other fields
      });
    },
  });
}
```

**Checkpoint:** In-Transit status transition works ✓

---

### 3.2 Load Completion Form

**File:** `components/admin/LoadCompletionForm.tsx` (NEW)

```typescript
import React, { useState } from 'react';
import { useCompleteTruckingLoad } from '../../hooks/useCompleteTruckingLoad';
import type { TruckingLoad } from '../../types';

interface LoadCompletionFormProps {
  load: TruckingLoad;
  onClose: () => void;
}

const LoadCompletionForm: React.FC<LoadCompletionFormProps> = ({ load, onClose }) => {
  const [actualJoints, setActualJoints] = useState(load.totalJointsPlanned || 0);
  const [actualLengthFt, setActualLengthFt] = useState(load.totalLengthFtPlanned || 0);
  const [actualWeightLbs, setActualWeightLbs] = useState(load.totalWeightLbsPlanned || 0);
  const [notes, setNotes] = useState('');

  const completeMutation = useCompleteTruckingLoad();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await completeMutation.mutateAsync({
        loadId: load.id,
        actualJoints,
        actualLengthFt,
        actualWeightLbs,
        notes,
      });
      onClose();
    } catch (error) {
      console.error('Failed to complete load:', error);
    }
  };

  const discrepancies = {
    joints: actualJoints !== load.totalJointsPlanned,
    length: Math.abs(actualLengthFt - (load.totalLengthFtPlanned || 0)) > 10,
    weight: Math.abs(actualWeightLbs - (load.totalWeightLbsPlanned || 0)) > 500,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-3xl border border-cyan-500 p-6 max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold text-white mb-4">
          Complete Load #{load.sequenceNumber}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Actual Counts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-1">
                Actual Joints
              </label>
              <input
                type="number"
                value={actualJoints}
                onChange={(e) => setActualJoints(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                required
              />
              {discrepancies.joints && (
                <p className="text-orange-400 text-xs mt-1">
                  Expected: {load.totalJointsPlanned} (Δ{actualJoints - (load.totalJointsPlanned || 0)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-400 mb-1">
                Actual Length (ft)
              </label>
              <input
                type="number"
                step="0.1"
                value={actualLengthFt}
                onChange={(e) => setActualLengthFt(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                required
              />
              {discrepancies.length && (
                <p className="text-orange-400 text-xs mt-1">
                  Expected: {load.totalLengthFtPlanned?.toFixed(1)} ft
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-1">
              Actual Weight (lbs)
            </label>
            <input
              type="number"
              step="0.1"
              value={actualWeightLbs}
              onChange={(e) => setActualWeightLbs(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              required
            />
            {discrepancies.weight && (
              <p className="text-orange-400 text-xs mt-1">
                Expected: {load.totalWeightLbsPlanned?.toLocaleString()} lbs
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-400 mb-1">
              Notes (discrepancies, damage, etc.)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              rows={3}
              placeholder="E.g., '2 joints damaged and rejected', 'All serials verified'"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={completeMutation.isPending}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold rounded-lg"
            >
              {completeMutation.isPending ? 'Completing...' : 'Mark Completed'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg"
            >
              Cancel
            </button>
          </div>

          {completeMutation.isError && (
            <p className="text-red-400 text-sm">
              Failed to complete load: {completeMutation.error?.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoadCompletionForm;
```

**Checkpoint:** Completion form captures actual counts, shows discrepancies ✓

---

### 3.3 Complete Load Mutation with Inventory Creation

**File:** `hooks/useCompleteTruckingLoad.ts` (NEW)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { createInventoryFromLoad } from '../services/inventoryService';
import { sendLoadCompletedNotification } from '../services/notificationService';

interface CompleteTruckingLoadInput {
  loadId: string;
  actualJoints: number;
  actualLengthFt: number;
  actualWeightLbs: number;
  notes?: string;
}

export function useCompleteTruckingLoad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompleteTruckingLoadInput) => {
      // Step 1: Update load with actual counts
      const { data: load, error: loadError } = await supabase
        .from('trucking_loads')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          total_joints_completed: input.actualJoints,
          total_length_ft_completed: input.actualLengthFt,
          total_weight_lbs_completed: input.actualWeightLbs,
          notes: input.notes || null,
        })
        .eq('id', input.loadId)
        .select(`
          *,
          storage_request:storage_requests!inner(
            *,
            company:companies!inner(*)
          )
        `)
        .single();

      if (loadError) throw loadError;

      // Step 2: Create inventory records
      await createInventoryFromLoad(load, input.actualJoints);

      // Step 3: Update rack occupancy
      const rackIds = load.storage_request.assigned_rack_ids || [];
      if (rackIds.length > 0) {
        await supabase.rpc('increment_rack_occupancy', {
          rack_ids: rackIds,
          joints_to_add: input.actualJoints,
        });
      }

      return load;
    },

    onSuccess: (load, input) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['trucking-loads'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['racks'] });
      queryClient.invalidateQueries({ queryKey: ['companies', 'summaries'] });
      queryClient.invalidateQueries({ queryKey: ['projectSummaries'] });

      // Send notifications
      sendLoadCompletedNotification({
        loadId: load.id,
        sequenceNumber: load.sequence_number,
        companyName: load.storage_request.company.name,
        referenceId: load.storage_request.reference_id,
        scheduledSlotStart: load.scheduled_slot_start,
        truckingCompany: load.trucking_company,
        actualJoints: input.actualJoints,
        actualLengthFt: input.actualLengthFt,
        discrepancies: input.notes,
      });

      console.log(`✅ Load #${load.sequence_number} completed, inventory created`);
    },

    onError: (error) => {
      console.error('❌ Failed to complete load:', error);
    },
  });
}
```

**Checkpoint:** Completion updates load, creates inventory, updates racks ✓

---

### 3.4 Inventory Creation Service

**File:** `services/inventoryService.ts` (NEW)

```typescript
import { supabase } from '../lib/supabase';
import type { TruckingLoad, StorageRequest } from '../types';

/**
 * Create inventory records from completed trucking load
 * Uses AI extracted manifest data from trucking_documents
 */
export async function createInventoryFromLoad(
  load: TruckingLoad & { storage_request: StorageRequest },
  actualJointsReceived: number
): Promise<void> {
  // Get AI extracted manifest items
  const { data: documents, error: docsError } = await supabase
    .from('trucking_documents')
    .select('parsed_payload')
    .eq('trucking_load_id', load.id);

  if (docsError) throw docsError;

  const manifestItems = documents.flatMap(doc => doc.parsed_payload || []);

  if (manifestItems.length === 0) {
    console.warn(`No manifest items found for load ${load.id}, skipping inventory creation`);
    return;
  }

  // Allocate to first assigned rack (or could split across multiple)
  const storageAreaId = load.storage_request.assigned_rack_ids?.[0];

  if (!storageAreaId) {
    console.warn(`No storage area assigned for load ${load.id}`);
  }

  // Create inventory records
  // Group by unique pipe specs (grade, OD, weight)
  const grouped = new Map<string, any>();

  for (const item of manifestItems) {
    const key = `${item.grade}-${item.outer_diameter}-${item.weight_lbs_ft}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        grade: item.grade,
        outer_diameter: item.outer_diameter,
        weight_lbs_ft: item.weight_lbs_ft,
        total_quantity: 0,
        total_length_ft: 0,
      });
    }

    const group = grouped.get(key)!;
    group.total_quantity += item.quantity || 1;
    group.total_length_ft += item.tally_length_ft * (item.quantity || 1);
  }

  // Insert inventory records
  const inventoryRecords = Array.from(grouped.values()).map(group => ({
    company_id: load.storage_request.company_id,
    request_id: load.storage_request.id,
    delivery_truck_load_id: load.id,
    reference_id: load.storage_request.reference_id,
    type: inferPipeType(group.grade),
    grade: group.grade,
    outer_diameter: group.outer_diameter,
    weight: group.weight_lbs_ft,
    length: group.total_length_ft / group.total_quantity, // Average length
    quantity: group.total_quantity,
    status: 'IN_STORAGE',
    storage_area_id: storageAreaId,
    drop_off_timestamp: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('inventory')
    .insert(inventoryRecords);

  if (insertError) throw insertError;

  console.log(`✅ Created ${inventoryRecords.length} inventory records for load ${load.id}`);
}

/**
 * Infer pipe type from grade
 */
function inferPipeType(grade: string): 'Drill Pipe' | 'Casing' | 'Tubing' | 'Line Pipe' {
  const gradeUpper = grade?.toUpperCase() || '';

  if (gradeUpper.includes('G') || gradeUpper.includes('E') || gradeUpper.includes('X')) {
    return 'Drill Pipe';
  }
  if (gradeUpper.includes('K55') || gradeUpper.includes('N80') || gradeUpper.includes('P110')) {
    return 'Casing';
  }
  if (gradeUpper.includes('J55') || gradeUpper.includes('C90')) {
    return 'Tubing';
  }

  return 'Line Pipe'; // Default
}
```

**Checkpoint:** Inventory created from manifest items, linked to load ✓

---

### 3.5 Add Completion Button to Modal

**File:** `components/admin/LoadDetailModal.tsx` (MODIFY)

Add state and import:

```typescript
import { useState } from 'react';
import LoadCompletionForm from './LoadCompletionForm';

// Inside component:
const [showCompletionForm, setShowCompletionForm] = useState(false);

// Add buttons to admin actions section:
{load.status === 'APPROVED' && (
  <button
    onClick={() => {
      // Mark in transit
      if (window.confirm('Mark this load as In Transit?')) {
        // Call useMarkLoadInTransit mutation
      }
    }}
    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
  >
    Mark In Transit
  </button>
)}

{(load.status === 'APPROVED' || load.status === 'IN_TRANSIT') && (
  <button
    onClick={() => setShowCompletionForm(true)}
    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg"
  >
    Mark Completed
  </button>
)}

{/* Completion Form Modal */}
{showCompletionForm && (
  <LoadCompletionForm
    load={load}
    onClose={() => setShowCompletionForm(false)}
  />
)}
```

**Checkpoint:** Completion workflow end-to-end functional ✓

---

## PHASE 4: POLISH & NOTIFICATIONS

**Goal:** Multi-load tracking, email notifications, calendar view
**Duration:** 8-12 hours
**Priority:** MEDIUM
**Agent Assignment:** Customer Journey Orchestrator + Integration Events Orchestrator

### 4.1 Multi-Load Progress Indicator

**File:** `components/LoadProgressIndicator.tsx` (NEW)

```typescript
import React from 'react';
import type { TruckingLoad } from '../types';

interface LoadProgressIndicatorProps {
  loads: TruckingLoad[];
  totalJointsRequired: number;
}

const LoadProgressIndicator: React.FC<LoadProgressIndicatorProps> = ({
  loads,
  totalJointsRequired,
}) => {
  const completedLoads = loads.filter(l => l.status === 'COMPLETED');
  const totalDelivered = completedLoads.reduce((sum, l) => sum + (l.totalJointsCompleted || 0), 0);
  const percentage = (totalDelivered / totalJointsRequired) * 100;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-400">Delivery Progress</span>
        <span className="text-sm font-bold text-white">
          {totalDelivered} / {totalJointsRequired} joints
        </span>
      </div>

      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>{loads.length} total loads</span>
        <span>{completedLoads.length} completed</span>
      </div>

      {loads.length > 0 && (
        <div className="mt-3 space-y-1">
          {loads.map(load => (
            <div key={load.id} className="flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  load.status === 'COMPLETED' ? 'bg-green-500' :
                  load.status === 'IN_TRANSIT' ? 'bg-blue-500' :
                  load.status === 'APPROVED' ? 'bg-cyan-500' :
                  'bg-yellow-500'
                }`}
              />
              <span className="text-gray-400">
                Load #{load.sequenceNumber}: {load.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoadProgressIndicator;
```

**Checkpoint:** Progress indicator shows X/Y joints delivered ✓

---

### 4.2 Email Notification Integration (Future)

**File:** `services/emailService.ts` (STUB for future)

```typescript
/**
 * Email notification service
 * Currently a stub - will be implemented by Integration Events Orchestrator agent
 *
 * When ready to implement:
 * 1. Install Resend SDK: npm install resend
 * 2. Add RESEND_API_KEY to environment variables
 * 3. Create email templates in templates/emails/
 * 4. Implement functions below
 */

interface EmailPayload {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

/**
 * Send email using Resend API
 * Placeholder for future implementation
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  console.log('📧 Email would be sent:', {
    to: payload.to,
    subject: payload.subject,
    template: payload.template,
  });

  // TODO: Implement with Resend
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'notifications@pipevault.com',
  //   to: payload.to,
  //   subject: payload.subject,
  //   html: renderTemplate(payload.template, payload.data),
  // });
}

/**
 * Send load approved email to customer
 */
export async function sendLoadApprovedEmail(customerEmail: string, loadData: any): Promise<void> {
  await sendEmail({
    to: customerEmail,
    subject: `Load #${loadData.sequenceNumber} Approved - ${loadData.referenceId}`,
    template: 'load-approved',
    data: loadData,
  });
}

/**
 * Send load completed email to customer
 */
export async function sendLoadCompletedEmail(customerEmail: string, loadData: any): Promise<void> {
  await sendEmail({
    to: customerEmail,
    subject: `Load #${loadData.sequenceNumber} Received - ${loadData.referenceId}`,
    template: 'load-completed',
    data: loadData,
  });
}
```

**Checkpoint:** Email service interface defined, ready for future implementation ✓

---

## AGENT ORCHESTRATION PLAN

### Agent Assignments by Phase

| Phase | Primary Agent | Support Agent | Tasks |
|-------|--------------|---------------|-------|
| **Phase 1** | UI/UX Guardian | Admin Ops Orchestrator | Pending loads UI, modal design |
| **Phase 2** | Admin Ops Orchestrator | Database Integrity Guardian | Approval workflow, sequential blocking |
| **Phase 3** | Inventory Tracker | Database Integrity Guardian | Completion, inventory creation |
| **Phase 4** | Customer Journey Orchestrator | Integration Events Orchestrator | Progress indicators, email stubs |

### Specialized Agent Roles

**UI/UX Guardian:**
- Design LoadDetailModal layout
- Ensure component accessibility
- Verify responsive design
- Test loading states

**Admin Ops Orchestrator:**
- Implement approval workflow
- Handle state transitions
- Coordinate notifications
- Test admin workflows

**Database Integrity Guardian:**
- Verify foreign keys
- Test RLS policies
- Ensure data integrity
- Validate state transitions

**Inventory Tracker:**
- Implement inventory creation
- Handle rack occupancy
- Validate quantities
- Test discrepancy handling

**Customer Journey Orchestrator:**
- Add progress indicators
- Test sequential blocking
- Verify customer experience
- Ensure status accuracy

**Integration Events Orchestrator:**
- Abstract notification service
- Prepare email integration
- Design webhook contracts
- Test Slack notifications

---

## TESTING CHECKPOINTS

### Phase 1 Testing
- [ ] Pending loads query returns correct data
- [ ] Tile displays all NEW loads
- [ ] Modal shows complete load details
- [ ] AI parsed data renders correctly
- [ ] Documents downloadable
- [ ] After-hours badge accurate

### Phase 2 Testing
- [ ] Approve button updates status
- [ ] Notification sent on approval
- [ ] Customer sees updated status
- [ ] Sequential blocking works
- [ ] In-transit status sets correctly

### Phase 3 Testing
- [ ] Completion form captures actual counts
- [ ] Discrepancies highlighted
- [ ] Inventory records created
- [ ] Rack occupancy updated
- [ ] Completion notification sent

### Phase 4 Testing
- [ ] Progress indicator calculates correctly
- [ ] Multi-load tracking accurate
- [ ] Email service interfaces work
- [ ] All notifications fire properly

---

## SUCCESS CRITERIA

### Minimum Viable (Production Block Removed)
✅ Admin can see pending loads
✅ Admin can approve loads
✅ Customer sees approved status
✅ Slack notifications work

### Full Production Ready
✅ All state transitions functional
✅ Inventory auto-created
✅ Sequential blocking enforced
✅ Progress tracking accurate
✅ Email notifications ready (or stubbed)

---

## RISK MITIGATION

### Technical Risks

**Risk:** Duplicate foreign keys cause query errors
**Mitigation:** Use `!fk_name` syntax in all queries
**Status:** Resolved in Phase 1

**Risk:** Race conditions in inventory creation
**Mitigation:** Use database transactions
**Status:** Handled in Phase 3

**Risk:** RLS policies block admin access
**Mitigation:** Test with service role
**Status:** Monitor in Phase 1

### Process Risks

**Risk:** Sequential blocking too restrictive
**Mitigation:** User can override with admin approval
**Status:** Design flexibility in Phase 2

**Risk:** Email integration delays project
**Mitigation:** Stub email service, Slack as primary
**Status:** Planned in Phase 4

---

## DEPLOYMENT CHECKLIST

### Before Manual Testing
- [ ] Phase 1 complete (pending loads UI)
- [ ] Phase 2 complete (approval workflow)
- [ ] Database migrations applied
- [ ] RLS policies verified
- [ ] Test data seeded

### Before Production
- [ ] Phase 3 complete (completion workflow)
- [ ] Phase 4 complete (notifications)
- [ ] All tests passing
- [ ] Performance acceptable (<2s page load)
- [ ] Error handling robust
- [ ] Documentation updated

---

## TIMELINE ESTIMATE

| Phase | Duration | Dependencies | Start After |
|-------|----------|--------------|-------------|
| Phase 1 | 6-8 hours | None | Immediate |
| Phase 2 | 8-10 hours | Phase 1 complete | Day 2 |
| Phase 3 | 8-10 hours | Phase 2 complete | Day 3 |
| Phase 4 | 8-12 hours | Phase 3 complete | Day 4-5 |
| **Total** | **30-40 hours** | Sequential | **4-6 days** |

---

**Status:** Ready for implementation
**Confidence:** High - Clear path, no blockers
**Recommendation:** Begin Phase 1 immediately for manual testing readiness

---

**Next Steps:**
1. Review plan with user
2. Confirm priority decisions (sequential blocking, email timeline)
3. Assign agents to Phase 1
4. Begin implementation
