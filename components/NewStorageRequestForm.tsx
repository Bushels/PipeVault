import React, { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import Spinner from './ui/Spinner';
import { CASING_DATA } from '../data/casingData';
import type {
  NewStorageRequestForm,
  ItemType,
  PipeGrade,
  ConnectionType,
  CasingSpec,
} from '../types';

interface NewStorageRequestFormProps {
  onBack: () => void;
  onSubmit: (data: NewStorageRequestForm) => void;
  customerEmail?: string;
  companyName?: string;
  contactName?: string;
}

type AccordionSection =
  | 'contact'
  | 'item'
  | 'specifications'
  | 'quantity'
  | 'dates'
  | 'reference'
  | 'review';

const NewStorageRequestFormComponent: React.FC<NewStorageRequestFormProps> = ({
  onBack,
  onSubmit,
  customerEmail: initialEmail,
  companyName: initialCompany,
  contactName: initialName,
}) => {
  const [activeSection, setActiveSection] = useState<AccordionSection>('contact');
  const [formData, setFormData] = useState<NewStorageRequestForm>({
    contactName: initialName || '',
    companyName: initialCompany || '',
    customerEmail: initialEmail || '',
    phoneNumber: '',
    itemType: 'Blank Pipe',
    avgJointLength: 0,
    totalJoints: 0,
    storageStartDate: '',
    storageEndDate: '',
    projectReference: '',
  });

  const [selectedCasing, setSelectedCasing] = useState<CasingSpec | null>(null);

  // Update form data
  const updateField = (field: keyof NewStorageRequestForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle casing selection
  const handleCasingSelection = (od: number, weight: number) => {
    const casing = CASING_DATA.find(
      (c) => c.size_in === od && c.weight_lbs_ft === weight
    );
    if (casing) {
      setSelectedCasing(casing);
      updateField('casingOD', casing.size_mm);
      updateField('casingODInches', casing.size_in);
      updateField('casingWeight', casing.weight_lbs_ft);
      updateField('casingID', casing.id_mm);
      updateField('casingIDInches', casing.id_in);
      updateField('driftID', casing.drift_mm);
      updateField('driftIDInches', casing.drift_in);
    }
  };

  // Calculate total length
  const calculateTotalLength = () => {
    if (formData.avgJointLength && formData.totalJoints) {
      const total = formData.avgJointLength * formData.totalJoints;
      updateField('totalLength', total);
      return total;
    }
    return 0;
  };

  // Validate section
  const isSectionComplete = (section: AccordionSection): boolean => {
    switch (section) {
      case 'contact':
        return !!(
          formData.contactName &&
          formData.companyName &&
          formData.customerEmail &&
          formData.phoneNumber
        );
      case 'item':
        return !!formData.itemType;
      case 'specifications':
        return true; // Optional section
      case 'quantity':
        return !!(formData.avgJointLength > 0 && formData.totalJoints > 0);
      case 'dates':
        return !!(formData.storageStartDate && formData.storageEndDate);
      case 'reference':
        return !!formData.projectReference;
      default:
        return false;
    }
  };

  // Handle section toggle
  const toggleSection = (section: AccordionSection) => {
    setActiveSection(activeSection === section ? activeSection : section);
  };

  // Handle form submission
  const handleSubmit = () => {
    const totalLength = calculateTotalLength();
    const finalData = { ...formData, totalLength };
    onSubmit(finalData);
  };

  // Get unique OD values
  const uniqueODs = Array.from(new Set(CASING_DATA.map((c) => c.size_in))).sort(
    (a, b) => a - b
  );

  // Get weights for selected OD
  const getWeightsForOD = (od: number) => {
    return CASING_DATA.filter((c) => c.size_in === od)
      .map((c) => c.weight_lbs_ft)
      .sort((a, b) => a - b);
  };

  const totalLength = calculateTotalLength();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-indigo-400 hover:text-indigo-300 mb-4 flex items-center gap-2"
          >
            ← Back to Menu
          </button>
          <h1 className="text-3xl font-bold text-white">New Storage Request</h1>
          <p className="text-gray-400 mt-2">
            Complete the form below to submit your storage request
          </p>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-4">
          {/* Section 1: Contact Information */}
          <AccordionItem
            title="1. Contact Information"
            isComplete={isSectionComplete('contact')}
            isActive={activeSection === 'contact'}
            onToggle={() => toggleSection('contact')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => updateField('contactName', e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => updateField('customerEmail', e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            {isSectionComplete('contact') && (
              <div className="mt-4">
                <Button onClick={() => toggleSection('item')}>
                  Next: Item Details →
                </Button>
              </div>
            )}
          </AccordionItem>

          {/* Section 2: Item Details */}
          <AccordionItem
            title="2. Item Details"
            isComplete={isSectionComplete('item')}
            isActive={activeSection === 'item'}
            onToggle={() => toggleSection('item')}
            disabled={!isSectionComplete('contact')}
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Type of Pipe/Item *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(['Blank Pipe', 'Sand Control', 'Flow Control', 'Tools', 'Other'] as ItemType[]).map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateField('itemType', type)}
                      className={`py-3 px-4 rounded-md border-2 transition-colors ${
                        formData.itemType === type
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {type}
                    </button>
                  )
                )}
              </div>
              {formData.itemType === 'Other' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Please specify:
                  </label>
                  <input
                    type="text"
                    value={formData.itemTypeOther || ''}
                    onChange={(e) => updateField('itemTypeOther', e.target.value)}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter item type"
                  />
                </div>
              )}
            </div>
            {isSectionComplete('item') && (
              <div className="mt-4">
                <Button onClick={() => toggleSection('specifications')}>
                  Next: Specifications →
                </Button>
              </div>
            )}
          </AccordionItem>

          {/* Section 3: Casing/Tubing Specifications */}
          <AccordionItem
            title="3. Casing/Tubing Specifications"
            isComplete={isSectionComplete('specifications')}
            isActive={activeSection === 'specifications'}
            onToggle={() => toggleSection('specifications')}
            disabled={!isSectionComplete('item')}
          >
            <div className="space-y-4">
              {/* OD Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Outer Diameter (OD)
                  </label>
                  <select
                    value={formData.casingODInches || ''}
                    onChange={(e) => {
                      const od = parseFloat(e.target.value);
                      updateField('casingODInches', od);
                      updateField('casingWeight', undefined);
                      setSelectedCasing(null);
                    }}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select OD</option>
                    {uniqueODs.map((od) => (
                      <option key={od} value={od}>
                        {od}" ({CASING_DATA.find((c) => c.size_in === od)?.size_mm} mm)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Weight Selection */}
                {formData.casingODInches && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Weight (lbs/ft)
                    </label>
                    <select
                      value={formData.casingWeight || ''}
                      onChange={(e) => {
                        const weight = parseFloat(e.target.value);
                        handleCasingSelection(formData.casingODInches!, weight);
                      }}
                      className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Weight</option>
                      {getWeightsForOD(formData.casingODInches).map((weight) => (
                        <option key={weight} value={weight}>
                          {weight} lbs/ft
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Display calculated ID and Drift ID */}
              {selectedCasing && (
                <div className="bg-indigo-900 bg-opacity-30 border border-indigo-700 rounded-md p-4">
                  <h4 className="text-sm font-semibold text-indigo-300 mb-3">
                    API Calculated Specifications:
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Inner Diameter (ID):</span>
                      <p className="text-white font-medium">
                        {selectedCasing.id_mm} mm ({selectedCasing.id_in}")
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Drift ID:</span>
                      <p className="text-white font-medium">
                        {selectedCasing.drift_mm} mm ({selectedCasing.drift_in}")
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Grade */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grade
                </label>
                <select
                  value={formData.grade || ''}
                  onChange={(e) => updateField('grade', e.target.value as PipeGrade)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Grade</option>
                  {['H40', 'J55', 'L80', 'N80', 'C90', 'T95', 'P110', 'Other'].map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
                {formData.grade === 'Other' && (
                  <input
                    type="text"
                    value={formData.gradeOther || ''}
                    onChange={(e) => updateField('gradeOther', e.target.value)}
                    placeholder="Enter grade"
                    className="mt-2 w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Connection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Connection
                </label>
                <select
                  value={formData.connection || ''}
                  onChange={(e) => updateField('connection', e.target.value as ConnectionType)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Connection</option>
                  {['NUE', 'EUE', 'BTC', 'Semi-Premium', 'Premium', 'Other'].map((conn) => (
                    <option key={conn} value={conn}>
                      {conn}
                    </option>
                  ))}
                </select>
                {formData.connection === 'Other' && (
                  <input
                    type="text"
                    value={formData.connectionOther || ''}
                    onChange={(e) => updateField('connectionOther', e.target.value)}
                    placeholder="Enter connection type"
                    className="mt-2 w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Thread Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Thread Type (Optional)
                </label>
                <input
                  type="text"
                  value={formData.threadType || ''}
                  onChange={(e) => updateField('threadType', e.target.value)}
                  placeholder="Enter thread type"
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={() => toggleSection('quantity')}>
                Next: Quantity →
              </Button>
            </div>
          </AccordionItem>

          {/* Section 4: Quantity */}
          <AccordionItem
            title="4. Quantity"
            isComplete={isSectionComplete('quantity')}
            isActive={activeSection === 'quantity'}
            onToggle={() => toggleSection('quantity')}
            disabled={!isSectionComplete('item')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Average Length per Joint (metres) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.avgJointLength || ''}
                    onChange={(e) => updateField('avgJointLength', parseFloat(e.target.value))}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Number of Joints *
                  </label>
                  <input
                    type="number"
                    value={formData.totalJoints || ''}
                    onChange={(e) => updateField('totalJoints', parseInt(e.target.value))}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Display Total Length */}
              {totalLength > 0 && (
                <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-md p-4">
                  <h4 className="text-sm font-semibold text-green-300 mb-2">
                    Calculated Total Length:
                  </h4>
                  <p className="text-2xl font-bold text-white">
                    {totalLength.toFixed(2)} metres
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    ({(totalLength * 3.28084).toFixed(2)} feet)
                  </p>
                </div>
              )}
            </div>
            {isSectionComplete('quantity') && (
              <div className="mt-4">
                <Button onClick={() => toggleSection('dates')}>
                  Next: Storage Dates →
                </Button>
              </div>
            )}
          </AccordionItem>

          {/* Section 5: Storage Dates */}
          <AccordionItem
            title="5. Storage Dates"
            isComplete={isSectionComplete('dates')}
            isActive={activeSection === 'dates'}
            onToggle={() => toggleSection('dates')}
            disabled={!isSectionComplete('quantity')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Requested Start Date *
                </label>
                <input
                  type="date"
                  value={formData.storageStartDate}
                  onChange={(e) => updateField('storageStartDate', e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Requested End Date *
                </label>
                <input
                  type="date"
                  value={formData.storageEndDate}
                  onChange={(e) => updateField('storageEndDate', e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            {isSectionComplete('dates') && (
              <div className="mt-4">
                <Button onClick={() => toggleSection('reference')}>
                  Next: Project Reference →
                </Button>
              </div>
            )}
          </AccordionItem>

          {/* Section 6: Project Reference */}
          <AccordionItem
            title="6. Project Reference Number"
            isComplete={isSectionComplete('reference')}
            isActive={activeSection === 'reference'}
            onToggle={() => toggleSection('reference')}
            disabled={!isSectionComplete('dates')}
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project Reference Number *
              </label>
              <input
                type="text"
                value={formData.projectReference}
                onChange={(e) => updateField('projectReference', e.target.value)}
                placeholder="e.g., Project Name, AFE, RFQ, RFP, Well Name, UWI"
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-sm text-gray-400 mt-2">
                This reference number will be used to organize and track your storage. You'll need
                this number to access your account after approval.
              </p>
            </div>
            {isSectionComplete('reference') && (
              <div className="mt-4">
                <Button onClick={() => toggleSection('review')}>
                  Review & Submit →
                </Button>
              </div>
            )}
          </AccordionItem>

          {/* Section 7: Review & Submit */}
          <AccordionItem
            title="7. Review & Submit"
            isComplete={false}
            isActive={activeSection === 'review'}
            onToggle={() => toggleSection('review')}
            disabled={!isSectionComplete('reference')}
          >
            <div className="space-y-4">
              <p className="text-gray-300">
                Please review your information before submitting:
              </p>

              {/* Summary */}
              <div className="bg-gray-800 rounded-md p-4 space-y-3">
                <SummaryItem label="Contact" value={`${formData.contactName} - ${formData.companyName}`} />
                <SummaryItem label="Email" value={formData.customerEmail} />
                <SummaryItem label="Phone" value={formData.phoneNumber} />
                <SummaryItem label="Item Type" value={formData.itemType === 'Other' ? formData.itemTypeOther || formData.itemType : formData.itemType} />
                {selectedCasing && (
                  <>
                    <SummaryItem
                      label="Casing OD"
                      value={`${selectedCasing.size_in}" (${selectedCasing.size_mm} mm)`}
                    />
                    <SummaryItem
                      label="Weight"
                      value={`${selectedCasing.weight_lbs_ft} lbs/ft`}
                    />
                    <SummaryItem
                      label="ID / Drift ID"
                      value={`${selectedCasing.id_in}" / ${selectedCasing.drift_in}"`}
                    />
                  </>
                )}
                {formData.grade && (
                  <SummaryItem
                    label="Grade"
                    value={formData.grade === 'Other' ? formData.gradeOther || formData.grade : formData.grade}
                  />
                )}
                {formData.connection && (
                  <SummaryItem
                    label="Connection"
                    value={formData.connection === 'Other' ? formData.connectionOther || formData.connection : formData.connection}
                  />
                )}
                <SummaryItem
                  label="Quantity"
                  value={`${formData.totalJoints} joints × ${formData.avgJointLength}m = ${totalLength.toFixed(2)}m`}
                />
                <SummaryItem
                  label="Storage Period"
                  value={`${formData.storageStartDate} to ${formData.storageEndDate}`}
                />
                <SummaryItem label="Project Reference" value={formData.projectReference} />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={onBack}
                  className="flex-1 bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} className="flex-1">
                  Submit Request
                </Button>
              </div>
            </div>
          </AccordionItem>
        </div>
      </div>
    </div>
  );
};

// Accordion Item Component
interface AccordionItemProps {
  title: string;
  isComplete: boolean;
  isActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  isComplete,
  isActive,
  onToggle,
  disabled,
  children,
}) => {
  return (
    <Card className={disabled ? 'opacity-50' : ''}>
      <button
        onClick={onToggle}
        disabled={disabled}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isComplete ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            {isComplete ? '✓' : '○'}
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <span className="text-gray-400">{isActive ? '▲' : '▼'}</span>
      </button>

      {isActive && <div className="p-4 border-t border-gray-700">{children}</div>}
    </Card>
  );
};

// Summary Item Component
const SummaryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  return (
    <div className="flex justify-between items-start">
      <span className="text-gray-400 text-sm">{label}:</span>
      <span className="text-white font-medium text-sm text-right max-w-md">{value}</span>
    </div>
  );
};

export default NewStorageRequestFormComponent;
