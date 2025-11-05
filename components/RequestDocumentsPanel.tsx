import React, { useEffect, useMemo, useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import type { Session, StorageRequest, TruckingDocument, TruckingLoad } from '../types';
import {
  useTruckingLoadsByRequest,
  useTruckingDocuments,
  useCreateTruckingDocument,
} from '../hooks/useSupabaseData';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/dateUtils';
import { extractManifestData, type LoadSummary } from '../services/manifestProcessingService';
import LoadSummaryReview from './LoadSummaryReview';

interface RequestDocumentsPanelProps {
  request: StorageRequest;
  session: Session;
  onBack: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const formatLoadLabel = (load: TruckingLoad) => {
  const prefix = load.direction === 'INBOUND' ? 'Truck to MPS' : 'Truck from MPS';
  const sequence = `Load ${load.sequenceNumber}`;
  const status = load.status.replace(/_/g, ' ').toLowerCase();
  return `${prefix} - ${sequence} - ${status}`;
};

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';

const RequestDocumentsPanel: React.FC<RequestDocumentsPanelProps> = ({ request, session, onBack }) => {
  const { data: loads = [], isLoading: loadsLoading } = useTruckingLoadsByRequest(request.id);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileLabel, setFileLabel] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isProcessingManifest, setIsProcessingManifest] = useState(false);
  const [loadSummary, setLoadSummary] = useState<LoadSummary | null>(null);
  const createDocument = useCreateTruckingDocument();

  useEffect(() => {
    if (!loads.length) {
      setSelectedLoadId(null);
      return;
    }
    if (!selectedLoadId || !loads.some((load) => load.id === selectedLoadId)) {
      setSelectedLoadId(loads[0].id);
    }
  }, [loads, selectedLoadId]);

  const selectedLoad = useMemo(
    () => loads.find((load) => load.id === selectedLoadId) ?? null,
    [loads, selectedLoadId]
  );

  const {
    data: documents = [],
    isLoading: documentsLoading,
    refetch: refetchDocuments,
  } = useTruckingDocuments(selectedLoadId ?? undefined);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setErrorMessage('Each file must be 10MB or less.');
      return;
    }

    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setErrorMessage('Only PDF, JPG, PNG, and WebP files are supported.');
      return;
    }

    setErrorMessage(null);
    setFile(nextFile);
    if (!fileLabel) {
      const baseName = nextFile.name.replace(/\.[^/.]+$/, '');
      setFileLabel(baseName);
    }
  };

  const resetFormState = () => {
    setFile(null);
    setFileLabel('');
    setDocumentType('');
    setLoadSummary(null);
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLoadId) {
      setErrorMessage('Select a load to attach your documents to.');
      return;
    }
    if (!file) {
      setErrorMessage('Choose a file to upload.');
      return;
    }

    try {
      setUploading(true);
      setStatusMessage(null);
      setErrorMessage(null);

      const label = fileLabel.trim() || file.name.replace(/\.[^/.]+$/, '');
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'upload';
      const safeName = `${sanitizeFileName(label)}-${Date.now()}.${extension}`;
      const storagePath = `${request.companyId}/${request.referenceId || 'request'}/trucking-loads/${selectedLoadId}/${safeName}`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (storageError || !storageData?.path) {
        throw new Error(storageError?.message || 'Unable to upload the file right now.');
      }

      try {
        await createDocument.mutateAsync({
          truckingLoadId: selectedLoadId,
          fileName: `${label}.${extension}`,
          storagePath: storageData.path,
          documentType: documentType || undefined,
          uploadedBy: session.userId,
          uploadedAt: new Date().toISOString(),
          storageRequestId: request.id,
        });
      } catch (error) {
        await supabase.storage.from('documents').remove([storageData.path]);
        throw error;
      }

      // Check if this is a manifest document that needs AI extraction
      const isManifest =
        documentType.toLowerCase().includes('manifest') ||
        documentType.toLowerCase().includes('bol') ||
        documentType.toLowerCase().includes('bill of lading') ||
        file.type === 'application/pdf';

      // If it's a manifest, extract data using AI
      if (isManifest && (file.type === 'application/pdf' || file.type.startsWith('image/'))) {
        try {
          setIsProcessingManifest(true);
          setStatusMessage('Document uploaded successfully. AI is now extracting pipe data from your manifest...');

          const summary = await extractManifestData(file);
          setLoadSummary(summary);
          setStatusMessage('Document uploaded and manifest data extracted successfully!');

          // Optionally update the trucking load with extracted totals
          if (summary && selectedLoadId) {
            await supabase
              .from('trucking_loads')
              .update({
                total_joints_planned: summary.total_joints,
                total_length_ft_planned: summary.total_length_ft,
                total_weight_lbs_planned: summary.total_weight_lbs,
              })
              .eq('id', selectedLoadId);
          }
        } catch (extractionError: any) {
          console.error('AI extraction failed:', extractionError);
          setStatusMessage('Document uploaded successfully, but AI could not extract manifest data. Admin will review manually.');
        } finally {
          setIsProcessingManifest(false);
        }
      } else {
        setStatusMessage('Document uploaded successfully.');
      }

      resetFormState();
      await refetchDocuments();
    } catch (error: any) {
      setErrorMessage(error.message || 'Unable to upload the document.');
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (document: TruckingDocument) => {
    if (!document.storagePath) {
      setErrorMessage('Document path missing. Please contact support.');
      return;
    }
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(document.storagePath, 300);
    if (error || !data?.signedUrl) {
      setErrorMessage('Unable to open the document preview right now.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const renderNoLoadsState = () => (
    <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-4 text-yellow-100 text-sm">
      <p className="font-semibold mb-1">Uploads unlock after your first load.</p>
      <p className="text-yellow-200/90">
        Request at least one trucking load so we can associate paperwork with it. Once a load exists, it will appear in this
        list for document tagging.
      </p>
    </div>
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-400">Documents for</p>
          <h2 className="text-2xl font-bold text-white">{request.referenceId}</h2>
          <p className="text-xs text-gray-500 mt-1">
            Name your uploads so the MPS yard team knows exactly which load each file belongs to.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onBack}>
            Back to Requests
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-gray-900/40 border border-gray-700/60 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Select Load</p>
            {loadsLoading && <p className="text-sm text-gray-400">Loading trucking loads...</p>}
            {!loadsLoading && !loads.length && renderNoLoadsState()}
            {!loadsLoading && loads.length > 0 && (
              <select
                value={selectedLoadId ?? ''}
                onChange={(event) => setSelectedLoadId(event.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {loads.map((load) => (
                  <option key={load.id} value={load.id}>
                    {formatLoadLabel(load)}
                  </option>
                ))}
              </select>
            )}
            {selectedLoad && (
              <p className="text-xs text-gray-400 mt-2">
                Planned joints: {selectedLoad.totalJointsPlanned ?? 'N/A'} | Status: {selectedLoad.status}
              </p>
            )}
          </div>

          <form onSubmit={handleUpload} className="bg-gray-900/40 border border-gray-700/60 rounded-xl p-4 space-y-4">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Upload Document</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Document Name</label>
              <input
                type="text"
                value={fileLabel}
                onChange={(event) => setFileLabel(event.target.value)}
                placeholder="e.g. Load 2 - POD"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Document Type (optional)</label>
              <input
                type="text"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                placeholder="Manifest, BOL, Photos..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">File</label>
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={handleFileChange}
                className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">PDF, JPG, PNG, WEBP up to 10MB.</p>
            </div>
            {errorMessage && (
              <div className="text-xs text-red-300 bg-red-900/20 border border-red-700/30 rounded-lg p-2">
                {errorMessage}
              </div>
            )}
            {statusMessage && (
              <div className="text-xs text-green-300 bg-green-900/20 border border-green-700/30 rounded-lg p-2">
                {statusMessage}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={uploading || isProcessingManifest || !file || !selectedLoadId || !loads.length}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : isProcessingManifest ? 'AI Processing...' : 'Upload Document'}
              </Button>
              <Button variant="secondary" type="button" onClick={resetFormState} disabled={uploading || isProcessingManifest}>
                Clear
              </Button>
            </div>
          </form>

          {/* AI Extracted Load Summary */}
          {loadSummary && (
            <div className="mt-4">
              <LoadSummaryReview
                loadSummary={loadSummary}
                isProcessing={false}
                hasDocuments={true}
              />
            </div>
          )}
        </div>

        <div className="bg-gray-900/40 border border-gray-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Documents</p>
              <p className="text-sm text-gray-300">
                {selectedLoad ? formatLoadLabel(selectedLoad) : 'No load selected'}
              </p>
            </div>
          </div>
          {documentsLoading && <p className="text-sm text-gray-400">Loading documents...</p>}
          {!documentsLoading && (!documents || documents.length === 0) && (
            <p className="text-sm text-gray-500">No documents uploaded for this load yet.</p>
          )}
          {!documentsLoading && documents.length > 0 && (
            <ul className="space-y-3">
              {documents.map((doc: TruckingDocument) => (
                <li
                  key={doc.id}
                  className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div>
                    <p className="text-sm text-white font-semibold">{doc.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {doc.documentType || 'Uncategorized'} •{' '}
                      {doc.uploadedAt ? formatDate(doc.uploadedAt) : 'Just now'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => handlePreview(doc)}>
                      View
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
};

export default RequestDocumentsPanel;
