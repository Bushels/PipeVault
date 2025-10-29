/**
 * Welcome Screen - Landing page with 4 option cards
 * This is the first thing users see when they visit PipeVault
 */

import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { PlusIcon, ClipboardIcon, PackageIcon, TruckIcon, PipeVaultIcon } from './icons/Icons';
import StorageRequestWizard from './StorageRequestWizard';
import FormHelperChatbot from './FormHelperChatbot';
import type { StorageRequest, Company } from '../types';

interface WelcomeScreenProps {
  companies: Company[];
  requests: StorageRequest[];
  addCompany: (company: Omit<Company, 'id'>) => Promise<Company>;
  addRequest: (request: Omit<StorageRequest, 'id'>) => Promise<StorageRequest>;
}

type SelectedOption = 'menu' | 'new-storage' | 'delivery-in' | 'delivery-out' | 'inquire';

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 ${props.className || ''}`}
  />
);

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  companies,
  requests,
  addCompany,
  addRequest,
}) => {
  const [selectedOption, setSelectedOption] = useState<SelectedOption>('menu');
  const [referenceId, setReferenceId] = useState('');
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    // Find company by email domain
    const domain = email.split('@')[1];
    const company = companies.find((c) => c.domain.toLowerCase() === domain?.toLowerCase());

    if (!company) {
      setAuthError('No company found for this email domain.');
      return;
    }

    // Find request by reference ID and email
    const request = requests.find(
      (r) =>
        r.referenceId.toLowerCase() === referenceId.toLowerCase() &&
        r.userId.toLowerCase() === email.toLowerCase()
    );

    if (!request) {
      setAuthError('Invalid email or Reference ID.');
      return;
    }

    // TODO: Set session and navigate to appropriate flow
    alert(`Authentication successful! Feature coming soon for: ${selectedOption}`);
  };

  const renderMenu = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <PipeVaultIcon className="w-16 h-16 text-red-500" />
          <h1 className="text-5xl font-bold text-white tracking-tight">PipeVault</h1>
        </div>
        <p className="text-gray-400 text-lg">FREE Pipe Storage - Celebrating 20 Years of MPS!</p>
      </div>

      <Card className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Request New Pipe Storage */}
          <button
            onClick={() => setSelectedOption('new-storage')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-left transition-all hover:scale-105 hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <PlusIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Request New Pipe Storage</h3>
              <p className="text-sm text-indigo-100">
                Get approved for FREE storage - 20 Year Anniversary Promo! 🎉
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>

          {/* 2. Schedule Delivery to MPS */}
          <button
            onClick={() => setSelectedOption('delivery-in')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-cyan-700 p-6 text-left transition-all hover:scale-105 hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <TruckIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Schedule Delivery to MPS</h3>
              <p className="text-sm text-blue-100">Arrange pipe delivery to our storage facility</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>

          {/* 3. Schedule Delivery to Worksite */}
          <button
            onClick={() => setSelectedOption('delivery-out')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-left transition-all hover:scale-105 hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <PackageIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Schedule Delivery to Worksite</h3>
              <p className="text-sm text-green-100">
                Arrange pickup and delivery to your well site
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>

          {/* 4. Inquire */}
          <button
            onClick={() => setSelectedOption('inquire')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-600 to-red-700 p-6 text-left transition-all hover:scale-105 hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <ClipboardIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Inquire</h3>
              <p className="text-sm text-orange-100">
                Check status, inventory, or request modifications
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>

        <div className="mt-8 rounded-lg bg-gray-800 p-4 border border-gray-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">💡 New to PipeVault?</h4>
          <p className="text-sm text-gray-400">
            Click <span className="font-semibold text-indigo-400">"Request New Pipe Storage"</span>{' '}
            to get started. Fill out the form to submit your project for approval.
          </p>
        </div>
      </Card>
    </div>
  );

  const renderNewStorageFlow = () => {
    // Create a temporary session for the form
    const tempSession = {
      company: { id: 'temp', name: '', domain: '' },
      userId: '',
    };

    return (
      <div className="max-w-7xl mx-auto">
        <Button
          onClick={() => setSelectedOption('menu')}
          className="mb-4 bg-gray-700 hover:bg-gray-600"
        >
          ← Back to Menu
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <StorageRequestWizard
              request={null}
              session={tempSession}
              updateRequest={() => {}}
              addRequest={async (newRequest) => {
                // Create company if needed
                const emailDomain = newRequest.userId.split('@')[1];
                let company = companies.find((c) => c.domain === emailDomain);

                if (!company) {
                  company = await addCompany({
                    name: newRequest.requestDetails?.companyName || 'Unknown',
                    domain: emailDomain,
                  });
                }

                // Add request with company ID
                const request = await addRequest({
                  ...newRequest,
                  companyId: company.id,
                });

                // Show success message with reference ID
                alert(
                  `Request submitted successfully!\n\nYour Reference ID: ${request.referenceId}\n\nPlease save this ID - you'll need it to check status, schedule deliveries, and make inquiries.`
                );

                // Go back to menu
                setSelectedOption('menu');

                return request;
              }}
            />
          </div>
          <div className="lg:col-span-1">
            <FormHelperChatbot companyName="PipeVault" />
          </div>
        </div>
      </div>
    );
  };

  const renderAuthFlow = () => {
    const titles = {
      'delivery-in': 'Schedule Delivery to MPS',
      'delivery-out': 'Schedule Delivery to Worksite',
      inquire: 'Inquire About Your Storage',
    };

    return (
      <div className="max-w-md mx-auto">
        <Card className="p-8">
          <Button
            onClick={() => {
              setSelectedOption('menu');
              setEmail('');
              setReferenceId('');
              setAuthError('');
            }}
            className="mb-4 bg-gray-700 hover:bg-gray-600"
          >
            ← Back to Menu
          </Button>

          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {titles[selectedOption as keyof typeof titles]}
          </h2>
          <p className="text-gray-400 text-center mb-6">
            Please enter your email and reference ID to continue
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <Input
                id="auth-email"
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="auth-reference"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Reference ID
              </label>
              <Input
                id="auth-reference"
                type="text"
                placeholder="Your project reference ID"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                This was provided when you submitted your storage request
              </p>
            </div>

            {authError && <p className="text-sm text-red-400">{authError}</p>}

            <Button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-700">
              Continue
            </Button>
          </form>
        </Card>
      </div>
    );
  };

  const renderContent = () => {
    switch (selectedOption) {
      case 'new-storage':
        return renderNewStorageFlow();
      case 'delivery-in':
      case 'delivery-out':
      case 'inquire':
        return renderAuthFlow();
      case 'menu':
      default:
        return renderMenu();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">{renderContent()}</main>
    </div>
  );
};

export default WelcomeScreen;
