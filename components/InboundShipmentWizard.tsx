import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import clsx from 'clsx';
import GlassCard from './ui/GlassCard';
import GlassButton from './ui/GlassButton';
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
    <div className="flex items-center justify-between gap-2 mb-8 overflow-x-auto pb-4 pt-2 px-2">
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;
        return (
          <div key={step.key} className="flex items-center shrink-0 relative">
            <div className="flex flex-col items-center relative z-10">
              <div
                className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-bold transition-all duration-300 shadow-lg backdrop-blur-md',
                  isActive && 'border-cyan-500 text-white bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-110',
                  isCompleted && 'border-emerald-500 text-white bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
                  !isActive && !isCompleted && 'border-slate-700 text-slate-500 bg-slate-800/50'
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
              <span className={clsx(
                "mt-2 text-xs text-center font-medium max-w-[80px] transition-colors duration-300",
                isActive ? "text-cyan-400" : isCompleted ? "text-emerald-400" : "text-slate-500"
              )}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={clsx(
                'w-12 h-0.5 mx-2 transition-all duration-500 rounded-full',
                idx < currentIndex ? 'bg-linear-to-r from-emerald-600 to-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-slate-700'
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        companyName: request.requestDetails?.companyName || 'Unknown Company',
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
              address: 'E Range Rd #3264, Pierceland, SK S0M 2K0',
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
    <GlassCard className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl max-w-5xl mx-auto animate-slide-up">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-700/50 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Schedule Delivery to MPS</h2>
          <p className="text-sm text-slate-400 mt-1">
            Request <span className="text-indigo-400 font-mono">{request.referenceId}</span> • {request.requestDetails?.itemType ?? 'Pipe'}
          </p>
        </div>
        <GlassButton onClick={onBack} variant="secondary" className="px-4 py-2">
          Back to Menu
        </GlassButton>
      </div>

      <StepIndicator current={step} truckingMethod={selectedTruckingMethod} />

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

      {isCheckingPendingLoad ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          {step === 'storage' && (
            <div className="space-y-8 animate-slide-up">
              <StorageYardStep
                register={storageForm.register}
                errors={storageForm.formState.errors}
              />
              <div className="flex justify-between pt-6 border-t border-slate-700/50">
                <GlassButton
                  type="button"
                  onClick={onBack}
                  variant="secondary"
                >
                  Back to Menu
                </GlassButton>
                <GlassButton
                  onClick={storageForm.handleSubmit(handleStorageSubmit)}
                  className="px-8 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)]"
                >
                  Continue
                </GlassButton>
              </div>
            </div>
          )}

          {step === 'method' && (
            <div className="space-y-8 animate-slide-up">
              <TruckingMethodStep
                selectedMethod={selectedTruckingMethod}
                onSelectMethod={handleMethodSelect}
              />
              <div className="flex justify-start pt-6 border-t border-slate-700/50">
                <GlassButton
                  type="button"
                  onClick={() => setStep('storage')}
                  variant="secondary"
                >
                  Back
                </GlassButton>
              </div>
            </div>
          )}

          {step === 'trucking' && (
            <div className="space-y-8 animate-slide-up">
              <TruckingDriverStep
                register={truckingForm.register}
                errors={truckingForm.formState.errors}
                storageCompanyName={storageData?.storageCompanyName}
              />
              <div className="flex justify-between pt-6 border-t border-slate-700/50">
                <GlassButton
                  type="button"
                  onClick={() => setStep('method')}
                  variant="secondary"
                >
                  Back
                </GlassButton>
                <GlassButton
                  onClick={truckingForm.handleSubmit(handleTruckingSubmit)}
                  className="px-8 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)]"
                >
                  Continue
                </GlassButton>
              </div>
            </div>
          )}

          {step === 'quote-pending' && (
            <div className="py-12 animate-slide-up">
              <div className="text-center max-w-2xl mx-auto space-y-8">
                <div className="w-24 h-24 bg-blue-600/20 border-2 border-blue-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                  <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-3xl font-bold text-white mb-3">Quote Requested</h3>
                  <p className="text-slate-400 text-lg">
                    We've received your request for an MPS trucking quote.
                  </p>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-left">
                  <h4 className="text-base font-bold text-white mb-4">What happens next?</h4>
                  <ul className="space-y-3 text-sm text-slate-300">
                    <li className="flex items-start gap-3">
                      <span className="text-blue-400 mt-0.5 font-bold">✓</span>
                      <span>MPS logistics team will review your location and load details</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-400 mt-0.5 font-bold">✓</span>
                      <span>You'll receive a quote (PV-XXXX) within 24-48 hours</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-blue-400 mt-0.5 font-bold">✓</span>
                      <span>Once approved, we'll handle all transportation logistics</span>
                    </li>
                  </ul>
                </div>

                <div className="flex justify-center pt-6">
                  <GlassButton
                    onClick={onBack}
                    variant="secondary"
                    className="px-8"
                  >
                    Back to Dashboard
                  </GlassButton>
                </div>

                {quoteId && (
                  <div className="text-xs text-slate-500 pt-4">
                    Quote Reference: <span className="text-slate-400 font-mono">{quoteId}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'timeslot' && (
            <div className="space-y-8 animate-slide-up">
              <TimeSlotPicker
                selectedSlot={selectedTimeSlot}
                onSelectSlot={handleTimeSlotSelect}
                blockedSlots={[]}
              />
              <div className="flex justify-between pt-6 border-t border-slate-700/50">
                <GlassButton
                  type="button"
                  onClick={() => setStep('trucking')}
                  variant="secondary"
                >
                  Back
                </GlassButton>
                <div className="flex flex-col items-end gap-2">
                  {selectedTimeSlot?.is_after_hours && (
                    <span className="text-xs text-yellow-300 font-medium bg-yellow-900/30 px-2 py-1 rounded">
                      After-hours: ${selectedTimeSlot.surcharge_amount} surcharge
                    </span>
                  )}
                  <GlassButton
                    onClick={handleTimeSlotContinue}
                    disabled={!selectedTimeSlot}
                    className="px-8 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)]"
                  >
                    Continue to Documents
                  </GlassButton>
                </div>
              </div>
            </div>
          )}

        {step === 'documents' && (
          <div className="space-y-8 animate-slide-up">
            <DocumentUploadStep
              onFilesSelected={handleFilesSelected}
              uploadedDocuments={uploadedDocuments}
              onRemoveDocument={handleRemoveDocument}
              isProcessing={isProcessingManifest}
              onSkip={handleSkipDocuments}
            />

            {uploadedDocuments.length === 0 && (
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <svg className="w-6 h-6 text-indigo-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-slate-300">
                    <p className="font-bold text-white mb-1">Don't have documents ready?</p>
                    <p>
                      You can skip this step and upload your manifest later from your dashboard.
                      However, uploading now helps us prepare for your arrival.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t border-slate-700/50">
              <GlassButton
                type="button"
                onClick={() => setStep('timeslot')}
                variant="secondary"
              >
                Back
              </GlassButton>
              <div className="flex gap-4">
                {uploadedDocuments.length === 0 && (
                  <GlassButton
                    onClick={handleSkipDocuments}
                    variant="secondary"
                  >
                    Skip for Now
                  </GlassButton>
                )}
                <GlassButton
                  onClick={handleDocumentsContinue}
                  disabled={!hasCompletedDocuments || isProcessingManifest}
                  className="px-8 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)]"
                >
                  {isProcessingManifest ? 'Processing...' : 'Continue to Review'}
                </GlassButton>
              </div>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-8 animate-slide-up">
            {/* Delivery Summary */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 space-y-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Delivery Summary
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                <div>
                  <p className="text-slate-400 mb-1 uppercase tracking-wider text-xs">Storage Company</p>
                  <p className="text-white font-medium text-lg">{storageData?.storageCompanyName}</p>
                  <p className="text-slate-500 mt-1">{storageData?.storageYardAddress}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1 uppercase tracking-wider text-xs">Storage Contact</p>
                  <p className="text-white font-medium text-lg">{storageData?.storageContactName}</p>
                  <p className="text-slate-500 mt-1">{storageData?.storageContactEmail}</p>
                  <p className="text-slate-500">{storageData?.storageContactPhone}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1 uppercase tracking-wider text-xs">Trucking Company</p>
                  <p className="text-white font-medium text-lg">{truckingData?.truckingCompanyName}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-1 uppercase tracking-wider text-xs">Driver</p>
                  <p className="text-white font-medium text-lg">{truckingData?.driverName}</p>
                  <p className="text-slate-500 mt-1">{truckingData?.driverPhone}</p>
                </div>
                <div className="col-span-2 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <p className="text-slate-400 mb-1 uppercase tracking-wider text-xs">Delivery Time</p>
                  <p className="text-white font-medium text-xl">
                    {selectedTimeSlot?.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-indigo-400 font-mono mt-1 text-lg">
                    {selectedTimeSlot?.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {' - '}
                    {selectedTimeSlot?.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
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
            <div className="flex justify-start pt-6 border-t border-slate-700/50">
              <GlassButton
                type="button"
                onClick={() => setStep('documents')}
                disabled={isSaving}
                variant="secondary"
              >
                Back
              </GlassButton>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="py-12 animate-slide-up">
            <div className="text-center max-w-2xl mx-auto space-y-8">
              {/* Success Icon */}
              <div className="w-24 h-24 bg-green-600/20 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h3 className="text-3xl font-bold text-white mb-3">Delivery Scheduled!</h3>
                <p className="text-slate-400 text-lg">
                  Your delivery to MPS has been successfully scheduled for{' '}
                  <strong className="text-white">
                    {selectedTimeSlot?.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </strong>
                </p>
              </div>

              {/* Next Steps */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-left">
                <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  What happens next?
                </h4>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5 font-bold">✓</span>
                    <span>MPS admin will review and verify your manifest details</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5 font-bold">✓</span>
                    <span>You'll receive a calendar invite (.ics file) via email</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5 font-bold">✓</span>
                    <span>Our team has been notified via Slack</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5 font-bold">✓</span>
                    <span>Yard crew will be ready to receive your delivery</span>
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-4 justify-center pt-6">
                <GlassButton
                  onClick={onBack}
                  variant="secondary"
                  className="px-8"
                >
                  Return to Dashboard
                </GlassButton>
                <GlassButton
                  onClick={() => window.print()}
                  className="px-8"
                >
                  Print Confirmation
                </GlassButton>
              </div>

              {/* Reference Number */}
              {deliveryId && (
                <div className="text-xs text-slate-500 pt-4">
                  Delivery Reference: <span className="text-slate-400 font-mono">{deliveryId}</span>
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}
    </GlassCard>
  );
};

export default InboundShipmentWizard;
