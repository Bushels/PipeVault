import React from 'react';
import { PlusIcon } from './icons/Icons';
import type { StorageRequest } from '../types';
import GlassButton from './ui/GlassButton';
import RequestSummaryPanel from './RequestSummaryPanel';
import FloatingRoughneckChat from './FloatingRoughneckChat';

interface StorageRequestMenuProps {
  companyName: string;
  hasActiveRequest: boolean;
  requests: StorageRequest[];
  companyRequests?: StorageRequest[];
  currentUserEmail?: string;
  onSelectOption: (option: 'new-storage' | 'inbound-shipment') => void;
  onArchiveRequest: (request: StorageRequest, shouldArchive: boolean) => void | Promise<void>;
  archivingRequestId: string | null;
  onScheduleDelivery: (request: StorageRequest) => void;
  onUploadDocuments: (request: StorageRequest) => void;
  pendingSubmission: StorageRequest | null;
  onOpenChat: (request: StorageRequest) => void;
  onClearPendingSubmission?: () => void;
}

const StorageRequestMenu: React.FC<StorageRequestMenuProps> = ({
  companyName,
  hasActiveRequest,
  requests,
  companyRequests,
  currentUserEmail,
  onSelectOption,
  onArchiveRequest,
  archivingRequestId,
  onScheduleDelivery,
  onUploadDocuments,
  pendingSubmission,
  onOpenChat,
  onClearPendingSubmission,
}) => {
  const chatRequests = companyRequests ?? requests;

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
        {/* Header with Request Storage Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Your Storage Requests</h2>
            <p className="text-slate-400 mt-1">
              {requests.length === 0
                ? "Get started with your first pipe storage request"
                : `Managing ${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`
              }
            </p>
          </div>
          <GlassButton
            onClick={() => onSelectOption('new-storage')}
            variant="primary"
            size="lg"
            className="group relative flex items-center gap-3 px-8 py-4 font-bold rounded-xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" />
            <PlusIcon className="h-6 w-6 relative z-10 transition-transform duration-300 group-hover:rotate-90" />
            <span className="relative z-10 text-lg tracking-wide">Request Storage</span>
          </GlassButton>
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
          onUploadDocuments={onUploadDocuments}
          pendingSubmission={pendingSubmission}
          onClearPendingSubmission={onClearPendingSubmission}
        />
      </div>

      {/* Floating Roughneck Chat Button */}
      <FloatingRoughneckChat
        requests={chatRequests}
        onOpenChat={onOpenChat}
      />
    </>
  );
};

export default StorageRequestMenu;
