import React, { useState } from 'react';
import Header from './Header';
import StorageRequestWizard from './StorageRequestWizard';
import StorageRequestMenu from './StorageRequestMenu';
import FormHelperChatbot from './FormHelperChatbot';
import Chatbot from './Chatbot';
import type { Session, StorageRequest, Pipe, StorageDocument } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import { useAuth } from '../lib/AuthContext';
import { resolveCustomerIdentity } from '../utils/customerIdentity';

interface DashboardProps {
  session: Session;
  onLogout: () => void;
  requests: StorageRequest[];
  projectInventory: Pipe[];
  allCompanyInventory: Pipe[];
  documents: StorageDocument[];
  updateRequest: (request: StorageRequest) => Promise<StorageRequest | void> | StorageRequest | void;
  addRequest: (request: Omit<StorageRequest, 'id'>) => Promise<StorageRequest>;
}

type SelectedOption = 'menu' | 'new-storage' | 'delivery-in' | 'delivery-out' | 'chat';

const Dashboard: React.FC<DashboardProps> = ({ session, onLogout, requests, projectInventory, allCompanyInventory, documents, updateRequest, addRequest }) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<Omit<SelectedOption, 'chat'> | 'menu'>('menu');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [archivingRequestId, setArchivingRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StorageRequest | null>(null);

  // Check if user has any approved requests
  const hasActiveRequest = requests.some(r => r.companyId === session.company.id && r.status === 'APPROVED');
  const currentUserEmail = session.userId;

  const handleSelectOption = (option: SelectedOption) => {
    if (option === 'chat') {
      setIsChatOpen(true);
    } else {
      setIsChatOpen(false);
      setSelectedOption(option);
    }
  };

  const handleScheduleDelivery = (request: StorageRequest) => {
    setSelectedRequest(request);
    setSelectedOption('delivery-in');
    setIsChatOpen(false);
  };

  const handleArchiveRequest = async (request: StorageRequest, shouldArchive: boolean) => {
    setArchivingRequestId(request.id);
    try {
      await Promise.resolve(
        updateRequest({
          ...request,
          archivedAt: shouldArchive ? new Date().toISOString() : null,
        })
      );
    } catch (error) {
      console.error('Failed to toggle archive state for request', error);
    } finally {
      setArchivingRequestId(null);
    }
  };

  const renderContent = () => {
    if (selectedOption !== 'menu') {
      return (
        <div className="relative">
          <Button
            onClick={() => setSelectedOption('menu')}
            className="mb-4 bg-gray-700 hover:bg-gray-600"
          >
            &lt; Back to Menu
          </Button>
          {selectedOption === 'new-storage' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-2">
                <StorageRequestWizard
                  request={null}
                  session={session}
                  updateRequest={updateRequest}
                  addRequest={addRequest}
                />
              </div>
              <div className="lg:col-span-1">
                <FormHelperChatbot companyName={session.company.name} />
              </div>
            </div>
          )}
          {selectedOption === 'delivery-in' && selectedRequest && (
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Schedule Delivery to MPS</h2>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Request: {selectedRequest.referenceId}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Item Type</p>
                    <p className="text-gray-200">{selectedRequest.requestDetails?.itemType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="text-gray-200">
                      {selectedRequest.requestDetails?.totalJoints || 0} joints
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Storage Start</p>
                    <p className="text-gray-200">
                      {selectedRequest.requestDetails?.storageStartDate
                        ? new Date(selectedRequest.requestDetails.storageStartDate).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Storage Location</p>
                    <p className="text-green-300 font-semibold">
                      {selectedRequest.assignedLocation || 'To be assigned'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-gray-400 mb-6">AI-powered delivery scheduling coming soon...</p>
              <p className="text-sm text-gray-500">This will guide you through scheduling pipe delivery to our facility, including trucking options and document uploads.</p>
            </Card>
          )}
          {selectedOption === 'delivery-out' && (
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Schedule Delivery to Worksite</h2>
              <p className="text-gray-400 mb-6">AI-powered worksite delivery scheduling coming soon...</p>
              <p className="text-sm text-gray-500">This will help you arrange pickup from MPS and delivery to your well site.</p>
            </Card>
          )}
        </div>
      );
    }

    return (
      <StorageRequestMenu
        companyName={session.company.name}
        hasActiveRequest={hasActiveRequest}
        requests={requests}
        currentUserEmail={currentUserEmail}
        onSelectOption={handleSelectOption}
        onArchiveRequest={handleArchiveRequest}
        archivingRequestId={archivingRequestId}
        onScheduleDelivery={handleScheduleDelivery}
      />
    );
  };

  const WelcomeMessage = () => {
    const { displayName, displayCompany } = resolveCustomerIdentity({
      user,
      fallbackEmail: session.userId,
      fallbackCompany: session.company?.name,
      requests,
    });

    if (!displayName && !displayCompany) {
      return null;
    }

    return (
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-white">
          Welcome, {displayName}
          {displayCompany ? ` from ${displayCompany}` : ''}!
        </h1>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header session={session} onLogout={onLogout} />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <WelcomeMessage />
        {renderContent()}
      </main>
      {isChatOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <Chatbot
            companyName={session.company.name}
            inventoryData={allCompanyInventory}
            requests={requests}
            documents={documents}
            onClose={() => setIsChatOpen(false)}
            onToggleExpand={() => setIsChatExpanded(prev => !prev)}
            isExpanded={isChatExpanded}
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;









