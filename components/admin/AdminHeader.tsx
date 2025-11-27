import React, { useState } from 'react';
import type { AdminSession } from '../../types';
import GlassButton from '../ui/GlassButton';
import { LogOutIcon, PipeVaultIcon } from '../icons/Icons';
import ChangePasswordModal from './ChangePasswordModal';

interface AdminHeaderProps {
  session: AdminSession;
  onLogout: () => void;
  onMenuToggle?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ session, onLogout, onMenuToggle }) => {
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);

  return (
    <>
      <header className="glass-panel border-b-0 rounded-none sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              {/* Mobile Menu Button */}
              <button 
                onClick={onMenuToggle}
                className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full"></div>
                <PipeVaultIcon className="w-8 h-8 text-cyan-500 relative z-10 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]"/>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block">
                PipeVault <span className="text-slate-400 font-normal">| Admin Panel</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-slate-300 hidden sm:inline font-medium">Welcome, {session.username}</span>
               
               {/* Password Change Button */}
               <button
                 onClick={() => setPasswordModalOpen(true)}
                 className="group relative flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 rounded-lg transition-all hover:scale-105 backdrop-blur-sm"
                 title="Change Password"
               >
                 <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                 </svg>
                 <span className="hidden md:inline text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Password</span>
               </button>

               <GlassButton onClick={onLogout} variant="secondary" className="bg-slate-800! hover:bg-slate-700! border-slate-600!">
                  <LogOutIcon className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Logout</span>
              </GlassButton>
            </div>
          </div>
        </div>
      </header>

      {/* Password Change Modal */}
      <ChangePasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </>
  );
};

export default AdminHeader;
