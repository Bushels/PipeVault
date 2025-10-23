import React, { useState } from 'react';
import type { Company, AppSession, StorageRequest } from '../types';
import { PipeVaultIcon, ChevronLeftIcon } from './icons/Icons';
import Button from './ui/Button';

interface LoginScreenProps {
  companies: Company[];
  requests: StorageRequest[];
  onLogin: (session: AppSession) => void;
  addCompany: (company: Omit<Company, 'id'>) => Company;
}

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`w-full bg-gray-800/60 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-red-500 ${props.className || ''}`} />
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
  
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const company = findCompanyByEmail(email, companies);
    if (!company) {
        setError('No company found for this email address.');
        return;
    }
    const request = requests.find(r => r.userId.toLowerCase() === email.toLowerCase() && r.referenceId.toLowerCase() === referenceId.toLowerCase());
    if (!request) {
        setError('Invalid email or Reference ID.');
        return;
    }
    onLogin({ company, userId: email, referenceId });
  };

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (adminUser === 'Admin' && adminPass === 'Admin') {
        onLogin({ isAdmin: true, username: 'Admin' });
    } else {
        setError('Invalid admin credentials.');
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@')) {
        setError('Please enter a valid email address.');
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
    <h1 className="text-5xl font-bold text-white tracking-tight">
        PipeV<span className="cursor-pointer" onClick={() => setMode('admin')}>a</span>ult
    </h1>
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-900 bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1588239333339-10db68428ade?q=80&w=2531&auto=format&fit=crop')"}}>
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
      <div className="relative w-full max-w-md bg-gray-900/70 border border-gray-700 rounded-2xl shadow-2xl p-8 space-y-8 backdrop-blur-xl">
        <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
               <PipeVaultIcon className="w-12 h-12 text-red-500"/>
               {title}
            </div>
            <p className="text-gray-400">Your secure portal for pipe inventory management.</p>
        </div>
        
        {mode === 'welcome' && (
            <div className="space-y-4">
                <Button onClick={() => setMode('login')} className="w-full text-lg py-3 bg-red-600 hover:bg-red-700 focus:ring-red-500">
                    Login to Existing Project
                </Button>
                <Button onClick={() => setMode('request')} variant="secondary" className="w-full text-lg py-3">
                    Request New Storage
                </Button>
            </div>
        )}

        {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
                <h2 className="text-xl font-semibold text-center text-white">Project Login</h2>
                 <div>
                    <label htmlFor="email-login" className="sr-only">Email</label>
                    <Input id="email-login" type="email" placeholder="UserID / Email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                 <div>
                    <label htmlFor="ref-login" className="sr-only">Reference ID</label>
                    <Input id="ref-login" type="text" placeholder="Reference ID (e.g., AFE#, Well Name)" value={referenceId} onChange={e => setReferenceId(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-yellow-400 text-center">{error}</p>}
                <Button type="submit" className="w-full text-lg py-3 bg-red-600 hover:bg-red-700 focus:ring-red-500">Login</Button>
                <Button onClick={resetForm} variant="secondary" className="w-full">
                    <ChevronLeftIcon className="w-5 h-5"/> Back
                </Button>
            </form>
        )}

        {mode === 'request' && (
             <form onSubmit={handleRequestSubmit} className="space-y-4">
                 <h2 className="text-xl font-semibold text-center text-white">New Storage Request</h2>
                 <div>
                    <label htmlFor="email-request" className="sr-only">Email</label>
                    <Input id="email-request" type="email" placeholder="Enter your company email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-yellow-400 text-center">{error}</p>}
                <Button type="submit" className="w-full text-lg py-3">Continue</Button>
                <Button onClick={resetForm} variant="secondary" className="w-full">
                     <ChevronLeftIcon className="w-5 h-5"/> Back
                </Button>
            </form>
        )}

        {mode === 'admin' && (
             <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                 <h2 className="text-xl font-semibold text-center text-white">Admin Login</h2>
                 <div>
                    <label htmlFor="admin-user" className="sr-only">Username</label>
                    <Input id="admin-user" type="text" placeholder="Username" value={adminUser} onChange={e => setAdminUser(e.target.value)} required />
                </div>
                 <div>
                    <label htmlFor="admin-pass" className="sr-only">Password</label>
                    <Input id="admin-pass" type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-yellow-400 text-center">{error}</p>}
                <Button type="submit" className="w-full text-lg py-3">Login</Button>
                <Button onClick={resetForm} variant="secondary" className="w-full">
                     <ChevronLeftIcon className="w-5 h-5"/> Back
                </Button>
            </form>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
