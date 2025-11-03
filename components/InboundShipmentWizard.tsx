import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import clsx from 'clsx';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import StorageYardStep, { StorageYardFormData } from './StorageYardStep';
import TruckingMethodStep, { TruckingMethod } from './TruckingMethodStep';
import TruckingDriverStep, { TruckingDriverFormData } from './TruckingDriverStep';
import TimeSlotPicker, { TimeSlot } from './TimeSlotPicker';
import DocumentUploadStep, { UploadedDocument } from './DocumentUploadStep';
import LoadSummaryReview from './LoadSummaryReview';
import type { Session, StorageRequest } from '../types';
import { processManifest, calculateLoadSummary, LoadSummary } from '../services/manifestProcessingService';
import { supabase } from '../lib/supabase';
import { sendTruckingQuoteRequest } from '../services/slackService';

type WizardStep = 'storage' | 'method' | 'trucking' | 'quote-pending' | 'timeslot' | 'documents' | 'review' | 'confirmation';

interface InboundShipmentWizardProps {
  request: StorageRequest;
  session: Session;
  onBack: () => void;
}

interface DeliveryFormData extends StorageYardFormData, TruckingDriverFormData {
  selectedTimeSlot: TimeSlot | null;
  specialNotes?: string;
}

const StepIndicator: React.FC<{ current: WizardStep; truckingMethod: TruckingMethod | null }> = ({ current, truckingMethod }) => {
  // Dynamic steps based on trucking method selection
  const baseSteps: Array<{ key: WizardStep; label: string }> = [
    { key: 'storage', label: 'Storage Yard' },
    { key: 'method', label: 'Transportation' },
  ];

  // Branch based on trucking method
  const conditionalSteps: Array<{ key: WizardStep; label: string }> = truckingMethod === 'MPS_QUOTE'
    ? [{ key: 'quote-pending', label: 'Quote Pending' }]
    : [
        { key: 'trucking', label: 'Trucking & Driver' },
        { key: 'timeslot', label: 'Time Slot' },
        { key: 'documents', label: 'Documents' },
        { key: 'review', label: 'Review' },
      ];

  const endSteps: Array<{ key: WizardStep; label: string }> = [
    { key: 'confirmation', label: 'Confirmed' },
  ];

  const steps = [...baseSteps, ...conditionalSteps, ...endSteps];

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
                  isActive && 'border-red-500 text-red-200 bg-red-500/20 scale-110',
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

const InboundShipmentWizard: React.FC<InboundShipmentWizardProps> = ({ request, session, onBack }) => {
  const [step, setStep] = useState<WizardStep>('storage');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form data
  const [storageData, setStorageData] = useState<StorageYardFormData | null>(null);
  const [selectedTruckingMethod, setSelectedTruckingMethod] = useState<TruckingMethod | null>(null);
  const [truckingData, setTruckingData] = useState<TruckingDriverFormData | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [loadSummary, setLoadSummary] = useState<LoadSummary | null>(null);
  const [isProcessingManifest, setIsProcessingManifest] = useState(false);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  // Forms
  const storageForm = useForm<StorageYardFormData>();
  const truckingForm = useForm<TruckingDriverFormData>();

  const handleStorageSubmit = async (data: StorageYardFormData) => {
    setStorageData(data);
    setStep('method');
    setErrorMessage(null);
  };

  const handleMethodSelect = async (method: TruckingMethod) => {
    setSelectedTruckingMethod(method);
    setErrorMessage(null);

    if (method === 'CUSTOMER_PROVIDED') {
      // Proceed to trucking details
      setStep('trucking');
    } else if (method === 'MPS_QUOTE') {
      // Create quote request
      setIsSaving(true);
      try {
        // Generate quote number (PV-0001, PV-0002, etc.)
        const { data: existingQuotes, error: countError } = await supabase
          .from('trucking_quotes')
          .select('quote_number')
          .order('created_at', { ascending: false })
          .limit(1);

        if (countError) throw countError;

        let quoteNumber = 'PV-0001';
        if (existingQuotes && existingQuotes.length > 0) {
          const lastNumber = parseInt(existingQuotes[0].quote_number.split('-')[1]);
          quoteNumber = `PV-${String(lastNumber + 1).padStart(4, '0')}`;
        }

        // Create quote request
        const { data: quote, error: quoteError } = await supabase
          .from('trucking_quotes')
          .insert({
            request_id: request.id,
            company_id: request.companyId,
            created_by: session.userId,
            quote_number: quoteNumber,
            origin_address: storageData?.storageYardAddress,
            destination_address: 'MPS Facility', // TODO: Get actual MPS address
            status: 'PENDING',
          })
          .select()
          .single();

        if (quoteError || !quote) {
          throw new Error(quoteError?.message || 'Failed to create quote request');
        }

        setQuoteId(quote.id);

        // Send Slack notification for quote request
        try {
          await sendTruckingQuoteRequest(
            quoteNumber,
            session.company.name,
            request.userId, // userId is the email address
            storageData?.storageYardAddress || 'Unknown Address',
            request.referenceId
          );
        } catch (slackError) {
          console.error('Failed to send Slack notification:', slackError);
          // Don't fail the whole operation if Slack fails
        }

        setStep('quote-pending');
        setStatusMessage('Quote request submitted! MPS will review and send you a quote within 24-48 hours.');
      } catch (error: any) {
        console.error('Failed to create quote request:', error);
        setErrorMessage(error.message || 'Failed to submit quote request. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleTruckingSubmit = async (data: TruckingDriverFormData) => {
    setTruckingData(data);
    setStep('timeslot');
    setErrorMessage(null);
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setSelectedTimeSlot(slot);
  };

  const handleTimeSlotContinue = () => {
    if (!selectedTimeSlot) {
      setErrorMessage('Please select a time slot to continue');
      return;
    }
    setStep('documents');
    setErrorMessage(null);
  };

  const handleFilesSelected = async (files: File[]) => {
    const newDocs: UploadedDocument[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadProgress: 0,
      status: 'uploading' as const,
    }));

    setUploadedDocuments(prev => [...prev, ...newDocs]);

    // Simulate upload and process with AI
    for (let i = 0; i < newDocs.length; i++) {
      const doc = newDocs[i];
      const file = files[i];

      try {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setUploadedDocuments(prev =>
            prev.map(d => d.id === doc.id ? { ...d, uploadProgress: progress } : d)
          );
        }

        // Mark as processing
        setUploadedDocuments(prev =>
          prev.map(d => d.id === doc.id ? { ...d, status: 'processing' as const } : d)
        );

        // Process manifest with AI
        setIsProcessingManifest(true);
        const result = await processManifest(file);
        const summary = calculateLoadSummary(result.items);
        setLoadSummary(summary);

        // Mark as completed
        setUploadedDocuments(prev =>
          prev.map(d => d.id === doc.id ? { ...d, status: 'completed' as const } : d)
        );
      } catch (error: any) {
        console.error('Failed to process manifest:', error);
        setUploadedDocuments(prev =>
          prev.map(d => d.id === doc.id ? {
            ...d,
            status: 'error' as const,
            errorMessage: error.message || 'Processing failed'
          } : d)
        );
      } finally {
        setIsProcessingManifest(false);
      }
    }
  };

  const handleRemoveDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(d => d.id !== documentId));
  };

  const handleDocumentsContinue = () => {
    if (uploadedDocuments.length === 0) {
      setErrorMessage('Please upload at least one manifest document');
      return;
    }
    setStep('review');
    setErrorMessage(null);
  };

  const handleReviewConfirm = async () => {
    if (!storageData || !truckingData || !selectedTimeSlot) {
      setErrorMessage('Missing required information. Please go back and complete all steps.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // Create shipment record
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          request_id: request.id,
          company_id: request.companyId,
          created_by: session.userId,
          storage_company_name: storageData.storageCompanyName,
          storage_yard_address: storageData.storageYardAddress,
          storage_contact_name: storageData.storageContactName,
          storage_contact_email: storageData.storageContactEmail,
          storage_contact_phone: storageData.storageContactPhone,
          trucking_company_name: truckingData.truckingCompanyName,
          driver_name: truckingData.driverName,
          driver_phone: truckingData.driverPhone,
          scheduled_slot_start: selectedTimeSlot.start.toISOString(),
          scheduled_slot_end: selectedTimeSlot.end.toISOString(),
          is_after_hours: selectedTimeSlot.is_after_hours,
          surcharge_amount: selectedTimeSlot.surcharge_amount,
          total_joints: loadSummary?.total_joints || null,
          total_length_ft: loadSummary?.total_length_ft || null,
          total_length_m: loadSummary?.total_length_m || null,
          total_weight_lbs: loadSummary?.total_weight_lbs || null,
          total_weight_kg: loadSummary?.total_weight_kg || null,
          status: 'SCHEDULED',
        })
        .select()
        .single();

      if (shipmentError || !shipment) {
        throw new Error(shipmentError?.message || 'Failed to create delivery');
      }

      setDeliveryId(shipment.id);

      // Create dock appointment
      const { error: appointmentError } = await supabase
        .from('dock_appointments')
        .insert({
          shipment_id: shipment.id,
          slot_start: selectedTimeSlot.start.toISOString(),
          slot_end: selectedTimeSlot.end.toISOString(),
          after_hours: selectedTimeSlot.is_after_hours,
          surcharge_applied: selectedTimeSlot.is_after_hours,
          status: selectedTimeSlot.is_after_hours ? 'PENDING' : 'CONFIRMED',
          calendar_sync_status: 'PENDING',
        });

      if (appointmentError) {
        console.error('Failed to create dock appointment:', appointmentError);
      }

      // TODO: Upload documents to Supabase Storage
      // TODO: Generate iCal file
      // TODO: Send Slack notification
      // TODO: Send confirmation email

      setStep('confirmation');
      setStatusMessage('Delivery successfully scheduled!');
    } catch (error: any) {
      console.error('Failed to save delivery:', error);
      setErrorMessage(error.message || 'Failed to schedule delivery. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasCompletedDocuments = useMemo(
    () => uploadedDocuments.some(d => d.status === 'completed'),
    [uploadedDocuments]
  );

  return (
    <Card className="bg-gray-950/70 border border-gray-800 shadow-2xl max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Schedule Delivery to MPS</h2>
          <p className="text-sm text-gray-400 mt-1">
            Request {request.referenceId} • {request.requestDetails?.itemType ?? 'Pipe'}
          </p>
        </div>
        <Button onClick={onBack} className="bg-gray-700 hover:bg-gray-600 px-4 py-2">
          &lt; Back
        </Button>
      </div>

      {/* Step Indicator */}
      <StepIndicator current={step} truckingMethod={selectedTruckingMethod} />

      {/* Status Messages */}
      {statusMessage && (
        <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-400/40 text-sm text-green-100">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-400/40 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[500px]">
        {step === 'storage' && (
          <form onSubmit={storageForm.handleSubmit(handleStorageSubmit)} className="space-y-6">
            <StorageYardStep
              register={storageForm.register}
              errors={storageForm.formState.errors}
            />
            <div className="flex justify-end pt-4 border-t border-gray-700">
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-500 px-8"
              >
                Continue to Transportation
              </Button>
            </div>
          </form>
        )}

        {step === 'method' && (
          <div className="space-y-6">
            <TruckingMethodStep
              selectedMethod={selectedTruckingMethod}
              onSelectMethod={handleMethodSelect}
            />
            <div className="flex justify-between pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => setStep('storage')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Back
              </Button>
              {/* Method selection happens via button clicks in TruckingMethodStep */}
            </div>
          </div>
        )}

        {step === 'quote-pending' && (
          <div className="py-8">
            <div className="text-center max-w-2xl mx-auto space-y-6">
              {/* Icon */}
              <div className="w-20 h-20 bg-blue-600/20 border-2 border-blue-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Trucking Quote Requested</h3>
                {quoteId && (
                  <p className="text-blue-400 font-mono text-sm mb-4">
                    {quoteId}
                  </p>
                )}
                <p className="text-gray-400">
                  MPS has been notified of your quote request. Our team will review your storage location
                  and provide a detailed transportation quote within 24-48 hours.
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 text-left">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What happens next?
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">1.</span>
                    <span>MPS admin reviews your storage location and calculates transportation logistics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">2.</span>
                    <span>You'll receive a detailed quote in your dashboard with pricing breakdown</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">3.</span>
                    <span>Review and approve the quote with a single click</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">4.</span>
                    <span>Once approved, MPS handles all delivery coordination</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">5.</span>
                    <span>You'll be able to schedule a delivery time slot after approval</span>
                  </li>
                </ul>
              </div>

              {/* Storage Info Summary */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 text-left">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Pickup Location</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-400">Storage Company</p>
                    <p className="text-white font-medium">{storageData?.storageCompanyName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Address</p>
                    <p className="text-white">{storageData?.storageYardAddress}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 justify-center pt-4">
                <Button
                  onClick={onBack}
                  className="bg-gray-700 hover:bg-gray-600 px-6"
                >
                  Return to Dashboard
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'trucking' && (
          <form onSubmit={truckingForm.handleSubmit(handleTruckingSubmit)} className="space-y-6">
            <TruckingDriverStep
              register={truckingForm.register}
              errors={truckingForm.formState.errors}
              storageCompanyName={storageData?.storageCompanyName}
            />
            <div className="flex justify-between pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => setStep('method')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Back
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-500 px-8"
              >
                Continue to Time Slot
              </Button>
            </div>
          </form>
        )}

        {step === 'timeslot' && (
          <div className="space-y-6">
            <TimeSlotPicker
              onSelectSlot={handleTimeSlotSelect}
              blockedSlots={[]}
            />
            <div className="flex justify-between pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => setStep('trucking')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Back
              </Button>
              <Button
                onClick={handleTimeSlotContinue}
                disabled={!selectedTimeSlot}
                className="bg-red-600 hover:bg-red-500 px-8 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Continue to Documents
              </Button>
            </div>

            {/* Selected Slot Summary */}
            {selectedTimeSlot && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mt-4">
                <h4 className="text-sm font-semibold text-white mb-2">Selected Time Slot</h4>
                <p className="text-sm text-gray-300">
                  {selectedTimeSlot.start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {' • '}
                  {selectedTimeSlot.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {' - '}
                  {selectedTimeSlot.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
                {selectedTimeSlot.is_after_hours && (
                  <p className="text-xs text-yellow-300 mt-2">
                    ⚠️ After-hours delivery • Additional ${selectedTimeSlot.surcharge_amount} surcharge
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'documents' && (
          <div className="space-y-6">
            <DocumentUploadStep
              onFilesSelected={handleFilesSelected}
              uploadedDocuments={uploadedDocuments}
              onRemoveDocument={handleRemoveDocument}
              isProcessing={isProcessingManifest}
            />
            <div className="flex justify-between pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => setStep('timeslot')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Back
              </Button>
              <Button
                onClick={handleDocumentsContinue}
                disabled={!hasCompletedDocuments || isProcessingManifest}
                className="bg-red-600 hover:bg-red-500 px-8 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessingManifest ? 'Processing...' : 'Continue to Review'}
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            {/* Delivery Summary */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-bold text-white mb-4">Delivery Summary</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 mb-1">Storage Company</p>
                  <p className="text-white font-medium">{storageData?.storageCompanyName}</p>
                  <p className="text-gray-500 text-xs mt-1">{storageData?.storageYardAddress}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Storage Contact</p>
                  <p className="text-white font-medium">{storageData?.storageContactName}</p>
                  <p className="text-gray-500 text-xs mt-1">{storageData?.storageContactEmail}</p>
                  <p className="text-gray-500 text-xs">{storageData?.storageContactPhone}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Trucking Company</p>
                  <p className="text-white font-medium">{truckingData?.truckingCompanyName}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Driver</p>
                  <p className="text-white font-medium">{truckingData?.driverName}</p>
                  <p className="text-gray-500 text-xs mt-1">{truckingData?.driverPhone}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Delivery Time</p>
                  <p className="text-white font-medium">
                    {selectedTimeSlot?.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {selectedTimeSlot?.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {' - '}
                    {selectedTimeSlot?.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                {selectedTimeSlot?.is_after_hours && (
                  <div>
                    <p className="text-gray-400 mb-1">After-Hours Surcharge</p>
                    <p className="text-yellow-300 font-medium">${selectedTimeSlot.surcharge_amount}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Load Summary */}
            <LoadSummaryReview
              loadSummary={loadSummary}
              isProcessing={isProcessingManifest}
              hasDocuments={uploadedDocuments.length > 0}
            />

            {/* Action Buttons */}
            <div className="flex justify-between pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => setStep('documents')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Back
              </Button>
              <Button
                onClick={handleReviewConfirm}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-500 px-8 disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Scheduling...
                  </>
                ) : (
                  'Confirm & Schedule Delivery'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="py-8">
            <div className="text-center max-w-2xl mx-auto space-y-6">
              {/* Success Icon */}
              <div className="w-20 h-20 bg-green-600/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Delivery Scheduled!</h3>
                <p className="text-gray-400">
                  Your delivery to MPS has been successfully scheduled for{' '}
                  <strong className="text-white">
                    {selectedTimeSlot?.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </strong>
                </p>
              </div>

              {/* Next Steps */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 text-left">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  What happens next?
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>MPS admin will review and verify your manifest details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>You'll receive a calendar invite (.ics file) via email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Our team has been notified via Slack</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Yard crew will be ready to receive your delivery</span>
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-4 justify-center pt-4">
                <Button
                  onClick={onBack}
                  className="bg-gray-700 hover:bg-gray-600 px-6"
                >
                  Return to Dashboard
                </Button>
                <Button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-500 px-6"
                >
                  Print Confirmation
                </Button>
              </div>

              {/* Reference Number */}
              {deliveryId && (
                <div className="text-xs text-gray-500 pt-4">
                  Delivery Reference: <span className="text-gray-400 font-mono">{deliveryId}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default InboundShipmentWizard;
