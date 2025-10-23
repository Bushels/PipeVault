import React from 'react';
import type { AdminSession } from '../../types';
import Button from '../ui/Button';
import { LogOutIcon, PipeVaultIcon } from '../icons/Icons';

interface AdminHeaderProps {
  session: AdminSession;
  onLogout: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ session, onLogout }) => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <PipeVaultIcon className="w-8 h-8 text-red-500"/>
            <h1 className="text-xl font-bold text-white">
              PipeVault <span className="text-gray-400 font-normal">| Admin Panel</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-gray-300 hidden sm:inline">Welcome, {session.username}</span>
             <Button onClick={onLogout} variant="secondary">
                <LogOutIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
