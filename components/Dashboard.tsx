import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Header from './Header';
import StorageRequestWizard from './StorageRequestWizard';
import StorageRequestMenu from './StorageRequestMenu';
import FormHelperChatbot from './FormHelperChatbot';
import InboundShipmentWizard from './InboundShipmentWizard';
import RequestDocumentsPanel from './RequestDocumentsPanel';
import type { Session, StorageRequest, Pipe } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import { useAuth } from '../lib/AuthContext';
import { resolveCustomerIdentity } from '../utils/customerIdentity';
import toast from 'react-hot-toast';

interface DashboardProps {
  session: Session;
  onLogout: () => void;
  requests: StorageRequest[];
  companyRequests: StorageRequest[];
  projectInventory: Pipe[];
  allCompanyInventory: Pipe[];
  documents: any[];
  updateRequest: (request: StorageRequest) => Promise<StorageRequest | void> | StorageRequest | void;
  addRequest: (request: Omit<StorageRequest, 'id'>) => Promise<StorageRequest>;
}

type SelectedOption = 'menu' | 'new-storage' | 'delivery-in' | 'delivery-out' | 'chat' | 'upload-docs';

const Dashboard: React.FC<DashboardProps> = ({ session, onLogout, requests, companyRequests, projectInventory, updateRequest, addRequest }) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<Omit<SelectedOption, 'chat'> | 'menu'>('menu');
  const [archivingRequestId, setArchivingRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StorageRequest | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<StorageRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user has any approved requests
  const hasActiveRequest = requests.some(r => r.status === 'APPROVED');
  const currentUserEmail = session.userId;

  const handleWizardSubmit = async (data: any) => {
      setIsSubmitting(true);
      try {
          // Transform NewRequestDetails to StorageRequest format if needed, 
          // but addRequest likely expects Omit<StorageRequest, 'id'>.
          // We need to map the wizard data to the expected request structure.
          
          // Construct the request object based on NewRequestDetails
          // Note: This mapping might need adjustment based on exact type definitions
          const requestData: any = {
              companyId: session.company.id,
              userId: session.userId,
              referenceId: data.referenceId,
              status: 'PENDING', // Default status
              requestDetails: data,
              truckingInfo: {
                  truckingType: data.truckingType || 'none',
                  details: data.truckingType === 'provided' ? {
                      storageCompany: data.storageCompany,
                      storageContactName: data.storageContactName,
                      storageContactEmail: data.storageContactEmail,
                      storageContactNumber: data.storageContactNumber,
                      storageLocation: data.storageLocation,
                      specialInstructions: data.specialInstructions
                  } : undefined
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          };

          const newRequest = await addRequest(requestData);
          handleRequestSubmitted(newRequest);
          setSelectedOption('menu');
          toast.success('Request submitted successfully!');
      } catch (error) {
          console.error('Error submitting request:', error);
          toast.error('Failed to submit request. Please try again.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSelectOption = (option: SelectedOption) => {
    if (option === 'chat') {
      // Chat is now handled within the StorageRequestMenu tile
      return;
    } else {
      setSelectedOption(option);
    }
  };

  const handleScheduleDelivery = (request: StorageRequest) => {
    const inboundLoads = (request.truckingLoads ?? []).filter(load => load.direction === 'INBOUND');
    const blockingLoad = inboundLoads
      .slice()
      .sort((a, b) => b.sequenceNumber - a.sequenceNumber)
      .find(load => !load.documents || load.documents.length === 0);

    if (blockingLoad) {
      const uploadNow = window.confirm(
        `Load ${blockingLoad.sequenceNumber} is missing manifest paperwork. Upload the documents before booking another load?\n\nPress OK to upload now. Press Cancel to continue without uploading (not recommended).`
      );
      if (uploadNow) {
        setSelectedRequest(request);
        setSelectedOption('upload-docs');
        return;
      }
    }

    setSelectedRequest(request);
    setSelectedOption('delivery-in');
  };

  const handleUploadDocuments = (request: StorageRequest) => {
    setSelectedRequest(request);
    setSelectedOption('upload-docs');
  };

  const handleDeliveryScheduled = async (updatedRequest: StorageRequest) => {
    try {
      setSelectedRequest(updatedRequest);
      const result = await Promise.resolve(updateRequest(updatedRequest));
      if (result) {
        setSelectedRequest(result);
      }
    } catch (error) {
      console.error('Failed to update request after scheduling delivery', error);
    }
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

  const handleRequestSubmitted = (newRequest: StorageRequest) => {
    setPendingSubmission(newRequest);
  };

  const handleClearPendingSubmission = () => {
    setPendingSubmission(null);
  };

  const handleReturnToDashboard = () => {
    setSelectedOption('menu');
  };

  // Removed useEffect that auto-cleared pendingSubmission

  const renderContent = () => {
    if (selectedOption === 'new-storage') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <StorageRequestWizard
              request={null}
              session={session}
              onSubmit={handleWizardSubmit}
              isSubmitting={isSubmitting}
              onReturnToDashboard={handleReturnToDashboard}
            />
          </div>
          <div className="lg:col-span-1">
            <FormHelperChatbot companyName={session.company.name} />
          </div>
        </div>
      );
    }

    if (selectedOption === 'delivery-in' || selectedOption === 'delivery-out' || selectedOption === 'upload-docs') {
      return (
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleReturnToDashboard}
            className="mb-6 flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <span className="mr-2">←</span> Back to Dashboard
          </button>
          
          {selectedOption === 'delivery-in' && selectedRequest && (
            <InboundShipmentWizard
              request={selectedRequest}
              session={session}
              onBack={() => setSelectedOption('menu')}
              onDeliveryScheduled={handleDeliveryScheduled}
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
            <RequestDocumentsPanel
              request={selectedRequest}
              session={session}
              onBack={() => setSelectedOption('menu')}
            />
          )}
        </div>
      );
    }

    return (
      <StorageRequestMenu
        companyName={session.company.name}
        hasActiveRequest={hasActiveRequest}
        requests={requests}
        companyRequests={companyRequests}
        currentUserEmail={currentUserEmail}
        onSelectOption={handleSelectOption}
        onArchiveRequest={handleArchiveRequest}
        archivingRequestId={archivingRequestId}
        onScheduleDelivery={handleScheduleDelivery}
        onUploadDocuments={handleUploadDocuments}
        pendingSubmission={pendingSubmission}
        onClearPendingSubmission={handleClearPendingSubmission}
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
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="mb-12 text-center relative"
      >
        <div className="absolute inset-0 bg-linear-to-b from-slate-900/0 via-slate-900/60 to-slate-900/90 pointer-events-none">
            <div className="w-64 h-64 bg-cyan-500/20 rounded-full mix-blend-screen filter blur-xl animate-blob"></div>
            <div className="w-64 h-64 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-xl animate-blob animation-delay-2000"></div>
        </div>
        <h1 className="relative text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-indigo-200 tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          Welcome, {displayName}
        </h1>
        {displayCompany && (
            <p className="relative text-slate-400 mt-3 text-lg font-light tracking-wide uppercase">
                {displayCompany}
            </p>
        )}
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      <Header session={session} onLogout={onLogout} />
      <main className="grow container mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        <WelcomeMessage />
        {renderContent()}
      </main>
      
      {/* Global background effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grain-elevator-prototype.s3.amazonaws.com/noise.png')] opacity-5 mix-blend-overlay"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-slate-900/50 via-transparent to-slate-900/80"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse-glow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
};

export default Dashboard;







