import { useState } from 'react';
import type { Company, Pipe, StorageRequest, Yard } from '../types';
import { MOCK_COMPANIES, MOCK_INVENTORY, MOCK_REQUESTS, YARD_DATA } from '../constants';
import * as emailService from '../services/emailService';

export const useMockData = () => {
  const [companies, setCompanies] = useState<Company[]>(MOCK_COMPANIES);
  const [inventory, setInventory] = useState<Pipe[]>(MOCK_INVENTORY);
  const [requests, setRequests] = useState<StorageRequest[]>(MOCK_REQUESTS);
  const [yards, setYards] = useState<Yard[]>(YARD_DATA);

  const updateRequest = (updatedRequest: StorageRequest) => {
    setRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === updatedRequest.id ? updatedRequest : req
      )
    );
  };

  const addRequest = (newRequest: Omit<StorageRequest, 'id'>) => {
    const newId = `req-${Date.now()}`;
    const requestWithId = { ...newRequest, id: newId };
    setRequests(prevRequests => [...prevRequests, requestWithId]);
    return requestWithId;
  };

  const addCompany = (newCompanyData: Omit<Company, 'id'>) => {
    const newId = newCompanyData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const companyWithId: Company = { ...newCompanyData, id: newId };
    setCompanies(prevCompanies => [...prevCompanies, companyWithId]);
    return companyWithId;
  };

  const approveRequest = (requestId: string, assignedRackIds: string[], requiredJoints: number) => {
    // 1. Update the request status
    let assignedLocation = '';
    const request = requests.find(r => r.id === requestId);
    if (!request || !request.requestDetails) return;
    
    let updatedRequest: StorageRequest | null = null;
    const avgJointLength = request.requestDetails.avgJointLength;


    setRequests(prev => prev.map(r => {
        if (r.id === requestId) {
            // Determine the human-readable location string
            const firstRackId = assignedRackIds[0];
            const [yardId, areaId, _] = firstRackId.split('-');
            const yard = yards.find(y => y.id === yardId);
            const area = yard?.areas.find(a => a.id === `${yardId}-${areaId}`);
            
            if (yard && area) {
                if (assignedRackIds.length > 1) {
                    assignedLocation = `${yard.name}, ${area.name}, ${assignedRackIds.length} Racks`;
                } else {
                    const rack = area.racks.find(r => r.id === firstRackId);
                    assignedLocation = `${yard.name}, ${area.name}, ${rack?.name}`;
                }
            }
            
            updatedRequest = { ...r, status: 'APPROVED' as const, assignedRackIds, assignedLocation };
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
            const area = yard?.areas.find((a: any) => a.id === `${yardId}-${areaId}`);
            const rack = area?.racks.find((r: any) => r.id === rackId);

            if (rack) {
                const spaceInRack = Math.min(jointsToAllocate, rack.capacity - rack.occupied);
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
        r.id === requestId ? { ...r, status: 'REJECTED' as const, rejectionReason: reason } : r
    ));

    // Send notification
    emailService.sendRejectionEmail(request.userId, request.referenceId, reason);
  };


  return { companies, inventory, requests, yards, updateRequest, addRequest, addCompany, approveRequest, rejectRequest };
};