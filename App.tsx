
import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import { useMockData } from './hooks/useMockData';
import type { AppSession } from './types';

function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const data = useMockData();

  const handleLogin = (session: AppSession) => {
    setSession(session);
  };

  const handleLogout = () => {
    setSession(null);
  };
  
  const renderContent = () => {
      if (!session) {
          return (
             <LoginScreen 
                companies={data.companies} 
                requests={data.requests} 
                onLogin={handleLogin}
                addCompany={data.addCompany}
            />
          );
      }

      if ('isAdmin' in session && session.isAdmin) {
          return (
            <AdminDashboard 
                session={session}
                onLogout={handleLogout}
                requests={data.requests}
                companies={data.companies}
                yards={data.yards}
                approveRequest={data.approveRequest}
                rejectRequest={data.rejectRequest}
            />
          );
      } else {
        // FIX: By using an else block, we make the type narrowing explicit.
        // After checking for `isAdmin`, TypeScript correctly infers that `session`
        // must be of type `Session` within this block, resolving the property access errors.
        const userRequests = data.requests.filter((r) => r.companyId === session.company.id);
        const allCompanyInventory = data.inventory.filter((i) => i.companyId === session.company.id);
        const projectInventory = session.referenceId 
          ? allCompanyInventory.filter(i => i.referenceId === session.referenceId)
          : [];
          
        return (
          <Dashboard
            session={session}
            onLogout={handleLogout}
            requests={userRequests}
            projectInventory={projectInventory}
            allCompanyInventory={allCompanyInventory}
            updateRequest={data.updateRequest}
            addRequest={data.addRequest}
          />
        );
      }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {renderContent()}
    </div>
  );
}

export default App;
