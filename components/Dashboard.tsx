import React, { useState } from 'react';
import Header from './Header';
import Chatbot from './Chatbot';
import InventoryDisplay from './InventoryDisplay';
import StorageRequestWizard from './StorageRequestWizard';
import StorageRequestMenu from './StorageRequestMenu';
import FormHelperChatbot from './FormHelperChatbot';
import type { Session, StorageRequest, Pipe } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';

interface DashboardProps {
  session: Session;
  onLogout: () => void;
  requests: StorageRequest[];
  projectInventory: Pipe[];
  allCompanyInventory: Pipe[];
  updateRequest: (request: StorageRequest) => void;
  addRequest: (request: Omit<StorageRequest, 'id'>) => Promise<StorageRequest>;
}

type SelectedOption = 'menu' | 'new-storage' | 'delivery-in' | 'delivery-out' | 'inquire';

const Dashboard: React.FC<DashboardProps> = ({ session, onLogout, requests, projectInventory, allCompanyInventory, updateRequest, addRequest }) => {
  const [selectedOption, setSelectedOption] = useState<SelectedOption>('menu');

  // Find the request associated with the login
  const relevantRequest = session.referenceId
    ? requests.find(r => r.referenceId === session.referenceId)
    : null;

  // Check if user has any approved requests
  const hasActiveRequest = requests.some(r => r.companyId === session.company.id && r.status === 'APPROVED');

  const renderContent = () => {
    switch (selectedOption) {
      case 'new-storage':
        return (
          <div className="relative">
            <Button
              onClick={() => setSelectedOption('menu')}
              className="mb-4 bg-gray-700 hover:bg-gray-600"
            >
              ← Back to Menu
            </Button>
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
          </div>
        );

      case 'delivery-in':
        return (
          <div className="relative">
            <Button
              onClick={() => setSelectedOption('menu')}
              className="mb-4 bg-gray-700 hover:bg-gray-600"
            >
              ← Back to Menu
            </Button>
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Schedule Delivery to MPS</h2>
              <p className="text-gray-400 mb-6">
                AI-powered delivery scheduling coming soon...
              </p>
              <p className="text-sm text-gray-500">
                This will guide you through scheduling pipe delivery to our facility,
                including trucking options and document uploads.
              </p>
            </Card>
          </div>
        );

      case 'delivery-out':
        return (
          <div className="relative">
            <Button
              onClick={() => setSelectedOption('menu')}
              className="mb-4 bg-gray-700 hover:bg-gray-600"
            >
              ← Back to Menu
            </Button>
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Schedule Delivery to Worksite</h2>
              <p className="text-gray-400 mb-6">
                AI-powered worksite delivery scheduling coming soon...
              </p>
              <p className="text-sm text-gray-500">
                This will help you arrange pickup from MPS and delivery to your well site.
              </p>
            </Card>
          </div>
        );

      case 'inquire':
        return (
          <div className="relative">
            <Button
              onClick={() => setSelectedOption('menu')}
              className="mb-4 bg-gray-700 hover:bg-gray-600"
            >
              ← Back to Menu
            </Button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-2 flex flex-col gap-6">
                <Card>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">
                      Your Requests & Inventory
                    </h2>
                  </div>
                  {requests.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3">Storage Requests</h3>
                      <div className="space-y-3">
                        {requests.map((request) => (
                          <div
                            key={request.id}
                            className="border border-gray-700 rounded-lg p-3 bg-gray-800"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{request.referenceId}</h4>
                                <p className="text-xs text-gray-400">
                                  {request.requestDetails?.fullName}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  request.status === 'APPROVED'
                                    ? 'bg-green-900 text-green-200'
                                    : request.status === 'PENDING'
                                    ? 'bg-yellow-900 text-yellow-200'
                                    : request.status === 'REJECTED'
                                    ? 'bg-red-900 text-red-200'
                                    : 'bg-gray-700 text-gray-300'
                                }`}
                              >
                                {request.status}
                              </span>
                            </div>
                            {request.status === 'APPROVED' && request.assignedLocation && (
                              <p className="text-xs text-green-400 mt-1">
                                📍 {request.assignedLocation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Inventory</h3>
                    <InventoryDisplay inventory={allCompanyInventory} />
                  </div>
                </Card>
              </div>
              <div className="lg:col-span-1">
                <Chatbot companyName={session.company.name} inventoryData={allCompanyInventory} />
              </div>
            </div>
          </div>
        );

      case 'menu':
      default:
        return (
          <StorageRequestMenu
            companyName={session.company.name}
            hasActiveRequest={hasActiveRequest}
            onSelectOption={setSelectedOption}
          />
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header session={session} onLogout={onLogout} />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
