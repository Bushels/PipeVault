/**
 * Admin Dashboard - Complete Backend Management System
 * Features: Approval workflow, global search, AI assistant, analytics
 */

import React, { useState, useMemo } from 'react';
import type {
  AdminSession,
  StorageRequest,
  Company,
  Yard,
  Pipe,
  TruckLoad,
  RequestStatus,
  Shipment,
  ShipmentTruck,
  ShipmentItem,
  ShipmentDocument,
  DockAppointment,
} from '../../types';
import AdminHeader from './AdminHeader';
import AdminAIAssistant from './AdminAIAssistant';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { formatDate, formatStatus } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';
import * as calendarService from '../../services/calendarService';
import * as emailService from '../../services/emailService';
import {
  useUpdateShipment,
  useUpdateShipmentTruck,
  useUpdateShipmentItem,
  useUpdateDockAppointment,
  useUpdateInventoryItem,
} from '../../hooks/useSupabaseData';

interface AdminDashboardProps {
  session: AdminSession;
  onLogout: () => void;
  requests: StorageRequest[];
  companies: Company[];
  yards: Yard[];
  inventory: Pipe[];
  truckLoads: TruckLoad[];
  shipments: Shipment[];
  approveRequest: (requestId: string, assignedRackIds: string[], requiredJoints: number, notes?: string) => void;
  rejectRequest: (requestId: string, reason: string) => void;
  addTruckLoad: (truckLoad: Omit<TruckLoad, 'id'>) => void;
  pickUpPipes: (pipeIds: string[], uwi: string, wellName: string, truckLoadId?: string) => void;
  updateRequest: (request: StorageRequest) => Promise<unknown>;
}

