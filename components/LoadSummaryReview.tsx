import React, { useState } from 'react';
import type { LoadSummary } from '../services/manifestProcessingService';
import Button from './ui/Button';

interface LoadSummaryReviewProps {
  loadSummary: LoadSummary | null;
  isProcessing: boolean;
  hasDocuments: boolean;
  onVerify?: () => void;
  onReportIssue?: (issueDescription: string) => void;
  isConfirming?: boolean;
}

const LoadSummaryReview: React.FC<LoadSummaryReviewProps> = ({
  loadSummary,
  isProcessing,
  hasDocuments,
  onVerify,
  onReportIssue,
  isConfirming = false,
}) => {
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  const handleReportIssueClick = () => {
    setShowIssueModal(true);
    setIssueDescription('');
  };

  const handleSubmitIssue = async () => {
    if (!issueDescription.trim()) {
      return;
    }

    setIsSubmittingIssue(true);
    try {
      if (onReportIssue) {
        await onReportIssue(issueDescription);
      }
      setShowIssueModal(false);
      setIssueDescription('');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // No documents uploaded - allow booking without AI summary
  if (!hasDocuments) {
    return (
      <>
        <div className="space-y-6">
          {/* No Documents Info */}
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">No Manifest Uploaded</h3>
                <p className="text-sm text-gray-400 mt-1">
                  You can still proceed with your booking. MPS will verify load details manually when your driver arrives.
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation Section */}
          {onVerify && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ready to Confirm Booking?
              </h4>
              <p className="text-sm text-gray-400 mb-4">
                Your delivery slot is reserved. You can upload documents later from your dashboard, or your driver can bring them at delivery.
              </p>
              <Button
                onClick={onVerify}
                disabled={isConfirming}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConfirming ? (
                  <>
                    <svg className="w-5 h-5 inline mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Booking...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm Booking Without Documents
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs text-gray-400">
                <p className="text-white font-medium mb-1">What happens without documents?</p>
                <p>
                  MPS yard crew will manually count joints, measure lengths, and weigh the load upon arrival.
                  This process takes a bit longer, but ensures accurate inventory records. You can upload documents
                  anytime from your dashboard to help speed up the receiving process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // AI is processing documents
  if (isProcessing) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-2xl border-2 border-purple-500/30 shadow-2xl p-12 min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center max-w-2xl">
          {/* Animated Icon */}
          <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-red-600 rounded-full opacity-20 animate-ping" />
            <div className="absolute inset-4 bg-gradient-to-r from-purple-600 to-red-600 rounded-full opacity-10 animate-ping animation-delay-300" />
            <div className="relative w-32 h-32 bg-gradient-to-r from-purple-600 to-red-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/50">
              <svg className="w-16 h-16 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>

          {/* Main Heading */}
          <h3 className="text-3xl font-bold text-white mb-4">
            🤖 AI Reading Your Manifest
          </h3>

          {/* Description */}
          <p className="text-lg text-gray-300 mb-6 max-w-lg leading-relaxed">
            Our AI is analyzing your document, extracting pipe details, calculating totals, and verifying data accuracy.
          </p>

          {/* Progress Indicators */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-purple-500" />
              <span>Scanning document pages...</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-purple-500 animation-delay-200" />
              <span>Extracting joints, lengths, and weights...</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-purple-500 animation-delay-400" />
              <span>Calculating totals and verifying accuracy...</span>
            </div>
          </div>

          {/* Time Estimate */}
          <p className="text-sm text-gray-500 bg-gray-800/50 px-4 py-2 rounded-full">
            ⏱️ Typical processing time: 5-15 seconds
          </p>
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
    <>
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
              {loadSummary.total_length_m.toLocaleString()}
              <span className="text-lg text-gray-400 ml-1">m</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              ({loadSummary.total_length_ft.toLocaleString()} ft)
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
              {loadSummary.total_weight_kg.toLocaleString()}
              <span className="text-lg text-gray-400 ml-1">kg</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              ({loadSummary.total_weight_lbs.toLocaleString()} lbs)
            </p>
          </div>
        </div>
      </div>

      {/* Verification Buttons */}
      {(onVerify || onReportIssue) && (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
          <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verify Load Summary
          </h4>
          <p className="text-sm text-gray-400 mb-4">
            Please review the AI-extracted totals above. Are they correct?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {onVerify && (
              <Button
                onClick={onVerify}
                disabled={isConfirming}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConfirming ? (
                  <>
                    <svg className="w-5 h-5 inline mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Booking...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Verify & Confirm Booking
                  </>
                )}
              </Button>
            )}
            {onReportIssue && (
              <Button
                onClick={handleReportIssueClick}
                disabled={isConfirming}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Incorrect - Notify MPS
              </Button>
            )}
          </div>
        </div>
      )}

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
              your delivery is finalized.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Issue Description Modal */}
    {showIssueModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full">
          {/* Modal Header */}
          <div className="border-b border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Report Issue
              </h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={isSubmittingIssue}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <p className="text-sm text-gray-300 mb-4">
              Please describe what's incorrect with the AI-extracted data. MPS admin will review your documents and
              correct the information.
            </p>
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Example: The total joints should be 150, not 100. Missing joints from page 3."
              className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg p-3 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent placeholder-gray-500"
              disabled={isSubmittingIssue}
            />
          </div>

          {/* Modal Footer */}
          <div className="border-t border-gray-700 p-6 flex gap-3">
            <Button
              onClick={() => setShowIssueModal(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
              disabled={isSubmittingIssue}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitIssue}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
              disabled={!issueDescription.trim() || isSubmittingIssue}
            >
              {isSubmittingIssue ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Notifying MPS...
                </>
              ) : (
                'Submit Issue'
              )}
            </Button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default LoadSummaryReview;
