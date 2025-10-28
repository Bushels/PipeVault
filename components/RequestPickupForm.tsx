import React, { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import type { RequestPickupForm } from '../types';
import { createPickup, createNotification } from '../services/wixData';

interface RequestPickupFormProps {
  onBack: () => void;
  onSuccess: () => void;
  customerEmail?: string;
  prefilledProjectRef?: string;
}

const RequestPickupFormComponent: React.FC<RequestPickupFormProps> = ({
  onBack,
  onSuccess,
  customerEmail: initialEmail,
  prefilledProjectRef,
}) => {
  const [isValidated, setIsValidated] = useState(!!initialEmail && !!prefilledProjectRef);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<RequestPickupForm>({
    customerEmail: initialEmail || '',
    projectReference: prefilledProjectRef || '',
    pickupDate: '',
    timeSlot: '',
    isAfterHours: false,
    truckingType: 'customer-provided',
    numberOfTrucks: 1,
    jointsPerTruck: 0,
    totalJointsPickup: 0,
  });

  const updateField = (field: keyof RequestPickupForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 17; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 16) slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const handleValidation = (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidated(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const totalJoints = formData.numberOfTrucks * formData.jointsPerTruck;

      const pickupResponse = await createPickup({
        requestId: 'mock-request-id',
        customerId: 'mock-customer-id',
        customerEmail: formData.customerEmail,
        projectReference: formData.projectReference,
        pickupDate: new Date(formData.pickupDate),
        pickupTime: formData.timeSlot,
        isAfterHours: formData.isAfterHours,
        truckingType: formData.truckingType,
        truckingCompany: formData.truckingCompany,
        numberOfTrucks: formData.numberOfTrucks,
        jointsPerTruck: formData.jointsPerTruck,
        totalJointsPickup: totalJoints,
        totalLengthPickup: totalJoints * 12, // Approximate
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        quoteRequested: formData.truckingType === 'mps-provided',
        status: formData.truckingType === 'mps-provided' ? 'quote-pending' : 'requested',
      });

      if (pickupResponse.success) {
        await createNotification({
          type: 'pickup-requested',
          requestId: 'mock-request-id',
          customerId: 'mock-customer-id',
          title: formData.truckingType === 'mps-provided' ? 'Trucking Quote Requested' : 'Pickup Requested',
          message: `${formData.projectReference} - ${totalJoints} joints - ${formData.pickupDate}`,
          priority: formData.truckingType === 'mps-provided' ? 'high' : 'medium',
          isRead: false,
          actionRequired: true,
          actionType: formData.truckingType === 'mps-provided' ? 'quote' : 'schedule',
        });

        onSuccess();
      }
    } catch (error) {
      console.error('Failed to request pickup:', error);
      alert('Failed to request pickup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isValidated) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <button
            onClick={onBack}
            className="text-indigo-400 hover:text-indigo-300 mb-4 flex items-center gap-2"
          >
            ← Back to Menu
          </button>

          <Card>
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">📦</div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Request Pickup
                </h2>
                <p className="text-gray-400 text-sm">
                  Please verify your identity to continue
                </p>
              </div>

              <form onSubmit={handleValidation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => updateField('customerEmail', e.target.value)}
                    required
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Project Reference Number
                  </label>
                  <input
                    type="text"
                    value={formData.projectReference}
                    onChange={(e) => updateField('projectReference', e.target.value)}
                    required
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="text-indigo-400 hover:text-indigo-300 mb-4 flex items-center gap-2"
        >
          ← Back to Menu
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Request Pickup</h1>
        <p className="text-gray-400 mb-8">
          Project: {formData.projectReference}
        </p>

        <Card>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Trucking Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Trucking Arrangement *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateField('truckingType', 'customer-provided')}
                  className={`py-4 px-4 rounded-md border-2 transition-colors ${
                    formData.truckingType === 'customer-provided'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-2">🚛</div>
                  <div className="font-semibold">I'll Provide Trucking</div>
                  <div className="text-xs opacity-75 mt-1">My own trucking company</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateField('truckingType', 'mps-provided')}
                  className={`py-4 px-4 rounded-md border-2 transition-colors ${
                    formData.truckingType === 'mps-provided'
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-2">💼</div>
                  <div className="font-semibold">Request MPS Quote</div>
                  <div className="text-xs opacity-75 mt-1">We'll provide a quote</div>
                </button>
              </div>

              {formData.truckingType === 'mps-provided' && (
                <div className="mt-3 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-md p-3">
                  <p className="text-blue-300 text-sm">
                    Our team will review your request and provide a trucking quote shortly.
                  </p>
                </div>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pickup Date *
                </label>
                <input
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => updateField('pickupDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Time Slot *
                </label>
                <select
                  value={formData.timeSlot}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateField('timeSlot', value);
                    updateField('isAfterHours', value === 'after-hours');
                  }}
                  required
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a time</option>
                  <optgroup label="Business Hours">
                    {generateTimeSlots().map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="After Hours">
                    <option value="after-hours">Request After Hours</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Trucks *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.numberOfTrucks}
                  onChange={(e) => updateField('numberOfTrucks', parseInt(e.target.value))}
                  required
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Joints per Truck *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.jointsPerTruck}
                  onChange={(e) => updateField('jointsPerTruck', parseInt(e.target.value))}
                  required
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <div className="w-full bg-gray-800 rounded-md p-3">
                  <span className="text-sm text-gray-400">Total:</span>
                  <p className="text-xl font-bold text-white">
                    {formData.numberOfTrucks * formData.jointsPerTruck} joints
                  </p>
                </div>
              </div>
            </div>

            {/* Trucking Company (only if customer provided) */}
            {formData.truckingType === 'customer-provided' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trucking Company *
                </label>
                <input
                  type="text"
                  value={formData.truckingCompany || ''}
                  onChange={(e) => updateField('truckingCompany', e.target.value)}
                  required
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Driver Info (optional) */}
            {formData.truckingType === 'customer-provided' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Driver Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.driverName || ''}
                    onChange={(e) => updateField('driverName', e.target.value)}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Driver Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.driverPhone || ''}
                    onChange={(e) => updateField('driverPhone', e.target.value)}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Special Instructions (Optional)
              </label>
              <textarea
                value={formData.specialInstructions || ''}
                onChange={(e) => updateField('specialInstructions', e.target.value)}
                rows={3}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onBack}
                className="flex-1 bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner className="w-5 h-5" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit Pickup Request'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default RequestPickupFormComponent;
