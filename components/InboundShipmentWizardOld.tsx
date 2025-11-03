import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useForm } from 'react-hook-form';
import { addMinutes, format, isWeekend } from 'date-fns';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import type {
  Session,
  StorageRequest,
  Shipment,
  ShipmentTruck,
  ShipmentDocument,
} from '../types';
import { supabase } from '../lib/supabase';
import {
  useShipmentsByRequest,
  useCreateShipment,
  useUpdateShipment,
  useAddShipmentTruck,
  useUpdateShipmentTruck,
  useDeleteShipmentTruck,
  useCreateDockAppointment,
  useUpdateDockAppointment,
  useDeleteDockAppointment,
  useAddShipmentDocument,
  useAddShipmentItem,
} from '../hooks/useSupabaseData';

type WizardStep = 'method' | 'details' | 'schedule';

interface InboundShipmentWizardProps {
  request: StorageRequest;
  session: Session;
  onBack: () => void;
}

interface TruckingDetailsForm {
  truckingCompany: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  numberOfTrucks: number;
  specialInstructions?: string;
}

interface TruckSchedulePayload {
  truckId: string;
  shipmentId: string;
  appointmentId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  jointsCount?: number | null;
  totalLengthFt?: number | null;
  manifestReceived?: boolean | null;
  notes?: string | null;
  slotStartIso?: string | null;
  slotEndIso?: string | null;
  afterHours: boolean;
}

const BUSINESS_TIME_SLOTS = (() => {
  const slots: string[] = [];
  let minutes = 7 * 60;
  const end = 16 * 60 + 30;
  while (minutes <= end) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    minutes += 30;
  }
  return slots;
})();

const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-300 mb-2">
    {children}
  </label>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input
    {...props}
    className={clsx(
      'w-full bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60',
      className,
    )}
  />
);

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea
    {...props}
    className={clsx(
      'w-full bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60',
      className,
    )}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
  <select
    {...props}
    className={clsx(
      'w-full bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60',
      className,
    )}
  >
    {children}
  </select>
);

const StepIndicator: React.FC<{ current: WizardStep }> = ({ current }) => {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: 'method', label: 'Shipping Method' },
    { key: 'details', label: 'Trucking Details' },
    { key: 'schedule', label: 'Schedule & Documents' },
  ];

  const currentIndex = steps.findIndex(step => step.key === current);

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      {steps.map((step, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;
        return (
          <div key={step.key} className="flex-1 flex items-center">
            <div
              className={clsx(
                'flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold',
                isActive && 'border-red-400 text-red-200 bg-red-500/10',
                isCompleted && 'border-green-400 text-green-200 bg-green-500/10',
                !isActive && !isCompleted && 'border-gray-600 text-gray-400 bg-gray-800',
              )}
            >
              {idx + 1}
            </div>
            <span className="ml-3 text-xs uppercase tracking-wide text-gray-400">{step.label}</span>
            {idx < steps.length - 1 && <div className="flex-1 h-px bg-gray-700 ml-3" />}
          </div>
        );
      })}
    </div>
  );
};

const isAfterHoursSlot = (slotStart: Date) => {
  const weekend = isWeekend(slotStart);
  if (weekend) return true;
  const minutes = slotStart.getHours() * 60 + slotStart.getMinutes();
  const businessStart = 7 * 60;
  const businessEnd = 16 * 60 + 30;
  return minutes < businessStart || minutes > businessEnd;
};

const buildTimeIsoRange = (date: string, time: string) => {
  if (!date || !time) return { start: null, end: null };
  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime())) return { start: null, end: null };
  const end = addMinutes(start, 30);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

const deriveDateParts = (iso?: string | null) => {
  if (!iso) return { date: '', time: '' };
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return { date: '', time: '' };
  return {
    date: format(value, 'yyyy-MM-dd'),
    time: format(value, 'HH:mm'),
  };
};

