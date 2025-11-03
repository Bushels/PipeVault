/**
 * Storage Request Menu - Customer dashboard menu inside authenticated session
 * Features horizontal scrolling request cards and floating Roughneck chat
 */

import React from 'react';
import { PlusIcon } from './icons/Icons';
import type { StorageRequest } from '../types';
import RequestSummaryPanel from './RequestSummaryPanel';
import FloatingRoughneckChat from './FloatingRoughneckChat';

interface StorageRequestMenuProps {
  companyName: string;
  hasActiveRequest: boolean;
  requests: StorageRequest[];
  currentUserEmail?: string;
  onSelectOption: (option: 'new-storage' | 'delivery-in' | 'delivery-out' | 'chat') => void;
  onArchiveRequest?: (request: StorageRequest, shouldArchive: boolean) => void | Promise<void>;
  archivingRequestId?: string | null;
  onScheduleDelivery?: (request: StorageRequest) => void;
}

const StorageRequestMenu: React.FC<StorageRequestMenuProps> = ({
  companyName,
  hasActiveRequest,
  requests,
  currentUserEmail,
  onSelectOption,
  onArchiveRequest,
  archivingRequestId,
  onScheduleDelivery,
}) => {
  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Request Storage Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white">Your Storage Requests</h2>
            <p className="text-sm text-gray-400 mt-1">
              {requests.length === 0
                ? "Get started with your first pipe storage request"
                : `Managing ${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`
              }
            </p>
          </div>
          <button
            onClick={() => onSelectOption('new-storage')}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <PlusIcon className="h-5 w-5" />
            Request Storage
          </button>
        </div>

        {/* Request Cards - Full Width Horizontal Scroll */}
        <RequestSummaryPanel
          heading={requests.length > 0 ? "" : ""}
          description=""
          requests={requests}
          currentUserEmail={currentUserEmail}
          onArchiveRequest={onArchiveRequest}
          archivingRequestId={archivingRequestId}
          onScheduleDelivery={onScheduleDelivery}
        />
      </div>

      {/* Floating Roughneck Chat Button */}
      <FloatingRoughneckChat
        requests={requests}
        onOpenChat={() => onSelectOption('chat')}
      />
    </>
  );
};

export default StorageRequestMenu;


