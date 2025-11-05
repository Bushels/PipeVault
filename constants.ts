
import type { Company, Pipe, StorageRequest, Yard, TruckLoad } from './types';

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
    status: 'IN_STORAGE',
    dropOffTimestamp: '2024-01-20T08:30:00Z',
    storageAreaId: 'B-S-1',
    deliveryTruckLoadId: 'truck-001',
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
    status: 'IN_STORAGE',
    dropOffTimestamp: '2024-01-22T14:15:00Z',
    storageAreaId: 'B-S-1',
    deliveryTruckLoadId: 'truck-002',
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
    status: 'IN_STORAGE',
    dropOffTimestamp: '2024-08-05T10:00:00Z',
    storageAreaId: 'A-A1-3',
    deliveryTruckLoadId: 'truck-003',
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
    assignedLocation: 'Yard A (Open Storage), Row 1 (West), A1-3',
    assignedRackIds: ['A-A1-3'],
    approvalSummary: 'Summit Drilling Co. requests open storage in Row 1 slot A1-3. Recommend approval for this single location.'
  }
];

// --- YARD DATA GENERATION ---

type AreaConfig = {
  id: string;
  name: string;
  rackCount: number;
  allocationMode?: 'LINEAR_CAPACITY' | 'SLOT';
  rackCapacity?: number;
  capacityMeters?: number;
  lengthMeters?: number;
  widthMeters?: number;
  labelFormatter?: (index: number) => string;
};

type YardConfig = {
  id: string;
  name: string;
  areas: AreaConfig[];
};

const AVG_JOINT_LENGTH_FOR_CAPACITY = 12; // meters, assumption for linear rack capacity
const DEFAULT_LINEAR_RACK_CAPACITY = 200; // joints

const formatRowLabel = (rowLabel: string) => (index: number) => `${rowLabel}-${index}`;

const YARD_LAYOUTS: YardConfig[] = [
  {
    id: 'A',
    name: 'Yard A (Open Storage)',
    areas: [
      {
        id: 'A1',
        name: 'Row 1 (West)',
        rackCount: 11,
        allocationMode: 'SLOT',
        rackCapacity: 1,
        capacityMeters: 14.5,
        lengthMeters: 14.5,
        widthMeters: 5,
        labelFormatter: formatRowLabel('A1'),
      },
      {
        id: 'A2',
        name: 'Row 2 (East)',
        rackCount: 11,
        allocationMode: 'SLOT',
        rackCapacity: 1,
        capacityMeters: 14.5,
        lengthMeters: 14.5,
        widthMeters: 5,
        labelFormatter: formatRowLabel('A2'),
      },
    ],
  },
  {
    id: 'B',
    name: 'Yard B (Fenced Storage)',
    areas: [
      { id: 'N', name: 'North', rackCount: 9 },
      { id: 'E', name: 'East', rackCount: 9 },
      { id: 'S', name: 'South', rackCount: 9 },
      { id: 'W', name: 'West', rackCount: 9 },
      { id: 'M', name: 'Middle', rackCount: 9 },
    ],
  },
  {
    id: 'C',
    name: 'Yard C (Cold Storage)',
    areas: [
      { id: 'N', name: 'North', rackCount: 9 },
      { id: 'E', name: 'East', rackCount: 9 },
      { id: 'S', name: 'South', rackCount: 9 },
      { id: 'W', name: 'West', rackCount: 9 },
      { id: 'M', name: 'Middle', rackCount: 9 },
    ],
  },
];

