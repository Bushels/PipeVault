import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import type {
  Rack,
  Pipe,
  RequestStatus,
  Shipment,
  ShipmentTruck,
  ShipmentItem,
  ShipmentDocument,
  DockAppointment,
  TruckingDocument,
  TruckingLoadStatus,
  TruckingLoad,
  TruckingLoadDirection,
  AdminSession,
  StorageRequest,
  Company,
  Yard,
} from '../../types';
import { CheckCircleIcon } from '../icons/Icons';
import AdminHeader from './AdminHeader';
import AdminAIAssistant from './AdminAIAssistant';
import ManifestDataDisplay from './ManifestDataDisplay';

import GlassCard from '../ui/GlassCard';
import GlassButton from '../ui/GlassButton';
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
import {
  getRequestLogisticsSnapshot,
  getStatusBadgeTone,
  type StatusBadgeTone,
} from '../../utils/truckingStatus';
import { isFeatureEnabled, FEATURES } from '../../utils/featureFlags';
import CompanyTileCarousel from './tiles/CompanyTileCarousel';
import CompanyDetailModal from './CompanyDetailModal';
import ManualRackAdjustmentModal from './ManualRackAdjustmentModal';
import StorageManagement from './StorageManagement';
import InventoryManagement from './InventoryManagement';
import ShipmentManagement from './ShipmentManagement';
import { RackSelector } from './RackSelector';
import AdminSidebar from './AdminSidebar';
import PendingLoadsTile from './tiles/PendingLoadsTile';
import ApprovedLoadsTile from './tiles/ApprovedLoadsTile';
import InTransitTile from './tiles/InTransitTile';
import OutboundLoadsTile from './tiles/OutboundLoadsTile';
import { usePendingLoadsCount, useApprovedLoadsCount, useInTransitLoadsCount, useOutboundLoadsCount } from '../../hooks/useTruckingLoadQueries';
import { useRealtimeUpdates } from '../../hooks/useRealtimeUpdates';

interface AdminDashboardProps {
  session: AdminSession;
  onLogout: () => void;
  requests: StorageRequest[];
  companies: Company[];
  yards: Yard[];
  inventory: Pipe[];
  shipments: Shipment[];
  approveRequest: (requestId: string, assignedRackIds: string[], requiredJoints: number, notes?: string) => void;
  rejectRequest: (requestId: string, reason: string, notes?: string) => void;
  pickUpPipes: (pipeIds: string[], uwi: string, wellName: string, truckLoadId?: string) => void;
  updateRequest: (request: StorageRequest) => Promise<unknown>;
}

type TabType = 'overview' | 'approvals' | 'pending-loads' | 'approved-loads' | 'in-transit' | 'outbound-loads' | 'requests' | 'companies' | 'inventory' | 'storage' | 'shipments' | 'ai';

const adminStatusBadgeThemes: Record<StatusBadgeTone, string> = {
  pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)] backdrop-blur-md',
  success: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] backdrop-blur-md',
  info: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-md',
  danger: 'bg-rose-500/10 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)] backdrop-blur-md',
  neutral: 'bg-slate-500/10 text-slate-300 border border-slate-500/30 shadow-[0_0_15px_rgba(100,116,139,0.2)] backdrop-blur-md',
};

type DocViewerFilters = {
  direction: 'ALL' | 'INBOUND' | 'OUTBOUND';
  status: 'ALL' | TruckingLoadStatus;
  docType: string;
};

