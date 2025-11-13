/**
 * Request Correction Modal
 *
 * Modal for requesting manifest corrections from customer.
 * Provides common issue checkboxes + custom issue input.
 * Sends Slack notification with list of issues.
 *
 * Design:
 * - Predefined issue checkboxes (missing data, duplicates, etc.)
 * - Custom issue text field
 * - At least 1 issue required
 * - Status remains NEW (not rejected)
 * - Customer can re-upload corrected manifest
 */

import React, { useState } from 'react';
import { useRequestCorrection } from '../../hooks/useLoadApproval';
import type { TruckingLoad, Company } from '../../types';

interface RequestCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: TruckingLoad | null;
  company: Company | null;
}

// Common manifest issues
const COMMON_ISSUES = [
  'Missing heat numbers',
  'Missing serial numbers',
  'Duplicate serial numbers',
  'Missing tally lengths',
  'Missing pipe specifications (OD, weight, grade)',
  'Illegible handwriting',
  'Incomplete manifest (pages missing)',
  'Quantity mismatch (manifest vs booking)',
];

const RequestCorrectionModal: React.FC<RequestCorrectionModalProps> = ({
  isOpen,
  onClose,
  load,
  company,
}) => {
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [customIssue, setCustomIssue] = useState('');
  const { requestCorrection, isLoading } = useRequestCorrection();

  if (!isOpen || !load || !company) return null;

  const loadData = load as any;

  const handleToggleIssue = (issue: string) => {
    setSelectedIssues(prev =>
      prev.includes(issue)
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  };

  const handleRequest = () => {
    const allIssues = [...selectedIssues];
    if (customIssue.trim()) {
      allIssues.push(customIssue.trim());
    }

    if (allIssues.length === 0) return;

    requestCorrection({
      loadId: load.id,
      companyId: company.id,
      companyName: company.name,
      companyDomain: company.domain,
      sequenceNumber: loadData.sequence_number,
      scheduledSlotStart: loadData.scheduled_slot_start,
      scheduledSlotEnd: loadData.scheduled_slot_end,
      truckingCompany: loadData.trucking_company,
      driverName: loadData.driver_name,
      totalJointsPlanned: loadData.total_joints_planned,
      totalLengthFtPlanned: loadData.total_length_ft_planned,
      issues: allIssues,
    }, {
      onSuccess: () => {
        setSelectedIssues([]);
        setCustomIssue('');
        onClose();
      }
    });
  };

  const totalIssues = selectedIssues.length + (customIssue.trim() ? 1 : 0);
  const canSubmit = totalIssues > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ zIndex: 10000 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 10001 }}
      >
        <div
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-orange-900/20 w-full max-w-2xl rounded-2xl border-2 border-orange-500 shadow-2xl max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Request Manifest Correction
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Load #{loadData.sequence_number} - {company.name}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Info Message */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                <strong className="text-blue-400">Note:</strong> This will notify the customer via Slack to re-upload
                a corrected manifest. The load status will remain <strong>Pending</strong> until you approve it.
              </p>
            </div>

            {/* Common Issues Checkboxes */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Common Issues (select all that apply)</h3>
              <div className="space-y-2">
                {COMMON_ISSUES.map((issue) => (
                  <label
                    key={issue}
                    className="flex items-start gap-3 p-3 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition-colors border border-gray-700 hover:border-orange-500/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(issue)}
                      onChange={() => handleToggleIssue(issue)}
                      disabled={isLoading}
                      className="mt-0.5 w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-gray-300">{issue}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Issue Input */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Other Issue (optional)</h3>
              <textarea
                value={customIssue}
                onChange={(e) => setCustomIssue(e.target.value)}
                disabled={isLoading}
                placeholder="e.g., Heat numbers don't match mill certificates"
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            {/* Issue Counter */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                <strong className="text-white">{totalIssues}</strong> issue{totalIssues !== 1 ? 's' : ''} selected
                {totalIssues === 0 && <span className="text-orange-400 ml-2">(select at least 1 to continue)</span>}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-800 px-6 py-4 bg-gray-900 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleRequest}
              disabled={!canSubmit || isLoading}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Correction Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RequestCorrectionModal;
