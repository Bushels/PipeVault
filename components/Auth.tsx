/**
 * Authentication Component - Customers must sign in or create an account before continuing
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';
import GlassCard from './ui/GlassCard';
import GlassButton from './ui/GlassButton';
import { PipeVaultIcon, ChevronLeftIcon } from './icons/Icons';

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full glass-input rounded-lg py-3 px-4 ${props.className || ''}`}
  />
);

const Auth: React.FC = () => {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [customerMode, setCustomerMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const resetMessages = () => {
    setError('');
    setInfo('');
  };

  const handleLogoClick = () => {
    setShowAdminLogin((prev) => !prev);
    resetMessages();
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (customerMode === 'login') {
        await signInWithEmail(normalizedEmail, password);
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      if (!companyName.trim() || !firstName.trim() || !lastName.trim() || !contactNumber.trim()) {
        setError('Please fill in all required fields.');
        return;
      }

      await signUpWithEmail(normalizedEmail, password, {
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactNumber: contactNumber.trim(),
      });

      try {
        await signInWithEmail(normalizedEmail, password);
      } catch (signInError: any) {
        const message = signInError?.message || '';
        if (message.toLowerCase().includes('email not confirmed')) {
          setInfo('Please check your inbox to confirm your email. You can sign in once your address is verified.');
          setCustomerMode('login');
        } else {
          throw signInError;
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const normalizedEmail = adminEmail.trim().toLowerCase();
      await signInWithEmail(normalizedEmail, adminPassword);
    } catch (err: any) {
      const message = err?.message || '';
      if (message.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid admin credentials. Make sure your account exists or create one below.');
      } else {
        setError(message || 'An error occurred during admin sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdminAccount = async () => {
    resetMessages();

    if (!adminEmail || !adminPassword) {
      setError('Please enter email and password first.');
      return;
    }

    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = adminEmail.trim().toLowerCase();
      await signUpWithEmail(normalizedEmail, adminPassword);
      await signInWithEmail(normalizedEmail, adminPassword);
    } catch (err: any) {
      const message = err?.message || '';
      if (message.toLowerCase().includes('already registered')) {
        setError('Account already exists. Try signing in with your password.');
      } else {
        setError(message || 'Error creating admin account.');
      }
    } finally {
      setLoading(false);
    }
  };

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
               <motion.button
                 type="button"
                 onClick={handleLogoClick}
                 className="focus:outline-none"
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
               >
                   <PipeVaultIcon className="w-14 h-14 text-cyan-500 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] hover:text-cyan-400 transition-colors"/>
               </motion.button>
               <div className="text-left">
                 <h1 className="text-3xl font-bold text-slate-100 tracking-tight drop-shadow-lg">PipeVault</h1>
                 <p className="text-sm text-slate-400">Secure access for customers and admins</p>
               </div>
            </div>
            <p className="text-xs text-slate-500">
              Click the logo to switch between customer and admin login.
            </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {showAdminLogin ? (
            <motion.div
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
            >
              <h2 className="text-lg font-semibold text-cyan-100 mb-4">Admin Access</h2>
              <form onSubmit={handleAdminSignIn} className="space-y-4">
                <div>
                  <label htmlFor="adminEmail" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                    Admin Email
                  </label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@yourdomain.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="adminPassword" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                    Password
                  </label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Enter your password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-red-950/30 border border-red-900/50 rounded-md"
                  >
                    <p className="text-sm text-red-400">{error}</p>
                  </motion.div>
                )}
                {info && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-md"
                  >
                    <p className="text-sm text-blue-400">{info}</p>
                  </motion.div>
                )}

                <GlassButton type="submit" disabled={loading} className="w-full py-3" isLoading={loading} variant="primary">
                  Sign In
                </GlassButton>
              </form>

              <div className="mt-4">
                <GlassButton
                  type="button"
                  onClick={handleCreateAdminAccount}
                  disabled={loading}
                  className="w-full py-2 text-sm"
                  variant="secondary"
                >
                  Create Admin Account
                </GlassButton>
                <p className="text-xs text-slate-500 text-center mt-2">
                  First time? Create an admin account with your email above.
                </p>
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleLogoClick}
                  className="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center w-full"
                >
                  <ChevronLeftIcon className="w-4 h-4 mr-1"/> Back to Customer Access
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
                key="customer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-cyan-100">
                  {customerMode === 'login' ? 'Sign In to PipeVault' : 'Create a PipeVault Account'}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setCustomerMode('login');
                    }}
                    className={`text-xs px-3 py-1 rounded transition-colors ${
                      customerMode === 'login' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setCustomerMode('signup');
                    }}
                    className={`text-xs px-3 py-1 rounded transition-colors ${
                      customerMode === 'signup' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <div>
                  <label htmlFor="customerEmail" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                    Email Address
                  </label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="your.email@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="customerPassword" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                    Password
                  </label>
                  <Input
                    id="customerPassword"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {customerMode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4"
                  >
                    <div>
                      <label htmlFor="confirmPassword" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                        Confirm Password
                      </label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label htmlFor="companyName" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                        Company Name
                      </label>
                      <Input
                        id="companyName"
                        type="text"
                        placeholder="Your company or organization"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="firstName" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                          First Name
                        </label>
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="First name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                          Last Name
                        </label>
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Last name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contactNumber" className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-1">
                        Contact Number
                      </label>
                      <Input
                        id="contactNumber"
                        type="tel"
                        placeholder="Best number to reach you"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </motion.div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-red-950/30 border border-red-900/50 rounded-md"
                  >
                    <p className="text-sm text-red-400">{error}</p>
                  </motion.div>
                )}
                {info && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-md"
                  >
                    <p className="text-sm text-blue-400">{info}</p>
                  </motion.div>
                )}

                <GlassButton
                  type="submit"
                  disabled={loading}
                  className="w-full py-3"
                  variant="primary"
                  isLoading={loading}
                >
                  {customerMode === 'login' ? 'Sign In' : 'Create Account'}
                </GlassButton>
              </form>

              <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700/50 rounded-md">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">Why create an account?</h3>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>- Save and track your storage requests</li>
                  <li>- Schedule deliveries once approved</li>
                  <li>- Chat with the AI assistant about your inventory</li>
                </ul>
              </div>
            </motion.div>
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

export default Auth;
