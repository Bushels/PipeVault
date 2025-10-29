/**
 * Authentication Component with Email and OAuth Sign-in
 * Supports Google, Apple, and Microsoft authentication
 */

import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { PipeVaultIcon } from './icons/Icons';

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full bg-gray-800/60 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-red-500 ${props.className || ''}`}
  />
);

const Auth: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
        setMessage('Check your email for confirmation link!');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple' | 'azure') => {
    setError('');
    setLoading(true);

    try {
      await signInWithOAuth(provider);
      // OAuth redirects, so no need to set loading false
    } catch (err: any) {
      setError(err.message || 'An error occurred');
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
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <PipeVaultIcon className="w-12 h-12 text-red-500" />
              <h1 className="text-5xl font-bold text-white tracking-tight">PipeVault</h1>
            </div>
            <p className="text-gray-400">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              FREE Pipe Storage - Celebrating 20 Years of MPS!
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 py-3 px-4 rounded-md font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuthSignIn('apple')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-black text-white py-3 px-4 rounded-md font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button>

            <button
              onClick={() => handleOAuthSignIn('azure')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-[#2F2F2F] text-white py-3 px-4 rounded-md font-medium hover:bg-[#3F3F3F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#f25022" d="M0 0h11.5v11.5H0z" />
                <path fill="#00a4ef" d="M12.5 0H24v11.5H12.5z" />
                <path fill="#7fba00" d="M0 12.5h11.5V24H0z" />
                <path fill="#ffb900" d="M12.5 12.5H24V24H12.5z" />
              </svg>
              Continue with Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>

            {error && (
              <div className="p-3 bg-red-900/50 border border-red-700 rounded-md">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {message && (
              <div className="p-3 bg-green-900/50 border border-green-700 rounded-md">
                <p className="text-sm text-green-200">{message}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <Spinner className="w-5 h-5" />
              ) : mode === 'signin' ? (
                'Sign In'
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>

          {/* Toggle Sign In/Sign Up */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
                setMessage('');
              }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-red-500 font-medium">
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </span>
            </button>
          </div>

          {/* Guest Access */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Just browsing?{' '}
              <a href="/" className="text-red-500 hover:text-red-400">
                Continue as guest
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
