import React from 'react';
import clsx from 'clsx';

export type TruckingMethod = 'CUSTOMER_PROVIDED' | 'MPS_QUOTE';

interface TruckingMethodStepProps {
  selectedMethod: TruckingMethod | null;
  onSelectMethod: (method: TruckingMethod) => void;
}

const TruckingMethodStep: React.FC<TruckingMethodStepProps> = ({
  selectedMethod,
  onSelectMethod,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-orange-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Transportation Method</h3>
            <p className="text-xs text-gray-300">
              Choose who will handle transportation from your storage yard to MPS facility.
            </p>
          </div>
        </div>
      </div>

      {/* Method Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Provided Trucking */}
        <button
          type="button"
          onClick={() => onSelectMethod('CUSTOMER_PROVIDED')}
          className={clsx(
            'relative border-2 rounded-xl p-6 text-left transition-all duration-200',
            'hover:scale-[1.02] hover:shadow-lg',
            selectedMethod === 'CUSTOMER_PROVIDED'
              ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20'
              : 'border-gray-700 bg-gray-900/50 hover:border-red-500/50'
          )}
        >
          {/* Selection Indicator */}
          {selectedMethod === 'CUSTOMER_PROVIDED' && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Icon */}
          <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h4 className="text-lg font-bold text-white mb-2">I'll Arrange My Own Trucking</h4>
          <p className="text-sm text-gray-400 mb-4">
            You handle transportation logistics and coordinate delivery to MPS.
          </p>

          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Use your preferred carrier</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Schedule delivery time slots</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Upload manifests & tally sheets</span>
            </div>
          </div>
        </button>

        {/* MPS Provided Trucking Quote */}
        <button
          type="button"
          onClick={() => onSelectMethod('MPS_QUOTE')}
          className={clsx(
            'relative border-2 rounded-xl p-6 text-left transition-all duration-200',
            'hover:scale-[1.02] hover:shadow-lg',
            selectedMethod === 'MPS_QUOTE'
              ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
              : 'border-gray-700 bg-gray-900/50 hover:border-blue-500/50'
          )}
        >
          {/* Selection Indicator */}
          {selectedMethod === 'MPS_QUOTE' && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Icon */}
          <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <h4 className="text-lg font-bold text-white mb-2">Request MPS Trucking Quote</h4>
          <p className="text-sm text-gray-400 mb-4">
            Let MPS coordinate and quote transportation from your storage yard.
          </p>

          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">✓</span>
              <span>MPS handles all logistics</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">✓</span>
              <span>Receive quote within 24-48 hours</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">✓</span>
              <span>Approve quote in your dashboard</span>
            </div>
          </div>
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-gray-400 space-y-2">
            <p>
              <strong className="text-white">How it works:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong className="text-white">Customer Trucking:</strong> You'll provide trucking company and driver details,
                then schedule your delivery time slot immediately.
              </li>
              <li>
                <strong className="text-white">MPS Quote:</strong> We'll review your request, calculate distance and logistics,
                then send you a quote (PV-XXXX). Once approved, we handle everything.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Selection Required Notice */}
      {!selectedMethod && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            ↑ Please select a transportation method to continue
          </p>
        </div>
      )}
    </div>
  );
};

export default TruckingMethodStep;
