/**
 * Authentication Component - Customers must sign in or create an account before continuing
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
      if (customerMode === 'login') {
        await signInWithEmail(email, password);
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

      await signUpWithEmail(email, password, {
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactNumber: contactNumber.trim(),
      });

      try {
        await signInWithEmail(email, password);
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
      await signInWithEmail(adminEmail, adminPassword);
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
      await signUpWithEmail(adminEmail, adminPassword);
      await signInWithEmail(adminEmail, adminPassword);
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
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                  type="button"
                  onClick={handleLogoClick}
                  className="focus:outline-none"
              >
                <PipeVaultIcon className="w-14 h-14 text-red-500 hover:text-red-400 transition-colors" />
              </button>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-white tracking-tight">PipeVault</h1>
                <p className="text-sm text-gray-400">Secure access for customers and admins</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Click the logo to switch between customer and admin login.
            </p>
          </div>

          {showAdminLogin ? (
            <>
              <h2 className="text-lg font-semibold text-white mb-4">Admin Access</h2>
              <form onSubmit={handleAdminSignIn} className="space-y-4">
                <div>
                  <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-300 mb-2">
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
                  <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-300 mb-2">
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
                  <div className="p-3 bg-red-900/50 border border-red-700 rounded-md">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}
                {info && (
                  <div className="p-3 bg-blue-900/40 border border-blue-700 rounded-md">
                    <p className="text-sm text-blue-200">{info}</p>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full py-3 bg-red-600 hover:bg-red-700">
                  {loading ? 'Signing in...' : 'Sign In'}
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
                  First time? Create an admin account with your email above.
                </p>
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleLogoClick}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  &lt; Back to Customer Access
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">
                  {customerMode === 'login' ? 'Sign In to PipeVault' : 'Create a PipeVault Account'}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetMessages();
                      setCustomerMode('login');
                    }}
                    className={`text-xs px-3 py-1 rounded ${
                      customerMode === 'login' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'
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
                    className={`text-xs px-3 py-1 rounded ${
                      customerMode === 'signup' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <div>
                  <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-300 mb-2">
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
                  <label htmlFor="customerPassword" className="block text-sm font-medium text-gray-300 mb-2">
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
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
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
                )}

                {customerMode === 'signup' && (
                  <>
                    <div>
                      <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-2">
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
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">
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
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
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
                      <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-300 mb-2">
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
                  </>
                )}

                {error && (
                  <div className="p-3 bg-red-900/50 border border-red-700 rounded-md">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}
                {info && (
                  <div className="p-3 bg-blue-900/40 border border-blue-700 rounded-md">
                    <p className="text-sm text-blue-200">{info}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {customerMode === 'login' ? 'Signing in...' : 'Creating account...'}
                    </div>
                  ) : customerMode === 'login' ? (
                    'Sign In'
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>

              <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-md">
                <h3 className="text-sm font-semibold text-white mb-2">Why create an account?</h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>- Save and track your storage requests</li>
                  <li>- Schedule deliveries once approved</li>
                  <li>- Chat with the AI assistant about your inventory</li>
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
