import React from 'react';
import type { LoadSummary } from '../services/manifestProcessingService';

interface LoadSummaryReviewProps {
  loadSummary: LoadSummary | null;
  isProcessing: boolean;
  hasDocuments: boolean;
}

const LoadSummaryReview: React.FC<LoadSummaryReviewProps> = ({
  loadSummary,
  isProcessing,
  hasDocuments,
}) => {
  // No documents uploaded yet
  if (!hasDocuments) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm">
          Upload your manifest in the previous step to see load summary
        </p>
      </div>
    );
  }

  // AI is processing documents
  if (isProcessing) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-red-600 rounded-full opacity-20 animate-ping" />
            <div className="relative w-20 h-20 bg-gradient-to-r from-purple-600 to-red-600 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">AI Processing Your Manifest</h3>
          <p className="text-sm text-gray-400 mb-4 max-w-md">
            Our AI is extracting pipe details, calculating totals, and verifying data accuracy. This usually takes 5-10 seconds.
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-purple-500" />
            <span>Extracting joints, lengths, and weights...</span>
          </div>
        </div>
      </div>
    );
  }

  // AI extraction failed or no summary available
  if (!loadSummary) {
    return (
      <div className="bg-red-500/10 border border-red-400/40 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-200 mb-1">Unable to Extract Load Details</p>
            <p className="text-xs text-red-300">
              Our AI couldn't process your manifest. This might happen if the document quality is poor or the format is unusual.
              Don't worry - MPS admin will manually review and enter the details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success - show load summary
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Load Summary
          </h3>
          <span className="px-3 py-1 bg-green-600/20 border border-green-500/50 text-green-300 text-xs font-medium rounded-full">
            AI Extracted
          </span>
        </div>

        {/* AI Extraction Status */}
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-300">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>
            AI extracted <strong className="text-white">{loadSummary.total_joints}</strong> joints from your manifest
          </span>
        </div>

        {/* Load Totals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Joints */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Joints</p>
            </div>
            <p className="text-3xl font-bold text-white">{loadSummary.total_joints}</p>
          </div>

          {/* Total Length */}
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Length</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {loadSummary.total_length_ft.toLocaleString()}
              <span className="text-lg text-gray-400 ml-1">ft</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              ({loadSummary.total_length_m.toLocaleString()} m)
            </p>
          </div>

          {/* Total Weight */}
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Weight</p>
            </div>
            <p className="text-3xl font-bold text-white">
              {loadSummary.total_weight_lbs.toLocaleString()}
              <span className="text-lg text-gray-400 ml-1">lbs</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              ({loadSummary.total_weight_kg.toLocaleString()} kg)
            </p>
          </div>
        </div>
      </div>

      {/* Admin Review Note */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="text-xs text-gray-400 space-y-2">
            <p>
              <strong className="text-white">Admin Verification:</strong> MPS admin will review and verify all details
              before your delivery is scheduled. If you notice any issues, you can add notes in the confirmation step.
            </p>
            <p className="text-gray-500">
              This ensures accuracy and prevents delays during unloading at our facility.
            </p>
          </div>
        </div>
      </div>

      {/* Data Accuracy Info */}
      <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-gray-400">
            <p className="text-white font-medium mb-1">How accurate is AI extraction?</p>
            <p>
              Our AI achieves {'>'} 95% accuracy on clear manifests. All data is double-checked by MPS admin before
              your delivery is finalized. You can add notes or corrections in the next step if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadSummaryReview;
