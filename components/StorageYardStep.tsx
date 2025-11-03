import React from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import clsx from 'clsx';

export interface StorageYardFormData {
  storageCompanyName: string;
  storageYardAddress: string;
  storageContactName: string;
  storageContactEmail: string;
  storageContactPhone: string;
}

interface StorageYardStepProps {
  register: UseFormRegister<StorageYardFormData>;
  errors: FieldErrors<StorageYardFormData>;
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

const StorageYardStep: React.FC<StorageYardStepProps> = ({ register, errors }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Storage Yard Information</h3>
            <p className="text-xs text-gray-300">
              Tell us where your pipe is currently stored. We'll use this to coordinate pickup with your trucking company.
            </p>
          </div>
        </div>
      </div>

      {/* Storage Company Name */}
      <div>
        <Label htmlFor="storageCompanyName" required>
          Storage Company Name
        </Label>
        <Input
          id="storageCompanyName"
          placeholder="e.g., Calgary Industrial Pipe Yard"
          error={!!errors.storageCompanyName}
          {...register('storageCompanyName', {
            required: 'Storage company name is required',
            minLength: {
              value: 2,
              message: 'Company name must be at least 2 characters',
            },
          })}
        />
        <ErrorMessage message={errors.storageCompanyName?.message} />
      </div>

      {/* Storage Yard Address */}
      <div>
        <Label htmlFor="storageYardAddress" required>
          Storage Yard Address
        </Label>
        <Input
          id="storageYardAddress"
          placeholder="1234 Industrial Blvd, Calgary AB T2E 6Z8"
          error={!!errors.storageYardAddress}
          {...register('storageYardAddress', {
            required: 'Storage yard address is required',
            minLength: {
              value: 10,
              message: 'Please enter a complete address',
            },
          })}
        />
        <p className="mt-1 text-xs text-gray-400">
          Full address including street, city, province, and postal code
        </p>
        <ErrorMessage message={errors.storageYardAddress?.message} />
      </div>

      {/* Contact Information Grid */}
      <div className="border-t border-gray-700 pt-6">
        <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Storage Company Contact
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Name */}
          <div>
            <Label htmlFor="storageContactName" required>
              Contact Name
            </Label>
            <Input
              id="storageContactName"
              placeholder="e.g., Sarah Johnson"
              error={!!errors.storageContactName}
              {...register('storageContactName', {
                required: 'Contact name is required',
                minLength: {
                  value: 2,
                  message: 'Name must be at least 2 characters',
                },
              })}
            />
            <ErrorMessage message={errors.storageContactName?.message} />
          </div>

          {/* Contact Phone */}
          <div>
            <Label htmlFor="storageContactPhone" required>
              Contact Phone
            </Label>
            <Input
              id="storageContactPhone"
              type="tel"
              placeholder="(403) 555-1234"
              error={!!errors.storageContactPhone}
              {...register('storageContactPhone', {
                required: 'Contact phone is required',
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
            <ErrorMessage message={errors.storageContactPhone?.message} />
          </div>
        </div>

        {/* Contact Email (full width) */}
        <div className="mt-4">
          <Label htmlFor="storageContactEmail" required>
            Contact Email
          </Label>
          <Input
            id="storageContactEmail"
            type="email"
            placeholder="sarah.johnson@pipeyard.com"
            error={!!errors.storageContactEmail}
            {...register('storageContactEmail', {
              required: 'Contact email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Please enter a valid email address',
              },
            })}
          />
          <ErrorMessage message={errors.storageContactEmail?.message} />
        </div>
      </div>

      {/* Helper Note */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-gray-400">
            <strong className="text-white">Note:</strong> We'll use this contact to coordinate pickup logistics
            and verify load details before delivery to MPS.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StorageYardStep;
