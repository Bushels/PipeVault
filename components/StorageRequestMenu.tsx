/**
 * Storage Request Menu - Initial selection screen
 * Users choose what they want to do before starting AI conversation
 */

import React from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { PlusIcon, ClipboardIcon, PackageIcon, TruckIcon } from './icons/Icons';

interface StorageRequestMenuProps {
  companyName: string;
  hasActiveRequest: boolean;
  onSelectOption: (option: 'new-storage' | 'delivery-in' | 'delivery-out' | 'inquire') => void;
}

const StorageRequestMenu: React.FC<StorageRequestMenuProps> = ({
  companyName,
  hasActiveRequest,
  onSelectOption,
}) => {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Request New Pipe Storage - FREE 20 Year Promo */}
          <button
            onClick={() => onSelectOption('new-storage')}
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
            onClick={() => onSelectOption('delivery-in')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-cyan-700 p-6 text-left transition-all hover:scale-105 hover:shadow-xl"
            disabled={!hasActiveRequest}
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <TruckIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Schedule Delivery to MPS</h3>
              <p className="text-sm text-blue-100">
                {hasActiveRequest
                  ? 'Arrange pipe delivery to our storage facility'
                  : 'Available after approval'}
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>

          {/* 3. Schedule Delivery to Worksite */}
          <button
            onClick={() => onSelectOption('delivery-out')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-left transition-all hover:scale-105 hover:shadow-xl"
            disabled={!hasActiveRequest}
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <PackageIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Schedule Delivery to Worksite</h3>
              <p className="text-sm text-green-100">
                {hasActiveRequest
                  ? 'Arrange pickup and delivery to your well site'
                  : 'Available after approval'}
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>

          {/* 4. Inquire - Status, Inventory, Modifications */}
          <button
            onClick={() => onSelectOption('inquire')}
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
            Click <span className="font-semibold text-indigo-400">"Request New Pipe Storage"</span> to get started.
            Our AI assistant will guide you through the approval process step-by-step.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default StorageRequestMenu;
