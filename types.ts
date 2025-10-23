export interface Company {
  id: string;
  name: string;
  domain: string;
}

export interface Pipe {
  id: string;
  companyId: string;
  referenceId: string;
  type: 'Drill Pipe' | 'Casing' | 'Tubing' | 'Line Pipe';
  grade: string;
  outerDiameter: number; // inches
  weight: number; // lbs/ft
  length: number; // feet
  quantity: number;
}

export interface CasingSpec {
  size_in: number;
  size_mm: number;
  weight_lbs_ft: number;
  id_in: number;
  id_mm: number;
  drift_in: number;
  drift_mm: number;
}


export interface NewRequestDetails {
  companyName: string;
  fullName: string;
  contactNumber: string;
  itemType: 'Blank Pipe' | 'Sand Control' | 'Flow Control' | 'Tools' | 'Other';
  itemTypeOther?: string;
  sandControlScreenType?: 'DWW' | 'PPS' | 'SL' | 'Other';
  sandControlScreenTypeOther?: string;
  casingSpec: CasingSpec | null;
  grade: 'H40' | 'J55' | 'L80' | 'N80' | 'C90' | 'T95' | 'P110' | 'Other';
  gradeOther?: string;
  connection: 'NUE' | 'EUE' | 'BTC' | 'Premium' | 'Other';
  connectionOther?: string;
  threadType?: string;
  avgJointLength: number;
  totalJoints: number;
  storageStartDate: string;
  storageEndDate: string;
}

export interface DetailedRequestInfo {
  shippingRequired: boolean;
  pickupAddress: string;
  deliveryContactName: string;
  deliveryContactPhone: string;
  pipeDetails: Omit<Pipe, 'id' | 'companyId'>[];
}

export type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface ProvidedTruckingDetails {
    storageCompany?: string;
    storageContactName?: string;
    storageContactEmail?: string;
    storageContactNumber?: string;
    storageLocation?: string;
    specialInstructions?: string;
}

export interface TruckingInfo {
    truckingType: 'quote' | 'provided';
    details?: ProvidedTruckingDetails;
}

export interface StorageRequest {
  id: string;
  companyId: string;
  userId: string;
  referenceId: string;
  status: RequestStatus;
  requestDetails?: NewRequestDetails;
  truckingInfo?: TruckingInfo;
  detailedInfo?: DetailedRequestInfo;
  storageLocation?: string; // DEPRECATED in favor of assignedLocation
  assignedLocation?: string;
  assignedRackIds?: string[];
  approvalSummary?: string;
  rejectionReason?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// User session
export interface Session {
    company: Company;
    userId: string;
    referenceId?: string;
}

// Admin session
export interface AdminSession {
    isAdmin: true;
    username: string;
}

export type AppSession = Session | AdminSession;

// Storage Yard Data Structure
export interface Rack {
  id: string; // e.g., 'A-N-1'
  name: string; // e.g., 'Rack 1'
  capacity: number; // in joints
  capacityMeters: number; // calculated capacity in meters
  occupied: number; // in joints
  occupiedMeters: number; // in meters
}

export interface YardArea {
  id: string; // e.g., 'A-N'
  name: string; // e.g., 'North'
  racks: Rack[];
}

export interface Yard {
  id: string; // e.g., 'A'
  name: string; // e.g., 'Yard A (Open Storage)'
  areas: YardArea[];
}