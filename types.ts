export interface Company {
  id: string;
  name: string;
  domain: string;
}

export type PipeStatus = 'PENDING_DELIVERY' | 'IN_STORAGE' | 'PICKED_UP' | 'IN_TRANSIT';

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
  status: PipeStatus;
  // Tracking timestamps
  dropOffTimestamp?: string; // ISO 8601 timestamp when pipe arrived
  pickUpTimestamp?: string; // ISO 8601 timestamp when pipe was picked up
  // Assignment information for pick-up
  assignedUWI?: string; // Unique Well Identifier
  assignedWellName?: string; // Well name
  // Storage location
  storageAreaId?: string; // Which rack/area the pipe is stored in
  // Related truck load
  deliveryTruckLoadId?: string; // ID of the truck load that delivered this pipe
  pickupTruckLoadId?: string; // ID of the truck load that picked up this pipe
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
  contactEmail: string;
  contactNumber: string;
  itemType: 'Blank Pipe' | 'Sand Control' | 'Flow Control' | 'Tools' | 'Other';
  itemTypeOther?: string;
  sandControlScreenType?: 'DWW' | 'PPS' | 'SL' | 'Other';
  sandControlScreenTypeOther?: string;
  casingSpec: CasingSpec | null;
  grade: 'H40' | 'J55' | 'L80' | 'N80' | 'C90' | 'T95' | 'P110' | 'Other';
  gradeOther?: string;
  connection: 'NUE' | 'EUE' | 'BTC' | 'Premium' | 'Semi-Premium' | 'Other';
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

// Truck Load Tracking
export type TruckLoadType = 'DELIVERY' | 'PICKUP';

export interface TruckLoad {
  id: string;
  type: TruckLoadType;
  truckingCompany: string;
  driverName: string;
  driverPhone?: string;
  arrivalTime: string; // ISO 8601 timestamp
  departureTime?: string; // ISO 8601 timestamp (null if still on-site)
  jointsCount: number;
  storageAreaId?: string; // Where the pipe was placed (for DELIVERY)
  relatedRequestId?: string; // Associated storage request
  relatedPipeIds: string[]; // IDs of pipes on this load
  // For pickups
  assignedUWI?: string; // Well identifier for pickup loads
  assignedWellName?: string; // Well name for pickup loads
  notes?: string;
  // Photos/documentation
  photoUrls?: string[]; // URLs to load photos if implemented
}