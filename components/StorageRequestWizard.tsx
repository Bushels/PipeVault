import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import type { StorageRequest, Session, NewRequestDetails, RequestStatus, TruckingInfo, ProvidedTruckingDetails } from '../types';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { generateRequestSummary } from '../services/geminiService';
import { CASING_DATA } from '../data/casingData';

interface StorageRequestWizardProps {
  request: StorageRequest | null;
  session: Session;
  updateRequest: (request: StorageRequest) => void;
  addRequest: (request: Omit<StorageRequest, 'id'>) => StorageRequest;
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
    connection: 'BTC',
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

const StorageRequestWizard: React.FC<StorageRequestWizardProps> = ({ request, session, updateRequest, addRequest }) => {
    const { signUpWithEmail, signInWithEmail } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [wizardStep, setWizardStep] = useState<'details' | 'trucking' | 'submitted'>('details');
    
    // State for Step 1
    const [formData, setFormData] = useState<NewRequestDetails>({
        ...initialFormState,
        companyName: session.company.name, // Pre-fill company name
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

    useEffect(() => {
        // Reset weight and spec if size changes
        setFormData(f => ({ ...f, casingSpec: null }));
    }, [selectedSize]);
    
    useEffect(() => {
        // Reset dependent fields when itemType changes
        setSelectedSize(null);
        setFormData(f => ({ ...f, casingSpec: null, sandControlScreenType: 'DWW', sandControlScreenTypeOther: '' }));
    }, [formData.itemType]);

    const handleDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setWizardStep('trucking');
    }

    const handleTruckingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!truckingType) return;
        setIsLoading(true);

        const truckingInfo: TruckingInfo = {
            truckingType,
            details: (truckingType === 'quote' || (truckingType === 'provided' && truckingDetails.specialInstructions))
                ? truckingDetails
                : undefined
        };

        try {
            const summary = await generateRequestSummary(formData.companyName, formData.contactEmail, referenceId, formData, truckingInfo);

            const newRequestData = {
                companyId: session.company.id,
                userId: formData.contactEmail,
                referenceId: referenceId,
                status: 'PENDING' as RequestStatus,
                requestDetails: formData,
                truckingInfo: truckingInfo,
                approvalSummary: summary
            };

            if (request) {
                updateRequest({ ...request, ...newRequestData });
            } else {
                addRequest(newRequestData);

                // Create Supabase account for new user (Reference ID = Password)
                try {
                    await signUpWithEmail(formData.contactEmail, referenceId);
                    // Automatically sign in the user
                    await signInWithEmail(formData.contactEmail, referenceId);
                } catch (authError: any) {
                    // If account already exists, just sign in
                    if (authError.message?.includes('already registered')) {
                        try {
                            await signInWithEmail(formData.contactEmail, referenceId);
                        } catch {
                            // Silent fail - user can sign in manually later
                            console.log('Could not auto-sign-in user');
                        }
                    }
                }
            }
            setWizardStep('submitted');
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleTruckingTypeChange = (type: 'quote' | 'provided') => {
        setTruckingType(type);
        setTruckingDetails(initialTruckingDetails); 
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
                    {/* Contact Info */}
                    <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <legend className="text-lg font-semibold text-white mb-2 col-span-full">Contact Information</legend>
                        <div>
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input id="companyName" type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} required />
                        </div>
                         <div>
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} required />
                        </div>
                        <div>
                            <Label htmlFor="contactEmail">Contact Email</Label>
                            <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} required />
                        </div>
                        <div>
                            <Label htmlFor="contactNumber">Contact Number</Label>
                            <Input id="contactNumber" type="tel" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} required />
                        </div>
                    </fieldset>

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
                                    <Label htmlFor="casing-od">OD (in)</Label>
                                    <Select id="casing-od" value={selectedSize || ''} onChange={e => setSelectedSize(parseFloat(e.target.value))} required>
                                        <option value="" disabled>Select Size</option>
                                        {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
                                    </Select>
                                </div>
                                 <div>
                                    <Label htmlFor="casing-weight">Weight (lbs/ft)</Label>
                                    <Select id="casing-weight" value={formData.casingSpec?.weight_lbs_ft || ''} disabled={!selectedSize} onChange={e => {
                                        const spec = availableWeights.find(w => w.weight_lbs_ft === parseFloat(e.target.value));
                                        setFormData({...formData, casingSpec: spec || null});
                                    }} required>
                                        <option value="" disabled>Select Weight</option>
                                        {availableWeights.map(w => <option key={w.weight_lbs_ft} value={w.weight_lbs_ft}>{w.weight_lbs_ft}</option>)}
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
                                <option>NUE</option><option>EUE</option><option>BTC</option><option>Premium</option><option>Semi-Premium</option><option>Other</option>
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
                            <Label htmlFor="referenceId">Project Reference Number</Label>
                            <p className="text-xs text-yellow-400 mb-2">
                                💡 This will act as your unique passcode to check status and make inquiries - make sure it's something you'll remember!
                            </p>
                            <Input id="referenceId" type="text" placeholder="AFE, Project Name, etc." value={referenceId} onChange={e => setReferenceId(e.target.value)} required />
                        </div>
                    </fieldset>

                    <Button type="submit" className="w-full py-3 mt-4">
                        Current Storage Details
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
    
    const renderSubmitted = () => (
         <WizardCard title="Thank You For Your Request!">
            <div className="text-center space-y-4">
                <p className="text-gray-300">Your request has been submitted for approval. Our team will review the details and you will be notified shortly.</p>

                <div className="bg-gray-800 p-6 rounded-lg border-2 border-yellow-500">
                    <p className="text-yellow-400 font-semibold mb-2">🔑 Important - Save This Information!</p>
                    <div className="bg-gray-900 p-4 rounded-md mt-3">
                        <p className="text-sm text-gray-400">Your Project Reference ID</p>
                        <p className="text-2xl font-bold text-red-500 mt-1">{referenceId}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                        💡 Your Project Reference ID acts as your password. Use it with your email to sign in and check your request status.
                    </p>
                </div>

                <p className="text-red-500 font-semibold mt-4">MPS Celebrating 20 Years</p>
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
            case 'trucking': return renderTruckingForm();
            case 'submitted': return renderSubmitted();
            default: return renderDetailsForm();
        }
    }

    return renderStep(request?.status || 'DRAFT', wizardStep);
};

export default StorageRequestWizard;