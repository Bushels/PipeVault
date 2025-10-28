import React, { useState } from 'react';
import MainMenu, { TileAction } from './components/MainMenu';
import NewStorageRequestForm from './components/NewStorageRequestForm';
import AIInquiryChat from './components/AIInquiryChat';
import ScheduleDeliveryForm from './components/ScheduleDeliveryForm';
import RequestPickupForm from './components/RequestPickupForm';
import ContactSupport, { FloatingSupport } from './components/ContactSupport';
import AdminDashboard from './components/admin/AdminDashboard';
import type { AppSession, UserSession, AdminSession, NewStorageRequestForm as RequestFormData } from './types';
import { createStorageRequest, createNotification } from './services/wixData';
import { useMockData } from './hooks/useMockData';

type ViewType = 'menu' | 'new-request' | 'inquiry' | 'schedule-delivery' | 'request-pickup' | 'admin';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('menu');
  const [session, setSession] = useState<AppSession | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const data = useMockData();

  // Mock session - in production, this would come from Wix Members
  const mockSession: UserSession = {
    customerId: 'customer123',
    customerEmail: 'user@example.com',
    companyName: 'Test Company',
    contactName: 'John Doe',
    isAdmin: false,
  };

  // Handle tile click
  const handleTileClick = (action: TileAction) => {
    setCurrentView(action);
  };

  // Handle back to menu
  const handleBackToMenu = () => {
    setCurrentView('menu');
  };

  // Handle new request submission
  const handleRequestSubmit = async (formData: RequestFormData) => {
    try {
      // Create storage request
      const response = await createStorageRequest({
        requestNumber: '', // Auto-generated
        status: 'submitted',
        customerId: mockSession.customerId,
        customerEmail: formData.customerEmail,
        projectReference: formData.projectReference,
        contactName: formData.contactName,
        companyName: formData.companyName,
        phoneNumber: formData.phoneNumber,
        itemType: formData.itemType,
        itemTypeOther: formData.itemTypeOther,
        casingOD: formData.casingOD,
        casingODInches: formData.casingODInches,
        casingWeight: formData.casingWeight,
        casingID: formData.casingID,
        casingIDInches: formData.casingIDInches,
        driftID: formData.driftID,
        driftIDInches: formData.driftIDInches,
        grade: formData.grade,
        gradeOther: formData.gradeOther,
        connection: formData.connection,
        connectionOther: formData.connectionOther,
        threadType: formData.threadType,
        avgJointLength: formData.avgJointLength,
        totalJoints: formData.totalJoints,
        totalLength: formData.totalLength || 0,
        storageStartDate: new Date(formData.storageStartDate),
        storageEndDate: new Date(formData.storageEndDate),
      });

      if (response.success && response.data) {
        // Create notification for admin
        await createNotification({
          type: 'new-request',
          requestId: response.data._id!,
          customerId: mockSession.customerId,
          title: 'New Storage Request',
          message: `${formData.companyName} submitted request for ${formData.totalJoints} joints`,
          priority: 'high',
          isRead: false,
          actionRequired: true,
          actionType: 'approve',
        });

        alert(`Request submitted successfully! Request Number: ${response.data.requestNumber}\n\nOur team will review your request and send you an email with your login credentials once approved.`);
        setCurrentView('menu');
      }
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request. Please try again.');
    }
  };

  // Handle delivery scheduled
  const handleDeliveryScheduled = () => {
    alert('Delivery scheduled successfully! You will receive a confirmation email shortly.');
    setCurrentView('menu');
  };

  // Handle pickup requested
  const handlePickupRequested = () => {
    alert('Pickup request submitted successfully! Our team will review and contact you shortly.');
    setCurrentView('menu');
  };

  // Render current view
  const renderView = () => {
    switch (currentView) {
      case 'menu':
        return (
          <MainMenu
            onTileClick={handleTileClick}
            customerName={mockSession.contactName}
          />
        );

      case 'new-request':
        return (
          <NewStorageRequestForm
            onBack={handleBackToMenu}
            onSubmit={handleRequestSubmit}
            customerEmail={mockSession.customerEmail}
            companyName={mockSession.companyName}
            contactName={mockSession.contactName}
          />
        );

      case 'inquiry':
        return (
          <AIInquiryChat
            onBack={handleBackToMenu}
            customerEmail={mockSession.customerEmail}
          />
        );

      case 'schedule-delivery':
        return (
          <ScheduleDeliveryForm
            onBack={handleBackToMenu}
            onSuccess={handleDeliveryScheduled}
            customerEmail={mockSession.customerEmail}
          />
        );

      case 'request-pickup':
        return (
          <RequestPickupForm
            onBack={handleBackToMenu}
            onSuccess={handlePickupRequested}
            customerEmail={mockSession.customerEmail}
          />
        );

      case 'admin':
        return (
          <AdminDashboard
            session={{
              adminId: 'admin1',
              adminEmail: 'admin@mps.com',
              username: 'MPS Admin',
              isAdmin: true,
            }}
            onLogout={handleBackToMenu}
            requests={data.requests}
            companies={data.companies}
            yards={data.yards}
            approveRequest={data.approveRequest}
            rejectRequest={data.rejectRequest}
          />
        );

      default:
        return (
          <MainMenu
            onTileClick={handleTileClick}
            customerName={mockSession.contactName}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {renderView()}

      {/* Floating Support Button (always visible) */}
      <FloatingSupport onClick={() => setSupportOpen(true)} />

      {/* Contact Support Modal */}
      <ContactSupport
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
      />
    </div>
  );
}

export default App;
