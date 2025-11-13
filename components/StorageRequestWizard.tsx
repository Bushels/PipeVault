import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import type { StorageRequest, Session, NewRequestDetails, RequestStatus, TruckingInfo, ProvidedTruckingDetails } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { generateRequestSummary } from '../services/geminiService';
import { CASING_DATA } from '../data/casingData';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

type MaybePromise<T> = T | Promise<T>;

interface StorageRequestWizardProps {
  request: StorageRequest | null;
  session: Session;
  updateRequest: (request: StorageRequest) => MaybePromise<StorageRequest | void>;
  addRequest: (request: Omit<StorageRequest, 'id'>) => MaybePromise<StorageRequest>;
  onSubmitSuccess?: (request: StorageRequest) => void;
  onReturnToDashboard?: () => void;
}

const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-300 mb-2">{children}</label>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} className={`w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`} />
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 ${props.className || ''}`} />
);

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea {...props} rows={3} className={`w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 ${props.className || ''}`} />
);

const WizardCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="max-w-4xl mx-auto">
        <Card>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
            </div>
            {children}
        </Card>
    </div>
);

const initialFormState: NewRequestDetails = {
    companyName: '',
    fullName: '',
    contactEmail: '',
    contactNumber: '',
    itemType: 'Blank Pipe',
    sandControlScreenType: 'DWW',
    casingSpec: null,
    grade: 'J55',
    connection: 'Blank',
    threadType: '',
    avgJointLength: 12.00,
    totalJoints: 100,
    storageStartDate: new Date().toISOString().split('T')[0],
    storageEndDate: '',
};

const initialTruckingDetails: ProvidedTruckingDetails = {
    storageCompany: '',
    storageContactName: '',
    storageContactEmail: '',
    storageContactNumber: '',
    storageLocation: '',
    specialInstructions: ''
};

const StorageRequestWizard: React.FC<StorageRequestWizardProps> = ({
    request,
    session,
    updateRequest,
    addRequest,
    onSubmitSuccess,
    onReturnToDashboard
}) => {
    const { signOut, user } = useAuth();
    const userMetadata = user?.user_metadata ?? {};
    const metadataCompanyName = typeof userMetadata.company_name === 'string' ? userMetadata.company_name : '';
    const metadataFirstName = typeof userMetadata.first_name === 'string' ? userMetadata.first_name : '';
    const metadataLastName = typeof userMetadata.last_name === 'string' ? userMetadata.last_name : '';
    const metadataFullName = metadataFirstName && metadataLastName ? `${metadataFirstName} ${metadataLastName}` : '';
    const metadataContactNumber = typeof userMetadata.contact_number === 'string' ? userMetadata.contact_number : '';
    const [isLoading, setIsLoading] = useState(false);
    const [wizardStep, setWizardStep] = useState<'details' | 'submitted'>('details');
    const [error, setError] = useState<string | null>(null);

    // State for Step 1
    const loggedInEmail = user?.email ?? '';
    const [formData, setFormData] = useState<NewRequestDetails>({
        ...initialFormState,
        companyName: metadataCompanyName || session.company.name,
        fullName: metadataFullName || '',
        contactEmail: loggedInEmail,
        contactNumber: metadataContactNumber || '',
    });
    const [referenceId, setReferenceId] = useState('');
    
    // State for Step 2
    const [truckingType, setTruckingType] = useState<'quote' | 'provided' | null>(null);
    const [truckingDetails, setTruckingDetails] = useState<ProvidedTruckingDetails>(initialTruckingDetails);


    const [selectedSize, setSelectedSize] = useState<number | null>(null);

    const uniqueSizes = useMemo(() => Array.from(new Set(CASING_DATA.map(d => d.size_in))).sort((a,b) => a - b), []);
    const availableWeights = useMemo(() => {
        if (!selectedSize) return [];
        return CASING_DATA.filter(d => d.size_in === selectedSize);
    }, [selectedSize]);

    const formatOdOption = (sizeIn: number) => {
        const matchingSpec = CASING_DATA.find(d => d.size_in === sizeIn);
        const sizeMm = matchingSpec?.size_mm ?? sizeIn * 25.4;
        const mmDisplay = Number(sizeMm.toFixed(2)).toString();
        const inchDisplay = Number(sizeIn.toFixed(3)).toString();
        return `${mmDisplay} (${inchDisplay})`;
    };

    const formatWeightOption = (weightLbsPerFt: number) => {
        const kgPerMeter = weightLbsPerFt * 1.48816394;
        const metricDisplay = kgPerMeter.toFixed(1);
        const imperialDisplay = weightLbsPerFt.toFixed(1);
        return `${metricDisplay} (${imperialDisplay})`;
    };

    useEffect(() => {
        // Reset weight and spec if size changes
        setFormData(f => ({ ...f, casingSpec: null }));
    }, [selectedSize]);
    
    useEffect(() => {
        // Reset dependent fields when itemType changes
        setSelectedSize(null);
        setFormData(prev => {
            const next = { ...prev, casingSpec: null };
            if (formData.itemType === 'Sand Control') {
                return {
                    ...next,
                    sandControlScreenType: prev.sandControlScreenType ?? 'DWW',
                    sandControlScreenTypeOther:
                        prev.sandControlScreenType === 'Other' ? prev.sandControlScreenTypeOther ?? '' : undefined,
                };
            }
            return {
                ...next,
                sandControlScreenType: undefined,
                sandControlScreenTypeOther: undefined,
            };
        });
    }, [formData.itemType]);

    useEffect(() => {
        // Clear any previous error message when the user changes steps
        setError(null);
    }, [wizardStep]);

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            companyName: prev.companyName || metadataCompanyName || session.company.name,
            fullName: prev.fullName || metadataFullName,
            contactEmail: loggedInEmail || prev.contactEmail,
            contactNumber: prev.contactNumber || metadataContactNumber,
        }));
    }, [metadataCompanyName, metadataFullName, metadataContactNumber, loggedInEmail, session.company.name]);

    const handleDetailsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const normalizedReferenceId = referenceId.trim().toUpperCase();
        const normalizedCompanyName = formData.companyName.trim() || session.company.name;
        const normalizedEmail = formData.contactEmail.trim().toLowerCase();

        if (!normalizedReferenceId) {
            setError('Please enter a project reference ID before continuing.');
            return;
        }

        if (!normalizedEmail) {
            setError('Please enter a contact email before continuing.');
            return;
        }

        // Now submit the request directly (no trucking step)
        await handleSubmitRequest(normalizedReferenceId, normalizedCompanyName, normalizedEmail);
    }

    const handleSubmitRequest = async (normalizedReferenceId: string, normalizedCompanyName: string, normalizedEmail: string) => {

        // Trucking info will be added later via "Schedule Delivery to MPS"
        const truckingInfo: TruckingInfo | undefined = undefined;

        const requestDetails: NewRequestDetails = {
            ...formData,
            companyName: normalizedCompanyName,
            contactEmail: normalizedEmail,
        };

        setIsLoading(true);
        setError(null);

        try {
            if (!user) {
                setError('Please sign in before submitting a storage request.');
                return;
            }

            const { data: existingRequests, error: referenceLookupError } = await supabase
                .from('storage_requests')
                .select('id')
                .eq('reference_id', normalizedReferenceId)
                .limit(1);

            if (referenceLookupError) {
                throw referenceLookupError;
            }

            const firstMatch = (existingRequests as Array<{ id: string }> | null)?.[0] || null;
            const duplicateExists = Boolean(firstMatch && firstMatch.id !== request?.id);

            if (duplicateExists) {
                setError('A storage request with this reference ID already exists. Please choose another reference ID.');
                return;
            }

            const summarySession: Session = {
                company: {
                    ...session.company,
                    name: normalizedCompanyName,
                },
                userId: normalizedEmail,
                referenceId: normalizedReferenceId,
            };

            let summary = '';
            try {
                summary = await generateRequestSummary(
                    normalizedCompanyName,
                    summarySession,
                    normalizedReferenceId,
                    requestDetails,
                    truckingInfo
                );
            } catch (summaryError) {
                console.error('Error generating AI summary:', summaryError);
                summary = `Storage request for ${normalizedCompanyName} (Reference ${normalizedReferenceId}). Recommend approval.`;
            }

            if (user) {
                const currentMetadata = user.user_metadata ?? {};
                // Update user metadata if needed (company and contact number only)
                const updatedMetadata: Record<string, string> = {};
                if (normalizedCompanyName && normalizedCompanyName !== (currentMetadata.company_name ?? '')) {
                    updatedMetadata.company_name = normalizedCompanyName;
                }
                if (requestDetails.contactNumber && requestDetails.contactNumber !== (currentMetadata.contact_number ?? '')) {
                    updatedMetadata.contact_number = requestDetails.contactNumber;
                }
                if (Object.keys(updatedMetadata).length) {
                    const { error: updateMetadataError } = await supabase.auth.updateUser({
                        data: updatedMetadata,
                    });
                    if (updateMetadataError) {
                        console.warn('Unable to update user profile metadata:', updateMetadataError.message);
                    }
                }
            }

            const newRequestData: Omit<StorageRequest, 'id'> = {
                companyId: session.company.id,
                userId: normalizedEmail,
                referenceId: normalizedReferenceId,
                status: 'PENDING' as RequestStatus,
                requestDetails,
                truckingInfo,
                approvalSummary: summary,
            };

            let createdRequest: StorageRequest | null = null;

            if (request) {
                await Promise.resolve(updateRequest({ ...request, ...newRequestData }));
            } else {
                createdRequest = await Promise.resolve(addRequest(newRequestData));
                // Slack notification handled automatically by Supabase webhook on INSERT
            }

            setReferenceId(normalizedReferenceId);
            setFormData((prev) => ({
                ...prev,
                companyName: normalizedCompanyName,
                contactEmail: normalizedEmail,
                fullName: requestDetails.fullName,
                contactNumber: requestDetails.contactNumber,
            }));

            if (createdRequest) {
                onSubmitSuccess?.(createdRequest);

                // Show success toast
                toast.success(
                    `Request ${normalizedReferenceId} submitted successfully!`,
                    {
                        duration: 5000,
                        position: 'top-center',
                        style: {
                            background: '#065f46',
                            color: '#fff',
                            padding: '16px',
                            borderRadius: '8px',
                        },
                        icon: '✓',
                    }
                );
            }

            setWizardStep('submitted');
        } catch (err: any) {
            console.error('Error submitting storage request:', err);
            setError(err?.message || 'We ran into an issue while submitting your request. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleTruckingTypeChange = (type: 'quote' | 'provided') => {
        setTruckingType(type);
        setTruckingDetails(initialTruckingDetails); 
        setError(null);
    }
    
    const handleComplete = () => {
         if (!request) return;
        // This flow is now simplified, as trucking is handled pre-approval.
        updateRequest({ ...request, status: 'COMPLETED' });
    }
    
    const renderDetailsForm = () => {
        const totalLength = formData.avgJointLength * formData.totalJoints;
        return (
            <WizardCard title="New Storage Request" subtitle="Fill in the details below to submit your project for approval.">
                <form onSubmit={handleDetailsSubmit} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-900/40 border border-red-700 rounded-md text-sm text-red-200">
                            {error}
                        </div>
                    )}
                    {/* Contact Info - Hidden since we have it from signup */}
                    <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-green-400 text-lg">✓</span>
                            <p className="text-sm font-semibold text-white">Your Contact Information</p>
                        </div>
                        <div className="text-sm text-gray-300 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <span className="text-gray-500 font-medium">Company:</span>
                                <span className="ml-2">{formData.companyName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 font-medium">Name:</span>
                                <span className="ml-2">{formData.fullName}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 font-medium">Email:</span>
                                <span className="ml-2">{formData.contactEmail}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 font-medium">Phone:</span>
                                <span className="ml-2">{formData.contactNumber}</span>
                            </div>
                        </div>
                    </div>

                    {/* Item Details */}
                    <fieldset>
                        <legend className="text-lg font-semibold text-white mb-2">Item Details</legend>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <Label htmlFor="itemType">Type</Label>
                                <Select id="itemType" value={formData.itemType} onChange={e => setFormData({...formData, itemType: e.target.value as any})}>
                                    <option>Blank Pipe</option><option>Sand Control</option><option>Flow Control</option><option>Tools</option><option>Other</option>
                                </Select>
                            </div>
                            {formData.itemType === 'Other' && (
                                <div><Label htmlFor="itemTypeOther">Please Specify</Label><Input id="itemTypeOther" type="text" value={formData.itemTypeOther || ''} onChange={e => setFormData({...formData, itemTypeOther: e.target.value})} required /></div>
                            )}
                         </div>
                    </fieldset>
                    
                    {/* Sand Control Specs */}
                    {formData.itemType === 'Sand Control' && (
                        <fieldset>
                            <legend className="text-lg font-semibold text-white mb-2">Sand Control Specification</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="sandControlType">Screen Type</Label>
                                    <Select id="sandControlType" value={formData.sandControlScreenType} onChange={e => setFormData({...formData, sandControlScreenType: e.target.value as any})}>
                                        <option>DWW</option><option>PPS</option><option>SL</option><option>Other</option>
                                    </Select>
                                </div>
                                {formData.sandControlScreenType === 'Other' && (
                                    <div>
                                        <Label htmlFor="sandControlTypeOther">Please Specify Screen Type</Label>
                                        <Input id="sandControlTypeOther" type="text" value={formData.sandControlScreenTypeOther || ''} onChange={e => setFormData({...formData, sandControlScreenTypeOther: e.target.value})} required />
                                    </div>
                                )}
                            </div>
                        </fieldset>
                    )}
                    
                     {/* Casing Specs */}
                    {(formData.itemType === 'Blank Pipe' || formData.itemType === 'Sand Control') && (
                        <fieldset>
                            <legend className="text-lg font-semibold text-white mb-2">API Casing Specification</legend>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <Label htmlFor="casing-od">OD (mm / in)</Label>
                                    <Select id="casing-od" value={selectedSize || ''} onChange={e => setSelectedSize(parseFloat(e.target.value))} required>
                                        <option value="" disabled>Select Size</option>
                                        {uniqueSizes.map(s => (
                                            <option key={s} value={s}>
                                                {formatOdOption(s)}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                 <div>
                                    <Label htmlFor="casing-weight">Wt (kg/m / lbs/ft)</Label>
                                    <Select id="casing-weight" value={formData.casingSpec?.weight_lbs_ft || ''} disabled={!selectedSize} onChange={e => {
                                        const spec = availableWeights.find(w => w.weight_lbs_ft === parseFloat(e.target.value));
                                        setFormData({...formData, casingSpec: spec || null});
                                    }} required>
                                        <option value="" disabled>Select Weight</option>
                                        {availableWeights.map(w => (
                                            <option key={w.weight_lbs_ft} value={w.weight_lbs_ft}>
                                                {formatWeightOption(w.weight_lbs_ft)}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                <div className="p-2 bg-gray-800 rounded-md">
                                    <p className="text-xs text-gray-400">ID (in / mm)</p>
                                    <p className="font-mono text-white">{formData.casingSpec ? `${formData.casingSpec.id_in.toFixed(3)} / ${formData.casingSpec.id_mm.toFixed(2)}` : '-'}</p>
                                </div>
                                <div className="p-2 bg-gray-800 rounded-md">
                                    <p className="text-xs text-gray-400">Drift ID (in / mm)</p>
                                    <p className="font-mono text-white">{formData.casingSpec ? `${formData.casingSpec.drift_in.toFixed(3)} / ${formData.casingSpec.drift_mm.toFixed(2)}` : '-'}</p>
                                </div>
                            </div>
                        </fieldset>
                    )}

                    {/* Grade, Connection, Thread */}
                    <fieldset className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="grade">Grade</Label>
                            <Select id="grade" value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value as any})}>
                                <option>H40</option><option>J55</option><option>L80</option><option>N80</option><option>C90</option><option>T95</option><option>P110</option><option>Other</option>
                            </Select>
                        </div>
                        {formData.grade === 'Other' && (
                             <div className="sm:col-start-auto lg:col-start-auto"><Label htmlFor="gradeOther">Please Specify Grade</Label><Input id="gradeOther" type="text" value={formData.gradeOther || ''} onChange={e => setFormData({...formData, gradeOther: e.target.value})} required /></div>
                        )}
                         <div>
                            <Label htmlFor="connection">Connection</Label>
                            <Select id="connection" value={formData.connection} onChange={e => setFormData({...formData, connection: e.target.value as any})}>
                                <option>Blank</option><option>NUE</option><option>EUE</option><option>BTC</option><option>Premium</option><option>Semi-Premium</option><option>Other</option>
                            </Select>
                        </div>
                        {formData.connection === 'Other' && (
                             <div className="sm:col-start-auto lg:col-start-auto"><Label htmlFor="connectionOther">Please Specify Connection</Label><Input id="connectionOther" type="text" value={formData.connectionOther || ''} onChange={e => setFormData({...formData, connectionOther: e.target.value})} required /></div>
                        )}
                        <div>
                            <Label htmlFor="threadType">Thread Type</Label>
                            <Input id="threadType" type="text" value={formData.threadType || ''} onChange={e => setFormData({...formData, threadType: e.target.value})} />
                        </div>
                    </fieldset>
                    
                     <fieldset className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                            <Label htmlFor="avgLength">Average length of joint (m)</Label>
                            <Input id="avgLength" type="number" min="0" step="0.01" value={formData.avgJointLength} onChange={e => setFormData({...formData, avgJointLength: parseFloat(e.target.value) || 0})} required />
                        </div>
                        <div>
                            <Label htmlFor="totalJoints">Total number of Joints</Label>
                            <Input id="totalJoints" type="number" min="1" value={formData.totalJoints} onChange={e => setFormData({...formData, totalJoints: parseInt(e.target.value) || 0})} required />
                        </div>
                        <div className="p-2 bg-gray-800 rounded-md">
                           <p className="text-xs text-gray-400">Total Calculated Length (m)</p>
                           <p className="font-mono text-white text-lg">{totalLength.toFixed(2)}</p>
                        </div>
                     </fieldset>


                    {/* Timeline & Reference */}
                    <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <legend className="text-lg font-semibold text-white mb-2 col-span-full">Timeline & Reference</legend>
                        <div>
                            <Label htmlFor="startDate">Requested Start Date</Label>
                            <Input id="startDate" type="date" value={formData.storageStartDate} onChange={e => setFormData({...formData, storageStartDate: e.target.value})} required />
                        </div>
                        <div>
                            <Label htmlFor="endDate">Requested End Date</Label>
                            <Input id="endDate" type="date" value={formData.storageEndDate} onChange={e => setFormData({...formData, storageEndDate: e.target.value})} required />
                        </div>
                        <div>
                            <Label htmlFor="referenceId">Project Reference Number <span className="text-xs text-gray-400">(make unique)</span></Label>
                            <Input id="referenceId" type="text" placeholder="AFE, Project Name, etc." value={referenceId} onChange={e => setReferenceId(e.target.value)} required />
                        </div>
                    </fieldset>

                    <Button type="submit" className="w-full py-3 mt-4" disabled={isLoading}>
                        {isLoading ? 'Submitting Request...' : 'Submit Request'}
                    </Button>
                </form>
            </WizardCard>
        );
    }
    
    const renderTruckingForm = () => {
        const handleTruckingDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setTruckingDetails(prev => ({...prev, [name]: value}));
        }

        return (
            <WizardCard title="Current Storage & Trucking" subtitle="How will your items get to our facility?">
                <form onSubmit={handleTruckingSubmit} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-900/40 border border-red-700 rounded-md text-sm text-red-200">
                            {error}
                        </div>
                    )}
                    <div>
                        <Label>Do you require a trucking quote or have your own trucking?</Label>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button type="button" onClick={() => handleTruckingTypeChange('quote')} className={`w-full p-3 rounded-md text-center transition-all ${truckingType === 'quote' ? 'bg-red-600 ring-2 ring-white' : 'bg-gray-700'}`}>Request a Quote</button>
                            <button type="button" onClick={() => handleTruckingTypeChange('provided')} className={`w-full p-3 rounded-md text-center transition-all ${truckingType === 'provided' ? 'bg-red-600 ring-2 ring-white' : 'bg-gray-700'}`}>Will Provide Trucking</button>
                        </div>
                    </div>

                    {truckingType === 'quote' && (
                        <fieldset className="space-y-4 pt-4 border-t border-gray-700">
                            <legend className="text-lg font-semibold text-white mb-2">Trucking Quote Details</legend>
                            <p className="text-sm text-gray-400">Please provide the current location details for an accurate quote.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><Label htmlFor="storageCompany">Storage Company</Label><Input id="storageCompany" name="storageCompany" type="text" value={truckingDetails.storageCompany} onChange={handleTruckingDetailsChange} required /></div>
                                <div><Label htmlFor="storageContactName">Contact Name</Label><Input id="storageContactName" name="storageContactName" type="text" value={truckingDetails.storageContactName} onChange={handleTruckingDetailsChange} required /></div>
                                <div><Label htmlFor="storageContactEmail">Contact Email</Label><Input id="storageContactEmail" name="storageContactEmail" type="email" value={truckingDetails.storageContactEmail} onChange={handleTruckingDetailsChange} required /></div>
                                <div><Label htmlFor="storageContactNumber">Contact Number</Label><Input id="storageContactNumber" name="storageContactNumber" type="tel" value={truckingDetails.storageContactNumber} onChange={handleTruckingDetailsChange} required /></div>
                            </div>
                            <div><Label htmlFor="storageLocation">Storage Location (City or Full Address)</Label><Input id="storageLocation" name="storageLocation" type="text" value={truckingDetails.storageLocation} onChange={handleTruckingDetailsChange} required /></div>
                            <div><Label htmlFor="specialInstructions">Any Special Instructions?</Label><Textarea id="specialInstructions" name="specialInstructions" value={truckingDetails.specialInstructions} onChange={handleTruckingDetailsChange} /></div>
                        </fieldset>
                    )}
                    
                    {truckingType === 'provided' && (
                        <div className="pt-4 border-t border-gray-700">
                            <Label htmlFor="specialInstructions">Additional Information or Instructions</Label>
                            <Textarea id="specialInstructions" name="specialInstructions" value={truckingDetails.specialInstructions} onChange={handleTruckingDetailsChange} />
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-700">
                        <Button variant="secondary" onClick={() => setWizardStep('details')} className="w-full py-3">Back</Button>
                        <Button type="submit" disabled={isLoading || !truckingType} className="w-full py-3 bg-red-600 hover:bg-red-700 focus:ring-red-500">
                            {isLoading ? <Spinner /> : 'Submit for Approval'}
                        </Button>
                    </div>
                </form>
            </WizardCard>
        );
    }
    
    const handleLogout = async () => {
        await signOut();
        window.location.reload(); // Refresh to go back to auth screen
    };

    const handleDashboardReturn = () => {
        if (onReturnToDashboard) {
            onReturnToDashboard();
        } else {
            setWizardStep('details');
        }
    };

    const renderSubmitted = () => (
         <WizardCard title="Thank You For Your Request!">
            <div className="text-center space-y-4">
                <p className="text-gray-300">Your request has been submitted for approval. Our team will review the details and you will be notified shortly.</p>

                <div className="bg-gray-800 p-6 rounded-lg border-2 border-yellow-500">
                    <p className="text-yellow-400 font-semibold mb-2">Key Information - Save This!</p>
                    <div className="bg-gray-900 p-4 rounded-md mt-3">
                        <p className="text-sm text-gray-400">Your Project Reference ID</p>
                        <p className="text-2xl font-bold text-red-500 mt-1">{referenceId}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        Tip: Keep this Reference ID handy - you will need it to check status, schedule deliveries, and talk to the MPS team about this project.
                    </p>
                </div>

                <p className="text-red-500 font-semibold mt-4">MPS Celebrating 20 Years</p>

                <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
                    <p className="text-sm text-gray-400">You are now signed in to PipeVault</p>
                    <Button
                        onClick={handleDashboardReturn}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 focus:ring-red-500"
                    >
                        Back to Dashboard
                    </Button>
                    <Button
                        onClick={handleLogout}
                        className="w-full py-3 bg-gray-700 hover:bg-gray-600"
                    >
                        Logout
                    </Button>
                </div>
            </div>
        </WizardCard>
    )

    const renderStep = (status: RequestStatus | 'NONE', currentStep: typeof wizardStep) => {
        if (status === 'COMPLETED' || status === 'REJECTED') {
             // These states are handled by the Dashboard
             return null;
        }

        if (status === 'PENDING') {
            return (
                 <WizardCard title="Request Pending Approval" subtitle="Our team is reviewing your request. You will be notified upon approval.">
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                       <h3 className="font-semibold text-white">Request Summary for: {request?.referenceId}</h3>
                       <p className="text-gray-300 text-sm mt-2" style={{ whiteSpace: 'pre-wrap' }}>{request?.approvalSummary || 'Generating summary...'}</p>
                    </div>
                </WizardCard>
            );
        }
        
        if (status === 'APPROVED') {
             return (
                <WizardCard title="Request Approved!" subtitle="Your items have been assigned a storage location.">
                    <div className="text-center space-y-4">
                       <p className="text-gray-300">Your request has been approved and your storage location is confirmed.</p>
                       <div className="bg-gray-800 p-4 rounded-lg inline-block">
                           <p className="text-sm text-gray-400">Assigned Location</p>
                           <p className="text-2xl font-bold text-red-500">{request?.assignedLocation || 'N/A'}</p>
                       </div>
                       <p className="text-gray-400">You can now view your project inventory and interact with the AI assistant from your main dashboard.</p>
                       <Button onClick={handleComplete} className="w-full py-3 bg-red-600 hover:bg-red-700 focus:ring-red-500">
                            Go to Dashboard
                        </Button>
                    </div>
                </WizardCard>
            );
        }
        
        // Handle new request flow (status is DRAFT)
        switch(currentStep) {
            case 'details': return renderDetailsForm();
            case 'submitted': return renderSubmitted();
            default: return renderDetailsForm();
        }
    }

    return (
        <>
            <Toaster />
            {renderStep(request?.status || 'DRAFT', wizardStep)}
        </>
    );
};

export default StorageRequestWizard;

