import React from 'react';
import type { Session } from '../types';
import Button from './ui/Button';
import { LogOutIcon, PipeVaultIcon } from './icons/Icons';
import { useAuth } from '../lib/AuthContext';

interface HeaderProps {
  session: Session;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ session, onLogout }) => {
  const { user } = useAuth();

  // Extract user's name from Supabase user metadata
  const metadataFirstName = user?.user_metadata?.first_name || '';
  const metadataLastName = user?.user_metadata?.last_name || '';
  const fullName = metadataFirstName && metadataLastName
    ? `${metadataFirstName} ${metadataLastName}`
    : metadataFirstName || metadataLastName || user?.email?.split('@')[0] || 'User';

  // Get first name for friendly greeting
  const firstName = metadataFirstName || fullName.split(' ')[0];

  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <PipeVaultIcon className="w-8 h-8 text-red-500"/>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  PipeVault
                </h1>
                <span className="hidden lg:inline text-gray-400">|</span>
                <span className="hidden lg:inline text-sm font-medium text-gray-300">
                  {session.company.name}
                </span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">
                Welcome back, {firstName}
              </p>
            </div>
          </div>
          <Button onClick={onLogout} variant="secondary" className="flex items-center gap-2">
            <LogOutIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;