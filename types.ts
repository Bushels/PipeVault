// ============= WIX DATA TYPES =============

// Casing Specification (from API data)
export interface CasingSpec {
  size_in: number;
  size_mm: number;
  weight_lbs_ft: number;
  id_in: number;
  id_mm: number;
  drift_in: number;
  drift_mm: number;
}

// Request Status
export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'in-transit'
  | 'active'
  | 'pickup-requested'
  | 'completed'
  | 'rejected';

// Item Types
export type ItemType =
  | 'Blank Pipe'
  | 'Sand Control'
  | 'Flow Control'
  | 'Tools'
  | 'Other';

// Pipe Grades
export type PipeGrade =
  | 'H40'
  | 'J55'
  | 'L80'
  | 'N80'
  | 'C90'
  | 'T95'
  | 'P110'
  | 'Other';

// Connection Types
export type ConnectionType =
  | 'NUE'
  | 'EUE'
  | 'BTC'
  | 'Semi-Premium'
  | 'Premium'
  | 'Other';

// Trucking Details
export interface TruckingDetails {
  storageCompany?: string;
  storageContactName?: string;
  storageContactEmail?: string;
  storageContactNumber?: string;
  storageLocation?: string;
  specialInstructions?: string;
}

// Storage Request (Wix Collection)
export interface StorageRequest {
  _id?: string;
  requestNumber: string;
  status: RequestStatus;
  customerId: string;
  customerEmail: string;
  projectReference: string;
  contactName: string;
  companyName: string;
  phoneNumber: string;
  itemType: ItemType;
  itemTypeOther?: string;
  casingOD?: number; // mm
  casingODInches?: number;
  casingWeight?: number; // lbs/ft
  casingID?: number; // mm - calculated
  casingIDInches?: number; // calculated
  driftID?: number; // mm - calculated
  driftIDInches?: number; // calculated
  grade?: PipeGrade;
  gradeOther?: string;
  connection?: ConnectionType;
  connectionOther?: string;
  threadType?: string;
  avgJointLength: number; // meters
  totalJoints: number;
  totalLength: number; // meters - calculated
  storageStartDate: Date;
  storageEndDate: Date;
  truckingType?: 'mps-quote' | 'customer-provided';
  truckingDetails?: TruckingDetails;
  currentLocation?: string;
  assignedYard?: string;
  assignedRack?: string;
  approvedBy?: string;
  approvedDate?: Date;
  rejectionReason?: string;
  specialInstructions?: string;
  createdDate?: Date;
  updatedDate?: Date;
  conversationId?: string;
}

// Inventory (Wix Collection)
export interface Inventory {
  _id?: string;
  requestId: string;
  customerId: string;
  customerEmail: string;
  projectReference: string;
  companyName: string;
  itemType: ItemType;
  specifications: {
    casingOD?: number;
    casingODInches?: number;
    casingWeight?: number;
    casingID?: number;
    casingIDInches?: number;
    driftID?: number;
    driftIDInches?: number;
    grade?: string;
    connection?: string;
    threadType?: string;
    avgJointLength: number;
  };
  totalJointsOriginal: number;
  jointsDelivered: number;
  jointsPickedUp: number;
  jointsInStorage: number;
  totalLengthInStorage: number; // meters
  yardLocation?: string;
  rackLocations?: string;
  storageStartDate: Date;
  storageEndDate: Date;
  lastDeliveryDate?: Date;
  lastPickupDate?: Date;
  status: 'active' | 'completed' | 'cancelled';
  createdDate?: Date;
  updatedDate?: Date;
}

// Delivery Status
export type DeliveryStatus =
  | 'scheduled'
  | 'in-transit'
  | 'arrived'
  | 'completed'
  | 'cancelled';

// Delivery (Wix Collection)
export interface Delivery {
  _id?: string;
  deliveryNumber: string;
  requestId: string;
  customerId: string;
  customerEmail: string;
  projectReference: string;
  deliveryDate: Date;
  deliveryTime: string;
  isAfterHours: boolean;
  truckingCompany: string;
  numberOfTrucks: number;
  jointsPerTruck: number;
  totalJointsDelivery: number;
  driverName?: string;
  driverPhone?: string;
  documents?: string;
  assignedYard?: string;
  assignedRacks?: string;
  status: DeliveryStatus;
  actualArrivalTime?: Date;
  completedBy?: string;
  notes?: string;
  createdDate?: Date;
  updatedDate?: Date;
}

// Pickup Status
export type PickupStatus =
  | 'requested'
  | 'quote-pending'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled';

// Pickup (Wix Collection)
export interface Pickup {
  _id?: string;
  pickupNumber: string;
  requestId: string;
  customerId: string;
  customerEmail: string;
  projectReference: string;
  pickupDate: Date;
  pickupTime: string;
  isAfterHours: boolean;
  truckingType: 'mps-provided' | 'customer-provided';
  truckingCompany?: string;
  numberOfTrucks: number;
  jointsPerTruck: number;
  totalJointsPickup: number;
  totalLengthPickup: number; // meters
  driverName?: string;
  driverPhone?: string;
  currentYard?: string;
  currentRacks?: string;
  quoteRequested: boolean;
  quoteProvided?: boolean;
  quoteAmount?: number;
  status: PickupStatus;
  actualPickupTime?: Date;
  completedBy?: string;
  notes?: string;
  createdDate?: Date;
  updatedDate?: Date;
}

