import React, { useState } from 'react';
import type { TruckLoad, TruckLoadType, Pipe, StorageRequest, Yard } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface TruckReceivingProps {
  requests: StorageRequest[];
  inventory: Pipe[];
  yards: Yard[];
  onSubmit: (truckLoad: Omit<TruckLoad, 'id'>, pipes?: Omit<Pipe, 'id'>[]) => void;
  onClose: () => void;
}

const TruckReceiving: React.FC<TruckReceivingProps> = ({
  requests,
  inventory,
  yards,
  onSubmit,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loadType, setLoadType] = useState<TruckLoadType>('DELIVERY');

  // Truck details
  const [truckingCompany, setTruckingCompany] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [jointsCount, setJointsCount] = useState(0);
  const [relatedRequestId, setRelatedRequestId] = useState('');
  const [storageAreaId, setStorageAreaId] = useState('');
  const [notes, setNotes] = useState('');

  // For PICKUP type
  const [selectedPipeIds, setSelectedPipeIds] = useState<string[]>([]);
  const [assignedUWI, setAssignedUWI] = useState('');
  const [assignedWellName, setAssignedWellName] = useState('');

  // For DELIVERY type - new pipe details
  const [pipeType, setPipeType] = useState<'Drill Pipe' | 'Casing' | 'Tubing' | 'Line Pipe'>('Casing');
  const [pipeGrade, setPipeGrade] = useState('');
  const [pipeOD, setPipeOD] = useState(0);
  const [pipeWeight, setPipeWeight] = useState(0);
  const [pipeLength, setPipeLength] = useState(0);

  const approvedRequests = requests.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED');
  const inStoragePipes = inventory.filter(p => p.status === 'IN_STORAGE');

  // Get all available racks from yards
  const allRacks = yards.flatMap(yard =>
    yard.areas.flatMap(area =>
      area.racks.map(rack => ({
        id: rack.id,
        label: `${yard.name} - ${area.name} - ${rack.name}`,
      }))
    )
  );

  const handleSubmit = () => {
    if (!truckingCompany || !driverName || !arrivalTime || jointsCount <= 0) {
      alert('Please fill in all required truck details');
      return;
    }

    const truckLoadData: Omit<TruckLoad, 'id'> = {
      type: loadType,
      truckingCompany,
      driverName,
      driverPhone,
      arrivalTime,
      jointsCount,
      relatedRequestId: relatedRequestId || undefined,
      storageAreaId: loadType === 'DELIVERY' ? storageAreaId : undefined,
      notes,
      relatedPipeIds: loadType === 'PICKUP' ? selectedPipeIds : [],
      assignedUWI: loadType === 'PICKUP' ? assignedUWI : undefined,
      assignedWellName: loadType === 'PICKUP' ? assignedWellName : undefined,
    };

    // For DELIVERY, also create the pipe inventory record
    let newPipes: Omit<Pipe, 'id'>[] | undefined;
    if (loadType === 'DELIVERY' && relatedRequestId && storageAreaId) {
      const request = approvedRequests.find(r => r.id === relatedRequestId);
      if (request) {
        const newPipe: Omit<Pipe, 'id'> = {
          companyId: request.companyId,
          referenceId: request.referenceId,
          type: pipeType,
          grade: pipeGrade || 'Unknown',
          outerDiameter: pipeOD,
          weight: pipeWeight,
          length: pipeLength,
          quantity: jointsCount,
          status: 'IN_STORAGE',
          dropOffTimestamp: arrivalTime,
          storageAreaId,
          deliveryTruckLoadId: '', // Will be set after truck load is created
        };
        newPipes = [newPipe];
      }
    }

    onSubmit(truckLoadData, newPipes);
    onClose();
  };

  const handlePipeSelection = (pipeId: string) => {
    setSelectedPipeIds(prev => {
      if (prev.includes(pipeId)) {
        return prev.filter(id => id !== pipeId);
      }
      return [...prev, pipeId];
    });
  };

  const selectedPipesJointCount = selectedPipeIds.reduce((total, pipeId) => {
    const pipe = inStoragePipes.find(p => p.id === pipeId);
    return total + (pipe?.quantity || 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-4xl my-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-100">
            {loadType === 'DELIVERY' ? 'Log Incoming Delivery' : 'Log Pipe Pickup'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl"
          >
            x
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            {/* Load Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Load Type *
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setLoadType('DELIVERY')}
                  className={`flex-1 py-3 px-4 rounded-md border-2 transition-all ${
                    loadType === 'DELIVERY'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-semibold">Incoming Delivery</div>
                  <div className="text-xs mt-1">Pipe arriving at facility</div>
                </button>
                <button
                  onClick={() => setLoadType('PICKUP')}
                  className={`flex-1 py-3 px-4 rounded-md border-2 transition-all ${
                    loadType === 'PICKUP'
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-semibold">Outgoing Pickup</div>
                  <div className="text-xs mt-1">Pipe leaving facility</div>
                </button>
              </div>
            </div>

            {/* Truck and Driver Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Trucking Company *
                </label>
                <input
                  type="text"
                  value={truckingCompany}
                  onChange={(e) => setTruckingCompany(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Alberta Express Hauling"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Driver Name *
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Driver Phone
                </label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="555-123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Arrival Time *
                </label>
                <input
                  type="datetime-local"
                  value={arrivalTime ? new Date(arrivalTime).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setArrivalTime(new Date(e.target.value).toISOString())}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Related Request (for DELIVERY) */}
            {loadType === 'DELIVERY' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Related Storage Request
                </label>
                <select
                  value={relatedRequestId}
                  onChange={(e) => setRelatedRequestId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a request (optional)</option>
                  {approvedRequests.map(req => (
                    <option key={req.id} value={req.id}>
                      {req.referenceId} - {req.requestDetails?.companyName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)}>
                Next: {loadType === 'DELIVERY' ? 'Pipe Details' : 'Select Pipes'}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && loadType === 'DELIVERY' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-200">Pipe Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Pipe Type *
                </label>
                <select
                  value={pipeType}
                  onChange={(e) => setPipeType(e.target.value as any)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Casing">Casing</option>
                  <option value="Drill Pipe">Drill Pipe</option>
                  <option value="Tubing">Tubing</option>
                  <option value="Line Pipe">Line Pipe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grade *
                </label>
                <input
                  type="text"
                  value={pipeGrade}
                  onChange={(e) => setPipeGrade(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., L80, N80"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Outer Diameter (in) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={pipeOD || ''}
                  onChange={(e) => setPipeOD(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 9.625"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Weight (lbs/ft) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={pipeWeight || ''}
                  onChange={(e) => setPipeWeight(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Avg Joint Length (ft) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={pipeLength || ''}
                  onChange={(e) => setPipeLength(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Joints *
                </label>
                <input
                  type="number"
                  value={jointsCount || ''}
                  onChange={(e) => setJointsCount(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 120"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Storage Area/Rack *
              </label>
              <select
                value={storageAreaId}
                onChange={(e) => setStorageAreaId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select storage location</option>
                {allRacks.map(rack => (
                  <option key={rack.id} value={rack.id}>
                    {rack.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes about this delivery..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleSubmit}>
                Complete Delivery Log
              </Button>
            </div>
          </div>
        )}

        {step === 2 && loadType === 'PICKUP' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-200">Select Pipes for Pickup</h3>

            <div className="space-y-4">
              {inStoragePipes.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No pipes currently in storage available for pickup.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {inStoragePipes.map(pipe => (
                    <label
                      key={pipe.id}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                        selectedPipeIds.includes(pipe.id)
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPipeIds.includes(pipe.id)}
                        onChange={() => handlePipeSelection(pipe.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 grid grid-cols-5 gap-2 text-sm">
                        <span className="text-gray-300">{pipe.referenceId}</span>
                        <span className="text-gray-400">{pipe.type}</span>
                        <span className="text-gray-400">{pipe.grade}</span>
                        <span className="text-gray-400">{pipe.outerDiameter}" OD</span>
                        <span className="text-gray-400">{pipe.quantity} joints</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedPipeIds.length > 0 && (
                <div className="bg-green-900/20 border border-green-700 rounded-md p-3 text-green-400">
                  Selected: {selectedPipeIds.length} pipe group(s), {selectedPipesJointCount} total joints
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  UWI (Unique Well Identifier) *
                </label>
                <input
                  type="text"
                  value={assignedUWI}
                  onChange={(e) => setAssignedUWI(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 100/12-34-056-07W5/0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Well Name *
                </label>
                <input
                  type="text"
                  value={assignedWellName}
                  onChange={(e) => setAssignedWellName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., ACME 12-34"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Total Joints Count *
              </label>
              <input
                type="number"
                value={jointsCount || selectedPipesJointCount}
                onChange={(e) => setJointsCount(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm joint count"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any additional notes about this pickup..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={selectedPipeIds.length === 0 || !assignedUWI || !assignedWellName}
              >
                Complete Pickup Log
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TruckReceiving;
