/**
 * Outbound Shipment Wizard
 *
 * Customer-facing wizard for booking pipe pickup from MPS facility to well site.
 * Flow: Destination → Shipping Method → Time Slot → Review → Confirmation
 *
 * Key validation: LSD + (Well Name OR UWI) required for outbound destination
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import clsx from 'clsx';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import TimeSlotPicker, { TimeSlot } from './TimeSlotPicker';
import type {
  Session,
  StorageRequest,
  TruckingLoad,
  ShippingMethod,
} from '../types';
import { supabase } from '../lib/supabase';
import { sendOutboundPickupNotification } from '../services/slackService';
import { usePendingLoadForRequest } from '../hooks/useTruckingLoadQueries';

type WizardStep = 'destination' | 'shipping' | 'timeslot' | 'review' | 'confirmation';

interface OutboundShipmentWizardProps {
  request: StorageRequest;
  session: Session;
  onBack: () => void;
  onPickupScheduled?: (updatedRequest: StorageRequest) => void;
}

interface DestinationFormData {
  lsd: string; // Legal Subdivision (required)
  wellName?: string; // Optional if UWI provided
  uwi?: string; // Optional if well name provided
  contactName: string;
  contactPhone: string;
  specialInstructions?: string;
}

interface ShippingFormData {
  shippingMethod: ShippingMethod;
  truckingCompanyName?: string; // Only for CUSTOMER_ARRANGED
  driverName?: string;
  driverPhone?: string;
}

const StepIndicator: React.FC<{ current: WizardStep }> = ({ current }) => {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: 'destination', label: 'Destination' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'timeslot', label: 'Time Slot' },
    { key: 'review', label: 'Review' },
    { key: 'confirmation', label: 'Confirmed' },
  ];

  const currentIndex = steps.findIndex(step => step.key === current);

  return (
    <div className="flex items-center justify-between gap-2 mb-8 overflow-x-auto pb-2">
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold transition-all',
                  isActive && 'border-blue-500 text-blue-200 bg-blue-500/20 scale-110',
                  isCompleted && 'border-green-500 text-green-200 bg-green-500/20',
                  !isActive && !isCompleted && 'border-gray-600 text-gray-400 bg-gray-800',
                )}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span className="mt-2 text-xs text-center text-gray-400 max-w-[80px]">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={clsx(
                'w-12 h-0.5 mx-2 transition-colors',
                idx < currentIndex ? 'bg-green-500' : 'bg-gray-700'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const OutboundShipmentWizard: React.FC<OutboundShipmentWizardProps> = ({
  request,
  session,
  onBack,
  onPickupScheduled,
}) => {
  const [step, setStep] = useState<WizardStep>('destination');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form data state
  const [destinationData, setDestinationData] = useState<DestinationFormData | null>(null);
  const [shippingData, setShippingData] = useState<ShippingFormData | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [pickupLoadId, setPickupLoadId] = useState<string | null>(null);

  // Check for existing pending outbound load
  const { data: pendingLoad, isLoading: isCheckingPendingLoad } = usePendingLoadForRequest(request.id);

  const destinationForm = useForm<DestinationFormData>();
  const shippingForm = useForm<ShippingFormData>();

  // ============================================================================
  // Step 1: Destination (LSD + Well Name/UWI)
  // ============================================================================
  const handleDestinationSubmit = async (data: DestinationFormData) => {
    // Validation: Must have LSD AND (well name OR UWI)
    if (!data.lsd || data.lsd.trim().length === 0) {
      setErrorMessage('LSD (Legal Subdivision) is required for outbound destination');
      return;
    }

    if ((!data.wellName || data.wellName.trim().length === 0) &&
        (!data.uwi || data.uwi.trim().length === 0)) {
      setErrorMessage('Either Well Name or UWI is required (at least one)');
      return;
    }

    setDestinationData(data);
    setStep('shipping');
    setErrorMessage(null);
  };

  // ============================================================================
  // Step 2: Shipping Method
  // ============================================================================
  const handleShippingSubmit = async (data: ShippingFormData) => {
    setShippingData(data);
    setErrorMessage(null);

    if (data.shippingMethod === 'CUSTOMER_ARRANGED') {
      // Proceed to time slot selection
      setStep('timeslot');
    } else if (data.shippingMethod === 'MPS_QUOTE') {
      // Create quote request for outbound
      setIsSaving(true);
      try {
        // TODO: Implement MPS quote for outbound
        // For now, show message that quotes are pending implementation
        setStatusMessage('MPS quote for outbound shipments is coming soon. Please use customer-arranged shipping for now.');
        setIsSaving(false);
        // Go back to shipping selection
        return;
      } catch (error: any) {
        console.error('Failed to create outbound quote:', error);
        setErrorMessage(error.message || 'Failed to create quote request');
        setIsSaving(false);
      }
    }
  };

  // ============================================================================
  // Step 3: Time Slot Selection
  // ============================================================================
  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setSelectedTimeSlot(slot);
    setStep('review');
    setErrorMessage(null);
  };

  // ============================================================================
  // Step 4: Review & Submit
  // ============================================================================
  const handleFinalSubmit = async () => {
    if (!destinationData || !shippingData || !selectedTimeSlot) {
      setErrorMessage('Missing required information. Please go back and complete all steps.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Get next sequence number for this request
      const { data: existingLoads, error: loadsError } = await supabase
        .from('trucking_loads')
        .select('sequence_number')
        .eq('storage_request_id', request.id)
        .order('sequence_number', { ascending: false })
        .limit(1);

      if (loadsError) throw loadsError;

      const nextSequence = existingLoads && existingLoads.length > 0
        ? existingLoads[0].sequence_number + 1
        : 1;

      // Create outbound trucking load
      const { data: newLoad, error: loadError } = await supabase
        .from('trucking_loads')
        .insert({
          storage_request_id: request.id,
          company_id: request.companyId,
          direction: 'OUTBOUND',
          sequence_number: nextSequence,
          status: 'APPROVED', // Outbound loads are auto-approved (customer-initiated)
          scheduled_slot_start: selectedTimeSlot.slot_start,
          scheduled_slot_end: selectedTimeSlot.slot_end,
          destination_lsd: destinationData.lsd,
          destination_well_name: destinationData.wellName || null,
          destination_uwi: destinationData.uwi || null,
          shipping_method: shippingData.shippingMethod,
          notes: destinationData.specialInstructions || null,
        })
        .select()
        .single();

      if (loadError || !newLoad) {
        throw new Error(loadError?.message || 'Failed to create pickup request');
      }

      setPickupLoadId(newLoad.id);

      // Send Slack notification
      await sendOutboundPickupNotification({
        companyName: session.companyName,
        requestReference: request.referenceId,
        pickupSlot: {
          start: selectedTimeSlot.slot_start,
          end: selectedTimeSlot.slot_end,
        },
        destination: {
          lsd: destinationData.lsd,
          wellName: destinationData.wellName,
          uwi: destinationData.uwi,
        },
        shippingMethod: shippingData.shippingMethod,
        contactName: destinationData.contactName,
        contactPhone: destinationData.contactPhone,
      });

      setStep('confirmation');
      setStatusMessage('Pickup request submitted successfully!');

      // Call parent callback if provided
      if (onPickupScheduled) {
        // Fetch updated request with new load
        const { data: updatedRequest, error: fetchError } = await supabase
          .from('storage_requests')
          .select('*')
          .eq('id', request.id)
          .single();

        if (!fetchError && updatedRequest) {
          onPickupScheduled(updatedRequest);
        }
      }
    } catch (error: any) {
      console.error('Failed to submit pickup request:', error);
      setErrorMessage(error.message || 'Failed to submit pickup request. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================================
  // UI Rendering
  // ============================================================================

  if (isCheckingPendingLoad) {
    return (
      <Card className="p-8 bg-gray-900">
        <div className="flex items-center justify-center">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-400">Checking for existing pickup requests...</span>
        </div>
      </Card>
    );
  }

  if (pendingLoad && pendingLoad.direction === 'OUTBOUND') {
    return (
      <Card className="p-8 bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Pickup Already Scheduled</h3>
          <p className="text-gray-400 mb-6">
            You already have a pending pickup request for this storage request. Please wait for admin approval or contact support.
          </p>
          <Button onClick={onBack} variant="secondary">
            Go Back
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8 bg-gray-900">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Request
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">Schedule Pickup</h2>
        <p className="text-gray-400">Book a pickup to transport your pipe from MPS facility to your well site</p>
      </div>

      <StepIndicator current={step} />

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-200 text-sm">
          {statusMessage}
        </div>
      )}

      {/* Step 1: Destination */}
      {step === 'destination' && (
        <form onSubmit={destinationForm.handleSubmit(handleDestinationSubmit)} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Destination Information</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  LSD (Legal Subdivision) <span className="text-red-400">*</span>
                </label>
                <input
                  {...destinationForm.register('lsd', { required: true })}
                  type="text"
                  placeholder="e.g., 01-02-003-04W5M"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Legal land description for the well site</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Well Name <span className="text-orange-400">(or UWI)</span>
                  </label>
                  <input
                    {...destinationForm.register('wellName')}
                    type="text"
                    placeholder="e.g., SMITH 01-02"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    UWI (Unique Well Identifier) <span className="text-orange-400">(or Well Name)</span>
                  </label>
                  <input
                    {...destinationForm.register('uwi')}
                    type="text"
                    placeholder="e.g., 100/01-02-003-04W5/0"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg text-blue-200 text-sm">
                <strong>Note:</strong> You must provide either Well Name OR UWI (or both)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Contact Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    {...destinationForm.register('contactName', { required: true })}
                    type="text"
                    placeholder="On-site contact person"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Contact Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    {...destinationForm.register('contactPhone', { required: true })}
                    type="tel"
                    placeholder="(403) 555-0123"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Special Instructions (Optional)
                </label>
                <textarea
                  {...destinationForm.register('specialInstructions')}
                  rows={3}
                  placeholder="Any special delivery instructions, access codes, or notes..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" onClick={onBack} variant="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Next: Shipping Method
            </Button>
          </div>
        </form>
      )}

      {/* Step 2: Shipping Method */}
      {step === 'shipping' && (
        <form onSubmit={shippingForm.handleSubmit(handleShippingSubmit)} className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Shipping Arrangement</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => shippingForm.setValue('shippingMethod', 'CUSTOMER_ARRANGED')}
                  className={clsx(
                    'p-6 border-2 rounded-xl transition-all text-left',
                    shippingForm.watch('shippingMethod') === 'CUSTOMER_ARRANGED'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  )}
                >
                  <div className="text-lg font-semibold text-white mb-2">Customer Arranged</div>
                  <div className="text-sm text-gray-400">I have my own trucking company</div>
                </button>

                <button
                  type="button"
                  onClick={() => shippingForm.setValue('shippingMethod', 'MPS_QUOTE')}
                  className={clsx(
                    'p-6 border-2 rounded-xl transition-all text-left',
                    shippingForm.watch('shippingMethod') === 'MPS_QUOTE'
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  )}
                >
                  <div className="text-lg font-semibold text-white mb-2">MPS Quote</div>
                  <div className="text-sm text-gray-400">Request shipping quote from MPS</div>
                  <div className="text-xs text-orange-400 mt-1">Coming soon</div>
                </button>
              </div>

              {shippingForm.watch('shippingMethod') === 'CUSTOMER_ARRANGED' && (
                <div className="space-y-4 pt-4 border-t border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Trucking Company Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      {...shippingForm.register('truckingCompanyName', { required: true })}
                      type="text"
                      placeholder="e.g., Acme Trucking Ltd."
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Driver Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        {...shippingForm.register('driverName', { required: true })}
                        type="text"
                        placeholder="Driver's full name"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Driver Phone <span className="text-red-400">*</span>
                      </label>
                      <input
                        {...shippingForm.register('driverPhone', { required: true })}
                        type="tel"
                        placeholder="(403) 555-0123"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" onClick={() => setStep('destination')} variant="secondary">
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!shippingForm.watch('shippingMethod') || isSaving}
            >
              {isSaving ? 'Processing...' : 'Next: Select Time Slot'}
            </Button>
          </div>
        </form>
      )}

      {/* Step 3: Time Slot */}
      {step === 'timeslot' && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Select Pickup Time</h3>
          <TimeSlotPicker
            selectedSlot={selectedTimeSlot}
            onSelectSlot={handleTimeSlotSelect}
            mode="pickup"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={() => setStep('shipping')} variant="secondary">
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 'review' && destinationData && shippingData && selectedTimeSlot && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white mb-4">Review Pickup Request</h3>

          <div className="space-y-4">
            {/* Destination */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">Destination</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">LSD:</span>
                  <span className="text-white font-medium">{destinationData.lsd}</span>
                </div>
                {destinationData.wellName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Well Name:</span>
                    <span className="text-white font-medium">{destinationData.wellName}</span>
                  </div>
                )}
                {destinationData.uwi && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">UWI:</span>
                    <span className="text-white font-medium">{destinationData.uwi}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Contact:</span>
                  <span className="text-white font-medium">{destinationData.contactName} ({destinationData.contactPhone})</span>
                </div>
                {destinationData.specialInstructions && (
                  <div>
                    <span className="text-gray-400">Instructions:</span>
                    <p className="text-white mt-1">{destinationData.specialInstructions}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">Shipping</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Method:</span>
                  <span className="text-white font-medium">
                    {shippingData.shippingMethod === 'CUSTOMER_ARRANGED' ? 'Customer Arranged' : 'MPS Quote'}
                  </span>
                </div>
                {shippingData.truckingCompanyName && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Trucking Company:</span>
                      <span className="text-white font-medium">{shippingData.truckingCompanyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Driver:</span>
                      <span className="text-white font-medium">{shippingData.driverName} ({shippingData.driverPhone})</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Time Slot */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3">Pickup Time</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Date & Time:</span>
                  <span className="text-white font-medium">
                    {new Date(selectedTimeSlot.slot_start).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {' - '}
                    {new Date(selectedTimeSlot.slot_end).toLocaleString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {selectedTimeSlot.is_after_hours && (
                  <div className="text-orange-400 text-xs">After hours pickup</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button onClick={() => setStep('timeslot')} variant="secondary" disabled={isSaving}>
              Back
            </Button>
            <Button onClick={handleFinalSubmit} variant="primary" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                'Confirm & Submit'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === 'confirmation' && (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Pickup Request Submitted!</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Your pickup request has been received. The admin will prepare your inventory for pickup at the scheduled time.
          </p>
          <div className="space-y-3">
            <Button onClick={onBack} variant="primary" className="w-full max-w-xs">
              Return to Dashboard
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default OutboundShipmentWizard;
