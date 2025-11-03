
import React from 'react';
import { useAuth } from './lib/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import {
  useCompanies,
  useRequests,
  useInventory,
  useDocuments,
  useYards,
  useTruckLoads,
  useShipments,
  useAddCompany,
  useAddRequest,
  useUpdateRequest,
  useAddTruckLoad,
  useUpdateInventoryItem,
  useUpdateRack,
  queryKeys,
} from './hooks/useSupabaseData';
import type { AppSession, Session, StorageRequest, Company, TruckLoad, Pipe, Shipment } from './types';
import * as emailService from './services/emailService';
import { queryClient } from './lib/QueryProvider';

function App() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();

  // Fetch data from Supabase
  const { data: companies = [], isLoading: loadingCompanies } = useCompanies();
  const { data: requests = [], isLoading: loadingRequests } = useRequests();
  const { data: inventory = [], isLoading: loadingInventory } = useInventory();
  const { data: documents = [], isLoading: loadingDocuments } = useDocuments();
  const { data: yards = [], isLoading: loadingYards } = useYards();
  const { data: truckLoads = [], isLoading: loadingTruckLoads } = useTruckLoads();
  const { data: shipments = [], isLoading: loadingShipments } = useShipments();

  // Mutations
  const addCompanyMutation = useAddCompany();
  const addRequestMutation = useAddRequest();
  const updateRequestMutation = useUpdateRequest();
  const addTruckLoadMutation = useAddTruckLoad();
  const updateInventoryMutation = useUpdateInventoryItem();
  const updateRackMutation = useUpdateRack();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error: any) {
      console.log('Logout error:', error?.name);
    }
  };

  // Wrapper functions to match the old useMockData interface
  const addCompany = (newCompanyData: Omit<Company, 'id'>) => {
    return addCompanyMutation.mutateAsync(newCompanyData);
  };

  const addRequest = (newRequest: Omit<StorageRequest, 'id'>) => {
    return addRequestMutation.mutateAsync(newRequest);
  };

  const updateRequest = (updatedRequest: StorageRequest) => {
    return updateRequestMutation.mutateAsync(updatedRequest);
  };

  const approveRequest = async (
    requestId: string,
    assignedRackIds: string[],
    requiredJoints: number,
    notes?: string
  ) => {
    const request = requests.find(r => r.id === requestId);
    if (!request || !request.requestDetails) return;

    const avgJointLength = request.requestDetails.avgJointLength;
    const approvedAt = new Date().toISOString();
    const approvedBy = user?.email ?? 'admin@pipevault';
    const sourceNotes = typeof notes === 'string' ? notes : request.internalNotes ?? '';
    const trimmedNotes = sourceNotes.trim();
    const internalNotes = trimmedNotes.length > 0 ? trimmedNotes : null;

    // Determine the human-readable location string
    const firstRackId = assignedRackIds[0];
    const [yardId, areaId] = firstRackId.split('-');
    const yard = yards.find(y => y.id === yardId);
    const area = yard?.areas.find(a => a.id === `${yardId}-${areaId}`);

    let assignedLocation = '';
    if (yard && area) {
      if (assignedRackIds.length > 1) {
        assignedLocation = `${yard.name}, ${area.name}, ${assignedRackIds.length} Racks`;
      } else {
        const rack = area.racks.find(r => r.id === firstRackId);
        assignedLocation = `${yard.name}, ${area.name}, ${rack?.name}`;
      }
    }

    // Update request status
    await updateRequestMutation.mutateAsync({
      ...request,
      status: 'APPROVED',
      assignedRackIds,
      assignedLocation,
      approvedAt,
      approvedBy,
      internalNotes,
      rejectionReason: null,
      rejectedAt: null,
    });

    // Update yard occupancy
    let jointsToAllocate = requiredJoints;
    for (const rackId of assignedRackIds) {
      const [yardId, areaId] = rackId.split('-');
      const yard = yards.find(y => y.id === yardId);
      const area = yard?.areas.find(a => a.id === `${yardId}-${areaId}`);
      const rack = area?.racks.find(r => r.id === rackId);

      if (rack) {
        const spaceInRack = Math.min(jointsToAllocate, rack.capacity - rack.occupied);
        const metersForRack = spaceInRack * avgJointLength;

        await updateRackMutation.mutateAsync({
          id: rackId,
          updates: {
            occupied: rack.occupied + spaceInRack,
            occupiedMeters: (rack.occupiedMeters || 0) + metersForRack,
          },
        });

        jointsToAllocate -= spaceInRack;
      }
    }

    // Send notification
    if (assignedLocation) {
      emailService.sendApprovalEmail(request.userId, request.referenceId, assignedLocation);
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
      queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
      queryClient.invalidateQueries({ queryKey: queryKeys.requestsByCompany(request.companyId) }),
    ]);
  };

  const rejectRequest = async (requestId: string, reason: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    await updateRequestMutation.mutateAsync({
      ...request,
      status: 'REJECTED',
      rejectionReason: reason,
      approvedAt: null,
      approvedBy: null,
    });

    // Send notification
    emailService.sendRejectionEmail(request.userId, request.referenceId, reason);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
      queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
      queryClient.invalidateQueries({ queryKey: queryKeys.requestsByCompany(request.companyId) }),
    ]);
  };

  const addTruckLoad = (newTruckLoad: Omit<TruckLoad, 'id'>) => {
    return addTruckLoadMutation.mutateAsync(newTruckLoad);
  };

  const pickUpPipes = async (pipeIds: string[], uwi: string, wellName: string, truckLoadId?: string) => {
    const pickUpTimestamp = new Date().toISOString();

    for (const pipeId of pipeIds) {
      const pipe = inventory.find(p => p.id === pipeId);
      if (pipe) {
        await updateInventoryMutation.mutateAsync({
          id: pipeId,
          updates: {
            status: 'PICKED_UP',
            pickUpTimestamp,
            assignedUWI: uwi,
            assignedWellName: wellName,
            pickupTruckLoadId: truckLoadId,
          },
        });
      }
    }
  };

  // Show loading state
  if (authLoading || loadingCompanies || loadingRequests || loadingInventory || loadingDocuments || loadingYards || loadingTruckLoads || loadingShipments) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading PipeVault...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not authenticated
  if (!user) {
    return <Auth />;
  }
  
  const renderContent = () => {
      // If user is admin, show admin dashboard directly
      if (isAdmin) {
          return (
            <AdminDashboard
                session={{ isAdmin: true, username: user.email || 'Admin' }}
                onLogout={handleLogout}
                requests={requests}
                companies={companies}
                yards={yards}
                inventory={inventory}
                truckLoads={truckLoads}
                shipments={shipments}
                approveRequest={approveRequest}
                rejectRequest={rejectRequest}
                addTruckLoad={addTruckLoad}
                pickUpPipes={pickUpPipes}
                updateRequest={updateRequest}
            />
          );
      }

      // Auto-create session from authenticated user
      const userEmail = user?.email?.toLowerCase() || '';
      const userDomain = userEmail.split('@')[1] || '';
      const companyMatch = companies.find((c) => c.domain.toLowerCase() === userDomain);

      // Create session with company info
      const session: Session = {
        company: companyMatch || {
          id: 'temp',
          name: user?.user_metadata?.company_name || 'Your Company',
          domain: userDomain,
        },
        userId: userEmail,
      };

      const userRequests = requests.filter((r) =>
        r.companyId === session.company.id ||
        r.userId.toLowerCase() === userEmail
      );
      const allCompanyInventory = inventory.filter((i) => i.companyId === session.company.id);
      const companyDocuments = documents.filter((doc) => doc.companyId === session.company.id);

      return (
        <Dashboard
          session={session}
          onLogout={handleLogout}
          requests={userRequests}
          projectInventory={[]}
          allCompanyInventory={allCompanyInventory}
          documents={companyDocuments}
          updateRequest={updateRequest}
          addRequest={addRequest}
        />
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {renderContent()}
    </div>
  );
}

export default App;