const createDefaultDocViewerFilters = (): DocViewerFilters => ({
  direction: 'ALL',
  status: 'ALL',
  docType: '',
});

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  onLogout,
  requests,
  companies,
  yards,
  inventory,
  shipments,
  approveRequest,
  rejectRequest,
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
  const [docViewerRequest, setDocViewerRequest] = useState<StorageRequest | null>(null);
  const [docViewerError, setDocViewerError] = useState<string | null>(null);
  const [docViewerFilters, setDocViewerFilters] = useState<DocViewerFilters>(() => createDefaultDocViewerFilters());

  const [editingLoad, setEditingLoad] = useState<{id: string; requestId: string} | null>(null);
  const [loadToDelete, setLoadToDelete] = useState<{id: string; requestId: string; sequenceNumber: number} | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCompanyDetailOpen, setCompanyDetailOpen] = useState(false);
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null);

  const [isRackAdjustmentOpen, setRackAdjustmentOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const updateShipmentMutation = useUpdateShipment();
  const updateShipmentTruckMutation = useUpdateShipmentTruck();
  const updateShipmentItemMutation = useUpdateShipmentItem();
  const updateDockAppointmentMutation = useUpdateDockAppointment();
  const updateInventoryItemMutation = useUpdateInventoryItem();

  // Get load counts for badges
  const { data: pendingLoadsCount = 0 } = usePendingLoadsCount();
  const { data: approvedLoadsCount = 0 } = useApprovedLoadsCount();
  const { data: inTransitLoadsCount = 0 } = useInTransitLoadsCount();
  const { data: outboundLoadsCount = 0 } = useOutboundLoadsCount();

  // Enable realtime updates for multi-admin collaboration
  useRealtimeUpdates({ enabled: true, debug: false });

  const getRequestStatusMeta = (request: StorageRequest) => {
    const snapshot = getRequestLogisticsSnapshot(request);
    const badgeTone = getStatusBadgeTone(snapshot.customerStatusLabel) as keyof typeof adminStatusBadgeThemes;
    return {
      ...snapshot,
      badgeTone,
      badgeClass: adminStatusBadgeThemes[badgeTone],
    };
  };

  const summarizeTruckingDocuments = (request: StorageRequest) => {
    const loads = request.truckingLoads ?? [];
    const summary = loads.reduce(
      (acc, load) => {
        const count = load.documents?.length ?? 0;
        if (load.direction === 'INBOUND') {
          acc.inbound += count;
        } else {
          acc.outbound += count;
        }
        acc.total += count;
        if (count > 0) {
          acc.loadsWithDocs += 1;
        } else {
          acc.loadsWithoutDocs += 1;
        }
        return acc;
      },
      { inbound: 0, outbound: 0, total: 0, loadsWithDocs: 0, loadsWithoutDocs: 0 },
    );
    return { ...summary, loadCount: loads.length };
  };

  const openDocViewer = (request: StorageRequest) => {
    setDocViewerFilters(createDefaultDocViewerFilters());
    setDocViewerRequest(request);
    setDocViewerError(null);
  };

  const closeDocViewer = () => {
    setDocViewerRequest(null);
    setDocViewerError(null);
    setDocViewerFilters(createDefaultDocViewerFilters());
  };

  const handlePreviewTruckingDocument = async (document: TruckingDocument) => {
    setDocViewerError(null);
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(document.storagePath, 300);
    if (error || !data?.signedUrl) {
      setDocViewerError('Unable to open the selected document. Please try again.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const handleEditLoad = (loadId: string, requestId: string) => {
    setEditingLoad({ id: loadId, requestId });
  };

  const handleDeleteLoad = async (loadId: string, requestId: string, sequenceNumber: number) => {
    setLoadToDelete({ id: loadId, requestId, sequenceNumber });
  };

  const confirmDeleteLoad = async () => {
    if (!loadToDelete) return;

    try {
      const { error } = await supabase
        .from('trucking_loads')
        .delete()
        .eq('id', loadToDelete.id);

      if (error) throw error;

      // Reload the request to get updated data
      const { data: updatedRequest, error: fetchError } = await supabase
        .from('storage_requests')
        .select(`
          *,
          truckingLoads:trucking_loads(
            *,
            documents:trucking_documents(*)
          )
        `)
        .eq('id', loadToDelete.requestId)
        .single();

      if (fetchError) throw fetchError;

      await updateRequest(updatedRequest);
      setLoadToDelete(null);
      setDocViewerError(null);
    } catch (error) {
      console.error('Error deleting load:', error);
      setDocViewerError('Failed to delete load. Please try again.');
    }
  };

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
        return 'border-indigo-500/50 text-indigo-300 bg-indigo-500/10 shadow-[0_0_10px_rgba(99,102,241,0.3)]';
      case 'ON_SITE':
        return 'border-amber-500/50 text-amber-300 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
      case 'RECEIVED':
        return 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.3)]';
      case 'CANCELLED':
        return 'border-rose-500/50 text-rose-300 bg-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.3)]';
      default:
        return 'border-slate-600 text-slate-300 bg-slate-700/40';
    }
  };

  const formatKilograms = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0 kg';
    if (value < 100) return `${value.toFixed(1)} kg`;
    return `${Math.round(value).toLocaleString('en-US')} kg`;
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
    const racksWithPipe = yards.reduce((count, yard) =>
      count + yard.areas.reduce((areaCount, area) =>
        areaCount + area.racks.filter(rack => (rack.occupiedMeters || 0) > 0).length,
      0),
    0);
    const totalStoredKg = inventory.reduce((sum, pipe) => {
      if (pipe.status !== 'IN_STORAGE') return sum;
      if (typeof pipe.weight !== 'number' || typeof pipe.length !== 'number' || typeof pipe.quantity !== 'number') {
        return sum;
      }
      const totalWeightLbs = pipe.weight * pipe.length * pipe.quantity;
      return sum + totalWeightLbs * 0.45359237;
    }, 0);

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;

    const requestMap = new Map<string, StorageRequest>();
    requests.forEach((req) => requestMap.set(req.id, req));

    // NOTE: Legacy truck_loads table deprecated - pickup metrics temporarily disabled
    // TODO: Replace with trucking_loads data from useProjectSummaries hook
    const pickupLoads: never[] = [];
    const upcomingPickups: never[] = [];
    const nextPickupInfo = null;
    const nextPickupDays = null;
    const pickupsThisMonthCompanies = new Set<string>();

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

    const truckingDocumentSummary = requests.reduce(
      (acc, request) => {
        const summary = summarizeTruckingDocuments(request);
        acc.total += summary.total;
        acc.inbound += summary.inbound;
        acc.outbound += summary.outbound;
        acc.loadsWithDocs += summary.loadsWithDocs;
        acc.loadsWithoutDocs += summary.loadsWithoutDocs;
        return acc;
      },
      { total: 0, inbound: 0, outbound: 0, loadsWithDocs: 0, loadsWithoutDocs: 0 },
    );

    return {
      requests: { total: requests.length, pending, approved, completed, rejected },
      storage: {
        totalCapacity,
        totalOccupied,
        available: totalCapacity - totalOccupied,
        utilization,
        totalStoredKg,
        racksWithPipe,
      },
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
      documents: truckingDocumentSummary,
    };
  }, [requests, yards, companies, inventory, shipments, pendingTruckEntries]);

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
    { id: 'pending-loads', label: 'Pending Loads', badge: pendingLoadsCount },
    { id: 'approved-loads', label: 'Approved Loads', badge: approvedLoadsCount },
    { id: 'in-transit', label: 'In Transit', badge: inTransitLoadsCount },
    { id: 'outbound-loads', label: 'Outbound Pickups' },
    { id: 'requests', label: 'All Requests', badge: requests.length },
    { id: 'companies', label: 'Companies', badge: companies.length },
    { id: 'inventory', label: 'Inventory', badge: inventory.length },
    { id: 'storage', label: 'Racks', badge: analytics.storage.racksWithPipe },
    { id: 'shipments', label: 'Shipments', badge: analytics.logistics?.trucksPending },
    { id: 'ai', label: 'AI Assistant' },
  ];

  // ===== RENDER FUNCTIONS =====
  const renderOverview = () => {
    // Feature flag: Use tile-based UI or legacy overview
    const useTileUI = isFeatureEnabled(FEATURES.TILE_ADMIN);

    if (useTileUI) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Company Dashboard</h2>

          {/* Tile-Based Company Carousel */}
          <CompanyTileCarousel
            onCompanyClick={(companyId) => {
              setSelectedCompanyId(companyId);
            }}
            onViewCompanyDetails={(companyId) => {
              console.log('🔍 Opening company detail modal for:', companyId);
              setSelectedCompanyId(companyId);
              setCompanyDetailOpen(true);
            }}
            selectedCompanyId={selectedCompanyId}
            yards={yards}
          />
        </div>
      );
    }

    // Legacy overview UI
    return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard Overview</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-amber-600 via-yellow-600 to-amber-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 via-yellow-500/5 to-amber-500/5 rounded-xl"></div>
            <div className="relative">
              <h3 className="text-sm text-slate-400 mb-2 uppercase tracking-wider font-medium">Pending Approvals</h3>
              <div className="flex items-end justify-between">
                <p className="text-4xl font-bold text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">{analytics.requests.pending}</p>
                <GlassButton
                  onClick={() => setActiveTab('approvals')}
                  className="text-xs px-3 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                >
                  Review
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-indigo-500/5 rounded-xl"></div>
            <div className="relative">
              <h3 className="text-sm text-slate-400 mb-2 uppercase tracking-wider font-medium">Storage Utilization</h3>
              <p className="text-4xl font-bold text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]">{analytics.storage.utilization.toFixed(1)}%</p>
              <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className="bg-linear-to-r from-indigo-600 to-indigo-400 h-2 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  style={{ width: `${analytics.storage.utilization}%` }}
                ></div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-slate-600 via-slate-500 to-slate-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-slate-500/5 via-slate-400/5 to-slate-500/5 rounded-xl"></div>
            <div className="relative">
              <h3 className="text-sm text-slate-400 mb-2 uppercase tracking-wider font-medium">Total Requests</h3>
              <p className="text-4xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{analytics.requests.total}</p>
              <p className="text-xs text-slate-500 mt-2">
                {analytics.requests.approved} approved, {analytics.requests.completed} completed
              </p>
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-emerald-600 via-green-600 to-emerald-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-green-500/5 to-emerald-500/5 rounded-xl"></div>
            <div className="relative">
              <h3 className="text-sm text-slate-400 mb-2 uppercase tracking-wider font-medium">Pipe Weight On Site</h3>
              <p className="text-4xl font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                {formatKilograms(analytics.storage.totalStoredKg)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Currently stored across all yards
              </p>
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-purple-500/5 via-pink-500/5 to-purple-500/5 rounded-xl"></div>
            <div className="relative">
              <h3 className="text-sm text-slate-400 mb-2 uppercase tracking-wider font-medium">Trucking Docs</h3>
              <div className="flex items-end justify-between gap-4">
                <p className="text-4xl font-bold text-purple-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.3)]">{analytics.documents.total}</p>
                <div className="text-right text-xs text-slate-500">
                  <div>{analytics.documents.inbound} inbound</div>
                  <div>{analytics.documents.outbound} outbound</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {analytics.documents.loadsWithDocs} loads with paperwork, {analytics.documents.loadsWithoutDocs} outstanding
              </p>
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 space-y-3 shadow-lg backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          Operational Highlights
        </h3>
        <ul className="text-sm text-slate-300 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-slate-500 mt-1">•</span>
            <span>
            There {analytics.operational.companiesPickingUpThisMonth === 1 ? 'is' : 'are'}{' '}
            <span className="text-white font-semibold">{analytics.operational.companiesPickingUpThisMonth}</span>{' '}
            company{analytics.operational.companiesPickingUpThisMonth === 1 ? '' : 'ies'} scheduled to pick up pipe this month.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-500 mt-1">•</span>
            <span>
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
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-500 mt-1">•</span>
            <span>
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
            </span>
          </li>
        </ul>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-amber-600/30 via-orange-600/30 to-yellow-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 via-orange-500/5 to-yellow-500/5 rounded-xl"></div>
            <div className="relative">
              <h3 className="text-lg font-semibold bg-linear-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent mb-4 tracking-tight">Request Status Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Pending', count: analytics.requests.pending, color: 'amber' },
              { label: 'Approved', count: analytics.requests.approved, color: 'emerald' },
              { label: 'Completed', count: analytics.requests.completed, color: 'blue' },
              { label: 'Rejected', count: analytics.requests.rejected, color: 'rose' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                <span className="text-slate-300">{label}</span>
                <span className={`text-${color}-400 font-semibold drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]`}>{count}</span>
              </div>
            ))}
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-xl"></div>
            <div className="relative">
              <h3 className="text-lg font-semibold bg-linear-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent mb-4 tracking-tight">Storage by Yard</h3>
          <div className="space-y-4">
            {yards.map(yard => {
              const capacity = yard.areas.reduce((sum, a) =>
                sum + a.racks.reduce((s, r) => s + r.capacityMeters, 0), 0);
              const occupied = yard.areas.reduce((sum, a) =>
                sum + a.racks.reduce((s, r) => s + (r.occupiedMeters || 0), 0), 0);
              const util = capacity > 0 ? (occupied / capacity * 100) : 0;

              return (
                <div key={yard.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-300 text-sm">{yard.name}</span>
                    <span className="text-xs text-slate-500">{util.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-linear-to-r from-indigo-600 to-indigo-400 h-2 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                      style={{ width: `${util}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-linear-to-r from-cyan-600/30 via-blue-600/30 to-indigo-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
        <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
          <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 via-blue-500/5 to-indigo-500/5 rounded-xl"></div>
          <div className="relative">
            <h3 className="text-lg font-semibold bg-linear-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent mb-4 tracking-tight">Recent Requests</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700/50">
              <tr>
                <th className="text-left py-3 text-slate-400 font-medium">Reference ID</th>
                <th className="text-left py-3 text-slate-400 font-medium">Company</th>
                <th className="text-left py-3 text-slate-400 font-medium">Status</th>
                <th className="text-left py-3 text-slate-400 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 5).map(req => {
                const statusMeta = getRequestStatusMeta(req);
                const docSummary = summarizeTruckingDocuments(req);
                return (
                  <tr key={req.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 text-slate-300 font-mono">{req.referenceId}</td>
                    <td className="py-3 text-slate-300">
                      {companies.find(c => c.id === req.companyId)?.name || 'Unknown'}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`relative px-3 py-1.5 rounded-full text-xs font-semibold w-fit overflow-hidden group transition-all duration-200 hover:scale-105 ${statusMeta.badgeClass}`}>
                          <span className="absolute inset-0 bg-linear-to-r from-white/5 to-transparent opacity-50"></span>
                          <span className="relative z-10">{statusMeta.customerStatusLabel}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                          Storage: {req.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-500 text-xs">
                      {req.requestDetails?.storageStartDate || 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          </div>
        </GlassCard>
      </div>
    </div>
    );
  };

  const renderApprovals = () => {
    const pendingRequests = requests.filter(r => r.status === 'PENDING');

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">Pending Approvals</h2>
          <span className="text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full text-sm border border-slate-700">{pendingRequests.length} pending</span>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-linear-to-r from-emerald-600/30 via-green-600/30 to-teal-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <GlassCard className="relative p-12 text-center bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
              <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-green-500/5 to-teal-500/5 rounded-xl"></div>
              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center backdrop-blur-md border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <span className="text-2xl">✓</span>
                </div>
                <h3 className="text-lg font-medium bg-linear-to-r from-emerald-300 to-green-300 bg-clip-text text-transparent">No Pending Approvals</h3>
                <p className="text-sm text-slate-500 mt-2">All requests have been processed!</p>
              </div>
            </GlassCard>
          </div>
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
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <h2 className="text-2xl font-bold bg-linear-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent tracking-tight">All Requests</h2>
          <select
            value={requestFilter}
            onChange={e => setRequestFilter(e.target.value as any)}
            className="bg-slate-800/90 backdrop-blur-md text-white border border-slate-600/50 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-lg hover:bg-slate-700/90 transition-all"
          >
            <option value="ALL">All Statuses ({requests.length})</option>
            <option value="PENDING">Pending ({analytics.requests.pending})</option>
            <option value="APPROVED">Approved ({analytics.requests.approved})</option>
            <option value="COMPLETED">Completed ({analytics.requests.completed})</option>
            <option value="REJECTED">Rejected ({analytics.requests.rejected})</option>
          </select>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600/30 via-indigo-600/30 to-violet-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative overflow-x-auto bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-indigo-500/5 to-violet-500/5 rounded-xl"></div>
            <div className="relative">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700/50 bg-slate-800/30">
              <tr>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Reference ID</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Company</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Contact</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Pipe Details</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Total Length (m)</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Documents</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Location</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Approved</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Approved By</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Internal Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                const totalMeters =
                  req.requestDetails && typeof req.requestDetails.avgJointLength === 'number' && typeof req.requestDetails.totalJoints === 'number'
                    ? req.requestDetails.avgJointLength * req.requestDetails.totalJoints
                    : null;
                const docSummary = summarizeTruckingDocuments(req);
                const originalNote = req.internalNotes ?? '';
                const noteValue = getDraftNote(req);
                const isDirty = noteValue !== originalNote;
                const isSaving = notesSavingId === req.id;
                const statusMeta = getRequestStatusMeta(req);

                return (
                <tr key={req.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-white font-mono">{req.referenceId}</td>
                  <td className="py-3 px-4 text-slate-300">
                    {companies.find(c => c.id === req.companyId)?.name || 'Unknown'}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{req.userId}</td>
                  <td className="py-3 px-4 text-slate-300 whitespace-pre-wrap">{buildPipeSummary(req)}</td>
                  <td className="py-3 px-4 text-slate-300">
                    {totalMeters !== null ? totalMeters.toFixed(1) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${statusMeta.badgeClass}`}>
                        {statusMeta.customerStatusLabel}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                        Storage: {req.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 text-sm text-slate-300">
                      <span>
                        {docSummary.total > 0
                          ? `${docSummary.total} file${docSummary.total === 1 ? '' : 's'}`
                          : 'No uploads yet'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {docSummary.inbound} inbound / {docSummary.outbound} outbound
                      </span>
                      <span className="text-xs text-slate-500">
                        {docSummary.loadsWithoutDocs} of {docSummary.loadCount} loads missing uploads
                      </span>
                      <GlassButton
                        type="button"
                        onClick={() => openDocViewer(req)}
                        className={`self-start text-xs px-2 py-1 rounded border transition-colors ${
                          docSummary.loadCount === 0
                            ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600'
                        }`}
                        disabled={docSummary.loadCount === 0}
                      >
                        Review
                      </GlassButton>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{req.assignedLocation || '-'}</td>
                  <td className="py-3 px-4 text-slate-300">
                    {req.approvedAt ? formatDate(req.approvedAt, true) : '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-300">{req.approvedBy || '-'}</td>
                  <td className="py-3 px-4 text-slate-400 text-xs whitespace-pre-wrap">
                    <textarea
                      className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                      rows={3}
                      value={noteValue}
                      onChange={e => handleNotesChange(req.id, e.target.value)}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <GlassButton
                        type="button"
                        className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                        onClick={() => handleNotesSave(req)}
                        disabled={isSaving || !isDirty}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </GlassButton>
                      {isDirty && (
                        <GlassButton
                          type="button"
                          className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          onClick={() => handleNotesReset(req.id)}
                          disabled={isSaving}
                        >
                          Cancel
                        </GlassButton>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  };

  const renderCompanies = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-linear-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent tracking-tight">Companies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(company => {
          const companyRequests = requests.filter(r => r.companyId === company.id);
          const companyInventory = inventory.filter(i => i.companyId === company.id);

          return (
            <div key={company.id} className="relative group">
              <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-600/30 via-purple-600/30 to-pink-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-xl"></div>
                <div className="relative">
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">{company.name}</h3>
                  <p className="text-sm text-slate-400 mb-4">{company.domain}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Requests:</span>
                      <span className="text-white font-medium">{companyRequests.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Inventory:</span>
                      <span className="text-white font-medium">{companyInventory.length} pipes</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>
    </div>
  );



  const renderStorage = () => (
    <StorageManagement
      racks={yards.flatMap(y => y.areas.flatMap(a => a.racks))}
      yards={yards}
      companies={companies}
      onRefresh={() => {
        // In a real app, we would trigger a data refetch here.
        // For now, we rely on realtime subscriptions or manual reload.
        console.log('Storage updated, refreshing...');
      }}
    />
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
          <h2 className="text-2xl font-bold bg-linear-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent tracking-tight">Inbound Shipments & Receiving</h2>
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

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-cyan-600/30 via-blue-600/30 to-indigo-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 space-y-5 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 via-blue-500/5 to-indigo-500/5 rounded-xl"></div>
            <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 shadow-lg backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Active Shipments</p>
              <p className="text-3xl font-semibold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{activeShipments.length}</p>
              <p className="text-xs text-slate-500 mt-2">
                Includes shipments scheduled, in transit, or awaiting manifest review.
              </p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 shadow-lg backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Trucks Awaiting Check-In</p>
              <p className="text-3xl font-semibold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{sortedPendingTruckEntries.length}</p>
              <p className="text-xs text-slate-500 mt-2">Ready for receiving workflow.</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 shadow-lg backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Calendar Sync Needed</p>
              <p className="text-3xl font-semibold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{unsyncedAppointments.length}</p>
              <p className="text-xs text-slate-500 mt-2">Outlook reminders pending confirmation.</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 shadow-lg backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Manifest Items In Transit</p>
              <p className="text-3xl font-semibold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{manifestInTransitEntries.length}</p>
              <p className="text-xs text-slate-500 mt-2">Track down-line pipe still en route.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
            <div className="rounded-md border border-slate-700/50 bg-slate-800/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Next Dock Appointment</p>
              <p className="text-white font-medium">{formatSlotWindow(nextAppointmentEntry?.appointment)}</p>
            </div>
            <div className="rounded-md border border-slate-700/50 bg-slate-800/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Documents Awaiting Review</p>
              <p className="text-white font-medium">{docsAwaitingReview}</p>
            </div>
          </div>
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-blue-600/30 via-indigo-600/30 to-violet-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-indigo-500/5 to-violet-500/5 rounded-xl"></div>
            <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">Inbound Trucks Awaiting Receiving</h3>
              <p className="text-sm text-slate-400">
                Review documents, sync calendars, and mark trucks received to move inventory into storage.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {sortedPendingTruckEntries.length} truck{sortedPendingTruckEntries.length === 1 ? '' : 's'}
            </span>
          </div>

          {sortedPendingTruckEntries.length === 0 ? (
            <p className="text-sm text-slate-400">
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
                    className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-5 space-y-4 hover:bg-slate-800/60 transition-colors"
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
                        className={`inline-flex min-w-[90px] items-center justify-center px-3 py-1 rounded-full border text-xs font-semibold text-center ${getTruckStatusClasses(
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
                          <GlassButton
                            key={document.id}
                            variant="secondary"
                            type="button"
                            className="px-3! py-1! text-xs"
                            onClick={() => handlePreviewShipmentDocument(document)}
                          >
                            {document.fileName ?? document.documentType ?? 'Manifest'}
                          </GlassButton>
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
                        <GlassButton
                          variant="secondary"
                          type="button"
                          className="px-4! py-1.5! text-sm"
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
                        </GlassButton>
                        <GlassButton
                          type="button"
                          className="px-4! py-1.5! text-sm"
                          disabled={processingTruckId === entry.truck.id}
                          onClick={() => handleMarkTruckReceived(entry)}
                        >
                          {processingTruckId === entry.truck.id ? 'Updating...' : 'Mark Received'}
                        </GlassButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-600/30 via-violet-600/30 to-purple-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 space-y-4 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-violet-500/5 to-purple-500/5 rounded-xl"></div>
            <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">Manifest Items In Transit</h3>
              <p className="text-sm text-slate-400">
                Track pipe still en route. Items move to “In Storage” once the truck is received.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {manifestInTransitEntries.length} line item{manifestInTransitEntries.length === 1 ? '' : 's'}
            </span>
          </div>
          {manifestInTransitEntries.length === 0 ? (
            <p className="text-sm text-slate-400">All manifest items have been received and reconciled.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700/50 text-sm">
                <thead className="bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500">
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
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {manifestInTransitEntries.map(entry => {
                    const company = companyMap.get(entry.shipment.companyId);
                    const request = requestMap.get(entry.shipment.requestId);
                    const truckLabel = entry.truck
                      ? `Truck #${entry.truck.sequenceNumber}`
                      : 'Shipment Level';
                    return (
                      <tr key={entry.item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2">
                          <div className="text-white">{company?.name ?? 'Unknown Company'}</div>
                          <div className="text-xs text-slate-500">
                            {request?.referenceId ?? entry.shipment.requestId}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{truckLabel}</td>
                        <td className="px-3 py-2">
                          <div>{entry.item.manufacturer ?? '—'}</div>
                          <div className="text-xs text-slate-500">
                            {entry.item.heatNumber ? `Heat ${entry.item.heatNumber}` : ''}
                            {entry.item.heatNumber && entry.item.serialNumber ? ' · ' : ''}
                            {entry.item.serialNumber ? `Serial ${entry.item.serialNumber}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{entry.item.tallyLengthFt?.toFixed(1) ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-400">{entry.item.quantity ?? 0}</td>
                        <td className="px-3 py-2">
                          {entry.document ? (
                            <GlassButton
                              type="button"
                              variant="secondary"
                              className="px-3! py-1! text-xs"
                              onClick={() => handlePreviewShipmentDocument(entry.document!)}
                            >
                              {entry.document.fileName ?? entry.document.documentType}
                            </GlassButton>
                          ) : (
                            <span className="text-xs text-slate-500">Manifest pending</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-semibold text-blue-400">
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
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-violet-600/30 via-purple-600/30 to-fuchsia-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 rounded-xl"></div>
            <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">Recently Received Trucks</h3>
              <p className="text-sm text-slate-400">
                Quick recap of the last trucks marked as received for audit trail purposes.
              </p>
            </div>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Showing {recentlyReceivedEntries.length} recent entr{recentlyReceivedEntries.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          {recentlyReceivedEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No trucks have been marked as received yet.</p>
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
            </div>
          </GlassCard>
        </div>

        <div className="relative group">
          <div className="absolute -inset-0.5 bg-linear-to-r from-cyan-600/30 via-teal-600/30 to-emerald-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 via-teal-500/5 to-emerald-500/5 rounded-xl"></div>
            <div className="relative">
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
            </div>
          </GlassCard>
        </div>
      </div>
    );
  };

  const renderDocumentsViewer = () => {
    if (!docViewerRequest) return null;
    const loads = docViewerRequest.truckingLoads ?? [];
    const docTypeTerm = docViewerFilters.docType.trim().toLowerCase();
    const filteredLoads = loads.filter(load => {
      const directionMatch =
        docViewerFilters.direction === 'ALL' || load.direction === docViewerFilters.direction;
      const statusMatch = docViewerFilters.status === 'ALL' || load.status === docViewerFilters.status;
      if (!directionMatch || !statusMatch) {
        return false;
      }
      if (!docTypeTerm) {
        return true;
      }
      const documents = load.documents ?? [];
      return documents.some(doc => {
        const docType = (doc.documentType ?? '').toLowerCase();
        const fileName = doc.fileName.toLowerCase();
        return docType.includes(docTypeTerm) || fileName.includes(docTypeTerm);
      });
    });

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4 py-8">
        <div className="bg-slate-900/95 backdrop-blur-xl w-full max-w-5xl rounded-2xl border border-slate-700/50 shadow-2xl">
          <div className="flex items-start justify-between p-5 border-b border-slate-700/50">
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider">Trucking Documents</p>
              <h3 className="text-2xl font-bold text-white">
                Request {docViewerRequest.referenceId}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {loads.length} trucking {loads.length === 1 ? 'load' : 'loads'} tracked
              </p>
            </div>
            <GlassButton
              onClick={closeDocViewer}
              className="text-gray-400 hover:text-white text-sm font-semibold"
            >
              Close
            </GlassButton>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Direction
                </label>
                <select
                  value={docViewerFilters.direction}
                  onChange={event =>
                    setDocViewerFilters(filters => ({
                      ...filters,
                      direction: event.target.value as DocViewerFilters['direction'],
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="ALL">All Directions</option>
                  <option value="INBOUND">Inbound (to MPS)</option>
                  <option value="OUTBOUND">Outbound (from MPS)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Load Status
                </label>
                <select
                  value={docViewerFilters.status}
                  onChange={event =>
                    setDocViewerFilters(filters => ({
                      ...filters,
                      status: event.target.value as DocViewerFilters['status'],
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New</option>
                  <option value="APPROVED">Approved</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Document Type / Name
                </label>
                <input
                  type="text"
                  value={docViewerFilters.docType}
                  onChange={event =>
                    setDocViewerFilters(filters => ({
                      ...filters,
                      docType: event.target.value,
                    }))
                  }
                  placeholder="Search manifest, POD, photos..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div className="md:self-end">
                <GlassButton
                  variant="secondary"
                  onClick={() => setDocViewerFilters(createDefaultDocViewerFilters())}
                  className="w-full"
                >
                  Reset
                </GlassButton>
              </div>
            </div>

            {loads.length === 0 ? (
              <GlassCard className="p-6 text-center text-gray-400 bg-gray-900/40 border border-gray-800">
                No trucking loads recorded for this request yet.
              </GlassCard>
            ) : filteredLoads.length === 0 ? (
              <GlassCard className="p-6 text-center text-gray-400 bg-gray-900/40 border border-gray-800">
                No documents match the current filters.
              </GlassCard>
            ) : (
              filteredLoads.map(load => {
                const directionLabel = load.direction === 'INBOUND' ? 'Truck to MPS' : 'Truck from MPS';
                const documents = (load.documents ?? []).filter(doc => {
                  if (!docTypeTerm) return true;
                  const docType = (doc.documentType ?? '').toLowerCase();
                  const fileName = doc.fileName.toLowerCase();
                  return docType.includes(docTypeTerm) || fileName.includes(docTypeTerm);
                });
                const docCount = documents.length;
                return (
                  <div
                    key={load.id}
                    className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <p className="text-white font-semibold">
                          {directionLabel} - Load {load.sequenceNumber}
                        </p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Status: {load.status.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">
                          {docCount} document{docCount === 1 ? '' : 's'}
                        </span>
                        <GlassButton
                          variant="secondary"
                          onClick={() => handleEditLoad(load.id, docViewerRequest!.id)}
                          className="text-xs"
                        >
                          Edit
                        </GlassButton>
                        <GlassButton
                          variant="danger"
                          onClick={() => handleDeleteLoad(load.id, docViewerRequest!.id, load.sequenceNumber)}
                          className="text-xs"
                        >
                          Delete
                        </GlassButton>
                      </div>
                    </div>
                    {docCount === 0 ? (
                      <p className="text-xs text-gray-500">No documents uploaded yet.</p>
                    ) : (
                      <ul className="space-y-4">
                        {documents.map(document => (
                          <li
                            key={document.id}
                            className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3"
                          >
                            {/* Document header */}
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div>
                                <p className="text-sm text-white font-semibold">{document.fileName}</p>
                                <p className="text-xs text-gray-400">
                                  {(document.documentType || 'Uncategorized')} -{' '}
                                  {document.uploadedAt ? formatDate(document.uploadedAt, true) : 'Uploaded'}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <GlassButton variant="secondary" onClick={() => handlePreviewTruckingDocument(document)}>
                                  View
                                </GlassButton>
                              </div>
                            </div>

                            {/* AI-extracted manifest data */}
                            <ManifestDataDisplay
                              data={document.parsedPayload}
                              documentFileName={document.fileName}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {docViewerError && (
            <div className="p-4 text-sm text-red-300 bg-red-900/20 border-t border-red-800">
              {docViewerError}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAI = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">AI Assistant</h2>
      <AdminAIAssistant requests={requests} companies={companies} yards={yards} inventory={inventory} />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 relative overflow-hidden">
      {/* Global Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-slate-900/50 via-transparent to-slate-900/80"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px] animate-pulse-glow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
      </div>

      <AdminHeader
        session={session}
        onLogout={onLogout}
        onMenuToggle={() => setMobileMenuOpen(true)}
      />

      <div className="flex flex-1 relative z-10">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeSection={activeTab}
          onNavigate={(tab) => setActiveTab(tab as TabType)}
          badges={{
            pendingApprovals: analytics.requests.pending,
            pendingLoads: pendingLoadsCount,
            approvedLoads: approvedLoadsCount,
            inTransitLoads: inTransitLoadsCount,
            outboundLoads: outboundLoadsCount,
          }}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <main
          className={`
            flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300 ease-in-out
            ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
          `}
        >
          {/* Header / Search Area */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
              </h1>
              <p className="text-slate-400 mt-1">
                Welcome back, {session.username}
              </p>
            </div>

            {/* Global Search */}
            <div className="relative w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-700/50 rounded-lg leading-5 bg-slate-800/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:bg-slate-800 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 sm:text-sm transition-all backdrop-blur-sm shadow-inner"
                placeholder="Search requests, companies, inventory..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              {globalSearch && (
                <GlassButton
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
                  onClick={() => setGlobalSearch('')}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </GlassButton>
              )}
            </div>
          </div>

          {/* Search Results Overlay */}
          {searchResults && (
            <div className="mb-8">
              <GlassCard className="border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-cyan-100">Search Results</h3>
                  <GlassButton 
                    onClick={() => setGlobalSearch('')}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Clear Search
                  </GlassButton>
                </div>
                
                {searchResults.requests.length === 0 && 
                 searchResults.companies.length === 0 && 
                 searchResults.inventory.length === 0 ? (
                  <p className="text-slate-500 py-4 text-center">No matches found.</p>
                ) : (
                  <div className="space-y-6">
                    {searchResults.requests.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Requests</h4>
                        <div className="grid gap-2">
                          {searchResults.requests.map(req => (
                            <div 
                              key={req.id}
                              onClick={() => {
                                setActiveTab('requests');
                                setGlobalSearch('');
                              }}
                              className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 cursor-pointer transition-colors flex justify-between items-center"
                            >
                              <div>
                                <span className="font-medium text-cyan-200">{req.referenceId}</span>
                                <span className="mx-2 text-slate-600">|</span>
                                <span className="text-slate-400">{req.requestDetails?.companyName}</span>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded border ${adminStatusBadgeThemes[getStatusBadgeTone(getRequestLogisticsSnapshot(req).customerStatusLabel) as StatusBadgeTone]}`}>
                                {req.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.companies.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Companies</h4>
                        <div className="grid gap-2">
                          {searchResults.companies.map(company => (
                            <div 
                              key={company.id}
                              onClick={() => {
                                setSelectedCompanyId(company.id);
                                setCompanyDetailOpen(true);
                                setGlobalSearch('');
                              }}
                              className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 cursor-pointer transition-colors"
                            >
                              <div className="font-medium text-white">{company.name}</div>
                              <div className="text-xs text-slate-500">{company.domain}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.inventory.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Inventory</h4>
                        <div className="grid gap-2">
                          {searchResults.inventory.map(item => (
                            <div 
                              key={item.id}
                              onClick={() => {
                                setActiveTab('inventory');
                                setGlobalSearch('');
                              }}
                              className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 cursor-pointer transition-colors flex justify-between"
                            >
                              <div>
                                <div className="font-medium text-white">{item.referenceId || 'No Ref ID'}</div>
                                <div className="text-xs text-slate-500">Loc: {item.location || 'Unassigned'}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-slate-300">{item.quantity} joints</div>
                                <div className="text-xs text-slate-500">{item.status}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* Main Content Area */}
          <div className="relative min-h-[500px]">
            {activeTab === 'overview' && renderOverview()}
            
            {activeTab === 'approvals' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Pending Approvals</h2>
                {/* Approvals content would go here - using existing components */}
                <div className="grid gap-4">
                  {requests.filter(r => r.status === 'PENDING').length === 0 ? (
                    <GlassCard className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 mb-4">
                        <CheckCircleIcon className="w-8 h-8 text-slate-600" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-300">All Caught Up</h3>
                      <p className="text-slate-500 mt-1">No pending requests requiring approval.</p>
                    </GlassCard>
                  ) : (
                    requests
                      .filter(r => r.status === 'PENDING')
                      .map(request => (
                        <ApprovalCard
                          key={request.id}
                          request={request}
                          company={companies.find(c => c.id === request.companyId)}
                          yards={yards}
                          onApprove={async (requestId, rackIds, requiredJoints, notes) => {
                            try {
                              // 1. Update request status
                              const { error: reqError } = await supabase
                                .from('storage_requests')
                                .update({
                                  status: 'APPROVED',
                                  internal_notes: notes,
                                  updated_at: new Date().toISOString()
                                })
                                .eq('id', requestId);

                              if (reqError) throw reqError;

                              // 2. Create inventory items (simplified logic for now - normally would create items per rack)
                              // For this implementation, we'll just update the request status as the primary action
                              // In a full implementation, we would create inventory_items records here

                              // 3. Send email notification (mock or real)
                              // await emailService.sendApprovalEmail(...)

                              toast.success('Request approved successfully');
                              
                              // Refresh data
                              window.location.reload(); 
                            } catch (error) {
                              console.error('Error approving request:', error);
                              toast.error('Failed to approve request');
                            }
                          }}
                          onReject={async (requestId, reason) => {
                            try {
                              const { error } = await supabase
                                .from('storage_requests')
                                .update({
                                  status: 'REJECTED',
                                  internal_notes: `Rejected: ${reason}`,
                                  updated_at: new Date().toISOString()
                                })
                                .eq('id', requestId);

                              if (error) throw error;

                              toast.success('Request rejected');
                              window.location.reload();
                            } catch (error) {
                              console.error('Error rejecting request:', error);
                              toast.error('Failed to reject request');
                            }
                          }}
                        />
                      ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pending-loads' && <PendingLoadsTile />}
            {activeTab === 'approved-loads' && <ApprovedLoadsTile />}
            {activeTab === 'in-transit' && <InTransitTile />}
            {activeTab === 'outbound-loads' && <OutboundLoadsTile />}
            
            {activeTab === 'requests' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">All Requests</h2>
                <div className="overflow-x-auto">
                   {/* Request table implementation */}
                   <GlassCard>
                     <p className="text-slate-400 text-center py-8">Request list view implementation...</p>
                   </GlassCard>
                </div>
              </div>
            )}
            
            {activeTab === 'companies' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Companies</h2>
                <CompanyTileCarousel 
                   onCompanyClick={setSelectedCompanyId}
                   onViewCompanyDetails={(id) => {
                     setSelectedCompanyId(id);
                     setCompanyDetailOpen(true);
                   }}
                   selectedCompanyId={selectedCompanyId}
                   yards={yards}
                />
              </div>
            )}
            
            {activeTab === 'inventory' && (
              <InventoryManagement inventory={inventory} companies={companies} />
            )}
            
            {activeTab === 'storage' && (
              <StorageManagement 
                yards={yards}
                inventory={inventory}
                onRackClick={(rack) => {
                  setSelectedRack(rack);
                  setRackAdjustmentOpen(true);
                }}
              />
            )}
            
            {activeTab === 'shipments' && (
              <ShipmentManagement 
                shipments={shipments}
                inventory={inventory}
                companies={companies}
              />
            )}
            
            {activeTab === 'ai' && (
              <div className="h-[calc(100vh-12rem)]">
                <AdminAIAssistant />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <CompanyDetailModal
        isOpen={isCompanyDetailOpen}
        onClose={() => {
          setSelectedCompanyId(null);
          setCompanyDetailOpen(false);
        }}
        companyId={selectedCompanyId}
        requests={requests}
        inventory={inventory}
        yards={yards}
      />

      <ManualRackAdjustmentModal
        isOpen={isRackAdjustmentOpen}
        onClose={() => {
          setSelectedRack(null);
          setRackAdjustmentOpen(false);
        }}
        rack={selectedRack}
        // inventory={inventory}
        onSuccess={() => {
             window.location.reload();
        }}
      />



      {/* Delete Load Confirmation Modal */}
      {loadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-gray-900 w-full max-w-md rounded-xl border border-gray-700 p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">Delete Load #{loadToDelete.sequenceNumber}?</h3>
            <p className="text-gray-300">
              Are you sure you want to delete this trucking load? This action cannot be undone.
            </p>
            {docViewerError && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
                {docViewerError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <GlassButton
                variant="secondary"
                onClick={() => {
                  setLoadToDelete(null);
                  setDocViewerError(null);
                }}
              >
                Cancel
              </GlassButton>
              <GlassButton
                variant="danger"
                onClick={confirmDeleteLoad}
              >
                Delete Load
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Load Modal */}
      {/* Edit Load Modal */}
      {editingLoad && (() => {
        const request = requests.find(r => r.id === editingLoad.requestId);
        const load = request?.truckingLoads?.find(l => l.id === editingLoad.id);
        if (!load) return null;

        return (
          <EditLoadModal
            load={load}
            onClose={() => setEditingLoad(null)}
            onSave={async (updatedLoad) => {
              try {
                const { error } = await supabase
                  .from('trucking_loads')
                  // @ts-expect-error - Supabase type inference issue with trucking_loads update schema
                  .update({
                    direction: updatedLoad.direction,
                    sequence_number: updatedLoad.sequenceNumber,
                    status: updatedLoad.status,
                    scheduled_slot_start: updatedLoad.scheduledSlotStart,
                    scheduled_slot_end: updatedLoad.scheduledSlotEnd,
                    asset_name: updatedLoad.assetName,
                    wellpad_name: updatedLoad.wellpadName,
                    well_name: updatedLoad.wellName,
                    uwi: updatedLoad.uwi,
                    trucking_company: updatedLoad.truckingCompany,
                    contact_company: updatedLoad.contactCompany,
                    contact_name: updatedLoad.contactName,
                    contact_phone: updatedLoad.contactPhone,
                    contact_email: updatedLoad.contactEmail,
                    driver_name: updatedLoad.driverName,
                    driver_phone: updatedLoad.driverPhone,
                    notes: updatedLoad.notes,
                    total_joints_planned: updatedLoad.totalJointsPlanned,
                    total_length_ft_planned: updatedLoad.totalLengthFtPlanned,
                    total_weight_lbs_planned: updatedLoad.totalWeightLbsPlanned,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', load.id);

                if (error) throw error;

                // Reload the request to get updated data
                const { data: updatedRequest, error: fetchError } = await supabase
                  .from('storage_requests')
                  .select(`
                    *,
                    truckingLoads:trucking_loads(
                      *,
                      documents:trucking_documents(*)
                    )
                  `)
                  .eq('id', editingLoad.requestId)
                  .single();

                if (fetchError) throw fetchError;

                await updateRequest(updatedRequest);
                setEditingLoad(null);
                setDocViewerError(null);
              } catch (error) {
                console.error('Error updating load:', error);
                setDocViewerError('Failed to update load. Please try again.');
              }
            }}
          />
        );
      })()}
    </div>
  );
};

// Edit Load Modal Component
function EditLoadModal({ load, onClose, onSave }: {
  load: TruckingLoad;
  onClose: () => void;
  onSave: (load: TruckingLoad) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    direction: load.direction,
    sequenceNumber: load.sequenceNumber,
    status: load.status,
    scheduledSlotStart: load.scheduledSlotStart || '',
    scheduledSlotEnd: load.scheduledSlotEnd || '',
    assetName: load.assetName || '',
    wellpadName: load.wellpadName || '',
    wellName: load.wellName || '',
    uwi: load.uwi || '',
    truckingCompany: load.truckingCompany || '',
    contactCompany: load.contactCompany || '',
    contactName: load.contactName || '',
    contactPhone: load.contactPhone || '',
    contactEmail: load.contactEmail || '',
    driverName: load.driverName || '',
    driverPhone: load.driverPhone || '',
    notes: load.notes || '',
    totalJointsPlanned: load.totalJointsPlanned || null,
    totalLengthFtPlanned: load.totalLengthFtPlanned || null,
    totalWeightLbsPlanned: load.totalWeightLbsPlanned || null,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...load,
      ...formData,
      scheduledSlotStart: formData.scheduledSlotStart || null,
      scheduledSlotEnd: formData.scheduledSlotEnd || null,
      assetName: formData.assetName || null,
      wellpadName: formData.wellpadName || null,
      wellName: formData.wellName || null,
      uwi: formData.uwi || null,
      truckingCompany: formData.truckingCompany || null,
      contactCompany: formData.contactCompany || null,
      contactName: formData.contactName || null,
      contactPhone: formData.contactPhone || null,
      contactEmail: formData.contactEmail || null,
      driverName: formData.driverName || null,
      driverPhone: formData.driverPhone || null,
      notes: formData.notes || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="bg-slate-900/95 backdrop-blur-xl w-full max-w-3xl rounded-xl border border-slate-700/50 my-8 shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-slate-700/50 sticky top-0 bg-slate-900/95 z-10 rounded-t-xl">
          <h3 className="text-xl font-bold text-white">Edit Load #{load.sequenceNumber}</h3>
          <GlassButton
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            ✕
          </GlassButton>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Direction and Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Direction</label>
              <select
                value={formData.direction}
                onChange={(e) => setFormData({...formData, direction: e.target.value as TruckingLoadDirection})}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                <option value="INBOUND">INBOUND (to MPS)</option>
                <option value="OUTBOUND">OUTBOUND (from MPS)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sequence #</label>
              <input
                type="number"
                value={formData.sequenceNumber}
                onChange={(e) => setFormData({...formData, sequenceNumber: parseInt(e.target.value) || 1})}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as TruckingLoadStatus})}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                <option value="NEW">NEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="IN_TRANSIT">IN TRANSIT</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Scheduled Start</label>
              <input
                type="datetime-local"
                value={formData.scheduledSlotStart ? new Date(formData.scheduledSlotStart).toISOString().slice(0, 16) : ''}
                onChange={(e) => setFormData({...formData, scheduledSlotStart: e.target.value ? new Date(e.target.value).toISOString() : ''})}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Scheduled End</label>
              <input
                type="datetime-local"
                value={formData.scheduledSlotEnd ? new Date(formData.scheduledSlotEnd).toISOString().slice(0, 16) : ''}
                onChange={(e) => setFormData({...formData, scheduledSlotEnd: e.target.value ? new Date(e.target.value).toISOString() : ''})}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>
          </div>

          {/* Well Information */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Well Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Asset Name</label>
                <input
                  type="text"
                  value={formData.assetName}
                  onChange={(e) => setFormData({...formData, assetName: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Wellpad Name</label>
                <input
                  type="text"
                  value={formData.wellpadName}
                  onChange={(e) => setFormData({...formData, wellpadName: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Well Name</label>
                <input
                  type="text"
                  value={formData.wellName}
                  onChange={(e) => setFormData({...formData, wellName: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">UWI</label>
                <input
                  type="text"
                  value={formData.uwi}
                  onChange={(e) => setFormData({...formData, uwi: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Trucking Company</label>
                <input
                  type="text"
                  value={formData.truckingCompany}
                  onChange={(e) => setFormData({...formData, truckingCompany: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Contact Company</label>
                <input
                  type="text"
                  value={formData.contactCompany}
                  onChange={(e) => setFormData({...formData, contactCompany: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Driver Information */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Driver Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Driver Name</label>
                <input
                  type="text"
                  value={formData.driverName}
                  onChange={(e) => setFormData({...formData, driverName: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Driver Phone</label>
                <input
                  type="tel"
                  value={formData.driverPhone}
                  onChange={(e) => setFormData({...formData, driverPhone: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Planned Quantities */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Planned Quantities</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Total Joints</label>
                <input
                  type="number"
                  value={formData.totalJointsPlanned || ''}
                  onChange={(e) => setFormData({...formData, totalJointsPlanned: e.target.value ? parseInt(e.target.value) : null})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Total Length (ft)</label>
                <input
                  type="number"
                  value={formData.totalLengthFtPlanned || ''}
                  onChange={(e) => setFormData({...formData, totalLengthFtPlanned: e.target.value ? parseFloat(e.target.value) : null})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  step="0.1"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Total Weight (lbs)</label>
                <input
                  type="number"
                  value={formData.totalWeightLbsPlanned || ''}
                  onChange={(e) => setFormData({...formData, totalWeightLbsPlanned: e.target.value ? parseFloat(e.target.value) : null})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  step="0.1"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              placeholder="Additional notes or instructions..."
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-gray-800 bg-gray-900 rounded-b-xl sticky bottom-0">
          <GlassButton
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </GlassButton>
        </div>
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
  const [selectedCapacity, setSelectedCapacity] = useState(0);
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

    // Validate capacity before approving
    if (selectedCapacity < requiredJoints) {
      const shortfall = requiredJoints - selectedCapacity;
      alert(
        `Cannot approve: Selected racks have insufficient capacity.\n\n` +
        `Required: ${requiredJoints} joints\n` +
        `Available: ${selectedCapacity} joints\n` +
        `Shortfall: ${shortfall} joints\n\n` +
        `Please select additional racks or contact the customer to split the request.`
      );
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



  const capacityStatus = useMemo(() => {
    if (selectedRacks.length === 0) {
      return { type: 'none', message: 'No racks selected' };
    }
    const diff = selectedCapacity - requiredJoints;
    if (diff < 0) {
      return {
        type: 'insufficient',
        message: `Insufficient capacity: ${Math.abs(diff)} joints short`,
      };
    }
    if (diff === 0) {
      return { type: 'exact', message: 'Perfect fit!' };
    }
    return { type: 'excess', message: `${diff} joints excess capacity` };
  }, [selectedCapacity, requiredJoints, selectedRacks.length]);

  return (
    <div className="relative group">
      {/* Gradient glow */}
      <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
      
      <GlassCard className="relative p-6 bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
        <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 rounded-xl"></div>
        
        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold bg-linear-to-r from-white via-indigo-100 to-purple-100 bg-clip-text text-transparent">{request.referenceId}</h3>
              <p className="text-sm text-slate-400">{company?.name || 'Unknown Company'}</p>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]">PENDING</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 text-sm">
            <div className="relative group/info">
              <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-500/20 to-purple-500/20 rounded-lg blur opacity-0 group-hover/info:opacity-100 transition duration-300"></div>
              <div className="relative bg-slate-800/60 border border-slate-700/50 rounded-md p-3 backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Contact</p>
                <p className="text-white font-semibold">{request.requestDetails?.fullName || 'Name not provided'}</p>
                <p className="text-xs text-slate-400 break-words mt-1">{request.userId}</p>
              </div>
            </div>
            <div className="relative group/info">
              <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-500/20 to-purple-500/20 rounded-lg blur opacity-0 group-hover/info:opacity-100 transition duration-300"></div>
              <div className="relative bg-slate-800/60 border border-slate-700/50 rounded-md p-3 backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Total Volume</p>
          <p className="text-white">{requiredJoints} joints</p>
                {totalLengthMeters !== null && (
                  <p className="text-xs text-slate-500 mt-1">~ {totalLengthMeters.toFixed(1)} m total length</p>
                )}
              </div>
            </div>
            <div className="relative group/info">
              <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-500/20 to-purple-500/20 rounded-lg blur opacity-0 group-hover/info:opacity-100 transition duration-300"></div>
              <div className="relative bg-slate-800/60 border border-slate-700/50 rounded-md p-3 backdrop-blur-md">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Timeline</p>
                <p className="text-white">
                  {details?.storageStartDate || '-'}{' -> '}{details?.storageEndDate || '-'}
                </p>
              </div>
            </div>
          </div>

          {pipeFacts.length > 0 && (
            <div className="bg-slate-800/70 border border-indigo-500/20 rounded-lg p-4 mb-6 backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.15)]">
              <h4 className="text-sm font-semibold bg-linear-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent mb-3 uppercase tracking-wide">Pipe Information</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-slate-300">
            {pipeFacts.map(item => (
              <div key={item.label}>
                <dt className="text-xs uppercase text-slate-500">{item.label}</dt>
                <dd className="text-white">{item.value}</dd>
              </div>
            ))}
              </dl>
            </div>
          )}

          {truckingFacts.length > 0 && (
            <div className="bg-slate-800/70 border border-purple-500/20 rounded-lg p-4 mb-6 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.15)]">
              <h4 className="text-sm font-semibold bg-linear-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent mb-3 uppercase tracking-wide">Trucking</h4>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
            {truckingFacts.map(fact => (
              <div key={fact.label} className={fact.fullWidth ? 'sm:col-span-2' : undefined}>
                <dt className="text-xs uppercase text-slate-500">{fact.label}</dt>
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
            <div className="relative group/notes">
              <div className="absolute -inset-0.5 bg-linear-to-r from-slate-500/10 to-slate-600/10 rounded-lg blur opacity-0 group-hover/notes:opacity-100 focus-within:opacity-100 transition duration-300"></div>
              <textarea
                id={`internal-notes-${request.id}`}
                className="relative w-full bg-slate-900/90 border border-slate-700/50 rounded-md p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm"
          rows={3}
          placeholder="Add context for logistics or follow-up steps..."
          value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Notes are stored with the request and appear in the All Requests table for future reference.
            </p>
          </div>

      <div className="mb-6">
        <h4 className="text-sm font-semibold text-white mb-2">Select Storage Racks</h4>

        {/* Capacity Status Banner */}
        {selectedRacks.length > 0 && (
          <div
            className={`mb-3 p-3 rounded-md border ${
              capacityStatus.type === 'insufficient'
                ? 'bg-red-900/20 border-red-500/50 text-red-300'
                : capacityStatus.type === 'exact'
                ? 'bg-green-900/20 border-green-500/50 text-green-300'
                : 'bg-blue-900/20 border-blue-500/50 text-blue-300'
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-semibold">Capacity Check: </span>
                <span>{capacityStatus.message}</span>
              </div>
              <div className="text-xs">
                <span className="opacity-75">Selected: </span>
                <span className="font-semibold">{selectedCapacity}</span>
                <span className="opacity-75"> / Required: </span>
                <span className="font-semibold">{requiredJoints}</span>
                <span className="opacity-75"> joints</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <RackSelector
            yards={yards}
            startDate={request.requestDetails?.storageStartDate || new Date().toISOString().split('T')[0]}
            endDate={request.requestDetails?.storageEndDate || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]}
            requiredJoints={requiredJoints}
            onSelectionChange={(ids, cap) => {
              setSelectedRacks(ids);
              setSelectedCapacity(cap);
            }}
          />
        </div>
        {selectedRacks.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">Selected: {selectedRacks.join(', ')}</p>
        )}
      </div>

          <div className="flex gap-3">
            <div className="flex-1 relative group/approve">
              <div className="absolute -inset-0.5 bg-linear-to-r from-green-500 to-emerald-500 rounded-lg blur opacity-30 group-hover/approve:opacity-60 transition duration-300"></div>
              <GlassButton
                onClick={handleApprove}
                disabled={actionLoading || capacityStatus.type === 'insufficient'}
                className="relative w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
                title={
                  capacityStatus.type === 'insufficient'
                    ? 'Cannot approve: insufficient rack capacity'
                    : 'Approve this storage request'
                }
              >
                {capacityStatus.type === 'insufficient' ? 'Insufficient Capacity' : 'Approve'}
              </GlassButton>
            </div>
            <div className="flex-1 relative group/reject">
              <div className="absolute -inset-0.5 bg-linear-to-r from-red-500 to-rose-500 rounded-lg blur opacity-30 group-hover/reject:opacity-60 transition duration-300"></div>
              <GlassButton
                onClick={handleReject}
                disabled={actionLoading}
                className="relative w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_30px_rgba(244,63,94,0.5)]"
              >
                Reject
              </GlassButton>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default AdminDashboard;


