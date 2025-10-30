/**
 * Authentication Component - Sign in with Email + Project Reference ID
 * Reference ID acts as password for simplified authentication
 */

import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Card from './ui/Card';
import Button from './ui/Button';
import { PipeVaultIcon } from './icons/Icons';

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full bg-gray-800/60 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-red-500 ${props.className || ''}`}
  />
);

interface AuthProps {
  onGuestAccess?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onGuestAccess }) => {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use reference ID as password
      await signInWithEmail(email, referenceId);
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid email or Reference ID. Please check and try again.');
      } else {
        setError(err.message || 'An error occurred during sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    if (onGuestAccess) {
      onGuestAccess();
    }
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmail(adminEmail, adminPassword);
    } catch (err: any) {
      if (err.message?.includes('Invalid login credentials')) {
        setError('Invalid admin credentials. Make sure your account exists or create one below.');
      } else {
        setError(err.message || 'An error occurred during admin sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdminAccount = async () => {
    if (!adminEmail || !adminPassword) {
      setError('Please enter email and password first');
      return;
    }

    if (adminPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Create the account
      await signUpWithEmail(adminEmail, adminPassword);
      // Try to sign in
      await signInWithEmail(adminEmail, adminPassword);
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        setError('Account already exists. Try signing in with your password.');
      } else {
        setError(err.message || 'Error creating admin account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoClick = () => {
    setShowAdminLogin(!showAdminLogin);
    setError('');
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4 bg-gray-900 bg-cover bg-center"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1588239333339-10db68428ade?q=80&w=2531&auto=format&fit=crop')",
      }}
    >
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>

      <div className="relative w-full max-w-md">
        <Card className="p-8 bg-gray-900/70 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                type="button"
                onClick={handleLogoClick}
                className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg p-1"
                title="Admin Login"
              >
                <PipeVaultIcon className="w-12 h-12 text-red-500" />
              </button>
              <h1 className="text-5xl font-bold text-white tracking-tight">PipeVault</h1>
            </div>
            <p className="text-gray-400">
              {showAdminLogin ? 'Admin Login' : 'Sign in to your account'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              FREE Pipe Storage - Celebrating 20 Years of MPS!
            </p>
          </div>

          {showAdminLogin ? (
            /* Admin Login Form */
            <>
              <form onSubmit={handleAdminSignIn} className="space-y-4">
                <div>
                  <label htmlFor="admin-email" className="block text-sm font-medium text-gray-300 mb-2">
                    Admin Email
                  </label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@mpsgroup.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="admin-password" className="block text-sm font-medium text-gray-300 mb-2">
                    Admin Password
                  </label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-900/50 border border-red-700 rounded-md">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Signing in...
                    </div>
                  ) : (
                    'Sign In as Admin'
                  )}
                </Button>
              </form>

              <div className="mt-4">
                <Button
                  type="button"
                  onClick={handleCreateAdminAccount}
                  disabled={loading}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  Create Admin Account
                </Button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  First time? Create an admin account with your email above
                </p>
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleLogoClick}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  ← Back to User Login
                </button>
              </div>
            </>
          ) : (
            /* Regular User Login Form */
            <>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="referenceId" className="block text-sm font-medium text-gray-300 mb-2">
                    Project Reference ID
                  </label>
                  <Input
                    id="referenceId"
                    type="text"
                    placeholder="e.g., EAGLE-2024-001"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-yellow-400 mt-2">
                    💡 Your Project Reference ID acts as your password
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-900/50 border border-red-700 rounded-md">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Signing in...
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900/70 text-gray-400">New to PipeVault?</span>
                </div>
              </div>

              {/* Guest Access / New Storage Request */}
              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={handleGuestAccess}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600"
                >
                  Create New Storage Request
                </Button>
                <p className="text-xs text-center text-gray-500">
                  Submit a new storage request and receive your Project Reference ID
                </p>
              </div>

              {/* Help Text */}
              <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-md">
                <h3 className="text-sm font-semibold text-white mb-2">
                  How does authentication work?
                </h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• New users: Click "Create New Storage Request" above</li>
                  <li>• Existing users: Sign in with your email + Reference ID</li>
                  <li>• Your Reference ID is provided when you submit a storage request</li>
                  <li>• Keep your Reference ID safe - it's your account password!</li>
                </ul>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;
