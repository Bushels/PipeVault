/**
 * Type definitions for project-centric admin tile data
 * Matches the structure returned by get_project_summaries_by_company() RPC
 */

import type { ManifestItem } from '../types';

// ============================================================================
// Load & Document Types
// ============================================================================

export interface LoadDocument {
  id: string;
  fileName: string;
  storagePath: string;
  documentType: string | null;
  parsedPayload: ManifestItem[] | null;  // AI-extracted manifest data
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface RackAssignment {
  rackId: string;
  rackName: string;
  jointCount: number;
  totalLengthFt: number;
  totalWeightLbs: number;
  statuses: string[];  // Array of statuses (e.g., ['IN_STORAGE'])
  assignedAt: string;
  lastUpdated: string;
}

export interface ProjectLoad {
  id: string;
  sequenceNumber: number;
  status: string;
  scheduledSlotStart: string | null;
  scheduledSlotEnd: string | null;
  totalJointsPlanned: number | null;
  totalJointsCompleted: number | null;
  totalWeightLbsPlanned: number | null;
  totalWeightLbsCompleted: number | null;
  approvedAt: string | null;
  completedAt: string | null;
  truckingCompany: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  documents: LoadDocument[];
  assignedRacks: RackAssignment[];
}

// ============================================================================
// Inventory Types
// ============================================================================

export interface InventorySummary {
  totalJoints: number;
  totalLengthFt: number;
  totalWeightLbs: number;
  rackNames: string[];
}

// ============================================================================
// Pipe Details (Original Request)
// ============================================================================

export interface PipeDetails {
  pipeType: string | null;
  pipeGrade: string | null;
  outerDiameter: number | null;
  connectionType: string | null;
  totalJointsEstimate: number | null;
  storageStartDate: string | null;
  estimatedDuration: number | null;
  specialHandling: string | null;
}

// ============================================================================
// Project (Storage Request) Types
// ============================================================================

export interface ProjectSummary {
  id: string;
  referenceId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  submittedBy: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string;
  pipeDetails: PipeDetails;
  inboundLoads: ProjectLoad[];
  outboundLoads: ProjectLoad[];
  inventorySummary: InventorySummary;
}

// ============================================================================
// Company Types
// ============================================================================

export interface CompanyInfo {
  id: string;
  name: string;
  domain: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface CompanyWithProjects {
  company: CompanyInfo;
  projects: ProjectSummary[];
}

// ============================================================================
// API Response Type (from RPC)
// ============================================================================

export type ProjectSummariesResponse = CompanyWithProjects[];

// ============================================================================
// Workflow State Types
// ============================================================================

export type WorkflowState =
  | 'Pending Approval'
  | 'Waiting on Load #N to MPS'
  | 'All Loads Received'
  | 'In Storage'
  | 'Pending Pickup Request'
  | 'Pickup Requested'
  | 'Waiting on Load #N Pickup'
  | 'Complete';

export type WorkflowBadgeTone = 'pending' | 'info' | 'success' | 'danger' | 'neutral';

export interface WorkflowStateResult {
  state: WorkflowState;
  label: string;
  badgeTone: WorkflowBadgeTone;
  nextAction: string | null;
}

// ============================================================================
// Approval Workflow Types
// ============================================================================

export interface ApprovalRequest {
  requestId: string;
  assignedRackIds: string[];
  requiredJoints: number;
  notes?: string;
}

export interface ApprovalResult {
  success: boolean;
  requestId: string;
  referenceId: string;
  status: 'APPROVED' | 'REJECTED';
  companyId?: string;  // Added: Used for cache invalidation
  assignedRacks?: string[];
  requiredJoints?: number;
  availableCapacity?: number;
  rejectionReason?: string;
  notificationQueued?: boolean;  // Added: Indicates if notification was queued
  message: string;
}

export interface RejectionRequest {
  requestId: string;
  rejectionReason: string;
  notes?: string;  // Added: Optional admin notes
}