type TabType = 'overview' | 'approvals' | 'requests' | 'companies' | 'inventory' | 'storage' | 'shipments' | 'ai';

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  onLogout,
  requests,
  companies,
  yards,
  inventory,
  truckLoads,
  shipments,
  approveRequest,
  rejectRequest,
  addTruckLoad,
  pickUpPipes,
  updateRequest,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [globalSearch, setGlobalSearch] = useState('');
  const [requestFilter, setRequestFilter] = useState<'ALL' | RequestStatus>('ALL');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [notesSavingId, setNotesSavingId] = useState<string | null>(null);
  const [processingTruckId, setProcessingTruckId] = useState<string | null>(null);
  const [shipmentsMessage, setShipmentsMessage] = useState<string | null>(null);
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);

  const updateShipmentMutation = useUpdateShipment();
  const updateShipmentTruckMutation = useUpdateShipmentTruck();
  const updateShipmentItemMutation = useUpdateShipmentItem();
  const updateDockAppointmentMutation = useUpdateDockAppointment();
  const updateInventoryItemMutation = useUpdateInventoryItem();

  const companyMap = useMemo(() => new Map(companies.map(company => [company.id, company])), [companies]);
  const requestMap = useMemo(() => new Map(requests.map(request => [request.id, request])), [requests]);
  const inventoryMap = useMemo(() => new Map(inventory.map(item => [item.id, item])), [inventory]);

  const truckEntries = useMemo<
    Array<{
      shipment: Shipment;
      truck: ShipmentTruck;
      appointment?: DockAppointment;
      documents: ShipmentDocument[];
      manifestItems: ShipmentItem[];
    }>
  >(
    () =>
      shipments.flatMap(shipment => {
        const appointmentMap = new Map<string, DockAppointment>();
        (shipment.appointments ?? []).forEach(appt => {
          if (appt.truckId) {
            appointmentMap.set(appt.truckId, appt);
          }
        });

        const documentsByTruck = new Map<string, ShipmentDocument[]>();
        (shipment.documents ?? []).forEach(doc => {
          const key = doc.truckId ?? 'general';
          const existing = documentsByTruck.get(key) ?? [];
          documentsByTruck.set(key, [...existing, doc]);
        });

        const manifestByTruck = new Map<string, ShipmentItem[]>();
        (shipment.manifestItems ?? []).forEach(item => {
          const key = item.truckId ?? 'general';
          const existing = manifestByTruck.get(key) ?? [];
          manifestByTruck.set(key, [...existing, item]);
        });

        return (shipment.trucks ?? []).map(truck => ({
          shipment,
          truck,
          appointment: appointmentMap.get(truck.id),
          documents: documentsByTruck.get(truck.id) ?? [],
          manifestItems: manifestByTruck.get(truck.id) ?? [],
        }));
      }),
    [shipments],
  );

  const pendingTruckEntries = useMemo(
    () => truckEntries.filter(entry => entry.truck.status !== 'RECEIVED'),
    [truckEntries],
  );

  const sortedPendingTruckEntries = useMemo(
    () =>
      pendingTruckEntries
        .slice()
        .sort((a, b) => {
          const aTime = a.appointment?.slotStart
            ? new Date(a.appointment.slotStart).getTime()
            : Number.POSITIVE_INFINITY;
          const bTime = b.appointment?.slotStart
            ? new Date(b.appointment.slotStart).getTime()
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        }),
    [pendingTruckEntries],
  );

  const recentlyReceivedEntries = useMemo(
    () =>
      truckEntries
        .filter(entry => entry.truck.status === 'RECEIVED')
        .sort((a, b) => {
          const aTime = a.truck.departureTime
            ? new Date(a.truck.departureTime).getTime()
            : a.truck.updatedAt
              ? new Date(a.truck.updatedAt).getTime()
              : 0;
          const bTime = b.truck.departureTime
            ? new Date(b.truck.departureTime).getTime()
            : b.truck.updatedAt
              ? new Date(b.truck.updatedAt).getTime()
              : 0;
          return bTime - aTime;
        })
        .slice(0, 6),
    [truckEntries],
  );

  const manifestInTransitEntries = useMemo(
    () =>
      shipments.flatMap(shipment => {
        const trucksById = new Map((shipment.trucks ?? []).map(truck => [truck.id, truck]));
        const documentsById = new Map((shipment.documents ?? []).map(doc => [doc.id, doc]));

        return (shipment.manifestItems ?? [])
          .filter(item => item.status === 'IN_TRANSIT')
          .map(item => ({
            shipment,
            truck: item.truckId ? trucksById.get(item.truckId) : undefined,
            document: item.documentId ? documentsById.get(item.documentId) : undefined,
            inventory: item.inventoryId ? inventoryMap.get(item.inventoryId) : undefined,
            item,
          }));
      }),
    [shipments, inventoryMap],
  );

  const getTruckStatusClasses = (status: ShipmentTruck['status']) => {
    switch (status) {
      case 'INBOUND':
      case 'SCHEDULED':
        return 'border-blue-500/60 text-blue-300 bg-blue-500/10';
      case 'ON_SITE':
        return 'border-amber-500/60 text-amber-300 bg-amber-500/10';
      case 'RECEIVED':
        return 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10';
      case 'CANCELLED':
        return 'border-rose-500/60 text-rose-300 bg-rose-500/10';
      default:
        return 'border-gray-600 text-gray-300 bg-gray-700/40';
    }
  };

  const formatSlotWindow = (appointment?: DockAppointment) => {
    if (!appointment?.slotStart) return 'Not scheduled';
    const start = new Date(appointment.slotStart);
    const end = appointment.slotEnd ? new Date(appointment.slotEnd) : new Date(start.getTime() + 30 * 60 * 1000);
    const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateLabel} • ${startTime} - ${endTime}`;
  };

  const getDraftNote = (request: StorageRequest) =>
    notesDraft.hasOwnProperty(request.id)
      ? notesDraft[request.id]
      : request.internalNotes ?? '';

  const handleNotesChange = (requestId: string, value: string) => {
    setNotesDraft(prev => ({ ...prev, [requestId]: value }));
  };

  const handleNotesReset = (requestId: string) => {
    setNotesDraft(prev => {
      const { [requestId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleNotesSave = async (request: StorageRequest) => {
    const draft = getDraftNote(request);
    const trimmed = draft.trim();
    const internalNotes = trimmed.length > 0 ? trimmed : null;

    setNotesSavingId(request.id);
    try {
      await updateRequest({ ...request, internalNotes });
      setNotesDraft(prev => {
        const { [request.id]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error('Error saving internal notes:', error);
      alert('Unable to save internal notes. Please try again or contact support.');
  } finally {
    setNotesSavingId(null);
  }
};

  const handlePreviewShipmentDocument = async (document: ShipmentDocument) => {
    setShipmentsError(null);
    if (!document.storagePath) {
      setShipmentsError('Document path is unavailable for preview.');
      return;
    }

    const { data, error } = await supabase.storage.from('documents').createSignedUrl(document.storagePath, 300);
    if (error || !data?.signedUrl) {
      setShipmentsError('Unable to open document preview right now.');
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const handleMarkTruckReceived = async (entry: {
    shipment: Shipment;
    truck: ShipmentTruck;
    appointment?: DockAppointment;
    documents: ShipmentDocument[];
    manifestItems: ShipmentItem[];
  }) => {
    setShipmentsError(null);
    setShipmentsMessage(null);
    setProcessingTruckId(entry.truck.id);

    try {
      await updateShipmentTruckMutation.mutateAsync({
        id: entry.truck.id,
        shipmentId: entry.shipment.id,
        updates: {
          status: 'RECEIVED',
          arrivalTime: entry.truck.arrivalTime ?? new Date().toISOString(),
          departureTime: new Date().toISOString(),
          manifestReceived: true,
        },
      });

      if (entry.appointment?.id) {
        await updateDockAppointmentMutation.mutateAsync({
          id: entry.appointment.id,
          shipmentId: entry.shipment.id,
          updates: {
            status: 'COMPLETED',
            truckId: entry.truck.id,
            calendarSyncStatus: 'PENDING',
          },
        });
      }

      for (const item of entry.manifestItems) {
        await updateShipmentItemMutation.mutateAsync({
          id: item.id,
          shipmentId: entry.shipment.id,
          updates: { status: 'IN_STORAGE' },
        });

        if (item.inventoryId) {
          await updateInventoryItemMutation.mutateAsync({
            id: item.inventoryId,
            updates: {
              status: 'IN_STORAGE',
              dropOffTimestamp: new Date().toISOString(),
            },
          });
        }
      }

      const remainingTrucks = (entry.shipment.trucks ?? []).some(
        truck => truck.id !== entry.truck.id && truck.status !== 'RECEIVED',
      );

      let notificationTimestamp: string | null = null;

      if (!remainingTrucks) {
        notificationTimestamp = new Date().toISOString();

        await updateShipmentMutation.mutateAsync({
          id: entry.shipment.id,
          updates: { status: 'RECEIVED', latestCustomerNotificationAt: notificationTimestamp },
        });

        const request = requestMap.get(entry.shipment.requestId);
        const company = companyMap.get(entry.shipment.companyId);

        if (request?.userId) {
          try {
            await emailService.sendShipmentReceivedEmail({
              to: request.userId,
              referenceId: request.referenceId ?? entry.shipment.requestId,
              companyName: company?.name,
              trucksReceived: entry.shipment.trucks?.length ?? 1,
              manifestLines: entry.shipment.manifestItems?.length ?? 0,
              documentsAttached: entry.shipment.documents?.length ?? 0,
              receivedAt: notificationTimestamp,
            });
          } catch (emailError) {
            console.error('Failed to send shipment receipt email', emailError);
          }
        }
      }

      const message = !remainingTrucks
        ? `Truck #${entry.truck.sequenceNumber} marked as received. Shipment now in storage and customer notified.`
        : `Truck #${entry.truck.sequenceNumber} marked as received.`;
      setShipmentsMessage(message);
    } catch (error: any) {
      console.error('Failed to update truck status', error);
      setShipmentsError(error.message || 'Unable to update truck status. Please try again.');
    } finally {
      setProcessingTruckId(null);
    }
  };

  const handleSyncCalendar = async (entry: {
    shipment: Shipment;
    truck: ShipmentTruck;
    appointment?: DockAppointment;
  }) => {
    setShipmentsError(null);
    setShipmentsMessage(null);

    if (!entry.appointment) {
      setShipmentsError('Schedule an unloading time before syncing to Outlook.');
      return;
    }

    setProcessingTruckId(entry.truck.id);

    try {
      const start = new Date(entry.appointment.slotStart);
      const slotEndIso =
        entry.appointment.slotEnd ?? new Date(start.getTime() + 30 * 60 * 1000).toISOString();
      const reminder24h = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      const reminder1h = new Date(start.getTime() - 60 * 60 * 1000);

      const reminder24hIso = reminder24h.getTime() > Date.now() ? reminder24h.toISOString() : null;
      const reminder1hIso = reminder1h.getTime() > Date.now() ? reminder1h.toISOString() : null;

      const company = companyMap.get(entry.shipment.companyId);
      const request = requestMap.get(entry.shipment.requestId);

      const calendarResult = await calendarService.scheduleDockAppointment({
        shipmentId: entry.shipment.id,
        truckId: entry.truck.id,
        companyName: company?.name ?? 'Unknown Company',
        referenceId: request?.referenceId ?? entry.shipment.requestId,
        slotStart: entry.appointment.slotStart,
        slotEnd: slotEndIso,
        afterHours: Boolean(entry.appointment.afterHours),
      });

      await updateDockAppointmentMutation.mutateAsync({
        id: entry.appointment.id,
        shipmentId: entry.shipment.id,
        updates: {
          status: entry.appointment.status === 'PENDING' ? 'CONFIRMED' : entry.appointment.status,
          slotEnd: slotEndIso,
          calendarEventId: calendarResult.eventId,
          calendarSyncStatus: 'SYNCED',
          reminder24hSentAt: reminder24hIso,
          reminder1hSentAt: reminder1hIso,
        },
      });

      await updateShipmentMutation.mutateAsync({
        id: entry.shipment.id,
        updates: {
          calendarSyncStatus: 'SYNCED',
        },
      });

      setShipmentsMessage(`Outlook invitation prepared for Truck #${entry.truck.sequenceNumber}.`);
    } catch (error: any) {
      console.error('Failed to sync shipment calendar', error);
      setShipmentsError(error.message || 'Unable to sync with Outlook calendar right now.');
    } finally {
      setProcessingTruckId(null);
    }
  };

  // ===== ANALYTICS =====
  const analytics = useMemo(() => {
    const pending = requests.filter(r => r.status === 'PENDING').length;
    const approved = requests.filter(r => r.status === 'APPROVED').length;
    const completed = requests.filter(r => r.status === 'COMPLETED').length;
    const rejected = requests.filter(r => r.status === 'REJECTED').length;

    const totalCapacity = yards.reduce((sum, yard) =>
      sum + yard.areas.reduce((asum, area) =>
        asum + area.racks.reduce((rsum, rack) => rsum + rack.capacityMeters, 0), 0), 0);
    const totalOccupied = yards.reduce((sum, yard) =>
      sum + yard.areas.reduce((asum, area) =>
        asum + area.racks.reduce((rsum, rack) => rsum + (rack.occupiedMeters || 0), 0), 0), 0);
    const utilization = totalCapacity > 0 ? (totalOccupied / totalCapacity * 100) : 0;

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;

    const requestMap = new Map<string, StorageRequest>();
    requests.forEach((req) => requestMap.set(req.id, req));

    const pickupLoads = truckLoads.filter(load => load.type === 'PICKUP');
    const upcomingPickups = pickupLoads
      .map(load => ({
        load,
        date: new Date(load.arrivalTime),
      }))
      .filter(({ date }) => !Number.isNaN(date.getTime()) && date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const nextPickupInfo = upcomingPickups[0] ?? null;
    const nextPickupDays = nextPickupInfo
      ? Math.max(0, Math.ceil((nextPickupInfo.date.getTime() - now.getTime()) / msPerDay))
      : null;

    const pickupsThisMonthCompanies = new Set<string>();
    pickupLoads.forEach(load => {
      const date = new Date(load.arrivalTime);
      if (Number.isNaN(date.getTime())) return;
      if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
        const related = load.relatedRequestId ? requestMap.get(load.relatedRequestId) : undefined;
        if (related) {
          pickupsThisMonthCompanies.add(related.companyId);
        }
      }
    });

    const pendingTruckingQuotes = requests.filter(
      req => req.status === 'PENDING' && req.truckingInfo?.truckingType === 'quote'
    );

    const shipmentsPending = shipments.filter(s =>
      s.status === 'SCHEDULING' || s.status === 'SCHEDULED' || s.status === 'IN_TRANSIT'
    ).length;

    const nextTruckEntry = pendingTruckEntries
      .filter(entry => entry.appointment?.slotStart)
      .slice()
      .sort((a, b) => {
        const aTime = a.appointment?.slotStart ? new Date(a.appointment.slotStart).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.appointment?.slotStart ? new Date(b.appointment.slotStart).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })[0] ?? null;

    const afterHoursRequests = shipments.reduce(
      (count, shipment) => count + (shipment.appointments ?? []).filter(appt => appt.afterHours).length,
      0,
    );

    return {
      requests: { total: requests.length, pending, approved, completed, rejected },
      storage: { totalCapacity, totalOccupied, available: totalCapacity - totalOccupied, utilization },
      companies: companies.length,
      inventory: { total: inventory.length, inStorage: inventory.filter(p => p.status === 'IN_STORAGE').length },
      operational: {
        companiesPickingUpThisMonth: pickupsThisMonthCompanies.size,
        nextPickupDays,
        nextPickupDate: nextPickupInfo?.load.arrivalTime ?? null,
        pendingTruckingQuotes: pendingTruckingQuotes.length,
      },
      logistics: {
        shipmentsPending,
        trucksPending: pendingTruckEntries.length,
        nextTruckEta: nextTruckEntry?.appointment?.slotStart ?? null,
        afterHoursRequests,
      },
    };
  }, [requests, yards, companies, inventory, truckLoads, shipments, pendingTruckEntries]);

  // ===== GLOBAL SEARCH =====
  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return null;

    const term = globalSearch.toLowerCase();
    const matchedRequests = requests.filter(r =>
      r.referenceId.toLowerCase().includes(term) ||
      r.userId.toLowerCase().includes(term) ||
      r.requestDetails?.companyName.toLowerCase().includes(term)
    );
    const matchedCompanies = companies.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.domain.toLowerCase().includes(term)
    );
    const matchedInventory = inventory.filter(p =>
      p.referenceId?.toLowerCase().includes(term) ||
      p.assignedWellName?.toLowerCase().includes(term)
    );

    return { requests: matchedRequests, companies: matchedCompanies, inventory: matchedInventory };
  }, [globalSearch, requests, companies, inventory]);

  // ===== TAB NAVIGATION =====
  const tabs: Array<{ id: TabType; label: string; badge?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'approvals', label: 'Approvals', badge: analytics.requests.pending },
    { id: 'requests', label: 'All Requests', badge: requests.length },
    { id: 'companies', label: 'Companies', badge: companies.length },
    { id: 'inventory', label: 'Inventory', badge: inventory.length },
    { id: 'storage', label: 'Storage', badge: yards.length },
    { id: 'shipments', label: 'Shipments', badge: analytics.logistics?.trucksPending },
    { id: 'ai', label: 'AI Assistant' },
  ];

  // ===== RENDER FUNCTIONS =====
  const renderOverview = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <h3 className="text-sm text-gray-400 mb-2">Pending Approvals</h3>
          <div className="flex items-end justify-between">
            <p className="text-4xl font-bold text-yellow-500">{analytics.requests.pending}</p>
            <Button
              onClick={() => setActiveTab('approvals')}
              className="text-sm px-3 py-1 bg-yellow-600 hover:bg-yellow-700"
            >
              Review
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm text-gray-400 mb-2">Storage Utilization</h3>
          <p className="text-4xl font-bold text-blue-500">{analytics.storage.utilization.toFixed(1)}%</p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${analytics.storage.utilization}%` }}
            ></div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm text-gray-400 mb-2">Total Requests</h3>
          <p className="text-4xl font-bold text-white">{analytics.requests.total}</p>
          <p className="text-xs text-gray-500 mt-2">
            {analytics.requests.approved} approved, {analytics.requests.completed} completed
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm text-gray-400 mb-2">Available Space</h3>
          <p className="text-4xl font-bold text-green-500">
            {analytics.storage.available.toFixed(0)}m
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {analytics.storage.totalCapacity.toFixed(0)}m total capacity
          </p>
        </Card>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Operational Highlights</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>
            There {analytics.operational.companiesPickingUpThisMonth === 1 ? 'is' : 'are'}{' '}
            <span className="text-white font-semibold">{analytics.operational.companiesPickingUpThisMonth}</span>{' '}
            company{analytics.operational.companiesPickingUpThisMonth === 1 ? '' : 'ies'} scheduled to pick up pipe this month.
          </li>
          <li>
            {analytics.operational.nextPickupDays !== null ? (
              <>
                Next storage pickup in{' '}
                <span className="text-white font-semibold">
                  {analytics.operational.nextPickupDays} day{analytics.operational.nextPickupDays === 1 ? '' : 's'}
                </span>
                {analytics.operational.nextPickupDate && (
                  <> ({formatDate(analytics.operational.nextPickupDate, true)})</>
                )}
              </>
            ) : (
              'No upcoming pickups scheduled.'
            )}
          </li>
          <li>
            {analytics.operational.pendingTruckingQuotes > 0 ? (
              <>
                Reminder: follow up on{' '}
                <span className="text-white font-semibold">
                  {analytics.operational.pendingTruckingQuotes} pending trucking quote
                  {analytics.operational.pendingTruckingQuotes === 1 ? '' : 's'}.
                </span>
              </>
            ) : (
              'All pending trucking quotes have been addressed.'
            )}
          </li>
        </ul>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Request Status Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Pending', count: analytics.requests.pending, color: 'yellow' },
              { label: 'Approved', count: analytics.requests.approved, color: 'green' },
              { label: 'Completed', count: analytics.requests.completed, color: 'blue' },
              { label: 'Rejected', count: analytics.requests.rejected, color: 'red' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-gray-300">{label}</span>
                <span className={`text-${color}-500 font-semibold`}>{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Storage by Yard</h3>
          <div className="space-y-3">
            {yards.map(yard => {
              const capacity = yard.areas.reduce((sum, a) =>
                sum + a.racks.reduce((s, r) => s + r.capacityMeters, 0), 0);
              const occupied = yard.areas.reduce((sum, a) =>
                sum + a.racks.reduce((s, r) => s + (r.occupiedMeters || 0), 0), 0);
              const util = capacity > 0 ? (occupied / capacity * 100) : 0;

              return (
                <div key={yard.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-300 text-sm">{yard.name}</span>
                    <span className="text-xs text-gray-500">{util.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${util}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Requests</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="text-left py-2 text-gray-400">Reference ID</th>
                <th className="text-left py-2 text-gray-400">Company</th>
                <th className="text-left py-2 text-gray-400">Status</th>
                <th className="text-left py-2 text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 5).map(req => (
                <tr key={req.id} className="border-b border-gray-800">
                  <td className="py-3 text-gray-300">{req.referenceId}</td>
                  <td className="py-3 text-gray-300">
                    {companies.find(c => c.id === req.companyId)?.name || 'Unknown'}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      req.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                      req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                      req.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 text-xs">
                    {req.requestDetails?.storageStartDate || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderApprovals = () => {
    const pendingRequests = requests.filter(r => r.status === 'PENDING');

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Pending Approvals</h2>
          <span className="text-gray-400">{pendingRequests.length} pending</span>
        </div>

        {pendingRequests.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="text-lg font-medium text-gray-400">No Pending Approvals</h3>
            <p className="text-sm text-gray-500 mt-2">All requests have been processed!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map(request => (
              <ApprovalCard
                key={request.id}
                request={request}
                company={companies.find(c => c.id === request.companyId)}
                yards={yards}
                onApprove={approveRequest}
                onReject={rejectRequest}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRequests = () => {
    const filteredRequests = requests.filter(r =>
      requestFilter === 'ALL' || r.status === requestFilter
    );
    const buildPipeSummary = (req: StorageRequest) => {
      const d = req.requestDetails;
      if (!d) return '-';
      const lines: string[] = [];
      const itemType =
        d.itemType === 'Other' && d.itemTypeOther ? `Other (${d.itemTypeOther})` : d.itemType;
      if (itemType) lines.push(itemType);
      const grade =
        d.grade === 'Other' && d.gradeOther ? `Grade: ${d.gradeOther}` : d.grade ? `Grade: ${d.grade}` : '';
      if (grade) lines.push(grade);
      const connection =
        d.connection === 'Other' && d.connectionOther
          ? `Connection: ${d.connectionOther}`
          : d.connection
          ? `Connection: ${d.connection}`
          : '';
      if (connection) lines.push(connection);
      if (d.threadType) {
        lines.push(`Thread: ${d.threadType}`);
      }
      if (typeof d.totalJoints === 'number' && typeof d.avgJointLength === 'number') {
        lines.push(`${d.totalJoints} joints @ ${d.avgJointLength} m`);
      }
      if (d.casingSpec) {
        if (typeof d.casingSpec.size_mm === 'number' && typeof d.casingSpec.size_in === 'number') {
          const mmDisplay = Number(d.casingSpec.size_mm.toFixed(2));
          const inchDisplay = Number(d.casingSpec.size_in.toFixed(3));
          lines.push(`OD: ${mmDisplay} (${inchDisplay})`);
        }
        if (typeof d.casingSpec.weight_lbs_ft === 'number') {
          const kgPerMeter = d.casingSpec.weight_lbs_ft * 1.48816394;
          lines.push(`Wt: ${kgPerMeter.toFixed(1)} (${d.casingSpec.weight_lbs_ft.toFixed(1)})`);
        }
      }
      return lines.length ? lines.join('\n') : '-';
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <h2 className="text-2xl font-bold text-white">All Requests</h2>
          <select
            value={requestFilter}
            onChange={e => setRequestFilter(e.target.value as any)}
            className="bg-gray-800 text-white border border-gray-600 rounded-md px-4 py-2 focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">All Statuses ({requests.length})</option>
            <option value="PENDING">Pending ({analytics.requests.pending})</option>
            <option value="APPROVED">Approved ({analytics.requests.approved})</option>
            <option value="COMPLETED">Completed ({analytics.requests.completed})</option>
            <option value="REJECTED">Rejected ({analytics.requests.rejected})</option>
          </select>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="text-left py-3 px-4 text-gray-400">Reference ID</th>
                <th className="text-left py-3 px-4 text-gray-400">Company</th>
                <th className="text-left py-3 px-4 text-gray-400">Contact</th>
                <th className="text-left py-3 px-4 text-gray-400">Pipe Details</th>
                <th className="text-left py-3 px-4 text-gray-400">Total Length (m)</th>
                <th className="text-left py-3 px-4 text-gray-400">Status</th>
                <th className="text-left py-3 px-4 text-gray-400">Location</th>
                <th className="text-left py-3 px-4 text-gray-400">Approved</th>
                <th className="text-left py-3 px-4 text-gray-400">Approved By</th>
                <th className="text-left py-3 px-4 text-gray-400">Internal Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                const totalMeters =
                  req.requestDetails && typeof req.requestDetails.avgJointLength === 'number' && typeof req.requestDetails.totalJoints === 'number'
                    ? req.requestDetails.avgJointLength * req.requestDetails.totalJoints
                    : null;
                const originalNote = req.internalNotes ?? '';
                const noteValue = getDraftNote(req);
                const isDirty = noteValue !== originalNote;
                const isSaving = notesSavingId === req.id;

                return (
                <tr key={req.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-4 font-medium text-white">{req.referenceId}</td>
                  <td className="py-3 px-4 text-gray-300">
                    {companies.find(c => c.id === req.companyId)?.name || 'Unknown'}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{req.userId}</td>
                  <td className="py-3 px-4 text-gray-300 whitespace-pre-wrap">{buildPipeSummary(req)}</td>
                  <td className="py-3 px-4 text-gray-300">
                    {totalMeters !== null ? totalMeters.toFixed(1) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      req.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                      req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                      req.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{req.assignedLocation || '-'}</td>
                  <td className="py-3 px-4 text-gray-300">
                    {req.approvedAt ? formatDate(req.approvedAt, true) : '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-300">{req.approvedBy || '-'}</td>
                  <td className="py-3 px-4 text-gray-400 text-xs whitespace-pre-wrap">
                    <textarea
                      className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y"
                      rows={3}
                      value={noteValue}
                      onChange={e => handleNotesChange(req.id, e.target.value)}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleNotesSave(req)}
                        disabled={isSaving || !isDirty}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      {isDirty && (
                        <button
                          type="button"
                          className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleNotesReset(req.id)}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  const renderCompanies = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Companies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(company => {
          const companyRequests = requests.filter(r => r.companyId === company.id);
          const companyInventory = inventory.filter(i => i.companyId === company.id);

          return (
            <Card key={company.id} className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">{company.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{company.domain}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Requests:</span>
                  <span className="text-white font-medium">{companyRequests.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Inventory:</span>
                  <span className="text-white font-medium">{companyInventory.length} pipes</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Inventory</h2>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-700">
            <tr>
              <th className="text-left py-3 px-4 text-gray-400">Pipe ID</th>
              <th className="text-left py-3 px-4 text-gray-400">Company</th>
              <th className="text-left py-3 px-4 text-gray-400">Reference ID</th>
              <th className="text-left py-3 px-4 text-gray-400">Rack</th>
              <th className="text-left py-3 px-4 text-gray-400">Status</th>
              <th className="text-left py-3 px-4 text-gray-400">Well Name</th>
            </tr>
          </thead>
          <tbody>
            {inventory.slice(0, 50).map(pipe => (
              <tr key={pipe.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-3 px-4 font-mono text-xs text-gray-400">{pipe.id}</td>
                <td className="py-3 px-4 text-gray-300">
                  {companies.find(c => c.id === pipe.companyId)?.name || 'Unknown'}
                </td>
                <td className="py-3 px-4 text-white font-medium">{pipe.referenceId}</td>
                <td className="py-3 px-4 text-gray-400">{pipe.rackId || '-'}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    pipe.status === 'IN_STORAGE' ? 'bg-green-500/20 text-green-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {pipe.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-400">{pipe.assignedWellName || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  const renderStorage = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Storage Overview</h2>
      {yards.map(yard => {
        const yardCapacity = yard.areas.reduce((sum, a) =>
          sum + a.racks.reduce((s, r) => s + r.capacityMeters, 0), 0);
        const yardOccupied = yard.areas.reduce((sum, a) =>
          sum + a.racks.reduce((s, r) => s + (r.occupiedMeters || 0), 0), 0);
        const yardUtil = yardCapacity > 0 ? (yardOccupied / yardCapacity * 100) : 0;

        return (
          <Card key={yard.id} className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">{yard.name}</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Utilization: {yardUtil.toFixed(1)}%</span>
                <span className="text-gray-400">
                  {yardOccupied.toFixed(0)} / {yardCapacity.toFixed(0)} meters
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div className="bg-red-500 h-3 rounded-full" style={{ width: `${yardUtil}%` }}></div>
              </div>
            </div>

            <div className="space-y-4">
              {yard.areas.map(area => {
                const areaCapacity = area.racks.reduce((s, r) => s + r.capacityMeters, 0);
                const areaOccupied = area.racks.reduce((s, r) => s + (r.occupiedMeters || 0), 0);
                const areaUtil = areaCapacity > 0 ? (areaOccupied / areaCapacity * 100) : 0;

                return (
                  <div key={area.id} className="pl-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">{area.name} Area</h4>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-500">{areaUtil.toFixed(1)}% full</span>
                      <span className="text-gray-500">{area.racks.length} racks</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                      {area.racks.map(rack => {
                        const rackUtil = rack.capacity > 0 ? (rack.occupied / rack.capacity * 100) : 0;
                        return (
                          <div
                            key={rack.id}
                            className="bg-gray-800 p-2 rounded text-center border-2"
                            style={{
                              borderColor: rackUtil > 90 ? '#ef4444' : rackUtil > 50 ? '#eab308' : '#22c55e'
                            }}
                          >
                            <p className="text-xs font-semibold text-white">{rack.name}</p>
                            <p className="text-xs text-gray-400">{rack.occupied}/{rack.capacity}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );

  const renderShipments = () => {
    const activeShipments = shipments.filter(
      shipment => shipment.status !== 'RECEIVED' && shipment.status !== 'CANCELLED',
    );

    const unsyncedAppointments = activeShipments
      .flatMap(shipment => shipment.appointments ?? [])
      .filter(appointment => appointment.status !== 'COMPLETED' && appointment.calendarSyncStatus !== 'SYNCED');

    const nextAppointmentEntry = sortedPendingTruckEntries.find(entry => entry.appointment?.slotStart);
    const nextAppointmentLabel = nextAppointmentEntry?.appointment
      ? formatSlotWindow(nextAppointmentEntry.appointment)
      : 'Not scheduled';

    const docsAwaitingReview = activeShipments.reduce((total, shipment) => {
      const pendingDocs = (shipment.documents ?? []).filter(doc => doc.status !== 'APPROVED');
      return total + pendingDocs.length;
    }, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Inbound Shipments & Receiving</h2>
          <span className="text-sm text-gray-400">
            {activeShipments.length} active shipment{activeShipments.length === 1 ? '' : 's'}
          </span>
        </div>

        {shipmentsError && (
          <div className="border border-red-700 bg-red-900/40 text-red-200 px-4 py-3 rounded-md text-sm">
            {shipmentsError}
          </div>
        )}
        {shipmentsMessage && (
          <div className="border border-emerald-700 bg-emerald-900/30 text-emerald-200 px-4 py-3 rounded-md text-sm">
            {shipmentsMessage}
          </div>
        )}

        <Card className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Active Shipments</p>
              <p className="text-3xl font-semibold text-white">{activeShipments.length}</p>
              <p className="text-xs text-gray-500 mt-2">
                Includes shipments scheduled, in transit, or awaiting manifest review.
              </p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Trucks Awaiting Check-In</p>
              <p className="text-3xl font-semibold text-white">{sortedPendingTruckEntries.length}</p>
              <p className="text-xs text-gray-500 mt-2">Ready for receiving workflow.</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Calendar Sync Needed</p>
              <p className="text-3xl font-semibold text-white">{unsyncedAppointments.length}</p>
              <p className="text-xs text-gray-500 mt-2">Outlook reminders pending confirmation.</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Manifest Items In Transit</p>
              <p className="text-3xl font-semibold text-white">{manifestInTransitEntries.length}</p>
              <p className="text-xs text-gray-500 mt-2">Track down-line pipe still en route.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
            <div className="rounded-md border border-gray-700 bg-gray-800/40 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Next Dock Appointment</p>
              <p className="text-white">{nextAppointmentLabel}</p>
            </div>
            <div className="rounded-md border border-gray-700 bg-gray-800/40 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Documents Awaiting Review</p>
              <p className="text-white">{docsAwaitingReview}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Inbound Trucks Awaiting Receiving</h3>
              <p className="text-sm text-gray-400">
                Review documents, sync calendars, and mark trucks received to move inventory into storage.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {sortedPendingTruckEntries.length} truck{sortedPendingTruckEntries.length === 1 ? '' : 's'}
            </span>
          </div>

          {sortedPendingTruckEntries.length === 0 ? (
            <p className="text-sm text-gray-400">
              No inbound trucks awaiting receiving. New shipments will appear here automatically.
            </p>
          ) : (
            <div className="space-y-5">
              {sortedPendingTruckEntries.map(entry => {
                const company = companyMap.get(entry.shipment.companyId);
                const request = requestMap.get(entry.shipment.requestId);
                const appointment = entry.appointment;
                const manifestCount = entry.manifestItems.length;
                const manifestJointCount = entry.manifestItems.reduce(
                  (sum, item) => sum + (item.quantity ?? 0),
                  0,
                );
                const manifestLengthFt = entry.manifestItems.reduce(
                  (sum, item) => sum + (item.tallyLengthFt ?? 0),
                  0,
                );
                const contactName =
                  entry.truck.contactName ??
                  entry.shipment.truckingContactName ??
                  entry.shipment.truckingCompany ??
                  'Pending';
                const contactPhone = entry.truck.contactPhone ?? entry.shipment.truckingContactPhone ?? '';
                const contactEmail = entry.truck.contactEmail ?? entry.shipment.truckingContactEmail ?? '';
                const shippingMethod =
                  entry.shipment.truckingMethod === 'MPS_QUOTE' ? 'MPS Provided' : 'Customer Provided';
                const calendarLabel =
                  appointment?.calendarSyncStatus === 'SYNCED' ? 'Resync Outlook' : 'Sync to Outlook';
                const manifestSummary =
                  manifestCount > 0
                    ? `${manifestCount} lines • ${manifestJointCount || 0} joints • ${manifestLengthFt.toFixed(1)} ft`
                    : 'Awaiting manifest';

                return (
                  <div
                    key={`${entry.shipment.id}-${entry.truck.id}`}
                    className="bg-gray-900/60 border border-gray-800 rounded-lg p-5 space-y-4"
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold text-white">
                          Truck #{entry.truck.sequenceNumber}{' '}
                          <span className="text-sm font-normal text-gray-400">
                            • {company?.name ?? 'Unknown Company'}
                          </span>
                        </h4>
                        <p className="text-sm text-gray-400">
                          Request {request?.referenceId ?? entry.shipment.requestId} •{' '}
                          {formatStatus(entry.shipment.status)}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full border text-xs font-semibold ${getTruckStatusClasses(
                          entry.truck.status,
                        )}`}
                      >
                        {formatStatus(entry.truck.status)}
                      </span>
                    </div>

                    <dl className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-gray-300">
                      <div>
                        <dt className="text-xs uppercase text-gray-500">Unloading Slot</dt>
                        <dd className="text-white">{formatSlotWindow(appointment)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-gray-500">Contact</dt>
                        <dd className="text-white whitespace-pre-line">
                          {contactName}
                          {contactPhone ? `\n${contactPhone}` : ''}
                          {contactEmail ? `\n${contactEmail}` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-gray-500">Shipping Method</dt>
                        <dd className="text-white">{shippingMethod}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-gray-500">Manifest</dt>
                        <dd className="text-white">{manifestSummary}</dd>
                      </div>
                    </dl>

                    {entry.documents.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {entry.documents.map(document => (
                          <Button
                            key={document.id}
                            variant="secondary"
                            type="button"
                            className="!px-3 !py-1 text-xs"
                            onClick={() => handlePreviewShipmentDocument(document)}
                          >
                            {document.fileName ?? document.documentType ?? 'Manifest'}
                          </Button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">
                        {appointment?.afterHours
                          ? 'After-hours delivery • $450 unloading surcharge applies.'
                          : 'Standard receiving window • no surcharge.'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          type="button"
                          className="!px-4 !py-1.5 text-sm"
                          disabled={!appointment || processingTruckId === entry.truck.id}
                          onClick={() =>
                            handleSyncCalendar({
                              shipment: entry.shipment,
                              truck: entry.truck,
                              appointment,
                            })
                          }
                        >
                          {calendarLabel}
                        </Button>
                        <Button
                          type="button"
                          className="!px-4 !py-1.5 text-sm"
                          disabled={processingTruckId === entry.truck.id}
                          onClick={() => handleMarkTruckReceived(entry)}
                        >
                          {processingTruckId === entry.truck.id ? 'Updating...' : 'Mark Received'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Manifest Items In Transit</h3>
              <p className="text-sm text-gray-400">
                Track pipe still en route. Items move to “In Storage” once the truck is received.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {manifestInTransitEntries.length} line item{manifestInTransitEntries.length === 1 ? '' : 's'}
            </span>
          </div>
          {manifestInTransitEntries.length === 0 ? (
            <p className="text-sm text-gray-400">All manifest items have been received and reconciled.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800 text-sm">
                <thead className="bg-gray-900/40 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Company / Request</th>
                    <th className="px-3 py-2 text-left">Truck</th>
                    <th className="px-3 py-2 text-left">Manufacturer</th>
                    <th className="px-3 py-2 text-left">Tally Length (ft)</th>
                    <th className="px-3 py-2 text-left">Quantity</th>
                    <th className="px-3 py-2 text-left">Document</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {manifestInTransitEntries.map(entry => {
                    const company = companyMap.get(entry.shipment.companyId);
                    const request = requestMap.get(entry.shipment.requestId);
                    const truckLabel = entry.truck
                      ? `Truck #${entry.truck.sequenceNumber}`
                      : 'Shipment Level';
                    return (
                      <tr key={entry.item.id} className="hover:bg-gray-900/40">
                        <td className="px-3 py-2">
                          <div className="text-white">{company?.name ?? 'Unknown Company'}</div>
                          <div className="text-xs text-gray-500">
                            {request?.referenceId ?? entry.shipment.requestId}
                          </div>
                        </td>
                        <td className="px-3 py-2">{truckLabel}</td>
                        <td className="px-3 py-2">
                          <div>{entry.item.manufacturer ?? '—'}</div>
                          <div className="text-xs text-gray-500">
                            {entry.item.heatNumber ? `Heat ${entry.item.heatNumber}` : ''}
                            {entry.item.heatNumber && entry.item.serialNumber ? ' · ' : ''}
                            {entry.item.serialNumber ? `Serial ${entry.item.serialNumber}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2">{entry.item.tallyLengthFt?.toFixed(1) ?? '—'}</td>
                        <td className="px-3 py-2">{entry.item.quantity ?? 0}</td>
                        <td className="px-3 py-2">
                          {entry.document ? (
                            <Button
                              type="button"
                              variant="secondary"
                              className="!px-3 !py-1 text-xs"
                              onClick={() => handlePreviewShipmentDocument(entry.document!)}
                            >
                              {entry.document.fileName ?? entry.document.documentType}
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">Manifest pending</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-semibold text-blue-300">
                            {formatStatus(entry.item.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Recently Received Trucks</h3>
              <p className="text-sm text-gray-400">
                Quick recap of the last trucks marked as received for audit trail purposes.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-gray-500">
              Showing {recentlyReceivedEntries.length} recent entr{recentlyReceivedEntries.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          {recentlyReceivedEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No trucks have been marked as received yet.</p>
          ) : (
            <div className="space-y-3">
              {recentlyReceivedEntries.map(entry => {
                const company = companyMap.get(entry.shipment.companyId);
                const request = requestMap.get(entry.shipment.requestId);
                const completedAt = entry.truck.departureTime
                  ?? entry.truck.arrivalTime
                  ?? entry.truck.updatedAt
                  ?? null;
                const completedAtLabel = completedAt ? formatDate(completedAt, true) : 'Timestamp pending';
                return (
                  <div
                    key={`recent-${entry.shipment.id}-${entry.truck.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/40 border border-gray-800 rounded-md px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Truck #{entry.truck.sequenceNumber} • {company?.name ?? 'Unknown Company'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Request {request?.referenceId ?? entry.shipment.requestId}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">Received {completedAtLabel}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Active Shipments Overview</h3>
              <p className="text-sm text-gray-400">
                Status snapshot across every in-flight shipment, including logistics readiness.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {shipments.length} total shipment{shipments.length === 1 ? '' : 's'}
            </span>
          </div>
          {shipments.length === 0 ? (
            <p className="text-sm text-gray-400">No shipments logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800 text-sm">
                <thead className="bg-gray-900/40 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Company / Request</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Trucks</th>
                    <th className="px-3 py-2 text-left">Calendar</th>
                    <th className="px-3 py-2 text-left">Documents</th>
                    <th className="px-3 py-2 text-left">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300">
                  {shipments.map(shipment => {
                    const company = companyMap.get(shipment.companyId);
                    const request = requestMap.get(shipment.requestId);
                    const totalTrucks = shipment.trucks?.length ?? 0;
                    const receivedTrucks = shipment.trucks?.filter(truck => truck.status === 'RECEIVED').length ?? 0;
                    const calendarStatus = shipment.calendarSyncStatus ?? 'PENDING';
                    const docsUploaded = shipment.documents?.length ?? 0;
                    const docsProcessed = shipment.documents?.filter(doc => doc.status === 'APPROVED').length ?? 0;
                    const updatedAt = shipment.updatedAt ?? shipment.createdAt ?? null;
                    return (
                      <tr key={shipment.id} className="hover:bg-gray-900/40">
                        <td className="px-3 py-2">
                          <div className="text-white">{company?.name ?? 'Unknown Company'}</div>
                          <div className="text-xs text-gray-500">
                            {request?.referenceId ?? shipment.requestId}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-semibold text-indigo-300">
                            {formatStatus(shipment.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {receivedTrucks}/{totalTrucks} received
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-400">{calendarStatus}</span>
                        </td>
                        <td className="px-3 py-2">
                          {docsProcessed}/{docsUploaded} processed
                        </td>
                        <td className="px-3 py-2">
                          {updatedAt ? formatDate(updatedAt, true) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderAI = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">AI Assistant</h2>
      <AdminAIAssistant requests={requests} companies={companies} yards={yards} inventory={inventory} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      <AdminHeader session={session} onLogout={onLogout} />

      <div className="container mx-auto p-6 space-y-6">
        {/* Global Search */}
        <Card className="p-4">
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Search: requests, companies, inventory..."
            className="w-full bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {searchResults && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-gray-400">
                Found: {searchResults.requests.length} requests, {searchResults.companies.length} companies,{' '}
                {searchResults.inventory.length} inventory items
              </p>
            </div>
          )}
        </Card>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="ml-2 px-2 py-0.5 bg-gray-900 rounded-full text-xs">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'approvals' && renderApprovals()}
        {activeTab === 'requests' && renderRequests()}
        {activeTab === 'companies' && renderCompanies()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'storage' && renderStorage()}
        {activeTab === 'shipments' && renderShipments()}
        {activeTab === 'ai' && renderAI()}
      </div>
    </div>
  );
};

// Approval Card Component
const ApprovalCard: React.FC<{
  request: StorageRequest;
  company?: Company;
  yards: Yard[];
  onApprove: (requestId: string, rackIds: string[], requiredJoints: number, notes?: string) => void;
  onReject: (requestId: string, reason: string) => void;
}> = ({ request, company, yards, onApprove, onReject }) => {
  const [selectedRacks, setSelectedRacks] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [internalNotes, setInternalNotes] = useState(request.internalNotes ?? '');
  const details = request.requestDetails;
  const trucking = request.truckingInfo;
  const requiredJoints = details?.totalJoints ?? 0;
  const totalLengthMeters =
    details && typeof details.avgJointLength === 'number' && typeof details.totalJoints === 'number'
      ? details.avgJointLength * details.totalJoints
      : null;

  const formattedItemType =
    details?.itemType === 'Other' && details?.itemTypeOther
      ? `Other (${details.itemTypeOther})`
      : details?.itemType ?? '';

  const formattedGrade =
    details?.grade === 'Other' && details?.gradeOther
      ? `Other (${details.gradeOther})`
      : details?.grade ?? '';

  const formattedConnection =
    details?.connection === 'Other' && details?.connectionOther
      ? `Other (${details.connectionOther})`
      : details?.connection ?? '';

  const pipeFacts: Array<{ label: string; value: string }> = [];
  if (formattedItemType) pipeFacts.push({ label: 'Item Type', value: formattedItemType });
  if (formattedGrade) pipeFacts.push({ label: 'Grade', value: formattedGrade });
  if (formattedConnection) pipeFacts.push({ label: 'Connection', value: formattedConnection });
  if (details?.threadType) pipeFacts.push({ label: 'Thread', value: details.threadType });
  if (typeof details?.avgJointLength === 'number') {
    pipeFacts.push({ label: 'Avg Joint Length', value: `${details.avgJointLength} m` });
  }
  if (typeof details?.totalJoints === 'number') {
    pipeFacts.push({ label: 'Total Joints', value: `${details.totalJoints}` });
  }
  if (totalLengthMeters !== null) {
    pipeFacts.push({ label: 'Total Length', value: `${totalLengthMeters.toFixed(1)} m` });
  }
  if (details?.storageStartDate || details?.storageEndDate) {
    pipeFacts.push({
      label: 'Storage Window',
      value: `${details?.storageStartDate || '-'} -> ${details?.storageEndDate || '-'}`,
    });
  }
  if (details?.itemType === 'Sand Control' && details.sandControlScreenType) {
    const screen =
      details.sandControlScreenType === 'Other' && details.sandControlScreenTypeOther
        ? `Other (${details.sandControlScreenTypeOther})`
        : details.sandControlScreenType;
    pipeFacts.push({ label: 'Screen Type', value: screen });
  }
  if (details?.casingSpec) {
    if (typeof details.casingSpec.size_in === 'number') {
      pipeFacts.push({ label: 'OD (in)', value: details.casingSpec.size_in.toString() });
    }
    if (typeof details.casingSpec.weight_lbs_ft === 'number') {
      pipeFacts.push({
        label: 'Weight (lbs/ft)',
        value: details.casingSpec.weight_lbs_ft.toString(),
      });
    }
    if (typeof details.casingSpec.drift_in === 'number') {
      pipeFacts.push({ label: 'Drift ID (in)', value: details.casingSpec.drift_in.toFixed(3) });
    }
  }

  const truckingFacts: Array<{ label: string; value: string; fullWidth?: boolean }> = [];
  if (trucking) {
    truckingFacts.push({
      label: 'Preference',
      value: trucking.truckingType === 'quote' ? 'Needs MPS quote' : 'Customer provided',
    });
    if (trucking.details?.storageLocation) {
      truckingFacts.push({
        label: 'Storage Location',
        value: trucking.details.storageLocation,
      });
    }
    if (
      trucking.details?.storageContactName ||
      trucking.details?.storageContactEmail ||
      trucking.details?.storageContactNumber
    ) {
      const contactLines: string[] = [];
      if (trucking.details.storageContactName) contactLines.push(trucking.details.storageContactName);
      if (trucking.details.storageContactEmail) contactLines.push(trucking.details.storageContactEmail);
      if (trucking.details.storageContactNumber) contactLines.push(trucking.details.storageContactNumber);
      truckingFacts.push({
        label: 'Contact',
        value: contactLines.join('\n'),
        fullWidth: true,
      });
    }
    if (trucking.details?.specialInstructions) {
      truckingFacts.push({
        label: 'Instructions',
        value: trucking.details.specialInstructions,
        fullWidth: true,
      });
    }
  }

  const handleApprove = async () => {
    if (selectedRacks.length === 0) {
      alert('Please select at least one rack');
      return;
    }
    try {
      setActionLoading(true);
      await onApprove(request.id, selectedRacks, requiredJoints, internalNotes);
      alert('Request approved successfully.');
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Unable to approve the request. Please try again or contact support.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      setActionLoading(true);
      await onReject(request.id, reason);
      alert('Request rejected.');
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Unable to reject the request. Please try again or contact support.');
    } finally {
      setActionLoading(false);
    }
  };

  const availableRacks = yards.flatMap(y =>
    y.areas.flatMap(a =>
      a.racks
        .filter(r => r.capacity - r.occupied > 0)
        .map(r => ({ ...r, yard: y.name, area: a.name }))
    )
  );

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{request.referenceId}</h3>
          <p className="text-sm text-gray-400">{company?.name || 'Unknown Company'}</p>
        </div>
        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm">PENDING</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 text-sm">
        <div className="bg-gray-800/40 border border-gray-700 rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Contact</p>
          <p className="text-white break-words">{request.userId}</p>
        </div>
        <div className="bg-gray-800/40 border border-gray-700 rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total Volume</p>
          <p className="text-white">{requiredJoints} joints</p>
          {totalLengthMeters !== null && (
            <p className="text-xs text-gray-500 mt-1">~ {totalLengthMeters.toFixed(1)} m total length</p>
          )}
        </div>
        <div className="bg-gray-800/40 border border-gray-700 rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Timeline</p>
          <p className="text-white">
            {details?.storageStartDate || '-'}{' -> '}{details?.storageEndDate || '-'}
          </p>
        </div>
      </div>

      {pipeFacts.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-md p-4 mb-6">
          <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide">Pipe Information</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-300">
            {pipeFacts.map(item => (
              <div key={item.label}>
                <dt className="text-xs uppercase text-gray-500">{item.label}</dt>
                <dd className="text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {truckingFacts.length > 0 && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-md p-4 mb-6">
          <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide">Trucking</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-300">
            {truckingFacts.map(fact => (
              <div key={fact.label} className={fact.fullWidth ? 'sm:col-span-2' : undefined}>
                <dt className="text-xs uppercase text-gray-500">{fact.label}</dt>
                <dd className="text-white whitespace-pre-wrap">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-2" htmlFor={`internal-notes-${request.id}`}>
          Internal Notes (visible to admins only)
        </label>
        <textarea
          id={`internal-notes-${request.id}`}
          className="w-full bg-gray-900 border border-gray-700 rounded-md p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
          rows={3}
          placeholder="Add context for logistics or follow-up steps..."
          value={internalNotes}
          onChange={e => setInternalNotes(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-1">
          Notes are stored with the request and appear in the All Requests table for future reference.
        </p>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-semibold text-white mb-2">Select Storage Racks</h4>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
          {availableRacks.map(rack => (
            <button
              key={rack.id}
              onClick={() =>
                setSelectedRacks(prev =>
                  prev.includes(rack.id) ? prev.filter(id => id !== rack.id) : [...prev, rack.id]
                )
              }
              className={`p-2 rounded text-xs text-center ${
                selectedRacks.includes(rack.id)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="font-semibold">{rack.name}</div>
              <div className="text-xs opacity-75">
                {rack.yard} - {rack.area}
              </div>
              <div className="text-xs">
                {rack.capacity - rack.occupied} free
              </div>
            </button>
          ))}
        </div>
        {selectedRacks.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">Selected: {selectedRacks.join(', ')}</p>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleApprove}
          disabled={actionLoading}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Approve
        </Button>
        <Button
          onClick={handleReject}
          disabled={actionLoading}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Reject
        </Button>
      </div>
    </Card>
  );
};

export default AdminDashboard;