const TruckDocuments: React.FC<{
  documents: ShipmentDocument[];
  onPreview: (doc: ShipmentDocument) => Promise<void>;
}> = ({ documents, onPreview }) => {
  if (!documents.length) return null;

  return (
    <div className="mt-4 border border-gray-700 rounded-lg bg-gray-900/60">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Uploaded Documents</h4>
        <span className="text-xs text-gray-500">{documents.length} file{documents.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="divide-y divide-gray-800">
        {documents.map(doc => (
          <li key={doc.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">
                {doc.fileName || doc.documentType}
              </p>
              <p className="text-xs text-gray-500">
                Status: {doc.status} &middot; Uploaded{' '}
                {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'MMM d, yyyy p') : 'recently'}
              </p>
            </div>
            <Button
              onClick={() => onPreview(doc)}
              className="bg-gray-700 hover:bg-gray-600 text-sm px-3 py-1.5"
            >
              View
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const TruckScheduleCard: React.FC<{
  shipment: Shipment;
  truck: ShipmentTruck;
  generalContact: Pick<TruckingDetailsForm, 'truckingCompany' | 'contactName' | 'contactPhone' | 'contactEmail'>;
  onSave: (payload: TruckSchedulePayload) => Promise<void>;
  onUploadDocuments: (truckId: string | null, files: FileList) => Promise<void>;
  onPreviewDocument: (doc: ShipmentDocument) => Promise<void>;
  busy: boolean;
}> = ({ shipment, truck, generalContact, onSave, onUploadDocuments, onPreviewDocument, busy }) => {
  const [contactName, setContactName] = useState(truck.contactName || generalContact.contactName);
  const [contactPhone, setContactPhone] = useState(truck.contactPhone || generalContact.contactPhone);
  const [contactEmail, setContactEmail] = useState(truck.contactEmail || generalContact.contactEmail);
  const [jointsCount, setJointsCount] = useState<number | ''>(truck.jointsCount ?? '');
  const [totalLengthFt, setTotalLengthFt] = useState<number | ''>(truck.totalLengthFt ?? '');
  const [notes, setNotes] = useState(truck.notes ?? '');
  const [manifestReceived, setManifestReceived] = useState(Boolean(truck.manifestReceived));

  const appointment = truck.appointment;
  const derived = deriveDateParts(appointment?.slotStart);
  const [date, setDate] = useState(derived.date);
  const [time, setTime] = useState(derived.time && BUSINESS_TIME_SLOTS.includes(derived.time) ? derived.time : '');
  const [customTime, setCustomTime] = useState(derived.time && !BUSINESS_TIME_SLOTS.includes(derived.time) ? derived.time : '');
  const [afterHoursToggle, setAfterHoursToggle] = useState(
    Boolean(appointment?.afterHours || (derived.time && !BUSINESS_TIME_SLOTS.includes(derived.time))),
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setContactName(truck.contactName || generalContact.contactName);
    setContactPhone(truck.contactPhone || generalContact.contactPhone);
    setContactEmail(truck.contactEmail || generalContact.contactEmail);
    setJointsCount(truck.jointsCount ?? '');
    setTotalLengthFt(truck.totalLengthFt ?? '');
    setNotes(truck.notes ?? '');
    setManifestReceived(Boolean(truck.manifestReceived));

    const updated = deriveDateParts(truck.appointment?.slotStart);
    if (updated.date) setDate(updated.date);
    if (updated.time && BUSINESS_TIME_SLOTS.includes(updated.time)) {
      setTime(updated.time);
      setCustomTime('');
      setAfterHoursToggle(Boolean(truck.appointment?.afterHours));
    } else if (updated.time) {
      setCustomTime(updated.time);
      setTime('');
      setAfterHoursToggle(true);
    }
  }, [truck, generalContact]);

  const selectedTime = afterHoursToggle ? customTime : time;
  const { start: slotStartIso, end: slotEndIso } = buildTimeIsoRange(date, selectedTime || time);
  const autoAfterHours = slotStartIso ? isAfterHoursSlot(new Date(slotStartIso)) : false;
  const finalAfterHours = afterHoursToggle || autoAfterHours;

  const documentsForTruck = useMemo<ShipmentDocument[]>(() => {
    const withDocs = shipment.documents ?? [];
    return withDocs.filter(doc => doc.truckId === truck.id);
  }, [shipment.documents, truck.id]);

  const handleSave = async () => {
    await onSave({
      truckId: truck.id,
      shipmentId: shipment.id,
      appointmentId: appointment?.id,
      contactName,
      contactPhone,
      contactEmail,
      jointsCount: jointsCount === '' ? null : jointsCount,
      totalLengthFt: totalLengthFt === '' ? null : totalLengthFt,
      manifestReceived,
      notes: notes || null,
      slotStartIso,
      slotEndIso,
      afterHours: finalAfterHours,
    });
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      await onUploadDocuments(truck.id, event.target.files);
      event.target.value = '';
    } catch (error: any) {
      setUploadError(error.message || 'Unable to upload documents right now.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="bg-gray-900/70 border border-gray-800 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Truck</p>
          <h3 className="text-lg font-semibold text-white">Truck #{truck.sequenceNumber}</h3>
        </div>
        <span
          className={clsx(
            'px-3 py-1 text-xs rounded-full border',
            finalAfterHours ? 'border-yellow-400 text-yellow-200' : 'border-green-400 text-green-200',
          )}
        >
          {finalAfterHours ? 'After Hours Request' : truck.status || 'Pending'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`contact-name-${truck.id}`}>On-Site Contact Name</Label>
          <Input
            id={`contact-name-${truck.id}`}
            value={contactName}
            onChange={event => setContactName(event.target.value)}
            placeholder="Contact arriving with the truck"
          />
        </div>
        <div>
          <Label htmlFor={`contact-phone-${truck.id}`}>Contact Phone</Label>
          <Input
            id={`contact-phone-${truck.id}`}
            value={contactPhone}
            onChange={event => setContactPhone(event.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>
        <div>
          <Label htmlFor={`contact-email-${truck.id}`}>Contact Email</Label>
          <Input
            id={`contact-email-${truck.id}`}
            type="email"
            value={contactEmail}
            onChange={event => setContactEmail(event.target.value)}
            placeholder="contact@email.com"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`joints-${truck.id}`}>Estimated Joints on Truck</Label>
            <Input
              id={`joints-${truck.id}`}
              type="number"
              min={0}
              value={jointsCount}
              onChange={event => setJointsCount(event.target.value === '' ? '' : Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor={`length-${truck.id}`}>Total Tally Length (ft)</Label>
            <Input
              id={`length-${truck.id}`}
              type="number"
              min={0}
              step="0.1"
              value={totalLengthFt}
              onChange={event => setTotalLengthFt(event.target.value === '' ? '' : Number(event.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor={`date-${truck.id}`}>Delivery Date</Label>
          <Input
            id={`date-${truck.id}`}
            type="date"
            value={date}
            min={format(new Date(), 'yyyy-MM-dd')}
            onChange={event => setDate(event.target.value)}
          />
        </div>
        <div>
          <Label>Delivery Time</Label>
          {afterHoursToggle ? (
            <Input
              type="time"
              step={1800}
              value={customTime}
              onChange={event => setCustomTime(event.target.value)}
            />
          ) : (
            <Select value={time} onChange={event => setTime(event.target.value)}>
              <option value="">Select a time slot</option>
              {BUSINESS_TIME_SLOTS.map(slot => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={afterHoursToggle}
              onChange={event => setAfterHoursToggle(event.target.checked)}
              className="h-4 w-4 text-red-500 focus:ring-red-500 border-gray-600 rounded"
            />
            Request After-Hours / Weekend Delivery
          </label>
        </div>
      </div>

      {finalAfterHours && (
        <div className="mt-4 p-3 rounded-md bg-yellow-500/10 border border-yellow-400/40 text-sm text-yellow-100">
          After-hours or weekend deliveries incur a $450 unloading surcharge. Our team will confirm availability.
        </div>
      )}

      <div className="mt-6">
        <Label htmlFor={`notes-${truck.id}`}>Special Notes</Label>
        <Textarea
          id={`notes-${truck.id}`}
          rows={3}
          value={notes}
          placeholder="Add manifest references or handling instructions for this truck."
          onChange={event => setNotes(event.target.value)}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          id={`manifest-${truck.id}`}
          type="checkbox"
          checked={manifestReceived}
          onChange={event => setManifestReceived(event.target.checked)}
          className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-600 rounded"
        />
        <label htmlFor={`manifest-${truck.id}`} className="text-sm text-gray-200">
          Manifest has been uploaded for this truck
        </label>
      </div>

      <div className="mt-6">
        <p className="text-sm text-gray-300 mb-2">Upload Shipping Documents (PDF, JPG, PNG)</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleFileInput}
            disabled={uploading}
            className="sm:w-72"
          />
          {uploading && <Spinner size="sm" />}
          {uploadError && <span className="text-xs text-red-400">{uploadError}</span>}
        </div>
      </div>

      <TruckDocuments documents={documentsForTruck} onPreview={onPreviewDocument} />

      <div className="mt-6 flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={busy || uploading || !date || (!time && !customTime)}
          className="bg-red-600 hover:bg-red-500 disabled:opacity-60"
        >
          {busy ? 'Saving...' : 'Save Truck Schedule'}
        </Button>
      </div>
    </Card>
  );
};

const InboundShipmentWizard: React.FC<InboundShipmentWizardProps> = ({ request, session, onBack }) => {
  const [step, setStep] = useState<WizardStep>('method');
  const [shippingMethod, setShippingMethod] = useState<'CUSTOMER_PROVIDED' | 'MPS_QUOTE' | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: shipments = [], isLoading, refetch } = useShipmentsByRequest(request.id);

  const activeShipment = useMemo<Shipment | undefined>(() => {
    if (selectedShipmentId) {
      return shipments.find(item => item.id === selectedShipmentId);
    }
    return shipments[0];
  }, [shipments, selectedShipmentId]);

  useEffect(() => {
    if (!selectedShipmentId && shipments.length) {
      setSelectedShipmentId(shipments[0].id);
    }
  }, [shipments, selectedShipmentId]);

  const truckingForm = useForm<TruckingDetailsForm>({
    defaultValues: {
      truckingCompany: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      numberOfTrucks: 1,
      specialInstructions: '',
    },
  });

  useEffect(() => {
    if (!activeShipment) return;
    setShippingMethod(activeShipment.truckingMethod);
    setStep('schedule');
    truckingForm.reset({
      truckingCompany: activeShipment.truckingCompany ?? '',
      contactName: activeShipment.truckingContactName ?? '',
      contactPhone: activeShipment.truckingContactPhone ?? '',
      contactEmail: activeShipment.truckingContactEmail ?? '',
      numberOfTrucks: activeShipment.numberOfTrucks ?? 1,
      specialInstructions: activeShipment.specialInstructions ?? '',
    });
  }, [activeShipment, truckingForm]);

  const truckingCompanyWatch = truckingForm.watch('truckingCompany');
  const contactNameWatch = truckingForm.watch('contactName');
  const contactPhoneWatch = truckingForm.watch('contactPhone');
  const contactEmailWatch = truckingForm.watch('contactEmail');
  const numberOfTrucksWatch = truckingForm.watch('numberOfTrucks');

  const generalContactDefaults = useMemo(
    () => ({
      truckingCompany: truckingCompanyWatch,
      contactName: contactNameWatch,
      contactPhone: contactPhoneWatch,
      contactEmail: contactEmailWatch,
    }),
    [truckingCompanyWatch, contactNameWatch, contactPhoneWatch, contactEmailWatch],
  );

  const createShipment = useCreateShipment();
  const updateShipment = useUpdateShipment();
  const addShipmentTruck = useAddShipmentTruck();
  const updateShipmentTruck = useUpdateShipmentTruck();
  const deleteShipmentTruck = useDeleteShipmentTruck();
  const createDockAppointment = useCreateDockAppointment();
  const updateDockAppointment = useUpdateDockAppointment();
  const deleteDockAppointment = useDeleteDockAppointment();
  const addShipmentDocument = useAddShipmentDocument();
  const addShipmentItem = useAddShipmentItem();

  const isSaving =
    createShipment.isPending ||
    updateShipment.isPending ||
    addShipmentTruck.isPending ||
    updateShipmentTruck.isPending ||
    deleteShipmentTruck.isPending ||
    createDockAppointment.isPending ||
    updateDockAppointment.isPending ||
    deleteDockAppointment.isPending ||
    addShipmentDocument.isPending ||
    addShipmentItem.isPending;

  const handleShippingMethodSelect = (method: 'CUSTOMER_PROVIDED' | 'MPS_QUOTE') => {
    setShippingMethod(method);
    if (method === 'CUSTOMER_PROVIDED') {
      setStep('details');
    } else {
      setErrorMessage('MPS-managed trucking is coming soon. Please choose the self-managed option for now.');
    }
  };

  const syncShipmentCounts = async (shipmentRecord: Shipment, targetCount: number, details: TruckingDetailsForm) => {
    const existingTrucks = shipmentRecord.trucks ?? [];
    if (existingTrucks.length < targetCount) {
      const createList: Promise<unknown>[] = [];
      for (let i = existingTrucks.length; i < targetCount; i += 1) {
        createList.push(
          addShipmentTruck.mutateAsync({
            shipmentId: shipmentRecord.id,
            sequenceNumber: i + 1,
            status: 'PENDING',
            truckingCompany: details.truckingCompany,
            contactName: details.contactName,
            contactPhone: details.contactPhone,
            contactEmail: details.contactEmail,
          }),
        );
      }
      await Promise.all(createList);
    } else if (existingTrucks.length > targetCount) {
      const trucksDescending = [...existingTrucks].sort((a, b) => b.sequenceNumber - a.sequenceNumber);
      const toRemove = trucksDescending.slice(0, existingTrucks.length - targetCount);
      for (const truck of toRemove) {
        if (truck.appointment?.id) {
          await deleteDockAppointment.mutateAsync({ id: truck.appointment.id, shipmentId: shipmentRecord.id });
        }
        await deleteShipmentTruck.mutateAsync({ id: truck.id, shipmentId: shipmentRecord.id });
      }
    }
  };

  const handleTruckingDetailsSubmit = async (values: TruckingDetailsForm) => {
    if (!shippingMethod) {
      setErrorMessage('Select a shipping method to continue.');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    try {
      let shipmentRecord = activeShipment;
      const shipmentPayload = {
        truckingCompany: values.truckingCompany,
        truckingContactName: values.contactName,
        truckingContactPhone: values.contactPhone,
        truckingContactEmail: values.contactEmail,
        numberOfTrucks: values.numberOfTrucks,
        specialInstructions: values.specialInstructions ?? null,
      };

      if (shipmentRecord) {
        shipmentRecord = await updateShipment.mutateAsync({
          id: shipmentRecord.id,
          updates: {
            ...shipmentPayload,
          },
        });
      } else {
        shipmentRecord = await createShipment.mutateAsync({
          requestId: request.id,
          companyId: request.companyId,
          createdBy: session.userId,
          truckingMethod: 'CUSTOMER_PROVIDED',
          numberOfTrucks: values.numberOfTrucks,
          truckingCompany: values.truckingCompany,
          truckingContactName: values.contactName,
          truckingContactPhone: values.contactPhone,
          truckingContactEmail: values.contactEmail,
          specialInstructions: values.specialInstructions ?? null,
          estimatedJointCount: request.requestDetails?.totalJoints ?? null,
          estimatedTotalLengthFt: null,
        });
      }

      if (!shipmentRecord) {
        throw new Error('Unable to load shipment after saving.');
      }

      await syncShipmentCounts(shipmentRecord, values.numberOfTrucks, values);
      await refetch();

      setSelectedShipmentId(shipmentRecord.id);
      setStatusMessage('Trucking details saved successfully.');
      setStep('schedule');
    } catch (error: any) {
      console.error('Failed to save trucking details', error);
      setErrorMessage(error.message || 'Unable to save trucking details right now.');
    }
  };

  const handlePreviewDocument = async (doc: ShipmentDocument) => {
    if (!doc.storagePath) {
      setErrorMessage('Document path missing. Please contact support.');
      return;
    }
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storagePath, 300);
    if (error || !data?.signedUrl) {
      setErrorMessage('Unable to open document preview.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const handleUploadDocuments = async (truckId: string | null, files: FileList) => {
    const shipmentRecord = activeShipment;
    if (!shipmentRecord) throw new Error('Save shipment details before uploading documents.');

    const uploads = Array.from(files);
    if (!uploads.length) return;

    for (const file of uploads) {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`"${file.name}" exceeds the 10MB limit.`);
      }
    }

    const safeName = (original: string) => original.replace(/\s+/g, '_').replace(/[^\w.-]/g, '').toLowerCase();

    for (const file of uploads) {
      const uniqueName = `${Date.now()}-${safeName(file.name)}`;
      const path = `${request.companyId}/${request.referenceId}/shipments/${shipmentRecord.id}/${truckId ?? 'shipment'}/${uniqueName}`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (storageError || !storageData?.path) {
        throw new Error(storageError?.message || `Unable to upload ${file.name}`);
      }

      try {
        const { data: documentRow, error: documentError } = await supabase
          .from('documents')
          .insert({
            company_id: request.companyId,
            request_id: request.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: storageData.path,
            extracted_data: null,
            is_processed: false,
          })
          .select('*')
          .single();

        if (documentError || !documentRow) {
          throw new Error(documentError?.message || 'Unable to register document.');
        }

        const shipmentDocument = await addShipmentDocument.mutateAsync({
          shipmentId: shipmentRecord.id,
          truckId: truckId ?? undefined,
          documentId: documentRow.id,
          documentType: 'manifest',
          status: 'UPLOADED',
        });

        const hasPlaceholderItem = (shipmentRecord.manifestItems ?? []).some(
          item => item.documentId === shipmentDocument.id,
        );

        if (!hasPlaceholderItem) {
          await addShipmentItem.mutateAsync({
            shipmentId: shipmentRecord.id,
            truckId: truckId ?? undefined,
            documentId: shipmentDocument.id,
            status: 'IN_TRANSIT',
            notes: 'Manifest uploaded and awaiting MPS review.',
          });
        }
      } catch (error) {
        await supabase.storage.from('documents').remove([storageData.path]);
        throw error;
      }
    }

    await refetch();
    setStatusMessage('Documents uploaded successfully.');
  };

  const handleTruckSave = async (payload: TruckSchedulePayload) => {
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await updateShipmentTruck.mutateAsync({
        id: payload.truckId,
        shipmentId: payload.shipmentId,
        updates: {
          contactName: payload.contactName,
          contactPhone: payload.contactPhone,
          contactEmail: payload.contactEmail,
          jointsCount: payload.jointsCount ?? null,
          totalLengthFt: payload.totalLengthFt ?? null,
          scheduledSlotStart: payload.slotStartIso ?? null,
          scheduledSlotEnd: payload.slotEndIso ?? null,
          manifestReceived: payload.manifestReceived ?? null,
          notes: payload.notes ?? null,
        },
      });

      if (payload.slotStartIso && payload.slotEndIso) {
        if (payload.appointmentId) {
          await updateDockAppointment.mutateAsync({
            id: payload.appointmentId,
            shipmentId: payload.shipmentId,
            updates: {
              truckId: payload.truckId,
              slotStart: payload.slotStartIso,
              slotEnd: payload.slotEndIso,
              afterHours: payload.afterHours,
              surchargeApplied: payload.afterHours,
              calendarSyncStatus: 'PENDING',
              status: payload.afterHours ? 'PENDING' : 'CONFIRMED',
            },
          });
        } else {
          await createDockAppointment.mutateAsync({
            shipmentId: payload.shipmentId,
            truckId: payload.truckId,
            slotStart: payload.slotStartIso,
            slotEnd: payload.slotEndIso,
            afterHours: payload.afterHours,
            surchargeApplied: payload.afterHours,
            status: payload.afterHours ? 'PENDING' : 'CONFIRMED',
            calendarSyncStatus: 'PENDING',
          });
        }
      }

      const refreshed = await refetch();
      const shipment = refreshed.data?.find(item => item.id === payload.shipmentId);
      if (shipment) {
        const hasAfterHours = (shipment.appointments ?? []).some(appt => appt.afterHours);
        const desiredAmount = hasAfterHours ? 450 : null;
        if (shipment.surchargeApplicable !== hasAfterHours || shipment.surchargeAmount !== desiredAmount) {
          await updateShipment.mutateAsync({
            id: shipment.id,
            updates: {
              surchargeApplicable: hasAfterHours,
              surchargeAmount: desiredAmount,
            },
          });
          await refetch();
        }
      }

      setStatusMessage('Truck schedule saved.');
    } catch (error: any) {
      console.error('Failed to save truck schedule', error);
      setErrorMessage(error.message || 'Unable to save truck schedule right now.');
    }
  };

  const generalDocuments = useMemo(() => {
    if (!activeShipment?.documents) return [];
    return activeShipment.documents.filter(doc => !doc.truckId);
  }, [activeShipment?.documents]);

  return (
    <Card className="bg-gray-950/70 border border-gray-800 shadow-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Schedule Delivery to MPS</h2>
          <p className="text-sm text-gray-400">
            Request {request.referenceId} — {request.requestDetails?.itemType ?? 'Pipe'}
          </p>
        </div>
        <Button onClick={onBack} className="bg-gray-700 hover:bg-gray-600 px-4 py-2">
          &lt; Back to Menu
        </Button>
      </div>

      <StepIndicator current={step} />

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

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          {step === 'method' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => handleShippingMethodSelect('CUSTOMER_PROVIDED')}
                className={clsx(
                  'border border-gray-700 rounded-lg p-6 text-left hover:border-red-500 hover:bg-red-500/10 transition-all',
                  shippingMethod === 'CUSTOMER_PROVIDED' && 'border-red-500 bg-red-500/10',
                )}
              >
                <h3 className="text-lg font-semibold text-white mb-2">Provide My Own Trucking</h3>
                <p className="text-sm text-gray-400">
                  Arrange transportation to MPS, upload manifests, and reserve unloading slots.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleShippingMethodSelect('MPS_QUOTE')}
                className="border border-gray-700 rounded-lg p-6 text-left bg-gray-900/60 text-gray-500 cursor-not-allowed"
                disabled
              >
                <h3 className="text-lg font-semibold text-gray-400 mb-2">Request MPS Shipping (Coming Soon)</h3>
                <p className="text-sm text-gray-500">
                  Let MPS coordinate and quote trucking from your site to our facility.
                </p>
              </button>
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={truckingForm.handleSubmit(handleTruckingDetailsSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="truckingCompany">Trucking Company</Label>
                  <Input
                    id="truckingCompany"
                    placeholder="Company handling transportation"
                    {...truckingForm.register('truckingCompany', { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="contactName">Primary Contact Name</Label>
                  <Input
                    id="contactName"
                    placeholder="Who should we reach on delivery day?"
                    {...truckingForm.register('contactName', { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    placeholder="(555) 123-4567"
                    {...truckingForm.register('contactPhone', { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="contact@email.com"
                    {...truckingForm.register('contactEmail', { required: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="numberOfTrucks">Number of Trucks</Label>
                  <Input
                    id="numberOfTrucks"
                    type="number"
                    min={1}
                    {...truckingForm.register('numberOfTrucks', { valueAsNumber: true, min: 1 })}
                  />
                </div>
                <div>
                  <Label>Estimated Joints to Deliver</Label>
                  <Input
                    value={request.requestDetails?.totalJoints ?? ''}
                    disabled
                    readOnly
                    className="bg-gray-800/60 text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="specialInstructions">Special Instructions for MPS</Label>
                <Textarea
                  id="specialInstructions"
                  rows={3}
                  placeholder="Share loading order, unique handling requirements, or manifest notes."
                  {...truckingForm.register('specialInstructions')}
                />
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  onClick={() => setStep('method')}
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="bg-red-600 hover:bg-red-500"
                  disabled={isSaving || !shippingMethod}
                >
                  {isSaving ? 'Saving...' : `Save & Continue (${numberOfTrucksWatch || 1} Truck${numberOfTrucksWatch === 1 ? '' : 's'})`}
                </Button>
              </div>
            </form>
          )}

          {step === 'schedule' && activeShipment && (
            <div className="space-y-6">
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-300">
                  Provide unloading slots and documentation for each truck. MPS Receiving operates Monday to Friday from
                  7:00 a.m. to 4:30 p.m. Special deliveries outside these hours incur a $450 surcharge.
                </p>
              </div>

              {generalDocuments.length > 0 && (
                <Card className="bg-gray-900/70 border border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-3">
                    Shipment-Level Documents
                  </h3>
                  <TruckDocuments documents={generalDocuments} onPreview={handlePreviewDocument} />
                </Card>
              )}

              <div className="grid grid-cols-1 gap-5">
                {(activeShipment.trucks ?? []).map(truck => (
                  <TruckScheduleCard
                    key={truck.id}
                    shipment={activeShipment}
                    truck={truck}
                    generalContact={generalContactDefaults}
                    onSave={handleTruckSave}
                    onUploadDocuments={handleUploadDocuments}
                    onPreviewDocument={handlePreviewDocument}
                    busy={isSaving}
                  />
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                <div className="text-xs text-gray-500">
                  Need to adjust trucking details?{' '}
                  <button
                    type="button"
                    onClick={() => setStep('details')}
                    className="text-red-400 hover:text-red-300 underline"
                  >
                    Go back to step 2
                  </button>
                </div>
                <Button onClick={onBack} className="bg-gray-700 hover:bg-gray-600">
                  Close Wizard
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default InboundShipmentWizard;
