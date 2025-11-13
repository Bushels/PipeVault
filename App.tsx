
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
  useShipments,
  useAddCompany,
  useAddRequest,
  useUpdateRequest,
  useUpdateInventoryItem,
  useUpdateRack,
  queryKeys,
} from './hooks/useSupabaseData';
import { useApproveRequest, useRejectRequest } from './hooks/useApprovalWorkflow';
import type { AppSession, Session, StorageRequest, Company, Pipe, Shipment } from './types';
import { queryClient } from './lib/QueryProvider';

function App() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();

  // Fetch data from Supabase
  const { data: companies = [], isLoading: loadingCompanies } = useCompanies();
  const { data: requests = [], isLoading: loadingRequests } = useRequests();
  const { data: inventory = [], isLoading: loadingInventory } = useInventory();
  const { data: documents = [], isLoading: loadingDocuments } = useDocuments();
  const { data: yards = [], isLoading: loadingYards } = useYards();
  const { data: shipments = [], isLoading: loadingShipments } = useShipments();

  // Mutations
  const addCompanyMutation = useAddCompany();
  const addRequestMutation = useAddRequest();
  const updateRequestMutation = useUpdateRequest();
  const updateInventoryMutation = useUpdateInventoryItem();
  const updateRackMutation = useUpdateRack();

  // Atomic approval/rejection workflow
  const approveRequestMutation = useApproveRequest();
  const rejectRequestMutation = useRejectRequest();

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

  /**
   * Atomic approval workflow using SECURITY DEFINER stored procedure
   * Replaces legacy multi-step approval with single RPC call
   */
  const approveRequest = async (
    requestId: string,
    assignedRackIds: string[],
    requiredJoints: number,
    notes?: string,
  ) => {
    try {
      const result = await approveRequestMutation.mutateAsync({
        requestId,
        assignedRackIds,
        requiredJoints,
        notes: notes || undefined,
      });

      console.log('✅ Approval successful:', result);

      // Invalidate legacy queries for backward compatibility
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
        queryClient.invalidateQueries({ queryKey: ['projectSummaries'] }),
      ]);
    } catch (error) {
      console.error('❌ Approval failed:', error);
      throw error;
    }
  };

  /**
   * Atomic rejection workflow using SECURITY DEFINER stored procedure
   * Replaces legacy multi-step rejection with single RPC call
   */
  const rejectRequest = async (requestId: string, reason: string, notes?: string) => {
    try {
      const result = await rejectRequestMutation.mutateAsync({
        requestId,
        rejectionReason: reason,
        notes: notes || undefined,
      });

      console.log('✅ Rejection successful:', result);

      // Invalidate legacy queries for backward compatibility
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.requests }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies }),
        queryClient.invalidateQueries({ queryKey: ['projectSummaries'] }),
      ]);
    } catch (error) {
      console.error('❌ Rejection failed:', error);
      throw error;
    }
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
  if (authLoading || loadingCompanies || loadingRequests || loadingInventory || loadingDocuments || loadingYards || loadingShipments) {
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
                shipments={shipments}
                approveRequest={approveRequest}
                rejectRequest={rejectRequest}
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

      const companyRequests =
        session.company.id && session.company.id !== 'temp'
          ? requests.filter((r) => r.companyId === session.company.id)
          : requests.filter((r) => r.userId.toLowerCase() === userEmail);

      const userRequests = companyRequests.length
        ? companyRequests.filter((r) => r.userId.trim().toLowerCase() === userEmail)
        : requests.filter((r) => r.userId.trim().toLowerCase() === userEmail);

      const allCompanyInventory = inventory.filter((i) => i.companyId === session.company.id);
      const companyDocuments = documents.filter((doc) => doc.companyId === session.company.id);

      return (
        <Dashboard
          session={session}
          onLogout={handleLogout}
          requests={userRequests}
          companyRequests={companyRequests}
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



