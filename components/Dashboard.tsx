import React from 'react';
import Header from './Header';
import Chatbot from './Chatbot';
import InventoryDisplay from './InventoryDisplay';
import StorageRequestWizard from './StorageRequestWizard';
import type { Session, StorageRequest, Pipe } from '../types';
import Card from './ui/Card';

interface DashboardProps {
  session: Session;
  onLogout: () => void;
  requests: StorageRequest[];
  projectInventory: Pipe[];
  allCompanyInventory: Pipe[];
  updateRequest: (request: StorageRequest) => void;
  addRequest: (request: Omit<StorageRequest, 'id'>) => StorageRequest;
}

const Dashboard: React.FC<DashboardProps> = ({ session, onLogout, requests, projectInventory, allCompanyInventory, updateRequest, addRequest }) => {
  // Find the request associated with the login. This could be a new request (no referenceId) or an existing one.
  const relevantRequest = session.referenceId 
    ? requests.find(r => r.referenceId === session.referenceId)
    : requests.find(r => r.userId === session.userId && !r.referenceId);

  // Show wizard if:
  // 1. User logged in without a reference ID (starting a new request)
  // 2. The relevant request is still in a draft or pending state.
  const showWizard = !session.referenceId || (relevantRequest && (relevantRequest.status === 'DRAFT' || relevantRequest.status === 'PENDING' || relevantRequest.status === 'APPROVED'));

  const activeRequest = showWizard ? relevantRequest || null : null;


  return (
    <div className="flex flex-col min-h-screen">
      <Header session={session} onLogout={onLogout} />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {showWizard ? (
          <StorageRequestWizard
            request={activeRequest}
            session={session}
            updateRequest={updateRequest}
            addRequest={addRequest}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 flex flex-col gap-6">
               <Card>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Inventory for {session.referenceId}</h2>
                </div>
                <InventoryDisplay inventory={projectInventory} />
               </Card>
            </div>
            <div className="lg:col-span-1">
              <Chatbot companyName={session.company.name} inventoryData={allCompanyInventory} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
