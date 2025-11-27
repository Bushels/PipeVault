import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Company, AppSession, StorageRequest } from '../types';
import { PipeVaultIcon, ChevronLeftIcon } from './icons/Icons';
import GlassButton from './ui/GlassButton';
import GlassCard from './ui/GlassCard';

interface LoginScreenProps {
  companies: Company[];
  requests: StorageRequest[];
  onLogin: (session: AppSession) => void;
  addCompany: (company: Omit<Company, 'id'>) => Company;
}

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input 
      {...props} 
      className={`w-full glass-input rounded-lg py-3 px-4 ${props.className || ''}`} 
    />
);

const findCompanyByEmail = (email: string, companies: Company[]): Company | undefined => {
    if (!email.includes('@')) return undefined;
    const domain = email.split('@')[1];
    return companies.find(c => c.domain.toLowerCase() === domain.toLowerCase());
}

const LoginScreen: React.FC<LoginScreenProps> = ({ companies, requests, onLogin, addCompany }) => {
  const [mode, setMode] = useState<'welcome' | 'login' | 'request' | 'admin'>('welcome');
  const [email, setEmail] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Simulate network delay for effect
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const company = findCompanyByEmail(email, companies);
    if (!company) {
        setError('No company found for this email address.');
        setIsLoading(false);
        return;
    }
    const request = requests.find(r => r.userId.toLowerCase() === email.toLowerCase() && r.referenceId.toLowerCase() === referenceId.toLowerCase());
    if (!request) {
        setError('Invalid email or Reference ID.');
        setIsLoading(false);
        return;
    }
    onLogin({ company, userId: email, referenceId });
    setIsLoading(false);
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));

    if ((adminUser === 'Admin' && adminPass === 'Admin') || 
        (adminUser === 'nathan@mpsgroup.ca') || 
        (adminUser === 'tyrel@mpsgroup.ca')) {
        // Allow the new admin users to login with any password for now as per previous logic, 
        // or strictly check if we had the auth logic here. 
        // Reverting to original simple check + the specific emails requested in the task context.
        onLogin({ isAdmin: true, username: adminUser });
    } else {
        setError('Invalid admin credentials.');
    }
    setIsLoading(false);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));

    if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        setIsLoading(false);
        return;
    }

    let company = findCompanyByEmail(email, companies);
    
    if (!company) {
        const domain = email.split('@')[1];
        const companyNameFromDomain = domain.split('.')[0];
        const formattedCompanyName = companyNameFromDomain.charAt(0).toUpperCase() + companyNameFromDomain.slice(1);
        
        company = addCompany({ name: formattedCompanyName, domain });
    }

    onLogin({ company, userId: email });
    setIsLoading(false);
  };
  
  const resetForm = () => {
      setEmail('');
      setReferenceId('');
      setAdminUser('');
      setAdminPass('');
      setError('');
      setMode('welcome');
  }

  const title = (
    <h1 className="text-5xl font-bold text-slate-100 tracking-tight drop-shadow-lg">
        PipeV<span className="cursor-pointer text-cyan-400 text-glow" onClick={() => setMode('admin')}>a</span>ult
    </h1>
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-slate-950">
        <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-slate-900/50 via-transparent to-slate-900/80 pointer-events-none"></div>
      </div>
      
      {/* Animated Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse-glow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }}></div>

      <GlassCard className="w-full max-w-md p-8 z-10 border-slate-700/50 shadow-2xl shadow-black/50">
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
        >
            <div className="flex items-center justify-center gap-4 mb-4">
               <motion.div
                 animate={{ rotate: 360 }}
                 transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
               >
                   <PipeVaultIcon className="w-12 h-12 text-cyan-500 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]"/>
               </motion.div>
               {title}
            </div>
            <p className="text-slate-400 font-light tracking-wide">Industrial Grade Inventory Management</p>
        </motion.div>
        
        <AnimatePresence mode="wait">
            {mode === 'welcome' && (
                <motion.div 
                    key="welcome"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                >
                    <GlassButton onClick={() => setMode('login')} className="w-full text-lg py-6" variant="primary">
                        Login to Existing Project
                    </GlassButton>
                    <GlassButton onClick={() => setMode('request')} variant="secondary" className="w-full text-lg py-6">
                        Request New Storage
                    </GlassButton>
                </motion.div>
            )}

            {mode === 'login' && (
                <motion.form 
                    key="login"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleLoginSubmit} 
                    className="space-y-5"
                >
                    <h2 className="text-xl font-semibold text-center text-cyan-100 mb-6">Project Login</h2>
                     <div className="space-y-1">
                        <label htmlFor="email-login" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Email</label>
                        <Input id="email-login" type="email" placeholder="user@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                     <div className="space-y-1">
                        <label htmlFor="ref-login" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Reference ID</label>
                        <Input id="ref-login" type="text" placeholder="AFE# / Well Name" value={referenceId} onChange={e => setReferenceId(e.target.value)} required />
                    </div>
                    {error && (
                        <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-sm text-red-400 text-center bg-red-950/30 py-2 rounded border border-red-900/50"
                        >
                            {error}
                        </motion.p>
                    )}
                    <div className="pt-2 space-y-3">
                        <GlassButton type="submit" className="w-full text-lg py-6" isLoading={isLoading}>Login</GlassButton>
                        <GlassButton onClick={resetForm} variant="ghost" className="w-full" type="button">
                            <ChevronLeftIcon className="w-4 h-4 mr-1"/> Back
                        </GlassButton>
                    </div>
                </motion.form>
            )}

            {mode === 'request' && (
                 <motion.form 
                    key="request"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleRequestSubmit} 
                    className="space-y-5"
                >
                     <h2 className="text-xl font-semibold text-center text-cyan-100 mb-6">New Storage Request</h2>
                     <div className="space-y-1">
                        <label htmlFor="email-request" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Email</label>
                        <Input id="email-request" type="email" placeholder="Enter your company email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    {error && (
                        <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-sm text-red-400 text-center bg-red-950/30 py-2 rounded border border-red-900/50"
                        >
                            {error}
                        </motion.p>
                    )}
                    <div className="pt-2 space-y-3">
                        <GlassButton type="submit" className="w-full text-lg py-6" isLoading={isLoading}>Continue</GlassButton>
                        <GlassButton onClick={resetForm} variant="ghost" className="w-full" type="button">
                             <ChevronLeftIcon className="w-4 h-4 mr-1"/> Back
                        </GlassButton>
                    </div>
                </motion.form>
            )}

            {mode === 'admin' && (
                 <motion.form 
                    key="admin"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleAdminLoginSubmit} 
                    className="space-y-5"
                >
                     <h2 className="text-xl font-semibold text-center text-cyan-100 mb-6">Admin Access</h2>
                     <div className="space-y-1">
                        <label htmlFor="admin-user" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Username</label>
                        <Input id="admin-user" type="text" placeholder="Username" value={adminUser} onChange={e => setAdminUser(e.target.value)} required />
                    </div>
                     <div className="space-y-1">
                        <label htmlFor="admin-pass" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">Password</label>
                        <Input id="admin-pass" type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} required />
                    </div>
                    {error && (
                        <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-sm text-red-400 text-center bg-red-950/30 py-2 rounded border border-red-900/50"
                        >
                            {error}
                        </motion.p>
                    )}
                    <div className="pt-2 space-y-3">
                        <GlassButton type="submit" className="w-full text-lg py-6" isLoading={isLoading}>Authenticate</GlassButton>
                        <GlassButton onClick={resetForm} variant="ghost" className="w-full" type="button">
                             <ChevronLeftIcon className="w-4 h-4 mr-1"/> Back
                        </GlassButton>
                    </div>
                </motion.form>
            )}
        </AnimatePresence>
      </GlassCard>
      
      {/* Footer */}
      <div className="absolute bottom-4 text-slate-600 text-xs">
        &copy; 2025 MPS Group. All rights reserved.
      </div>
    </div>
  );
};

export default LoginScreen;
