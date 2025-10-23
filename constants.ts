
import type { Company, Pipe, StorageRequest, Yard } from './types';

export const MOCK_COMPANIES: Company[] = [
  { id: 'mps-group', name: 'MPS Group', domain: 'mpsgroup.ca' },
  { id: 'summit-drilling', name: 'Summit Drilling Co.', domain: 'summitdrilling.com' },
  { id: 'apex-energy', name: 'Apex Energy Resources', domain: 'apex.energy' },
];

export const MOCK_INVENTORY: Pipe[] = [
  {
    id: 'pipe-001',
    companyId: 'mps-group',
    referenceId: '158970-1',
    type: 'Casing',
    grade: 'L80',
    outerDiameter: 9.625,
    weight: 40,
    length: 40,
    quantity: 120,
  },
  {
    id: 'pipe-002',
    companyId: 'mps-group',
    referenceId: '158970-1',
    type: 'Drill Pipe',
    grade: 'S135',
    outerDiameter: 5,
    weight: 19.5,
    length: 31,
    quantity: 300,
  },
   {
    id: 'pipe-003',
    companyId: 'summit-drilling',
    referenceId: 'SD-WELL-4B',
    type: 'Tubing',
    grade: 'N80',
    outerDiameter: 2.875,
    weight: 6.5,
    length: 32,
    quantity: 150,
  },
];

export const MOCK_REQUESTS: StorageRequest[] = [
  {
    id: 'req-001',
    companyId: 'mps-group',
    userId: 'josh@mpsgroup.ca',
    referenceId: '158970-1',
    status: 'COMPLETED',
    requestDetails: {
        companyName: 'MPS Group',
        fullName: 'Josh Smith',
        contactNumber: '555-000-1111',
        // FIX: Changed 'Casing' to 'Blank Pipe' to match the allowed types in NewRequestDetails.
        itemType: 'Blank Pipe',
        casingSpec: { size_in: 9.625, size_mm: 244.48, weight_lbs_ft: 40, id_in: 8.835, id_mm: 224.41, drift_in: 8.679, drift_mm: 220.45 },
        grade: 'L80',
        connection: 'BTC',
        avgJointLength: 12,
        totalJoints: 120,
        storageStartDate: '2024-01-15',
        storageEndDate: '2024-07-15',
    },
    assignedLocation: 'Yard B, South, Rack 1',
    assignedRackIds: ['B-S-1'],
  },
  {
    id: 'req-002',
    companyId: 'summit-drilling',
    userId: 'manager@summitdrilling.com',
    referenceId: 'SD-WELL-4B',
    status: 'APPROVED',
    requestDetails: {
        companyName: 'Summit Drilling Co.',
        fullName: 'Jane Doe',
        contactNumber: '555-123-4567',
        // FIX: Changed 'Tubing' to 'Blank Pipe' to match the allowed types in NewRequestDetails.
        itemType: 'Blank Pipe',
        casingSpec: { size_in: 2.875, size_mm: 73.025, weight_lbs_ft: 6.5, id_in: 2.441, id_mm: 62.0, drift_in: 2.347, drift_mm: 59.61 }, // Mock spec for tubing
        grade: 'N80',
        connection: 'EUE',
        avgJointLength: 9.75,
        totalJoints: 150,
        storageStartDate: '2024-08-01',
        storageEndDate: '2025-02-01',
    },
    assignedLocation: 'Yard A, North, Rack 3',
    assignedRackIds: ['A-N-3'],
    approvalSummary: 'Summit Drilling Co. requests storage for 150 joints of Tubing for 6 months. Recommend approval for single rack allocation.'
  }
];

// --- YARD DATA GENERATION ---

// Get pre-occupied joint counts and meters from existing approved/completed mock requests
const occupiedMetrics = MOCK_REQUESTS.reduce((acc, req) => {
    if ((req.status === 'APPROVED' || req.status === 'COMPLETED') && req.assignedRackIds && req.requestDetails) {
        let jointsToAllocate = req.requestDetails.totalJoints;
        let metersToAllocate = req.requestDetails.totalJoints * req.requestDetails.avgJointLength;
        for (const rackId of req.assignedRackIds) {
             acc[rackId] = {
                joints: (acc[rackId]?.joints || 0) + jointsToAllocate,
                meters: (acc[rackId]?.meters || 0) + metersToAllocate,
            };
            // For this mock, we assume one rack holds the full amount for simplicity
        }
    }
    return acc;
}, {} as { [key: string]: { joints: number; meters: number } });


const generateRacks = (yardId: string, areaId: string, areaName: string, count: number): { racks: any[], area: any } => {
    const racks = [];
    const AVG_JOINT_LENGTH_FOR_CAPACITY = 12; // Assume 12m for capacity calculation
    for (let i = 1; i <= count; i++) {
        const rackId = `${yardId}-${areaId}-${i}`;
        const rackMetrics = occupiedMetrics[rackId] || { joints: 0, meters: 0 };
        const rackCapacity = 200; // Capacity in joints
        racks.push({
            id: rackId,
            name: `Rack ${i}`,
            capacity: rackCapacity, 
            capacityMeters: rackCapacity * AVG_JOINT_LENGTH_FOR_CAPACITY,
            occupied: rackMetrics.joints, 
            occupiedMeters: rackMetrics.meters,
        });
    }
    const area = {
        id: `${yardId}-${areaId}`,
        name: areaName,
        racks,
    };
    return { racks, area };
};

const createYard = (id: string, name: string): Yard => {
    const areasData = [
        { id: 'N', name: 'North', count: 9 },
        { id: 'E', name: 'East', count: 9 },
        { id: 'S', name: 'South', count: 9 },
        { id: 'W', name: 'West', count: 9 },
        { id: 'M', name: 'Middle', count: 9 },
    ];

    const areas = areasData.map(a => generateRacks(id, a.id, a.name, a.count).area);
    
    return { id, name, areas };
};


export const YARD_DATA: Yard[] = [
    createYard('A', 'Yard A (Open Storage)'),
    createYard('B', 'Yard B (Fenced Storage)'),
    createYard('C', 'Yard C (Cold Storage)'),
];