// Document (Wix Collection)
export interface Document {
  _id?: string;
  requestId?: string;
  deliveryId?: string;
  pickupId?: string;
  customerId: string;
  customerEmail: string;
  projectReference: string;
  documentType: 'shipping' | 'bill-of-lading' | 'inspection' | 'other';
  fileName: string;
  fileUrl: string;
  fileType: 'pdf' | 'excel' | 'image';
  parsedData?: any;
  uploadedDate?: Date;
  parsedDate?: Date;
  parsedBy?: string;
}

// Conversation (Wix Collection)
export interface Conversation {
  _id?: string;
  requestId?: string;
  customerId: string;
  customerEmail: string;
  projectReference?: string;
  conversationType: 'inquiry' | 'support' | 'form-help';
  messages: ChatMessage[];
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  summary?: string;
  tags?: string;
}

// Notification Type
export type NotificationType =
  | 'new-request'
  | 'quote-requested'
  | 'delivery-scheduled'
  | 'pickup-requested'
  | 'after-hours-request'
  | 'document-uploaded';

// Notification (Wix Collection)
export interface Notification {
  _id?: string;
  type: NotificationType;
  requestId?: string;
  customerId?: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  readBy?: string;
  readDate?: Date;
  actionRequired: boolean;
  actionType?: 'approve' | 'quote' | 'schedule' | 'review';
  relatedData?: any;
  createdDate?: Date;
}

// Yard Location (Wix Collection)
export interface YardLocation {
  _id?: string;
  yardName: string;
  yardType: 'open' | 'covered' | 'indoor';
  areaName?: string;
  rackId: string;
  rackName: string;
  capacity: number; // joints
  capacityMeters: number;
  occupied: number; // joints
  occupiedMeters: number;
  available: number; // joints
  availableMeters: number;
  currentRequestId?: string;
  isActive: boolean;
  notes?: string;
}

// ============= SHARED TYPES =============

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
  timestamp?: Date;
}

// User Session (Wix Members)
export interface UserSession {
  customerId: string;
  customerEmail: string;
  companyName: string;
  contactName: string;
  isAdmin: false;
}

// Admin Session
export interface AdminSession {
  adminId: string;
  adminEmail: string;
  username: string;
  isAdmin: true;
}

export type AppSession = UserSession | AdminSession;

// ============= FORM DATA TYPES =============

// New Storage Request Form Data
export interface NewStorageRequestForm {
  // Step 1: Contact Information
  contactName: string;
  companyName: string;
  customerEmail: string;
  phoneNumber: string;

  // Step 2: Item Details
  itemType: ItemType;
  itemTypeOther?: string;

  // Step 3: Casing/Tubing Specifications
  casingOD?: number; // mm
  casingODInches?: number; // inches
  casingWeight?: number; // lbs/ft
  casingID?: number; // mm - auto-calculated
  casingIDInches?: number; // inches - auto-calculated
  driftID?: number; // mm - auto-calculated
  driftIDInches?: number; // inches - auto-calculated
  grade?: PipeGrade;
  gradeOther?: string;
  connection?: ConnectionType;
  connectionOther?: string;
  threadType?: string;

  // Step 4: Quantity
  avgJointLength: number; // meters
  totalJoints: number;
  totalLength?: number; // meters - auto-calculated

  // Step 5: Storage Dates
  storageStartDate: Date | string;
  storageEndDate: Date | string;

  // Step 6: Project Reference
  projectReference: string;
}

// Schedule Delivery Form Data
export interface ScheduleDeliveryForm {
  customerEmail: string;
  projectReference: string;
  deliveryDate: Date | string;
  timeSlot: string;
  isAfterHours: boolean;
  truckingCompany: string;
  numberOfTrucks: number;
  jointsPerTruck: number;
  driverName?: string;
  driverPhone?: string;
  specialInstructions?: string;
}

// Request Pickup Form Data
export interface RequestPickupForm {
  customerEmail: string;
  projectReference: string;
  pickupDate: Date | string;
  timeSlot: string;
  isAfterHours: boolean;
  truckingType: 'mps-provided' | 'customer-provided';
  truckingCompany?: string;
  numberOfTrucks: number;
  jointsPerTruck: number;
  totalJointsPickup: number;
  driverName?: string;
  driverPhone?: string;
  specialInstructions?: string;
}

// ============= UTILITY TYPES =============

// Time Slot
export interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
}

// Business Hours
export interface BusinessHours {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  openTime: string; // "08:00"
  closeTime: string; // "17:00"
  slots: TimeSlot[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  offset: number;
}