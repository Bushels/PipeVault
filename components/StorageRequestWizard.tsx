import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GlassCard from './ui/GlassCard';
import GlassButton from './ui/GlassButton';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  CheckCircleIcon,
  DocumentTextIcon
} from './icons/Icons';
import type { StorageRequest, Session, NewRequestDetails, RequestStatus, TruckingInfo, ProvidedTruckingDetails } from '../types';
import { useAuth } from '../lib/AuthContext';
import { CASING_DATA } from '../data/casingData';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

type MaybePromise<T> = T | Promise<T>;

interface StorageRequestWizardProps {
  request?: StorageRequest;
  session: Session;
  onSubmit: (data: NewRequestDetails) => MaybePromise<void>;
  isSubmitting: boolean;
  onReturnToDashboard?: () => void;
}

const WizardCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="max-w-4xl mx-auto animate-slide-up">
        <div className="relative group">
            {/* Glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500 animate-pulse-slow"></div>
            
            {/* Glassmorphism card */}
            <GlassCard className="relative border-slate-700/50 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-indigo-500/5 to-purple-500/5 rounded-xl"></div>
                <div className="relative p-2">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-indigo-200 tracking-tight mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{title}</h2>
                        {subtitle && <p className="text-slate-400 text-lg">{subtitle}</p>}
                    </div>
                    {children}
                </div>
            </GlassCard>
        </div>
    </div>
);

const Label: React.FC<{ htmlFor: string; children: React.ReactNode; required?: boolean }> = ({ htmlFor, children, required }) => (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
        {children} {required && <span className="text-red-400">*</span>}
    </label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-300"></div>
        <input
            ref={ref}
            className={`relative w-full glass-input rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400/50 transition-all duration-200 ${className}`}
            {...props}
        />
    </div>
));
Input.displayName = "Input";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
    <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-300"></div>
        <div className="relative">
            <select
                ref={ref}
                className={`w-full glass-input rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400/50 transition-all duration-200 appearance-none ${className}`}
                {...props}
            />
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
    </div>
));
Select.displayName = "Select";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
    <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-300"></div>
        <textarea
            ref={ref}
            className={`relative w-full bg-slate-800/70 border border-slate-600/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/50 focus:bg-slate-800/90 transition-all duration-200 hover:border-slate-500 backdrop-blur-sm ${className}`}
            {...props}
        />
    </div>
));
Textarea.displayName = "Textarea";

// Zod Schema for form validation
const schema = z.object({
    referenceId: z.string().min(1, 'Project Reference ID is required').max(50, 'Reference ID too long'),
    companyName: z.string().min(1, 'Company Name is required'),
    fullName: z.string().min(1, 'Full Name is required'),
    contactEmail: z.string().email('Invalid email address').min(1, 'Contact Email is required'),
    contactNumber: z.string().min(1, 'Contact Number is required'),
    itemType: z.enum(['Blank Pipe', 'Sand Control', 'Flow Control', 'Tools', 'Other']),
    sandControlScreenType: z.string().optional(),
    sandControlScreenTypeOther: z.string().optional(),
    casingSpec: z.object({
        size_in: z.number(),
        size_mm: z.number(),
        weight_lbs_ft: z.number(),
        id_in: z.number(),
        id_mm: z.number(),
        drift_in: z.number(),
        drift_mm: z.number(),
    }).nullable(),
    grade: z.string().optional(),
    connection: z.string().optional(),
    threadType: z.string().optional(),
    avgJointLength: z.number().min(0.1, 'Average joint length must be positive'),
    totalJoints: z.number().int().min(1, 'Total joints must be at least 1'),
    storageStartDate: z.string().min(1, 'Start Date is required'),
    storageEndDate: z.string().min(1, 'End Date is required'),
    truckingType: z.enum(['quote', 'provided', 'none']).optional(),
    storageCompany: z.string().optional(),
    storageContactName: z.string().optional(),
    storageContactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
    storageContactNumber: z.string().optional(),
    storageLocation: z.string().optional(),
    specialInstructions: z.string().optional(),
    outerDiameter: z.number().gt(0, 'Outer Diameter is required'),
    weight: z.number().gt(0, 'Weight is required'),
}).superRefine((data, ctx) => {
    if (data.itemType === 'Sand Control' && !data.sandControlScreenType) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Sand Control Screen Type is required for Sand Control items',
            path: ['sandControlScreenType'],
        });
    }
    if (data.sandControlScreenType === 'Other' && !data.sandControlScreenTypeOther) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please specify other screen type',
            path: ['sandControlScreenTypeOther'],
        });
    }
    if (data.truckingType === 'provided') {
        if (!data.storageCompany) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Storage Company is required', path: ['storageCompany'] });
        if (!data.storageContactName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Contact Name is required', path: ['storageContactName'] });
        if (!data.storageContactEmail) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Contact Email is required', path: ['storageContactEmail'] });
        if (!data.storageContactNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Contact Number is required', path: ['storageContactNumber'] });
        if (!data.storageLocation) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Storage Location is required', path: ['storageLocation'] });
    }
});

