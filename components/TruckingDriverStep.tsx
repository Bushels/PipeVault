import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import clsx from 'clsx';

export interface TruckingDriverFormData {
  truckingCompanyName: string;
  driverName?: string;
  driverPhone?: string;
}

interface TruckingDriverStepProps {
  register: UseFormRegister<TruckingDriverFormData>;
  errors: FieldErrors<TruckingDriverFormData>;
  storageCompanyName?: string; // Pre-fill suggestion
}

const Label: React.FC<{ children: React.ReactNode; htmlFor?: string; required?: boolean }> = ({
  children,
  htmlFor,
  required
}) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-300 mb-2">
    {children}
    {required && <span className="text-red-400 ml-1">*</span>}
  </label>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }> = ({
  className,
  error,
  ...props
}) => (
  <input
    {...props}
    className={clsx(
      'w-full bg-gray-800 text-white placeholder-gray-500 border rounded-md py-2.5 px-3',
      'focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent',
      'disabled:opacity-60 disabled:cursor-not-allowed',
      'transition-colors',
      error ? 'border-red-500' : 'border-gray-700',
      className,
    )}
  />
);

const ErrorMessage: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {message}
    </p>
  );
};

const TruckingDriverStep: React.FC<TruckingDriverStepProps> = ({ register, errors, storageCompanyName }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-orange-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Trucking & Driver Details</h3>
            <p className="text-xs text-gray-300">
              Provide the trucking company name. Driver contact information is optional and can be added later if not yet assigned.
            </p>
          </div>
        </div>
      </div>

      {/* Trucking Company Name */}
      <div>
        <Label htmlFor="truckingCompanyName" required>
          Trucking Company Name
        </Label>
        <Input
          id="truckingCompanyName"
          placeholder={storageCompanyName ? `e.g., ${storageCompanyName}` : "e.g., Acme Transport Ltd"}
          error={!!errors.truckingCompanyName}
          {...register('truckingCompanyName', {
            required: 'Trucking company name is required',
            minLength: {
              value: 2,
              message: 'Company name must be at least 2 characters',
            },
          })}
        />
        {storageCompanyName && (
          <p className="mt-1 text-xs text-gray-400">
            If your storage company is also handling transport, enter the same company name
          </p>
        )}
        <ErrorMessage message={errors.truckingCompanyName?.message} />
      </div>

      {/* Driver Information */}
      <div className="border-t border-gray-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Driver Contact Information
          </h4>
          <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">Optional</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Driver Name */}
          <div>
            <Label htmlFor="driverName">
              Driver Name
            </Label>
            <Input
              id="driverName"
              placeholder="e.g., John Smith (if known)"
              error={!!errors.driverName}
              {...register('driverName', {
                minLength: {
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              })}
            />
            <p className="mt-1 text-xs text-gray-400">
              Can be added later if driver not yet assigned
            </p>
            <ErrorMessage message={errors.driverName?.message} />
          </div>

          {/* Driver Phone */}
          <div>
            <Label htmlFor="driverPhone">
              Driver Contact Number
            </Label>
            <Input
              id="driverPhone"
              type="tel"
              placeholder="(403) 555-9876 (if available)"
              error={!!errors.driverPhone}
              {...register('driverPhone', {
                pattern: {
                  value: /^[\d\s\-\(\)\+]+$/,
                  message: 'Please enter a valid phone number',
                },
                minLength: {
                  value: 10,
                  message: 'Phone number must be at least 10 digits',
                },
              })}
            />
            <p className="mt-1 text-xs text-gray-400">
              Direct line to reach driver (often assigned last minute)
            </p>
            <ErrorMessage message={errors.driverPhone?.message} />
          </div>
        </div>
      </div>

      {/* Why We Need This */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-gray-400 space-y-2">
            <p>
              <strong className="text-white">About driver contact:</strong> Driver contact information is helpful for
              communicating directly if there are delays, scheduling changes, or questions about unloading procedures.
              Since drivers are often assigned last minute, you can leave this blank and update it later.
            </p>
            <p className="text-gray-500">
              We don't need truck details (make, model, license plate) - just basic driver contact info when available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TruckingDriverStep;