const buildYardData = (): Yard[] => {
  const yardMap = new Map<string, Yard>();
  const rackIndex = new Map<
    string,
    {
      yardId: string;
      areaId: string;
      allocationMode: 'LINEAR_CAPACITY' | 'SLOT';
      capacity: number;
      capacityMeters: number;
    }
  >();

  YARD_LAYOUTS.forEach((yardConfig) => {
    const areas = yardConfig.areas.map((areaConfig) => {
      const allocationMode = areaConfig.allocationMode ?? 'LINEAR_CAPACITY';
      const rackCapacity =
        areaConfig.rackCapacity ??
        (allocationMode === 'SLOT' ? 1 : DEFAULT_LINEAR_RACK_CAPACITY);
      const capacityMeters =
        areaConfig.capacityMeters ??
        (allocationMode === 'SLOT'
          ? rackCapacity
          : rackCapacity * AVG_JOINT_LENGTH_FOR_CAPACITY);
      const labelFormatter =
        areaConfig.labelFormatter ??
        ((index: number) => `Rack ${index}`);

      const racks = Array.from({ length: areaConfig.rackCount }, (_, idx) => {
        const slot = idx + 1;
        const rackId = `${yardConfig.id}-${areaConfig.id}-${slot}`;
        const rack = {
          id: rackId,
          name: labelFormatter(slot),
          capacity: rackCapacity,
          capacityMeters,
          occupied: 0,
          occupiedMeters: 0,
          allocationMode,
          lengthMeters: areaConfig.lengthMeters ?? null,
          widthMeters: areaConfig.widthMeters ?? null,
        };

        rackIndex.set(rackId, {
          yardId: yardConfig.id,
          areaId: `${yardConfig.id}-${areaConfig.id}`,
          allocationMode,
          capacity: rackCapacity,
          capacityMeters,
        });

        return rack;
      });

      return {
        id: `${yardConfig.id}-${areaConfig.id}`,
        name: areaConfig.name,
        racks,
      };
    });

    yardMap.set(
      yardConfig.id,
      {
        id: yardConfig.id,
        name: yardConfig.name,
        areas,
      },
    );
  });

  // Apply existing mock request occupancy
  for (const request of MOCK_REQUESTS) {
    if (
      (request.status === 'APPROVED' || request.status === 'COMPLETED') &&
      request.assignedRackIds &&
      request.assignedRackIds.length > 0
    ) {
      for (const rackId of request.assignedRackIds) {
        const rackDetails = rackIndex.get(rackId);
        if (!rackDetails) continue;

        const yard = yardMap.get(rackDetails.yardId);
        if (!yard) continue;

        const area = yard.areas.find((a) => a.id === rackDetails.areaId);
        if (!area) continue;

        const rack = area.racks.find((r) => r.id === rackId);
        if (!rack) continue;

        if (rack.allocationMode === 'SLOT') {
          rack.occupied = rack.capacity;
          rack.occupiedMeters = rack.capacityMeters;
        } else if (request.requestDetails) {
          const joints = request.requestDetails.totalJoints;
          const meters =
            request.requestDetails.totalJoints * request.requestDetails.avgJointLength;
          rack.occupied += joints;
          rack.occupiedMeters = (rack.occupiedMeters || 0) + meters;
        }
      }
    }
  }

  return Array.from(yardMap.values());
};

export const YARD_DATA: Yard[] = buildYardData();

export const MOCK_TRUCK_LOADS: TruckLoad[] = [
  {
    id: 'truck-001',
    type: 'DELIVERY',
    truckingCompany: 'Alberta Express Hauling',
    driverName: 'Mike Johnson',
    driverPhone: '555-111-2222',
    arrivalTime: '2024-01-20T08:00:00Z',
    departureTime: '2024-01-20T09:15:00Z',
    jointsCount: 120,
    storageAreaId: 'B-S-1',
    relatedRequestId: 'req-001',
    relatedPipeIds: ['pipe-001'],
    notes: 'Casing pipes delivered in good condition. All joints inspected.',
  },
  {
    id: 'truck-002',
    type: 'DELIVERY',
    truckingCompany: 'Alberta Express Hauling',
    driverName: 'Sarah Williams',
    driverPhone: '555-111-3333',
    arrivalTime: '2024-01-22T14:00:00Z',
    departureTime: '2024-01-22T15:30:00Z',
    jointsCount: 300,
    storageAreaId: 'B-S-1',
    relatedRequestId: 'req-001',
    relatedPipeIds: ['pipe-002'],
    notes: 'Drill pipe delivery completed. Storage area B-S-1 at 70% capacity.',
  },
  {
    id: 'truck-003',
    type: 'DELIVERY',
    truckingCompany: 'Summit Transport Inc.',
    driverName: 'Tom Anderson',
    driverPhone: '555-222-4444',
    arrivalTime: '2024-08-05T09:30:00Z',
    departureTime: '2024-08-05T10:45:00Z',
    jointsCount: 150,
    storageAreaId: 'A-A1-3',
    relatedRequestId: 'req-002',
    relatedPipeIds: ['pipe-003'],
    notes: 'Tubing delivered for Summit Drilling. Slot A1-3 in Yard A assigned.',
  },
];