const StorageRequestWizard: React.FC<StorageRequestWizardProps> = ({
    request,
    session,
    onSubmit,
    isSubmitting,
    onReturnToDashboard
}) => {
    const [step, setStep] = useState(1);
    const { user } = useAuth();
    
    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            referenceId: '',
            companyName: session.company.name,
            fullName: user?.user_metadata?.first_name && user?.user_metadata?.last_name
                ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                : '',
            contactEmail: user?.email || '',
            contactNumber: user?.user_metadata?.contact_number || '',
            itemType: 'Blank Pipe',
            grade: undefined,
            connection: undefined,
            avgJointLength: 0,
            totalJoints: 0,
            storageStartDate: '',
            storageEndDate: '',
            truckingType: 'none',
            specialInstructions: '',
            outerDiameter: 0,
            weight: 0
        }
    });

    const [unitSystem, setUnitSystem] = useState<'imperial' | 'metric'>('imperial'); // Kept for compatibility if needed, but UI now shows both

    const itemType = watch('itemType');
    const sandControlScreenType = watch('sandControlScreenType');
    const truckingType = watch('truckingType');
    const outerDiameter = watch('outerDiameter');
    const weight = watch('weight');

    // Get unique ODs from CASING_DATA
    // We use imperial size as the unique key
    const uniqueODs = Array.from(new Set(CASING_DATA.map(d => d.size_in))).sort((a, b) => a - b);

    // Filter weights based on selected OD
    const availableWeights = CASING_DATA
        .filter(d => d.size_in === outerDiameter)
        .sort((a, b) => a.weight_lbs_ft - b.weight_lbs_ft);

    // Auto-populate ID and Drift when Weight is selected
    useEffect(() => {
        if (outerDiameter && weight) {
            const match = CASING_DATA.find(d => 
                d.size_in === outerDiameter && 
                d.weight_lbs_ft === weight
            );

            if (match) {
                setValue('casingSpec', match);
            }
        }
    }, [outerDiameter, weight, setValue]);

    const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
            <Toaster position="top-right" />
            
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-12">
                {[1, 2, 3].map((stepNumber) => (
                    <React.Fragment key={stepNumber}>
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold transition-all duration-300 ${
                            step >= stepNumber
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] scale-110'
                                : 'bg-slate-800 border-slate-600 text-slate-500'
                        }`}>
                            {step > stepNumber ? <CheckCircleIcon className="w-6 h-6" /> : stepNumber}
                        </div>
                        {stepNumber < 3 && (
                            <div className={`w-16 h-1 transition-colors duration-300 ${
                                step > stepNumber ? 'bg-indigo-600' : 'bg-slate-700'
                            }`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                {step === 1 && (
                    <WizardCard title="Project Details" subtitle="Tell us about your project">
                        <div className="space-y-8">
                            {/* Requestor Summary */}
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl blur-md opacity-50"></div>
                                <div className="relative bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-900/60 backdrop-blur-md rounded-lg p-5 border border-slate-600/30 shadow-xl">
                                    <h3 className="text-sm font-semibold text-indigo-300 mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                                        Requestor Information
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="block text-slate-500 text-xs mb-1">Company</span>
                                            <span className="font-medium text-white">{session.company.name}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs mb-1">Contact</span>
                                            <span className="font-medium text-white">
                                                {user?.user_metadata?.first_name && user?.user_metadata?.last_name
                                                    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs mb-1">Email</span>
                                            <span className="font-medium text-white">{user?.email}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs mb-1">Phone</span>
                                            <span className="font-medium text-white">{user?.user_metadata?.contact_number || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Hidden inputs to maintain form state */}
                                <input type="hidden" {...register('companyName')} />
                                <input type="hidden" {...register('fullName')} />
                                <input type="hidden" {...register('contactEmail')} />
                                <input type="hidden" {...register('contactNumber')} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <Label htmlFor="referenceId" required>Project Reference ID</Label>
                                    <Input id="referenceId" placeholder="e.g. PRJ-2024-001" {...register('referenceId')} />
                                    <p className="mt-1.5 text-xs text-slate-400 ml-1">
                                        This is your internal project reference. You can categorize it however you wish (e.g., well name, AFE number, project code).
                                    </p>
                                    {errors.referenceId && <p className="mt-1 text-sm text-red-400">{errors.referenceId.message}</p>}
                                </div>
                                
                                <div>
                                    <Label htmlFor="storageStartDate" required>Storage Start Date</Label>
                                    <Input type="date" id="storageStartDate" {...register('storageStartDate')} />
                                    {errors.storageStartDate && <p className="mt-1 text-sm text-red-400">{errors.storageStartDate.message}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="storageEndDate" required>Storage End Date</Label>
                                    <Input type="date" id="storageEndDate" {...register('storageEndDate')} />
                                    {errors.storageEndDate && <p className="mt-1 text-sm text-red-400">{errors.storageEndDate.message}</p>}
                                </div>
                            </div>
                        </div>
                    </WizardCard>
                )}

                {step === 2 && (
                    <WizardCard title="Pipe Specifications" subtitle="Define your inventory specs">
                        <div className="space-y-6">


                            <div>
                                <Label htmlFor="itemType" required>Item Type</Label>
                                <Select id="itemType" {...register('itemType')}>
                                    <option value="Blank Pipe">Blank Pipe</option>
                                    <option value="Sand Control">Sand Control</option>
                                    <option value="Flow Control">Flow Control</option>
                                    <option value="Tools">Tools</option>
                                    <option value="Other">Other</option>
                                </Select>
                            </div>

                            {itemType === 'Sand Control' && (
                                <div>
                                    <Label htmlFor="sandControlScreenType" required>Screen Type</Label>
                                    <Select id="sandControlScreenType" {...register('sandControlScreenType')}>
                                        <option value="">Select Screen Type</option>
                                        <option value="Wire Wrap">Wire Wrap</option>
                                        <option value="Premium Mesh">Premium Mesh</option>
                                        <option value="Other">Other</option>
                                    </Select>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor="outerDiameter" required>Outer Diameter</Label>
                                    <Select 
                                        id="outerDiameter" 
                                        {...register('outerDiameter', { valueAsNumber: true })}
                                        onChange={(e) => {
                                            setValue('outerDiameter', parseFloat(e.target.value));
                                            setValue('weight', 0); // Reset weight when OD changes
                                        }}
                                    >
                                        <option value={0}>Select OD</option>
                                        {uniqueODs.map(od => {
                                            // Find the metric equivalent for display
                                            const metricOD = CASING_DATA.find(d => d.size_in === od)?.size_mm;
                                            return (
                                                <option key={od} value={od}>
                                                    {od}" ({metricOD}mm)
                                                </option>
                                            );
                                        })}
                                    </Select>
                                    {errors.outerDiameter && <p className="mt-1 text-sm text-red-400">{errors.outerDiameter.message}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="weight" required>Weight</Label>
                                    <Select 
                                        id="weight" 
                                        {...register('weight', { valueAsNumber: true })}
                                        disabled={!outerDiameter}
                                    >
                                        <option value={0}>Select Weight</option>
                                        {availableWeights.map((d, i) => {
                                            const metricWeight = (d.weight_lbs_ft * 1.488).toFixed(2);
                                            return (
                                                <option key={i} value={d.weight_lbs_ft}>
                                                    {d.weight_lbs_ft} lbs/ft ({metricWeight} kg/m)
                                                </option>
                                            );
                                        })}
                                    </Select>
                                    {errors.weight && <p className="mt-1 text-sm text-red-400">{errors.weight.message}</p>}
                                </div>
                            </div>

                            {/* Display Calculated Fields */}
                            {outerDiameter > 0 && weight > 0 && (
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 rounded-xl blur-md opacity-60 group-hover:opacity-80 transition duration-300"></div>
                                    <div className="relative grid grid-cols-2 gap-4 bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-900/60 backdrop-blur-md p-5 rounded-lg border border-slate-600/30 shadow-xl">
                                        <div>
                                            <span className="block text-xs text-emerald-400 uppercase tracking-wider mb-2 font-medium">Inner Diameter</span>
                                            <span className="text-xl font-mono font-bold text-white">
                                                {watch('casingSpec')?.id_in}" <span className="text-slate-500 text-sm font-normal">({watch('casingSpec')?.id_mm}mm)</span>
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-emerald-400 uppercase tracking-wider mb-2 font-medium">Drift</span>
                                            <span className="text-xl font-mono font-bold text-white">
                                                {watch('casingSpec')?.drift_in}" <span className="text-slate-500 text-sm font-normal">({watch('casingSpec')?.drift_mm}mm)</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <Label htmlFor="grade">Grade <span className="text-slate-500 font-normal text-xs">(Optional)</span></Label>
                                    <Input id="grade" placeholder="e.g. L80, P110" {...register('grade')} />
                                    {errors.grade && <p className="mt-1 text-sm text-red-400">{errors.grade.message}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="connection">Connection <span className="text-slate-500 font-normal text-xs">(Optional)</span></Label>
                                    <Input id="connection" placeholder="e.g. BTC, LTC" {...register('connection')} />
                                    {errors.connection && <p className="mt-1 text-sm text-red-400">{errors.connection.message}</p>}
                                </div>
                            </div>
                        </div>
                    </WizardCard>
                )}

                {step === 3 && (
                    <WizardCard title="Quantity Details" subtitle="How much pipe do you have?">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label htmlFor="totalJoints" required>Total Joints</Label>
                                <Input type="number" id="totalJoints" {...register('totalJoints', { valueAsNumber: true })} />
                                {errors.totalJoints && <p className="mt-1 text-sm text-red-400">{errors.totalJoints.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="avgJointLength" required>Avg Joint Length (m)</Label>
                                <Input type="number" step="0.01" id="avgJointLength" {...register('avgJointLength', { valueAsNumber: true })} />
                                {errors.avgJointLength && <p className="mt-1 text-sm text-red-400">{errors.avgJointLength.message}</p>}
                            </div>
                        </div>

                        {/* Total Meterage Summary */}
                        {watch('totalJoints') > 0 && watch('avgJointLength') > 0 && (
                            <div className="mt-6 relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 rounded-xl blur-md opacity-60 group-hover:opacity-80 transition duration-300"></div>
                                <div className="relative bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-900/60 backdrop-blur-md p-5 rounded-lg border border-slate-600/30 shadow-xl flex items-center justify-between">
                                    <div>
                                        <span className="block text-xs text-indigo-400 uppercase tracking-wider mb-1 font-medium">Total Meterage Requested</span>
                                        <p className="text-slate-400 text-sm">
                                            {watch('totalJoints')} joints × {watch('avgJointLength')} m
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-mono font-bold text-white">
                                            {(watch('totalJoints') * watch('avgJointLength')).toFixed(1)}
                                        </span>
                                        <span className="text-slate-400 ml-1 font-medium">m</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </WizardCard>
                )}



                <div className="max-w-4xl mx-auto flex justify-between mt-8 pt-6 border-t border-slate-700/50">
                    {step > 1 ? (
                        <GlassButton type="button" variant="secondary" onClick={prevStep} className="px-6">
                            <ChevronLeftIcon className="w-4 h-4" /> Back
                        </GlassButton>
                    ) : (
                        <GlassButton type="button" variant="secondary" onClick={onReturnToDashboard} className="px-6">
                            Cancel
                        </GlassButton>
                    )}
                    
                    {step < 3 ? (
                        <GlassButton type="button" variant="primary" onClick={nextStep} className="px-8">
                            Next <ChevronRightIcon className="w-4 h-4" />
                        </GlassButton>
                    ) : (
                        <GlassButton type="submit" variant="primary" disabled={isSubmitting} className="px-8 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]">
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </GlassButton>
                    )}
                </div>
            </form>
        </div>
    );
};

export default StorageRequestWizard;
