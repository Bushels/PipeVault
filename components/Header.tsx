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
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 shadow-lg shadow-indigo-500/10">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-indigo-500/50 to-transparent opacity-50" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="relative group">
                <div className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <PipeVaultIcon className="w-8 h-8 text-cyan-500 relative z-10 transform transition-transform duration-500 group-hover:rotate-180 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"/>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  PipeVault
                </h1>
                <span className="hidden lg:inline text-slate-600">|</span>
                <span className="hidden lg:inline text-sm font-medium text-slate-300 tracking-wide">
                  {session.company.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block font-medium">
                Welcome back, <span className="text-indigo-400">{firstName}</span>
              </p>
            </div>
          </div>
          <Button onClick={onLogout} variant="secondary" className="flex items-center gap-2 py-2! px-4!">
            <LogOutIcon className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;