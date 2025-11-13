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
import type {
  Session,
  StorageRequest,
  ProvidedTruckingDetails,
  TruckingInfo,
  TruckingLoad,
  TruckingLoadStatus,
  TruckingDocument,
} from '../types';
import { processManifest, calculateLoadSummary, LoadSummary } from '../services/manifestProcessingService';
import { supabase } from '../lib/supabase';
import { sendTruckingQuoteRequest, sendInboundDeliveryNotification, sendManifestIssueNotification, sendLoadBookingConfirmation } from '../services/slackService';
import { usePendingLoadForRequest } from '../hooks/useTruckingLoadQueries';

type WizardStep = 'storage' | 'method' | 'trucking' | 'quote-pending' | 'timeslot' | 'documents' | 'review' | 'confirmation';

interface InboundShipmentWizardProps {
  request: StorageRequest;
  session: Session;
  onBack: () => void;
  onDeliveryScheduled?: (updatedRequest: StorageRequest) => void;
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

const InboundShipmentWizard: React.FC<InboundShipmentWizardProps> = ({ request, session, onBack, onDeliveryScheduled }) => {
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

  // Sequential blocking: Check if this request has any pending loads
  const { data: pendingLoad, isLoading: isCheckingPendingLoad } = usePendingLoadForRequest(request.id);

  type DeliveryStatusUpdate = 'pending_confirmation' | 'scheduled';

  const buildUpdatedRequest = (
    status: DeliveryStatusUpdate,
    slotStartIso: string,
    slotEndIso: string,
    shipmentId?: string | null,
    truckingLoad?: TruckingLoad | null
  ): StorageRequest => {
    const nextDetails: ProvidedTruckingDetails = {
      ...(request.truckingInfo?.details ?? {}),
    };

    const existingLoads = request.truckingLoads ?? [];
    const mergedLoads = truckingLoad
      ? [...existingLoads.filter(load => load.id !== truckingLoad.id), truckingLoad].sort(
          (a, b) => a.sequenceNumber - b.sequenceNumber
        )
      : existingLoads;

    if (storageData?.storageCompanyName) {
      nextDetails.storageCompany = storageData.storageCompanyName;
    }
    if (storageData?.storageContactName) {
      nextDetails.storageContactName = storageData.storageContactName;
    }
    if (storageData?.storageContactEmail) {
      nextDetails.storageContactEmail = storageData.storageContactEmail;
    }
    if (storageData?.storageContactPhone) {
      nextDetails.storageContactNumber = storageData.storageContactPhone;
    }
    if (storageData?.storageYardAddress) {
      nextDetails.storageLocation = storageData.storageYardAddress;
    }

    if (truckingData?.truckingCompanyName) {
      nextDetails.truckingCompanyName = truckingData.truckingCompanyName;
    }
    if (truckingData?.driverName) {
      nextDetails.driverName = truckingData.driverName;
    }
    if (truckingData?.driverPhone) {
      nextDetails.driverPhone = truckingData.driverPhone;
    }

    nextDetails.deliveryStatus = status;
    nextDetails.deliverySlot = {
      start: slotStartIso,
      end: slotEndIso,
      isAfterHours: selectedTimeSlot?.is_after_hours ?? undefined,
      submittedAt: new Date().toISOString(),
      shipmentId: shipmentId ?? null,
    };

    const derivedTruckingType: TruckingInfo['truckingType'] =
      request.truckingInfo?.truckingType === 'quote'
        ? 'provided'
        : request.truckingInfo?.truckingType ?? (selectedTruckingMethod === 'MPS_QUOTE' ? 'quote' : 'provided');

    return {
      ...request,
      truckingInfo: {
        truckingType: derivedTruckingType,
        details: nextDetails,
      },
      truckingLoads: mergedLoads,
    };
  };

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

  const handleTimeSlotSelect = (slot: TimeSlot | null) => {
    setSelectedTimeSlot(slot);
    if (slot) {
      setErrorMessage(null);
    }
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
      file,
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

  const handleSkipDocuments = () => {
    const inboundLoads = (request.truckingLoads ?? []).filter(load => load.direction === 'INBOUND');
    const missingDocs = inboundLoads.some(load => !load.documents || load.documents.length === 0);
    if (missingDocs) {
      const proceed = window.confirm(
        'Manifest documents keep each load organized. Continue without uploading paperwork?'
      );
      if (!proceed) {
        return;
      }
    }
    setStep('review');
    setErrorMessage(null);
  };

  const sanitizeFileName = (name: string) =>
    name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '').toLowerCase();

  const uploadDocumentsForShipment = async (
    shipmentId: string,
    truckId: string | null,
    truckingLoadId: string | null = null
  ): Promise<TruckingDocument[]> => {
    const createdTruckingDocs: TruckingDocument[] = [];
    const completedDocs = uploadedDocuments.filter(doc => doc.status === 'completed');
    if (!completedDocs.length) return createdTruckingDocs;

    for (const doc of completedDocs) {
      const safeName = sanitizeFileName(doc.fileName);
      const uniqueName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
      const defaultPath = `${request.companyId}/${request.referenceId}/shipments/${shipmentId}/${truckId ?? 'shipment'}/${uniqueName}`;

      let uploadedPath = doc.storagePath ?? defaultPath;
      let storageUploaded = false;

      try {
        if (!doc.isMock) {
          const file = doc.file;
          if (!file) {
            // Skip documents missing file reference when not mock
            continue;
          }

          const { data: storageData, error: storageError } = await supabase.storage
            .from('documents')
            .upload(uploadedPath, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (storageError || !storageData?.path) {
            throw new Error(storageError?.message || `Unable to upload ${doc.fileName}`);
          }

          uploadedPath = storageData.path;
          storageUploaded = true;
        }

        const { data: documentRow, error: documentError } = await supabase
          .from('documents')
          .insert({
            company_id: request.companyId,
            request_id: request.id,
            file_name: doc.fileName,
            file_type: doc.fileType,
            file_size: doc.fileSize ?? (doc.file ? doc.file.size : 0),
            storage_path: uploadedPath,
            extracted_data: null,
            is_processed: false,
          })
          .select()
          .single();

        if (documentError || !documentRow) {
          throw documentError || new Error('Unable to register uploaded document.');
        }

        const { error: shipmentDocError } = await supabase
          .from('shipment_documents')
          .insert({
            shipment_id: shipmentId,
            truck_id: truckId,
            document_id: documentRow.id,
            document_type: 'manifest',
            status: 'UPLOADED',
            uploaded_by: session.userId,
            trucking_load_id: truckingLoadId,
          });

        if (shipmentDocError) {
          throw shipmentDocError;
        }

        if (truckingLoadId) {
          const { data: truckingDocRow, error: truckingDocError } = await supabase
            .from('trucking_documents')
            .insert({
              trucking_load_id: truckingLoadId,
              file_name: doc.fileName,
              storage_path: uploadedPath,
              document_type: 'manifest',
              uploaded_by: session.userId,
            })
            .select()
            .single();

          if (truckingDocError) {
            throw truckingDocError;
          }

          if (truckingDocRow) {
            createdTruckingDocs.push({
              id: truckingDocRow.id,
              truckingLoadId: truckingDocRow.trucking_load_id,
              fileName: truckingDocRow.file_name,
              storagePath: truckingDocRow.storage_path,
              documentType: truckingDocRow.document_type || null,
              uploadedBy: truckingDocRow.uploaded_by || null,
              uploadedAt: truckingDocRow.uploaded_at || undefined,
            });
          }
        }

        setUploadedDocuments(prev =>
          prev.map(d =>
            d.id === doc.id
              ? { ...d, storagePath: uploadedPath, documentRecordId: documentRow.id }
              : d
          )
        );
      } catch (docError) {
        if (!doc.isMock && storageUploaded) {
          await supabase.storage.from('documents').remove([uploadedPath]);
        }
        throw docError;
      }
    }

    return createdTruckingDocs;
  };

  const handleReportIssue = async (issueDescription: string) => {
    try {
      // Query database directly for latest sequence number (don't trust cached data)
      const { data: latestLoad } = await supabase
        .from('trucking_loads')
        .select('sequence_number')
        .eq('storage_request_id', request.id)
        .eq('direction', 'INBOUND')
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const loadNumber = (latestLoad?.sequence_number ?? 0) + 1;

      // Get document names
      const documentNames = uploadedDocuments.map(doc => doc.fileName);

      // Send Slack notification to admin
      await sendManifestIssueNotification({
        referenceId: request.referenceId || request.id,
        companyName: request.request_details?.companyName || 'Unknown Company',
        contactEmail: session.userEmail,
        loadNumber,
        issueDescription,
        documentNames,
        loadSummary: loadSummary
          ? {
              total_joints: loadSummary.total_joints,
              total_length_ft: loadSummary.total_length_ft,
              total_weight_lbs: loadSummary.total_weight_lbs,
            }
          : null,
      });

      // Show success message
      setSuccessMessage(
        'Issue reported to MPS admin. They will review your documents and contact you once the data is corrected. ' +
        'You can proceed with booking Load #' + loadNumber + ' once the issue is resolved.'
      );

      // Go back to review step
      // User stays on review step and can try again or go back
    } catch (error: any) {
      setErrorMessage(
        'Failed to send issue notification: ' + (error.message || 'Unknown error')
      );
    }
  };

  const handleReviewConfirm = async () => {
    if (!storageData || !truckingData || !selectedTimeSlot) {
      setErrorMessage('Missing required information. Please go back and complete all steps.');
      return;
    }

    const slotStartIso = selectedTimeSlot.start.toISOString();
    const slotEndIso = selectedTimeSlot.end.toISOString();
    const truckingMethod = selectedTruckingMethod ?? 'CUSTOMER_PROVIDED';
    const documentsStatus = uploadedDocuments.length ? 'UPLOADED' : 'PENDING';
    const deliveryStatusForRequest: DeliveryStatusUpdate = selectedTimeSlot.is_after_hours ? 'pending_confirmation' : 'scheduled';

    const logisticsNotes = [
      `Storage yard: ${storageData.storageCompanyName}`,
      `Address: ${storageData.storageYardAddress}`,
      `Primary contact: ${storageData.storageContactName} (${storageData.storageContactPhone})`,
      `Email: ${storageData.storageContactEmail}`
    ].join('\n');

    const schemaMissing = (error: any) => {
      const message = typeof error?.message === 'string' ? error.message : typeof error?.details === 'string' ? error.details : '';
      return (
        error?.code === '42P01' ||
        message.includes('public.shipments') ||
        message.includes('public.shipment_trucks') ||
        message.includes('public.dock_appointments') ||
        message.includes('public.trucking_loads') ||
        message.includes('public.trucking_documents')
      );
    };

    const notifyFallback = async () => {
      try {
        await sendInboundDeliveryNotification({
          referenceId: request.referenceId,
          companyName: session.company.name,
          contactEmail: session.userId,
          slotStart: slotStartIso,
          slotEnd: slotEndIso,
          isAfterHours: selectedTimeSlot.is_after_hours,
          surchargeAmount: selectedTimeSlot.surcharge_amount,
          storage: {
            companyName: storageData.storageCompanyName,
            address: storageData.storageYardAddress,
            contactName: storageData.storageContactName,
            contactPhone: storageData.storageContactPhone,
            contactEmail: storageData.storageContactEmail,
          },
          trucking: {
            companyName: truckingData.truckingCompanyName,
            driverName: truckingData.driverName,
            driverPhone: truckingData.driverPhone,
          },
          loadSummary,
        });
      } catch (notifyError) {
        console.error('Failed to send fallback delivery notification:', notifyError);
      }

      const fallbackMessage = selectedTimeSlot.is_after_hours
        ? 'Delivery request sent to MPS logistics. After-hours slots require manual confirmation.'
        : 'Delivery request sent to MPS logistics. Our team will follow up to confirm your slot.';

      if (onDeliveryScheduled) {
        onDeliveryScheduled(buildUpdatedRequest(deliveryStatusForRequest, slotStartIso, slotEndIso, null));
      }

      setDeliveryId(null);
      setStep('confirmation');
      setStatusMessage(fallbackMessage);
      setErrorMessage(null);
    };

    setIsSaving(true);
    setErrorMessage(null);

    let newTruckingLoad: TruckingLoad | null = null;

    try {
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          request_id: request.id,
          company_id: request.companyId,
          created_by: session.userId,
          trucking_method: truckingMethod,
          trucking_company: truckingData.truckingCompanyName,
          trucking_contact_name: truckingData.driverName || storageData.storageContactName,
          trucking_contact_phone: truckingData.driverPhone || storageData.storageContactPhone,
          trucking_contact_email: storageData.storageContactEmail,
          number_of_trucks: 1,
          estimated_joint_count: loadSummary?.total_joints ?? null,
          estimated_total_length_ft: loadSummary?.total_length_ft ?? null,
          special_instructions: logisticsNotes,
          surcharge_applicable: selectedTimeSlot.is_after_hours,
          surcharge_amount: selectedTimeSlot.surcharge_amount,
          documents_status: documentsStatus,
          calendar_sync_status: 'PENDING',
          status: selectedTimeSlot.is_after_hours ? 'SCHEDULING' : 'SCHEDULED',
        })
        .select()
        .single();

      if (shipmentError || !shipment) {
        if (schemaMissing(shipmentError)) {
          await notifyFallback();
          return;
        }
        throw shipmentError || new Error('Failed to create delivery');
      }

      setDeliveryId(shipment.id);

      const { data: truck, error: truckError } = await supabase
        .from('shipment_trucks')
        .insert({
          shipment_id: shipment.id,
          sequence_number: 1,
          status: selectedTimeSlot.is_after_hours ? 'PENDING' : 'SCHEDULED',
          trucking_company: truckingData.truckingCompanyName,
          contact_name: truckingData.driverName || storageData.storageContactName,
          contact_phone: truckingData.driverPhone || storageData.storageContactPhone,
          contact_email: storageData.storageContactEmail,
          scheduled_slot_start: slotStartIso,
          scheduled_slot_end: slotEndIso,
          notes: logisticsNotes,
        })
        .select()
        .single();

      if (truckError) {
        if (schemaMissing(truckError)) {
          await notifyFallback();
          return;
        }
        console.error('Failed to create shipment truck record:', truckError);
      }

      // Check if appointment already exists for this shipment
      const { data: existingAppointment } = await supabase
        .from('dock_appointments')
        .select()
        .eq('shipment_id', shipment.id)
        .maybeSingle();

      let appointment = existingAppointment;

      if (!existingAppointment) {
        const { data: newAppointment, error: appointmentError } = await supabase
          .from('dock_appointments')
          .insert({
            shipment_id: shipment.id,
            truck_id: truck?.id ?? null,
            slot_start: slotStartIso,
            slot_end: slotEndIso,
            after_hours: selectedTimeSlot.is_after_hours,
            surcharge_applied: selectedTimeSlot.is_after_hours,
            status: selectedTimeSlot.is_after_hours ? 'PENDING' : 'CONFIRMED',
            calendar_sync_status: 'PENDING',
          })
          .select()
          .single();

        if (appointmentError) {
          if (schemaMissing(appointmentError)) {
            await notifyFallback();
            return;
          }
          console.error('Failed to create dock appointment:', appointmentError);
        }

        appointment = newAppointment;
      }

      // Query database directly for latest sequence number (don't trust cached data)
      const { data: latestLoad } = await supabase
        .from('trucking_loads')
        .select('sequence_number')
        .eq('storage_request_id', request.id)
        .eq('direction', 'INBOUND')
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSequenceNumber = (latestLoad?.sequence_number ?? 0) + 1;
      // All loads require admin approval - no auto-approval
      const loadStatus: TruckingLoadStatus = 'NEW';

      // Check if trucking load already exists for this request/direction/sequence
      const { data: existingLoad } = await supabase
        .from('trucking_loads')
        .select()
        .eq('storage_request_id', request.id)
        .eq('direction', 'INBOUND')
        .eq('sequence_number', nextSequenceNumber)
        .maybeSingle();

      let truckingLoad = existingLoad;
      let truckingLoadError = null;

      if (!existingLoad) {
        const { data: newLoad, error: loadError } = await supabase
          .from('trucking_loads')
          .insert({
            storage_request_id: request.id,
            direction: 'INBOUND',
            sequence_number: nextSequenceNumber,
            status: loadStatus,
            scheduled_slot_start: slotStartIso,
            scheduled_slot_end: slotEndIso,
            // INBOUND: pickup_location = customer's yard (FROM), delivery_location = MPS facility (TO)
            pickup_location: storageData.storageYardAddress
              ? {
                  company: storageData.storageCompanyName,
                  address: storageData.storageYardAddress,
                }
              : null,
            delivery_location: {
              facility: 'MPS Pipe Storage',
              address: 'Bobs Address 123', // TODO: Replace with actual MPS facility address from env/config
            },
            trucking_company: truckingData.truckingCompanyName,
            contact_company: storageData.storageCompanyName,
            contact_name: storageData.storageContactName,
            contact_phone: storageData.storageContactPhone,
            contact_email: storageData.storageContactEmail,
            driver_name: truckingData.driverName,
            driver_phone: truckingData.driverPhone,
            notes: logisticsNotes,
            total_joints_planned: loadSummary?.total_joints ?? null,
            total_length_ft_planned: loadSummary?.total_length_ft ?? null,
            total_weight_lbs_planned: loadSummary?.total_weight_lbs ?? null,
          })
          .select()
          .single();

        if (loadError) {
          if (schemaMissing(loadError)) {
            await notifyFallback();
            return;
          }
          console.error('Failed to create trucking load record:', loadError);
        }

        truckingLoad = newLoad;
        truckingLoadError = loadError;
      }

      if (truckingLoadError || !truckingLoad) {
        if (schemaMissing(truckingLoadError)) {
          await notifyFallback();
          return;
        }
        console.error('Failed to create trucking load record:', truckingLoadError || new Error('Unknown error'));
        if (appointment?.id) {
          await supabase.from('dock_appointments').delete().eq('id', appointment.id);
        }
        if (truck?.id) {
          await supabase.from('shipment_trucks').delete().eq('id', truck.id);
        }
        await supabase.from('shipments').delete().eq('id', shipment.id);
        throw new Error('Unable to create trucking load. Please try again.');
      }

      const truckingLoadId = truckingLoad.id;

      try {
        await supabase.from('shipments').update({ trucking_load_id: truckingLoadId }).eq('id', shipment.id);
        if (truck?.id) {
          await supabase.from('shipment_trucks').update({ trucking_load_id: truckingLoadId }).eq('id', truck.id);
        }
        if (appointment?.id) {
          await supabase.from('dock_appointments').update({ trucking_load_id: truckingLoadId }).eq('id', appointment.id);
        }
      } catch (linkError) {
        console.error('Failed to link trucking load to shipment records:', linkError);
      }

      newTruckingLoad = {
        id: truckingLoad.id,
        storageRequestId: truckingLoad.storage_request_id,
        direction: truckingLoad.direction,
        sequenceNumber: truckingLoad.sequence_number,
        status: truckingLoad.status,
        scheduledSlotStart: truckingLoad.scheduled_slot_start ?? undefined,
        scheduledSlotEnd: truckingLoad.scheduled_slot_end ?? undefined,
        pickupLocation: (truckingLoad.pickup_location as Record<string, unknown> | null) ?? null,
        deliveryLocation: (truckingLoad.delivery_location as Record<string, unknown> | null) ?? null,
        assetName: truckingLoad.asset_name ?? null,
        wellpadName: truckingLoad.wellpad_name ?? null,
        wellName: truckingLoad.well_name ?? null,
        uwi: truckingLoad.uwi ?? null,
        truckingCompany: truckingLoad.trucking_company ?? null,
        contactCompany: truckingLoad.contact_company ?? null,
        contactName: truckingLoad.contact_name ?? null,
        contactPhone: truckingLoad.contact_phone ?? null,
        contactEmail: truckingLoad.contact_email ?? null,
        driverName: truckingLoad.driver_name ?? null,
        driverPhone: truckingLoad.driver_phone ?? null,
        notes: truckingLoad.notes ?? null,
        totalJointsPlanned: truckingLoad.total_joints_planned ?? null,
        totalLengthFtPlanned: truckingLoad.total_length_ft_planned ?? null,
        totalWeightLbsPlanned: truckingLoad.total_weight_lbs_planned ?? null,
        totalJointsCompleted: truckingLoad.total_joints_completed ?? null,
        totalLengthFtCompleted: truckingLoad.total_length_ft_completed ?? null,
        totalWeightLbsCompleted: truckingLoad.total_weight_lbs_completed ?? null,
        approvedAt: truckingLoad.approved_at ?? null,
        completedAt: truckingLoad.completed_at ?? null,
        createdAt: truckingLoad.created_at,
        updatedAt: truckingLoad.updated_at,
        documents: [],
      };

      const truckingDocuments = await uploadDocumentsForShipment(
        shipment.id,
        truck?.id ?? null,
        truckingLoadId
      );

      if (newTruckingLoad) {
        const existingDocs = newTruckingLoad.documents ?? [];
        newTruckingLoad = {
          ...newTruckingLoad,
          documents: [...existingDocs, ...truckingDocuments],
        };
      }

      try {
        await sendInboundDeliveryNotification({
          referenceId: request.referenceId,
          companyName: session.company.name,
          contactEmail: session.userId,
          slotStart: slotStartIso,
          slotEnd: slotEndIso,
          isAfterHours: selectedTimeSlot.is_after_hours,
          surchargeAmount: selectedTimeSlot.surcharge_amount,
          storage: {
            companyName: storageData.storageCompanyName,
            address: storageData.storageYardAddress,
            contactName: storageData.storageContactName,
            contactPhone: storageData.storageContactPhone,
            contactEmail: storageData.storageContactEmail,
          },
          trucking: {
            companyName: truckingData.truckingCompanyName,
            driverName: truckingData.driverName,
            driverPhone: truckingData.driverPhone,
          },
          loadSummary,
        });

        // Send simplified booking confirmation notification
        await sendLoadBookingConfirmation({
          customerName: session.userEmail, // Using email as name since we don't have full name in context
          companyName: session.company.name,
          loadNumber: nextSequenceNumber,
          deliveryDate: selectedTimeSlot.start.toISOString(),
          deliveryTimeStart: selectedTimeSlot.start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          deliveryTimeEnd: selectedTimeSlot.end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          isAfterHours: selectedTimeSlot.is_after_hours,
          referenceId: request.referenceId || request.id
        });
      } catch (notifyError) {
        console.error('Failed to send delivery notification:', notifyError);
      }

      const baseMessage = selectedTimeSlot.is_after_hours
        ? 'Delivery submitted. MPS will confirm the after-hours slot shortly.'
        : 'Delivery successfully scheduled!';
      const docReminder =
        truckingDocuments.length === 0
          ? ' Upload your manifest documents before booking another load.'
          : '';

      setStep('confirmation');
      setStatusMessage(`${baseMessage}${docReminder}`);

      if (onDeliveryScheduled) {
        onDeliveryScheduled(
          buildUpdatedRequest(deliveryStatusForRequest, slotStartIso, slotEndIso, shipment.id, newTruckingLoad)
        );
      }
    } catch (error: any) {
      if (schemaMissing(error)) {
        await notifyFallback();
      } else {
        console.error('Failed to save delivery:', error);
        setErrorMessage(error?.message || 'Failed to schedule delivery. Please try again.');
      }
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
            {/* Sequential Load Blocking UI */}
            {isCheckingPendingLoad ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <Spinner className="w-6 h-6" />
                  <span className="text-gray-400">Checking for pending loads...</span>
                </div>
              </div>
            ) : pendingLoad ? (
              <div className="bg-orange-900/20 border-2 border-orange-500/50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  {/* Warning Icon */}
                  <div className="flex-shrink-0">
                    <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>

                  {/* Blocking Message */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-orange-200 mb-2">
                      Load #{(pendingLoad as any).sequence_number} Pending Admin Approval
                    </h3>
                    <p className="text-gray-300 mb-4">
                      Your previous load is awaiting admin review and approval. You can schedule Load #
                      {((pendingLoad as any).sequence_number || 0) + 1} after Load #{(pendingLoad as any).sequence_number} has been approved.
                    </p>

                    {/* Pending Load Details */}
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Pending Load Details</p>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-gray-500 text-xs">Load Number</dt>
                          <dd className="text-white font-semibold">#{(pendingLoad as any).sequence_number}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 text-xs">Scheduled Date</dt>
                          <dd className="text-white">
                            {new Date((pendingLoad as any).scheduled_slot_start).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 text-xs">Scheduled Time</dt>
                          <dd className="text-white">
                            {new Date((pendingLoad as any).scheduled_slot_start).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500 text-xs">Status</dt>
                          <dd>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300 border border-yellow-500/30">
                              Pending Review
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* What Happens Next */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        What happens next?
                      </h4>
                      <ul className="space-y-1 text-sm text-gray-300">
                        <li className="flex items-start gap-2">
                          <span className="text-cyan-400 mt-0.5">1.</span>
                          <span>MPS admin will review your manifest and load details</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-cyan-400 mt-0.5">2.</span>
                          <span>You'll receive a Slack notification once approved</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-cyan-400 mt-0.5">3.</span>
                          <span>After approval, you can return here to schedule your next load</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Back Button */}
                <div className="flex justify-start pt-4 mt-4 border-t border-gray-700">
                  <Button
                    type="button"
                    onClick={onBack}
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    Return to Dashboard
                  </Button>
                </div>
              </div>
            ) : (
              // No pending loads - show normal time slot picker
              <>
                <TimeSlotPicker
                  selectedSlot={selectedTimeSlot}
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
                  <div className="flex flex-col items-end gap-2">
                    {selectedTimeSlot?.is_after_hours && (
                      <span className="text-xs text-yellow-300">
                        After-hours deliveries include a ${selectedTimeSlot.surcharge_amount} surcharge and require confirmation.
                      </span>
                    )}
                    <Button
                      onClick={handleTimeSlotContinue}
                      disabled={!selectedTimeSlot}
                      className="bg-red-600 hover:bg-red-500 px-8 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Continue to Documents
                    </Button>
                  </div>
                </div>
              </>
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
              onSkip={handleSkipDocuments}
            />

            {/* Skip Documents Info */}
            {uploadedDocuments.length === 0 && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-gray-300">
                    <p className="font-semibold text-white mb-1">Don't have documents ready?</p>
                    <p>
                      You can skip this step and upload your manifest later from your dashboard.
                      However, uploading now helps us prepare for your arrival.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => setStep('timeslot')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                Back
              </Button>
              <div className="flex gap-3">
                {uploadedDocuments.length === 0 && (
                  <Button
                    onClick={handleSkipDocuments}
                    className="bg-gray-700 hover:bg-gray-600 px-6"
                  >
                    Skip for Now
                  </Button>
                )}
                <Button
                  onClick={handleDocumentsContinue}
                  disabled={!hasCompletedDocuments || isProcessingManifest}
                  className="bg-red-600 hover:bg-red-500 px-8 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isProcessingManifest ? 'Processing...' : 'Continue to Review'}
                </Button>
              </div>
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
              onVerify={handleReviewConfirm}
              onReportIssue={handleReportIssue}
              isConfirming={isSaving}
            />

            {/* Action Buttons */}
            <div className="flex justify-start pt-4 border-t border-gray-700">
              <Button
                type="button"
                onClick={() => setStep('documents')}
                disabled={isSaving}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Back
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






