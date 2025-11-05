import { useState } from 'react';
import type { Company, Pipe, StorageRequest, Yard, TruckLoad } from '../types';
import { MOCK_COMPANIES, MOCK_INVENTORY, MOCK_REQUESTS, YARD_DATA, MOCK_TRUCK_LOADS } from '../constants';
import * as emailService from '../services/emailService';

export const useMockData = () => {
  const [companies, setCompanies] = useState<Company[]>(MOCK_COMPANIES);
  const [inventory, setInventory] = useState<Pipe[]>(MOCK_INVENTORY);
  const [requests, setRequests] = useState<StorageRequest[]>(MOCK_REQUESTS);
  const [yards, setYards] = useState<Yard[]>(YARD_DATA);
  const [truckLoads, setTruckLoads] = useState<TruckLoad[]>(MOCK_TRUCK_LOADS);

  const updateRequest = (updatedRequest: StorageRequest) => {
    setRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === updatedRequest.id ? updatedRequest : req
      )
    );
  };

  const addRequest = (newRequest: Omit<StorageRequest, 'id'>) => {
    const newId = `req-${Date.now()}`;
    const requestWithId: StorageRequest = {
      ...newRequest,
      id: newId,
      approvedAt: newRequest.approvedAt ?? null,
      approvedBy: newRequest.approvedBy ?? null,
      internalNotes: newRequest.internalNotes ?? null,
    };
    setRequests(prevRequests => [...prevRequests, requestWithId]);
    return requestWithId;
  };

  const addCompany = (newCompanyData: Omit<Company, 'id'>) => {
    const newId = newCompanyData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const companyWithId: Company = { ...newCompanyData, id: newId };
    setCompanies(prevCompanies => [...prevCompanies, companyWithId]);
    return companyWithId;
  };

  const approveRequest = (requestId: string, assignedRackIds: string[], requiredJoints: number, notes?: string) => {
    // 1. Update the request status
    let assignedLocation = '';
    const request = requests.find(r => r.id === requestId);
    if (!request || !request.requestDetails) return;
    
    let updatedRequest: StorageRequest | null = null;
    const avgJointLength = request.requestDetails.avgJointLength;
    const approvedAt = new Date().toISOString();
    const approvedBy = 'mock.admin@pipevault.dev';
    const internalNotes = notes?.trim() ? notes.trim() : null;


    setRequests(prev => prev.map(r => {
        if (r.id === requestId) {
            // Determine the human-readable location string
            const firstRackId = assignedRackIds[0];
            const [yardId, areaId, _] = firstRackId.split('-');
            const yard = yards.find(y => y.id === yardId);
            const area = yard?.areas.find(a => a.id === `${yardId}-${areaId}`);
            
            if (yard && area) {
                if (assignedRackIds.length > 1) {
                    assignedLocation = `${yard.name}, ${area.name}, ${assignedRackIds.length} Locations`;
                } else {
                    const rack = area.racks.find(r => r.id === firstRackId);
                    assignedLocation = `${yard.name}, ${area.name}, ${rack?.name ?? firstRackId}`;
                }
            } else {
                console.error('[OpenStorage:Mock] Unable to resolve location label', {
                    requestId,
                    firstRackId,
                    yardId,
                    areaId,
                });
            }
            
            updatedRequest = {
                ...r,
                status: 'APPROVED' as const,
                assignedRackIds,
                assignedLocation,
                approvedAt,
                approvedBy,
                internalNotes,
                rejectionReason: null,
                rejectedAt: null,
            };
            return updatedRequest;
        }
        return r;
    }));
    
    // 2. Update the yard occupancy
    setYards(prevYards => {
        const newYards = JSON.parse(JSON.stringify(prevYards));
        let jointsToAllocate = requiredJoints;

        for (const rackId of assignedRackIds) {
            const [yardId, areaId, rackNum] = rackId.split('-');
            const yard = newYards.find((y: Yard) => y.id === yardId);
            if (!yard) {
                console.error('[OpenStorage:Mock] Yard not found during allocation', { requestId, rackId, yardId });
                continue;
            }

            const area = yard.areas.find((a: any) => a.id === `${yardId}-${areaId}`);
            if (!area) {
                console.error('[OpenStorage:Mock] Area not found during allocation', { requestId, rackId, yardId, areaId });
                continue;
            }

            const rack = area.racks.find((r: any) => r.id === rackId);
            if (!rack) {
                console.error('[OpenStorage:Mock] Rack not found during allocation', { requestId, rackId });
                continue;
            }

            if (rack.allocationMode === 'SLOT') {
                rack.occupied = rack.capacity;
                rack.occupiedMeters = rack.capacityMeters;
            } else {
                const spaceInRack = Math.min(jointsToAllocate, Math.max(0, rack.capacity - rack.occupied));
                const metersForRack = spaceInRack * avgJointLength;

                rack.occupied += spaceInRack;
                rack.occupiedMeters = (rack.occupiedMeters || 0) + metersForRack;
                jointsToAllocate -= spaceInRack;
            }
        }
        return newYards;
    });

    // 3. Send notification
    if (updatedRequest && updatedRequest.assignedLocation) {
        emailService.sendApprovalEmail(updatedRequest.userId, updatedRequest.referenceId, updatedRequest.assignedLocation);
    }
  };

  const rejectRequest = (requestId: string, reason: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    setRequests(prev => prev.map(r => 
        r.id === requestId
            ? {
                ...r,
                status: 'REJECTED' as const,
                rejectionReason: reason,
                approvedAt: null,
                approvedBy: null,
              }
            : r
    ));

    // Send notification
    emailService.sendRejectionEmail(request.userId, request.referenceId, reason);
  };


  const addTruckLoad = (newTruckLoad: Omit<TruckLoad, 'id'>, pipes?: Omit<Pipe, 'id'>[]) => {
    const newId = `truck-${Date.now()}`;
    const truckLoadWithId = { ...newTruckLoad, id: newId };
    setTruckLoads(prev => [...prev, truckLoadWithId]);

    // If pipes are provided (for delivery), add them to inventory
    if (pipes && pipes.length > 0) {
      pipes.forEach(pipe => {
        const pipeWithTruckId = { ...pipe, deliveryTruckLoadId: newId };
        addInventoryItem(pipeWithTruckId);
      });
      // Update the truck load's relatedPipeIds
      truckLoadWithId.relatedPipeIds = pipes.map((_, index) => `pipe-${Date.now() + index}`);
    }

    return truckLoadWithId;
  };

  const updateTruckLoad = (truckLoadId: string, updates: Partial<TruckLoad>) => {
    setTruckLoads(prev => prev.map(load =>
      load.id === truckLoadId ? { ...load, ...updates } : load
    ));
  };

  const addInventoryItem = (newPipe: Omit<Pipe, 'id'>) => {
    const newId = `pipe-${Date.now()}`;
    const pipeWithId = { ...newPipe, id: newId };
    setInventory(prev => [...prev, pipeWithId]);
    return pipeWithId;
  };

  const updateInventoryItem = (pipeId: string, updates: Partial<Pipe>) => {
    setInventory(prev => prev.map(pipe =>
      pipe.id === pipeId ? { ...pipe, ...updates } : pipe
    ));
  };

  const pickUpPipes = (pipeIds: string[], uwi: string, wellName: string, truckLoadId?: string) => {
    const pickUpTimestamp = new Date().toISOString();
    setInventory(prev => prev.map(pipe => {
      if (pipeIds.includes(pipe.id)) {
        return {
          ...pipe,
          status: 'PICKED_UP' as const,
          pickUpTimestamp,
          assignedUWI: uwi,
          assignedWellName: wellName,
          pickupTruckLoadId: truckLoadId,
        };
      }
      return pipe;
    }));
  };

  return {
    companies,
    inventory,
    requests,
    yards,
    truckLoads,
    updateRequest,
    addRequest,
    addCompany,
    approveRequest,
    rejectRequest,
    addTruckLoad,
    updateTruckLoad,
    addInventoryItem,
    updateInventoryItem,
    pickUpPipes,
  };
};
