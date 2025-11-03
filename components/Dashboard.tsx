import React, { useState } from 'react';
import Header from './Header';
import StorageRequestWizard from './StorageRequestWizard';
import StorageRequestMenu from './StorageRequestMenu';
import FormHelperChatbot from './FormHelperChatbot';
import InboundShipmentWizard from './InboundShipmentWizard';
import type { Session, StorageRequest, Pipe } from '../types';
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
  documents: any[];
  updateRequest: (request: StorageRequest) => Promise<StorageRequest | void> | StorageRequest | void;
  addRequest: (request: Omit<StorageRequest, 'id'>) => Promise<StorageRequest>;
}

type SelectedOption = 'menu' | 'new-storage' | 'delivery-in' | 'delivery-out' | 'chat' | 'upload-docs';

const Dashboard: React.FC<DashboardProps> = ({ session, onLogout, requests, projectInventory, updateRequest, addRequest }) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<Omit<SelectedOption, 'chat'> | 'menu'>('menu');
  const [archivingRequestId, setArchivingRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StorageRequest | null>(null);

  // Check if user has any approved requests
  const hasActiveRequest = requests.some(r => r.companyId === session.company.id && r.status === 'APPROVED');
  const currentUserEmail = session.userId;

  const handleSelectOption = (option: SelectedOption) => {
    if (option === 'chat') {
      // Chat is now handled within the StorageRequestMenu tile
      return;
    } else {
      setSelectedOption(option);
    }
  };

  const handleScheduleDelivery = (request: StorageRequest) => {
    setSelectedRequest(request);
    setSelectedOption('delivery-in');
  };

  const handleUploadDocuments = (request: StorageRequest) => {
    setSelectedRequest(request);
    setSelectedOption('upload-docs');
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
            <InboundShipmentWizard
              request={selectedRequest}
              session={session}
              onBack={() => setSelectedOption('menu')}
            />
          )}
          {selectedOption === 'delivery-out' && (
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Schedule Delivery to Worksite</h2>
              <p className="text-gray-400 mb-6">AI-powered worksite delivery scheduling coming soon...</p>
              <p className="text-sm text-gray-500">This will help you arrange pickup from MPS and delivery to your well site.</p>
            </Card>
          )}
          {selectedOption === 'upload-docs' && selectedRequest && (
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Upload Documents for {selectedRequest.referenceId}</h2>
              <p className="text-gray-400 mb-6">Upload manifest, tally sheets, or other relevant documentation.</p>
              <div className="bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-400 text-sm mb-4">Document upload functionality coming soon</p>
                <p className="text-xs text-gray-500">For now, please email documents to pipevault@mpsgroup.ca</p>
              </div>
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
        onUploadDocuments={handleUploadDocuments}
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
    </div>
  );
};

export default Dashboard;









