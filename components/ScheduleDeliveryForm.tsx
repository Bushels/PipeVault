import React, { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import type { ScheduleDeliveryForm } from '../types';
import { createDelivery, createNotification } from '../services/wixData';

interface ScheduleDeliveryFormProps {
  onBack: () => void;
  onSuccess: () => void;
  customerEmail?: string;
  prefilledProjectRef?: string;
}

const ScheduleDeliveryFormComponent: React.FC<ScheduleDeliveryFormProps> = ({
  onBack,
  onSuccess,
  customerEmail: initialEmail,
  prefilledProjectRef,
}) => {
  const [isValidated, setIsValidated] = useState(!!initialEmail && !!prefilledProjectRef);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ScheduleDeliveryForm>({
    customerEmail: initialEmail || '',
    projectReference: prefilledProjectRef || '',
    deliveryDate: '',
    timeSlot: '',
    isAfterHours: false,
    truckingCompany: '',
    numberOfTrucks: 1,
    jointsPerTruck: 0,
  });

  const updateField = (field: keyof ScheduleDeliveryForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Business hours time slots (8:00 AM - 5:00 PM, every 30 minutes)
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
    // In production, verify the email + project reference exists
    setIsValidated(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create delivery record
      const deliveryResponse = await createDelivery({
        requestId: 'mock-request-id', // In production, look up by project ref
        customerId: 'mock-customer-id',
        customerEmail: formData.customerEmail,
        projectReference: formData.projectReference,
        deliveryDate: new Date(formData.deliveryDate),
        deliveryTime: formData.timeSlot,
        isAfterHours: formData.isAfterHours,
        truckingCompany: formData.truckingCompany,
        numberOfTrucks: formData.numberOfTrucks,
        jointsPerTruck: formData.jointsPerTruck,
        totalJointsDelivery: formData.numberOfTrucks * formData.jointsPerTruck,
        driverName: formData.driverName,
        driverPhone: formData.driverPhone,
        status: 'scheduled',
      });

      if (deliveryResponse.success) {
        // Create notification for admin
        await createNotification({
          type: 'delivery-scheduled',
          requestId: 'mock-request-id',
          customerId: 'mock-customer-id',
          title: 'New Delivery Scheduled',
          message: `${formData.truckingCompany} scheduled delivery for ${formData.projectReference} on ${formData.deliveryDate}`,
          priority: formData.isAfterHours ? 'high' : 'medium',
          isRead: false,
          actionRequired: true,
          actionType: 'schedule',
        });

        onSuccess();
      }
    } catch (error) {
      console.error('Failed to schedule delivery:', error);
      alert('Failed to schedule delivery. Please try again.');
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
                <div className="text-6xl mb-4">🚚</div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Schedule Delivery
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

        <h1 className="text-3xl font-bold text-white mb-2">Schedule Delivery</h1>
        <p className="text-gray-400 mb-8">
          Project: {formData.projectReference}
        </p>

        <Card>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Delivery Date *
              </label>
              <input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => updateField('deliveryDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Time Slot */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Time Slot *
              </label>
              <select
                value={formData.timeSlot}
                onChange={(e) => updateField('timeSlot', e.target.value)}
                required
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a time</option>
                <optgroup label="Business Hours (Mon-Fri, 8am-5pm)">
                  {generateTimeSlots().map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="After Hours (Additional charges may apply)">
                  <option value="after-hours">Request After Hours Delivery</option>
                </optgroup>
              </select>

              {formData.timeSlot === 'after-hours' && (
                <div className="mt-2 bg-orange-900 bg-opacity-30 border border-orange-700 rounded-md p-3">
                  <p className="text-orange-300 text-sm">
                    After-hours deliveries will be reviewed by our team. Additional charges may apply.
                  </p>
                </div>
              )}
            </div>

            {/* Trucking Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trucking Company *
                </label>
                <input
                  type="text"
                  value={formData.truckingCompany}
                  onChange={(e) => updateField('truckingCompany', e.target.value)}
                  required
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

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
                  <span className="text-sm text-gray-400">Total Joints:</span>
                  <p className="text-xl font-bold text-white">
                    {formData.numberOfTrucks * formData.jointsPerTruck}
                  </p>
                </div>
              </div>
            </div>

            {/* Driver Information (Optional) */}
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

            {/* Submit Buttons */}
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
                    <span>Scheduling...</span>
                  </div>
                ) : (
                  'Schedule Delivery'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ScheduleDeliveryFormComponent;
