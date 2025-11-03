import React, { useState, useCallback, useRef } from 'react';
import clsx from 'clsx';

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadProgress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

interface DocumentUploadStepProps {
  onFilesSelected: (files: File[]) => Promise<void>;
  uploadedDocuments: UploadedDocument[];
  onRemoveDocument?: (documentId: string) => void;
  isProcessing?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const DocumentUploadStep: React.FC<DocumentUploadStepProps> = ({
  onFilesSelected,
  uploadedDocuments,
  onRemoveDocument,
  isProcessing = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFiles = (files: File[]): string | null => {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    for (const file of files) {
      if (file.size > maxFileSize) {
        return `"${file.name}" exceeds the 10MB size limit.`;
      }
      if (!allowedTypes.includes(file.type)) {
        return `"${file.name}" is not a supported file type. Please upload PDF, JPG, or PNG files.`;
      }
    }
    return null;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    const validationError = validateFiles(filesArray);

    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadError(null);
    try {
      await onFilesSelected(filesArray);
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload files');
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  }, [onFilesSelected]);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-purple-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Upload Manifest/Tally Sheets</h3>
            <p className="text-xs text-gray-300">
              Upload your pipe manifest or tally sheets. Our AI will automatically extract joints count, lengths, weights, and other details.
            </p>
          </div>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={clsx(
          'relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer',
          'hover:border-red-500/50 hover:bg-red-500/5',
          isDragging
            ? 'border-red-500 bg-red-500/10'
            : 'border-gray-700 bg-gray-900/50',
          isProcessing && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={handleFileInputChange}
          disabled={isProcessing}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <p className="text-sm font-medium text-white mb-2">
            {isDragging ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Supports PDF, JPG, PNG • Max 10MB per file
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowseClick();
            }}
            disabled={isProcessing}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Browse Files
          </button>
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="bg-red-500/10 border border-red-400/40 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-200">Upload Error</p>
            <p className="text-xs text-red-300 mt-1">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Uploaded Documents List */}
      {uploadedDocuments.length > 0 && (
        <div className="border border-gray-700 rounded-lg bg-gray-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-200">
              Uploaded Documents ({uploadedDocuments.length})
            </h4>
            <span className="text-xs text-gray-500">
              {uploadedDocuments.filter(d => d.status === 'completed').length} processed
            </span>
          </div>

          <ul className="divide-y divide-gray-800">
            {uploadedDocuments.map((doc) => (
              <li key={doc.id} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* File Icon */}
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      {doc.fileType.includes('pdf') ? (
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.fileSize)}
                        {doc.status === 'uploading' && ` • Uploading ${doc.uploadProgress}%`}
                        {doc.status === 'processing' && ' • AI processing...'}
                        {doc.status === 'completed' && ' • Ready'}
                        {doc.status === 'error' && ` • ${doc.errorMessage || 'Error'}`}
                      </p>

                      {/* Progress Bar */}
                      {doc.status === 'uploading' && (
                        <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${doc.uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Icon/Actions */}
                  <div className="flex-shrink-0">
                    {doc.status === 'uploading' && (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-600 border-t-red-500" />
                    )}
                    {doc.status === 'processing' && (
                      <div className="flex items-center gap-1.5 text-yellow-400">
                        <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full" />
                        <span className="text-xs">AI</span>
                      </div>
                    )}
                    {doc.status === 'completed' && (
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {doc.status === 'error' && (
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {onRemoveDocument && doc.status !== 'uploading' && (
                      <button
                        onClick={() => onRemoveDocument(doc.id)}
                        className="ml-3 text-gray-500 hover:text-red-400 transition-colors"
                        title="Remove document"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Helper Info */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div className="text-xs text-gray-400 space-y-2">
            <p>
              <strong className="text-white">What happens next?</strong> Once uploaded, our AI will automatically extract:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-500 ml-2">
              <li>Total joints count</li>
              <li>Total pipe length (in feet and meters)</li>
              <li>Total weight (in pounds and kilograms)</li>
              <li>Individual pipe details (heat numbers, serial numbers, manufacturers)</li>
            </ul>
            <p className="text-gray-500">
              You'll see a summary in the next step. MPS admin will review and verify all details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUploadStep;
